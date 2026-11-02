import { ArrowRight, Info } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { backend } from '@/data/client'
import { LOCAL_DEMO_USERS } from '@/data/local/LocalBackend'
import { Button, Field, Input } from '@/components/ui/primitives'
import { useAuth } from './AuthContext'
import loginBg from '@/assets/brand/login-bg.jpg'
import v8Logo from '@/assets/brand/v8-logo.png'

export function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.includes('@')) return setError('Informe um e-mail válido.')
    if (!password) return setError('Informe sua senha.')
    setBusy(true)
    setError(null)
    try {
      await signIn(email, password)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen relative grid lg:grid-cols-[1.15fr_1fr] bg-[#07070a] text-white">
      <img src={loginBg} alt="" aria-hidden className="absolute inset-0 size-full object-cover" />
      <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(7,7,10,.55)_0%,rgba(7,7,10,.72)_45%,rgba(7,7,10,.94)_75%)]" aria-hidden />
      <div className="hidden lg:flex flex-col justify-between p-12 relative">
        <div className="flex items-center gap-3">
          <img src={v8Logo} alt="V8" className="h-11 w-auto" />
          <span className="font-extrabold tracking-[0.3em] text-lg">OS</span>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#ff7a1a] mb-3">V8 Aceleração · Sistema operacional</p>
          <h1 className="text-5xl font-extrabold tracking-tight leading-[1.05]">Cada fase da aceleração,<br />sob controle.</h1>
          <p className="text-white/75 mt-4 max-w-md">Escada de evolução V1–V8, tráfego, financeiro, páginas e entregas em um único cockpit.</p>
        </div>
        <p className="text-xs text-white/50">© {new Date().getFullYear()} V8 OS · V8 Aceleração</p>
      </div>
      <div className="relative flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-3xl border border-white/10 bg-[#0d0d12]/85 backdrop-blur-xl p-7 shadow-2xl" noValidate>
          <div className="flex items-center gap-2.5 lg:hidden mb-2">
            <img src={v8Logo} alt="V8" className="h-9 w-auto" />
            <span className="font-extrabold tracking-[0.3em]">OS</span>
          </div>
          <div>
            <h2 className="text-2xl font-extrabold">Entrar</h2>
            <p className="text-sm text-muted mt-1">Acesse o painel da sua operação.</p>
          </div>
          <Field label="E-mail">
            <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com" />
          </Field>
          <Field label="Senha">
            <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" variant="primary" className="w-full bg-[#ff6a00]! hover:bg-[#ff7d24]! shadow-[0_10px_30px_-10px_#ff6a00]!" loading={busy}>Entrar <ArrowRight className="size-4" /></Button>

          {backend.mode === 'local' && (
            <div className="card p-4 text-sm space-y-3">
              <p className="flex gap-2 text-muted"><Info className="size-4 shrink-0 mt-0.5 text-warning" />Modo demonstrativo local: o Supabase não está configurado e os dados ficam salvos neste navegador. Acessos de exemplo:</p>
              <div className="grid gap-2">
                {LOCAL_DEMO_USERS.map((u) => (
                  <button key={u.email} type="button" onClick={() => { setEmail(u.email); setPassword(u.password) }} className="text-left rounded-xl border border-line hover:border-primary px-3 py-2 transition">
                    <div className="font-semibold">{u.name} <span className="text-xs text-muted font-normal">· {u.role === 'admin' ? 'Administrador' : 'Expert'}</span></div>
                    <div className="text-xs text-faint">{u.email} / {u.password}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
