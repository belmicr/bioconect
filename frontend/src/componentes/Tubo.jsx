import { tuboDeEstudio } from '../lib/estudios.js'

// Un tubito con la tapa del color que corresponde al estudio (lila, gris, dorado...).
export default function Tubo({ descripcion, chico = false }) {
  const tubo = tuboDeEstudio(descripcion)
  const ancho = chico ? 10 : 14
  const alto = chico ? 18 : 26
  return (
    <span className={`tubo tapa-${tubo.clave}`} title={tubo.nombre}>
      <svg width={ancho} height={alto} viewBox="0 0 14 26" aria-hidden="true" focusable="false">
        <rect x="0.5" y="0.5" width="13" height="5.5" rx="1.6" fill="currentColor" />
        <path d="M2 6h10v13.5a5 5 0 0 1-10 0z" fill="#ffffff" stroke="#c3d2cc" />
        <path d="M2.6 13h8.8v6.5a4.4 4.4 0 0 1-8.8 0z" fill="currentColor" fillOpacity="0.35" />
      </svg>
    </span>
  )
}
