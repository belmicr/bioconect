// Utilidades de texto compartidas por pacientes y estudios.

// "Gómez" y "gomez" tienen que encontrarse igual en un buscador.
export function sinTildes(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

export function plural(cantidad, singular, enPlural) {
  return `${cantidad} ${cantidad === 1 ? singular : enPlural}`
}

// "Hemograma completo · Gómez" -> "hemograma-completo-gomez": sirve para nombres de archivo.
export function aSlug(texto) {
  return sinTildes(texto)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
