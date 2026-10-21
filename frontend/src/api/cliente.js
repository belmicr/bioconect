const TOKEN_KEY = 'bioconect_token'

export const guardarToken = (token) => localStorage.setItem(TOKEN_KEY, token)
export const leerToken = () => localStorage.getItem(TOKEN_KEY)
export const borrarToken = () => localStorage.removeItem(TOKEN_KEY)

export class ErrorApi extends Error {
  constructor(estado, mensaje) {
    super(mensaje)
    this.estado = estado
  }
}

async function pedir(ruta, opciones = {}) {
  const token = leerToken()
  const headers = { ...(opciones.headers || {}) }
  if (token) headers.Authorization = `Bearer ${token}`

  const respuesta = await fetch(`/api${ruta}`, { ...opciones, headers })

  if (!respuesta.ok) {
    if (respuesta.status === 401 && token) {
      borrarToken()
      window.dispatchEvent(new Event('sesion-vencida'))
    }
    let detalle = 'Ocurrió un error inesperado'
    try {
      const cuerpo = await respuesta.json()
      if (typeof cuerpo.detail === 'string') detalle = cuerpo.detail
      else if (Array.isArray(cuerpo.detail)) detalle = 'Revisá los datos ingresados'
    } catch {
      // la respuesta no era JSON: nos quedamos con el mensaje genérico
    }
    throw new ErrorApi(respuesta.status, detalle)
  }
  return respuesta
}

export async function traerJson(ruta) {
  return (await pedir(ruta)).json()
}

export async function enviarJson(ruta, cuerpo, metodo = 'POST') {
  const respuesta = await pedir(ruta, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  })
  return respuesta.json()
}

export async function enviarFormulario(ruta, formData) {
  return (await pedir(ruta, { method: 'POST', body: formData })).json()
}

// Un <a href> no puede mandar el token: pedimos el PDF con fetch y lo bajamos como archivo.
export async function descargarPdf(ruta, nombreArchivo) {
  const respuesta = await pedir(ruta)
  const blob = await respuesta.blob()
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombreArchivo
  enlace.click()
  URL.revokeObjectURL(url)
}