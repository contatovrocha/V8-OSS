import { Link2, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { useApp } from '@/app/AppContext'
import { useAuth } from '@/auth/AuthContext'
import { Modal, useAction } from '@/components/ui/overlay'
import { Avatar, Badge, Button, Card, Checkbox, IconButton, Select } from '@/components/ui/primitives'
import { backend } from '@/data/client'
import { invalidate, useRows } from '@/data/store'
import type { Funcao, Profile, Role } from '@/data/types'
import { FUNCOES, funcaoLabel, ROLE_LABEL } from '@/lib/funcoes'
import { InviteModal, LinkBox } from './InviteModal'

const ROLE_TONE: Record<Role, 'primary' | 'success' | 'neutral'> = { owner: 'success', admin: 'primary', expert: 'neutral' }

/** Todos os usuários (visão do administrador): camada, função, experts liberados e convites. */
export function UsersAdmin() {
  const app = useApp()
  const { user: me, isOwner } = useAuth()
  const profiles = useRows('profiles')
  const links = useRows('user_experts')
  const { run } = useAction()
  const [inviting, setInviting] = useState(false)
  const [access, setAccess] = useState<Profile | null>(null)
  const [accessLink, setAccessLink] = useState<{ name: string; link: string } | null>(null)

  const sorted = [...profiles.rows].sort((a, b) => ['owner', 'admin', 'expert'].indexOf(a.role) - ['owner', 'admin', 'expert'].indexOf(b.role) || a.full_name.localeCompare(b.full_name))
  const setRole = (p: Profile, role: Role) => run(async () => { await backend.update('profiles', p.id, { role }); await invalidate('profiles', 'activity_log') }, role === 'admin' ? `${p.full_name} agora é administrador.` : `${p.full_name} agora é membro.`)
  const newLink = (p: Profile) => run(async () => {
    const r = await backend.rpc<{ link: string }>('invite_link', { user_id: p.id })
    setAccessLink({ name: p.full_name, link: r.link })
  })

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-bold">Usuários</h3>
        <Button size="sm" variant="primary" icon={UserPlus} onClick={() => setInviting(true)}>Convidar pessoa</Button>
      </div>
      <p className="text-xs text-muted mb-4">Dono: tudo · Administrador: todos os experts · Membro: só os experts liberados (e todos os projetos deles).</p>
      <ul className="divide-y divide-line">
        {sorted.map((p) => {
          const mine = links.rows.filter((l) => l.user_id === p.id)
          return (
            <li key={p.id} className="py-3 flex flex-wrap items-center gap-3">
              <Avatar src={p.avatar_url} name={p.full_name} size={36} />
              <div className="flex-1 min-w-48">
                <div className="font-semibold flex flex-wrap items-center gap-1.5">
                  {p.full_name}
                  <Badge tone={ROLE_TONE[p.role]}>{ROLE_LABEL[p.role]}</Badge>
                  {p.funcao && <Badge>{funcaoLabel(p.funcao)}</Badge>}
                  {!p.activated_at && p.id !== me?.id && <Badge tone="warning">Convite pendente</Badge>}
                </div>
                <div className="text-xs text-muted truncate">
                  {p.email}
                  {p.role === 'expert' && ` · ${mine.length ? mine.map((l) => app.experts.find((e) => e.id === l.expert_id)?.full_name + (l.can_manage_team ? ' (gestor)' : '')).join(', ') : 'aguardando liberação'}`}
                </div>
              </div>
              {isOwner && p.role !== 'owner' && (
                <Select className="!w-auto" value={p.role} onChange={(e) => setRole(p, e.target.value as Role)} aria-label="Camada">
                  <option value="expert">Membro</option>
                  <option value="admin">Administrador</option>
                </Select>
              )}
              {p.role === 'expert' && <Button size="sm" variant="ghost" onClick={() => setAccess(p)}>Acessos</Button>}
              {!p.activated_at && p.id !== me?.id && p.role !== 'owner' && <IconButton icon={Link2} label="Gerar link de acesso" onClick={() => newLink(p)} />}
            </li>
          )
        })}
      </ul>

      {inviting && <InviteModal experts={app.experts} onClose={() => setInviting(false)} />}
      {access && <AccessModal profile={access} onClose={() => setAccess(null)} />}
      {accessLink && (
        <Modal open onClose={() => setAccessLink(null)} title={`Link de acesso · ${accessLink.name}`} subtitle="Envie para a pessoa. Pelo link ela entra e cria a senha. O link vale por tempo limitado e funciona uma vez.">
          <LinkBox link={accessLink.link} />
        </Modal>
      )}
    </Card>
  )
}

/** Quais experts o membro acessa, com a função em cada um e se monta a equipe. */
function AccessModal({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const app = useApp()
  const links = useRows('user_experts')
  const { run } = useAction()
  const refresh = () => invalidate('user_experts', 'activity_log')
  return (
    <Modal open onClose={onClose} size="lg" title={`Acessos · ${profile.full_name}`} subtitle="Marque os experts (e todos os projetos deles) que esta pessoa pode acessar.">
      <div className="divide-y divide-line">
        {app.experts.map((e) => {
          const link = links.rows.find((l) => l.user_id === profile.id && l.expert_id === e.id)
          return (
            <div key={e.id} className="py-3 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-40"><Checkbox checked={!!link} label={e.full_name} onChange={(v) => run(async () => {
                if (v) await backend.insert('user_experts', { user_id: profile.id, expert_id: e.id, funcao: profile.funcao ?? null, can_manage_team: profile.funcao === 'expert' })
                else if (link) await backend.remove('user_experts', link.id)
                await refresh()
              }, v ? 'Acesso liberado.' : 'Acesso removido.')} /></div>
              {link && (
                <>
                  <Select className="!w-auto" value={link.funcao ?? ''} onChange={(ev) => run(async () => { await backend.update('user_experts', link.id, { funcao: (ev.target.value || null) as Funcao | null }); await refresh() }, 'Função atualizada.')} aria-label="Função neste expert">
                    <option value="">Sem função</option>
                    {FUNCOES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </Select>
                  <Checkbox checked={!!link.can_manage_team} label="Monta a equipe" onChange={(v) => run(async () => { await backend.update('user_experts', link.id, { can_manage_team: v }); await refresh() }, 'Permissão atualizada.')} />
                </>
              )}
            </div>
          )
        })}
      </div>
    </Modal>
  )
}
