import { ArrowRight, Info, MailCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { backend } from '@/data/client'
import { LOCAL_DEMO_USERS } from '@/data/local/LocalBackend'
import { Button, Field, Input } from '@/components/ui/primitives'
import { useAuth } from './AuthContext'
import loginBg from '@/assets/brand/login-bg.webp'
import v8Logo from '@/assets/brand/v8-logo.png'

type Mode = 'entrar' | 'criar'

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

export function LoginPage() {
  const { signIn, signUp, signInWithGoogle } = useAuth()
  const [mode, setMode] = useState<Mode>('entrar')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  const switchMode = (m: Mode) => {
    setMode(m)
    setError(null)
    setSentTo(null)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (mode === 'criar' && name.trim().length < 3) return setError('Informe seu nome completo.')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError('Informe um e-mail válido.')
    if (!password) return setError('Informe sua senha.')
    if (mode === 'criar' && password.length < 6) return setError('A senha deve ter pelo menos 6 caracteres.')
    if (mode === 'criar' && password !== confirm) return setError('As senhas não conferem.')
    setBusy(true)
    setError(null)
    try {
      if (mode === 'entrar') await signIn(email, password)
      else {
        const r = await signUp({ full_name: name, email, password })
        if (r.confirmEmail) setSentTo(email.trim().toLowerCase())
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const google = async () => {
    setError(null)
    try {
      await signInWithGoogle()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="min-h-screen relative grid lg:grid-cols-[1.25fr_1fr] bg-[#07070a] text-white">
      <img src={loginBg} alt="" aria-hidden className="absolute inset-0 size-full object-cover object-[35%_center]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,7,10,.15)_0%,rgba(7,7,10,.35)_50%,rgba(7,7,10,.92)_72%)] max-lg:bg-[rgba(7,7,10,.72)]" aria-hidden />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(0deg,rgba(7,7,10,.95),transparent)]" aria-hidden />
      <div className="hidden lg:flex flex-col justify-between p-12 relative">
        <div className="flex items-center gap-3">
          <img src={v8Logo} alt="V8" className="h-11 w-auto drop-shadow-[0_2px_10px_rgba(0,0,0,.6)]" />
          <span className="font-extrabold tracking-[0.3em] text-lg">OS</span>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#ff7a1a] mb-3">V8 Aceleração · Sistema operacional</p>
          <h1 className="text-5xl font-extrabold tracking-tight leading-[1.05] drop-shadow-[0_4px_20px_rgba(0,0,0,.6)]">Cada fase do lançamento<br />sob controle.</h1>
          <p className="text-white/80 mt-4 max-w-md">Acompanhe, centralize e acelere seu lançamento com o sistema V8 OS.</p>
          <p className="text-xs text-white/50 mt-10">© {new Date().getFullYear()} V8 OS · V8 Aceleração</p>
        </div>
      </div>
      <div className="relative flex items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#0d0d12]/90 backdrop-blur-xl p-7 shadow-2xl">
          <div className="flex items-center gap-2.5 lg:hidden mb-5">
            <img src={v8Logo} alt="V8" className="h-9 w-auto" />
            <span className="font-extrabold tracking-[0.3em]">OS</span>
          </div>

          <div className="grid grid-cols-2 gap-1 rounded-xl bg-white/5 p-1 mb-6" role="tablist">
            {(['entrar', 'criar'] as Mode[]).map((m) => (
              <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => switchMode(m)}
                className={`rounded-lg py-2 text-sm font-bold transition ${mode === m ? 'bg-[#ff6a00] text-[#140800]' : 'text-white/70 hover:text-white'}`}>
                {m === 'entrar' ? 'Entrar' : 'Criar conta'}
              </button>
            ))}
          </div>

          {sentTo ? (
            <div className="text-center space-y-3 py-4">
              <MailCheck className="size-10 mx-auto text-[#ff7a1a]" />
              <h2 className="text-xl font-extrabold">Confirme seu e-mail</h2>
              <p className="text-sm text-white/70">Enviamos um link de confirmação para <strong className="text-white">{sentTo}</strong>. Clique no link e depois entre com seu e-mail e senha.</p>
              <Button type="button" variant="secondary" className="w-full" onClick={() => switchMode('entrar')}>Ir para Entrar</Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4" noValidate>
              <div>
                <h2 className="text-2xl font-extrabold">{mode === 'entrar' ? 'Entrar' : 'Criar sua conta'}</h2>
                <p className="text-sm text-muted mt-1">{mode === 'entrar' ? 'Acesse o painel da sua operação.' : 'Depois do cadastro, o administrador libera o seu acesso.'}</p>
              </div>

              {backend.mode === 'supabase' && (
                <>
                  <button type="button" onClick={google} className="w-full flex items-center justify-center gap-3 rounded-xl bg-white text-[#1f1f1f] font-semibold py-2.5 hover:bg-white/90 transition">
                    <GoogleIcon /> {mode === 'entrar' ? 'Entrar com Google' : 'Criar conta com Google'}
                  </button>
                  <div className="flex items-center gap-3 text-xs text-white/40"><span className="h-px flex-1 bg-white/10" />ou com e-mail<span className="h-px flex-1 bg-white/10" /></div>
                </>
              )}

              {mode === 'criar' && (
                <Field label="Nome completo">
                  <Input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" />
                </Field>
              )}
              <Field label="E-mail">
                <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com" />
              </Field>
              <Field label="Senha">
                <Input type="password" autoComplete={mode === 'entrar' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === 'criar' ? 'Mínimo de 6 caracteres' : undefined} />
              </Field>
              {mode === 'criar' && (
                <Field label="Confirmar senha">
                  <Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                </Field>
              )}
              {error && <p className="text-sm text-danger">{error}</p>}
              <Button type="submit" variant="primary" className="w-full bg-[#ff6a00]! hover:bg-[#ff7d24]! shadow-[0_10px_30px_-10px_#ff6a00]!" loading={busy}>
                {mode === 'entrar' ? 'Entrar' : 'Criar conta'} <ArrowRight className="size-4" />
              </Button>
              <p className="text-center text-sm text-white/60">
                {mode === 'entrar' ? 'Ainda não tem conta? ' : 'Já tem conta? '}
                <button type="button" className="font-semibold text-[#ff8a3a] hover:underline" onClick={() => switchMode(mode === 'entrar' ? 'criar' : 'entrar')}>
                  {mode === 'entrar' ? 'Criar conta' : 'Entrar'}
                </button>
              </p>

              {backend.mode === 'local' && mode === 'entrar' && (
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
          )}
        </div>
      </div>
    </div>
  )
}
