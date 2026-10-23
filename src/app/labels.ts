import type { Tone } from '@/components/ui/primitives'
import type { MovementStatus, PageStatus, ProjectStatus, SaleStatus, TaskPriority, TaskStatus } from '@/data/types'

export const PROJECT_STATUS: Record<ProjectStatus, { label: string; tone: Tone }> = {
  ativo: { label: 'Ativo', tone: 'success' },
  inativo: { label: 'Inativo', tone: 'neutral' },
  estruturacao: { label: 'Em estruturação', tone: 'accent' },
}

export const PAGE_STATUS: Record<PageStatus, { label: string; tone: Tone }> = {
  planejada: { label: 'Planejada', tone: 'neutral' },
  producao: { label: 'Em produção', tone: 'accent' },
  revisao: { label: 'Em revisão', tone: 'warning' },
  publicada: { label: 'Publicada', tone: 'success' },
  pausada: { label: 'Pausada', tone: 'danger' },
}

export const TASK_STATUS: Record<TaskStatus, { label: string; tone: Tone }> = {
  a_fazer: { label: 'A fazer', tone: 'neutral' },
  andamento: { label: 'Em andamento', tone: 'primary' },
  revisao: { label: 'Em revisão', tone: 'warning' },
  concluida: { label: 'Concluída', tone: 'success' },
  bloqueada: { label: 'Bloqueada', tone: 'danger' },
}

export const TASK_PRIORITY: Record<TaskPriority, { label: string; tone: Tone }> = {
  baixa: { label: 'Baixa', tone: 'neutral' },
  media: { label: 'Média', tone: 'primary' },
  alta: { label: 'Alta', tone: 'accent' },
  urgente: { label: 'Urgente', tone: 'danger' },
}

export const SALE_STATUS: Record<SaleStatus, { label: string; tone: Tone }> = {
  pendente: { label: 'Pendente', tone: 'warning' },
  aprovada: { label: 'Aprovada', tone: 'success' },
  reembolsada: { label: 'Reembolsada', tone: 'accent' },
  cancelada: { label: 'Cancelada', tone: 'danger' },
}

export const MOVEMENT_STATUS: Record<MovementStatus, { label: string; tone: Tone }> = {
  publicado: { label: 'Publicado', tone: 'success' },
  rascunho: { label: 'Rascunho', tone: 'neutral' },
  desativado: { label: 'Desativado', tone: 'danger' },
}

export const EXPENSE_STATUS = { pendente: 'Pendente', paga: 'Paga', cancelada: 'Cancelada' } as const

export const PAYMENT_METHODS = ['Pix', 'Cartão de crédito', 'Boleto', 'Transferência', 'Dinheiro', 'Outro']

export function adStatusTone(s: string): Tone {
  const v = s.toLowerCase()
  if (v.startsWith('ativ')) return 'success'
  if (v.startsWith('paus')) return 'warning'
  if (v.includes('rejeit') || v.includes('erro')) return 'danger'
  return 'neutral'
}
