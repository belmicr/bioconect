import { useMemo, useState } from 'react'
import { descargarPdf } from '../api/cliente.js'
import { indexarPorId, nombreCompleto } from '../lib/datos.js'
import { filtrarResultados, mensajeDescarga, nombreDescarga } from '../lib/estudios.js'
import { formatearFechaCarga } from '../lib/fechas.js'
import Tubo from './Tubo.jsx'

// Historial de resultados que subió la bioquímica, filtrable por paciente y por estudio.
export default function ListaResultados({ estudios, pacientes, pacienteId, onCambiarPaciente, onSubir }) {
  const [texto, setTexto] = useState('')
  const [errores, setErrores] = useState({})
  const porId = useMemo(() => indexarPorId(pacientes), [pacientes])

  if (estudios.length === 0) {
    return (
      <div className="vacio-grande">
        <h2>Todavía no subiste resultados</h2>
        <p>Cuando subas el PDF de un estudio, aparece acá y el paciente lo ve en su portal.</p>
        <button type="button" className="boton" onClick={() => onSubir('')}>Subir resultado</button>
      </div>
    )
  }

  async function descargar(estudio) {
    setErrores((actuales) => ({ ...actuales, [estudio.id]: null }))
    try {
      await descargarPdf(`/estudios/${estudio.id}/pdf`, nombreDescarga(estudio, porId[estudio.paciente_id]))
    } catch (error) {
      setErrores((actuales) => ({ ...actuales, [estudio.id]: mensajeDescarga(error) }))
    }
  }

  const visibles = filtrarResultados(estudios, { pacienteId, texto })

  return (
    <section aria-labelledby="titulo-resultados">
      <h2 id="titulo-resultados" className="oculto-visual">Resultados cargados</h2>
      <div className="barra-filtros">
        <div className="filtro">
          <label htmlFor="filtro-paciente">Paciente</label>
          <select id="filtro-paciente" value={pacienteId} onChange={(evento) => onCambiarPaciente(evento.target.value)}>
            <option value="">Todos los pacientes</option>
            {pacientes.map((p) => (
              <option key={p.id} value={String(p.id)}>{p.apellido}, {p.nombre}</option>
            ))}
          </select>
        </div>
        <div className="filtro buscador">
          <label htmlFor="buscar-resultado">Estudio</label>
          <input id="buscar-resultado" type="search" placeholder="Ej: hemograma" value={texto}
                 onChange={(evento) => setTexto(evento.target.value)} />
        </div>
      </div>

      {visibles.length === 0 ? (
        <p className="sin-coincidencias">No hay resultados con esos filtros.</p>
      ) : (
        <ul className="lista-resultados">
          {visibles.map((estudio) => (
            <li key={estudio.id} className="fila-resultado">
              <Tubo descripcion={estudio.descripcion} />
              <div className="fila-principal">
                <span className="fila-nombre">{estudio.descripcion || 'Estudio sin nombre'}</span>
                <span className="apagado">{nombreCompleto(porId[estudio.paciente_id])}</span>
              </div>
              <span className="fila-fecha">{formatearFechaCarga(estudio.fecha_carga)}</span>
              <div className="fila-acciones">
                <button type="button" className="boton chico secundario" onClick={() => descargar(estudio)}>
                  Descargar PDF
                </button>
              </div>
              {errores[estudio.id] && <p className="error fila-error" role="alert">{errores[estudio.id]}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
