import { ArrowRight, KeyRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button, Field, Input } from '@/components/ui/primitives'
import { AuthShell } from './AuthShell'
import { useAuth } from './AuthContext'

/** Aberta pelo link de recuperação: o usuário já está autenticado e só define a senha nova. */
export function NewPasswordPage() {
  const { user, finishRecovery } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 6) return setError('A senha deve ter pelo menos 6 caracteres.')
    if (password !== confirm) return setError('As senhas não conferem.')
    setBusy(true)
    setError(null)
    try {
      await finishRecovery(password)
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <AuthShell>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <KeyRound className="size-8 text-[#ff7a1a] mb-3" />
          <h2 className="text-2xl font-extrabold">Criar senha nova</h2>
          <p className="text-sm text-muted mt-1">Conta: <strong className="text-white">{user?.email}</strong></p>
        </div>
        <Field label="Nova senha">
          <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo de 6 caracteres" />
        </Field>
        <Field label="Confirmar nova senha">
          <Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" variant="primary" className="w-full bg-[#ff6a00]! hover:bg-[#ff7d24]! shadow-[0_10px_30px_-10px_#ff6a00]!" loading={busy}>
          Salvar e entrar <ArrowRight className="size-4" />
        </Button>
      </form>
    </AuthShell>
  )
}
