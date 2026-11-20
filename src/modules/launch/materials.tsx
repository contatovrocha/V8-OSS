import { Copy, ExternalLink, Eye, FileText, Link2, Send } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { Modal, useAction, useToast } from '@/components/ui/overlay'
import { Badge, Button, Progress } from '@/components/ui/primitives'
import { backend } from '@/data/client'
import { invalidate, useRows } from '@/data/store'
import type { BrandDoc, Expert, Project } from '@/data/types'
import { answeredCount, BRAND_QUESTIONS, BRAND_SECTIONS, brandDocUrl } from '@/lib/brandDoc'
import { creativesUrl, eventUrl } from '@/lib/campaign'
import { dateTime, money } from '@/lib/format'
import { funcaoLabel } from '@/lib/funcoes'
import type { StageAsset } from '@/lib/launchStages'
import { useCanManageProject } from '../creatives/PhotoBank'

const PAGE_STATUS: Record<string, { label: string; tone: 'neutral' | 'primary' | 'accent' | 'success' | 'warning' }> = {
  planejada: { label: 'Planejada', tone: 'neutral' },
  producao: { label: 'Em produção', tone: 'primary' },
  revisao: { label: 'Em revisão', tone: 'warning' },
  publicada: { label: 'Publicada', tone: 'success' },
  pausada: { label: 'Pausada', tone: 'neutral' },
}

/** Tudo o que já existe no sistema para o projeto, agrupado para as etapas do processo. */
export function useMaterials(project: Project, expert: Expert | undefined) {
  const pages = useRows('pages')
  const pageTypes = useRows('page_types')
  const creatives = useRows('creatives')
  const accounts = useRows('ad_accounts')
  const products = useRows('products')
  const updates = useRows('project_updates')
  const campaigns = useRows('campaigns')
  const ads = useRows('ads')
  const metrics = useRows('ad_metrics_daily')
  const links = useRows('user_experts')
  const profiles = useRows('profiles')
  const docs = useRows('brand_docs')
  return useMemo(() => {
    const typeName = new Map(pageTypes.rows.map((t) => [t.id, t.name]))
    const projectPages = pages.rows.filter((p) => p.project_id === project.id && !p.archived).map((p) => ({ ...p, typeName: typeName.get(p.page_type_id) ?? 'Página' }))
    const projectCreatives = creatives.rows.filter((c) => c.project_id === project.id)
    const update = updates.rows.filter((u) => u.project_id === project.id && u.status === 'publicado').sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))[0]
      ?? updates.rows.filter((u) => u.project_id === project.id).sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0]
    const adIds = new Set(ads.rows.filter((a) => a.project_id === project.id).map((a) => a.id))
    const m = metrics.rows.filter((x) => adIds.has(x.ad_id))
    const team = links.rows.filter((l) => l.expert_id === project.expert_id).map((l) => ({ ...l, name: profiles.rows.find((p) => p.id === l.user_id)?.full_name ?? '' }))
    return {
      brandDoc: expert ? docs.rows.find((d) => d.expert_id === expert.id) ?? null : null,
      pages: projectPages,
      creatives: projectCreatives,
      approved: projectCreatives.filter((c) => c.status === 'aprovado'),
      account: accounts.rows.find((a) => a.id === project.ad_account_id) ?? null,
      products: products.rows.filter((p) => p.project_id === project.id),
      update,
      campaigns: campaigns.rows.filter((c) => c.project_id === project.id),
      spend: m.reduce((a, x) => a + x.spend, 0),
      leads: m.reduce((a, x) => a + x.leads, 0),
      team,
      commercial: team.filter((t) => t.funcao && ['closer', 'sdr', 'social_seller'].includes(t.funcao)),
    }
  }, [project, expert, pages.rows, pageTypes.rows, creatives.rows, accounts.rows, products.rows, updates.rows, campaigns.rows, ads.rows, metrics.rows, links.rows, profiles.rows, docs.rows])
}
export type Materials = ReturnType<typeof useMaterials>

/** Etiquetas curtas mostradas no card da etapa (o que já está vinculado). */
export function assetChips(assets: StageAsset[], m: Materials, project: Project): { label: string; ok: boolean }[] {
  const out: { label: string; ok: boolean }[] = []
  for (const a of assets) {
    if (a === 'brand_doc') out.push(m.brandDoc?.status === 'respondido' ? { label: 'Documento respondido', ok: true } : m.brandDoc ? { label: m.brandDoc.status === 'rascunho' ? 'Documento em preenchimento' : 'Link enviado', ok: false } : { label: 'Documento não enviado', ok: false })
    if (a === 'pages') out.push({ label: m.pages.length ? `${m.pages.length} página(s)` : 'Sem páginas', ok: m.pages.length > 0 })
    if (a === 'review') { const r = m.pages.filter((p) => p.status === 'revisao').length; out.push({ label: r ? `${r} em revisão` : `${m.pages.filter((p) => p.status === 'publicada').length} publicada(s)`, ok: r === 0 && m.pages.some((p) => p.status === 'publicada') }) }
    if (a === 'creatives') out.push({ label: m.creatives.length ? `${m.approved.length}/${m.creatives.length} aprovados` : 'Sem criativos', ok: m.approved.length > 0 })
    if (a === 'accounts') out.push(m.account ? { label: m.account.status === 'conectada' ? 'Conta conectada' : `Conta ${m.account.status}`, ok: m.account.status === 'conectada' } : { label: 'Sem conta vinculada', ok: false })
    if (a === 'checkout') out.push({ label: m.update?.checkout_url ? 'Checkout configurado' : m.products.length ? `${m.products.length} produto(s)` : 'Sem checkout', ok: Boolean(m.update?.checkout_url) })
    if (a === 'groups') out.push({ label: m.update?.extras?.whatsapp ? 'WhatsApp definido' : 'WhatsApp pendente', ok: Boolean(m.update?.extras?.whatsapp) })
    if (a === 'crm') out.push({ label: m.commercial.length ? `${m.commercial.length} no comercial` : 'Time comercial pendente', ok: m.commercial.length > 0 })
    if (a === 'capture') out.push({ label: m.leads ? `${m.leads} leads` : m.campaigns.length ? `${m.campaigns.length} campanha(s)` : 'Captação não iniciada', ok: m.leads > 0 })
  }
  if (assets.includes('pages') && project.public_slug) out.push({ label: 'Página do evento', ok: true })
  return out
}

function Row({ title, sub, href, badge }: { title: string; sub?: string; href?: string | null; badge?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/60 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold truncate">{title}</div>
        {sub && <div className="text-xs text-muted truncate">{sub}</div>}
      </div>
      {badge}
      {href && <a href={href} target="_blank" rel="noreferrer" className="text-primary hover:text-ink" title="Abrir"><ExternalLink className="size-4" /></a>}
    </div>
  )
}

function Empty({ children, to, cta }: { children: React.ReactNode; to?: string; cta?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-3 py-3 text-sm text-muted flex items-center justify-between gap-3">
      <span>{children}</span>
      {to && <Link to={to} className="text-primary text-xs font-semibold whitespace-nowrap hover:underline">{cta}</Link>}
    </div>
  )
}

/** Materiais do sistema que pertencem à etapa, exibidos no painel da etapa. */
export function StageMaterials({ assets, m, project, expert }: { assets: StageAsset[]; m: Materials; project: Project; expert: Expert | undefined }) {
  return (
    <div className="space-y-2">
      {assets.includes('brand_doc') && <BrandDocBlock doc={m.brandDoc} project={project} expert={expert} />}
      {assets.includes('pages') && (
        <>
          {m.pages.length ? m.pages.map((p) => <Row key={p.id} title={p.name} sub={`${p.typeName}${p.tool ? ` · ${p.tool}` : ''}`} href={p.published_url || p.preview_url || p.edit_url || null} badge={<Badge tone={PAGE_STATUS[p.status]?.tone ?? 'neutral'}>{PAGE_STATUS[p.status]?.label ?? p.status}</Badge>} />)
            : <Empty to="/paginas" cta="Cadastrar página">Nenhuma página (quiz ou landing page) cadastrada neste projeto.</Empty>}
          {project.public_slug && <Row title="Página do evento" sub="Gerada pela atualização de campanha" href={eventUrl(project.public_slug)} badge={<Badge tone="success">No ar</Badge>} />}
        </>
      )}
      {assets.includes('review') && (
        m.pages.length ? m.pages.map((p) => <Row key={p.id} title={p.name} sub={p.notes || p.typeName} href={p.published_url || p.preview_url || null} badge={<Badge tone={PAGE_STATUS[p.status]?.tone ?? 'neutral'}>{PAGE_STATUS[p.status]?.label ?? p.status}</Badge>} />)
          : <Empty>As páginas da etapa 2 aparecem aqui para a validação com o cliente.</Empty>
      )}
      {assets.includes('creatives') && (
        m.creatives.length ? (
          <>
            <div className="grid grid-cols-4 gap-2">
              {m.creatives.slice(0, 8).map((c) => (
                <div key={c.id} className="relative aspect-[4/5] rounded-lg overflow-hidden border border-line bg-surface-3">
                  {c.image_url ? <img src={c.image_url} alt={c.content.headline} className="size-full object-cover" loading="lazy" /> : <div className="size-full grid place-items-center text-[10px] text-faint p-1 text-center">{c.content.headline}</div>}
                  {c.status === 'aprovado' && <span className="absolute top-1 right-1 size-2 rounded-full bg-success" />}
                </div>
              ))}
            </div>
            <Row title={`${m.approved.length} de ${m.creatives.length} criativos aprovados`} sub={project.creatives_share_token ? 'Link público dos aprovados' : 'Veja todos na aba Criativos do projeto'} href={project.creatives_share_token ? creativesUrl(project.creatives_share_token) : null} />
          </>
        ) : <Empty to={`/projetos/${project.id}`} cta="Abrir projeto">Nenhum criativo gerado ainda. Use a aba Criativos do projeto.</Empty>
      )}
      {assets.includes('accounts') && (
        m.account ? <Row title={m.account.name} sub={`Meta Ads · ${m.account.external_id}${m.account.last_sync_at ? ` · sincronizada ${dateTime(m.account.last_sync_at)}` : ''}`} badge={<Badge tone={m.account.status === 'conectada' ? 'success' : m.account.status === 'erro' || m.account.status === 'expirada' ? 'danger' : 'neutral'}>{m.account.status}</Badge>} />
          : <Empty to="/trafego" cta="Vincular conta">Nenhuma conta de anúncios vinculada a este projeto.</Empty>
      )}
      {assets.includes('checkout') && (
        <>
          {m.update?.checkout_url ? <Row title="Link do checkout" sub={m.update.checkout_url} href={m.update.checkout_url} badge={m.update.with_price && m.update.price !== null ? <Badge tone="accent">{money(m.update.price)}</Badge> : undefined} /> : <Empty>Checkout ainda não informado na atualização de campanha.</Empty>}
          {m.products.map((p) => <Row key={p.id} title={p.name} sub="Produto cadastrado" badge={<Badge>{money(p.price)}</Badge>} />)}
        </>
      )}
      {assets.includes('groups') && (
        m.update?.extras?.whatsapp ? <Row title="WhatsApp do lançamento" sub={m.update.extras.whatsapp} href={/^https?:/.test(m.update.extras.whatsapp) ? m.update.extras.whatsapp : `https://wa.me/${m.update.extras.whatsapp.replace(/\D/g, '')}`} />
          : <Empty>Número ou link do grupo ainda não definido. Adicione nos links da etapa ou na atualização de campanha.</Empty>
      )}
      {assets.includes('crm') && (
        m.team.length ? m.team.map((t) => <Row key={t.id} title={t.name || 'Integrante'} sub={funcaoLabel(t.funcao)} badge={t.can_manage_team ? <Badge tone="primary">Gestor</Badge> : undefined} />)
          : <Empty to="/equipe" cta="Montar equipe">Nenhum integrante na equipe deste expert.</Empty>
      )}
      {assets.includes('capture') && (
        m.campaigns.length || m.spend ? (
          <div className="grid grid-cols-3 gap-2">
            {[['Campanhas', String(m.campaigns.length)], ['Investido', money(m.spend)], ['Leads', String(m.leads)]].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-line bg-surface-2/60 p-3"><div className="text-[11px] text-muted">{k}</div><div className="font-extrabold tabular-nums">{v}</div></div>
            ))}
          </div>
        ) : <Empty to="/trafego" cta="Ver tráfego">Nenhuma campanha sincronizada para este projeto ainda.</Empty>
      )}
    </div>
  )
}

/** Documento de Marca: gerar/copiar o link do formulário e ver as respostas. */
function BrandDocBlock({ doc, project, expert }: { doc: BrandDoc | null; project: Project; expert: Expert | undefined }) {
  const { user } = useAuth()
  const canManage = useCanManageProject(project)
  const toast = useToast()
  const { run, busy } = useAction()
  const [view, setView] = useState(false)
  if (!expert) return null
  const total = BRAND_QUESTIONS.length
  const done = doc ? answeredCount(doc.answers) : 0
  const url = doc ? brandDocUrl(doc.token) : ''
  const create = () => run(async () => {
    await backend.insert('brand_docs', { expert_id: expert.id, token: crypto.randomUUID(), status: 'pendente', answers: {}, respondent_name: '', created_by: user?.id ?? null })
    await invalidate('brand_docs')
  }, 'Link do formulário criado.')
  const copy = async () => { await navigator.clipboard.writeText(url); toast('success', 'Link copiado. Envie para o expert preencher.') }
  const msg = encodeURIComponent(`Olá, ${expert.full_name.split(' ')[0]}! Para começarmos o seu lançamento, preencha o Documento de Marca da V8: ${url}`)

  return (
    <div className="rounded-xl border border-accent/30 bg-accent/5 p-3.5 space-y-3">
      <div className="flex items-start gap-3">
        <div className="size-9 rounded-lg bg-accent/15 grid place-items-center text-accent shrink-0"><FileText className="size-4.5" /></div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold">Documento de Marca do Expert (V1)</div>
          <div className="text-xs text-muted">
            {!doc ? 'Gere o link e envie para o expert responder pelo celular ou computador.'
              : doc.status === 'respondido' ? `Respondido${doc.respondent_name ? ` por ${doc.respondent_name}` : ''} em ${dateTime(doc.submitted_at)}`
              : doc.status === 'rascunho' ? `Em preenchimento · salvo ${dateTime(doc.last_saved_at)}` : 'Link criado, aguardando o expert abrir.'}
          </div>
        </div>
        {doc && <Badge tone={doc.status === 'respondido' ? 'success' : doc.status === 'rascunho' ? 'accent' : 'neutral'}>{doc.status === 'respondido' ? 'Respondido' : doc.status === 'rascunho' ? 'Em andamento' : 'Enviado'}</Badge>}
      </div>
      {doc && (
        <div>
          <div className="flex justify-between text-[11px] text-muted mb-1"><span>Respostas</span><span>{done} de {total}</span></div>
          <Progress value={(done / total) * 100} tone={doc.status === 'respondido' ? 'success' : 'accent'} />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {!doc ? (canManage ? <Button size="sm" variant="primary" icon={Link2} loading={busy} onClick={create}>Gerar link do formulário</Button> : <span className="text-xs text-muted">Peça ao gestor da equipe para gerar o link.</span>) : (
          <>
            <Button size="sm" icon={Copy} onClick={copy}>Copiar link</Button>
            <a href={`https://wa.me/?text=${msg}`} target="_blank" rel="noreferrer"><Button size="sm" icon={Send}>Enviar no WhatsApp</Button></a>
            <a href={url} target="_blank" rel="noreferrer"><Button size="sm" icon={ExternalLink}>Abrir formulário</Button></a>
            {done > 0 && <Button size="sm" variant="primary" icon={Eye} onClick={() => setView(true)}>Ver respostas</Button>}
          </>
        )}
      </div>
      {doc && view && <BrandAnswers doc={doc} expert={expert} onClose={() => setView(false)} />}
    </div>
  )
}

export function BrandAnswers({ doc, expert, onClose }: { doc: BrandDoc; expert: Expert; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} size="lg" title="Documento de Marca do Expert" subtitle={`${expert.professional_name || expert.full_name}${doc.submitted_at ? ` · respondido em ${dateTime(doc.submitted_at)}` : ''}`}>
      <div className="space-y-6">
        {BRAND_SECTIONS.map((s) => (
          <section key={s.id}>
            <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-accent mb-2">{s.title}</h3>
            <dl className="space-y-3">
              {s.questions.map((q) => (
                <div key={q.key} className="rounded-xl border border-line bg-surface-2/50 p-3">
                  <dt className="text-xs font-semibold text-muted">{q.label}</dt>
                  <dd className={`text-sm mt-1 whitespace-pre-wrap ${doc.answers[q.key]?.trim() ? '' : 'text-faint italic'}`}>{doc.answers[q.key]?.trim() || 'Sem resposta'}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Modal>
  )
}
