import { Check, Copy, Download, ExternalLink, Link2Off, MessageSquareWarning, Pencil, Rocket, Share2, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useApp } from '@/app/AppContext'
import { useAuth } from '@/auth/AuthContext'
import { MoneyInput } from '@/components/ui/inputs'
import { Modal, useAction, useConfirm } from '@/components/ui/overlay'
import { Badge, Button, Card, Checkbox, EmptyState, Field, IconButton, Input, Segmented, Select, Skeleton, Textarea } from '@/components/ui/primitives'
import { backend } from '@/data/client'
import { invalidate, useRows } from '@/data/store'
import type { Creative, CreativeContent, CreativeFormat, CreativeLayout, FieldConfig, Project } from '@/data/types'
import { creativesUrl, eventUrl, FORMATS, LAYOUTS } from '@/lib/campaign'
import { dateTime } from '@/lib/format'
import { downloadUrl, Lightbox } from '../sections/Gallery'
import { CampaignWizard } from './CampaignWizard'
import { ArtPreview } from './CreativeArt'
import { regenerateCreative } from './generate'
import { PeoplePicker, useCanManageProject } from './PhotoBank'

const STATUS: Record<Creative['status'], { label: string; tone: 'neutral' | 'success' | 'warning' }> = {
  rascunho: { label: 'Rascunho', tone: 'neutral' },
  aprovado: { label: 'Aprovado', tone: 'success' },
  ajuste: { label: 'Em ajuste', tone: 'warning' },
}
const IMG_FIELDS: FieldConfig[] = [
  { key: 'titulo', type: 'text', label: 'Criativo', options: [], required: true, filterable: false, show_in_card: true, show_in_table: true },
  { key: 'imagem', type: 'image', label: 'Imagem', options: [], required: true, filterable: false, show_in_card: true, show_in_table: true },
]

/** Aba Criativos do projeto: campanha atual, criativos gerados (aprovar, editar, pedir ajuste) e link público. */
export function CreativesTab({ project }: { project: Project }) {
  const creatives = useRows('creatives')
  const updates = useRows('project_updates')
  const canManage = useCanManageProject(project)
  const { run } = useAction()
  const confirm = useConfirm()
  const [wizard, setWizard] = useState(false)
  const [filter, setFilter] = useState<'todos' | Creative['status']>('todos')
  const [zoom, setZoom] = useState<number | null>(null)
  const [editing, setEditing] = useState<Creative | null>(null)
  const [adjusting, setAdjusting] = useState<Creative | null>(null)
  const [sharing, setSharing] = useState(false)

  const all = useMemo(() => creatives.rows.filter((c) => c.project_id === project.id).sort((a, b) => b.created_at.localeCompare(a.created_at)), [creatives.rows, project.id])
  const list = all.filter((c) => filter === 'todos' || c.status === filter)
  const history = updates.rows.filter((u) => u.project_id === project.id && u.status === 'publicado').sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))
  const current = history[0]
  const count = (s: Creative['status']) => all.filter((c) => c.status === s).length

  const setStatus = (c: Creative, status: Creative['status']) => run(async () => { await backend.update('creatives', c.id, { status }); await invalidate('creatives') }, status === 'aprovado' ? 'Criativo aprovado.' : 'Status atualizado.')
  const approveAll = () => run(async () => {
    for (const c of all.filter((x) => x.status === 'rascunho')) await backend.update('creatives', c.id, { status: 'aprovado' })
    await invalidate('creatives')
  }, 'Rascunhos aprovados.')
  const remove = async (c: Creative) => {
    if (!(await confirm({ title: 'Excluir criativo?', message: 'O criativo sai da galeria e do link público.', tone: 'danger', confirmLabel: 'Excluir' }))) return
    run(async () => { await backend.remove('creatives', c.id); await invalidate('creatives') }, 'Criativo excluído.')
  }

  return (
    <div className="space-y-5">
      <Card className="p-5 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-60">
          <div className="text-xs font-bold uppercase tracking-widest text-primary mb-1">Campanha atual</div>
          {current ? (
            <>
              <div className="font-bold">{current.headline}</div>
              <div className="text-sm text-muted">Publicada em {dateTime(current.published_at!)} · {history.length} versão(ões)</div>
            </>
          ) : <div className="text-sm text-muted">Nenhuma campanha publicada ainda. Clique em "Atualizar campanha" para criar a página e os criativos.</div>}
        </div>
        {project.public_slug && current && <a href={eventUrl(project.public_slug)} target="_blank" rel="noreferrer"><Button icon={ExternalLink}>Ver página</Button></a>}
        {canManage && <Button icon={Share2} onClick={() => setSharing(true)}>Link público dos criativos</Button>}
        {canManage && <Button variant="primary" icon={Rocket} onClick={() => setWizard(true)}>Atualizar campanha</Button>}
      </Card>

      {creatives.loading ? <Skeleton className="h-64" /> : all.length === 0 ? (
        <Card><EmptyState icon={Rocket} title="Nenhum criativo ainda" description={canManage ? 'Use "Atualizar campanha" para gerar os criativos e a página do evento.' : 'Os criativos deste projeto aparecem aqui quando forem gerados.'}
          action={canManage && <Button variant="primary" icon={Rocket} onClick={() => setWizard(true)}>Atualizar campanha</Button>} /></Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented size="sm" value={filter} onChange={setFilter} options={[
              { value: 'todos', label: `Todos (${all.length})` }, { value: 'rascunho', label: `Rascunho (${count('rascunho')})` },
              { value: 'aprovado', label: `Aprovados (${count('aprovado')})` }, { value: 'ajuste', label: `Em ajuste (${count('ajuste')})` },
            ]} />
            {canManage && count('rascunho') > 0 && <Button size="sm" variant="ghost" icon={Check} className="ml-auto" onClick={approveAll}>Aprovar todos os rascunhos</Button>}
          </div>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {list.map((c, i) => (
              <figure key={c.id} className="rounded-2xl overflow-hidden border border-line bg-surface-2">
                <button type="button" className="block w-full bg-black/40 cursor-zoom-in" onClick={() => setZoom(i)}>
                  {c.image_url ? <img src={c.image_url} alt="" loading="lazy" className="w-full h-auto block" /> : <div className="aspect-[4/5]" />}
                </button>
                <figcaption className="p-4 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Badge>
                    <span className="text-xs text-muted">{LAYOUTS.find((l) => l.value === c.layout)?.label} · {FORMATS.find((f) => f.value === c.format)?.label} · {c.angle}</span>
                  </div>
                  {c.status === 'ajuste' && c.notes && <p className="text-xs text-warning bg-warning/10 rounded-lg p-2">Ajuste pedido: {c.notes}</p>}
                  <div className="flex items-center gap-1">
                    {canManage && c.status !== 'aprovado' && <Button size="sm" variant="primary" icon={Check} onClick={() => setStatus(c, 'aprovado')}>Aprovar</Button>}
                    {canManage && c.status === 'aprovado' && <Button size="sm" variant="ghost" onClick={() => setStatus(c, 'rascunho')}>Voltar a rascunho</Button>}
                    <div className="flex-1" />
                    {c.image_url && <IconButton icon={Download} label="Baixar" onClick={() => downloadUrl(c.image_url!, `criativo-${c.layout}-${c.format}`)} />}
                    {canManage && <IconButton icon={Pencil} label="Editar" onClick={() => setEditing(c)} />}
                    {canManage && <IconButton icon={MessageSquareWarning} label="Pedir ajuste com anotações" onClick={() => setAdjusting(c)} />}
                    {canManage && <IconButton icon={Trash2} label="Excluir" onClick={() => remove(c)} />}
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </>
      )}

      {zoom !== null && list[zoom] && (
        <Lightbox fields={IMG_FIELDS} items={list.map((c) => ({ titulo: `${LAYOUTS.find((l) => l.value === c.layout)?.label} · ${c.angle}`, imagem: c.image_url }))} index={zoom} onIndex={setZoom} onClose={() => setZoom(null)} />
      )}
      {wizard && <CampaignWizard project={project} onClose={() => setWizard(false)} onDone={() => { setWizard(false); setFilter('rascunho') }} />}
      {editing && <EditCreative project={project} creative={editing} onClose={() => setEditing(null)} />}
      {adjusting && <AdjustCreative project={project} creative={adjusting} onClose={() => setAdjusting(null)} />}
      {sharing && <ShareCreatives project={project} onClose={() => setSharing(false)} />}
    </div>
  )
}

/** Editar textos, preço, pessoas, modelo e formato; desenha a imagem de novo ao salvar. */
function EditCreative({ project, creative, onClose }: { project: Project; creative: Creative; onClose: () => void }) {
  const bank = useRows('creative_people')
  const { run, busy } = useAction()
  const [c, setC] = useState<CreativeContent>(creative.content)
  const [layout, setLayout] = useState<CreativeLayout>(creative.layout)
  const [format, setFormat] = useState<CreativeFormat>(creative.format)
  const set = <K extends keyof CreativeContent>(k: K, v: CreativeContent[K]) => setC((s) => ({ ...s, [k]: v }))
  const people = c.person_ids.map((id) => bank.rows.find((p) => p.id === id)).filter(Boolean) as typeof bank.rows
  const save = () => run(async () => {
    await regenerateCreative(project, creative, { content: c, layout, format }, bank.rows)
    await invalidate('creatives')
    onClose()
  }, 'Criativo atualizado.')
  return (
    <Modal open onClose={busy ? () => {} : onClose} size="xl" title="Editar criativo"
      footer={<><Button variant="ghost" onClick={onClose} disabled={busy}>Cancelar</Button><Button variant="primary" loading={busy} onClick={save}>Salvar e gerar a imagem</Button></>}>
      <div className="grid lg:grid-cols-[1fr_300px] gap-5">
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Modelo"><Select value={layout} onChange={(e) => setLayout(e.target.value as CreativeLayout)}>{LAYOUTS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}</Select></Field>
            <Field label="Formato"><Select value={format} onChange={(e) => setFormat(e.target.value as CreativeFormat)}>{FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}</Select></Field>
          </div>
          <Field label="Chamada (topo)"><Input value={c.kicker} onChange={(e) => set('kicker', e.target.value)} /></Field>
          <Field label="Headline"><Textarea rows={2} value={c.headline} onChange={(e) => set('headline', e.target.value)} /></Field>
          <Field label="Subheadline"><Textarea rows={2} value={c.subheadline} onChange={(e) => set('subheadline', e.target.value)} /></Field>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Data"><Input value={c.date_label} onChange={(e) => set('date_label', e.target.value)} /></Field>
            <Field label="Local / formato"><Input value={c.location_label} onChange={(e) => set('location_label', e.target.value)} /></Field>
          </div>
          <Checkbox checked={c.show_price} onChange={(v) => set('show_price', v)} label="Mostrar preço" />
          {c.show_price && (
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="A partir de"><MoneyInput value={c.price} onChange={(v) => set('price', v)} /></Field>
              <Field label="Valor cheio (riscado)"><MoneyInput value={c.full_price} onChange={(v) => set('full_price', v)} /></Field>
            </div>
          )}
          <Field label="Texto do botão"><Input value={c.cta} onChange={(e) => set('cta', e.target.value)} /></Field>
          <Field label="Quem aparece"><PeoplePicker selected={c.person_ids} onChange={(ids) => set('person_ids', ids)} /></Field>
        </div>
        <div className="lg:sticky lg:top-0 self-start">
          <div className="text-xs text-muted mb-2">Prévia</div>
          <ArtPreview width={300} format={format} layout={layout} content={c} people={people} />
        </div>
      </div>
    </Modal>
  )
}

/** Pedido de ajuste: guarda a anotação no criativo e cria uma tarefa no projeto. */
function AdjustCreative({ project, creative, onClose }: { project: Project; creative: Creative; onClose: () => void }) {
  const { run, busy } = useAction()
  const [notes, setNotes] = useState(creative.notes)
  const save = () => run(async () => {
    if (!notes.trim()) throw new Error('Escreva o que precisa ser ajustado.')
    await backend.update('creatives', creative.id, { status: 'ajuste', notes: notes.trim() })
    const today = new Date().toISOString().slice(0, 10)
    await backend.insert('tasks', {
      project_id: project.id, phase_number: null, title: `Ajustar criativo (${LAYOUTS.find((l) => l.value === creative.layout)?.label} · ${creative.format === 'feed' ? 'feed' : 'stories'})`,
      description: `${notes.trim()}\n\nImagem atual: ${creative.image_url ?? '—'}`, assignee: '', priority: 'alta', start_date: today, due_date: today,
      status: 'a_fazer', checklist: [], sort_order: 0, is_demo: false,
    })
    await invalidate('creatives', 'tasks', 'activity_log')
    onClose()
  }, 'Ajuste registrado e tarefa criada.')
  return (
    <Modal open onClose={onClose} title="Pedir ajuste" subtitle="A anotação fica no criativo e vira uma tarefa no projeto. Você também pode editar o criativo direto pelo lápis."
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={busy} onClick={save}>Registrar ajuste</Button></>}>
      <div className="grid sm:grid-cols-[160px_1fr] gap-4">
        {creative.image_url && <img src={creative.image_url} alt="" className="rounded-xl w-full" />}
        <Field label="O que ajustar"><Textarea rows={6} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: deixar a headline mais curta, trocar a foto pela do Pablo e tirar o preço." /></Field>
      </div>
    </Modal>
  )
}

/** Link público com os criativos aprovados deste projeto. */
function ShareCreatives({ project, onClose }: { project: Project; onClose: () => void }) {
  const app = useApp()
  const { isAdmin } = useAuth()
  const { run, busy } = useAction()
  const token = app.projects.find((p) => p.id === project.id)?.creatives_share_token ?? project.creatives_share_token
  const [copied, setCopied] = useState(false)
  const setToken = (t: string | null) => run(async () => { await backend.update('projects', project.id, { creatives_share_token: t }); await invalidate('projects') }, t ? 'Link público criado.' : 'Link público desativado.')
  return (
    <Modal open onClose={onClose} title="Link público dos criativos" subtitle="Mostra só os criativos aprovados deste projeto, com download. Não precisa de conta.">
      {!isAdmin && !token ? <p className="text-sm text-muted">Peça a um administrador para gerar o link deste projeto.</p> : token ? (
        <div className="space-y-4">
          <div className="flex gap-2"><Input readOnly value={creativesUrl(token)} onFocus={(e) => e.currentTarget.select()} />
            <Button icon={Copy} onClick={async () => { try { await navigator.clipboard.writeText(creativesUrl(token)); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* sem permissão */ } }}>{copied ? 'Copiado!' : 'Copiar'}</Button></div>
          <div className="flex flex-wrap gap-2">
            <a href={creativesUrl(token)} target="_blank" rel="noreferrer"><Button icon={ExternalLink}>Abrir</Button></a>
            {isAdmin && <Button variant="ghost" icon={Link2Off} loading={busy} onClick={() => setToken(null)}>Desativar link</Button>}
          </div>
        </div>
      ) : <Button variant="primary" icon={Share2} loading={busy} onClick={() => setToken(crypto.randomUUID())}>Gerar link público</Button>}
    </Modal>
  )
}
