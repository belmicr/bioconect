# ---- Etapa 1: build ----
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Etapa 2: tests (parte del build: ya tiene Node y las dependencias de desarrollo) ----
FROM build AS test
ENTRYPOINT ["npm", "run", "test:ci"]

# ---- Etapa 3: servir con nginx ----
FROM nginx:1.27-alpine AS final
COPY default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
ENV BACKEND_URL=http://backend:8000 \
    DNS_RESOLVER=127.0.0.11
EXPOSE 80

# El pipeline le pasa el commit; queda publicado en /version.txt.
ARG GIT_SHA=dev
RUN echo "$GIT_SHA" > /usr/share/nginx/html/version.txt