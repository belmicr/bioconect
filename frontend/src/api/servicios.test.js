import { describe, expect, it, vi } from 'vitest'
import { cargarEstudios } from './servicios.js'

describe('cargarEstudios', () => {
  it('le pide los estudios a la API y los devuelve del más nuevo al más viejo', async () => {
    const traer = vi.fn().mockResolvedValue([
      { id: 1, fecha_carga: '2026-10-01T10:00:00' },
      { id: 2, fecha_carga: '2026-10-03T10:00:00' },
    ])

    const estudios = await cargarEstudios(traer)

    expect(traer).toHaveBeenCalledWith('/estudios')
    expect(estudios.map((e) => e.id)).toEqual([2, 1])
  })

  it('propaga el error si la API falla', async () => {
    const traer = vi.fn().mockRejectedValue(new Error('sin conexión'))

    await expect(cargarEstudios(traer)).rejects.toThrow('sin conexión')
  })
})