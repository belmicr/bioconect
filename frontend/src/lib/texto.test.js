import { describe, expect, it } from 'vitest'
import { aSlug, plural, sinTildes } from './texto.js'

describe('sinTildes', () => {
  it('saca tildes y pasa a minúsculas', () => {
    expect(sinTildes('Gómez Pérez Ñandú')).toBe('gomez perez nandu')
  })

  it.each([[null], [undefined]])('con %s devuelve texto vacío', (entrada) => {
    expect(sinTildes(entrada)).toBe('')
  })
})

describe('plural', () => {
  it.each([
    [0, '0 pacientes'],
    [1, '1 paciente'],
    [2, '2 pacientes'],
  ])('%i', (cantidad, esperado) => {
    expect(plural(cantidad, 'paciente', 'pacientes')).toBe(esperado)
  })
})

describe('aSlug', () => {
  it('arma un nombre de archivo sin tildes, espacios ni símbolos', () => {
    expect(aSlug('  Perfil lipídico · Gómez  ')).toBe('perfil-lipidico-gomez')
  })
})
