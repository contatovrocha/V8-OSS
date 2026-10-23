import {
  BarChart3, Briefcase, Calendar, CheckSquare, ClipboardList, Compass, FileText, FolderKanban, Gauge, Gem, Globe, Handshake, Heart,
  Image, LayoutGrid, Lightbulb, Megaphone, MessageSquare, Mic, Package, Rocket, Settings, Sparkles, Star, Target, Trophy, Users,
  Video, Wallet, type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  key: string
  label: string
  path: string
  icon: LucideIcon
  position: number
}

export const NATIVE_NAV: NavItem[] = [
  { key: 'visao_geral', label: 'Visão Geral', path: '/', icon: Gauge, position: 1 },
  { key: 'posicionamento', label: 'Posicionamento', path: '/posicionamento', icon: Compass, position: 2 },
  { key: 'projetos', label: 'Projetos', path: '/projetos', icon: FolderKanban, position: 3 },
  { key: 'paginas', label: 'Páginas', path: '/paginas', icon: Globe, position: 4 },
  { key: 'trafego', label: 'Tráfego', path: '/trafego', icon: Megaphone, position: 5 },
  { key: 'financeiro', label: 'Financeiro', path: '/financeiro', icon: Wallet, position: 6 },
  { key: 'tarefas', label: 'Tarefas', path: '/tarefas', icon: CheckSquare, position: 7 },
  { key: 'relatorios', label: 'Relatórios', path: '/relatorios', icon: BarChart3, position: 8 },
]

export const SETTINGS_NAV: NavItem = { key: 'configuracoes', label: 'Configurações', path: '/configuracoes', icon: Settings, position: 99 }

/** Ícones disponíveis para seções dinâmicas (Construtor de Seções). */
export const SECTION_ICONS: Record<string, LucideIcon> = {
  LayoutGrid, Handshake, Star, Trophy, Target, Lightbulb, Rocket, Sparkles, Users, Briefcase, Calendar, ClipboardList, FileText,
  Image, Video, Mic, MessageSquare, Package, Gem, Heart, Globe, Megaphone,
}

export const iconFor = (name: string): LucideIcon => SECTION_ICONS[name] ?? LayoutGrid
