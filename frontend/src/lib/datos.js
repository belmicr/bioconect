export function ordenarPorFechaDesc(items, campo) {
  return [...items].sort((a, b) => new Date(b[campo]) - new Date(a[campo]))
}

export function filtrarPorTexto(estudios, texto) {
  const busqueda = (texto ?? '').trim().toLowerCase()
  if (!busqueda) return estudios
  return estudios.filter((e) => (e.descripcion ?? '').toLowerCase().includes(busqueda))
}

export function nombreCompleto(persona) {
  if (!persona) return 'Desconocido'
  return `${persona.nombre} ${persona.apellido}`
}

export function indexarPorId(lista) {
  return Object.fromEntries(lista.map((elemento) => [elemento.id, elemento]))
}

export function pedidosPendientes(pedidos) {
  return pedidos.filter((p) => p.estado === 'pendiente')
}

const ETIQUETAS = {
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
  cancelado: 'Cancelado',
  respondido: 'Respondido',
}

export function etiquetaEstado(estado) {
  return ETIQUETAS[estado] ?? estado
}