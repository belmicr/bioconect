import { useCallback, useEffect, useMemo, useState } from 'react'
import { cargarEstudios, cargarPacientes } from '../api/servicios.js'
import { useAuth } from '../auth/AuthContext.jsx'
import ListaPacientes from '../componentes/ListaPacientes.jsx'
import ListaResultados from '../componentes/ListaResultados.jsx'
import Modal from '../componentes/Modal.jsx'
import NuevoPaciente from '../componentes/NuevoPaciente.jsx'
import Panel from '../componentes/Panel.jsx'
import SubirResultado from '../componentes/SubirResultado.jsx'
import { estudiosParaRevisar } from '../lib/antiguedad.js'
import { fraseResumen, ordenarPorApellido, resumirPorPaciente } from '../lib/pacientes.js'

export default function PanelBioquimico() {
  const { usuario } = useAuth()
  const [pacientes, setPacientes] = useState(null)
  const [estudios, setEstudios] = useState(null)
  const [error, setError] = useState(null)
  const [pestania, setPestania] = useState('pacientes')
  const [filtroPaciente, setFiltroPaciente] = useState('')
  const [modal, setModal] = useState(null)

  useEffect(() => {
    let activo = true
    Promise.all([cargarPacientes(), cargarEstudios()])
      .then(([listaPacientes, listaEstudios]) => {
        if (!activo) return
        setPacientes(listaPacientes)
        setEstudios(listaEstudios)
      })
      .catch((e) => {
        if (activo) setError(e.message)
      })
    return () => {
      activo = false
    }
  }, [])

  const resumen = useMemo(() => resumirPorPaciente(estudios ?? []), [estudios])
  const recientes = useMemo(() => estudiosParaRevisar(estudios ?? []).length, [estudios])
  const cerrarModal = useCallback(() => setModal(null), [])

  const abrirNuevoPaciente = () => setModal({ tipo: 'paciente' })
  const abrirSubir = (pacienteId) => setModal({ tipo: 'resultado', pacienteId })

  function verResultados(pacienteId) {
    setFiltroPaciente(String(pacienteId))
    setPestania('resultados')
  }

  // Lo que se crea se agrega a la lista al instante: no hace falta volver a pedir todo.
  const alCrearPaciente = (paciente) => setPacientes((actuales) => ordenarPorApellido([...actuales, paciente]))
  const alSubirResultado = (estudio) => setEstudios((actuales) => [estudio, ...actuales])

  const cargado = pacientes !== null && estudios !== null
  const pestanias = [
    { id: 'pacientes', titulo: 'Pacientes', cantidad: pacientes?.length },
    { id: 'resultados', titulo: 'Resultados', cantidad: estudios?.length },
  ]

  return (
    <Panel titulo="Portal del bioquímico">
      <section className="bienvenida">
        <div>
          <h1>Hola, {usuario.nombre}</h1>
          <p className="apagado">
            {cargado ? fraseResumen(pacientes.length, estudios.length, recientes) : 'Cargando tus pacientes…'}
          </p>
        </div>
        <div className="bienvenida-acciones">
          <button type="button" className="boton secundario" onClick={() => abrirSubir('')} disabled={!cargado}>
            Subir resultado
          </button>
          <button type="button" className="boton" onClick={abrirNuevoPaciente} disabled={!cargado}>
            Nuevo paciente
          </button>
        </div>
      </section>

      {error && (
        <div className="aviso-error" role="alert">
          No se pudieron cargar tus datos: {error}.{' '}
          <button type="button" className="enlace" onClick={() => window.location.reload()}>Volver a intentar</button>
        </div>
      )}

      {cargado && (
        <>
          <div className="pestanias" role="tablist" aria-label="Secciones del portal">
            {pestanias.map((p) => (
              <button key={p.id} id={`tab-${p.id}`} type="button" role="tab" aria-selected={pestania === p.id}
                      aria-controls={`panel-${p.id}`} className={pestania === p.id ? 'pestania activa' : 'pestania'}
                      onClick={() => setPestania(p.id)}>
                {p.titulo}
                <span className="contador">{p.cantidad}</span>
              </button>
            ))}
          </div>

          <div id={`panel-${pestania}`} role="tabpanel" aria-labelledby={`tab-${pestania}`} className="panel-pestania">
            {pestania === 'pacientes' ? (
              <ListaPacientes pacientes={pacientes} resumen={resumen} onNuevo={abrirNuevoPaciente}
                              onSubir={abrirSubir} onVer={verResultados} />
            ) : (
              <ListaResultados estudios={estudios} pacientes={pacientes} pacienteId={filtroPaciente}
                               onCambiarPaciente={setFiltroPaciente} onSubir={abrirSubir} />
            )}
          </div>
        </>
      )}

      {modal?.tipo === 'paciente' && (
        <Modal titulo="Nuevo paciente" onCerrar={cerrarModal}>
          <NuevoPaciente onCreado={alCrearPaciente} onCerrar={cerrarModal}
                         onSubirResultado={(pacienteId) => setModal({ tipo: 'resultado', pacienteId })} />
        </Modal>
      )}
      {modal?.tipo === 'resultado' && (
        <Modal titulo="Subir resultado" onCerrar={cerrarModal}>
          <SubirResultado pacientes={pacientes} pacienteInicial={modal.pacienteId} onSubido={alSubirResultado}
                          onNuevoPaciente={abrirNuevoPaciente} onCerrar={cerrarModal} />
        </Modal>
      )}
    </Panel>
  )
}
