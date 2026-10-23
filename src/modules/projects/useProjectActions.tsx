import { useNavigate } from 'react-router-dom'
import { useAction, useConfirm } from '@/components/ui/overlay'
import { backend } from '@/data/client'
import { invalidate, useRows } from '@/data/store'
import type { Project } from '@/data/types'

export function useProjectActions() {
  const confirm = useConfirm()
  const { run, busy } = useAction()
  const navigate = useNavigate()
  const sales = useRows('sales')
  const expenses = useRows('expenses')
  const campaigns = useRows('campaigns')

  const deps = (p: Project) => ({
    sales: sales.rows.filter((s) => s.project_id === p.id).length,
    expenses: expenses.rows.filter((s) => s.project_id === p.id).length,
    campaigns: campaigns.rows.filter((s) => s.project_id === p.id).length,
  })

  const archive = async (p: Project, value = true) => {
    if (value && !(await confirm({ title: 'Arquivar projeto?', message: <>O projeto <strong className="text-ink">{p.name}</strong> sairá das listas ativas e dos indicadores consolidados, mas todos os dados financeiros e históricos serão preservados.</>, confirmLabel: 'Arquivar' }))) return
    await run(async () => {
      await backend.update('projects', p.id, { archived: value })
      await invalidate('projects', 'activity_log')
    }, value ? 'Projeto arquivado.' : 'Projeto restaurado.')
  }

  const remove = async (p: Project) => {
    const d = deps(p)
    const total = d.sales + d.expenses + d.campaigns
    if (total > 0) {
      const ok = await confirm({
        title: 'Exclusão bloqueada',
        message: (
          <>
            <p><strong className="text-ink">{p.name}</strong> possui {d.sales} venda(s), {d.expenses} despesa(s) e {d.campaigns} campanha(s) vinculadas. Excluí-lo deixaria os dados financeiros inconsistentes.</p>
            <p className="mt-2">Recomendamos arquivar o projeto: ele sai das listas e indicadores, mas o histórico é preservado.</p>
          </>
        ),
        confirmLabel: 'Arquivar projeto',
      })
      if (ok) await archive(p, true)
      return
    }
    const ok = await confirm({
      title: 'Excluir projeto definitivamente?',
      message: <>Esta ação remove <strong className="text-ink">{p.name}</strong>, suas fases, páginas, tarefas e arquivos. Não pode ser desfeita.</>,
      confirmLabel: 'Excluir projeto',
      tone: 'danger',
      typeToConfirm: p.name,
    })
    if (!ok) return
    const done = await run(async () => {
      await backend.remove('projects', p.id)
      await invalidate('projects', 'project_phases', 'pages', 'tasks', 'movements', 'activity_log')
      return true
    }, 'Projeto excluído.')
    if (done) navigate('/projetos')
  }

  const duplicate = async (p: Project) => {
    const ok = await confirm({ title: 'Duplicar projeto?', message: 'Serão copiadas a estrutura, as configurações, páginas (como planejadas), produtos e tarefas (reiniciadas). Vendas, despesas e resultados históricos não são copiados.', confirmLabel: 'Duplicar' })
    if (!ok) return
    const copy = await run(async () => {
      const r = await backend.rpc<Project>('duplicate_project', { project_id: p.id, name: `${p.name} (cópia)` })
      await invalidate('projects', 'project_phases', 'pages', 'tasks', 'products', 'activity_log')
      return r
    }, 'Projeto duplicado.')
    if (copy) navigate(`/projetos/${copy.id}`)
  }

  const setStatus = (p: Project, status: Project['status']) =>
    run(async () => {
      await backend.update('projects', p.id, { status })
      await invalidate('projects', 'activity_log')
    }, 'Status atualizado.')

  return { archive, remove, duplicate, setStatus, busy, deps }
}
