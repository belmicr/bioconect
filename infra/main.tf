terraform {
  required_version = ">= 1.5"
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 4.0"
    }
  }
  backend "local" {} # el path del estado se pasa en el init: vive FUERA del repo
}

# Habla con el Docker de esta máquina (Docker Desktop en Windows).
provider "docker" {
  host = "npipe:////./pipe/docker_engine"
}

# ---------- El entorno preprod: red, volumen, base, API y front ----------

resource "docker_network" "preprod" {
  name = "bioconect-preprod"
}

resource "docker_volume" "db_data" {
  name = "bioconect-preprod-db-data"
}

resource "docker_image" "postgres" {
  name         = "postgres:16-alpine"
  keep_locally = true # otros entornos de esta máquina usan la misma imagen: el destroy no la borra
}

resource "docker_container" "db" {
  name  = "bioconect-preprod-db"
  image = docker_image.postgres.image_id
  env = [
    "POSTGRES_USER=bioconect",
    "POSTGRES_PASSWORD=${var.db_password}",
    "POSTGRES_DB=bioconect_preprod",
  ]
  networks_advanced {
    name = docker_network.preprod.name
  }
  volumes {
    volume_name    = docker_volume.db_data.name
    container_path = "/var/lib/postgresql/data"
  }
}

# La imagen del TP7: la misma sha-<commit> que corre en QA y PROD.
resource "docker_image" "api" {
  name         = "ghcr.io/belmicr/bioconect-backend:${var.image_tag}"
  keep_locally = true
}

resource "docker_container" "api" {
  name    = "bioconect-preprod-api"
  image   = docker_image.api.image_id
  restart = "unless-stopped" # depends_on espera que la base se CREE, no que esté lista
  env = [
    # La cadena de conexión se DERIVA del contenedor de la base, no se copia.
    "DATABASE_URL=postgresql://bioconect:${var.db_password}@${docker_container.db.name}:5432/bioconect_preprod",
    "SECRET_KEY=${var.secret_key}",
    "APP_ENV=preprod",
  ]
  networks_advanced {
    name = docker_network.preprod.name
  }
  ports {
    internal = 8000
    external = 8090 # distinto de los que usa el compose local (8000 y 3000)
  }
  depends_on = [docker_container.db]
}

resource "docker_image" "front" {
  name         = "ghcr.io/belmicr/bioconect-frontend:${var.image_tag}"
  keep_locally = true
}

resource "docker_container" "front" {
  name  = "bioconect-preprod-front"
  image = docker_image.front.image_id
  env = [
    # La dirección del backend también se DERIVA del contenedor de la API.
    "BACKEND_URL=http://${docker_container.api.name}:8000",
    "DNS_RESOLVER=127.0.0.11",
  ]
  networks_advanced {
    name = docker_network.preprod.name
  }
  ports {
    internal = 80
    external = 8091
  }
}