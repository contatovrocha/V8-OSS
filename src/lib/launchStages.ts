import { BadgeCheck, Contact, FileText, Link2, MessageCircle, MonitorPlay, Palette, Rocket, ShoppingCart, type LucideIcon } from 'lucide-react'
import type { ChecklistItem, LaunchStage, LaunchStageStatus } from '@/data/types'

/** Tipo de material do sistema que aparece automaticamente na etapa correspondente. */
export type StageAsset = 'brand_doc' | 'pages' | 'review' | 'creatives' | 'accounts' | 'checkout' | 'groups' | 'crm' | 'capture'

export interface StageDef {
  number: number
  title: string
  summary: string
  icon: LucideIcon
  checklist: string[]
  assets: StageAsset[]
}

/** Processo de lançamento V8: 9 etapas, da conversa inicial ao início da captação. */
export const LAUNCH_STAGES: StageDef[] = [
  {
    number: 1, title: 'Briefing inicial', icon: FileText, assets: ['brand_doc'],
    summary: 'Enviar o Documento de Marca ao cliente para entender produto, público, objetivo, estratégia, oferta e diferenciais.',
    checklist: ['Enviar o link do Documento de Marca', 'Produto ou workshop definido', 'Público-alvo definido', 'Objetivo do lançamento definido', 'Estratégia definida', 'Oferta definida', 'Diferenciais mapeados'],
  },
  {
    number: 2, title: 'Construção da estrutura', icon: MonitorPlay, assets: ['pages'],
    summary: 'Desenvolver a estrutura inicial: quiz, landing page, jornada do lead e produto no checkout.',
    checklist: ['Criar o quiz', 'Criar a landing page', 'Definir a jornada do lead', 'Configurar o produto na plataforma de checkout'],
  },
  {
    number: 3, title: 'Apresentação e validação', icon: BadgeCheck, assets: ['review'],
    summary: 'Call com o cliente para apresentar quiz e landing page, validar, tirar dúvidas e ajustar.',
    checklist: ['Apresentar o quiz e a landing page', 'Validar a estrutura', 'Tirar dúvidas', 'Receber feedbacks', 'Realizar melhorias e ajustes'],
  },
  {
    number: 4, title: 'Estruturação dos criativos', icon: Palette, assets: ['creatives'],
    summary: 'Ângulos de comunicação, ganchos, roteiros, formatos de anúncio e materiais para produção.',
    checklist: ['Definir ângulos de comunicação', 'Criar ganchos', 'Estruturar roteiros', 'Definir formatos de anúncios', 'Organizar os materiais para produção'],
  },
  {
    number: 5, title: 'Conexão das contas', icon: Link2, assets: ['accounts'],
    summary: 'Integrar Facebook Ads, Instagram e Google Ads (se houver) e conferir permissões.',
    checklist: ['Facebook Ads', 'Instagram', 'Google Ads, caso o cliente utilize', 'Verificar permissões e acessos'],
  },
  {
    number: 6, title: 'Configuração do checkout', icon: ShoppingCart, assets: ['checkout'],
    summary: 'Criar o produto, preço e condições, configurar o checkout e validar os links de pagamento.',
    checklist: ['Criar o produto', 'Definir preço e condições', 'Configurar o checkout', 'Validar links de pagamento', 'Verificar integrações necessárias'],
  },
  {
    number: 7, title: 'Estruturação dos grupos', icon: MessageCircle, assets: ['groups'],
    summary: 'Número de WhatsApp, chip, grupos, administradores e estratégia de entrada dos leads.',
    checklist: ['Definir o número de WhatsApp', 'Providenciar chip, caso necessário', 'Criar os grupos', 'Definir os administradores', 'Organizar a entrada dos leads nos grupos'],
  },
  {
    number: 8, title: 'Estruturação do CRM', icon: Contact, assets: ['crm'],
    summary: 'Pipelines, etapas comerciais, distribuição dos leads, responsáveis e follow-up.',
    checklist: ['Configurar pipelines', 'Definir etapas comerciais', 'Organizar a distribuição dos leads', 'Configurar responsáveis', 'Estruturar acompanhamento e follow-up', 'Preparar o time comercial para atender os leads'],
  },
  {
    number: 9, title: 'Início da captação', icon: Rocket, assets: ['capture'],
    summary: 'Com tudo validado: iniciar campanhas, ativar a captação, monitorar e acompanhar as métricas.',
    checklist: ['Iniciar campanhas', 'Ativar captação de leads', 'Monitorar os primeiros resultados', 'Acompanhar métricas', 'Garantir que toda a operação esteja funcionando'],
  },
]

export const STAGE_STATUS: { value: LaunchStageStatus; label: string; tone: 'neutral' | 'accent' | 'success' }[] = [
  { value: 'a_fazer', label: 'A fazer', tone: 'neutral' },
  { value: 'andamento', label: 'Em andamento', tone: 'accent' },
  { value: 'concluida', label: 'Concluída', tone: 'success' },
]
export const stageStatusLabel = (s: LaunchStageStatus) => STAGE_STATUS.find((x) => x.value === s)!.label

export const stageDef = (n: number) => LAUNCH_STAGES.find((s) => s.number === n)

const defaultChecklist = (def: StageDef): ChecklistItem[] => def.checklist.map((label, i) => ({ id: `s${def.number}-${i}`, label, done: false }))

/** Etapa do projeto: a gravada no banco ou, se ainda não existe, a etapa padrão (gravada na primeira alteração). */
export function stageOf(rows: LaunchStage[], projectId: string, n: number): LaunchStage & { persisted: boolean } {
  const row = rows.find((r) => r.project_id === projectId && r.stage_number === n)
  if (row) return { ...row, persisted: true }
  const def = stageDef(n)!
  return { id: '', project_id: projectId, stage_number: n, status: 'a_fazer', owner: '', checklist: defaultChecklist(def), notes: '', links: [], completed_at: null, created_at: '', updated_at: '', persisted: false }
}

/** Progresso do processo: etapas concluídas contam inteiras; em andamento contam pelo checklist. */
export function processProgress(stages: Pick<LaunchStage, 'status' | 'checklist'>[]): number {
  if (!stages.length) return 0
  const sum = stages.reduce((acc, s) => {
    if (s.status === 'concluida') return acc + 1
    if (s.status === 'andamento' && s.checklist.length) return acc + (s.checklist.filter((c) => c.done).length / s.checklist.length) * 0.9
    return acc
  }, 0)
  return Math.round((sum / LAUNCH_STAGES.length) * 100)
}
