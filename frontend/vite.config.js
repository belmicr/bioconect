import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (ruta) => ruta.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      // Solo la lógica propia entra en la cuenta. Queda afuera el cliente HTTP, el contexto
      // de sesión y los componentes de pantalla: se prueban de punta a punta en el TP7.
      include: ['src/lib/**', 'src/api/servicios.js'],
      thresholds: { lines: 80, branches: 80 },
    },
  },
})