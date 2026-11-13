import { filtrarPorTexto } from './datos.js'
import { diaISO, interpretarComoUtc } from './fechas.js'
import { aSlug, sinTildes } from './texto.js'
import { esPdf } from './validaciones.js'

// Mismo límite que el backend (MAX_PDF_BYTES en main.py).
export const MAX_PDF_BYTES = 10 * 1024 * 1024

// Los que más se piden: un clic y la bioquímica no tiene que escribirlos.
export const ESTUDIOS_FRECUENTES = [
  'Hemograma completo',
  'Glucemia',
  'Perfil lipídico',
  'Hepatograma',
  'Orina completa',
  'Coagulograma',
  'TSH y T4 libre',
]

// El color de la tapa del tubo donde se procesa cada estudio. Es el código de colores
// que se usa en cualquier laboratorio, y en la app identifica cada resultado de un vistazo.
const TUBOS = [
  {
    clave: 'lila',
    nombre: 'Tubo lila (EDTA)',
    palabras: ['hemograma', 'hematocrito', 'hemoglobina', 'plaquetas', 'eritrosedimentacion', 'vsg'],
  },
  {
    clave: 'celeste',
    nombre: 'Tubo celeste (citrato)',
    palabras: ['coagul', 'kptt', 'protrombina', 'fibrinogeno'],
  },
  { clave: 'gris', nombre: 'Tubo gris (fluoruro)', palabras: ['glucemia', 'glucosa', 'lactato'] },
  { clave: 'ambar', nombre: 'Frasco de orina', palabras: ['orina', 'urocultivo', 'sedimento'] },
  {
    clave: 'oro',
    nombre: 'Tubo dorado (suero)',
    palabras: [
      'lipid', 'colesterol', 'triglic', 'hepato', 'urea', 'creatinina', 'tsh', 't4',
      'tiroid', 'ferritina', 'vitamina', 'ionograma', 'urico',
    ],
  },
]

export function tuboDeEstudio(descripcion) {
  const texto = sinTildes(descripcion)
  const tubo = TUBOS.find((t) => t.palabras.some((palabra) => texto.includes(palabra)))
  if (!tubo) return { clave: 'general', nombre: 'Muestra general' }
  return { clave: tubo.clave, nombre: tubo.nombre }
}

export function formatearTamanio(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}

// Las mismas reglas que aplica el backend, avisadas antes de subir el archivo.
export function validarArchivoPdf(archivo) {
  if (!archivo) return 'Elegí el PDF del resultado.'
  if (!esPdf(archivo) || !/\.pdf$/i.test(archivo.name ?? '')) return 'El archivo tiene que ser un PDF.'
  if (archivo.size > MAX_PDF_BYTES) return 'El PDF supera los 10 MB.'
  return null
}

export function validarResultado({ pacienteId, descripcion, archivo }) {
  const errores = {}
  if (!pacienteId) errores.paciente = 'Elegí el paciente.'
  if (!(descripcion ?? '').trim()) errores.descripcion = 'Escribí qué estudio es.'
  const errorArchivo = validarArchivoPdf(archivo)
  if (errorArchivo) errores.archivo = errorArchivo
  return errores
}

export function filtrarResultados(estudios, { pacienteId, texto }) {
  const delPaciente = pacienteId
    ? estudios.filter((e) => String(e.paciente_id) === String(pacienteId))
    : estudios
  return filtrarPorTexto(delPaciente, texto)
}

// "hemograma-completo-gomez-2026-11-12.pdf" en lugar de "estudio-7.pdf".
export function nombreDescarga(estudio, paciente) {
  // La fecha va en hora local: un PDF subido a las 22 h en Argentina no tiene que decir "mañana".
  const dia = estudio.fecha_carga ? diaISO(interpretarComoUtc(estudio.fecha_carga)) : null
  const partes = [estudio.descripcion || 'estudio', paciente?.apellido, dia]
  return `${aSlug(partes.filter(Boolean).join(' '))}.pdf`
}

// En el plan gratuito de Render el disco se borra al reiniciar: el estudio sigue en la base
// pero el PDF ya no está. Se le dice a la persona qué hacer, no solo que falló.
export function mensajeDescarga(error) {
  if (error?.estado === 404) return 'El archivo ya no está disponible. Pedile al laboratorio que lo vuelva a subir.'
  return error?.message || 'No se pudo descargar el PDF. Probá de nuevo en un momento.'
}
