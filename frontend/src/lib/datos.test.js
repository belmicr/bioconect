import { describe, expect, it } from 'vitest'
import {
  etiquetaEstado,
  filtrarPorTexto,
  indexarPorId,
  nombreCompleto,
  ordenarPorFechaDesc,
  pedidosPendientes,
} from './datos.js'

describe('ordenarPorFechaDesc', () => {
  const items = [
    { id: 1, fecha: '2026-10-01T10:00:00' },
    { id: 2, fecha: '2026-10-03T10:00:00' },
    { id: 3, fecha: '2026-10-02T10:00:00' },
  ]

  it('deja primero lo más reciente', () => {
    expect(ordenarPorFechaDesc(items, 'fecha').map((i) => i.id)).toEqual([2, 3, 1])
  })

  it('no modifica la lista original', () => {
    ordenarPorFechaDesc(items, 'fecha')

    expect(items.map((i) => i.id)).toEqual([1, 2, 3])
  })
})

describe('filtrarPorTexto', () => {
  const estudios = [
    { id: 1, descripcion: 'Hemograma completo' },
    { id: 2, descripcion: 'Glucemia' },
    { id: 3, descripcion: null },
  ]
  it('sin texto (nulo) devuelve todos', () => {
    expect(filtrarPorTexto(estudios, null)).toHaveLength(3)
  })
  it('sin texto devuelve todos', () => {
    expect(filtrarPorTexto(estudios, '  ')).toHaveLength(3)
  })

  it('busca sin distinguir mayúsculas', () => {
    expect(filtrarPorTexto(estudios, 'HEMO').map((e) => e.id)).toEqual([1])
  })

  it('no se rompe con una descripción nula', () => {
    expect(filtrarPorTexto(estudios, 'gluc').map((e) => e.id)).toEqual([2])
  })
})

describe('nombreCompleto', () => {
  it('junta nombre y apellido', () => {
    expect(nombreCompleto({ nombre: 'Ana', apellido: 'Perez' })).toBe('Ana Perez')
  })

  it('devuelve Desconocido si no hay persona', () => {
    expect(nombreCompleto(null)).toBe('Desconocido')
  })
})

describe('indexarPorId', () => {
  it('arma un diccionario por id', () => {
    const indice = indexarPorId([{ id: 2, nombre: 'Juan' }, { id: 5, nombre: 'Lía' }])

    expect(indice[5].nombre).toBe('Lía')
  })
})

describe('pedidosPendientes', () => {
  it('deja solo los pendientes', () => {
    const pedidos = [
      { id: 1, estado: 'pendiente' },
      { id: 2, estado: 'respondido' },
    ]

    expect(pedidosPendientes(pedidos).map((p) => p.id)).toEqual([1])
  })
})

describe('etiquetaEstado', () => {
  it('traduce un estado conocido', () => {
    expect(etiquetaEstado('confirmado')).toBe('Confirmado')
  })

  it('devuelve el mismo texto si el estado no se conoce', () => {
    expect(etiquetaEstado('raro')).toBe('raro')
  })
})