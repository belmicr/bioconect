import { useEffect, useMemo, useState } from 'react'
import { descargarPdf } from '../api/cliente.js'
import { cargarEstudios } from '../api/servicios.js'
import { filtrarPorTexto, indexarPorId, nombreCompleto } from '../lib/datos.js'
import { formatearFechaCarga } from '../lib/fechas.js'

export default function Estudios({ rol, pacientes = [], version = 0 }) {
  const [estudios, setEstudios] = useState(null)
  const [error, setError] = useState(null)
  const [texto, setTexto] = useState('')
  const porId = useMemo(() => indexarPorId(pacientes), [pacientes])

  useEffect(() => {
    let activo = true
    cargarEstudios()
      .then((datos) => { if (activo) setEstudios(datos) })
      .catch((e) => { if (activo) setError(e.message) })
    return () => { activo = false }
  }, [version])

  async function descargar(estudio) {
    try {
      await descargarPdf(`/estudios/${estudio.id}/pdf`, `estudio-${estudio.id}.pdf`)
    } catch (e) {
      setError(e.message)
    }
  }

  if (error) return <p className="error" role="alert">{error}</p>
  if (!estudios) return <p>Cargando estudios…</p>

  const visibles = filtrarPorTexto(estudios, texto)

  return (
    <section className="tarjeta">
      <div className="fila-titulo">
        <h2>{rol === 'paciente' ? 'Mis estudios' : 'Historial de estudios cargados'}</h2>
        <input className="buscador" type="search" placeholder="Buscar por descripción"
               aria-label="Buscar estudios" value={texto}
               onChange={(e) => setTexto(e.target.value)} />
      </div>
      {visibles.length === 0 ? (
        <p className="vacio">No hay estudios para mostrar.</p>
      ) : (
        <table className="tabla">
          <thead>
            <tr>
              <th>Fecha</th>
              {rol === 'bioquimico' && <th>Paciente</th>}
              <th>Descripción</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((e) => (
              <tr key={e.id}>
                <td>{formatearFechaCarga(e.fecha_carga)}</td>
                {rol === 'bioquimico' && <td>{nombreCompleto(porId[e.paciente_id])}</td>}
                <td>{e.descripcion || 'Sin descripción'}</td>
                <td>
                  <button className="boton chico" onClick={() => descargar(e)}>Descargar PDF</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}