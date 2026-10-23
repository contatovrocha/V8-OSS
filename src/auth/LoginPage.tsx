import { ArrowRight, Info } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { backend } from '@/data/client'
import { LOCAL_DEMO_USERS } from '@/data/local/LocalBackend'
import { Button, Field, Input } from '@/components/ui/primitives'
import { useAuth } from './AuthContext'

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
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 border-r border-line relative overflow-hidden">
        <div className="flex items-center gap-2.5">
          <div className="size-10 rounded-xl bg-primary grid place-items-center">
            <svg viewBox="0 0 64 64" className="size-7"><path d="M18 46 L46 18" stroke="#f97316" strokeWidth="6" strokeLinecap="round" /><path d="M36 18h10v10" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" /><circle cx="24" cy="40" r="4.5" fill="#fff" /><circle cx="32" cy="32" r="4.5" fill="#fff" /></svg>
          </div>
          <span className="font-extrabold tracking-[0.16em] uppercase">Launch OS</span>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-3">Gestão de lançamentos</p>
          <h1 className="text-5xl font-extrabold tracking-tight leading-[1.05]">Cada fase do lançamento,<br />sob controle.</h1>
          <p className="text-muted mt-4 max-w-md">Escada de evolução V1–V8, tráfego, financeiro, páginas e entregas do expert em um único cockpit.</p>
        </div>
        <svg viewBox="0 0 300 300" className="absolute -right-10 bottom-10 w-80 opacity-30" aria-hidden>
          <line x1="80" y1="290" x2="220" y2="20" stroke="url(#lg)" strokeWidth="6" strokeLinecap="round" />
          <defs><linearGradient id="lg" x1="0" y1="1" x2="0" y2="0"><stop stopColor="#f97316" /><stop offset="1" stopColor="#ef4444" /></linearGradient></defs>
          {Array.from({ length: 8 }, (_, i) => <circle key={i} cx={80 + (140 * (i + 1)) / 9} cy={290 - (270 * (i + 1)) / 9} r="7" fill="#c7d2fe" />)}
        </svg>
        <p className="text-xs text-faint">© {new Date().getFullYear()} Launch OS</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-4" noValidate>
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
          <Button type="submit" variant="primary" className="w-full" loading={busy}>Entrar <ArrowRight className="size-4" /></Button>

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
