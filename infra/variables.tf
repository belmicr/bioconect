variable "db_password" {
  type      = string
  sensitive = true # no se imprime en el plan ni en los logs
}

variable "secret_key" {
  type      = string
  sensitive = true
}

variable "image_tag" {
  type        = string
  description = "La etiqueta sha-<commit> de una imagen publicada por el pipeline del TP7"
}