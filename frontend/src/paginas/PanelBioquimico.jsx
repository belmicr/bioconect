import { useEffect, useState } from 'react'
import { traerJson } from '../api/cliente.js'
import EstudiosBioquimico from '../componentes/EstudiosBioquimico.jsx'
import Panel from '../componentes/Panel.jsx'

export default function PanelBioquimico() {
  const [pacientes, setPacientes] = useState([])

  useEffect(() => {
    traerJson('/pacientes').then(setPacientes).catch(() => setPacientes([]))
  }, [])

  return (
    <Panel
      titulo="Portal del bioquímico"
      pestanias={[
        { id: 'estudios', titulo: 'Estudios', contenido: <EstudiosBioquimico pacientes={pacientes} /> },
      ]}
    />
  )
}