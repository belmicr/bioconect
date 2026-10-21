import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import { validarCredenciales } from '../lib/validaciones.js'

export default function Login() {
  const { usuario, iniciarSesion } = useAuth()
  const navegar = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  if (usuario) return <Navigate to="/" replace />

  async function enviar(evento) {
    evento.preventDefault()
    const problema = validarCredenciales(email, password)
    if (problema) {
      setError(problema)
      return
    }
    setError(null)
    setEnviando(true)
    try {
      await iniciarSesion(email.trim(), password)
      navegar('/', { replace: true })
    } catch (e) {
      setError(e.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="login">
      <form className="tarjeta formulario" onSubmit={enviar} noValidate>
        <h1>BioConect</h1>
        <p className="subtitulo">Resultados de laboratorio, en un solo lugar</p>
        <div className="campo">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="username" value={email}
                 onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="password">Contraseña</label>
          <input id="password" type="password" autoComplete="current-password" value={password}
                 onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="boton" type="submit" disabled={enviando}>
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </div>
  )
}