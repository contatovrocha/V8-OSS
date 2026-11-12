import { backend } from '@/data/client'
import type { Creative, CreativeContent, CreativeFormat, CreativeLayout, CreativePerson, Project, ProjectUpdate } from '@/data/types'
import { angles, contentFrom, dateLabel } from '@/lib/campaign'
import { renderCreativePng } from './render'

const peopleFor = (ids: string[], bank: CreativePerson[]) => ids.map((id) => bank.find((p) => p.id === id)).filter(Boolean) as CreativePerson[]

async function upload(project: Project, format: CreativeFormat, layout: CreativeLayout, content: CreativeContent, bank: CreativePerson[]) {
  const blob = await renderCreativePng({ format, layout, content, people: peopleFor(content.person_ids, bank) })
  return backend.upload(blob, `criativos/${project.id}`, `${layout}-${format}.png`)
}

/** Gera um criativo para cada formato × layout, alternando o ângulo (chamada). Tudo no navegador. */
export async function generateCreatives(o: {
  project: Project
  update: ProjectUpdate
  expertName: string
  formats: CreativeFormat[]
  layouts: CreativeLayout[]
  showPrice: boolean
  personIds: string[]
  bank: CreativePerson[]
  onProgress?: (done: number, total: number) => void
}): Promise<Creative[]> {
  const list = angles(o.expertName, dateLabel(o.update.event_date, o.update.event_time))
  const jobs = o.layouts.flatMap((layout, li) => o.formats.map((format) => ({ layout, format, angle: list[li % list.length] })))
  const out: Creative[] = []
  for (const [i, j] of jobs.entries()) {
    o.onProgress?.(i, jobs.length)
    const content = contentFrom(o.update, j.angle.kicker, o.showPrice, o.personIds)
    const image_url = await upload(o.project, j.format, j.layout, content, o.bank)
    out.push(await backend.insert('creatives', { project_id: o.project.id, update_id: o.update.id, format: j.format, layout: j.layout, angle: j.angle.label, content, image_url, status: 'rascunho', notes: '' }))
  }
  o.onProgress?.(jobs.length, jobs.length)
  return out
}

/** Desenha de novo um criativo com o conteúdo editado e troca a imagem. */
export async function regenerateCreative(project: Project, c: Creative, patch: { content: CreativeContent; layout: CreativeLayout; format: CreativeFormat }, bank: CreativePerson[]) {
  const image_url = await upload(project, patch.format, patch.layout, patch.content, bank)
  return backend.update('creatives', c.id, { ...patch, image_url, status: c.status === 'ajuste' ? 'rascunho' : c.status })
}
