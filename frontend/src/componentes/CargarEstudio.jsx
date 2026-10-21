import { useState } from 'react'
import { enviarFormulario } from '../api/cliente.js'
import { nombreCompleto } from '../lib/datos.js'
import { esPdf } from '../lib/validaciones.js'

export default function CargarEstudio({ pacientes, onCargado }) {
  const [pacienteId, setPacienteId] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [mensaje, setMensaje] = useState(null)
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(evento) {
    evento.preventDefault()
    const formulario = evento.currentTarget
    const archivo = formulario.elements.archivo.files[0]
    setMensaje(null)
    setError(null)

    if (!pacienteId) return setError('Elegí un paciente.')
    if (!esPdf(archivo)) return setError('Elegí un archivo PDF.')

    const datos = new FormData()
    datos.append('paciente_id', pacienteId)
    datos.append('descripcion', descripcion)
    datos.append('archivo', archivo)

    setEnviando(true)
    try {
      await enviarFormulario('/estudios', datos)
      setMensaje('Resultado cargado correctamente.')
      setDescripcion('')
      formulario.reset()
      onCargado?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form className="tarjeta formulario" onSubmit={enviar}>
      <h2>Cargar resultado</h2>
      {pacientes.length === 0 && <p className="vacio">Todavía no tenés pacientes registrados.</p>}
      <div className="campo">
        <label htmlFor="paciente">Paciente</label>
        <select id="paciente" value={pacienteId} onChange={(e) => setPacienteId(e.target.value)}>
          <option value="">Elegí un paciente…</option>
          {pacientes.map((p) => (
            <option key={p.id} value={p.id}>{nombreCompleto(p)} · DNI {p.dni ?? '—'}</option>
          ))}
        </select>
      </div>
      <div className="campo">
        <label htmlFor="descripcion">Descripción</label>
        <input id="descripcion" value={descripcion} placeholder="Ej: Hemograma completo"
               onChange={(e) => setDescripcion(e.target.value)} />
      </div>
      <div className="campo">
        <label htmlFor="archivo">Archivo PDF</label>
        <input id="archivo" name="archivo" type="file" accept="application/pdf" />
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {mensaje && <p className="exito" role="status">{mensaje}</p>}
      <button className="boton" type="submit" disabled={enviando}>
        {enviando ? 'Subiendo…' : 'Subir resultado'}
      </button>
    </form>
  )
}