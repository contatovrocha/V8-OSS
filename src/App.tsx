import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppProvider, useApp } from './app/AppContext'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { LoginPage } from './auth/LoginPage'
import { AppLayout } from './components/layout/AppLayout'
import { ConfirmProvider, ToastProvider } from './components/ui/overlay'
import { EmptyState, Spinner } from './components/ui/primitives'
import { ShieldOff } from 'lucide-react'

const Overview = lazy(() => import('./modules/overview/OverviewPage'))
const Positioning = lazy(() => import('./modules/positioning/PositioningPage'))
const Projects = lazy(() => import('./modules/projects/ProjectsPage'))
const ProjectDetail = lazy(() => import('./modules/projects/ProjectDetailPage'))
const Pages = lazy(() => import('./modules/pages/PagesPage'))
const Traffic = lazy(() => import('./modules/traffic/TrafficPage'))
const Finance = lazy(() => import('./modules/finance/FinancePage'))
const Tasks = lazy(() => import('./modules/tasks/TasksPage'))
const Reports = lazy(() => import('./modules/reports/ReportsPage'))
const SettingsPage = lazy(() => import('./modules/settings/SettingsPage'))
const DynamicSection = lazy(() => import('./modules/sections/DynamicSectionPage'))

function Loading() {
  return <div className="min-h-[50vh] grid place-items-center"><Spinner className="size-7" /></div>
}

function Guard({ module, children }: { module: string; children: ReactNode }) {
  const { canSee } = useApp()
  const { isAdmin } = useAuth()
  if (module === 'configuracoes' ? !isAdmin : !canSee(module))
    return <EmptyState icon={ShieldOff} title="Acesso não autorizado" description="Seu perfil não tem permissão para visualizar este módulo. Fale com a administração da operação." />
  return <>{children}</>
}

function Shell() {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen grid place-items-center"><Spinner className="size-8" /></div>
  if (!user) return <LoginPage />
  return (
    <AppProvider>
      <AppLayout>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Guard module="visao_geral"><Overview /></Guard>} />
            <Route path="/posicionamento" element={<Guard module="posicionamento"><Positioning /></Guard>} />
            <Route path="/projetos" element={<Guard module="projetos"><Projects /></Guard>} />
            <Route path="/projetos/:id" element={<Guard module="projetos"><ProjectDetail /></Guard>} />
            <Route path="/paginas" element={<Guard module="paginas"><Pages /></Guard>} />
            <Route path="/trafego" element={<Guard module="trafego"><Traffic /></Guard>} />
            <Route path="/financeiro" element={<Guard module="financeiro"><Finance /></Guard>} />
            <Route path="/tarefas" element={<Guard module="tarefas"><Tasks /></Guard>} />
            <Route path="/relatorios" element={<Guard module="relatorios"><Reports /></Guard>} />
            <Route path="/configuracoes" element={<Guard module="configuracoes"><SettingsPage /></Guard>} />
            <Route path="/secoes/:slug" element={<DynamicSection />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AppLayout>
    </AppProvider>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <AuthProvider>
          <Shell />
        </AuthProvider>
      </ConfirmProvider>
    </ToastProvider>
  )
}
