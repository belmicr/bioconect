import { useState } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'

export default function Panel({ titulo, pestanias }) {
  const { usuario, cerrarSesion } = useAuth()
  const [activa, setActiva] = useState(pestanias[0].id)
  const actual = pestanias.find((p) => p.id === activa) ?? pestanias[0]

  return (
    <div className="app">
      <header className="barra">
        <div>
          <strong>BioConect</strong>
          <span className="subtitulo">{titulo}</span>
        </div>
        <div className="barra-usuario">
          <span>{usuario.nombre} {usuario.apellido}</span>
          <button className="boton secundario" onClick={cerrarSesion}>Cerrar sesión</button>
        </div>
      </header>
      <nav className="pestanias" role="tablist">
        {pestanias.map((p) => (
          <button key={p.id} role="tab" aria-selected={p.id === actual.id}
                  className={p.id === actual.id ? 'pestania activa' : 'pestania'}
                  onClick={() => setActiva(p.id)}>
            {p.titulo}
          </button>
        ))}
      </nav>
      <main className="contenido">{actual.contenido}</main>
    </div>
  )
}