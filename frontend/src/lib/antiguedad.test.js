import { describe, expect, it } from 'vitest'
import {
  clasificarAntiguedad,
  estudiosParaRevisar,
  etiquetaAntiguedad,
  resumirAntiguedad,
} from './antiguedad.js'

const AHORA = new Date('2026-10-21T12:00:00Z')

describe('clasificarAntiguedad', () => {
  it.each([
    ['sin estudio', null, 'sin-fecha'],
    ['sin fecha de carga', {}, 'sin-fecha'],
    ['fecha en el futuro', { fecha_carga: '2026-10-22T12:00:00' }, 'futuro'],
    ['cargado hoy', { fecha_carga: '2026-10-21T06:00:00' }, 'nuevo'],
    ['cargado esta semana', { fecha_carga: '2026-10-18T12:00:00' }, 'esta-semana'],
    ['cargado este mes', { fecha_carga: '2026-10-01T12:00:00' }, 'este-mes'],
    ['cargado este año', { fecha_carga: '2026-03-01T12:00:00' }, 'este-anio'],
    ['cargado hace más de un año', { fecha_carga: '2024-01-01T12:00:00' }, 'antiguo'],
  ])('%s', (_caso, estudio, esperado) => {
    expect(clasificarAntiguedad(estudio, AHORA)).toBe(esperado)
  })

  it('respeta una fecha que ya trae zona horaria', () => {
    const estudio = { fecha_carga: '2026-10-21T06:00:00Z' }

    expect(clasificarAntiguedad(estudio, AHORA)).toBe('nuevo')
  })
})

describe('resumirAntiguedad', () => {
    it('cuenta los estudios por clase', () => {
    const estudios = [
      { fecha_carga: '2026-10-21T06:00:00' },
      { fecha_carga: '2026-10-21T01:00:00' },
      { fecha_carga: '2024-01-01T12:00:00' },
    ]

    const resumen = resumirAntiguedad(estudios, AHORA)

    expect(resumen.nuevo).toBe(2)
    expect(resumen.antiguo).toBe(1)
  })

  it('agrupa en "otros" lo que no tiene fecha', () => {
    expect(resumirAntiguedad([{}], AHORA).otros).toBe(1)
  })
})

describe('etiquetaAntiguedad', () => {
  it.each([
    ['nuevo', 'Cargado hoy'],
    ['esta-semana', 'Cargado esta semana'],
    ['este-mes', 'Cargado este mes'],
    ['este-anio', 'Cargado este año'],
    ['antiguo', 'Estudio antiguo'],
    ['futuro', 'Fecha inválida'],
    ['sin-fecha', 'Sin fecha'],
  ])('traduce %s', (clase, esperada) => {
    expect(etiquetaAntiguedad(clase)).toBe(esperada)
  })
})

describe('estudiosParaRevisar', () => {
  it('deja solo los cargados hoy o esta semana', () => {
    const estudios = [
      { id: 1, fecha_carga: '2026-10-21T06:00:00' },
      { id: 2, fecha_carga: '2026-10-18T12:00:00' },
      { id: 3, fecha_carga: '2024-01-01T12:00:00' },
    ]

    expect(estudiosParaRevisar(estudios, AHORA).map((e) => e.id)).toEqual([1, 2])
  })
})