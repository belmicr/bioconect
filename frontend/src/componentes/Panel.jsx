import { useAuth } from '../auth/AuthContext.jsx'
import { iniciales } from '../lib/pacientes.js'
import Logo from './Logo.jsx'

// El marco de los dos portales: la barra con la marca, quién está conectado y cerrar sesión.
export default function Panel({ titulo, children }) {
  const { usuario, cerrarSesion } = useAuth()

  return (
    <div className="portal">
      <header className="cabecera">
        <div className="cabecera-interior">
          <div className="marca">
            <Logo tamanio={38} />
            <div className="marca-textos">
              <span className="marca-nombre">BioConect</span>
              <span className="marca-portal">{titulo}</span>
            </div>
          </div>
          <div className="cabecera-usuario">
            <span className="avatar chico" aria-hidden="true">{iniciales(usuario)}</span>
            <span className="cabecera-nombre">{usuario.nombre} {usuario.apellido}</span>
            <button type="button" className="boton fantasma" onClick={cerrarSesion}>Cerrar sesión</button>
          </div>
        </div>
      </header>
      <main className="portal-cuerpo">{children}</main>
    </div>
  )
}
