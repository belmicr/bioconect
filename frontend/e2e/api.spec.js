import { expect, test } from '@playwright/test'

// Integración: le habla a la API de verdad, con su base de verdad, sin navegador.
const API = process.env.API_BASE_URL

test('la API de QA está viva y llega a su base', async ({ request }) => {
  const respuesta = await request.get(`${API}/health/db`)

  expect(respuesta.ok()).toBeTruthy()
})

test('se puede crear un usuario y entrar con él (escribe y lee la base)', async ({ request }) => {
  const email = `integracion-${Date.now()}@qa.com`

  const registro = await request.post(`${API}/registro`, {
    data: { email, password: '123456', rol: 'bioquimico', nombre: 'Integ', apellido: 'Test' },
  })
  expect(registro.status()).toBe(200)

  const login = await request.post(`${API}/login`, { data: { email, password: '123456' } })
  expect(login.status()).toBe(200)
  const { access_token } = await login.json()

  const yo = await request.get(`${API}/me`, {
    headers: { Authorization: `Bearer ${access_token}` },
  })
  expect((await yo.json()).email).toBe(email)
})

test('sin token, la API no entrega estudios (401)', async ({ request }) => {
  const respuesta = await request.get(`${API}/estudios`)

  expect(respuesta.status()).toBe(401)
})