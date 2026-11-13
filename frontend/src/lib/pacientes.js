import { plural, sinTildes } from './texto.js'
import { validarEmail, validarPassword } from './validaciones.js'

// Sin caracteres que se confunden al dictarlos o copiarlos a mano (0/O, 1/l/I).
export const CARACTERES_PASSWORD = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

// Bytes al azar del generador criptográfico del navegador.
// Math.random no sirve para contraseñas porque se puede predecir.
export function bytesSeguros(cantidad) {
  return crypto.getRandomValues(new Uint8Array(cantidad))
}

// Muestreo por rechazo: de cada byte se usan los 6 bits de abajo (un número del 0 al 63)
// y se descartan los que no tienen carácter en la lista. Así todos los caracteres salen
// con la misma probabilidad. Dividir o usar módulo haría que algunos salgan un poco más
// que otros: es lo que marca CodeQL (js/biased-cryptographic-random).
export function generarPassword(obtenerBytes = bytesSeguros, largo = 10) {
  const elegidos = []
  while (elegidos.length < largo) {
    for (const byte of obtenerBytes(largo)) {
      const indice = byte & 0b111111
      if (indice < CARACTERES_PASSWORD.length) elegidos.push(CARACTERES_PASSWORD[indice])
    }
  }
  return elegidos.slice(0, largo).join('')
}

export function normalizarDni(dni) {
  return String(dni ?? '').replace(/[.\s-]/g, '')
}

// "40123456" -> "40.123.456", como figura en el documento.
export function formatearDni(dni) {
  const numero = normalizarDni(dni)
  if (!/^\d+$/.test(numero)) return numero
  return numero.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

// Devuelve un objeto con un mensaje por cada campo con problemas. Vacío = todo bien.
export function validarPaciente({ nombre, apellido, dni, email, password }) {
  const errores = {}
  if (!(nombre ?? '').trim()) errores.nombre = 'Escribí el nombre.'
  if (!(apellido ?? '').trim()) errores.apellido = 'Escribí el apellido.'

  const numero = normalizarDni(dni)
  if (!numero) errores.dni = 'Escribí el DNI.'
  else if (!/^\d{7,8}$/.test(numero)) errores.dni = 'El DNI tiene que tener 7 u 8 números.'

  const errorEmail = validarEmail(email)
  if (errorEmail) errores.email = errorEmail

  const errorPassword = validarPassword(password)
  if (errorPassword) errores.password = errorPassword

  return errores
}

export function iniciales(persona) {
  const nombre = (persona?.nombre ?? '').trim()
  const apellido = (persona?.apellido ?? '').trim()
  const letras = `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase()
  return letras || '?'
}

export function ordenarPorApellido(pacientes) {
  return [...pacientes].sort((a, b) =>
    `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`, 'es'),
  )
}

// Busca por nombre, apellido (en cualquier orden), DNI con o sin puntos y email.
export function buscarPacientes(pacientes, texto) {
  const busqueda = sinTildes(texto).trim()
  if (!busqueda) return pacientes
  const busquedaDni = normalizarDni(busqueda)
  return pacientes.filter((p) => {
    const nombres = sinTildes(`${p.nombre} ${p.apellido} ${p.apellido} ${p.nombre}`)
    return (
      nombres.includes(busqueda) ||
      sinTildes(p.email).includes(busqueda) ||
      (busquedaDni !== '' && normalizarDni(p.dni).includes(busquedaDni))
    )
  })
}

// Cuántos resultados tiene cada paciente y cuándo se cargó el último.
export function resumirPorPaciente(estudios) {
  const resumen = {}
  for (const estudio of estudios) {
    const actual = resumen[estudio.paciente_id] ?? { cantidad: 0, ultima: null }
    actual.cantidad += 1
    if (!actual.ultima || estudio.fecha_carga > actual.ultima) actual.ultima = estudio.fecha_carga
    resumen[estudio.paciente_id] = actual
  }
  return resumen
}

// El texto que la bioquímica le pasa al paciente (WhatsApp, mail, impreso).
export function textoCredenciales(paciente, password, direccion) {
  return [
    `Hola ${paciente.nombre}, ya podés ver tus resultados de laboratorio en BioConect.`,
    `Entrá a ${direccion}`,
    `Email: ${paciente.email}`,
    `Contraseña: ${password}`,
  ].join('\n')
}

export function fraseResumen(cantidadPacientes, cantidadResultados, recientes) {
  if (cantidadPacientes === 0) return 'Todavía no tenés pacientes. Empezá creando el primero.'
  const base = `Tenés ${plural(cantidadPacientes, 'paciente', 'pacientes')} y ${plural(
    cantidadResultados,
    'resultado cargado',
    'resultados cargados',
  )}.`
  if (recientes === 0) return base
  return `${base} ${recientes === 1 ? 'Uno es de esta semana.' : `${recientes} son de esta semana.`}`
}
