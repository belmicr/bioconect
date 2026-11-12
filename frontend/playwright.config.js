import { defineConfig } from '@playwright/test'

// Las direcciones NO están en el código: llegan por variables de entorno,
// así las mismas pruebas sirven contra cualquier entorno.
export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,           // Render gratis puede tardar en despertar
  expect: { timeout: 30_000 },
  retries: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
})