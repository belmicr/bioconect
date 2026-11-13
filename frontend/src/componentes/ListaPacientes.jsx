import { useState } from 'react'
import { nombreCompleto } from '../lib/datos.js'
import { formatearDiaCarga } from '../lib/fechas.js'
import { buscarPacientes, formatearDni, iniciales } from '../lib/pacientes.js'
import { plural } from '../lib/texto.js'

export default function ListaPacientes({ pacientes, resumen, onNuevo, onSubir, onVer }) {
  const [texto, setTexto] = useState('')

  if (pacientes.length === 0) {
    return (
      <div className="vacio-grande">
        <h2>Todavía no tenés pacientes</h2>
        <p>Creá el primero con su nombre, DNI y email. La app le arma una contraseña para que entre a ver sus resultados.</p>
        <button type="button" className="boton" onClick={onNuevo}>Nuevo paciente</button>
      </div>
    )
  }

  const visibles = buscarPacientes(pacientes, texto)

  return (
    <section aria-labelledby="titulo-pacientes">
      <h2 id="titulo-pacientes" className="oculto-visual">Tus pacientes</h2>
      <div className="barra-filtros">
        <div className="buscador">
          <label htmlFor="buscar-paciente" className="oculto-visual">Buscar paciente</label>
          <input id="buscar-paciente" type="search" placeholder="Buscar por nombre, DNI o email" value={texto}
                 onChange={(evento) => setTexto(evento.target.value)} />
        </div>
      </div>

      {visibles.length === 0 ? (
        <p className="sin-coincidencias">Ningún paciente coincide con «{texto.trim()}».</p>
      ) : (
        <ul className="lista-pacientes">
          {visibles.map((p) => {
            const datos = resumen[p.id]
            const nombre = nombreCompleto(p)
            return (
              <li key={p.id} className="fila-paciente">
                <span className="avatar" aria-hidden="true">{iniciales(p)}</span>
                <div className="fila-principal">
                  <span className="fila-nombre">{nombre}</span>
                  <span className="apagado">{p.email}</span>
                </div>
                <div className="fila-dato">
                  <span className="dato-nombre">DNI</span>
                  <span>{formatearDni(p.dni) || 'Sin cargar'}</span>
                </div>
                <div className="fila-dato">
                  <span className="dato-nombre">Resultados</span>
                  {datos ? (
                    <span>
                      {plural(datos.cantidad, 'resultado', 'resultados')}
                      <span className="apagado">, el último del {formatearDiaCarga(datos.ultima)}</span>
                    </span>
                  ) : (
                    <span className="apagado">Ninguno todavía</span>
                  )}
                </div>
                <div className="fila-acciones">
                  <button type="button" className="boton chico" aria-label={`Subir resultado para ${nombre}`}
                          onClick={() => onSubir(p.id)}>
                    Subir resultado
                  </button>
                  {datos && (
                    <button type="button" className="boton chico secundario" aria-label={`Ver resultados de ${nombre}`}
                            onClick={() => onVer(p.id)}>
                      Ver resultados
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
