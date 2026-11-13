import { useState } from 'react'
import { crearPaciente } from '../api/servicios.js'
import { nombreCompleto } from '../lib/datos.js'
import { generarPassword, textoCredenciales, validarPaciente } from '../lib/pacientes.js'

const ORDEN_CAMPOS = ['nombre', 'apellido', 'dni', 'email', 'password']

function datosVacios() {
  return { nombre: '', apellido: '', dni: '', email: '', fechaNacimiento: '', password: generarPassword() }
}

// Alta de paciente. Al terminar muestra los datos de acceso para pasárselos al paciente.
export default function NuevoPaciente({ onCreado, onSubirResultado, onCerrar }) {
  const [datos, setDatos] = useState(datosVacios)
  const [errores, setErrores] = useState({})
  const [errorApi, setErrorApi] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [creado, setCreado] = useState(null)
  const [copia, setCopia] = useState(null)

  const cambiar = (campo) => (evento) => setDatos((actuales) => ({ ...actuales, [campo]: evento.target.value }))

  async function enviar(evento) {
    evento.preventDefault()
    const problemas = validarPaciente(datos)
    setErrores(problemas)
    const primero = ORDEN_CAMPOS.find((campo) => problemas[campo])
    if (primero) {
      document.getElementById(`np-${primero}`)?.focus()
      return
    }
    setErrorApi(null)
    setEnviando(true)
    try {
      const paciente = await crearPaciente(datos)
      setCreado({ paciente, password: datos.password })
      onCreado(paciente)
    } catch (error) {
      setErrorApi(error.message)
    } finally {
      setEnviando(false)
    }
  }

  async function copiar() {
    const texto = textoCredenciales(creado.paciente, creado.password, window.location.origin)
    try {
      await navigator.clipboard.writeText(texto)
      setCopia('ok')
    } catch {
      setCopia('error')
    }
  }

  if (creado) {
    const { paciente, password } = creado
    return (
      <div className="credenciales">
        <div className="aviso-exito" role="status">
          <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true" focusable="false">
            <circle cx="14" cy="14" r="13" fill="currentColor" />
            <path d="M8 14.5l4 4 8-9" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <p className="aviso-titulo">{nombreCompleto(paciente)} ya tiene su cuenta</p>
            <p>Pasale estos datos para que entre a ver sus resultados. Guardalos ahora: la contraseña no se vuelve a mostrar.</p>
          </div>
        </div>
        <dl className="credenciales-datos">
          <div>
            <dt>Dirección</dt>
            <dd>{window.location.origin}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{paciente.email}</dd>
          </div>
          <div>
            <dt>Contraseña</dt>
            <dd className="credencial-clave">{password}</dd>
          </div>
        </dl>
        <button type="button" className="boton secundario ancho" onClick={copiar}>
          {copia === 'ok' ? 'Datos copiados' : 'Copiar datos de acceso'}
        </button>
        {copia === 'error' && (
          <p className="error" role="alert">No se pudo copiar. Seleccioná los datos y copialos a mano.</p>
        )}
        <div className="modal-pie">
          <button type="button" className="boton secundario" onClick={onCerrar}>Listo</button>
          <button type="button" className="boton" onClick={() => onSubirResultado(paciente.id)}>
            Subir su primer resultado
          </button>
        </div>
      </div>
    )
  }

  const descripcion = (campo) => (errores[campo] ? `np-${campo}-error` : undefined)

  return (
    <form className="formulario" onSubmit={enviar} noValidate>
      <div className="fila-campos">
        <div className="campo">
          <label htmlFor="np-nombre">Nombre</label>
          <input id="np-nombre" autoComplete="off" value={datos.nombre} onChange={cambiar('nombre')}
                 aria-invalid={errores.nombre ? 'true' : undefined} aria-describedby={descripcion('nombre')} />
          {errores.nombre && <p id="np-nombre-error" className="campo-error">{errores.nombre}</p>}
        </div>
        <div className="campo">
          <label htmlFor="np-apellido">Apellido</label>
          <input id="np-apellido" autoComplete="off" value={datos.apellido} onChange={cambiar('apellido')}
                 aria-invalid={errores.apellido ? 'true' : undefined} aria-describedby={descripcion('apellido')} />
          {errores.apellido && <p id="np-apellido-error" className="campo-error">{errores.apellido}</p>}
        </div>
      </div>

      <div className="fila-campos">
        <div className="campo">
          <label htmlFor="np-dni">DNI</label>
          <input id="np-dni" inputMode="numeric" autoComplete="off" placeholder="40123456" value={datos.dni}
                 onChange={cambiar('dni')} aria-invalid={errores.dni ? 'true' : undefined}
                 aria-describedby={descripcion('dni')} />
          {errores.dni && <p id="np-dni-error" className="campo-error">{errores.dni}</p>}
        </div>
        <div className="campo">
          <label htmlFor="np-nacimiento">Fecha de nacimiento <span className="opcional">(opcional)</span></label>
          <input id="np-nacimiento" type="date" value={datos.fechaNacimiento} onChange={cambiar('fechaNacimiento')} />
        </div>
      </div>

      <div className="campo">
        <label htmlFor="np-email">Email del paciente</label>
        <input id="np-email" type="email" autoComplete="off" placeholder="nombre@correo.com" value={datos.email}
               onChange={cambiar('email')} aria-invalid={errores.email ? 'true' : undefined}
               aria-describedby={errores.email ? 'np-email-error' : 'np-email-ayuda'} />
        {errores.email ? (
          <p id="np-email-error" className="campo-error">{errores.email}</p>
        ) : (
          <p id="np-email-ayuda" className="campo-ayuda">Es el usuario con el que va a entrar.</p>
        )}
      </div>

      <div className="campo">
        <label htmlFor="np-password">Contraseña inicial</label>
        <div className="con-boton">
          <input id="np-password" className="credencial-clave" autoComplete="off" value={datos.password}
                 onChange={cambiar('password')} aria-invalid={errores.password ? 'true' : undefined}
                 aria-describedby={errores.password ? 'np-password-error' : 'np-password-ayuda'} />
          <button type="button" className="boton secundario"
                  onClick={() => setDatos((actuales) => ({ ...actuales, password: generarPassword() }))}>
            Generar otra
          </button>
        </div>
        {errores.password ? (
          <p id="np-password-error" className="campo-error">{errores.password}</p>
        ) : (
          <p id="np-password-ayuda" className="campo-ayuda">La generamos por vos. Se la pasás al paciente al terminar.</p>
        )}
      </div>

      {errorApi && <p className="aviso-error" role="alert">{errorApi}</p>}

      <div className="modal-pie">
        <button type="button" className="boton secundario" onClick={onCerrar}>Cancelar</button>
        <button type="submit" className="boton" disabled={enviando}>
          {enviando ? 'Creando paciente…' : 'Crear paciente'}
        </button>
      </div>
    </form>
  )
}
