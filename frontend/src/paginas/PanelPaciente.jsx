import { useEffect, useMemo, useState } from 'react'
import { descargarPdf } from '../api/cliente.js'
import { cargarEstudios } from '../api/servicios.js'
import { useAuth } from '../auth/AuthContext.jsx'
import Panel from '../componentes/Panel.jsx'
import { clasificarAntiguedad, etiquetaAntiguedad } from '../lib/antiguedad.js'
import { filtrarPorTexto } from '../lib/datos.js'
import { mensajeDescarga, nombreDescarga, tuboDeEstudio } from '../lib/estudios.js'
import { formatearDiaCarga, formatearFechaCarga } from '../lib/fechas.js'
import { plural } from '../lib/texto.js'

const RECIENTES = ['nuevo', 'esta-semana']

export default function PanelPaciente() {
  const { usuario } = useAuth()
  const [estudios, setEstudios] = useState(null)
  const [error, setError] = useState(null)
  const [texto, setTexto] = useState('')
  const [errores, setErrores] = useState({})
  const [descargando, setDescargando] = useState(null)

  useEffect(() => {
    let activo = true
    cargarEstudios()
      .then((datos) => {
        if (activo) setEstudios(datos)
      })
      .catch((e) => {
        if (activo) setError(e.message)
      })
    return () => {
      activo = false
    }
  }, [])

  const visibles = useMemo(() => filtrarPorTexto(estudios ?? [], texto), [estudios, texto])

  async function descargar(estudio) {
    setErrores((actuales) => ({ ...actuales, [estudio.id]: null }))
    setDescargando(estudio.id)
    try {
      await descargarPdf(`/estudios/${estudio.id}/pdf`, nombreDescarga(estudio, usuario))
    } catch (e) {
      setErrores((actuales) => ({ ...actuales, [estudio.id]: mensajeDescarga(e) }))
    } finally {
      setDescargando(null)
    }
  }

  let resumen = 'Buscando tus resultados…'
  if (estudios && estudios.length > 0) {
    resumen = `Tenés ${plural(estudios.length, 'resultado', 'resultados')}. El más reciente es del ${formatearDiaCarga(
      estudios[0].fecha_carga,
    )}.`
  } else if (estudios) {
    resumen = 'Cuando el laboratorio cargue un resultado, lo vas a ver acá.'
  }

  return (
    <Panel titulo="Portal del paciente">
      <section className="bienvenida">
        <div>
          <h1>Hola, {usuario.nombre}</h1>
          <p className="apagado">{resumen}</p>
        </div>
      </section>

      {error && <p className="aviso-error" role="alert">No se pudieron cargar tus resultados: {error}.</p>}

      {estudios && estudios.length === 0 && (
        <div className="vacio-grande">
          <h2>Todavía no tenés resultados</h2>
          <p>Los resultados los sube tu bioquímico/a. Si te hiciste análisis hace poco, pueden tardar unos días.</p>
        </div>
      )}

      {estudios && estudios.length > 0 && (
        <section aria-labelledby="titulo-mis-resultados">
          <div className="barra-filtros">
            <h2 id="titulo-mis-resultados">Tus resultados</h2>
            {estudios.length > 4 && (
              <div className="buscador">
                <label htmlFor="buscar-mis-resultados" className="oculto-visual">Buscar un estudio</label>
                <input id="buscar-mis-resultados" type="search" placeholder="Buscar un estudio" value={texto}
                       onChange={(e) => setTexto(e.target.value)} />
              </div>
            )}
          </div>

          {visibles.length === 0 ? (
            <p className="sin-coincidencias">Ningún estudio coincide con «{texto.trim()}».</p>
          ) : (
            <ul className="resultados">
              {visibles.map((estudio) => {
                const tubo = tuboDeEstudio(estudio.descripcion)
                const clase = clasificarAntiguedad(estudio)
                return (
                  <li key={estudio.id} className={`resultado tapa-${tubo.clave}`}>
                    <div className="resultado-cuerpo">
                      <h3>{estudio.descripcion || 'Estudio de laboratorio'}</h3>
                      <p className="apagado">Cargado el {formatearFechaCarga(estudio.fecha_carga)}</p>
                      {RECIENTES.includes(clase) && <span className="insignia">{etiquetaAntiguedad(clase)}</span>}
                    </div>
                    <button type="button" className="boton grande" onClick={() => descargar(estudio)}
                            disabled={descargando === estudio.id}>
                      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
                        <path d="M9 2v9m0 0l-3.5-3.5M9 11l3.5-3.5M3 14.5h12" fill="none" stroke="currentColor"
                              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {descargando === estudio.id ? 'Descargando…' : 'Descargar PDF'}
                    </button>
                    {errores[estudio.id] && <p className="error resultado-error" role="alert">{errores[estudio.id]}</p>}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}
    </Panel>
  )
}
