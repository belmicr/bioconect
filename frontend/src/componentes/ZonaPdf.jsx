import { useState } from 'react'
import { formatearTamanio } from '../lib/estudios.js'

// Zona para soltar el PDF arrastrándolo, o hacer clic y elegirlo del explorador de archivos.
export default function ZonaPdf({ id, archivo, error, onElegir }) {
  const [encima, setEncima] = useState(false)

  function soltar(evento) {
    evento.preventDefault()
    setEncima(false)
    const elegido = evento.dataTransfer.files?.[0]
    if (elegido) onElegir(elegido)
  }

  const clases = ['zona-pdf', encima && 'encima', archivo && 'con-archivo', error && 'con-error']
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={clases}
      onDragOver={(evento) => {
        evento.preventDefault()
        setEncima(true)
      }}
      onDragLeave={() => setEncima(false)}
      onDrop={soltar}
    >
      <input
        id={id}
        type="file"
        accept="application/pdf,.pdf"
        className="oculto-visual"
        aria-labelledby={`${id}-titulo`}
        aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={error ? 'true' : undefined}
        onChange={(evento) => onElegir(evento.target.files?.[0] ?? null)}
      />
      <label htmlFor={id} className="zona-pdf-etiqueta">
        <svg className="zona-pdf-icono" width="36" height="44" viewBox="0 0 36 44" aria-hidden="true" focusable="false">
          <path d="M3 1h21l11 11v29a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2z" fill="#fff" stroke="currentColor" strokeWidth="2" />
          <path d="M24 1v11h11" fill="none" stroke="currentColor" strokeWidth="2" />
          <text x="18" y="33" textAnchor="middle" fontSize="10" fontWeight="700" fill="currentColor">PDF</text>
        </svg>
        {archivo ? (
          <span className="zona-pdf-texto">
            <span className="zona-pdf-titulo">{archivo.name}</span>
            <span className="apagado">{formatearTamanio(archivo.size)}. Hacé clic para cambiarlo.</span>
          </span>
        ) : (
          <span className="zona-pdf-texto">
            <span className="zona-pdf-titulo">Arrastrá el PDF acá</span>
            <span className="apagado">o hacé clic para elegirlo de tu computadora. Hasta 10 MB.</span>
          </span>
        )}
      </label>
    </div>
  )
}
