import { addDays, todayISO } from '@/lib/format'
import type {
  ActivityLog, Ad, AdAccount, AdMetricDaily, AdSet, AppSettings, Campaign, Expense, ExpenseCategory, Expert,
  ExpertPermissions, LaunchPage, Movement, PageType, PhaseHistory, Product, Project, ProjectPhase, Sale,
  SectionConfig, SectionRecord, Task, TaskTemplate,
} from './types'

/** IDs estáveis para os registros demonstrativos (UUIDs válidos, prefixo d0). */
export const demoId = (n: number) => `d0000000-0000-4000-8000-${String(n).padStart(12, '0')}`

export const DEMO = {
  expertRafael: demoId(1),
  expertCamila: demoId(2),
  projectJantar: demoId(10),
  projectMentoria: demoId(11),
  projectCamila: demoId(12),
  adAccount: demoId(20),
}

export const ALL_MODULES = ['visao_geral', 'posicionamento', 'projetos', 'paginas', 'trafego', 'financeiro', 'tarefas', 'relatorios']

export const defaultPermissions = (): ExpertPermissions => ({
  can_edit_profile: true,
  can_upload_photo: true,
  can_edit_movements: false,
  can_edit_tasks: false,
  can_manage_phases: false,
  can_edit_finance: false,
  visible_modules: [...ALL_MODULES],
})

// Gerador pseudoaleatório determinístico: os dados de exemplo são sempre os mesmos.
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

const now = () => new Date().toISOString()

export function baseConfig() {
  const ts = now()
  const pageTypes: PageType[] = [
    'Página de captura', 'Página de vendas', 'Página de inscrição', 'Página de checkout', 'Página de confirmação',
    'Página de obrigado', 'Página de aplicação', 'Página de evento',
  ].map((name, i) => ({ id: `c0000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, name, is_custom: false, created_at: ts }))

  const categories: ExpenseCategory[] = [
    ['Tráfego pago', true], ['Produção', false], ['Design', false], ['Copywriting', false], ['Ferramentas', false], ['Equipe', false],
    ['Estrutura do evento', false], ['Alimentação e hospedagem', false], ['Taxas', false], ['Outros', false],
  ].map(([name, is_traffic], i) => ({ id: `c1000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, name: name as string, is_traffic: is_traffic as boolean }))

  const settings: AppSettings = {
    id: 'c2000000-0000-4000-8000-000000000001',
    brand_name: 'Launch OS',
    operation_name: 'Operação de Lançamentos',
    primary_color: '#3b82f6',
    success_color: '#22c55e',
    accent_color: '#f97316',
    danger_color: '#ef4444',
    logo_url: null,
    timezone: 'America/Sao_Paulo',
    phase_transition_rule: 'next_available',
    top_product_metric: 'quantidade',
    disabled_modules: [],
    updated_at: ts,
  }

  const tpl = (phase: number, title: string, description: string, checklist: string[], offset: number, priority: TaskTemplate['priority'] = 'media'): TaskTemplate => ({
    id: `c3000000-0000-4000-8000-${String(phase * 10 + offset).padStart(12, '0')}`,
    phase_number: phase, title, description, priority, checklist, offset_days: offset, created_at: ts,
  })
  const templates: TaskTemplate[] = [
    tpl(1, 'Entrevista de posicionamento', 'Sessão para mapear história, autoridade e diferenciais do expert.', ['Agendar sessão', 'Gravar entrevista', 'Transcrever'], 1, 'alta'),
    tpl(1, 'Documento de narrativa', 'Consolidar proposta de valor, público e narrativa.', ['Proposta de valor', 'Público-alvo', 'Diferenciais'], 5),
    tpl(2, 'Mapa da escada de ofertas', 'Definir produtos, preços e entregáveis.', ['Produto de entrada', 'Produto principal', 'Upsell'], 3, 'alta'),
    tpl(3, 'Página de captura', 'Estruturar e publicar a página de captação.', ['Copy', 'Design', 'Pixel e eventos'], 4, 'alta'),
    tpl(3, 'Campanha de captação', 'Configurar campanha de leads no Meta Ads.', ['Públicos', 'Criativos', 'Orçamento'], 6),
    tpl(4, 'Abertura de vendas', 'Abrir checkout e acompanhar primeiras vendas.', ['Checkout testado', 'Script comercial'], 2, 'urgente'),
    tpl(5, 'Análise de compradores', 'Levantar perfil dos compradores para refinar o ICP.', ['Exportar compradores', 'Entrevistas'], 5),
    tpl(6, 'Públicos qualificados', 'Criar públicos semelhantes a compradores.', ['Lookalike 1%', 'Exclusões'], 3),
    tpl(7, 'Roteiro do funil 7D', 'Planejar os sete dias do funil de escala.', ['Dia 1 a 7 roteirizados'], 4),
    tpl(8, 'Rodada de otimização', 'Revisar criativos, páginas e taxa de conversão.', ['Criativos', 'Páginas', 'Ofertas'], 7),
  ]
  return { pageTypes, categories, settings, templates }
}

export interface DemoData {
  experts: Expert[]
  projects: Project[]
  project_phases: ProjectPhase[]
  phase_history: PhaseHistory[]
  movements: Movement[]
  pages: LaunchPage[]
  ad_accounts: AdAccount[]
  campaigns: Campaign[]
  ad_sets: AdSet[]
  ads: Ad[]
  ad_metrics_daily: AdMetricDaily[]
  products: Product[]
  sales: Sale[]
  expenses: Expense[]
  tasks: Task[]
  section_configs: SectionConfig[]
  section_records: SectionRecord[]
  activity_log: ActivityLog[]
}

export function demoData(adminId: string | null, adminName = 'Administração'): DemoData {
  const ts = now()
  const today = todayISO()
  const d = (n: number) => addDays(today, n)
  const at = (n: number, h = 10) => `${d(n)}T${String(h).padStart(2, '0')}:00:00-03:00`
  let seq = 100
  const id = () => demoId(seq++)
  const rand = rng(42)

  const expert = (eid: string, full: string, prof: string, title: string, photo: string, extra: Partial<Expert>): Expert => ({
    id: eid, full_name: full, professional_name: prof, title, bio: '', career_story: '', value_proposition: '', positioning: '',
    target_audience: '', differentiators: [], authority_topics: [], social_links: [], website: '', videos: [], media: [],
    photo_url: photo, draft: null, published_at: ts, permissions: defaultPermissions(), is_demo: true, created_at: ts, updated_at: ts, ...extra,
  })

  const experts: Expert[] = [
    expert(DEMO.expertRafael, 'Rafael Martins', 'Rafael Martins', 'Mentor de negócios e conexões empresariais', '/demo/rafael.svg', {
      bio: '<p><strong>Exemplo fictício.</strong> Rafael Martins é mentor de empresários e organiza encontros presenciais que aproximam líderes de negócios de diferentes setores.</p>',
      career_story: 'Empreendedor há 15 anos, fundou duas empresas de serviços e passou a reunir empresários em jantares de networking qualificado. (Dados demonstrativos)',
      value_proposition: 'Conexões estratégicas entre empresários em um ambiente presencial, curado e orientado a negócios.',
      positioning: 'Referência em networking empresarial de alto nível para donos de pequenas e médias empresas.',
      target_audience: 'Empresários e sócios de PMEs com faturamento entre R$ 1 mi e R$ 20 mi/ano.',
      differentiators: ['Curadoria de participantes', 'Formato presencial e intimista', 'Facilitação de conexões durante o evento'],
      authority_topics: ['Networking', 'Gestão de PMEs', 'Parcerias comerciais'],
      social_links: [{ label: 'Instagram', url: 'https://instagram.com/exemplo' }, { label: 'LinkedIn', url: 'https://linkedin.com/in/exemplo' }],
      website: 'https://exemplo.com',
      videos: [{ label: 'Apresentação (exemplo)', url: 'https://www.youtube.com/watch?v=exemplo' }],
    }),
    expert(DEMO.expertCamila, 'Camila Duarte', 'Camila Duarte', 'Mentora de liderança', '/demo/camila.svg', {
      bio: '<p><strong>Exemplo fictício</strong> usado para testar o isolamento entre experts.</p>',
      value_proposition: 'Desenvolvimento de lideranças femininas em empresas de médio porte.',
      target_audience: 'Gestoras e executivas.',
    }),
  ]

  const project = (pid: string, expertId: string, p: Partial<Project>): Project => ({
    id: pid, expert_id: expertId, name: '', description: '', category: 'Evento', launch_type: 'Jantar Empresarial',
    start_date: null, end_date: null, event_date: null, revenue_goal: 0, sales_goal: 0, traffic_budget: 0, status: 'ativo',
    archived: false, current_phase: null, cover_url: null, links: [], internal_notes: '', team: [], ad_account_id: null,
    is_demo: true, created_at: ts, updated_at: ts, ...p,
  })

  const projects: Project[] = [
    project(DEMO.projectJantar, DEMO.expertRafael, {
      name: 'Jantar Empresarial — Lançamento',
      description: 'Estruturação e lançamento de um evento presencial voltado a empresários.',
      category: 'Evento presencial', launch_type: 'Jantar Empresarial',
      start_date: d(-40), end_date: d(30), event_date: d(21),
      revenue_goal: 50000, sales_goal: 100, traffic_budget: 5000, status: 'ativo', current_phase: 3,
      cover_url: '/demo/cover-jantar.svg', ad_account_id: DEMO.adAccount,
      links: [{ label: 'Drive do projeto (exemplo)', url: 'https://drive.google.com' }],
      internal_notes: 'Dados demonstrativos. Restaurante pré-reservado para 120 lugares.',
      team: ['Ana (gestão)', 'Bruno (tráfego)', 'Carla (design)'],
    }),
    project(DEMO.projectMentoria, DEMO.expertRafael, {
      name: 'Mentoria Executiva — Turma 2',
      description: 'Programa de mentoria em grupo para empresários participantes do jantar.',
      category: 'Mentoria', launch_type: 'Lançamento interno', start_date: d(10), end_date: d(90),
      revenue_goal: 120000, sales_goal: 20, traffic_budget: 8000, status: 'estruturacao', current_phase: 1,
      cover_url: '/demo/cover-mentoria.svg', team: ['Ana (gestão)'],
    }),
    project(DEMO.projectCamila, DEMO.expertCamila, {
      name: 'Imersão Liderança — Edição Piloto',
      description: 'Imersão presencial de um dia para gestoras.',
      category: 'Evento presencial', launch_type: 'Imersão', start_date: d(-20), end_date: d(40), event_date: d(35),
      revenue_goal: 30000, sales_goal: 60, traffic_budget: 3000, status: 'ativo', current_phase: 2, cover_url: '/demo/cover-camila.svg',
    }),
  ]

  const phaseRows = (pid: string, statuses: ProjectPhase['status'][], startedOffsets: (number | null)[]): ProjectPhase[] =>
    statuses.map((status, i) => ({
      id: id(), project_id: pid, phase_number: i + 1, status,
      started_at: startedOffsets[i] !== null && startedOffsets[i] !== undefined ? at(startedOffsets[i] as number) : null,
      completed_at: status === 'concluida' ? at((startedOffsets[i] as number) + 12) : null,
      completed_by: status === 'concluida' ? adminId : null,
      owner: i < 3 ? 'Ana (gestão)' : '', checklist: [], notes: '', links: [], updated_at: ts,
    }))

  const jantarPhases = phaseRows(DEMO.projectJantar,
    ['concluida', 'concluida', 'andamento', 'disponivel', 'bloqueada', 'bloqueada', 'bloqueada', 'bloqueada'], [-40, -28, -16, null, null, null, null, null])
  const check = (labels: [string, boolean][]) => labels.map(([label, done], i) => ({ id: `ck${i}`, label, done }))
  jantarPhases[0].checklist = check([['Proposta de valor', true], ['Público-alvo', true], ['Narrativa do expert', true]])
  jantarPhases[1].checklist = check([['Ingresso individual', true], ['Ingresso dupla', true], ['Mesa VIP', true]])
  jantarPhases[2].checklist = check([['Página do evento', true], ['Página de inscrição', true], ['Checkout', true], ['Campanha de captação', true], ['Remarketing', false], ['Eventos de conversão validados', false]])
  jantarPhases[2].notes = 'Acompanhar CPL diariamente. Meta de CPL abaixo de R$ 15,00. (exemplo)'

  const project_phases = [
    ...jantarPhases,
    ...phaseRows(DEMO.projectMentoria, ['andamento', 'disponivel', 'bloqueada', 'bloqueada', 'bloqueada', 'bloqueada', 'bloqueada', 'bloqueada'], [-2, null, null, null, null, null, null, null]),
    ...phaseRows(DEMO.projectCamila, ['concluida', 'andamento', 'disponivel', 'bloqueada', 'bloqueada', 'bloqueada', 'bloqueada', 'bloqueada'], [-20, -8, null, null, null, null, null, null]),
  ]

  const ph = (pid: string, n: number, action: string, from: ProjectPhase['status'] | null, to: ProjectPhase['status'], off: number): PhaseHistory => ({
    id: id(), project_id: pid, phase_number: n, action, from_status: from, to_status: to, user_id: adminId, user_name: adminName, note: 'Registro demonstrativo', created_at: at(off),
  })
  const phase_history: PhaseHistory[] = [
    ph(DEMO.projectJantar, 1, 'start', 'disponivel', 'andamento', -40),
    ph(DEMO.projectJantar, 1, 'complete', 'andamento', 'concluida', -28),
    ph(DEMO.projectJantar, 2, 'start', 'disponivel', 'andamento', -28),
    ph(DEMO.projectJantar, 2, 'complete', 'andamento', 'concluida', -16),
    ph(DEMO.projectJantar, 3, 'start', 'disponivel', 'andamento', -16),
  ]

  const mv = (name: string, desc: string, cat: string, pid: string | null, cover: string, order: number, status: Movement['status'] = 'publicado', url = ''): Movement => ({
    id: id(), expert_id: DEMO.expertRafael, project_id: pid, name, cover_url: cover, description: desc, category: cat, status,
    sort_order: order, external_url: url, expert_editable: false, is_demo: true, created_at: ts, updated_at: ts,
  })
  const movements = [
    mv('Jantar Empresarial', 'Encontro presencial de networking entre empresários.', 'Evento', DEMO.projectJantar, '/demo/cover-jantar.svg', 1),
    mv('Mentoria Executiva', 'Programa de acompanhamento em grupo para empresários.', 'Mentoria', DEMO.projectMentoria, '/demo/cover-mentoria.svg', 2),
    mv('Podcast Conexões', 'Conversas com empresários convidados (exemplo).', 'Conteúdo', null, '/demo/cover-podcast.svg', 3, 'publicado', 'https://exemplo.com/podcast'),
  ]

  const pt = (n: number) => `c0000000-0000-4000-8000-${String(n).padStart(12, '0')}`
  const page = (name: string, type: number, status: LaunchPage['status'], url: string, pubOff: number | null, goal: number | null, cur: number | null, preview: string, pid = DEMO.projectJantar): LaunchPage => ({
    id: id(), project_id: pid, name, page_type_id: pt(type), published_url: url, edit_url: 'https://app.exemplo.com/editor', tool: 'Elementor',
    owner: 'Carla (design)', status, published_at: pubOff === null ? null : d(pubOff), conversion_goal: goal, conversion_current: cur,
    notes: 'Página demonstrativa.', preview_url: preview, archived: false, is_demo: true, created_at: ts, updated_at: ts,
  })
  const pages = [
    page('Apresentação do evento', 8, 'publicada', 'https://exemplo.com/jantar', -18, 35, 31.2, '/demo/page-evento.svg'),
    page('Inscrição — lista de interesse', 3, 'publicada', 'https://exemplo.com/jantar/inscricao', -16, 40, 42.5, '/demo/page-inscricao.svg'),
    page('Checkout — ingressos', 4, 'publicada', 'https://exemplo.com/jantar/checkout', -14, 12, 9.8, '/demo/page-checkout.svg'),
    page('Confirmação de inscrição', 5, 'revisao', 'https://exemplo.com/jantar/confirmacao', null, null, null, '/demo/page-confirmacao.svg'),
    page('Aplicação para a mentoria', 7, 'planejada', '', null, 20, null, '/demo/page-inscricao.svg', DEMO.projectMentoria),
  ]

  const ad_accounts: AdAccount[] = [{
    id: DEMO.adAccount, name: 'Conta demonstrativa — Jantar Empresarial', platform: 'meta', external_id: 'act_demo', status: 'demo', currency: 'BRL',
    last_sync_at: null, last_sync_status: null, last_error: null, is_demo: true, created_at: ts,
  }]

  const campCapt = id()
  const campRmk = id()
  const campaigns: Campaign[] = [
    { id: campCapt, ad_account_id: DEMO.adAccount, project_id: DEMO.projectJantar, external_id: 'demo_c1', name: '[DEMO] Captação — Jantar Empresarial', objective: 'Leads', status: 'Ativa', is_demo: true, created_at: ts },
    { id: campRmk, ad_account_id: DEMO.adAccount, project_id: DEMO.projectJantar, external_id: 'demo_c2', name: '[DEMO] Remarketing — Ingressos', objective: 'Vendas', status: 'Ativa', is_demo: true, created_at: ts },
  ]
  const setEmp = id()
  const setInt = id()
  const setRmk = id()
  const ad_sets: AdSet[] = [
    { id: setEmp, campaign_id: campCapt, external_id: 'demo_s1', name: 'Empresários — Interesses', status: 'Ativo', is_demo: true, created_at: ts },
    { id: setInt, campaign_id: campCapt, external_id: 'demo_s2', name: 'Semelhante a compradores 1%', status: 'Ativo', is_demo: true, created_at: ts },
    { id: setRmk, campaign_id: campRmk, external_id: 'demo_s3', name: 'Visitantes 30 dias', status: 'Ativo', is_demo: true, created_at: ts },
  ]

  type Profile = { name: string; set: string; camp: string; type: Ad['creative_type']; status: string; placement: string; start: number; end: number; spend: number; cpm: number; ctr: number; lead: number; buy: number; text: string; headline: string }
  const profiles: Profile[] = [
    { name: 'Criativo 01 — Convite para o Jantar Empresarial', set: setEmp, camp: campCapt, type: 'imagem', status: 'Ativo', placement: 'Feed Instagram e Facebook', start: -15, end: 0, spend: 62, cpm: 28, ctr: 1.35, lead: 0.30, buy: 0.004, text: 'Você está convidado para uma noite de conexões com empresários da sua região.', headline: 'Jantar Empresarial — garanta seu lugar' },
    { name: 'Criativo 02 — Networking entre Empresários', set: setEmp, camp: campCapt, type: 'imagem', status: 'Ativo', placement: 'Feed Instagram', start: -15, end: 0, spend: 38, cpm: 32, ctr: 2.45, lead: 0.16, buy: 0.003, text: 'O nível das suas conversas define o nível dos seus negócios.', headline: 'Networking que gera negócios' },
    { name: 'Criativo 03 — O Valor das Conexões', set: setInt, camp: campCapt, type: 'imagem', status: 'Ativo', placement: 'Stories e Reels', start: -14, end: 0, spend: 45, cpm: 14, ctr: 0.95, lead: 0.12, buy: 0.002, text: 'Uma conexão certa pode mudar o rumo da sua empresa.', headline: 'Conexões estratégicas' },
    { name: 'Criativo 04 — Experiência Presencial', set: setInt, camp: campCapt, type: 'imagem', status: 'Pausado', placement: 'Feed Instagram', start: -15, end: -5, spend: 22, cpm: 30, ctr: 1.6, lead: 0.42, buy: 0.003, text: 'Uma noite pensada para quem decide.', headline: 'Experiência presencial exclusiva' },
    { name: 'Criativo 05 — Últimas Vagas', set: setRmk, camp: campRmk, type: 'imagem', status: 'Ativo', placement: 'Feed e Stories', start: -7, end: 0, spend: 40, cpm: 45, ctr: 1.9, lead: 0.10, buy: 0.045, text: 'Restam poucas vagas para o Jantar Empresarial.', headline: 'Últimas vagas' },
    { name: 'Criativo 06 — Depoimento de Participante', set: setRmk, camp: campRmk, type: 'video', status: 'Ativo', placement: 'Reels', start: -12, end: 0, spend: 30, cpm: 22, ctr: 1.15, lead: 0.2, buy: 0.02, text: '"Saí do jantar com dois novos parceiros comerciais." — depoimento ilustrativo', headline: 'Quem foi, recomenda' },
  ]

  const ads: Ad[] = []
  const ad_metrics_daily: AdMetricDaily[] = []
  profiles.forEach((p, i) => {
    const adId = id()
    ads.push({
      id: adId, ad_set_id: p.set, campaign_id: p.camp, ad_account_id: DEMO.adAccount, project_id: DEMO.projectJantar,
      external_id: `demo_ad_${i + 1}`, name: p.name, status: p.status, platform: 'Meta (Instagram/Facebook)', placement: p.placement,
      creative_type: p.type, thumbnail_url: `/demo/creative-0${i + 1}.svg`, video_url: null, primary_text: p.text, headline: p.headline,
      description: 'Anúncio demonstrativo — não veiculado.', is_demo: true, created_at: ts,
    })
    for (let off = p.start; off <= p.end; off++) {
      const noise = 0.7 + rand() * 0.6
      const spend = Math.round(p.spend * noise * 100) / 100
      const impressions = Math.round((spend / p.cpm) * 1000)
      const link_clicks = Math.round(impressions * (p.ctr / 100) * (0.85 + rand() * 0.3))
      const leads = Math.round(link_clicks * p.lead * (0.7 + rand() * 0.6))
      const purchases = Math.round(link_clicks * p.buy * (0.5 + rand()))
      ad_metrics_daily.push({
        id: id(), ad_id: adId, ad_account_id: DEMO.adAccount, date: d(off), spend, impressions, reach: Math.round(impressions * 0.78),
        link_clicks, leads, purchases, purchase_value: purchases * 497, attribution_setting: '7 dias após o clique / 1 dia após visualização (demo)',
        source: 'demo', synced_at: ts, is_demo: true,
      })
    }
  })

  const prod = (pid: string, name: string, price: number): Product => ({ id: id(), project_id: pid, name, price, active: true, is_demo: true, created_at: ts })
  const pIndiv = prod(DEMO.projectJantar, 'Ingresso Individual', 497)
  const pDupla = prod(DEMO.projectJantar, 'Ingresso Dupla', 897)
  const pVip = prod(DEMO.projectJantar, 'Mesa VIP (4 lugares)', 2497)
  const pCamila = prod(DEMO.projectCamila, 'Ingresso Imersão', 597)
  const products = [pIndiv, pDupla, pVip, pCamila]

  const sales: Sale[] = []
  const methods = ['Pix', 'Cartão de crédito', 'Cartão de crédito', 'Boleto']
  const origins = ['Meta Ads', 'Meta Ads', 'Orgânico Instagram', 'Indicação', 'WhatsApp']
  const addSale = (pid: string, product: Product, off: number, status: Sale['status']) => {
    const n = sales.length + 1
    const method = methods[Math.floor(rand() * methods.length)]
    const discount = rand() < 0.2 ? Math.round(product.price * 0.1) : 0
    const gross = product.price
    const fees = status === 'cancelada' || status === 'pendente' ? 0 : Math.round((gross - discount) * (method === 'Pix' ? 0.0099 : 0.0499) * 100) / 100
    sales.push({
      id: id(), project_id: pid, product_id: product.id, order_ref: `DEMO-${String(n).padStart(4, '0')}`, sale_date: d(off),
      gross_amount: gross, discount, fees, refund_amount: status === 'reembolsada' ? gross - discount : 0, payment_method: method, status,
      origin: origins[Math.floor(rand() * origins.length)], notes: '', external_source: null, external_id: null, is_demo: true, created_at: ts, updated_at: ts,
    })
  }
  for (let off = -14; off <= 0; off++) {
    const count = off > -4 ? 3 : off > -9 ? 2 : 1
    for (let k = 0; k < count; k++) {
      const r = rand()
      addSale(DEMO.projectJantar, r < 0.62 ? pIndiv : r < 0.9 ? pDupla : pVip, off, 'aprovada')
    }
  }
  addSale(DEMO.projectJantar, pIndiv, -9, 'reembolsada')
  addSale(DEMO.projectJantar, pDupla, -6, 'reembolsada')
  addSale(DEMO.projectJantar, pIndiv, -1, 'pendente')
  addSale(DEMO.projectJantar, pIndiv, 0, 'pendente')
  addSale(DEMO.projectJantar, pDupla, -3, 'cancelada')
  for (let off = -10; off <= 0; off += 2) addSale(DEMO.projectCamila, pCamila, off, 'aprovada')

  const exp = (pid: string, description: string, category: string, off: number, amount: number, extra: Partial<Expense> = {}): Expense => ({
    id: id(), project_id: pid, description, category, expense_date: d(off), amount, payment_method: 'Pix', status: 'paga', owner: 'Ana (gestão)',
    receipt_url: null, notes: '', ad_account_id: null, is_demo: true, created_at: ts, updated_at: ts, ...extra,
  })
  const expenses = [
    exp(DEMO.projectJantar, 'Vídeo institucional do evento', 'Produção', -25, 2500),
    exp(DEMO.projectJantar, 'Design de criativos (pacote 6 peças)', 'Design', -20, 1200),
    exp(DEMO.projectJantar, 'Copy das páginas e anúncios', 'Copywriting', -22, 900),
    exp(DEMO.projectJantar, 'Plataforma de checkout (mensalidade)', 'Ferramentas', -15, 197, { payment_method: 'Cartão de crédito' }),
    exp(DEMO.projectJantar, 'Sinal de reserva do restaurante', 'Estrutura do evento', -12, 6000),
    exp(DEMO.projectJantar, 'Sinal do buffet', 'Alimentação e hospedagem', -8, 3500),
    exp(DEMO.projectJantar, 'Recarga de saldo Meta Ads (já contabilizada na sincronização)', 'Tráfego pago', -15, 3000, {
      ad_account_id: DEMO.adAccount, payment_method: 'Cartão de crédito', notes: 'Vinculada à conta de anúncios: não é somada de novo ao custo.',
    }),
    exp(DEMO.projectJantar, 'Impulsionamento manual no Instagram', 'Tráfego pago', -10, 150, { notes: 'Gasto fora da conta sincronizada.' }),
    exp(DEMO.projectJantar, 'Fotógrafo do evento (sinal)', 'Equipe', -3, 800, { status: 'pendente' }),
    exp(DEMO.projectCamila, 'Locação de sala', 'Estrutura do evento', -10, 2500),
  ]

  const task = (title: string, phase: number | null, status: Task['status'], priority: Task['priority'], dueOff: number | null, assignee: string, pid = DEMO.projectJantar, checklist: [string, boolean][] = []): Task => ({
    id: id(), project_id: pid, phase_number: phase, title, description: 'Tarefa demonstrativa.', assignee, priority,
    start_date: dueOff === null ? null : d(dueOff - 5), due_date: dueOff === null ? null : d(dueOff), status,
    checklist: check(checklist), sort_order: seq, is_demo: true, created_at: ts, updated_at: ts,
  })
  const tasks: Task[] = [
    task('Validar proposta de valor com o expert', 1, 'concluida', 'alta', -30, 'Ana (gestão)'),
    task('Definir preços dos ingressos', 2, 'concluida', 'alta', -18, 'Ana (gestão)'),
    task('Publicar página do evento', 3, 'concluida', 'alta', -18, 'Carla (design)'),
    task('Configurar eventos de conversão no pixel', 3, 'andamento', 'urgente', -2, 'Bruno (tráfego)', DEMO.projectJantar, [['Lead', true], ['Purchase', false], ['InitiateCheckout', false]]),
    task('Produzir 3 novos criativos de remarketing', 3, 'revisao', 'alta', 1, 'Carla (design)'),
    task('Revisar página de confirmação', 3, 'a_fazer', 'media', 2, 'Carla (design)'),
    task('Roteiro de ligações para leads quentes', 4, 'a_fazer', 'alta', 4, 'Ana (gestão)'),
    task('Fechar cardápio com o buffet', null, 'bloqueada', 'media', -1, 'Ana (gestão)'),
    task('Enviar lembrete por WhatsApp aos inscritos', 4, 'a_fazer', 'media', 6, 'Bruno (tráfego)'),
    task('Definir lista de convidados VIP', null, 'andamento', 'baixa', 9, 'Rafael Martins'),
    task('Entrevista de posicionamento da mentoria', 1, 'a_fazer', 'alta', 5, 'Ana (gestão)', DEMO.projectMentoria),
    task('Reservar espaço da imersão', 2, 'andamento', 'alta', 3, 'Equipe Camila', DEMO.projectCamila),
  ]

  const secId = id()
  const section_configs: SectionConfig[] = [{
    id: secId, name: 'Parceiros do Evento', slug: 'parceiros_do_evento', icon: 'Handshake', description: 'Patrocinadores e parceiros (seção dinâmica de exemplo).',
    menu_position: 10, roles: ['admin', 'expert'], project_id: null, expert_id: null, visible_to_expert: true, expert_can_edit: false, active: true,
    fields: [
      { key: 'nome', label: 'Nome do parceiro', type: 'text', required: true, options: [], show_in_card: true, show_in_table: true, filterable: false },
      { key: 'logo', label: 'Logo', type: 'image', required: false, options: [], show_in_card: true, show_in_table: false, filterable: false },
      { key: 'tipo', label: 'Tipo de parceria', type: 'select', required: true, options: ['Patrocínio', 'Permuta', 'Apoio'], show_in_card: true, show_in_table: true, filterable: true },
      { key: 'valor', label: 'Valor negociado', type: 'currency', required: false, options: [], show_in_card: true, show_in_table: true, filterable: false },
      { key: 'projeto', label: 'Projeto', type: 'project', required: false, options: [], show_in_card: false, show_in_table: true, filterable: true },
      { key: 'site', label: 'Site', type: 'url', required: false, options: [], show_in_card: false, show_in_table: true, filterable: false },
    ],
    created_at: ts, updated_at: ts,
  }]
  const section_records: SectionRecord[] = [
    { id: id(), section_id: secId, project_id: DEMO.projectJantar, expert_id: DEMO.expertRafael, data: { nome: 'Vinícola Exemplo', tipo: 'Permuta', valor: 2400, projeto: DEMO.projectJantar, site: 'https://exemplo.com', logo: '/demo/cover-podcast.svg' }, created_by: adminId ?? 'seed', created_at: ts, updated_at: ts },
    { id: id(), section_id: secId, project_id: DEMO.projectJantar, expert_id: DEMO.expertRafael, data: { nome: 'Banco Fictício S.A.', tipo: 'Patrocínio', valor: 5000, projeto: DEMO.projectJantar, site: 'https://exemplo.com' }, created_by: adminId ?? 'seed', created_at: ts, updated_at: ts },
  ]

  const activity_log: ActivityLog[] = [
    { id: id(), project_id: DEMO.projectJantar, expert_id: DEMO.expertRafael, entity_type: 'projects', entity_id: DEMO.projectJantar, action: 'insert', summary: 'Projeto criado (dados demonstrativos)', user_id: adminId, user_name: adminName, is_audit: false, data: null, created_at: at(-40) },
  ]

  return { experts, projects, project_phases, phase_history, movements, pages, ad_accounts, campaigns, ad_sets, ads, ad_metrics_daily, products, sales, expenses, tasks, section_configs, section_records, activity_log }
}

/** Ordem de inserção respeitando as chaves estrangeiras. */
export const DEMO_INSERT_ORDER: (keyof DemoData)[] = [
  'experts', 'ad_accounts', 'projects', 'project_phases', 'phase_history', 'movements', 'pages', 'campaigns', 'ad_sets', 'ads',
  'ad_metrics_daily', 'products', 'sales', 'expenses', 'tasks', 'section_configs', 'section_records', 'activity_log',
]
