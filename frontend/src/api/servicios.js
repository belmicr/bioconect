import { traerJson } from './cliente.js'
import { ordenarPorFechaDesc } from '../lib/datos.js'

export async function cargarEstudios(traer = traerJson) {
  const estudios = await traer('/estudios')
  return ordenarPorFechaDesc(estudios, 'fecha_carga')
}