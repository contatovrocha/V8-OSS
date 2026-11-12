import { Check, ImagePlus, Trash2, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { useApp } from '@/app/AppContext'
import { useAuth } from '@/auth/AuthContext'
import { ImageUpload } from '@/components/ui/inputs'
import { Modal, useAction, useConfirm } from '@/components/ui/overlay'
import { Button, Field, IconButton, Input, Select } from '@/components/ui/primitives'
import { backend } from '@/data/client'
import { invalidate, useRows } from '@/data/store'
import type { CreativePerson, Project } from '@/data/types'

/** Pode gerar campanha/criativos do projeto: administradores ou o gestor da equipe do expert. */
export function useCanManageProject(project: Project | null | undefined) {
  const { user, isAdmin } = useAuth()
  const links = useRows('user_experts')
  if (!project || !user) return false
  return isAdmin || links.rows.some((l) => l.user_id === user.id && l.expert_id === project.expert_id && l.can_manage_team)
}

/**
 * Banco de fotos para criativos e páginas. Seleção em ordem: a primeira pessoa marcada é a principal
 * (foto grande do criativo e da página).
 */
export function PeoplePicker({ selected, onChange, max = 4 }: { selected: string[]; onChange: (ids: string[]) => void; max?: number }) {
  const people = useRows('creative_people')
  const app = useApp()
  const { isAdmin } = useAuth()
  const { run } = useAction()
  const confirm = useConfirm()
  const [adding, setAdding] = useState(false)

  // Experts com foto que ainda não estão no banco entram com um clique.
  const missing = app.experts.filter((e) => e.photo_url && !people.rows.some((p) => p.expert_id === e.id))
  const importExperts = () => run(async () => {
    await backend.insertMany('creative_people', missing.map((e) => ({ name: e.full_name, title: e.title, photo_url: e.photo_url!, expert_id: e.id })))
    await invalidate('creative_people')
  }, `${missing.length} expert(s) adicionado(s) ao banco de fotos.`)

  const toggle = (id: string) => {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id))
    else if (selected.length < max) onChange([...selected, id])
  }
  const remove = async (p: CreativePerson) => {
    if (!(await confirm({ title: 'Remover do banco de fotos?', message: `${p.name} deixa de aparecer para novos criativos. Criativos já gerados não mudam.`, tone: 'danger', confirmLabel: 'Remover' }))) return
    run(async () => { await backend.remove('creative_people', p.id); onChange(selected.filter((x) => x !== p.id)); await invalidate('creative_people') }, 'Removido do banco de fotos.')
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" icon={UserPlus} onClick={() => setAdding(true)}>Adicionar pessoa</Button>
        {missing.length > 0 && <Button size="sm" variant="ghost" icon={ImagePlus} onClick={importExperts}>Trazer fotos dos experts ({missing.length})</Button>}
        <span className="text-xs text-muted ml-auto">Marque até {max}. A primeira marcada é a principal.</span>
      </div>
      {people.rows.length === 0 ? (
        <p className="text-sm text-muted py-4">O banco de fotos está vazio. Adicione a foto de qualquer expert ou convidado.</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {people.rows.map((p) => {
            const idx = selected.indexOf(p.id)
            return (
              <div key={p.id} className="relative group">
                <button type="button" onClick={() => toggle(p.id)} className={`block w-full rounded-xl overflow-hidden border-2 transition ${idx >= 0 ? 'border-primary' : 'border-transparent hover:border-line-strong'}`}>
                  <img src={p.photo_url} alt={p.name} className="aspect-[4/5] w-full object-cover" />
                  {idx >= 0 && <span className="absolute top-1.5 left-1.5 size-6 rounded-full bg-primary text-white text-xs font-bold grid place-items-center">{idx === 0 ? <Check className="size-3.5" /> : idx + 1}</span>}
                  <div className="p-1.5 text-left"><div className="text-xs font-semibold truncate">{p.name}</div>{idx === 0 && <div className="text-[10px] text-primary font-bold">Principal</div>}</div>
                </button>
                {isAdmin && <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition"><IconButton icon={Trash2} label="Remover do banco" onClick={() => remove(p)} /></div>}
              </div>
            )
          })}
        </div>
      )}
      {adding && <AddPerson onClose={() => setAdding(false)} onAdded={(id) => selected.length < max && onChange([...selected, id])} />}
    </div>
  )
}

function AddPerson({ onClose, onAdded }: { onClose: () => void; onAdded: (id: string) => void }) {
  const app = useApp()
  const { run, busy } = useAction()
  const [d, setD] = useState({ name: '', title: '', photo_url: null as string | null, expert_id: '' })
  const save = () => run(async () => {
    if (!d.name.trim()) throw new Error('Informe o nome.')
    if (!d.photo_url) throw new Error('Envie a foto.')
    const p = await backend.insert('creative_people', { name: d.name.trim(), title: d.title.trim(), photo_url: d.photo_url, expert_id: d.expert_id || null })
    await invalidate('creative_people')
    onAdded(p.id)
    onClose()
  }, 'Foto adicionada ao banco.')
  return (
    <Modal open onClose={onClose} title="Adicionar ao banco de fotos" subtitle="Use fotos verticais, com o rosto bem visível e fundo limpo."
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={busy} onClick={save}>Adicionar</Button></>}>
      <div className="space-y-4">
        <Field label="Foto" required><ImageUpload value={d.photo_url} folder="banco-de-fotos" aspect={4 / 5} onChange={(v) => setD({ ...d, photo_url: v })} /></Field>
        <Field label="Nome" required><Input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="Ex.: Pablo Marçal" /></Field>
        <Field label="Cargo ou chamada (opcional)"><Input value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} placeholder="Ex.: Convidado especial" /></Field>
        <Field label="É um expert do sistema? (opcional)">
          <Select value={d.expert_id} onChange={(e) => setD({ ...d, expert_id: e.target.value })}>
            <option value="">Não, é convidado</option>
            {app.experts.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
          </Select>
        </Field>
      </div>
    </Modal>
  )
}
