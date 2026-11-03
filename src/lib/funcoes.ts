import type { Funcao, Role } from '@/data/types'

export const FUNCOES: { value: Funcao; label: string }[] = [
  { value: 'expert', label: 'Expert' },
  { value: 'estrategista', label: 'Estrategista' },
  { value: 'gestor_trafego', label: 'Gestor de tráfego' },
  { value: 'closer', label: 'Closer' },
  { value: 'sdr', label: 'SDR' },
  { value: 'social_seller', label: 'Social seller' },
  { value: 'gerente_projeto', label: 'Gerente de projeto' },
]

export const funcaoLabel = (f?: Funcao | null) => FUNCOES.find((x) => x.value === f)?.label ?? 'Sem função'

export const ROLE_LABEL: Record<Role, string> = { owner: 'Dono', admin: 'Administrador', expert: 'Membro' }

export const isAdminRole = (r?: Role | null) => r === 'owner' || r === 'admin'
