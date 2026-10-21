import Estudios from '../componentes/Estudios.jsx'
import Panel from '../componentes/Panel.jsx'

export default function PanelPaciente() {
  return (
    <Panel
      titulo="Portal del paciente"
      pestanias={[{ id: 'estudios', titulo: 'Mis estudios', contenido: <Estudios rol="paciente" /> }]}
    />
  )
}