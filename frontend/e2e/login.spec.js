import { expect, test } from '@playwright/test'

// e2e: un navegador real usa el front de QA como lo haría una persona.
const API = process.env.API_BASE_URL

test('una bioquímica entra y ve su portal', async ({ page, request }) => {
  const email = `e2e-${Date.now()}@qa.com`
  await request.post(`${API}/registro`, {
    data: { email, password: '123456', rol: 'bioquimico', nombre: 'E2E', apellido: 'Test' },
  })

  await page.goto('/')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña').fill('123456')
  await page.getByRole('button', { name: 'Ingresar' }).click()

  await expect(page.getByText('Portal del bioquímico')).toBeVisible()
})