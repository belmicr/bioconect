// Clasifica un estudio según hace cuánto se cargó, para destacarlo en pantalla.
export function clasificarAntiguedad(estudio, ahora = new Date()) {
  if (!estudio || !estudio.fecha_carga) {
    return 'sin-fecha'
  }
  const iso = estudio.fecha_carga.endsWith('Z') ? estudio.fecha_carga : `${estudio.fecha_carga}Z`
  const dias = (ahora - new Date(iso)) / 86400000
  if (dias < 0) {
    return 'futuro'
  }
  if (dias < 1) {
    return 'nuevo'
  }
  if (dias < 7) {
    return 'esta-semana'
  }
  if (dias < 30) {
    return 'este-mes'
  }
  if (dias < 365) {
    return 'este-anio'
  }
  return 'antiguo'
}

export function resumirAntiguedad(estudios, ahora = new Date()) {
  const resumen = { nuevo: 0, 'esta-semana': 0, 'este-mes': 0, 'este-anio': 0, antiguo: 0, otros: 0 }
  for (const estudio of estudios) {
    const clase = clasificarAntiguedad(estudio, ahora)
    if (clase in resumen) {
      resumen[clase] += 1
    } else {
      resumen.otros += 1
    }
  }
  return resumen
}

export function etiquetaAntiguedad(clase) {
  if (clase === 'nuevo') {
    return 'Cargado hoy'
  }
  if (clase === 'esta-semana') {
    return 'Cargado esta semana'
  }
  if (clase === 'este-mes') {
    return 'Cargado este mes'
  }
  if (clase === 'este-anio') {
    return 'Cargado este año'
  }
  if (clase === 'antiguo') {
    return 'Estudio antiguo'
  }
  if (clase === 'futuro') {
    return 'Fecha inválida'
  }
  return 'Sin fecha'
}

export function estudiosParaRevisar(estudios, ahora = new Date()) {
  return estudios.filter((estudio) => {
    const clase = clasificarAntiguedad(estudio, ahora)
    return clase === 'nuevo' || clase === 'esta-semana'
  })
}