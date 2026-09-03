# Decisiones — BioConect

## TP1 — Git colaborativo

### Estrategia de branching
Elegí GitHub Flow (rama corta por feature, Pull Request obligatorio, merge por squash).
Es la estrategia recomendada por la cátedra para proyectos con deploy continuo simple,
y al ser un TP individual no necesito coordinar ramas paralelas de otras personas ni
mantener ramas permanentes como develop/release (GitFlow).

### Protección de main
Configuré un ruleset sobre main con:
- Pull request obligatorio antes de mergear (0 approvals requeridos, porque GitHub no
  permite aprobar el propio PR y el TP es individual).
- Bypass list vacía (ni siquiera yo como admin puedo saltear la regla) - esto evita que
  la protección sea solo "teatro", como se explicó en la Clase 1.

Al principio creé el ruleset sin asignarle "Target branches", por lo que no se aplicaba
a ninguna rama (GitHub avisa esto con un cartel amarillo). Lo corregí agregando "Include
default branch" para que apunte efectivamente a main.

### Conflicto de merge
Generé un conflicto real entre dos ramas (feature/titulo-a y feature/titulo-b) que
modificaban la misma línea del README (el título) partiendo del mismo commit base.
Git no pudo resolverlo solo porque no tiene forma de saber cuál de las dos versiones de
contenido es la "correcta" - esa es una decisión de contenido que solo puede tomar una
persona.

Además, en el merge local (git merge origin/main) Git detectó el archivo README.md
como binario en vez de texto, probablemente por una diferencia de codificación generada
en una edición anterior con el Bloc de notas de Windows. Por eso no insertó los
marcadores automáticos (<<<<<<<, =======, >>>>>>>) como en un conflicto de texto común,
sino que dejó directamente la versión de mi rama y marcó el archivo como "both modified"
en git status. Lo resolví reescribiendo el archivo completo a mano con el contenido
final que decidí (unión de ambos títulos), y completé el merge con git add + git commit.

### Qué habría evitado el conflicto
Ramas más cortas e integración más frecuente a main. Ambas ramas partieron del mismo
commit base y avanzaron en paralelo sin integrarse entre medio; si una se hubiera
mergeado primero y la otra hubiera hecho pull/rebase antes de seguir, el conflicto se
habría detectado con muchos menos cambios en juego, mucho antes y más fácil de resolver.

### Problemas encontrados
- Terminales nuevas (PowerShell vs Git Bash) a veces abrían en la carpeta padre en vez
  de la carpeta del repo clonado, lo que generaba errores de "not a git repository".
  Solución: verificar siempre con git status antes de operar.
- Edición de archivos con el Bloc de notas de Windows generó problemas de guardado
  (cambios que no se persistían) y de codificación (Git interpretando un archivo de
  texto como binario). Solución: para archivos críticos, editar directo desde
  PowerShell con Set-Content / Add-Content en vez de depender de Notepad.
- VS Code mostraba una versión en caché del archivo en conflicto (con un popup de
  "cambios no guardados") mientras Git ya había modificado el archivo real en disco.
  Solución: elegir "Volver a cargar" para descartar la caché del editor y ver el
  contenido real del archivo.

### Uso de IA
Usé Claude (Anthropic) como asistente durante todo el TP: para entender el flujo de
branch protection de GitHub, para armar paso a paso los comandos de Git y diagnosticar
los errores que fui encontrando (rutas incorrectas, el conflicto binario, problemas de
guardado en Notepad), y para redactar este documento de decisiones. Las decisiones de
fondo (qué estrategia de branching usar, cómo resolver el contenido final del conflicto,
qué reglas de protección activar) las tomé y las entendí yo.

## TP2 — Contenedores (Docker)

### App elegida
BioConect: plataforma de gestión de resultados de laboratorio. Cumple los criterios
de la cátedra: es chica (backend + frontend + BD), corre local sin servicios externos
raros, y la entiendo completa porque la estoy armando yo desde cero.

### Imagen base y multi-stage del backend
- Etapa `build`: `python:3.12-slim`, instala las dependencias de `requirements.txt`
  con `pip install --user` (así quedan en `/root/.local`, una ruta fácil de copiar
  a la siguiente etapa).
- Etapa `final`: `python:3.12-slim` de nuevo, pero limpia - solo copia
  `/root/.local` (los paquetes ya instalados) y el código de `app/`. No lleva
  ninguna herramienta de compilación extra.

### Imagen base y multi-stage del frontend
- Etapa `build`: `node:24-alpine`, corre `npm ci` + `npm run build` para
  compilar React a archivos estáticos.
- Etapa `final`: `nginx:1.27-alpine`, copia solo `/app/dist` (el resultado
  compilado) y sirve con nginx. Node y todo `node_modules` quedan atrás en
  la etapa `build` - no viajan a la imagen final.

### Medición de tamaño
- Backend: base `python:3.12-slim` 119MB → imagen final 167MB (diferencia ~48MB,
  correspondientes a FastAPI, Uvicorn, SQLModel, SQLAlchemy y sus dependencias).
  Como Python no tiene un "SDK pesado" separable como .NET, la ganancia de espacio
  de multi-stage acá es menor que en otros lenguajes, pero el beneficio real es que
  la etapa `build` no deja rastros: ni cache de pip, ni archivos temporales de
  compilación, solo los paquetes finales.
- Frontend: imagen final 48.5MB. La ganancia de multi-stage acá es mucho más
  marcada que en el backend: node_modules puede pesar cientos de MB, y ninguno de
  esos paquetes de desarrollo llega a la imagen que se publica.

### Cómo se encuentran los servicios
Los contenedores se encuentran por nombre de servicio dentro de la red interna
que crea Docker Compose (DNS embebido). El backend se conecta a la base con
`db:5432` (no una IP), y el frontend, a través de nginx, reenvía `/api/` a
`http://backend:8000/`. Esto solo funciona dentro de la red de compose - probarlo
con `docker run` aislado falla porque ese nombre no existe fuera de ese contexto
(lo comprobé al intentar correr el frontend suelto, ver problema abajo).

### healthcheck vs depends_on
depends_on solo ordena el ARRANQUE de los contenedores, no garantiza que el
servicio esté listo para recibir conexiones. Esto se comprobó en la práctica: el
backend arrancaba antes de que Postgres aceptara conexiones reales, aunque el
contenedor de la base ya estuviera "iniciado". Se agregó healthcheck (pg_isready)
+ depends_on con condition: service_healthy para que el backend espere a que la
base esté realmente lista, no solo iniciada.

### Dónde viven los secretos
Los valores reales (usuario, password, nombre de base) viven en un .env local,
que está en .gitignore y nunca se commitea. Solo se versiona .env.example, con
las claves esperadas y valores de ejemplo. docker-compose.yml referencia las
variables con ${DB_USER}, etc. - el YAML se commitea, los valores no.

### Qué persiste
Solo el volumen db_data de Postgres. Backend y frontend son stateless: cualquier
dato que necesiten sobrevivir a un reinicio vive en la base, no en el filesystem
del contenedor.

### Registry público
Imágenes publicadas en GitHub Container Registry, visibilidad pública:
- ghcr.io/belmicr/bioconect-backend:v0.1.0
- ghcr.io/belmicr/bioconect-frontend:v0.1.0

Se armó `docker-compose.registry.yml` como alternativa a `docker-compose.yml`,
reemplazando `build:` por `image:` apuntando al registry - permite levantar el
sistema completo sin necesidad de tener el código fuente ni compilar nada, solo
con las imágenes publicadas.

### Problemas encontrados
- Docker Desktop no estaba corriendo al momento de hacer el primer build
  (`error during connect... docker daemon is not running`) - se resolvió abriendo
  Docker Desktop y esperando a que el engine iniciara.
- Confusión inicial con `python3` vs `python` y `source` vs `Activate.ps1` al
  crear el entorno virtual en Windows/PowerShell (comandos distintos a Linux/Mac).
- nginx no arranca en contenedor aislado: al correr `bioconect-frontend` con
  `docker run` (sin compose), nginx falla al iniciar con "host not found in
  upstream 'backend'". Esto es esperado - el `proxy_pass` de nginx.conf depende
  de que exista un contenedor llamado `backend` en la misma red de Docker, algo
  que solo compose provee.
- Tag v0.1.0 apuntando a versión desactualizada: al construir la imagen del
  backend por primera vez, se etiquetó como v0.1.0 antes de agregar
  psycopg2-binary al requirements.txt. Luego, docker compose build generó una
  imagen nueva (con el driver ya incluido) pero bajo el tag `latest`, dejando
  v0.1.0 desactualizado. Se corrigió re-etiquetando v0.1.0 para que apunte al
  mismo hash que latest antes de publicar en ghcr.io - lección: verificar
  siempre qué imagen representa exactamente el tag que se publica.
- Prueba de persistencia: `down` normal conserva los datos (volumen intacto);
  `down -v` los borra (volumen eliminado, Postgres reinicializa desde cero).

### Uso de IA
Usé Claude para armar los Dockerfiles multi-stage, diagnosticar errores de
entorno en Windows/PowerShell (rutas de carpetas, política de ejecución de
scripts, daemon de Docker no iniciado), diagnosticar el healthcheck de Postgres
y el problema de nginx en contenedor aislado, e interpretar la comparación de
tamaños de imagen.

## TP3 — Planificación (GitHub Projects)

### Duración del sprint
No se pudo configurar el campo Iteration por un problema de la interfaz de
GitHub Projects (el campo de texto para nombrar un nuevo field no aceptaba
input, probado con selección de texto, recarga de página y reintento posterior
sin éxito). Se documenta como limitación de la herramienta encontrada durante
el TP, pendiente de resolución. De haberse podido configurar, la duración
elegida hubiera sido 1 semana por iteración, dado que trabajando sola conviene
tener ciclos cortos de feedback en vez de sprints largos.

### Límite de trabajo en progreso
Se configuró en 2 para la columna "En curso", siguiendo la fórmula de la
cátedra (personas + 1). Al trabajar sola en el proyecto, esto da un poco de
margen para tener una tarea principal en curso más una secundaria si la
primera queda bloqueada, sin permitir dispersión.

### Diagnóstico de la historia mal escrita
"Como desarrollador quiero optimizar la base de datos": no tiene beneficiario
real (ningún usuario final "quiere" una optimización sin un beneficio de
negocio asociado), no es testeable (¿optimizar qué métrica, hasta qué punto?),
y viola los criterios V (Valiosa) y T (Testeable) de INVEST. Es en realidad
una tarea técnica disfrazada de historia de usuario.

### Reescritura correcta
"Como paciente quiero que el listado de mis estudios cargue en menos de 2
segundos para no tener que esperar cuando necesito ver un resultado con
urgencia."

Criterios de aceptación:
- [ ] El endpoint GET /estudios/paciente/{id} responde en menos de 2 segundos
      con hasta 50 estudios cargados
- [ ] El tiempo de respuesta se mide en el pipeline de CI

Ahora tiene beneficiario (el paciente), es testeable (2 segundos, medible), y
el "cómo" (qué índice agregar, qué query optimizar) queda del lado del equipo,
no de la historia.

### Problemas encontrados
- Jerarquía de sub-issues inicial mal armada: las dos tareas quedaron colgando
  directamente de la épica en vez de la historia. Se corrigió removiéndolas
  como sub-issues de la épica y re-vinculándolas correctamente desde la
  historia.
- Campo Iteration con problema de input persistente: el campo de texto para
  nombrar un nuevo field no aceptaba escritura, incluso después de recargar
  la página y reintentar. No se logró resolver dentro del tiempo disponible
  para este TP.

### Uso de IA
Usé Claude para navegar la interfaz de GitHub Projects (sub-issues,
automatizaciones, límites de WIP), diagnosticar el problema del campo
Iteration, y armar la historia de usuario con criterios de aceptación
verificables.

## TP4 — CI (GitHub Actions)

### Por qué esos jobs y por qué en paralelo
Se armaron dos jobs independientes, build-backend y build-frontend, en vez de
uno solo secuencial. Backend y frontend no tienen ninguna dependencia de build
entre sí (cada uno tiene su propio Dockerfile y contexto), así que corren en
paralelo en runners separados: el tiempo total del pipeline es el del job más
lento, no la suma de ambos.

### Qué se cachea y qué pasa si el cache desaparece
Se cachean las capas de Docker de cada Dockerfile (cache-from/cache-to con
type=gha, scope separado por job). Si el cache no existe (primera corrida, o
si GitHub lo purga), el pipeline simplemente tarda más - reconstruye todas las
capas desde cero - pero no falla ni se rompe. El cache es una optimización de
velocidad, no una dependencia funcional.

### Por qué construye con el Dockerfile propio
El pipeline usa exactamente los mismos Dockerfiles del TP2 (context: ./backend
y ./frontend), no un script de build aparte. Esto garantiza que lo que se
verifica en CI es lo mismo que se publicaría a producción - si el Dockerfile
cambia y se rompe, el pipeline lo detecta.

### El gate
Se configuró un Ruleset (no branch protection clásica) sobre main, requiriendo
que build-backend y build-frontend pasen antes de poder mergear, con "ramas
actualizadas" activado. Se probó rompiendo a propósito la imagen base del
Dockerfile del backend (tag inexistente): el check falló, el botón de merge
quedó bloqueado con "Required status check failing". Se revirtió el cambio, el
check volvió a verde, y recién ahí se pudo mergear - demostrando que el gate
bloquea de verdad, no es solo informativo.

### Problemas encontrados
- GitHub tiene dos sistemas de protección de rama distintos (Rulesets nuevos
  vs. Branch protection rules clásicas). El TP1 se armó con Rulesets, así que
  hubo que buscar la opción de status checks obligatorios ahí, no en la
  sección "Branches" clásica (que aparecía vacía).
- Al agregar los checks requeridos, GitHub los duplicó (una entrada "Cualquier
  fuente" y otra "Acciones de GitHub" por cada job). Se resolvió eliminando
  los duplicados y dejando solo la entrada de "Acciones de GitHub" para cada
  uno.

### Uso de IA
Usé Claude para armar el workflow de GitHub Actions, diagnosticar la
diferencia entre Rulesets y branch protection clásica, y diseñar la prueba de
romper/arreglar el build para demostrar el gate.

## Modelo de datos completo (post-TP4, adicional al alcance de la materia)

### Diseño
Se implementó el modelo completo de BioConect con 5 entidades: Usuario (con
rol bioquimico/paciente en una sola tabla, simplificando el login), Estudio,
Turno, ChatMensaje y PedidoMedico. Se optó por una sola tabla Usuario con
campo `rol` en vez de tablas separadas por rol, priorizando simplicidad de
código sobre pureza del modelo relacional, dado el alcance acotado a 2 roles
definido para la materia.

### Seguridad de contraseñas
Se usa bcrypt (vía passlib) para el hash de contraseñas, nunca texto plano.
Se generan tokens JWT en el login, incluyendo el rol del usuario para que el
frontend pueda dirigir a la pantalla correcta.

### Resolución del bug documentado en TP3
El bug #13 ("El turno no valida solapamiento de horarios para el mismo
bioquímico") se resolvió agregando una validación en POST /turnos que
rechaza la creación de un turno si el bioquímico ya tiene otro turno no
cancelado en el mismo horario.

### Problema de trazabilidad: Closes #N sin completar
Al armar el PR que resolvía el bug #13, se dejó por error el placeholder
`Closes #N` sin reemplazar por el número real del issue, y el PR se mergeó
así. Como GitHub no reconoce "#N" como referencia válida, el cierre
automático no se disparó. Se corrigió en dos pasos: (1) editando la
descripción del PR ya mergeado para reemplazar #N por #13 (esto vincula el
PR al issue, pero no lo cierra retroactivamente, ya que la automatización de
cierre solo actúa en el momento del merge), y (2) cerrando el issue #13
manualmente con un comentario explicando qué PR lo resolvió. Lección:
verificar siempre que los placeholders de un PR estén completados antes de
mergear, porque el cierre automático no es recuperable después del hecho.

### Problemas encontrados
- Passlib con bcrypt: passlib esperaba un atributo interno (`__about__`) que
  versiones recientes de bcrypt ya no exponen, causando AttributeError y
  luego ValueError: password cannot be longer than 72 bytes. Se resolvió
  fijando bcrypt==4.0.1 en requirements.txt.
- Falta de python-multipart al reinstalar el entorno virtual desde cero (tras
  un incidente de sincronización de OneDrive): FastAPI necesita este paquete
  para procesar UploadFile/File, pero no quedó registrado en requirements.txt
  en su momento. Se agregó explícitamente.

### Uso de IA
Usé Claude para diseñar el modelo de datos, diagnosticar los errores de
passlib/bcrypt y python-multipart, y para entender y corregir el problema
del placeholder Closes #N sin completar.