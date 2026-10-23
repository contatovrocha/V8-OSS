import type { FieldConfig, FieldType } from '@/data/types'

export const FIELD_TYPE_LABEL: Record<FieldType, string> = {
  text: 'Texto curto',
  textarea: 'Texto longo',
  number: 'Número',
  currency: 'Moeda',
  date: 'Data',
  datetime: 'Data e hora',
  select: 'Seleção única',
  multiselect: 'Seleção múltipla',
  checkbox: 'Checkbox',
  url: 'URL',
  image: 'Imagem',
  file: 'Arquivo',
  status: 'Status',
  project: 'Relacionamento com projeto',
  expert: 'Relacionamento com expert',
}

export const OPTION_TYPES: FieldType[] = ['select', 'multiselect', 'status']

export function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48)
}

const isEmpty = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)

/**
 * Valida e normaliza os dados de um registro dinâmico de acordo com a configuração da seção.
 * Mesma regra aplicada no servidor pela função SQL public.validate_section_record.
 * Chaves que não pertencem à configuração atual são preservadas (alterações de configuração
 * nunca apagam dados existentes).
 */
export function validateRecord(fields: FieldConfig[], data: Record<string, unknown>): { data: Record<string, unknown>; errors: Record<string, string> } {
  const errors: Record<string, string> = {}
  const out: Record<string, unknown> = { ...data }
  for (const f of fields) {
    const v = data[f.key]
    if (isEmpty(v) || (f.type === 'checkbox' && v === false && f.required)) {
      if (f.required) errors[f.key] = `${f.label} é obrigatório`
      if (f.type !== 'checkbox') out[f.key] = null
      continue
    }
    switch (f.type) {
      case 'number':
      case 'currency': {
        const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
        if (!Number.isFinite(n)) errors[f.key] = `${f.label} deve ser um número`
        else out[f.key] = n
        break
      }
      case 'date':
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v))) errors[f.key] = `${f.label}: data inválida`
        break
      case 'datetime':
        if (Number.isNaN(new Date(String(v)).getTime())) errors[f.key] = `${f.label}: data e hora inválidas`
        break
      case 'url':
      case 'image':
      case 'file':
        if (!/^(https?:\/\/|data:|blob:|\/)/.test(String(v))) errors[f.key] = `${f.label}: informe um endereço válido (https://...)`
        break
      case 'select':
      case 'status':
        if (f.options.length && !f.options.includes(String(v))) errors[f.key] = `${f.label}: opção inválida`
        break
      case 'multiselect':
        if (!Array.isArray(v) || v.some((x) => f.options.length > 0 && !f.options.includes(String(x)))) errors[f.key] = `${f.label}: opções inválidas`
        break
      case 'checkbox':
        out[f.key] = Boolean(v)
        break
      default:
        out[f.key] = typeof v === 'string' ? v.trim() : v
    }
  }
  return { data: out, errors }
}
