import clsx from 'clsx'
import { ArrowDown, ArrowUp, ExternalLink, Eye, FileText, Globe, Pencil, Plus, Send, Sparkles, Trash2, Undo2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '@/app/AppContext'
import { MOVEMENT_STATUS, PROJECT_STATUS } from '@/app/labels'
import { useAuth } from '@/auth/AuthContext'
import { PageHeader } from '@/components/layout/AppLayout'
import { FileUpload, ImageUpload, LinkListInput, RichText, sanitize, TagInput } from '@/components/ui/inputs'
import { Modal, useAction, useConfirm } from '@/components/ui/overlay'
import { Avatar, Badge, Button, Card, Checkbox, EmptyState, Field, IconButton, Input, Select, Textarea } from '@/components/ui/primitives'
import { backend } from '@/data/client'
import { invalidate, useRows } from '@/data/store'
import type { Expert, ExpertProfileContent, Movement } from '@/data/types'
import { dateTime } from '@/lib/format'

const CONTENT_KEYS: (keyof ExpertProfileContent)[] = ['full_name', 'professional_name', 'title', 'bio', 'career_story', 'value_proposition', 'positioning', 'target_audience', 'differentiators', 'authority_topics', 'social_links', 'website', 'videos', 'media']
const pick = (e: Expert): ExpertProfileContent => Object.fromEntries(CONTENT_KEYS.map((k) => [k, e[k]])) as unknown as ExpertProfileContent

export default function PositioningPage() {
  const app = useApp()
  const { isAdmin } = useAuth()
  const [expertId, setExpertId] = useState<string>('')
  const expert = app.experts.find((e) => e.id === (expertId || app.selectedExpert?.id || app.experts[0]?.id))
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="V1 · Autoridade"
        title="Posicionamento"
        subtitle="Apresentação, narrativa e movimentos do expert"
        actions={isAdmin && app.experts.length > 1 && (
          <Select className="!w-auto" value={expert?.id ?? ''} onChange={(e) => setExpertId(e.target.value)} aria-label="Expert">
            {app.experts.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
          </Select>
        )}
      />
      {!expert ? (
        <Card><EmptyState icon={Sparkles} title="Nenhum expert cadastrado" description="Cadastre experts em Configurações → Experts e usuários." /></Card>
      ) : (
        <>
          <ProfileEditor key={expert.id} expert={expert} />
          <Movements expert={expert} />
        </>
      )}
    </div>
  )
}

function ProfileEditor({ expert }: { expert: Expert }) {
  const { isAdmin } = useAuth()
  const { run, busy } = useAction()
  const confirm = useConfirm()
  const canEdit = isAdmin || expert.permissions.can_edit_profile
  const canPhoto = isAdmin || expert.permissions.can_upload_photo
  const published = pick(expert)
  const [d, setD] = useState<ExpertProfileContent>({ ...published, ...(expert.draft ?? {}) })
  const [preview, setPreview] = useState(false)
  useEffect(() => setD({ ...pick(expert), ...(expert.draft ?? {}) }), [expert.updated_at])
  const dirty = JSON.stringify(d) !== JSON.stringify({ ...published, ...(expert.draft ?? {}) })
  const hasDraft = !!expert.draft && Object.keys(expert.draft).length > 0
  const set = <K extends keyof ExpertProfileContent>(k: K, v: ExpertProfileContent[K]) => setD((s) => ({ ...s, [k]: v }))
  const validate = () => {
    if (!d.full_name.trim()) throw new Error('O nome completo é obrigatório.')
    for (const l of [...d.social_links, ...d.videos, ...d.media]) if (l.url && !/^(https?:\/\/|data:)/.test(l.url)) throw new Error(`Link inválido: ${l.url}`)
    if (d.website && !/^https?:\/\//.test(d.website)) throw new Error('O site deve começar com http:// ou https://')
  }
  const saveDraft = () => run(async () => {
    validate()
    const changed = Object.fromEntries(CONTENT_KEYS.filter((k) => JSON.stringify(d[k]) !== JSON.stringify(published[k])).map((k) => [k, d[k]]))
    await backend.update('experts', expert.id, { draft: Object.keys(changed).length ? changed : null })
    await invalidate('experts')
  }, 'Rascunho salvo.')
  const publish = async () => {
    if (!(await confirm({ title: 'Publicar alterações?', message: 'O conteúdo do rascunho passará a ser a apresentação oficial do expert.', confirmLabel: 'Publicar', tone: 'success' }))) return
    run(async () => {
      validate()
      await backend.update('experts', expert.id, { ...d, bio: sanitize(d.bio), draft: null, published_at: new Date().toISOString() })
      await invalidate('experts', 'activity_log')
    }, 'Posicionamento publicado.')
  }
  const discard = async () => {
    if (!(await confirm({ title: 'Descartar rascunho?', message: 'As alterações não publicadas serão perdidas.', tone: 'danger', confirmLabel: 'Descartar' }))) return
    run(async () => { await backend.update('experts', expert.id, { draft: null }); await invalidate('experts') }, 'Rascunho descartado.')
  }

  return (
    <Card className="p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Avatar src={expert.photo_url} name={d.full_name} size={72} className="ring-4 ring-primary/25" />
          <div>
            <h2 className="text-2xl font-extrabold">{d.professional_name || d.full_name}</h2>
            <p className="text-sm text-muted">{d.title || 'Especialidade não informada'}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {hasDraft || dirty ? <Badge tone="warning" dot>Rascunho com alterações não publicadas</Badge> : <Badge tone="success" dot>Publicado</Badge>}
              {expert.published_at && <span className="text-xs text-faint self-center">Publicado em {dateTime(expert.published_at)}</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icon={Eye} onClick={() => setPreview(true)}>Prévia</Button>
          {canEdit && hasDraft && <Button variant="ghost" icon={Undo2} onClick={discard}>Descartar</Button>}
          {canEdit && <Button icon={FileText} loading={busy} disabled={!dirty} onClick={saveDraft}>Salvar rascunho</Button>}
          {canEdit && <Button variant="primary" icon={Send} loading={busy} disabled={!dirty && !hasDraft} onClick={publish}>Publicar</Button>}
        </div>
      </div>
      {!canEdit && <p className="text-xs text-muted mb-4">A edição dos dados pessoais não está liberada para o seu perfil.</p>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Field label="Fotografia principal" hint={canPhoto ? 'A foto é atualizada imediatamente (não passa pelo rascunho).' : 'Alteração de foto não autorizada.'}>
          <ImageUpload value={expert.photo_url} round disabled={!canPhoto} folder={`experts/${expert.id}`} onChange={(url) => run(async () => { await backend.update('experts', expert.id, { photo_url: url }); await invalidate('experts') })} />
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Nome completo" required><Input value={d.full_name} disabled={!canEdit} onChange={(e) => set('full_name', e.target.value)} /></Field>
          <Field label="Nome profissional"><Input value={d.professional_name} disabled={!canEdit} onChange={(e) => set('professional_name', e.target.value)} /></Field>
          <Field label="Cargo ou especialidade" className="sm:col-span-2"><Input value={d.title} disabled={!canEdit} onChange={(e) => set('title', e.target.value)} /></Field>
        </div>
        <Field label="Biografia" className="lg:col-span-2"><RichText value={d.bio} disabled={!canEdit} onChange={(v) => set('bio', v)} /></Field>
        <Field label="História profissional"><Textarea value={d.career_story} disabled={!canEdit} onChange={(e) => set('career_story', e.target.value)} /></Field>
        <Field label="Proposta de valor"><Textarea value={d.value_proposition} disabled={!canEdit} onChange={(e) => set('value_proposition', e.target.value)} /></Field>
        <Field label="Posicionamento estratégico"><Textarea value={d.positioning} disabled={!canEdit} onChange={(e) => set('positioning', e.target.value)} /></Field>
        <Field label="Público-alvo"><Textarea value={d.target_audience} disabled={!canEdit} onChange={(e) => set('target_audience', e.target.value)} /></Field>
        <Field label="Principais diferenciais"><TagInput value={d.differentiators} disabled={!canEdit} onChange={(v) => set('differentiators', v)} /></Field>
        <Field label="Temas de autoridade"><TagInput value={d.authority_topics} disabled={!canEdit} onChange={(v) => set('authority_topics', v)} /></Field>
        <Field label="Redes sociais"><LinkListInput value={d.social_links} disabled={!canEdit} labelPlaceholder="Rede" onChange={(v) => set('social_links', v)} /></Field>
        <div className="space-y-4">
          <Field label="Site oficial"><Input value={d.website} disabled={!canEdit} placeholder="https://" onChange={(e) => set('website', e.target.value)} /></Field>
          <Field label="Vídeos de apresentação"><LinkListInput value={d.videos} disabled={!canEdit} labelPlaceholder="Título" onChange={(v) => set('videos', v)} /></Field>
        </div>
        <Field label="Imagens e documentos" className="lg:col-span-2">
          <div className="space-y-2">
            <LinkListInput value={d.media} disabled={!canEdit} labelPlaceholder="Nome" onChange={(v) => set('media', v)} />
            {canEdit && <FileUpload folder={`experts/${expert.id}/media`} onUploaded={(f) => set('media', [...d.media, { label: f.name, url: f.url }])} />}
          </div>
        </Field>
      </div>
      {preview && <ProfilePreview content={d} photo={expert.photo_url} onClose={() => setPreview(false)} />}
    </Card>
  )
}

function ProfilePreview({ content: c, photo, onClose }: { content: ExpertProfileContent; photo: string | null; onClose: () => void }) {
  const block = (title: string, body: string) => body && <div><h4 className="text-xs font-bold uppercase tracking-widest text-primary mb-1">{title}</h4><p className="text-sm whitespace-pre-line">{body}</p></div>
  return (
    <Modal open onClose={onClose} size="lg" title="Prévia da apresentação" subtitle="Como o posicionamento aparecerá após publicado">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
          <Avatar src={photo} name={c.full_name} size={120} className="ring-4 ring-primary/30" />
          <div>
            <h2 className="text-3xl font-extrabold">{c.professional_name || c.full_name}</h2>
            <p className="text-muted">{c.title}</p>
            <div className="flex flex-wrap gap-2 mt-3 justify-center sm:justify-start">{c.authority_topics.map((t) => <Badge key={t} tone="primary">{t}</Badge>)}</div>
          </div>
        </div>
        {c.bio && <div className="rich text-sm" dangerouslySetInnerHTML={{ __html: sanitize(c.bio) }} />}
        {block('Proposta de valor', c.value_proposition)}
        {block('Posicionamento', c.positioning)}
        {block('Público-alvo', c.target_audience)}
        {block('História profissional', c.career_story)}
        {c.differentiators.length > 0 && <div><h4 className="text-xs font-bold uppercase tracking-widest text-primary mb-2">Diferenciais</h4><ul className="grid sm:grid-cols-2 gap-2">{c.differentiators.map((d) => <li key={d} className="rounded-xl bg-surface-2 border border-line px-3 py-2 text-sm">{d}</li>)}</ul></div>}
        <div className="flex flex-wrap gap-2">
          {c.website && <a href={c.website} target="_blank" rel="noreferrer"><Button size="sm" icon={Globe}>Site</Button></a>}
          {[...c.social_links, ...c.videos].filter((l) => l.url).map((l, i) => <a key={i} href={l.url} target="_blank" rel="noreferrer"><Button size="sm" icon={ExternalLink}>{l.label || 'Link'}</Button></a>)}
        </div>
      </div>
    </Modal>
  )
}

function Movements({ expert }: { expert: Expert }) {
  const { isAdmin } = useAuth()
  const app = useApp()
  const rows = useRows('movements')
  const projects = useRows('projects')
  const navigate = useNavigate()
  const { run } = useAction()
  const confirm = useConfirm()
  const [editing, setEditing] = useState<Partial<Movement> | null>(null)
  const list = useMemo(() => rows.rows.filter((m) => m.expert_id === expert.id && (isAdmin || m.status === 'publicado' || m.expert_editable)).sort((a, b) => a.sort_order - b.sort_order), [rows.rows, expert.id, isAdmin])
  const canEditMv = (m: Movement) => isAdmin || (m.expert_editable && expert.permissions.can_edit_movements)

  const openMovement = (m: Movement) => {
    if (m.project_id) {
      const p = projects.rows.find((x) => x.id === m.project_id)
      if (!p) return run(async () => { throw new Error('O projeto vinculado não está disponível para o seu perfil.') })
      if (!p.archived) app.setProjectId(p.id)
      navigate(`/projetos/${p.id}`)
    } else if (m.external_url) window.open(m.external_url, '_blank', 'noopener')
  }
  const reorder = (m: Movement, dir: -1 | 1) => {
    const idx = list.findIndex((x) => x.id === m.id)
    const other = list[idx + dir]
    if (!other) return
    run(async () => {
      await backend.update('movements', m.id, { sort_order: other.sort_order })
      await backend.update('movements', other.id, { sort_order: m.sort_order === other.sort_order ? m.sort_order + dir : m.sort_order })
      await invalidate('movements')
    })
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight">Movimentos</h2>
          <p className="text-sm text-muted">Iniciativas do expert. Clique em um card para abrir o projeto vinculado.</p>
        </div>
        {isAdmin && <Button variant="primary" icon={Plus} onClick={() => setEditing({ expert_id: expert.id, name: '', description: '', category: '', status: 'rascunho', sort_order: (list.at(-1)?.sort_order ?? 0) + 1, project_id: null, external_url: '', cover_url: null, expert_editable: false, is_demo: false })}>Novo movimento</Button>}
      </div>
      {list.length === 0 ? (
        <Card><EmptyState icon={Sparkles} title="Nenhum movimento publicado" description={isAdmin ? 'Crie cards para apresentar eventos, mentorias, conteúdos e outras iniciativas.' : 'A administração ainda não publicou movimentos.'} /></Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {list.map((m, i) => {
            const proj = projects.rows.find((p) => p.id === m.project_id)
            return (
              <div key={m.id} className={clsx('card overflow-hidden group flex flex-col animate-fade-up', m.status === 'desativado' && 'opacity-60')}>
                <button onClick={() => openMovement(m)} className="relative aspect-[4/3] bg-surface-3 text-left" aria-label={`Abrir ${m.name}`}>
                  {m.cover_url && <img src={m.cover_url} alt="" className="absolute inset-0 size-full object-cover group-hover:scale-[1.03] transition duration-500" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                  <div className="absolute top-3 left-3 flex gap-1.5">{m.category && <Badge className="!bg-bg/80">{m.category}</Badge>}{isAdmin && <Badge tone={MOVEMENT_STATUS[m.status].tone} className="!bg-bg/80">{MOVEMENT_STATUS[m.status].label}</Badge>}</div>
                  <div className="absolute bottom-3 left-4 right-4">
                    <h3 className="text-lg font-extrabold leading-tight">{m.name}</h3>
                    <p className="text-xs text-white/75 line-clamp-2 mt-0.5">{m.description}</p>
                  </div>
                </button>
                <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                  {proj ? <span className="truncate text-muted">Projeto: <span className="text-ink font-semibold">{proj.name}</span> <Badge tone={PROJECT_STATUS[proj.status].tone} className="!text-[10px] ml-1">{proj.archived ? 'Arquivado' : PROJECT_STATUS[proj.status].label}</Badge></span>
                    : m.external_url ? <span className="text-primary inline-flex items-center gap-1"><ExternalLink className="size-3" />Link externo</span> : <span className="text-faint">Sem vínculo</span>}
                  {canEditMv(m) && (
                    <div className="flex shrink-0">
                      {isAdmin && <IconButton icon={ArrowUp} label="Mover para cima" disabled={i === 0} onClick={() => reorder(m, -1)} />}
                      {isAdmin && <IconButton icon={ArrowDown} label="Mover para baixo" disabled={i === list.length - 1} onClick={() => reorder(m, 1)} />}
                      <IconButton icon={Pencil} label="Editar" onClick={() => setEditing(m)} />
                      {isAdmin && <IconButton icon={Trash2} label="Remover" onClick={async () => {
                        if (await confirm({ title: 'Remover movimento?', message: `"${m.name}" será removido.`, tone: 'danger', confirmLabel: 'Remover' }))
                          run(async () => { await backend.remove('movements', m.id); await invalidate('movements', 'activity_log') }, 'Movimento removido.')
                      }} />}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
      {editing && <MovementForm value={editing} expert={expert} onClose={() => setEditing(null)} />}
    </div>
  )
}

function MovementForm({ value, expert, onClose }: { value: Partial<Movement>; expert: Expert; onClose: () => void }) {
  const { isAdmin } = useAuth()
  const app = useApp()
  const { run, busy } = useAction()
  const [d, setD] = useState(value)
  const set = <K extends keyof Movement>(k: K, v: Movement[K]) => setD((s) => ({ ...s, [k]: v }))
  const save = () => run(async () => {
    if (!d.name?.trim()) throw new Error('Informe o nome do movimento.')
    if (d.external_url && !/^https?:\/\//.test(d.external_url)) throw new Error('O link externo deve começar com http:// ou https://')
    if (d.id) await backend.update('movements', d.id, d)
    else await backend.insert('movements', d)
    await invalidate('movements', 'activity_log')
    onClose()
  }, 'Movimento salvo.')
  return (
    <Modal open onClose={onClose} size="lg" title={d.id ? 'Editar movimento' : 'Novo movimento'} footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={busy} onClick={save}>Salvar</Button></>}>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Nome do movimento" required className="sm:col-span-2"><Input value={d.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="Fotografia ou capa" className="sm:col-span-2"><ImageUpload value={d.cover_url} aspect={4 / 3} folder="movements" onChange={(v) => set('cover_url', v)} /></Field>
        <Field label="Descrição curta" className="sm:col-span-2"><Textarea className="!min-h-16" value={d.description} onChange={(e) => set('description', e.target.value)} /></Field>
        <Field label="Categoria"><Input value={d.category} onChange={(e) => set('category', e.target.value)} placeholder="Evento, mentoria, conteúdo..." /></Field>
        <Field label="Projeto vinculado">
          <Select value={d.project_id ?? ''} disabled={!isAdmin} onChange={(e) => set('project_id', e.target.value || null)}>
            <option value="">Nenhum</option>
            {app.projects.filter((p) => p.expert_id === expert.id).map((p) => <option key={p.id} value={p.id}>{p.name}{p.archived ? ' (arquivado)' : ''}</option>)}
          </Select>
        </Field>
        <Field label="Status">
          <Select value={d.status} disabled={!isAdmin} onChange={(e) => set('status', e.target.value as Movement['status'])}>{Object.entries(MOVEMENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select>
        </Field>
        <Field label="Ordem de exibição"><Input type="number" value={d.sort_order} disabled={!isAdmin} onChange={(e) => set('sort_order', +e.target.value)} /></Field>
        <Field label="Link externo (opcional)" className="sm:col-span-2" hint="Usado quando o movimento não está vinculado a um projeto."><Input value={d.external_url} placeholder="https://" onChange={(e) => set('external_url', e.target.value)} /></Field>
        {isAdmin && <div className="sm:col-span-2"><Checkbox checked={!!d.expert_editable} onChange={(v) => set('expert_editable', v)} label="Permitir que o expert edite este movimento" /></div>}
      </div>
    </Modal>
  )
}
