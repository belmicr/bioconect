import { useState } from 'react'
import { subirResultado } from '../api/servicios.js'
import { nombreCompleto } from '../lib/datos.js'
import { ESTUDIOS_FRECUENTES, validarResultado } from '../lib/estudios.js'
import { formatearDni } from '../lib/pacientes.js'
import Tubo from './Tubo.jsx'
import ZonaPdf from './ZonaPdf.jsx'

// Subir el PDF de un resultado. Si se abre desde la fila de un paciente, ya viene elegido.
export default function SubirResultado({ pacientes, pacienteInicial, onSubido, onNuevoPaciente, onCerrar }) {
  const [pacienteId, setPacienteId] = useState(pacienteInicial ? String(pacienteInicial) : '')
  const [descripcion, setDescripcion] = useState('')
  const [archivo, setArchivo] = useState(null)
  const [errores, setErrores] = useState({})
  const [errorApi, setErrorApi] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [subido, setSubido] = useState(null)
  const [intento, setIntento] = useState(0)

  if (pacientes.length === 0) {
    return (
      <div className="vacio-modal">
        <p>Para subir un resultado, primero creá al paciente.</p>
        <div className="modal-pie">
          <button type="button" className="boton secundario" onClick={onCerrar}>Cancelar</button>
          <button type="button" className="boton" onClick={onNuevoPaciente}>Nuevo paciente</button>
        </div>
      </div>
    )
  }

  async function enviar(evento) {
    evento.preventDefault()
    const problemas = validarResultado({ pacienteId, descripcion, archivo })
    setErrores(problemas)
    if (Object.keys(problemas).length > 0) return
    setErrorApi(null)
    setEnviando(true)
    try {
      const estudio = await subirResultado({ pacienteId, descripcion, archivo })
      const paciente = pacientes.find((p) => String(p.id) === pacienteId)
      setSubido({ paciente, descripcion: descripcion.trim() })
      onSubido(estudio)
    } catch (error) {
      setErrorApi(error.message)
    } finally {
      setEnviando(false)
    }
  }

  function subirOtro() {
    setSubido(null)
    setDescripcion('')
    setArchivo(null)
    setErrores({})
    setIntento((n) => n + 1)
  }

  if (subido) {
    return (
      <div className="credenciales">
        <div className="aviso-exito" role="status">
          <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true" focusable="false">
            <circle cx="14" cy="14" r="13" fill="currentColor" />
            <path d="M8 14.5l4 4 8-9" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <p className="aviso-titulo">Resultado subido</p>
            <p>
              {subido.descripcion} de {nombreCompleto(subido.paciente)} ya está disponible en su portal.
            </p>
          </div>
        </div>
        <div className="modal-pie">
          <button type="button" className="boton secundario" onClick={subirOtro}>Subir otro</button>
          <button type="button" className="boton" onClick={onCerrar}>Listo</button>
        </div>
      </div>
    )
  }

  return (
    <form className="formulario" onSubmit={enviar} noValidate>
      <div className="campo">
        <label htmlFor="sr-paciente">Paciente</label>
        <select id="sr-paciente" value={pacienteId} onChange={(evento) => setPacienteId(evento.target.value)}
                aria-invalid={errores.paciente ? 'true' : undefined}
                aria-describedby={errores.paciente ? 'sr-paciente-error' : undefined}>
          <option value="">Elegí un paciente</option>
          {pacientes.map((p) => (
            <option key={p.id} value={String(p.id)}>
              {p.apellido}, {p.nombre} (DNI {formatearDni(p.dni) || 'sin cargar'})
            </option>
          ))}
        </select>
        {errores.paciente && <p id="sr-paciente-error" className="campo-error">{errores.paciente}</p>}
      </div>

      <div className="campo">
        <label htmlFor="sr-estudio">Estudio</label>
        <input id="sr-estudio" autoComplete="off" placeholder="Ej: Hemograma completo" value={descripcion}
               onChange={(evento) => setDescripcion(evento.target.value)}
               aria-invalid={errores.descripcion ? 'true' : undefined}
               aria-describedby={errores.descripcion ? 'sr-estudio-error' : undefined} />
        {errores.descripcion && <p id="sr-estudio-error" className="campo-error">{errores.descripcion}</p>}
        <div className="sugerencias" role="group" aria-label="Estudios frecuentes">
          {ESTUDIOS_FRECUENTES.map((estudio) => (
            <button key={estudio} type="button" className="sugerencia" aria-pressed={descripcion === estudio}
                    onClick={() => setDescripcion(estudio)}>
              <Tubo descripcion={estudio} chico />
              {estudio}
            </button>
          ))}
        </div>
      </div>

      <div className="campo">
        <span id="sr-archivo-titulo" className="campo-titulo">Resultado en PDF</span>
        <ZonaPdf key={intento} id="sr-archivo" archivo={archivo} error={errores.archivo} onElegir={setArchivo} />
        {errores.archivo && <p id="sr-archivo-error" className="campo-error">{errores.archivo}</p>}
      </div>

      {errorApi && <p className="aviso-error" role="alert">{errorApi}</p>}

      <div className="modal-pie">
        <button type="button" className="boton secundario" onClick={onCerrar}>Cancelar</button>
        <button type="submit" className="boton" disabled={enviando}>
          {enviando ? 'Subiendo…' : 'Subir resultado'}
        </button>
      </div>
    </form>
  )
}
