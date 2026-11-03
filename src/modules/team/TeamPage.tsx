import { KeyRound, Link2, Trash2, UserPlus, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useApp } from '@/app/AppContext'
import { useAuth } from '@/auth/AuthContext'
import { PageHeader } from '@/components/layout/AppLayout'
import { Modal, useAction, useConfirm } from '@/components/ui/overlay'
import { Avatar, Badge, Button, Card, EmptyState, IconButton, Select, Skeleton } from '@/components/ui/primitives'
import { backend } from '@/data/client'
import { invalidate, useRows } from '@/data/store'
import type { Funcao, Profile, UserExpert } from '@/data/types'
import { FUNCOES, funcaoLabel } from '@/lib/funcoes'
import { InviteModal, LinkBox } from './InviteModal'

/** Equipe de cada expert: quem tem acesso, com qual função. Admins e gestores da equipe adicionam e removem pessoas. */
export default function TeamPage() {
  const app = useApp()
  const { user, isAdmin } = useAuth()
  const links = useRows('user_experts')
  const profiles = useRows('profiles')
  const [expertId, setExpertId] = useState<string>(() => app.selectedExpert?.id ?? app.experts[0]?.id ?? '')
  const [inviting, setInviting] = useState(false)
  const [accessLink, setAccessLink] = useState<{ name: string; link: string } | null>(null)
  const { run } = useAction()
  const confirm = useConfirm()

  const expert = app.experts.find((e) => e.id === expertId) ?? app.experts[0]
  const myLink = links.rows.find((l) => l.user_id === user?.id && l.expert_id === expert?.id)
  const canManage = isAdmin || !!myLink?.can_manage_team
  const team = useMemo(() => {
    if (!expert) return []
    return links.rows
      .filter((l) => l.expert_id === expert.id)
      .map((l) => ({ link: l, profile: profiles.rows.find((p) => p.id === l.user_id) }))
      .filter((m): m is { link: UserExpert; profile: Profile } => !!m.profile)
      .sort((a, b) => Number(!!b.link.can_manage_team) - Number(!!a.link.can_manage_team) || a.profile.full_name.localeCompare(b.profile.full_name))
  }, [links.rows, profiles.rows, expert])

  const update = (l: UserExpert, patch: Partial<UserExpert>, msg: string) =>
    run(async () => { await backend.update('user_experts', l.id, patch); await invalidate('user_experts', 'activity_log') }, msg)
  const remove = async (m: { link: UserExpert; profile: Profile }) => {
    if (!(await confirm({ title: 'Remover da equipe?', message: `${m.profile.full_name} perde o acesso a ${expert!.full_name} e aos projetos dele.`, tone: 'danger', confirmLabel: 'Remover' }))) return
    run(async () => { await backend.remove('user_experts', m.link.id); await invalidate('user_experts', 'activity_log') }, 'Acesso removido.')
  }
  const newLink = (p: Profile) => run(async () => {
    const r = await backend.rpc<{ link: string }>('invite_link', { user_id: p.id })
    setAccessLink({ name: p.full_name, link: r.link })
  })

  if (!app.experts.length) return <EmptyState icon={Users} title="Nenhum expert disponível" description="Quando um expert for liberado para você, a equipe dele aparece aqui." />

  return (
    <div>
      <PageHeader eyebrow="Pessoas" title="Equipe" subtitle="Quem trabalha em cada expert e em qual função"
        actions={canManage && <Button variant="primary" icon={UserPlus} onClick={() => setInviting(true)}>Adicionar colaborador</Button>} />
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <Select className="!w-auto min-w-60" value={expert?.id ?? ''} onChange={(e) => setExpertId(e.target.value)} aria-label="Expert">
          {app.experts.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
        </Select>
        {expert && <span className="text-sm text-muted">{team.length} pessoa(s) · {app.projects.filter((p) => p.expert_id === expert.id).length} projeto(s)</span>}
      </div>

      {links.loading || profiles.loading ? <Skeleton className="h-64" /> : team.length === 0 ? (
        <Card><EmptyState icon={Users} title="Equipe vazia" description={canManage ? 'Adicione o expert e os colaboradores com a função de cada um.' : 'Ainda não há pessoas nesta equipe.'}
          action={canManage && <Button variant="primary" icon={UserPlus} onClick={() => setInviting(true)}>Adicionar colaborador</Button>} /></Card>
      ) : (
        <Card className="divide-y divide-line">
          {team.map((m) => {
            const editable = canManage && m.profile.id !== user?.id && (isAdmin || !m.link.can_manage_team)
            const funcao = (m.link.funcao ?? m.profile.funcao) as Funcao | null
            return (
              <div key={m.link.id} className="p-4 flex flex-wrap items-center gap-3">
                <Avatar src={m.profile.avatar_url} name={m.profile.full_name} size={40} />
                <div className="flex-1 min-w-48">
                  <div className="font-semibold flex flex-wrap items-center gap-1.5">
                    {m.profile.full_name}
                    {m.link.can_manage_team && <Badge tone="primary">Gestor da equipe</Badge>}
                    {!m.profile.activated_at && <Badge tone="warning">Convite pendente</Badge>}
                  </div>
                  <div className="text-xs text-muted">{m.profile.email}</div>
                </div>
                {editable ? (
                  <Select className="!w-auto" value={funcao ?? ''} onChange={(e) => update(m.link, { funcao: e.target.value as Funcao }, 'Função atualizada.')} aria-label="Função">
                    {!funcao && <option value="">Sem função</option>}
                    {FUNCOES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </Select>
                ) : <Badge>{funcaoLabel(funcao)}</Badge>}
                {isAdmin && m.profile.id !== user?.id && (
                  <IconButton icon={KeyRound} label={m.link.can_manage_team ? 'Tirar gestão da equipe' : 'Tornar gestor da equipe'}
                    onClick={() => update(m.link, { can_manage_team: !m.link.can_manage_team }, m.link.can_manage_team ? 'Gestão da equipe removida.' : 'Agora pode montar a equipe.')} />
                )}
                {editable && !m.profile.activated_at && <IconButton icon={Link2} label="Gerar link de acesso" onClick={() => newLink(m.profile)} />}
                {editable && <IconButton icon={Trash2} label="Remover da equipe" onClick={() => remove(m)} />}
              </div>
            )
          })}
        </Card>
      )}

      {inviting && expert && <InviteModal experts={app.experts} fixedExpertId={isAdmin ? undefined : expert.id} initialExpertIds={[expert.id]} onClose={() => setInviting(false)} />}
      {accessLink && (
        <Modal open onClose={() => setAccessLink(null)} title={`Link de acesso · ${accessLink.name}`} subtitle="Envie para a pessoa. Pelo link ela entra e cria a senha. O link vale por tempo limitado e funciona uma vez.">
          <LinkBox link={accessLink.link} />
        </Modal>
      )}
    </div>
  )
}
