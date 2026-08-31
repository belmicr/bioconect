# Decisiones � BioConect

## TP1 � Git colaborativo
- Estrategia de branching: GitHub Flow (rama corta por feature, PR obligatorio, merge por squash).
- Motivo: es la recomendada por la catedra para proyectos con deploy continuo simple, y al ser un TP individual no necesito coordinar ramas paralelas de otras personas.

## Conflicto de merge
Se genero un conflicto real entre dos ramas (feature/titulo-a y feature/titulo-b) que
modificaban la misma linea del README partiendo del mismo commit base. Git no pudo
resolverlo solo porque no tiene forma de saber cual de las dos versiones de contenido
es la correcta - eso es una decision humana. Ademas, Git detecto el archivo como
binario en un merge intermedio (por diferencias de codificacion), por lo que no
inserto marcadores automaticos y hubo que reescribir el archivo a mano con el
contenido final decidido.

## TP2 — Contenedores (Docker)

### App elegida
BioConect: plataforma de gestión de resultados de laboratorio. Cumple los criterios
de la cátedra: es chica (backend + frontend + BD), corre local sin servicios externos
raros, y la entiendo completa porque la estoy armando yo desde cero.

### Imagen base y multi-stage del backend
- Etapa `build`: `python:3.12-slim`, instala las dependencias de `requirements.txt`
  con `pip install --user` (así quedan en `/root/.local`, una ruta fácil de copiar
  a la siguiente etapa).
- Etapa `final`: `python:3.12-slim` de nuevo, pero limpia — solo copia
  `/root/.local` (los paquetes ya instalados) y el código de `app/`. No lleva
  ninguna herramienta de compilación extra.

### Medición de tamaño
- Imagen base sola (`python:3.12-slim`): 119MB
- Imagen final (`bioconect-backend:v0.1.0`): 167MB
- Diferencia: ~48MB, correspondientes a FastAPI, Uvicorn, SQLModel, SQLAlchemy y
  sus dependencias. Como Python no tiene un "SDK pesado" separable como .NET (el
  intérprete es el mismo en build y en runtime), la ganancia de espacio de
  multi-stage acá es menor que en otros lenguajes — pero el beneficio real es
  que la etapa `build` no deja rastros: ni cache de pip, ni archivos temporales
  de compilación, solo los paquetes finales.

### Qué persiste
Nada todavía en esta etapa: el backend usa SQLite local (`local.db`) fuera del
contenedor mientras se corre sin Docker. Cuando se agregue Postgres en el
`docker-compose.yml` (checkpoint 4), ahí sí se define un volumen para persistir
los datos de la base.

### Problemas encontrados
- Docker Desktop no estaba corriendo al momento de hacer el primer build
  (`error during connect... docker daemon is not running`) — se resolvió
  abriendo Docker Desktop y esperando a que el engine iniciara.
- Confusión inicial con `python3` vs `python` y `source` vs `Activate.ps1` al
  crear el entorno virtual en Windows/PowerShell (comandos distintos a
  Linux/Mac).
  ### Problema: nginx no arranca en contenedor aislado
Al correr `bioconect-frontend` con `docker run` (sin compose), nginx falla al
iniciar con "host not found in upstream 'backend'". Esto es esperado: el
`proxy_pass http://backend:8000/` de `nginx.conf` depende de que exista un
contenedor llamado `backend` en la misma red de Docker, algo que solo compose
provee. El frontend no está diseñado para correr aislado — se valida
completo recién con `docker-compose.yml` (checkpoint 4).

### Uso de IA
Usé Claude para armar el Dockerfile multi-stage del backend, diagnosticar
errores de entorno en Windows/PowerShell (rutas de carpetas, política de
ejecución de scripts, daemon de Docker no iniciado), e interpretar la
comparación de tamaños de imagen.
### Imagen base y multi-stage del frontend
- Etapa `build`: `node:24-alpine`, corre `npm ci` + `npm run build` para
  compilar React a archivos estáticos.
- Etapa `final`: `nginx:1.27-alpine`, copia solo `/app/dist` (el resultado
  compilado) y sirve con nginx. Node y todo `node_modules` quedan atrás en
  la etapa `build` — no viajan a la imagen final.
- Tamaño final: 48.5MB. La ganancia de multi-stage acá es mucho más marcada
  que en el backend: node_modules puede pesar cientos de MB, y ninguno de
  esos paquetes de desarrollo llega a la imagen que se publica.

 ### Registry público
Imágenes publicadas en GitHub Container Registry, visibilidad pública:
- ghcr.io/belmicr/bioconect-backend:v0.1.0
- ghcr.io/belmicr/bioconect-frontend:v0.1.0

Se armó `docker-compose.registry.yml` como alternativa a `docker-compose.yml`,
reemplazando `build:` por `image:` apuntando al registry — permite levantar
el sistema completo sin necesidad de tener el código fuente ni compilar nada,
solo con las imágenes publicadas.

### Problema: tag v0.1.0 apuntando a versión desactualizada
Al construir la imagen del backend por primera vez (checkpoint 2), se
etiquetó como v0.1.0 antes de agregar psycopg2-binary al requirements.txt.
Luego, docker compose build generó una imagen nueva (con el driver ya
incluido) pero bajo el tag `latest`, dejando `v0.1.0` desactualizado.
Se corrigió re-etiquetando `v0.1.0` para que apunte al mismo hash que
`latest` antes de publicar en ghcr.io — lección: verificar siempre qué
imagen representa exactamente el tag que se publica. 