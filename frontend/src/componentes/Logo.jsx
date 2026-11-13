// La marca: un tubo de ensayo con tapa lila que "transmite" el resultado.
// Es decorativa: el nombre "BioConect" siempre va escrito al lado.
export default function Logo({ tamanio = 40 }) {
  return (
    <svg width={tamanio} height={tamanio} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <rect width="48" height="48" rx="13" fill="#0b6e5f" />
      <g transform="rotate(-22 20 27)">
        <rect x="12.5" y="6.5" width="15" height="6.5" rx="2.4" fill="#c9b4f2" />
        <path d="M14 13h12v21a6 6 0 0 1-12 0z" fill="#ffffff" />
        <path d="M14 24.5h12v9.5a6 6 0 0 1-12 0z" fill="#8a63c9" />
      </g>
      <path d="M32.2 13.4a7.5 7.5 0 0 1 5 5" fill="none" stroke="#ffffff" strokeWidth="2.8" strokeLinecap="round" />
      <path d="M33.6 7.6a13.5 13.5 0 0 1 9 9" fill="none" stroke="#9fe0cd" strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  )
}
