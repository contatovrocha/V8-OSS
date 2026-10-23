import { storage } from '@/lib/storage'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '@/auth/AuthContext'
import { useRows } from '@/data/store'
import type { AppSettings, Expert, Project } from '@/data/types'
import { setTimezone } from '@/lib/format'
import { resolvePeriod, type Period, type PeriodPreset } from '@/lib/period'
import { baseConfig, ALL_MODULES } from '@/data/seed'

interface AppState {
  settings: AppSettings
  period: Period
  setPeriod: (preset: PeriodPreset, custom?: { from: string; to: string }) => void
  experts: Expert[]
  expertId: string | 'all'
  setExpertId: (id: string | 'all') => void
  /** Projetos visíveis no escopo (expert selecionado), incluindo arquivados. */
  projects: Project[]
  projectId: string | 'all'
  setProjectId: (id: string | 'all') => void
  /** Conjunto de projetos considerados nos indicadores; null = todos os visíveis. */
  scopeProjectIds: Set<string>
  selectedProject: Project | null
  selectedExpert: Expert | null
  canSee: (module: string) => boolean
  loading: boolean
}

const Ctx = createContext<AppState>(null as unknown as AppState)
export const useApp = () => useContext(Ctx)

const LS = 'launchos:ui:v1'
function loadUi(): { preset?: PeriodPreset; from?: string; to?: string; expertId?: string; projectId?: string } {
  try {
    return JSON.parse(storage.get(LS) ?? '{}')
  } catch {
    return {}
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const { user, isAdmin } = useAuth()
  const settingsRows = useRows('app_settings')
  const expertsRows = useRows('experts')
  const projectsRows = useRows('projects')
  const ui = loadUi()
  const [period, setP] = useState<Period>(resolvePeriod(ui.preset ?? '30d', ui.from && ui.to ? { from: ui.from, to: ui.to } : undefined))
  const [expertId, setExpertId] = useState<string | 'all'>(ui.expertId ?? 'all')
  const [projectId, setProjectId] = useState<string | 'all'>(ui.projectId ?? 'all')

  const settings = settingsRows.rows[0] ?? baseConfig().settings

  useEffect(() => {
    const root = document.documentElement.style
    root.setProperty('--brand-primary', settings.primary_color)
    root.setProperty('--brand-success', settings.success_color)
    root.setProperty('--brand-accent', settings.accent_color)
    root.setProperty('--brand-danger', settings.danger_color)
    setTimezone(settings.timezone)
    document.title = settings.brand_name
  }, [settings])

  useEffect(() => {
    try {
      storage.set(LS, JSON.stringify({ preset: period.preset, from: period.from, to: period.to, expertId, projectId }))
    } catch {
      /* preferência opcional */
    }
  }, [period, expertId, projectId])

  const experts = expertsRows.rows
  // Expert vê apenas os próprios dados (RLS); admin pode filtrar por expert.
  const effectiveExpert = isAdmin ? expertId : experts.length === 1 ? experts[0].id : expertId
  const projects = useMemo(
    () => projectsRows.rows.filter((p) => effectiveExpert === 'all' || p.expert_id === effectiveExpert).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [projectsRows.rows, effectiveExpert],
  )
  const selectedProject = projectId === 'all' ? null : projects.find((p) => p.id === projectId) ?? null

  useEffect(() => {
    if (projectId !== 'all' && !projectsRows.loading && !projects.some((p) => p.id === projectId)) setProjectId('all')
  }, [projectId, projects, projectsRows.loading])
  useEffect(() => {
    if (expertId !== 'all' && !expertsRows.loading && !experts.some((e) => e.id === expertId)) setExpertId('all')
  }, [expertId, experts, expertsRows.loading])

  const scopeProjectIds = useMemo(() => new Set(selectedProject ? [selectedProject.id] : projects.filter((p) => !p.archived).map((p) => p.id)), [selectedProject, projects])
  const selectedExpert =
    (selectedProject && experts.find((e) => e.id === selectedProject.expert_id)) ||
    (effectiveExpert !== 'all' ? experts.find((e) => e.id === effectiveExpert) ?? null : null)

  const canSee = (module: string) => {
    if (settings.disabled_modules.includes(module)) return false
    if (isAdmin || !user) return true
    const allowed = new Set<string>()
    experts.forEach((e) => (e.permissions?.visible_modules ?? ALL_MODULES).forEach((m) => allowed.add(m)))
    return allowed.has(module)
  }

  return (
    <Ctx.Provider
      value={{
        settings,
        period,
        setPeriod: (preset, custom) => setP(resolvePeriod(preset, custom)),
        experts,
        expertId: effectiveExpert,
        setExpertId: (id) => {
          setExpertId(id)
          setProjectId('all')
        },
        projects,
        projectId: selectedProject ? selectedProject.id : 'all',
        setProjectId,
        scopeProjectIds,
        selectedProject,
        selectedExpert,
        canSee,
        loading: settingsRows.loading || expertsRows.loading || projectsRows.loading,
      }}
    >
      {children}
    </Ctx.Provider>
  )
}
