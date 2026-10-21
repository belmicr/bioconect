import { useState } from 'react'
import CargarEstudio from './CargarEstudio.jsx'
import Estudios from './Estudios.jsx'

export default function EstudiosBioquimico({ pacientes }) {
  const [version, setVersion] = useState(0)
  return (
    <>
      <CargarEstudio pacientes={pacientes} onCargado={() => setVersion((v) => v + 1)} />
      <Estudios rol="bioquimico" pacientes={pacientes} version={version} />
    </>
  )
}