import { enviarFormulario, enviarJson, traerJson } from './cliente.js'
import { ordenarPorFechaDesc } from '../lib/datos.js'
import { normalizarDni, ordenarPorApellido } from '../lib/pacientes.js'

// Cada función recibe el cliente HTTP por parámetro: en los tests se le pasa un doble.

export async function cargarEstudios(traer = traerJson) {
  const estudios = await traer('/estudios')
  return ordenarPorFechaDesc(estudios, 'fecha_carga')
}

export async function cargarPacientes(traer = traerJson) {
  return ordenarPorApellido(await traer('/pacientes'))
}

export async function crearPaciente(datos, enviar = enviarJson) {
  return enviar('/pacientes', {
    nombre: datos.nombre.trim(),
    apellido: datos.apellido.trim(),
    dni: normalizarDni(datos.dni),
    email: datos.email.trim().toLowerCase(),
    password: datos.password,
    fecha_nacimiento: datos.fechaNacimiento || null,
  })
}

export async function subirResultado({ pacienteId, descripcion, archivo }, enviar = enviarFormulario) {
  const formulario = new FormData()
  formulario.append('paciente_id', String(pacienteId))
  formulario.append('descripcion', descripcion.trim())
  formulario.append('archivo', archivo)
  return enviar('/estudios', formulario)
}
