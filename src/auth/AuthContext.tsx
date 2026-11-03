import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { backend } from '@/data/client'
import { resetStore } from '@/data/store'
import type { Profile } from '@/data/types'
import type { SignUpInput, SignUpResult } from '@/data/backend'
import { isAdminRole } from '@/lib/funcoes'

interface AuthState {
  user: Profile | null
  loading: boolean
  /** Dono ou administrador: acesso a todos os experts. */
  isAdmin: boolean
  /** Dono do sistema (super administrador). */
  isOwner: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (input: SignUpInput) => Promise<SignUpResult>
  signInWithGoogle: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  /** true quando o usuário abriu o link de recuperação e precisa definir a senha nova. */
  recovery: boolean
  finishRecovery: (password: string) => Promise<void>
  signOut: () => Promise<void>
  /** Recarrega o perfil do usuário logado (após mudar função, por exemplo). */
  refreshUser: () => Promise<void>
}

const Ctx = createContext<AuthState>(null as unknown as AuthState)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [recovery, setRecovery] = useState(() => new URLSearchParams(window.location.search).get('reset') === '1')

  useEffect(() => {
    backend.currentUser().then((u) => {
      setUser(u)
      // O link de convite/recuperação pode ter marcado ?reset=1 durante o login por URL.
      if (new URLSearchParams(window.location.search).get('reset') === '1') setRecovery(true)
      setLoading(false)
    }).catch(() => setLoading(false))
    let current: string | null = null
    const offRecovery = backend.onPasswordRecovery(() => setRecovery(true))
    const offAuth = backend.onAuthChange((u) => {
      if ((u?.id ?? null) !== current) resetStore()
      current = u?.id ?? null
      setUser(u)
    })
    return () => {
      offRecovery()
      offAuth()
    }
  }, [])

  return (
    <Ctx.Provider
      value={{
        user,
        loading,
        isAdmin: isAdminRole(user?.role),
        isOwner: user?.role === 'owner',
        signIn: async (email, password) => {
          resetStore()
          setUser(await backend.signIn(email, password))
        },
        signUp: async (input) => {
          resetStore()
          const r = await backend.signUp(input)
          if (r.profile) setUser(r.profile)
          return r
        },
        signInWithGoogle: () => backend.signInWithGoogle(),
        requestPasswordReset: (email) => backend.requestPasswordReset(email),
        recovery,
        finishRecovery: async (password) => {
          await backend.updatePassword(password)
          setRecovery(false)
          window.history.replaceState(null, '', window.location.pathname + window.location.hash)
        },
        refreshUser: async () => setUser(await backend.currentUser()),
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
