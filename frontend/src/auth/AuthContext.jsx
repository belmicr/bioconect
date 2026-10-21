import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { borrarToken, enviarJson, guardarToken, leerToken, traerJson } from '../api/cliente.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [cargando, setCargando] = useState(Boolean(leerToken()))

  // Si quedó un token guardado, preguntamos al backend quién es.
  useEffect(() => {
    if (!leerToken()) return
    traerJson('/me')
      .then(setUsuario)
      .catch(() => borrarToken())
      .finally(() => setCargando(false))
  }, [])

  // El cliente avisa cuando el backend devuelve 401 con un token guardado.
  useEffect(() => {
    const alVencer = () => setUsuario(null)
    window.addEventListener('sesion-vencida', alVencer)
    return () => window.removeEventListener('sesion-vencida', alVencer)
  }, [])

  const iniciarSesion = useCallback(async (email, password) => {
    const datos = await enviarJson('/login', { email, password })
    guardarToken(datos.access_token)
    setUsuario(datos.usuario)
    return datos.usuario
  }, [])

  const cerrarSesion = useCallback(() => {
    borrarToken()
    setUsuario(null)
  }, [])

  const valor = useMemo(
    () => ({ usuario, cargando, iniciarSesion, cerrarSesion }),
    [usuario, cargando, iniciarSesion, cerrarSesion],
  )

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext)
}