import { describe, expect, it, vi } from 'vitest'
import { cargarEstudios, cargarPacientes, crearPaciente, subirResultado } from './servicios.js'

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

describe('cargarPacientes', () => {
  it('le pide los pacientes a la API y los ordena por apellido', async () => {
    const traer = vi.fn().mockResolvedValue([
      { id: 2, nombre: 'Juan', apellido: 'Gómez' },
      { id: 3, nombre: 'Lía', apellido: 'Acosta' },
    ])

    const pacientes = await cargarPacientes(traer)

    expect(traer).toHaveBeenCalledWith('/pacientes')
    expect(pacientes.map((p) => p.id)).toEqual([3, 2])
  })
})

describe('crearPaciente', () => {
  it('limpia los datos del formulario antes de mandarlos', async () => {
    const enviar = vi.fn().mockResolvedValue({ id: 9 })

    const creado = await crearPaciente(
      {
        nombre: ' Juan ',
        apellido: ' Gómez ',
        dni: '40.123.456',
        email: ' Juan@Mail.com ',
        password: 'Xk7pQ2mT9a',
        fechaNacimiento: '',
      },
      enviar,
    )

    expect(creado).toEqual({ id: 9 })
    expect(enviar).toHaveBeenCalledWith('/pacientes', {
      nombre: 'Juan',
      apellido: 'Gómez',
      dni: '40123456',
      email: 'juan@mail.com',
      password: 'Xk7pQ2mT9a',
      fecha_nacimiento: null,
    })
  })

  it('manda la fecha de nacimiento si se cargó', async () => {
    const enviar = vi.fn().mockResolvedValue({})

    await crearPaciente(
      { nombre: 'A', apellido: 'B', dni: '1234567', email: 'a@b.com', password: '123456', fechaNacimiento: '1990-05-04' },
      enviar,
    )

    expect(enviar.mock.calls[0][1].fecha_nacimiento).toBe('1990-05-04')
  })

  it('propaga el error de la API (por ejemplo, email repetido)', async () => {
    const enviar = vi.fn().mockRejectedValue(new Error('El email ya está registrado'))

    await expect(
      crearPaciente({ nombre: 'A', apellido: 'B', dni: '1', email: 'a@b.com', password: 'x' }, enviar),
    ).rejects.toThrow('El email ya está registrado')
  })
})

describe('subirResultado', () => {
  it('arma el formulario multipart que espera POST /estudios', async () => {
    const enviar = vi.fn().mockResolvedValue({ id: 5 })
    const archivo = new File(['%PDF-1.4'], 'hemograma.pdf', { type: 'application/pdf' })

    await subirResultado({ pacienteId: 2, descripcion: ' Hemograma completo ', archivo }, enviar)

    const [ruta, formulario] = enviar.mock.calls[0]
    expect(ruta).toBe('/estudios')
    expect(formulario.get('paciente_id')).toBe('2')
    expect(formulario.get('descripcion')).toBe('Hemograma completo')
    expect(formulario.get('archivo').name).toBe('hemograma.pdf')
  })
})
