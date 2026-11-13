// Ilustración del login: una gradilla con un tubo de cada color de tapa que usa la app.
const TUBOS = [
  { x: 34, tapa: '#a786de', liquido: '#e4d7fa', nivel: 70 },
  { x: 92, tapa: '#57aee0', liquido: '#d4ecf8', nivel: 48 },
  { x: 150, tapa: '#aab4b9', liquido: '#e6eaec', nivel: 84 },
  { x: 208, tapa: '#e2b53a', liquido: '#f7eac4', nivel: 58 },
  { x: 266, tapa: '#ef9f3c', liquido: '#fbe3c3', nivel: 76 },
]

const ARRIBA = 34
const FONDO = 142

export default function Gradilla() {
  return (
    <svg className="gradilla" viewBox="0 0 320 190" aria-hidden="true" focusable="false">
      <rect x="10" y="58" width="300" height="12" rx="3" fill="#07493f" />
      {TUBOS.map((t) => {
        const tope = FONDO - t.nivel
        return (
          <g key={t.x}>
            <path d={`M${t.x} ${ARRIBA}h30v${FONDO - ARRIBA}a15 15 0 0 1-30 0z`} fill="#ffffff" fillOpacity="0.94" />
            <path d={`M${t.x} ${tope}h30v${FONDO - tope}a15 15 0 0 1-30 0z`} fill={t.liquido} />
            <rect x={t.x - 3} y="20" width="36" height="16" rx="4" fill={t.tapa} />
          </g>
        )
      })}
      <rect x="10" y="126" width="300" height="18" rx="4" fill="#05362f" />
      <rect x="20" y="144" width="10" height="30" rx="2" fill="#05362f" />
      <rect x="290" y="144" width="10" height="30" rx="2" fill="#05362f" />
      <rect x="4" y="172" width="312" height="8" rx="4" fill="#05362f" />
    </svg>
  )
}
