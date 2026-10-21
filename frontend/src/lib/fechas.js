const CON_ZONA = /(Z|[+-]\d{2}:?\d{2})$/
const FORMATO_FECHA = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' })
const FORMATO_HORA = new Intl.DateTimeFormat('es-AR', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

// El backend guarda fecha_carga en UTC pero la manda sin "Z": hay que decirle que es UTC.
export function interpretarComoUtc(iso) {
  return new Date(CON_ZONA.test(iso) ? iso : `${iso}Z`)
}

export function formatearFechaCarga(iso) {
  if (!iso) return ''
  const fecha = interpretarComoUtc(iso)
  return `${FORMATO_FECHA.format(fecha)} ${FORMATO_HORA.format(fecha)}`
}

// Los turnos son hora local del laboratorio, sin zona: se leen tal cual.
export function formatearFechaHora(iso) {
  if (!iso) return ''
  const fecha = new Date(iso)
  return `${FORMATO_FECHA.format(fecha)} ${FORMATO_HORA.format(fecha)}`
}

export function horaDe(iso) {
  return FORMATO_HORA.format(new Date(iso))
}

export function diaISO(fecha) {
  const anio = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

export function esDiaHabil(fecha) {
  const dia = fecha.getDay()
  return dia !== 0 && dia !== 6
}

// Los próximos N días de lunes a viernes, empezando mañana.
export function proximosDiasHabiles(desde, cantidad) {
  const dias = []
  const actual = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate())
  while (dias.length < cantidad) {
    actual.setDate(actual.getDate() + 1)
    if (esDiaHabil(actual)) dias.push(new Date(actual))
  }
  return dias
}