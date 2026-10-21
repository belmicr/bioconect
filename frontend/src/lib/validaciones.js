export const LARGO_MINIMO_PASSWORD = 6
export const LARGO_MAXIMO_MENSAJE = 500

export function validarEmail(email) {
  const valor = (email ?? '').trim()
  if (!valor) return 'El email es obligatorio.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) return 'El email no tiene un formato válido.'
  return null
}

export function validarPassword(password) {
  if (!password) return 'La contraseña es obligatoria.'
  if (password.length < LARGO_MINIMO_PASSWORD) {
    return `La contraseña debe tener al menos ${LARGO_MINIMO_PASSWORD} caracteres.`
  }
  return null
}

export function validarCredenciales(email, password) {
  return validarEmail(email) ?? validarPassword(password)
}

export function validarMensaje(texto) {
  const valor = (texto ?? '').trim()
  if (!valor) return 'El mensaje está vacío.'
  if (valor.length > LARGO_MAXIMO_MENSAJE) {
    return `El mensaje no puede superar los ${LARGO_MAXIMO_MENSAJE} caracteres.`
  }
  return null
}

export function esPdf(archivo) {
  return Boolean(archivo) && archivo.type === 'application/pdf'
}