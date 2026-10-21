import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthContext.jsx'
import Login from './paginas/Login.jsx'
import PanelBioquimico from './paginas/PanelBioquimico.jsx'
import PanelPaciente from './paginas/PanelPaciente.jsx'

function Protegida({ rol, children }) {
  const { usuario, cargando } = useAuth()
  if (cargando) return <p className="centrado">Cargando…</p>
  if (!usuario) return <Navigate to="/login" replace />
  if (usuario.rol !== rol) return <Navigate to="/" replace />
  return children
}

function Inicio() {
  const { usuario, cargando } = useAuth()
  if (cargando) return <p className="centrado">Cargando…</p>
  if (!usuario) return <Navigate to="/login" replace />
  return <Navigate to={usuario.rol === 'bioquimico' ? '/bioquimico' : '/paciente'} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Inicio />} />
      <Route path="/login" element={<Login />} />
      <Route path="/paciente" element={<Protegida rol="paciente"><PanelPaciente /></Protegida>} />
      <Route path="/bioquimico" element={<Protegida rol="bioquimico"><PanelBioquimico /></Protegida>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}