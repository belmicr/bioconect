import { describe, expect, it } from 'vitest'
import {
  LARGO_MAXIMO_MENSAJE,
  LARGO_MINIMO_PASSWORD,
  esPdf,
  validarCredenciales,
  validarEmail,
  validarMensaje,
  validarPassword,
} from './validaciones.js'

describe('validarEmail', () => {
  it.each([
    ['vacío', ''],
    ['solo espacios', '   '],
    ['nulo', null],
  ])('rechaza un email %s', (_caso, entrada) => {
    expect(validarEmail(entrada)).toBe('El email es obligatorio.')
  })

  it.each(['sin-arroba', 'a@b', 'a b@c.com'])('rechaza el formato inválido %s', (entrada) => {
    expect(validarEmail(entrada)).toBe('El email no tiene un formato válido.')
  })

  it('acepta un email válido aunque tenga espacios alrededor', () => {
    expect(validarEmail('  ana@lab.com ')).toBeNull()
  })
})

describe('validarPassword', () => {
  it.each([[''], [null], [undefined]])('rechaza la contraseña %s', (entrada) => {
    expect(validarPassword(entrada)).toBe('La contraseña es obligatoria.')
  })

  it('rechaza una contraseña corta y dice el mínimo', () => {
    expect(validarPassword('12345')).toContain(String(LARGO_MINIMO_PASSWORD))
  })

  it('acepta una contraseña del largo mínimo', () => {
    expect(validarPassword('123456')).toBeNull()
  })
})

describe('validarCredenciales', () => {
  it('informa primero el error del email', () => {
    expect(validarCredenciales('', '')).toBe('El email es obligatorio.')
  })

  it('informa el error de la contraseña cuando el email es válido', () => {
    expect(validarCredenciales('ana@lab.com', '123')).toContain('contraseña')
  })

  it('devuelve null si todo es válido', () => {
    expect(validarCredenciales('ana@lab.com', '123456')).toBeNull()
  })
})

describe('validarMensaje', () => {
  it.each([[''], ['   '], [null]])('rechaza un mensaje vacío %s', (entrada) => {
    expect(validarMensaje(entrada)).toBe('El mensaje está vacío.')
  })

  it('rechaza un mensaje que supera el largo máximo y dice el límite', () => {
    const texto = 'a'.repeat(LARGO_MAXIMO_MENSAJE + 1)

    expect(validarMensaje(texto)).toContain(String(LARGO_MAXIMO_MENSAJE))
  })

  it('acepta un mensaje justo en el largo máximo', () => {
    expect(validarMensaje('a'.repeat(LARGO_MAXIMO_MENSAJE))).toBeNull()
  })
})

describe('esPdf', () => {
  it('acepta un archivo PDF', () => {
    expect(esPdf({ type: 'application/pdf' })).toBe(true)
  })

  it.each([[{ type: 'image/png' }], [null], [undefined]])('rechaza %o', (entrada) => {
    expect(esPdf(entrada)).toBe(false)
  })
})