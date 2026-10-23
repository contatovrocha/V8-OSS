import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { backend } from '@/data/client'
import { resetStore } from '@/data/store'
import type { Profile } from '@/data/types'

interface AuthState {
  user: Profile | null
  loading: boolean
  isAdmin: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthState>(null as unknown as AuthState)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    backend.currentUser().then((u) => {
      setUser(u)
      setLoading(false)
    }).catch(() => setLoading(false))
    let current: string | null = null
    return backend.onAuthChange((u) => {
      if ((u?.id ?? null) !== current) resetStore()
      current = u?.id ?? null
      setUser(u)
    })
  }, [])

  return (
    <Ctx.Provider
      value={{
        user,
        loading,
        isAdmin: user?.role === 'admin',
        signIn: async (email, password) => {
          resetStore()
          setUser(await backend.signIn(email, password))
        },
        signOut: async () => {
          await backend.signOut()
          resetStore()
          setUser(null)
        },
      }}
    >
      {children}
    </Ctx.Provider>
  )
}
