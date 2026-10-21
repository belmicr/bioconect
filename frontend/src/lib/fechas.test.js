import { describe, expect, it } from 'vitest'
import {
  diaISO,
  esDiaHabil,
  formatearFechaCarga,
  formatearFechaHora,
  horaDe,
  interpretarComoUtc,
  proximosDiasHabiles,
} from './fechas.js'

describe('interpretarComoUtc', () => {
  it('trata como UTC una fecha sin zona (como la manda el backend)', () => {
    expect(interpretarComoUtc('2026-10-21T00:46:42').toISOString()).toBe('2026-10-21T00:46:42.000Z')
  })

  it('respeta una fecha que ya trae Z', () => {
    expect(interpretarComoUtc('2026-10-21T00:46:42Z').toISOString()).toBe('2026-10-21T00:46:42.000Z')
  })

  it('respeta una fecha con desplazamiento horario', () => {
    expect(interpretarComoUtc('2026-10-21T00:46:42+03:00').toISOString()).toBe('2026-10-20T21:46:42.000Z')
  })
})

describe('formatos de fecha', () => {
  it('devuelven vacío si no hay fecha', () => {
    expect(formatearFechaCarga('')).toBe('')
    expect(formatearFechaHora(null)).toBe('')
  })

  it('incluyen el año de la fecha', () => {
    expect(formatearFechaCarga('2026-10-21T00:46:42')).toContain('2026')
    expect(formatearFechaHora('2026-10-22T10:00:00')).toContain('2026')
  })

  it('horaDe devuelve la hora local de un turno', () => {
    expect(horaDe('2026-10-22T10:00:00')).toMatch(/10.00/)
  })
})

describe('diaISO', () => {
  it('completa con ceros el mes y el día', () => {
    expect(diaISO(new Date(2026, 9, 5))).toBe('2026-10-05')
  })
})

describe('esDiaHabil', () => {
  it.each([
    ['jueves', new Date(2026, 9, 22), true],
    ['sábado', new Date(2026, 9, 24), false],
    ['domingo', new Date(2026, 9, 25), false],
  ])('%s', (_dia, fecha, esperado) => {
    expect(esDiaHabil(fecha)).toBe(esperado)
  })
})

describe('proximosDiasHabiles', () => {
  it('saltea el fin de semana y empieza al día siguiente', () => {
    const viernes = new Date(2026, 9, 23)

    const dias = proximosDiasHabiles(viernes, 3).map(diaISO)

    expect(dias).toEqual(['2026-10-26', '2026-10-27', '2026-10-28'])
  })
})