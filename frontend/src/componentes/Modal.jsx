import { useEffect, useRef } from 'react'

const ENFOCABLES = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])'

// Ventana sobre la pantalla para los formularios. Se cierra con Escape o con la cruz,
// el foco queda adentro mientras está abierta y vuelve al botón que la abrió al cerrarla.
export default function Modal({ titulo, onCerrar, children }) {
  const panel = useRef(null)
  const cerrar = useRef(onCerrar)

  useEffect(() => {
    cerrar.current = onCerrar
  })

  useEffect(() => {
    const anterior = document.activeElement
    const primerCampo = panel.current.querySelector('input:not([type="file"]), select, textarea')
    if (primerCampo) primerCampo.focus()
    else panel.current.focus()

    function alTeclear(evento) {
      if (evento.key === 'Escape') {
        cerrar.current()
        return
      }
      if (evento.key !== 'Tab') return
      const enfocables = [...panel.current.querySelectorAll(ENFOCABLES)]
      if (enfocables.length === 0) return
      const primero = enfocables[0]
      const ultimo = enfocables[enfocables.length - 1]
      if (evento.shiftKey && document.activeElement === primero) {
        evento.preventDefault()
        ultimo.focus()
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault()
        primero.focus()
      }
    }

    document.addEventListener('keydown', alTeclear)
    document.body.classList.add('con-modal')
    return () => {
      document.removeEventListener('keydown', alTeclear)
      document.body.classList.remove('con-modal')
      if (anterior && anterior.focus) anterior.focus()
    }
  }, [])

  return (
    <div className="modal-fondo">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-titulo" ref={panel} tabIndex={-1}>
        <div className="modal-cabecera">
          <h2 id="modal-titulo">{titulo}</h2>
          <button type="button" className="boton-icono" aria-label="Cerrar ventana" onClick={() => cerrar.current()}>
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="modal-cuerpo">{children}</div>
      </div>
    </div>
  )
}
