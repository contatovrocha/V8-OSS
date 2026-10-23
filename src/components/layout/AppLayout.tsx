import clsx from 'clsx'
import { ChevronsLeft, ChevronsRight, LogOut, Menu, PanelTop, PanelLeft, X, Database } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useApp } from '@/app/AppContext'
import { iconFor, NATIVE_NAV, SETTINGS_NAV, type NavItem } from '@/app/nav'
import { useAuth } from '@/auth/AuthContext'
import { backend } from '@/data/client'
import { useRows } from '@/data/store'
import { Avatar, Select } from '../ui/primitives'
import { PeriodPicker } from './PeriodPicker'

const LS = 'launchos:nav:v1'

export function useNavItems(): NavItem[] {
  const { canSee } = useApp()
  const { isAdmin } = useAuth()
  const sections = useRows('section_configs')
  return useMemo(() => {
    const dyn: NavItem[] = sections.rows
      .filter((s) => s.active && (isAdmin || s.visible_to_expert))
      .map((s) => ({ key: `secao:${s.slug}`, label: s.name, path: `/secoes/${s.slug}`, icon: iconFor(s.icon), position: s.menu_position }))
    const native = NATIVE_NAV.filter((n) => canSee(n.key))
    return [...native, ...dyn].sort((a, b) => a.position - b.position || a.label.localeCompare(b.label)).concat(isAdmin ? [SETTINGS_NAV] : [])
  }, [sections.rows, canSee, isAdmin])
}

function Brand({ compact }: { compact?: boolean }) {
  const { settings } = useApp()
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      {settings.logo_url ? (
        <img src={settings.logo_url} alt="" className="size-9 rounded-xl object-cover" />
      ) : (
        <div className="size-9 rounded-xl bg-primary grid place-items-center shrink-0 shadow-[0_8px_24px_-10px_var(--brand-primary)]">
          <svg viewBox="0 0 64 64" className="size-6"><path d="M18 46 L46 18" stroke="var(--brand-accent)" strokeWidth="6" strokeLinecap="round" /><path d="M36 18h10v10" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" /><circle cx="24" cy="40" r="4.5" fill="#fff" /><circle cx="32" cy="32" r="4.5" fill="#fff" /></svg>
        </div>
      )}
      {!compact && <span className="font-extrabold tracking-[0.14em] uppercase text-sm truncate">{settings.brand_name}</span>}
    </div>
  )
}

function NavList({ items, collapsed, onNavigate }: { items: NavItem[]; collapsed?: boolean; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {items.map((it) => (
        <NavLink
          key={it.key}
          to={it.path}
          end={it.path === '/'}
          onClick={onNavigate}
          title={collapsed ? it.label : undefined}
          className={({ isActive }) =>
            clsx(
              'flex items-center gap-3 rounded-xl px-3 h-10 text-sm font-semibold transition',
              collapsed && 'justify-center px-0',
              isActive ? 'bg-primary text-white shadow-[0_8px_24px_-12px_var(--brand-primary)]' : 'text-muted hover:text-ink hover:bg-surface-3',
            )
          }
        >
          <it.icon className="size-[18px] shrink-0" />
          {!collapsed && <span className="truncate">{it.label}</span>}
        </NavLink>
      ))}
    </nav>
  )
}

function TopNav({ items }: { items: NavItem[] }) {
  return (
    <nav className="hidden xl:flex items-center gap-0.5 rounded-full bg-surface-2/80 border border-line p-1 overflow-x-auto">
      {items.map((it) => (
        <NavLink
          key={it.key}
          to={it.path}
          end={it.path === '/'}
          className={({ isActive }) => clsx('flex items-center gap-1.5 rounded-full px-3 h-8 text-[13px] font-semibold whitespace-nowrap transition', isActive ? 'bg-primary text-white' : 'text-muted hover:text-ink')}
        >
          <it.icon className="size-3.5" />
          {it.label}
        </NavLink>
      ))}
    </nav>
  )
}

export function AppLayout({ children }: { children: ReactNode }) {
  const items = useNavItems()
  const { user, signOut, isAdmin } = useAuth()
  const app = useApp()
  const [prefs, setPrefs] = useState<{ collapsed: boolean; mode: 'side' | 'top' }>(() => {
    try {
      return { collapsed: false, mode: 'side', ...JSON.parse(localStorage.getItem(LS) ?? '{}') }
    } catch {
      return { collapsed: false, mode: 'side' }
    }
  })
  const [mobileOpen, setMobileOpen] = useState(false)
  const loc = useLocation()
  useEffect(() => localStorage.setItem(LS, JSON.stringify(prefs)), [prefs])
  useEffect(() => setMobileOpen(false), [loc.pathname])

  const top = prefs.mode === 'top'
  const sideW = prefs.collapsed ? 'lg:pl-[84px]' : 'lg:pl-[248px]'
  const owner = app.selectedExpert?.full_name ?? (isAdmin ? app.settings.operation_name : app.experts[0]?.full_name ?? '')
  const mobileMain = items.filter((i) => ['visao_geral', 'projetos', 'trafego', 'financeiro'].includes(i.key))

  return (
    <div className="min-h-screen">
      {/* Sidebar desktop */}
      <aside className={clsx('hidden lg:flex fixed inset-y-0 left-0 z-30 flex-col border-r border-line bg-bg/80 backdrop-blur-xl transition-all no-print', prefs.collapsed ? 'w-[84px]' : 'w-[248px]', top && 'xl:hidden')}>
        <div className={clsx('h-16 flex items-center px-5', prefs.collapsed && 'justify-center px-0')}>
          <Brand compact={prefs.collapsed} />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <NavList items={items} collapsed={prefs.collapsed} />
        </div>
        <div className="p-3 border-t border-line flex flex-col gap-1">
          <button onClick={() => setPrefs((p) => ({ ...p, mode: 'top' }))} className="hidden xl:flex items-center gap-3 rounded-xl px-3 h-9 text-xs font-semibold text-muted hover:text-ink hover:bg-surface-3" title="Navegação no topo">
            <PanelTop className="size-4" />{!prefs.collapsed && 'Menu no topo'}
          </button>
          <button onClick={() => setPrefs((p) => ({ ...p, collapsed: !p.collapsed }))} className="flex items-center gap-3 rounded-xl px-3 h-9 text-xs font-semibold text-muted hover:text-ink hover:bg-surface-3" title={prefs.collapsed ? 'Expandir menu' : 'Recolher menu'}>
            {prefs.collapsed ? <ChevronsRight className="size-4" /> : <><ChevronsLeft className="size-4" />Recolher menu</>}
          </button>
        </div>
      </aside>

      <div className={clsx('transition-all', sideW, top && 'xl:pl-0')}>
        <header className="sticky top-0 z-20 border-b border-line bg-bg/75 backdrop-blur-xl no-print">
          <div className="max-w-[1440px] mx-auto px-4 lg:px-6 h-16 flex items-center gap-3">
            <button className="lg:hidden p-2 -ml-2 text-muted" onClick={() => setMobileOpen(true)} aria-label="Abrir menu"><Menu className="size-5" /></button>
            {top && <div className="hidden xl:block"><Brand /></div>}
            <div className="min-w-0 flex-1 xl:flex-none">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary truncate">{owner || app.settings.brand_name}</div>
              <div className="flex items-center gap-2 min-w-0">
                {isAdmin && app.experts.length > 1 && (
                  <Select className="hidden sm:block !h-7 !w-auto max-w-40 !text-xs !rounded-full !bg-transparent !border-transparent hover:!border-line font-semibold !pl-0" value={app.expertId} onChange={(e) => app.setExpertId(e.target.value)} aria-label="Expert">
                    <option value="all">Todos os experts</option>
                    {app.experts.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                  </Select>
                )}
                <Select className="!h-7 !w-auto min-w-0 max-w-full sm:max-w-56 !text-sm !rounded-full !bg-transparent !border-transparent hover:!border-line font-bold !pl-0 truncate" value={app.projectId} onChange={(e) => app.setProjectId(e.target.value)} aria-label="Projeto selecionado">
                  <option value="all">Todos os projetos</option>
                  {app.projects.filter((p) => !p.archived).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              </div>
            </div>
            {top && <div className="flex-1 hidden xl:flex justify-center min-w-0"><TopNav items={items} /></div>}
            <div className="hidden md:block"><PeriodPicker period={app.period} onChange={app.setPeriod} /></div>
            {backend.mode === 'local' && (
              <span className="hidden 2xl:inline-flex items-center gap-1.5 text-[11px] text-warning/90 border border-warning/25 rounded-full px-2.5 py-1" title="Sem Supabase configurado: dados salvos neste navegador.">
                <Database className="size-3" />Modo local
              </span>
            )}
            {top && (
              <button onClick={() => setPrefs((p) => ({ ...p, mode: 'side' }))} className="hidden xl:grid size-9 place-items-center rounded-full text-muted hover:text-ink hover:bg-surface-3" title="Menu lateral"><PanelLeft className="size-4" /></button>
            )}
            <div className="flex items-center gap-2.5 pl-1">
              <div className="hidden sm:block text-right leading-tight">
                <div className="text-sm font-bold truncate max-w-40">{user?.full_name}</div>
                <div className="text-[10px] uppercase tracking-widest text-muted">{isAdmin ? 'Administrador' : 'Expert'}</div>
              </div>
              <Avatar src={user?.avatar_url ?? (!isAdmin ? app.experts[0]?.photo_url : null)} name={user?.full_name ?? ''} size={36} />
              <button onClick={signOut} className="size-9 grid place-items-center rounded-full text-muted hover:text-ink hover:bg-surface-3" title="Sair" aria-label="Sair"><LogOut className="size-4" /></button>
            </div>
          </div>
          <div className="md:hidden px-4 pb-3 -mt-1"><PeriodPicker period={app.period} onChange={app.setPeriod} align="left" /></div>
        </header>

        <main className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6 pb-28 lg:pb-10">{children}</main>
      </div>

      {/* Navegação mobile */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-line bg-bg/90 backdrop-blur-xl grid grid-cols-5 no-print">
        {mobileMain.map((it) => (
          <NavLink key={it.key} to={it.path} end={it.path === '/'} className={({ isActive }) => clsx('flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold', isActive ? 'text-primary' : 'text-muted')}>
            <it.icon className="size-5" />
            {it.label}
          </NavLink>
        ))}
        <button onClick={() => setMobileOpen(true)} className="flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold text-muted"><Menu className="size-5" />Mais</button>
      </nav>
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-surface border-r border-line p-4 flex flex-col animate-fade-up">
            <div className="flex items-center justify-between mb-4"><Brand /><button onClick={() => setMobileOpen(false)} aria-label="Fechar menu"><X className="size-5 text-muted" /></button></div>
            <div className="overflow-y-auto"><NavList items={items} /></div>
          </aside>
        </div>
      )}
    </div>
  )
}

export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow?: string; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div className="min-w-0">
        {eyebrow && <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary mb-1">{eyebrow}</div>}
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 no-print">{actions}</div>}
    </div>
  )
}
