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

## TP5 — Calidad automatizada: tests, coverage y umbral que frena un merge

### Enlaces que prueban cada decisión
- Corrida en verde, con el resumen de coverage y el reporte descargable: https://github.com/belmicr/bioconect/actions/runs/39681719075
- PR que agrega los tests, las etapas de tests y el umbral: https://github.com/belmicr/bioconect/pull/34
- PR 1, mergeado (rojo por cobertura, tests que faltaban, verde, merge): https://github.com/belmicr/bioconect/pull/35
- Corrida en rojo por umbral del PR 1: https://github.com/belmicr/bioconect/actions/runs/39683949371
- PR 2, abierto y en rojo hasta la defensa: https://github.com/belmicr/bioconect/pull/36
- Corrida en rojo por umbral del PR 2, con el número en el log: https://github.com/belmicr/bioconect/actions/runs/39687279489
- Release v5.0.0: https://github.com/belmicr/bioconect/releases/tag/v5.0.0

### Qué testeé y por qué esa lógica
Elegí testear donde un bug duele en BioConect, que maneja resultados médicos:
- **Guardias de acceso (`deps.py`)**: si una puerta deja pasar a quien no debe, un paciente ve estudios de otro. Es el bug más caro de la app.
- **Reglas de turnos (`logic.py`)**: validación de horario (lunes a viernes, de 8:00 a 17:30, cada 30 minutos), grilla de horarios del día y reserva sin solapamiento. Un bug acá pisa la agenda del bioquímico.
- **Validación de PDF y de contraseña (`logic.py`)**: decide qué entra al sistema. Incluye el límite de 72 bytes de bcrypt.
- **Seguridad (`security.py`)**: el hash no es texto plano, el token conserva usuario y rol, y un token adulterado se rechaza.
- **Front (`src/lib` y `src/api/servicios.js`)**: validación de formularios, formato de fechas, filtros y orden. En fechas hay una razón concreta: el backend manda `fecha_carga` en UTC sin zona, y sin interpretarla como UTC la pantalla mostraría 3 horas corridas.

**Cantidad.** Backend: 23 funciones de test que corren como 30 casos (los parametrizados cuentan uno por dato), repartidas sobre 8 reglas distintas. Frontend: 49 tests en 4 archivos en el PR del umbral, y 68 después del PR 1 (se suman los 19 de `antiguedad.test.js`).

Las tres técnicas están en los dos lados:

| Técnica | Backend (pytest) | Frontend (vitest) |
|---|---|---|
| Parametrizado | `test_solo_se_aceptan_pdf_reales` y `test_franja_horaria_incluye_los_bordes` (`@pytest.mark.parametrize`) | `it.each` en `validaciones.test.js`, `fechas.test.js` y `antiguedad.test.js` |
| Caso de error | `test_password_corta_es_rechazada_y_dice_el_minimo` (también prueba que el mensaje diga el límite) | `rechaza un mensaje que supera el largo máximo y dice el límite` |
| Con mock | `test_reservar_turno_solapado_no_guarda_nada` | `cargarEstudios` con `vi.fn()` en `servicios.test.js` |

### Refactor que hizo posible el mock
Antes, `crear_turno` en `main.py` mezclaba la regla de negocio con el acceso a la base: consultaba la agenda y guardaba el turno con la `session` adentro. Para probar la regla había que tener una base real, así que el test era de integración y no unitario.

Saqué la regla a `reservar_turno(repo, ...)` en `logic.py`, que **recibe la dependencia desde afuera**, y dejé el acceso a datos en la clase `RepoTurnos` de `main.py`. El endpoint pasó a calcular quién es el paciente y el bioquímico y a delegar. La validación de horario y de agenda libre **sigue adentro** de `reservar_turno`, o sea que el refactor no le sacó ninguna regla.

Los tests le pasan un `Mock()` como `repo`. Es un test de **mock** y no de stub porque no solo le dice qué devolver (`ocupados.return_value`), también verifica la interacción: `guardar` se llama una sola vez, no se llama si el turno se solapa, y `ocupados` ni se consulta si el horario ya era inválido.

### Mi umbral
**Backend: 90 %**, sobre el porcentaje combinado de líneas y ramas (activé `branch = True` en `.coveragerc`).
- **Mi medición real:** la primera corrida dio 96 % en total (líneas 97,6 %, ramas 92,9 %), con `deps.py` en 89 %. Después de cerrar ese hueco quedó en **100 % de líneas y 100 % de ramas** (85 sentencias y 28 ramas, todas cubiertas).
- **Por qué 90 y no 100:** un 100 % fijo haría que una línea defensiva imposible de alcanzar rompa el build sin que haya un riesgo real. Con 90 hay margen para ruido, pero una función nueva sin tests baja el total y frena el merge. Es un número anclado en mi medición, no una regla copiada.

**Frontend: 80 % en líneas y 80 % en ramas** (`coverage.thresholds` en `vite.config.js`).
- **Mi medición real:** la primera corrida dio 100 % de líneas y 97,56 % de ramas. Tras agregar un test quedó en **100 % de líneas y 100 % de ramas**.
- **Por qué 80:** deja margen de 20 puntos, así un cambio chico no rompe el build por una línea, pero una función nueva con lógica y sin tests lo hace caer. Lo comprobé en los dos PR de demostración.

**Número de rama que da hoy:** 100 % en los dos lados.

**Qué haría falta para subirlo:** en el backend, testear los endpoints de `main.py` con el cliente de pruebas de FastAPI y una base de prueba. En el front, testear los componentes de pantalla. Hoy los dos están fuera de la cuenta.

### Qué dejé afuera de la cuenta y por qué
- **`main.py`**: es el cableado de HTTP (rutas, formularios, archivos). Se prueba de punta a punta contra QA en el TP7.
- **`models.py`**: clases de datos, solo propiedades y ninguna regla.
- **`database.py`**: la conexión. Si está mal, la app no arranca y me entero enseguida.
- **`__init__.py`**: vacío.
- **Frontend:** `src/api/cliente.js` (habla con la red), `AuthContext.jsx`, `componentes/`, `paginas/`, `App.jsx` y `main.jsx`. Es interfaz y pegamento, y se verifica en el e2e del TP7. Entra a la cuenta solo lo que tiene lógica: `src/lib/**` y `src/api/servicios.js`.

Con `include` (y no con `exclude`) en el front, un archivo nuevo de `src/lib` entra a la cuenta aunque nadie lo pruebe. Lo comprobé en los dos PR: `antiguedad.js` y `agenda.js` aparecieron con 0 %.

**Una limitación honesta:** excluir `main.py` vale cuando ahí no queda lógica, y en mi caso quedaron dos helpers de autorización (`paciente_de` y `par_chat`) que son reglas de negocio y hoy no mide ningún test. Mi 100 % es de la lógica pura, la seguridad y los guardias, no de esa autorización. Mi próximo paso es moverlos a `logic.py` y testearlos.

### Por qué un coverage alto no garantiza calidad (con mi ejemplo)
Coverage mide qué líneas se ejecutaron, no qué se comprobó. En mi código: si agrego un test que llama `solo_bioquimico(SimpleNamespace(rol="bioquimico"))` **sin ningún assert**, el `return` queda cubierto y el porcentaje sube, pero el test no verifica que la puerta deje pasar al usuario correcto. Si alguien cambia esa función para que devuelva siempre 403, el test sigue en verde.

Lo viví al revés con mi propio número: `deps.py` estaba en 89 % porque mis tests solo probaban que la puerta rechaza a quien no debe. Un guardia roto que rechazara a todos pasaba todos mis tests. Coverage bajo sí es una señal confiable de agujero, y coverage alto no lo es de calidad.

### El ejercicio del camino sin cubrir
Hice el ejercicio en los dos lados.

**Backend (`deps.py`, líneas 32 y 38):**
1. **Qué línea es:** el `return u` de `solo_bioquimico` y de `solo_paciente`, o sea el camino en que el usuario **sí** tiene el rol correcto y la puerta lo deja pasar. El reporte las marcó como faltantes y las dos ramas quedaron "parciales".
2. **Qué entrada la recorrería:** `SimpleNamespace(rol="bioquimico")` para la 32 y `SimpleNamespace(rol="paciente")` para la 38.
3. **Qué decidí:** agregué los dos tests. Un guardia que siempre dijera 403 habría pasado todos mis tests anteriores. Con eso, `deps.py` pasó de 89 % a 100 %.

**Frontend (`datos.js`, línea 6):**
1. **Qué línea es:** `const busqueda = (texto ?? '').trim().toLowerCase()` en `filtrarPorTexto`. La línea figuraba cubierta pero la rama del `??` no: mis tests nunca pasaban `texto` nulo.
2. **Qué entrada la recorrería:** `filtrarPorTexto(estudios, null)`.
3. **Qué decidí:** agregué `sin texto (nulo) devuelve todos`. Si el buscador llegara a mandar un valor nulo, sin ese camino probado el filtro rompería en pantalla sin que ningún test lo detectara. Las ramas del front pasaron de 97,56 % a 100 %.

### Cómo rompe el build mi umbral
- **Backend:** `backend/Dockerfile` tiene una etapa `test` cuyo `ENTRYPOINT` es `pytest --cov ... --cov-fail-under=90`. Si la cobertura baja de 90, pytest sale con error, el `docker run` del CI devuelve ese error, el job `build-backend` queda rojo y, como es un required check de `main`, el merge se bloquea.
- **Frontend:** `thresholds` en `vite.config.js`. Si la cobertura no llega, vitest sale con error y se repite la misma cadena con `build-frontend`.
- No agregué ningún job ni ninguna regla de rama: el gate del TP4 ya vigilaba esos dos checks, y ahora pueden ponerse rojos por calidad y no solo por compilación.
- La etapa de tests va **en el medio** de los Dockerfiles, y la imagen de producción no lleva pytest ni los tests adentro.
- Los pasos que publican el reporte llevan `if: ${{ !cancelled() }}`, así que cuando los tests fallan el reporte igual se publica, que es cuando más hace falta.

### Mis dos Pull Requests
**PR 1: #35 (mergeado).** Agregué `frontend/src/lib/antiguedad.js`, con 4 funciones y ningún test. Compilaba bien y los 49 tests existentes pasaban, pero `build-frontend` se puso rojo por cobertura. Medido en mi máquina: **líneas 57,77 % y ramas 53,94 %, contra el umbral de 80** (funciones 82,14 %, por encima). Frenó en **líneas y ramas a la vez**, con **vitest 5.0.5**: en esa versión las ramas de una función que nadie ejecuta cuentan desde el principio (en la 3 solo bajaban las líneas). La corrida roja es la del enlace de arriba. Para arreglarlo escribí `antiguedad.test.js` con 19 tests, uno por cada camino del código nuevo (los siete valores posibles de `clasificarAntiguedad` más el caso de fecha con zona, el conteo, las siete etiquetas y el filtro de estudios a revisar). Después el check pasó a verde y mergeé. La conversación del PR muestra la secuencia completa: rojo, tests que faltaban, verde, merge.

**PR 2: #36 (abierto y en rojo a propósito).** Agregué `frontend/src/lib/agenda.js`, también sin tests. El log de la corrida (ver enlace) dice:
ERROR: Coverage for lines (69.23%) does not meet global threshold (80%)
ERROR: Coverage for branches (73.78%) does not meet global threshold (80%)
Error: Process completed with exit code 1.
Los 68 tests pasan y `agenda.js` figura con 0 %. Lo dejé sin arreglar para que se pueda comprobar el freno vigente sin depender de mis capturas. El botón de merge queda deshabilitado y `build-frontend` figura como Required.

**Por qué compilaba, pasaba los tests y no se podía mergear:** porque los tests en verde solo dicen que lo que existe funciona, no que todo el código nuevo esté probado. Mi umbral mide cuánto de la lógica ejercitan los tests, y ese número cayó por debajo de lo que yo mismo había declarado.

### Qué pasaría si subo el umbral diez puntos
En el backend pasaría a 100 %. Hoy lo cumplo, pero sería frágil: cualquier línea nueva sin un test, aunque sea trivial o defensiva, rompería el build. Eso lleva a que la gente termine apagando el gate. Prefiero un 90 que puedo sostener a un 100 que vivo esquivando.

### Herramientas que usé (mi stack no es el de la cátedra)

| Lo que había que lograr | Backend (Python 3.12) | Frontend (JS) |
|---|---|---|
| Test parametrizado | `@pytest.mark.parametrize` | `it.each` |
| Doble (mock) | `unittest.mock.Mock` | `vi.fn()` |
| Medir cobertura | `pytest-cov` 7.1.0 (coverage.py 7.16.2) | `@vitest/coverage-v8` 5.0.5 |
| Umbral que frena | `--cov-fail-under=90` | `coverage.thresholds` |
| Qué entra en la cuenta | `omit` en `.coveragerc` | `coverage.include` |
| Herramientas de test en la etapa de tests | `requirements-dev.txt`, instalado solo en esa etapa | `npm ci` sin `--omit=dev` |
| Reporte visible y descargable | resumen en el Summary de la corrida y artefacto `coverage-backend` | ídem, artefacto `coverage-frontend` |

### Problemas encontrados
- **El build del front pasaba en mi máquina y falló en el CI.** Mi `.gitignore` es la plantilla de Python, que ignora cualquier carpeta `lib/`, y `frontend/src/lib/` nunca se subió al repo. El CI construye solo con lo que hay en GitHub, así que falló con `Could not resolve '../lib/validaciones.js'` y el gate frenó el merge. Lo resolví con `!frontend/src/lib/` en el `.gitignore`. Lo encontré porque el pipeline construye desde el repo y no desde mi máquina.
- **Dos archivos de test del front quedaron como `.tests.js`.** Vitest solo detecta `.test.js`, así que al comprobar vi que solo 2 de los 4 se iban a ejecutar. Los renombré.
- **Vitest 5 exige el paquete de cobertura de la misma versión mayor.** Instalé `@vitest/coverage-v8@5` para que coincida con `vitest@5.0.5` y verifiqué con `npm ls` que quedaran en la misma versión.
- **Un test mío falló por una fecha mal calculada, no por el código.** En `cuenta los estudios por clase` esperaba dos estudios "nuevos", pero uno tenía 30 horas de antigüedad y el código lo clasificaba bien como "esta semana". Corregí la fecha del test. Lección: cuando un test falla, hay que leer el assert antes de tocar el código.
- **OneDrive dejó roto mi entorno virtual.** `pip` fallaba con `OSError: [Errno 22]` porque los archivos dentro de `venv` eran marcadores de la nube y no archivos reales. Lo resolví creando un entorno nuevo fuera de OneDrive, en `C:\venvs\bioconect`.
- **VS Code creó solo un `.venv` con Python 3.14 y lo activaba en cada terminal**, pisando el mío (3.12). Lo desactivé con `python.terminal.activateEnvironment` en `false`.
- **OneDrive bloqueó `git checkout`** al cambiar de rama y dejó archivos borrados a medias. Con `git restore .` los recuperé y creé las ramas nuevas directo desde `origin/main`.
- **Docker Desktop estaba pausado** y `docker build` fallaba con `docker daemon is not running`.

### Uso de IA
Usé Claude para diseñar la estructura de tests, proponer el refactor de `reservar_turno`, armar la configuración de `pytest-cov` y `vitest`, la etapa de tests de los dos Dockerfiles y los pasos del `ci.yml`, y para diagnosticar los errores de la lista anterior. Lo verifiqué corriendo los tests en mi máquina y dentro del contenedor Linux (30 casos y 100 % en el backend, 49 tests y 100 % en el front en ese momento), leyendo los reportes de cobertura para elegir el ejercicio del camino sin cubrir, y comprobando que el CI se pusiera rojo cuando debía, dos veces. Puedo explicar qué verifica cada assert y qué caso no está cubierto.


## TP6 — CD: environments, aprobaciones y deployment patterns

### Enlaces
- Corrida con la cadena completa y aprobación a PROD (build, tests, publicación, deploy a QA, Waiting for review, aprobación, deploy a PROD con smoke en verde): https://github.com/belmicr/bioconect/actions/runs/39724139805
- Corrida rechazada (la compuerta diciendo "no", con motivo escrito): <https://github.com/belmicr/bioconect/actions/runs/39729095239>
- PR del job de deploy a QA: https://github.com/belmicr/bioconect/pull/40
- PR del job de deploy a PROD con aprobación y `pool_pre_ping`: https://github.com/belmicr/bioconect/pull/43
- PR que publica las imágenes por commit y arma la plantilla de nginx: https://github.com/belmicr/bioconect/pull/39
- Paquetes públicos, con etiquetas `sha-<commit>`: https://github.com/belmicr?tab=packages
- QA: front https://bioconect-front-qa.onrender.com · API https://bioconect.onrender.com/health
- PROD: front https://bioconect-front-prod.onrender.com · API https://bioconect-api-prod.onrender.com/health



### Por qué la imagen se publica solo si todo está en verde
En cada job de build, el paso que construye y publica la imagen final es el **último**. Los pasos de un job corren en orden y se cortan al primer error, así que si los tests fallan, el job muere antes y la publicación nunca corre. La condición no es un `if`: es el orden de los pasos. Además solo publica en un `push` a `main` (`github.event_name == 'push' && github.ref == 'refs/heads/main'`): los PR verifican pero no publican. Cada imagen se etiqueta con el commit completo (`sha-<40 caracteres>`) y sin `latest`, para saber exactamente qué versión es cuál.

### Delivery vs Deployment
Armé Continuous Delivery: cada cambio verificado llega solo a QA, y a PROD solo con una aprobación humana. Continuous Deployment sería llegar a PROD sin ninguna persona de por medio. Elegí Delivery porque BioConect maneja resultados médicos y quiero una decisión humana antes de producción.

### La cadena y los secrets
- `deploy-qa`: `needs: [build-backend, build-frontend]` (sin verificación en verde no hay deploy), `if: github.ref == 'refs/heads/main'` (solo `main` despliega) y `environment: qa`.
- `deploy-prod`: `needs: deploy-qa` (sin QA en verde ni siquiera se pide aprobación) y `environment: production`. No repite el `if` de la rama porque depende de `deploy-qa`, que lo tiene.
- Cada environment tiene sus hooks como **environment secrets** (`RENDER_HOOK_API_QA`, `RENDER_HOOK_FRONT_QA`, `RENDER_HOOK_API_PROD`, `RENDER_HOOK_FRONT_PROD`). Un secret de `production` solo lo puede leer un job que declare ese environment, y ese job no arranca hasta que alguien aprueba: quien no puede aprobar tampoco puede leer las llaves de PROD.
- El deploy se dispara llamando al hook con `&ref=$GITHUB_SHA`. Sin el `ref`, Render despliega la punta de la rama, y con dos merges seguidos una corrida podría desplegar un commit que no pasó por nada. Con `ref` se promueve lo mismo que se verificó, y PROD recibe el mismo commit que pasó por QA (lo comprobé en *Deploys* de Render: `6026663` en QA y en PROD).

### El gate humano
`production` tiene **Required reviewers** con mi usuario. Desactivé "Allow administrators to bypass configured protection rules": como soy administradora, con esa opción podría saltear la aprobación y la compuerta sería decorativa. GitHub sí permite aprobar los propios deployments (a diferencia de los PR), por eso el flujo funciona trabajando sola.

**Qué miro antes de aprobar:** que `deploy-qa` esté en verde; que en *Deploys* de Render el servicio de QA muestre como Live **el mismo commit** de la corrida (el smoke puede dar verde contra la versión anterior mientras Render construye); y que el front de QA funcione a mano: login y los datos en `app_qa`.

**El rechazo:** rechacé el deploy a PROD del commit `3910b45` con este motivo: "Rechazo: el commit 3910b45 solo cambia docs/decisiones.md y no modifica la app. Desplegarlo reiniciaría PROD sin ningún beneficio y, como el free tier de Render no tiene disco persistente, se perderían los PDF ya subidos. PROD sigue en 6026663." `deploy-prod` quedó rechazado y PROD siguió con la versión anterior. Un rechazo anterior lo había hecho con una frase de ejemplo copiada sin completar; lo reemplacé por este, con un motivo real.

### Qué prueba el smoke test, y qué no
Reintenta hasta 30 veces cada 20 segundos (build de Render más cold start) y verifica `/health` (proceso vivo), `/health/db` (la base responde), el front servido y `/api/health` a través del front (nginx llega a la API). Cada `curl` lleva `--max-time`. **Sus límites:** `/health` devuelve `commit: dev`, así que no prueba qué versión corre (en la corrida aprobada `deploy-qa` tardó 5 segundos, menos de lo que tarda Render en construir: respondió la versión anterior); y `/health/db` ejecuta `select 1`, que funciona contra cualquier base. Las dos cosas las verifico a mano, y la primera la resuelve el TP7.

### Qué se pierde porque Render reconstruye
Render vuelve a construir el commit desde el repositorio, así que lo que corre es otra construcción del mismo commit y no la imagen que mis tests verificaron. Una dependencia o una imagen base que cambien entre los dos builds podrían dar un resultado distinto. Eso lo resuelve el TP7, con el entorno ejecutando la imagen publicada.

### Patrón de deploy que usaría en serio, y mi rollback
Hoy es un reemplazo directo: Render reemplaza el contenedor y, si falla, sigue sirviendo la versión anterior. Para una app de resultados médicos en serio usaría **blue-green**: la versión nueva arriba al lado de la vieja, se prueba contra la base real y el tráfico se cambia de golpe, con la vieja lista para volver en segundos. Canary sirve cuando hay muchos usuarios para repartir el riesgo; con un laboratorio chico, blue-green es más simple y suficiente.

**Rollback medido:** en `bioconect-api-prod`, *Deploys* → **Rollback** al deploy anterior (`643628e`). Render informó 20,6 s de deploy y mi cronómetro dio **31 segundos** desde el click hasta que `/health/db` respondió `{"db":"ok"}`. Es rápido porque Render no reconstruye: reusa la imagen ya armada. Después volví a `6026663` de la misma forma, también en unos 20 s. Limitación: el rollback vuelve el código, no la base; un cambio de esquema necesitaría su propia vuelta atrás.

### El free tier
Los servicios gratuitos se apagan tras 15 minutos sin tráfico y la primera visita tarda hasta 50 s. No tienen disco persistente: **los PDF subidos se pierden en cada reinicio o deploy**, una limitación real para esta app que queda anotada (almacenamiento externo). Usé Neon porque el Postgres gratuito de Render expira a los 30 días. Los seis servicios comparten las 750 horas mensuales del workspace.

### Dos entornos, dos bases
Neon tiene `app_qa` y `app_prod`. **Lo comprobé con datos:** registré `qa-prueba@qa.com` desde QA y `prod-prueba@prod.com` desde PROD, y en el SQL Editor de Neon cada uno aparece solo en su base. El front toma la dirección de su API de variables (`BACKEND_URL`, `DNS_RESOLVER`) mediante una plantilla de nginx: la misma imagen sirve en QA y en PROD, cada una con su API.

### Problemas encontrados
- **QA escribía en la base de PROD sin que nada fallara.** La cadena "de QA" se copió con el selector de Neon en `app_prod`. Todo daba verde, incluidos el smoke y `/health/db`. Lo descubrí mirando las tablas en Neon: el usuario de QA estaba en `app_prod` y `app_qa` estaba vacía. Corregí la cadena y repetí la prueba con un usuario en cada base.
- **El Auto-Deploy de Render estaba prendido en PROD** al crear el servicio: dos deploys aparecen con trigger *Auto-Deploy*, uno de ellos 20 minutos antes de mi aprobación. Mientras estuvo prendido, la aprobación no protegía nada. Render lo apagó al recibir el primer deploy por hook con un commit fijo, y lo verifiqué en Off en los cuatro servicios.
- **Un hook cargado como variable y no como secret:** `RENDER_HOOK_FRONT_PROD` quedó en *Environment variables*, así que el job lo leía vacío (`curl: (3) URL rejected`) y además se veía en texto claro. Lo pasé a *Environment secrets*.
- **El CI quedó en verde con un `main.py` roto** (un `IndentationError` del refactor de TP5): los tests no importan `main.py`. Lo atrapó el primer deploy real. Desde entonces corro `python -m py_compile app/main.py` antes de subir.
- **Neon cierra las conexiones inactivas:** la primera consulta después de un rato fallaba con `SSL connection has been closed unexpectedly`. Lo resolví con `pool_pre_ping=True` y `pool_recycle=300` (PR #43).
- **Un deploy colgado 15 minutos** ("Port scan timeout reached"): el backend se conecta a la base al arrancar, antes de abrir el puerto, y con una cadena inválida quedaba esperando. Agregué `connect_timeout=10` a la cadena para que falle rápido y muestre el error.
- `denied: permission_denied: write_package`: los paquetes de ghcr.io eran del TP2, creados con un token personal. Los vinculé al repo con rol Write.
- `Could not parse SQLAlchemy URL` en PROD por una cadena mal armada al copiarla.
- La consola de Neon se rompía con la traducción automática del navegador.

### Uso de IA
Usé Claude para armar los jobs de deploy, la plantilla de nginx y la publicación de imágenes, y para diagnosticar los errores de la lista. Lo verifiqué en Render (qué commit tiene cada servicio, Auto-Deploy en Off), en Neon (qué datos hay en cada base), probando el login en QA y PROD, midiendo el rollback con cronómetro y leyendo los logs de cada fallo.


## Enlaces del TP7
- **Paquetes públicos** (etiquetas `sha-<commit>`, sin `latest`): https://github.com/users/belmicr/packages/container/package/bioconect-backend · https://github.com/users/belmicr/packages/container/package/bioconect-frontend
- **Corrida con la integración en VERDE y la e2e en ROJO** frenando la promoción (`deploy-prod` no arrancó): https://github.com/belmicr/bioconect/actions/runs/43134390954 — sus dos reportes están en *Artifacts*: `playwright-report-integracion` (verde) y `playwright-report-e2e` (rojo, con captura y traza del fallo).
- **Commit que rompió la app:** https://github.com/belmicr/bioconect/commit/5e8f502 (cambia el texto del botón de login de "Ingresar" a "Entrar"; no toca `e2e/`).
- **Corrida completa en verde posterior, hasta PROD con aprobación:** https://github.com/belmicr/bioconect/actions/runs/43136246073
- **QA:** https://bioconect-front-qa.onrender.com (API https://bioconect.onrender.com/health) · **PROD:** https://bioconect-front-prod.onrender.com (API https://bioconect-api-prod.onrender.com/health)


## TP7 — Contenedores en el pipeline + integración y e2e

### Build once, deploy many
En el TP6, Render **reconstruía** cada commit desde el repositorio: lo que corría en QA y en PROD eran dos construcciones distintas del mismo código, y ninguna era la imagen que mis tests habían verificado. Mis dependencias de Python están fijadas, pero la imagen base `python:3.12-slim` o `nginx:1.27-alpine` puede cambiar entre un build y otro, y eso habría dado un PROD distinto de QA con "el mismo commit". Ahora la imagen se construye **una sola vez** en el pipeline, se testea, se publica con su etiqueta, y QA y PROD ejecutan **exactamente esa** imagen: Render ya no construye nada.

### Mis etiquetas
- **`sha-<commit>`** (en ghcr.io): es la identidad inmutable de la imagen; dice de qué commit salió y no se mueve. Es lo que el pipeline le pasa a Render en cada deploy (`imgURL`).
- **`v7.0.0`** (en git): le pone nombre a la release; apunta al commit que está en PROD.
- **Sin `latest`:** `latest` no dice qué hay adentro; un deploy que lo nombrara ejecutaría "lo último que se publicó", haya pasado las pruebas o no.
- Los cuatro servicios de Render los cambié de fuente (no los recreé, así conservé URL y deploy hook) y los configuré con la imagen `sha-8787c17ee9bcdd0bb257b19a5e1a214c8195bcad`. **Esa no es la que corre:** cada deploy del pipeline le pasa a Render la imagen `sha-<commit>` de su propia corrida.

### Del tag a la imagen, en un paso
`git rev-list -n1 v7.0.0` me da el commit, y la imagen es `ghcr.io/belmicr/bioconect-backend:sha-<ese commit>` (y lo mismo con `-frontend`).

### Cómo se comprueba desde afuera que el entorno ejecuta mi imagen
- En los *Events* de cada servicio de Render, el deploy dice "Triggered via Deploy Hook" y nombra la imagen `sha-<commit>` (lo muestro en vivo en la defensa).
- El pipeline le pasa el commit a la imagen al construirla (`GIT_SHA`): el `/health` de la API lo devuelve, y el front lo publica en `/version.txt`. El smoke espera a que **los dos** respondan el commit de la corrida.
- Cualquiera puede bajar la imagen por su etiqueta, sin credenciales: `docker pull ghcr.io/belmicr/bioconect-backend:sha-<commit>`.
- **Lo que el smoke no prueba:** que la app funcione. Solo pregunta si responde y qué versión es. Que un usuario pueda entrar lo prueba la e2e.

### Qué pruebo en cada suite, y por qué no es lo mismo
- **Integración** (Playwright `request`, sin navegador, contra la API de QA con su base Neon real): (1) `/health/db` responde; (2) se crea un usuario, se loguea y `/me` devuelve su email: escribe y lee la base de verdad; (3) **elegida por mí:** sin token, `/estudios` da 401. La elegí porque BioConect maneja resultados médicos y el bug más caro es que alguien vea estudios sin estar autenticado.
- **e2e** (Playwright con Chromium, contra el front de QA): (1) una bioquímica entra y ve su portal; (2) con la contraseña equivocada aparece el error y no entra; (3) **elegida por mí:** al cerrar sesión vuelve al login, porque en una computadora compartida de laboratorio quedarse con la sesión abierta expone datos de pacientes.
- **Qué dejé afuera (pirámide):** las reglas de negocio (horarios de turnos, PDF válido, contraseñas) ya las cubren los tests unitarios del TP5, que son rápidos y baratos; repetirlas en e2e sería lento y frágil. La integración no mira la pantalla, y la e2e no prueba cada endpoint.
- **Si se rompen:** la cadena queda en rojo, `deploy-prod` no arranca y GitHub me avisa por mail.

### El par verde/rojo de mi rotura
Cambié el texto del botón de login de "Ingresar" a "Entrar". Compilaba y pasaban los 68 tests unitarios. En la corrida, **la integración quedó verde** (la API y la base estaban bien) y **la e2e quedó roja** (un usuario no encontraba el botón): el diagnóstico es que el problema está en el front, no en el back. `deploy-prod` ni siquiera pidió aprobación.

### Integración amplia, no estrecha
Mi integración corre contra la API **ya desplegada** en QA, con su base real. Gana: prueba la configuración verdadera (variables de entorno, Neon, la red de Render), que es donde falló más de una vez en el TP6. Pierde: es más lenta, depende de que QA esté arriba y sufre el cold start, y deja datos en la base de QA (por eso cada corrida usa un email único con la hora).

### Cold start y tests flaky
El free tier tarda en despertar: cada prueba tiene hasta 120 s, cada `expect` hasta 30 s, y Playwright reintenta una vez. Además el smoke espera hasta 30 × 20 s a que QA corra el commit nuevo antes de que empiecen las pruebas. Un test **flaky** es uno que a veces pasa y a veces falla sin que cambie el código; el reintento lo tapa, así que si una prueba pasa solo al reintentar, lo trato como un problema a mirar y no como un verde.

### La misma imagen del front en QA y en PROD
Adentro de la imagen quedan los archivos estáticos ya construidos y el commit (`/version.txt`). Afuera, por variable de entorno de cada servicio, quedan la dirección de la API (`BACKEND_URL`) y el DNS (`DNS_RESOLVER`), que nginx lee al arrancar desde la plantilla `default.conf.template` del TP6. Por eso la imagen `sha-<commit>` del front es la misma en los dos entornos y cada una habla con su API.

### Problemas encontrados
- **En el TP6 el smoke daba verde contra la versión vieja**, porque Render seguía sirviéndola mientras construía. Lo resolví haciendo que la imagen lleve el commit y que el smoke espere a ver ese commit en la API y en el front.
- **Vitest tomaba los archivos de Playwright** (`e2e/*.spec.js`) como propios. Los excluí en `vite.config.js`.
- **Cambiar la fuente de los servicios en Render:** se hace en *Settings → Build → Source → Edit → Existing Image*, sin recrear el servicio, para conservar URL y deploy hook.

### Uso de IA
Usé Claude para el cambio del pipeline (imágenes con `imgURL`, smoke con el commit, jobs de integración y e2e) y para escribir las pruebas. Lo verifiqué corriendo las 6 pruebas contra QA desde mi máquina, viendo la e2e en rojo frenar la promoción con la integración en verde, y comprobando en Render que cada servicio ejecuta la imagen de su corrida.


## TP8 — Infraestructura como código

- **Riel y versiones:** elegí el **plan C** de la guía: Terraform con el provider de Docker, todo en mi máquina. Terraform **v1.17.1** y provider **`kreuzwerker/docker` 4.7.0** (restricción `~> 4.0` en `main.tf`, versión exacta y hashes fijados en `.terraform.lock.hcl`, que sí está en el repo). `infra/` declara un entorno nuevo, **preprod**: su red, su volumen, su Postgres, y la API y el front corriendo la imagen del TP7 (`sha-d9f73a93386333c398a33ff475dacc13d4ef77de`, la misma de QA y PROD). QA y PROD en Render no se tocaron. La cadena de conexión de la API y la dirección del backend del front se **derivan** de los nombres de los contenedores, no se copian. Las contraseñas llegan por `local.tfvars` (ignorado por git) y están marcadas `sensitive`. El estado vive fuera del repo, en `$HOME\tfstate\bioconect.tfstate`. Lo comprobé como entorno: `/health` devuelve el commit del TP7, `/health/db` toca la base de preprod y el front responde `/api/health` contra su propia API. Un segundo `plan` dice "No changes", y el ciclo `destroy` → `apply` borra preprod entero y lo vuelve a crear idéntico.
- **Problemas:** (1) en PowerShell, `-var-file=local.tfvars` se parte en el punto y Terraform no encuentra el archivo; hay que pasarlo entre comillas, `"-var-file=local.tfvars"`. (2) El primer `destroy` falló al borrar la imagen `postgres:16-alpine` porque la usa otro contenedor de mi máquina (la base del compose del TP2); Docker se negó, que es lo correcto: preprod no tiene que tocar otros entornos. Agregué `keep_locally = true` a las imágenes y saqué del estado la que había quedado a medias (`terraform state rm`); desde entonces el `destroy` termina limpio. (3) Después de instalar Terraform con winget, la terminal de VS Code no lo encontraba porque había heredado el PATH viejo; lo recargué. (4) En Windows el provider necesita `host = "npipe:////./pipe/docker_engine"` para hablar con Docker Desktop.
- **Uso de IA:** usé Claude para escribir `infra/` y diagnosticar los problemas de arriba. Lo verifiqué leyendo el plan antes de cada apply (qué se crea, en qué orden, qué queda `known after apply`), con los `curl` contra preprod, el "No changes" del segundo plan y el ciclo `destroy` → `apply` completo.

## TP9 — DevSecOps + observabilidad
Más usada: GET /estudios (la de más pedidos entre las operaciones reales).
Más lenta: POST /login, p95 1,86 s.
Además: GET /estudios/{id}/pdf con failure rate 1 (el PDF se perdió al reiniciar el servicio).
### Dependabot
Mergeé el PR de Dependabot #47 (https://github.com/belmicr/bioconect/pull/47), que actualiza `actions/upload-artifact` de la versión 6 a la 7: es la action que publica los reportes de coverage en cada corrida del CI. Me animé a mergearlo porque el pipeline completo corrió en verde sobre ese PR (tests y umbral de cobertura del TP5, build de las dos imágenes y CodeQL), y porque el cambio no toca el código de la app, solo cómo el CI sube los reportes. Como es un cambio de versión mayor, antes leí las notas de la versión que Dependabot copia en el PR. `dependabot.yml` vigila pip (backend), npm (frontend) y github-actions; en *Security* están activas las alertas de Dependabot, las actualizaciones de seguridad, CodeQL (configuración por defecto) y la push protection.

### El monitor y Sentry
- **Monitor:** UptimeRobot sobre `https://bioconect-api-prod.onrender.com/health`, cada 5 minutos, con alerta por email. Suspendí PROD a las 21:09 y el aviso **DOWN llegó a las 21:13: 4 minutos**. Lo reanudé a las 21:17 y el aviso UP llegó a las 21:18. Sin el monitor me habría enterado recién cuando un usuario no pudiera entrar. Al terminar pausé el monitor: despierto todo el mes consume casi todas las 750 horas gratuitas de Render.
- **Más usada:** `GET /estudios` (la de más pedidos entre las operaciones reales).
- **Más lenta:** `POST /login`, **p95 1,86 s**, contra menos de 100 ms del resto. Hipótesis: bcrypt es lento a propósito y además la primera consulta despierta la base serverless de Neon. Con ese dato abrí la tarjeta "Login lento en PROD: p95 1,86 s (dato de Sentry)" en el tablero (https://github.com/users/belmicr/projects/1).
- **Error:** `RuntimeError: Falla de prueba del TP9` (BIOCONECT-API-1), desde un endpoint `/falla` que agregué temporalmente y saqué al terminar. Sentry también mostró `GET /estudios/{id}/pdf` con failure rate 1: los PDF se pierden cuando Render reinicia el servicio, porque el disco del plan gratuito no es persistente.

### Problemas y uso de IA
- **El proyecto de Sentry del back desapareció:** al tocar "Volver a la selección de plataforma" en el asistente, Sentry descartó el proyecto recién creado, y el `SENTRY_DSN` de Render apuntaba a un proyecto inexistente: el error no llegaba. Lo recreé, actualicé la variable y redesplegué.
- **El monitor pregunta con HEAD:** el plan gratuito de UptimeRobot usa pedidos HEAD y FastAPI solo contesta GET por defecto (daría 405 y el monitor marcaría DOWN con PROD viva). Cambié la ruta a `@app.api_route("/health", methods=["GET", "HEAD"])` y lo comprobé con `curl -I` (200 OK) antes de crear el monitor.
- **DSN público y privado:** el DSN del back va como variable de entorno solo en PROD; el del front va escrito en el código, porque solo sirve para enviar datos a Sentry, no para leerlos, y viaja igual en el JavaScript que baja el navegador.
- **Uso de IA:** usé Claude para configurar Sentry en back y front, el cambio de `/health` y para diagnosticar el problema del DSN. Lo verifiqué viendo el error llegar a Sentry, la tabla de operaciones, el DOWN y el UP en el historial del monitor, y el PR de Dependabot en verde.