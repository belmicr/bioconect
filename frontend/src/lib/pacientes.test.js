import { describe, expect, it } from 'vitest'
import {
  CARACTERES_PASSWORD,
  aleatorioSeguro,
  buscarPacientes,
  formatearDni,
  fraseResumen,
  generarPassword,
  iniciales,
  normalizarDni,
  ordenarPorApellido,
  resumirPorPaciente,
  textoCredenciales,
  validarPaciente,
} from './pacientes.js'

const JUAN = { id: 2, nombre: 'Juan', apellido: 'Gómez', dni: '40123456', email: 'juan@mail.com' }
const LIA = { id: 3, nombre: 'Lía', apellido: 'Acosta', dni: '38999111', email: 'lia@mail.com' }
const SIN_DNI = { id: 4, nombre: 'Rita', apellido: 'Zárate', dni: null, email: 'rita@mail.com' }

describe('generarPassword', () => {
  it('con un azar fijo da siempre la misma contraseña y del largo pedido', () => {
    const siempreElPrimero = () => 0

    expect(generarPassword(siempreElPrimero, 8)).toBe('aaaaaaaa')
  })

  it('usa solo caracteres que no se confunden', () => {
    const casiUno = () => 0.9999

    expect(generarPassword(casiUno, 3)).toBe('999')
  })

  it('por defecto genera 10 caracteres válidos con el azar seguro', () => {
    const password = generarPassword()

    expect(password).toHaveLength(10)
    expect([...password].every((c) => CARACTERES_PASSWORD.includes(c))).toBe(true)
  })

  it('el azar seguro está entre 0 y 1', () => {
    const valor = aleatorioSeguro()

    expect(valor).toBeGreaterThanOrEqual(0)
    expect(valor).toBeLessThan(1)
  })
})

describe('DNI', () => {
  it.each([
    ['40.123.456', '40123456'],
    [' 40 123-456 ', '40123456'],
    [null, ''],
  ])('normaliza %s', (entrada, esperado) => {
    expect(normalizarDni(entrada)).toBe(esperado)
  })

  it.each([
    ['40123456', '40.123.456'],
    ['7123456', '7.123.456'],
    ['', ''],
    ['abc', 'abc'],
  ])('formatea %s', (entrada, esperado) => {
    expect(formatearDni(entrada)).toBe(esperado)
  })
})

describe('validarPaciente', () => {
  const valido = { nombre: 'Juan', apellido: 'Gómez', dni: '40.123.456', email: 'juan@mail.com', password: 'abc123' }

  it('sin problemas devuelve un objeto vacío', () => {
    expect(validarPaciente(valido)).toEqual({})
  })

  it('marca cada campo vacío con su propio mensaje', () => {
    const errores = validarPaciente({})

    expect(Object.keys(errores).sort()).toEqual(['apellido', 'dni', 'email', 'nombre', 'password'])
    expect(errores.dni).toBe('Escribí el DNI.')
  })

  it.each([['123456'], ['123456789'], ['40a23456']])('rechaza el DNI %s', (dni) => {
    expect(validarPaciente({ ...valido, dni }).dni).toBe('El DNI tiene que tener 7 u 8 números.')
  })

  it('rechaza un email mal escrito y una contraseña corta', () => {
    const errores = validarPaciente({ ...valido, email: 'juan', password: '123' })

    expect(errores.email).toContain('formato')
    expect(errores.password).toContain('6')
  })
})

describe('iniciales', () => {
  it.each([
    ['nombre y apellido', JUAN, 'JG'],
    ['con espacios de más', { nombre: ' ana ', apellido: ' perez' }, 'AP'],
    ['sin datos', {}, '?'],
    ['sin persona', null, '?'],
  ])('%s', (_caso, persona, esperado) => {
    expect(iniciales(persona)).toBe(esperado)
  })
})

describe('ordenarPorApellido', () => {
  it('ordena alfabéticamente por apellido sin tocar la lista original', () => {
    const lista = [SIN_DNI, JUAN, LIA]

    expect(ordenarPorApellido(lista).map((p) => p.apellido)).toEqual(['Acosta', 'Gómez', 'Zárate'])
    expect(lista[0]).toBe(SIN_DNI)
  })
})

describe('buscarPacientes', () => {
  const pacientes = [JUAN, LIA, SIN_DNI]

  it.each([
    ['vacío', '  ', [2, 3, 4]],
    ['nulo', null, [2, 3, 4]],
    ['apellido sin tilde', 'gomez', [2]],
    ['apellido y nombre', 'acosta lia', [3]],
    ['DNI con puntos', '40.123', [2]],
    ['email', 'rita@', [4]],
    ['algo que no está', 'pérez', []],
  ])('por %s', (_caso, texto, ids) => {
    expect(buscarPacientes(pacientes, texto).map((p) => p.id)).toEqual(ids)
  })

  it('una búsqueda solo con puntos no trae todos los DNI', () => {
    expect(buscarPacientes(pacientes, '...')).toEqual([])
  })
})

describe('resumirPorPaciente', () => {
  it('cuenta los resultados y se queda con la fecha más nueva', () => {
    const resumen = resumirPorPaciente([
      { paciente_id: 2, fecha_carga: '2026-11-01T10:00:00' },
      { paciente_id: 2, fecha_carga: '2026-11-12T10:00:00' },
      { paciente_id: 2, fecha_carga: '2026-11-05T10:00:00' },
      { paciente_id: 3, fecha_carga: '2026-10-01T10:00:00' },
    ])

    expect(resumen[2]).toEqual({ cantidad: 3, ultima: '2026-11-12T10:00:00' })
    expect(resumen[3]).toEqual({ cantidad: 1, ultima: '2026-10-01T10:00:00' })
    expect(resumen[4]).toBeUndefined()
  })
})

describe('textoCredenciales', () => {
  it('incluye la dirección, el email y la contraseña, una por línea', () => {
    const texto = textoCredenciales(JUAN, 'Xk7pQ2mT9a', 'https://bioconect-front-prod.onrender.com')

    expect(texto.split('\n')).toEqual([
      'Hola Juan, ya podés ver tus resultados de laboratorio en BioConect.',
      'Entrá a https://bioconect-front-prod.onrender.com',
      'Email: juan@mail.com',
      'Contraseña: Xk7pQ2mT9a',
    ])
  })
})

describe('fraseResumen', () => {
  it.each([
    [0, 0, 0, 'Todavía no tenés pacientes. Empezá creando el primero.'],
    [1, 0, 0, 'Tenés 1 paciente y 0 resultados cargados.'],
    [3, 1, 1, 'Tenés 3 pacientes y 1 resultado cargado. Uno es de esta semana.'],
    [3, 5, 2, 'Tenés 3 pacientes y 5 resultados cargados. 2 son de esta semana.'],
  ])('%i pacientes, %i resultados, %i recientes', (p, r, recientes, esperado) => {
    expect(fraseResumen(p, r, recientes)).toBe(esperado)
  })
})
