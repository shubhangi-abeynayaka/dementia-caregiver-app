import { createContext, useContext, useMemo, useState } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [isAuthenticated] = useState(true)
  const [isLoadingAuth] = useState(false)
  const [authChecked] = useState(true)
  const [authError] = useState(null)

  const checkUserAuth = () => {
    return Promise.resolve()
  }

  const value = useMemo(
    () => ({ isAuthenticated, isLoadingAuth, authChecked, authError, checkUserAuth }),
    [isAuthenticated, isLoadingAuth, authChecked, authError]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
