// Utilidades para mostrar la agenda de turnos (sin tests, a propósito: es el PR que queda abierto).
export function agruparTurnosPorDia(turnos) {
  const grupos = {}
  for (const turno of turnos) {
    const dia = turno.fecha_hora.slice(0, 10)
    if (!grupos[dia]) {
      grupos[dia] = []
    }
    grupos[dia].push(turno)
  }
  return grupos
}

export function proximoTurno(turnos, ahora = new Date()) {
  const futuros = turnos
    .filter((t) => t.estado !== 'cancelado' && new Date(t.fecha_hora) > ahora)
    .sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora))
  if (futuros.length === 0) {
    return null
  }
  return futuros[0]
}

export function contarPorEstado(turnos) {
  const cuenta = { pendiente: 0, confirmado: 0, cancelado: 0, otros: 0 }
  for (const turno of turnos) {
    if (turno.estado in cuenta) {
      cuenta[turno.estado] += 1
    } else {
      cuenta.otros += 1
    }
  }
  return cuenta
}

export function puedeCancelar(turno, ahora = new Date()) {
  if (!turno) {
    return false
  }
  if (turno.estado === 'cancelado') {
    return false
  }
  const horas = (new Date(turno.fecha_hora) - ahora) / 3600000
  if (horas < 0) {
    return false
  }
  if (horas < 24) {
    return false
  }
  return true
}

export function mensajeTurno(turno, ahora = new Date()) {
  if (!turno) {
    return 'No tenés turnos próximos'
  }
  if (turno.estado === 'pendiente') {
    return 'Tu turno está pendiente de confirmación'
  }
  if (turno.estado === 'confirmado') {
    return 'Tu turno está confirmado'
  }
  if (puedeCancelar(turno, ahora)) {
    return 'Todavía podés cancelar'
  }
  return 'Turno cerrado'
}

export function horariosLibres(horarios, ocupados) {
  const tomados = new Set(ocupados)
  return horarios.filter((h) => !tomados.has(h))
}