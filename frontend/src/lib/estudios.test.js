import { describe, expect, it } from 'vitest'
import {
  ESTUDIOS_FRECUENTES,
  MAX_PDF_BYTES,
  filtrarResultados,
  formatearTamanio,
  mensajeDescarga,
  nombreDescarga,
  tuboDeEstudio,
  validarArchivoPdf,
  validarResultado,
} from './estudios.js'
import { diaISO } from './fechas.js'

const pdf = (nombre = 'resultado.pdf', size = 2048) => ({ type: 'application/pdf', name: nombre, size })

describe('tuboDeEstudio', () => {
  it.each([
    ['Hemograma completo', 'lila'],
    ['Hemoglobina glicosilada', 'lila'],
    ['Coagulograma', 'celeste'],
    ['Glucemia en ayunas', 'gris'],
    ['Orina completa', 'ambar'],
    ['Perfil lipídico', 'oro'],
    ['TSH y T4 libre', 'oro'],
    ['Ácido úrico', 'oro'],
    ['Estudio especial', 'general'],
    [null, 'general'],
  ])('%s va en tubo %s', (descripcion, clave) => {
    expect(tuboDeEstudio(descripcion).clave).toBe(clave)
  })

  it('devuelve también el nombre del tubo', () => {
    expect(tuboDeEstudio('Hemograma').nombre).toBe('Tubo lila (EDTA)')
    expect(tuboDeEstudio('').nombre).toBe('Muestra general')
  })

  it('todos los estudios frecuentes tienen un tubo conocido', () => {
    const generales = ESTUDIOS_FRECUENTES.filter((e) => tuboDeEstudio(e).clave === 'general')

    expect(generales).toEqual([])
  })
})

describe('formatearTamanio', () => {
  it.each([
    [512, '512 B'],
    [2048, '2 KB'],
    [1536 * 1024, '1,5 MB'],
  ])('%i bytes', (bytes, esperado) => {
    expect(formatearTamanio(bytes)).toBe(esperado)
  })
})

describe('validarArchivoPdf', () => {
  it('acepta un PDF de tamaño normal', () => {
    expect(validarArchivoPdf(pdf())).toBeNull()
  })

  it.each([
    ['sin archivo', null, 'Elegí el PDF del resultado.'],
    ['una imagen', { type: 'image/png', name: 'foto.png', size: 10 }, 'El archivo tiene que ser un PDF.'],
    ['tipo PDF pero sin extensión .pdf', { type: 'application/pdf', name: 'resultado', size: 10 }, 'El archivo tiene que ser un PDF.'],
    ['tipo PDF sin nombre', { type: 'application/pdf', size: 10 }, 'El archivo tiene que ser un PDF.'],
    ['más de 10 MB', pdf('grande.pdf', MAX_PDF_BYTES + 1), 'El PDF supera los 10 MB.'],
  ])('rechaza %s', (_caso, archivo, mensaje) => {
    expect(validarArchivoPdf(archivo)).toBe(mensaje)
  })

  it('acepta la extensión en mayúsculas', () => {
    expect(validarArchivoPdf(pdf('RESULTADO.PDF'))).toBeNull()
  })
})

describe('validarResultado', () => {
  it('sin problemas devuelve un objeto vacío', () => {
    expect(validarResultado({ pacienteId: '2', descripcion: 'Glucemia', archivo: pdf() })).toEqual({})
  })

  it('marca paciente, estudio y archivo cuando faltan', () => {
    expect(validarResultado({ pacienteId: '', descripcion: '  ', archivo: null })).toEqual({
      paciente: 'Elegí el paciente.',
      descripcion: 'Escribí qué estudio es.',
      archivo: 'Elegí el PDF del resultado.',
    })
  })

  it('tolera una descripción nula', () => {
    expect(validarResultado({ pacienteId: 2, archivo: pdf() }).descripcion).toBe('Escribí qué estudio es.')
  })
})

describe('filtrarResultados', () => {
  const estudios = [
    { id: 1, paciente_id: 2, descripcion: 'Hemograma completo' },
    { id: 2, paciente_id: 3, descripcion: 'Glucemia' },
    { id: 3, paciente_id: 2, descripcion: 'Glucemia' },
  ]

  it.each([
    ['sin filtros', { pacienteId: '', texto: '' }, [1, 2, 3]],
    ['por paciente (el select manda texto)', { pacienteId: '2', texto: '' }, [1, 3]],
    ['por estudio', { pacienteId: '', texto: 'gluc' }, [2, 3]],
    ['por paciente y estudio', { pacienteId: 2, texto: 'gluc' }, [3]],
  ])('%s', (_caso, filtros, ids) => {
    expect(filtrarResultados(estudios, filtros).map((e) => e.id)).toEqual(ids)
  })
})

describe('nombreDescarga', () => {
  it('usa el estudio, el apellido y la fecha', () => {
    const estudio = { descripcion: 'Perfil lipídico', fecha_carga: '2026-11-12T15:20:00' }

    expect(nombreDescarga(estudio, { apellido: 'Gómez' })).toBe('perfil-lipidico-gomez-2026-11-12.pdf')
  })

  it('la fecha del nombre es la del día local, no la de UTC', () => {
    const estudio = { descripcion: 'Glucemia', fecha_carga: '2026-11-13T01:30:00' }
    const esperado = diaISO(new Date('2026-11-13T01:30:00Z'))

    expect(nombreDescarga(estudio, { apellido: 'Ruiz' })).toBe(`glucemia-ruiz-${esperado}.pdf`)
  })

  it('sin descripción, paciente ni fecha igual da un nombre válido', () => {
    expect(nombreDescarga({ descripcion: null }, undefined)).toBe('estudio.pdf')
  })
})

describe('mensajeDescarga', () => {
  it('si el PDF ya no está (404) dice qué hacer', () => {
    expect(mensajeDescarga({ estado: 404, message: 'El archivo ya no está disponible' })).toContain('vuelva a subir')
  })

  it('con otro error muestra el mensaje de la API', () => {
    expect(mensajeDescarga({ estado: 500, message: 'Ocurrió un error inesperado' })).toBe('Ocurrió un error inesperado')
  })

  it.each([[null], [{}]])('sin detalle da un mensaje genérico (%o)', (error) => {
    expect(mensajeDescarga(error)).toContain('No se pudo descargar')
  })
})
