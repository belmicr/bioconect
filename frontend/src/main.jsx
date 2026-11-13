import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import * as Sentry from '@sentry/react'
import '@fontsource-variable/atkinson-hyperlegible-next'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './auth/AuthContext.jsx'

// Sentry en el front. El DSN de un front NO es secreto: solo sirve para ENVIAR datos
// a Sentry, no para leerlos, y viaja igual en el JavaScript que baja el navegador.
Sentry.init({
  dsn: 'https://8766776f5507f3058db33e9808090622@o4512415522553856.ingest.us.sentry.io/4512415562858496',
  environment: window.location.hostname, // QA, producción o localhost
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 1.0,
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)