import { Clock, LogOut, UserRound } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Button, Field, Select, Spinner } from '@/components/ui/primitives'
import { backend } from '@/data/client'
import { useRows } from '@/data/store'
import type { Funcao } from '@/data/types'
import { FUNCOES, funcaoLabel } from '@/lib/funcoes'
import { AuthShell } from './AuthShell'
import { useAuth } from './AuthContext'

/**
 * Etapas antes de entrar no sistema:
 *  1. quem ainda não informou a função (ex.: entrou com Google) escolhe a função;
 *  2. membro sem nenhum expert liberado vê "Aguardando liberação" até o administrador vincular.
 */
export function AccessGate({ children }: { children: ReactNode }) {
  const { user, isAdmin, refreshUser, signOut } = useAuth()
  const links = useRows('user_experts')
  if (!user) return null
  if (!isAdmin && !user.funcao) return <FuncaoStep onDone={refreshUser} />
  if (isAdmin) return <>{children}</>
  if (links.loading) return <div className="min-h-screen grid place-items-center"><Spinner className="size-8" /></div>
  if (!links.rows.some((l) => l.user_id === user.id)) {
    return (
      <AuthShell>
        <div className="text-center space-y-4 py-2">
          <Clock className="size-10 mx-auto text-[#ff7a1a]" />
          <h2 className="text-2xl font-extrabold">Aguardando liberação</h2>
          <p className="text-sm text-white/70">Olá, <strong className="text-white">{user.full_name}</strong> ({funcaoLabel(user.funcao)}). Sua conta foi criada. O administrador precisa liberar o seu acesso aos experts e projetos.</p>
          <p className="text-xs text-white/50">Assim que o acesso for liberado, é só atualizar esta página.</p>
          <div className="flex gap-2 justify-center pt-2">
            <Button onClick={() => links.reload()}>Verificar novamente</Button>
            <Button variant="ghost" icon={LogOut} onClick={signOut}>Sair</Button>
          </div>
        </div>
      </AuthShell>
    )
  }
  return <>{children}</>
}

function FuncaoStep({ onDone }: { onDone: () => Promise<void> }) {
  const { user } = useAuth()
  const [funcao, setFuncao] = useState<Funcao | ''>('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const save = async () => {
    if (!funcao) return setError('Selecione a sua função.')
    setBusy(true)
    try {
      await backend.update('profiles', user!.id, { funcao })
      await onDone()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }
  return (
    <AuthShell>
      <div className="space-y-4">
        <UserRound className="size-8 text-[#ff7a1a]" />
        <div>
          <h2 className="text-2xl font-extrabold">Só mais um passo</h2>
          <p className="text-sm text-muted mt-1">Conte qual é a sua função no time.</p>
        </div>
        <Field label="Qual é a sua função?">
          <Select value={funcao} onChange={(e) => setFuncao(e.target.value as Funcao)}>
            <option value="">Selecione...</option>
            {FUNCOES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </Select>
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button variant="primary" className="w-full bg-[#ff6a00]! hover:bg-[#ff7d24]!" loading={busy} onClick={save}>Continuar</Button>
      </div>
    </AuthShell>
  )
}
