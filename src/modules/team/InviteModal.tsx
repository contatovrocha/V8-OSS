import { Check, Copy, MailCheck } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '@/auth/AuthContext'
import { Modal, useAction } from '@/components/ui/overlay'
import { Button, Checkbox, Field, Input, Select } from '@/components/ui/primitives'
import { backend } from '@/data/client'
import type { InviteInput, InviteResult } from '@/data/backend'
import { invalidate } from '@/data/store'
import type { Expert, Funcao } from '@/data/types'
import { FUNCOES } from '@/lib/funcoes'

/** Link de acesso para enviar manualmente (WhatsApp, e-mail) quando o envio automático não for possível. */
export function LinkBox({ link }: { link: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex gap-2">
      <Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
      <Button icon={copied ? Check : Copy} onClick={async () => {
        try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* sem permissão */ }
      }}>{copied ? 'Copiado' : 'Copiar'}</Button>
    </div>
  )
}

/**
 * Convida uma pessoa para a equipe de um ou mais experts, com a função dela.
 * Dono: pode criar administradores. Administradores: definem quem gerencia a equipe.
 * Gestor de equipe: adiciona colaboradores só no expert que gerencia (fixedExpertId).
 */
export function InviteModal({ experts, fixedExpertId, initialExpertIds, onClose }: { experts: Expert[]; fixedExpertId?: string; initialExpertIds?: string[]; onClose: () => void }) {
  const { isAdmin, isOwner } = useAuth()
  const { run, busy } = useAction()
  const [d, setD] = useState<InviteInput>({ email: '', full_name: '', funcao: 'closer', expert_ids: fixedExpertId ? [fixedExpertId] : initialExpertIds ?? [], make_admin: false, can_manage_team: false })
  const [result, setResult] = useState<InviteResult | null>(null)
  const set = <K extends keyof InviteInput>(k: K, v: InviteInput[K]) => setD((s) => ({ ...s, [k]: v }))

  const submit = () => run(async () => {
    if (d.full_name.trim().length < 2) throw new Error('Informe o nome.')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email.trim())) throw new Error('Informe um e-mail válido.')
    if (!d.make_admin && !d.expert_ids.length) throw new Error('Selecione pelo menos um expert.')
    const r = await backend.rpc<InviteResult>('invite_member', { ...d })
    await invalidate('profiles', 'user_experts', 'activity_log')
    setResult(r)
  })

  if (result) {
    return (
      <Modal open onClose={onClose} title="Pronto!" footer={<Button variant="primary" onClick={onClose}>Concluir</Button>}>
        <div className="space-y-4 text-sm">
          <div className="flex items-start gap-3">
            <MailCheck className="size-6 text-primary shrink-0" />
            <p>
              {result.status === 'already_admin' ? <><strong>{d.email}</strong> já é administrador e tem acesso a todos os experts.</>
                : result.status === 'linked' ? <>Acesso liberado para <strong>{d.email}</strong>. A pessoa já tinha conta e vê os novos experts no próximo acesso.</>
                : result.email_sent ? <>Convite enviado para <strong>{d.email}</strong>. Pelo link do e-mail a pessoa cria a senha e entra.</>
                : <>Conta criada para <strong>{d.email}</strong>, mas o e-mail não pôde ser enviado agora. Envie este link de acesso para a pessoa (WhatsApp ou e-mail):</>}
            </p>
          </div>
          {result.link && <LinkBox link={result.link} />}
        </div>
      </Modal>
    )
  }

  return (
    <Modal open onClose={onClose} title="Convidar pessoa" subtitle="A pessoa recebe um convite por e-mail para criar a senha."
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={busy} onClick={submit}>Enviar convite</Button></>}>
      <div className="space-y-4">
        <Field label="Nome" required><Input value={d.full_name} onChange={(e) => set('full_name', e.target.value)} /></Field>
        <Field label="E-mail" required><Input type="email" value={d.email} onChange={(e) => set('email', e.target.value)} placeholder="pessoa@empresa.com" /></Field>
        <Field label="Função" required>
          <Select value={d.funcao} onChange={(e) => {
            const f = e.target.value as Funcao
            setD((s) => ({ ...s, funcao: f, can_manage_team: isAdmin && f === 'expert' ? true : s.can_manage_team }))
          }}>
            {FUNCOES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </Select>
        </Field>
        {isOwner && (
          <Field label="Camada de acesso">
            <Select value={d.make_admin ? 'admin' : 'membro'} onChange={(e) => set('make_admin', e.target.value === 'admin')}>
              <option value="membro">Membro: vê só os experts liberados</option>
              <option value="admin">Administrador: vê todos os experts (abaixo de você)</option>
            </Select>
          </Field>
        )}
        {!d.make_admin && !fixedExpertId && (
          <Field label="Experts que a pessoa vai acessar (com todos os projetos)">
            <div className="grid sm:grid-cols-2 gap-2">
              {experts.map((e) => (
                <Checkbox key={e.id} checked={d.expert_ids.includes(e.id)} label={e.full_name}
                  onChange={(v) => set('expert_ids', v ? [...d.expert_ids, e.id] : d.expert_ids.filter((x) => x !== e.id))} />
              ))}
            </div>
          </Field>
        )}
        {!d.make_admin && isAdmin && (
          <Checkbox checked={!!d.can_manage_team} onChange={(v) => set('can_manage_team', v)} label="Pode montar a equipe (adicionar e remover colaboradores) destes experts" />
        )}
      </div>
    </Modal>
  )
}
