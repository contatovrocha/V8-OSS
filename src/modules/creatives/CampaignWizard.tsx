import { ArrowLeft, ArrowRight, Check, ExternalLink, Rocket, Wand2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useApp } from '@/app/AppContext'
import { MoneyInput } from '@/components/ui/inputs'
import { Modal, useAction } from '@/components/ui/overlay'
import { Badge, Button, Checkbox, Field, Input, Progress, Segmented, Textarea } from '@/components/ui/primitives'
import { backend } from '@/data/client'
import { invalidate, useRows } from '@/data/store'
import type { CreativeFormat, CreativeLayout, Project, ProjectUpdate } from '@/data/types'
import { angles, contentFrom, dateLabel, eventUrl, FORMATS, headlineOptions, LAYOUTS, slugify } from '@/lib/campaign'
import { ArtPreview } from './CreativeArt'
import { generateCreatives } from './generate'
import { PeoplePicker } from './PhotoBank'

type Draft = Omit<ProjectUpdate, 'id' | 'project_id' | 'status' | 'published_at' | 'created_by' | 'created_at' | 'updated_at'>

const EMPTY: Draft = {
  event_date: null, event_time: '', format: 'presencial', city: '', venue: '', platform: '', with_price: false, price: null, full_price: null,
  checkout_url: '', promise: '', headline: '', subheadline: '', cta_label: 'Quero garantir minha vaga', spots: null, extras: {}, hero_person_id: null,
}

/** "Atualizar campanha": informações do evento → criativos → revisar e publicar (página + criativos). Sem IA. */
export function CampaignWizard({ project, onClose, onDone }: { project: Project; onClose: () => void; onDone: () => void }) {
  const app = useApp()
  const updates = useRows('project_updates')
  const bank = useRows('creative_people')
  const { run, busy } = useAction()
  const expert = app.experts.find((e) => e.id === project.expert_id)
  const expertName = expert?.full_name ?? 'o expert'
  const last = useMemo(() => updates.rows.filter((u) => u.project_id === project.id).sort((a, b) => (b.published_at ?? b.created_at).localeCompare(a.published_at ?? a.created_at))[0], [updates.rows, project.id])

  const [step, setStep] = useState(1)
  const [d, setD] = useState<Draft>(() => {
    if (!last) return { ...EMPTY, event_date: project.event_date }
    const { id: _i, project_id: _p, status: _s, published_at: _pa, created_by: _c, created_at: _ca, updated_at: _u, ...rest } = last
    return rest
  })
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((s) => ({ ...s, [k]: v }))
  const [options, setOptions] = useState<{ headline: string; subheadline: string }[]>([])
  const [formats, setFormats] = useState<CreativeFormat[]>(['feed', 'stories'])
  const [layouts, setLayouts] = useState<CreativeLayout[]>(['destaque', 'dividido', 'convite', 'grupo'])
  const [showPrice, setShowPrice] = useState(true)
  const [people, setPeople] = useState<string[]>(() => {
    const own = d.hero_person_id ?? bank.rows.find((p) => p.expert_id === project.expert_id)?.id
    return own ? [own] : []
  })
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [result, setResult] = useState<{ url: string; count: number } | null>(null)

  const date = dateLabel(d.event_date, d.event_time)
  const errors1 = [
    !d.event_date && 'Informe a data do evento.',
    d.format === 'presencial' && !d.city.trim() && 'Informe a cidade.',
    d.with_price && (d.price === null || d.price <= 0) && 'Informe o valor.',
    d.checkout_url && !/^https?:\/\//.test(d.checkout_url) && 'O link do botão deve começar com https://',
    !d.headline.trim() && 'Escolha ou escreva a headline.',
  ].filter(Boolean) as string[]
  const errors2 = [!formats.length && 'Escolha pelo menos um formato.', !layouts.length && 'Escolha pelo menos um modelo.', !people.length && 'Escolha pelo menos uma foto.'].filter(Boolean) as string[]
  const total = formats.length * layouts.length

  const previewUpdate = { ...d, id: 'preview', project_id: project.id, status: 'rascunho', published_at: null, created_at: '', updated_at: '' } as ProjectUpdate
  const angleList = angles(expertName, date)
  const selectedPeople = people.map((id) => bank.rows.find((p) => p.id === id)).filter(Boolean) as typeof bank.rows

  const publish = () => run(async () => {
    // 1) versão publicada da campanha
    const u = await backend.insert('project_updates', { ...d, project_id: project.id, status: 'publicado', published_at: new Date().toISOString(), hero_person_id: people[0] ?? null })
    // 2) página: endereço (criado uma vez), data do evento no projeto e registro em Páginas
    const slug = await backend.rpc<string>('publish_campaign_page', {
      project_id: project.id, slug: project.public_slug ?? slugify(project.name), event_date: d.event_date,
      url: eventUrl('{slug}'), note: `Atualizada em ${new Date().toLocaleString('pt-BR')} · ${date}`,
    })
    const url = eventUrl(slug)
    // 4) criativos (desenhados aqui no navegador)
    const made = await generateCreatives({ project, update: u, expertName, formats, layouts, showPrice, personIds: people, bank: bank.rows, onProgress: (done, t) => setProgress({ done, total: t }) })
    await invalidate('project_updates', 'projects', 'pages', 'creatives', 'activity_log')
    setResult({ url, count: made.length })
  })

  if (result) {
    return (
      <Modal open onClose={onDone} size="lg" title="Campanha atualizada!" footer={<Button variant="primary" onClick={onDone}>Ver criativos</Button>}>
        <div className="space-y-4 text-sm">
          <p className="flex gap-2"><Check className="size-5 text-success shrink-0" />Página do evento atualizada com a nova data, formato e textos.</p>
          <div className="flex gap-2"><Input readOnly value={result.url} onFocus={(e) => e.currentTarget.select()} /><a href={result.url} target="_blank" rel="noreferrer"><Button icon={ExternalLink}>Abrir</Button></a></div>
          <p className="flex gap-2"><Check className="size-5 text-success shrink-0" />{result.count} criativo(s) gerado(s) como rascunho. Revise, edite ou peça ajuste e aprove na aba Criativos.</p>
        </div>
      </Modal>
    )
  }

  const steps = ['Informações do evento', 'Criativos', 'Revisar e publicar']
  return (
    <Modal open onClose={busy ? () => {} : onClose} size="xl" title={`Atualizar campanha · ${project.name}`}
      subtitle={<span className="flex flex-wrap gap-2 mt-1">{steps.map((s, i) => <Badge key={s} tone={step === i + 1 ? 'primary' : step > i + 1 ? 'success' : 'neutral'}>{i + 1}. {s}</Badge>)}</span>}
      footer={<>
        {step > 1 && !busy && <Button variant="ghost" icon={ArrowLeft} onClick={() => setStep(step - 1)}>Voltar</Button>}
        <div className="flex-1" />
        {step === 1 && <Button variant="primary" onClick={() => errors1.length ? run(async () => { throw new Error(errors1[0]) }) : setStep(2)}>Próximo: criativos <ArrowRight className="size-4" /></Button>}
        {step === 2 && <Button variant="primary" onClick={() => errors2.length ? run(async () => { throw new Error(errors2[0]) }) : setStep(3)}>Próximo: revisar <ArrowRight className="size-4" /></Button>}
        {step === 3 && <Button variant="primary" icon={Rocket} loading={busy} onClick={publish}>Publicar página e gerar {total} criativo(s)</Button>}
      </>}>
      {step === 1 && (
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Data do evento" required><Input type="date" value={d.event_date ?? ''} onChange={(e) => set('event_date', e.target.value || null)} /></Field>
          <Field label="Horário"><Input value={d.event_time} onChange={(e) => set('event_time', e.target.value)} placeholder="Ex.: 19h" /></Field>
          <Field label="Formato" className="md:col-span-2"><Segmented value={d.format} onChange={(v) => set('format', v)} options={[{ value: 'presencial', label: 'Presencial' }, { value: 'online', label: 'Online' }]} /></Field>
          {d.format === 'presencial' ? (
            <>
              <Field label="Cidade" required><Input value={d.city} onChange={(e) => set('city', e.target.value)} placeholder="Ex.: Barueri" /></Field>
              <Field label="Local"><Input value={d.venue} onChange={(e) => set('venue', e.target.value)} placeholder="Ex.: Hotel Alphaville" /></Field>
            </>
          ) : (
            <Field label="Plataforma" className="md:col-span-2"><Input value={d.platform} onChange={(e) => set('platform', e.target.value)} placeholder="Ex.: Zoom · link enviado por e-mail" /></Field>
          )}
          <div className="md:col-span-2"><Checkbox checked={d.with_price} onChange={(v) => set('with_price', v)} label="Mostrar preço (página e criativos)" /></div>
          {d.with_price && (
            <>
              <Field label="Valor (a partir de)" required><MoneyInput value={d.price} onChange={(v) => set('price', v)} /></Field>
              <Field label="Valor cheio (riscado, opcional)"><MoneyInput value={d.full_price} onChange={(v) => set('full_price', v)} /></Field>
            </>
          )}
          <Field label="Link do botão (checkout ou WhatsApp)"><Input value={d.checkout_url} onChange={(e) => set('checkout_url', e.target.value)} placeholder="https://" /></Field>
          <Field label="Texto do botão"><Input value={d.cta_label} onChange={(e) => set('cta_label', e.target.value)} /></Field>
          <Field label="Vagas (opcional)"><Input type="number" min={0} value={d.spots ?? ''} onChange={(e) => set('spots', e.target.value ? Number(e.target.value) : null)} /></Field>
          <Field label="Bônus (opcional)"><Input value={d.extras.bonus ?? ''} onChange={(e) => set('extras', { ...d.extras, bonus: e.target.value })} /></Field>
          <Field label="Garantia (opcional)" className="md:col-span-2"><Input value={d.extras.garantia ?? ''} onChange={(e) => set('extras', { ...d.extras, garantia: e.target.value })} placeholder="Ex.: 7 dias ou seu dinheiro de volta" /></Field>

          <div className="md:col-span-2 border-t border-line pt-4 space-y-3">
            <Field label="Promessa" hint="Escreva o resultado que o evento entrega. O sistema monta 3 opções de headline e subheadline.">
              <div className="flex gap-2">
                <Input value={d.promise} onChange={(e) => set('promise', e.target.value)} placeholder="Ex.: Escalar sua empresa usando IA em 90 dias" />
                <Button icon={Wand2} onClick={() => setOptions(headlineOptions({ promise: d.promise, expert: expertName, format: d.format, date, city: d.city }))} disabled={!d.promise.trim()}>Gerar opções</Button>
              </div>
            </Field>
            {options.length > 0 && (
              <div className="grid md:grid-cols-3 gap-2">
                {options.map((o, i) => (
                  <button key={i} type="button" onClick={() => setD((s) => ({ ...s, headline: o.headline, subheadline: o.subheadline }))}
                    className={`text-left rounded-xl border p-3 transition ${d.headline === o.headline ? 'border-primary bg-primary/10' : 'border-line hover:border-line-strong'}`}>
                    <div className="text-xs text-muted mb-1">Opção {i + 1}</div>
                    <div className="font-bold text-sm">{o.headline}</div>
                    <div className="text-xs text-muted mt-1">{o.subheadline}</div>
                  </button>
                ))}
              </div>
            )}
            <Field label="Headline" required><Input value={d.headline} onChange={(e) => set('headline', e.target.value)} /></Field>
            <Field label="Subheadline (2 a 3 linhas)"><Textarea rows={2} value={d.subheadline} onChange={(e) => set('subheadline', e.target.value)} /></Field>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <div className="grid md:grid-cols-3 gap-4">
            <Field label="Formatos">
              <div className="space-y-2">{FORMATS.map((f) => <Checkbox key={f.value} checked={formats.includes(f.value)} label={`${f.label} (${f.w}×${f.h})`} onChange={(v) => setFormats(v ? [...formats, f.value] : formats.filter((x) => x !== f.value))} />)}</div>
            </Field>
            <Field label="Modelos">
              <div className="space-y-2">{LAYOUTS.map((l) => <Checkbox key={l.value} checked={layouts.includes(l.value)} label={<span>{l.label} <span className="text-muted text-xs">· {l.hint}</span></span>} onChange={(v) => setLayouts(v ? [...layouts, l.value] : layouts.filter((x) => x !== l.value))} />)}</div>
            </Field>
            <Field label="Preço no criativo">
              <Checkbox checked={showPrice && d.with_price} disabled={!d.with_price} onChange={setShowPrice} label={d.with_price ? 'Com preço' : 'Sem preço (ative o preço na etapa 1)'} />
            </Field>
          </div>
          <Field label="Quem aparece nos criativos (banco de fotos)"><PeoplePicker selected={people} onChange={setPeople} /></Field>
          {selectedPeople.length > 0 && layouts.length > 0 && (
            <div>
              <div className="text-sm font-semibold mb-2">Prévia</div>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {layouts.map((layout, li) => (
                  <ArtPreview key={layout} width={180} format={formats.includes('feed') ? 'feed' : 'stories'} layout={layout} people={selectedPeople}
                    content={contentFrom(previewUpdate, angleList[li % angleList.length].kicker, showPrice, people)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4 text-sm">
          {progress ? (
            <div className="space-y-2 py-6">
              <div className="font-semibold">Gerando criativos… {progress.done} de {progress.total}</div>
              <Progress value={(progress.done / Math.max(1, progress.total)) * 100} />
              <p className="text-muted text-xs">Não feche esta janela. As imagens são desenhadas aqui no seu navegador.</p>
            </div>
          ) : (
            <>
              <div className="grid md:grid-cols-2 gap-3">
                <div className="rounded-xl border border-line p-4 space-y-1">
                  <div className="text-xs text-muted">Página do evento</div>
                  <div className="font-bold">{d.headline}</div>
                  <div className="text-muted">{d.subheadline}</div>
                  <div className="pt-2">{date} · {d.format === 'online' ? 'Online' : `Presencial · ${[d.venue, d.city].filter(Boolean).join(', ')}`}</div>
                  {d.with_price && <div>a partir de <b>{d.price?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</b></div>}
                  <div className="text-xs text-muted pt-1">Endereço: {project.public_slug ? eventUrl(project.public_slug) : `${eventUrl(slugify(project.name))} (criado ao publicar)`}</div>
                </div>
                <div className="rounded-xl border border-line p-4 space-y-1">
                  <div className="text-xs text-muted">Criativos</div>
                  <div className="font-bold">{total} criativo(s)</div>
                  <div className="text-muted">{formats.map((f) => FORMATS.find((x) => x.value === f)!.label).join(' + ')} · {layouts.length} modelo(s) · {showPrice && d.with_price ? 'com preço' : 'sem preço'}</div>
                  <div className="text-muted">Com: {selectedPeople.map((p) => p.name).join(', ')}</div>
                </div>
              </div>
              <p className="text-xs text-muted">Ao publicar, a página passa a mostrar estas informações na hora e a versão anterior fica guardada no histórico do projeto. Os criativos entram como rascunho para você aprovar.</p>
            </>
          )}
        </div>
      )}
    </Modal>
  )
}
