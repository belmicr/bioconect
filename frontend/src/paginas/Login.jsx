import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import Gradilla from '../componentes/Gradilla.jsx'
import Logo from '../componentes/Logo.jsx'
import { validarCredenciales } from '../lib/validaciones.js'

// Las dos pestañas cambian solo la ayuda. A qué portal entra cada persona lo decide
// el backend con el rol de su cuenta, no la pestaña que tocó.
const PERFILES = [
  {
    id: 'paciente',
    pestania: 'Soy paciente',
    titulo: 'Ingresá para ver tus resultados',
    ayuda: 'Usá el email y la contraseña que te dio el laboratorio.',
  },
  {
    id: 'bioquimico',
    pestania: 'Soy bioquímico/a',
    titulo: 'Ingresá a tu laboratorio',
    ayuda: 'Con tu cuenta profesional cargás pacientes y subís sus resultados.',
  },
]

export default function Login() {
  const { usuario, iniciarSesion } = useAuth()
  const navegar = useNavigate()
  const [perfil, setPerfil] = useState('paciente')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [verPassword, setVerPassword] = useState(false)
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  if (usuario) return <Navigate to="/" replace />

  const actual = PERFILES.find((p) => p.id === perfil)

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

  function moverseEntrePestanias(evento) {
    if (evento.key !== 'ArrowRight' && evento.key !== 'ArrowLeft') return
    const siguiente = perfil === 'paciente' ? 'bioquimico' : 'paciente'
    setPerfil(siguiente)
    document.getElementById(`pestania-${siguiente}`)?.focus()
  }

  return (
    <div className="login">
      <aside className="login-marca">
        <div className="marca marca-clara">
          <Logo tamanio={48} />
          <span className="marca-nombre">BioConect</span>
        </div>
        <div className="login-mensaje">
          <p className="login-titular">Tus análisis clínicos, listos para descargar.</p>
          <p>El laboratorio sube cada resultado en PDF y lo ves desde tu casa, sin ir a buscarlo.</p>
        </div>
        <Gradilla />
      </aside>

      <main className="login-formulario">
        <div className="login-caja">
          <div className="segmentos" role="tablist" aria-label="Tipo de cuenta" onKeyDown={moverseEntrePestanias}>
            {PERFILES.map((p) => (
              <button key={p.id} id={`pestania-${p.id}`} type="button" role="tab" aria-selected={perfil === p.id}
                      aria-controls="formulario-ingreso" tabIndex={perfil === p.id ? 0 : -1}
                      className={perfil === p.id ? 'segmento activo' : 'segmento'}
                      onClick={() => setPerfil(p.id)}>
                {p.pestania}
              </button>
            ))}
          </div>

          <form id="formulario-ingreso" role="tabpanel" aria-labelledby={`pestania-${perfil}`}
                className="formulario" onSubmit={enviar} noValidate>
            <div className="login-encabezado">
              <h1>{actual.titulo}</h1>
              <p className="apagado">{actual.ayuda}</p>
            </div>
            <div className="campo">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" autoComplete="username" placeholder="nombre@correo.com" value={email}
                     onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="campo">
              <label htmlFor="password">Contraseña</label>
              <div className="con-boton">
                <input id="password" type={verPassword ? 'text' : 'password'} autoComplete="current-password"
                       value={password} onChange={(e) => setPassword(e.target.value)} />
                <button type="button" className="boton secundario" aria-pressed={verPassword} aria-controls="password"
                        onClick={() => setVerPassword((v) => !v)}>
                  {verPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>
            {error && <p className="aviso-error" role="alert">{error}</p>}
            <button className="boton ancho grande" type="submit" disabled={enviando}>
              {enviando ? 'Ingresando…' : 'Ingresar'}
            </button>
            {perfil === 'paciente' && (
              <p className="login-nota apagado">¿No tenés tus datos de acceso? Pedíselos al laboratorio donde te hiciste los análisis.</p>
            )}
          </form>
        </div>
      </main>
    </div>
  )
}
