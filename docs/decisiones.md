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