import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import type { FieldConfig } from '@/data/types'

/** Item genérico de galeria: dados de um registro de seção. */
export type GalleryData = Record<string, unknown>

export function galleryFields(fields: FieldConfig[]) {
  const image = fields.find((f) => f.type === 'image')
  const title = fields.find((f) => f.type === 'text') ?? fields[0]
  // Arquivo original para baixar (campo url/arquivo); sem ele, baixa a própria imagem.
  const original = fields.find((f) => (f.type === 'url' || f.type === 'file') && /arquivo|download|original|baixar/i.test(`${f.key} ${f.label}`))
  return { image, title, original }
}

const fileName = (url: string, fallback: string) => {
  const last = decodeURIComponent(url.split('?')[0].split('/').pop() || '')
  return /\.\w{2,5}$/.test(last) ? last : `${fallback}.jpg`
}

/** Baixa o arquivo como download (fetch + blob); se o servidor não permitir, abre em nova aba. */
export async function downloadUrl(url: string, name: string) {
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) throw new Error(String(res.status))
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = fileName(url, name)
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 4000)
  } catch {
    window.open(url, '_blank', 'noopener')
  }
}

export function downloadItem(fields: FieldConfig[], d: GalleryData) {
  const { image, title, original } = galleryFields(fields)
  const url = String((original && d[original.key]) || (image && d[image.key]) || '')
  if (url) return downloadUrl(url, String((title && d[title.key]) || 'criativo').replace(/[^\w-]+/g, '-'))
}

/** Grade de imagens grandes, sem corte (proporção original). */
export function GalleryGrid({ fields, items, onOpen, renderMeta, actions }: {
  fields: FieldConfig[]
  items: GalleryData[]
  onOpen: (index: number) => void
  renderMeta?: (d: GalleryData) => ReactNode
  actions?: (index: number) => ReactNode
}) {
  const { image, title } = galleryFields(fields)
  return (
    <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
      {items.map((d, i) => (
        <figure key={i} className="group rounded-2xl overflow-hidden border border-line bg-surface-2 animate-fade-up">
          <button type="button" className="relative block w-full bg-black/40 cursor-zoom-in" onClick={() => onOpen(i)} aria-label="Ampliar">
            {image && typeof d[image.key] === 'string' && d[image.key] ? (
              <img src={String(d[image.key])} alt={String((title && d[title.key]) || '')} loading="lazy" className="w-full h-auto block transition duration-300 group-hover:scale-[1.015]" />
            ) : <div className="aspect-[4/5]" />}
          </button>
          <figcaption className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-bold leading-snug">{String((title && d[title.key]) || 'Sem título')}</h3>
              <div className="flex shrink-0 items-center">
                <button type="button" className="p-2 rounded-lg text-muted hover:text-ink hover:bg-surface-3" title="Baixar" aria-label="Baixar" onClick={() => downloadItem(fields, d)}><Download className="size-4" /></button>
                {actions?.(i)}
              </div>
            </div>
            {renderMeta?.(d)}
          </figcaption>
        </figure>
      ))}
    </div>
  )
}

/** Visualização em tela cheia com navegação (setas/teclado) e download. */
export function Lightbox({ fields, items, index, onClose, onIndex, renderMeta }: {
  fields: FieldConfig[]
  items: GalleryData[]
  index: number
  onClose: () => void
  onIndex: (i: number) => void
  renderMeta?: (d: GalleryData) => ReactNode
}) {
  const { image, title } = galleryFields(fields)
  const d = items[index]
  const [busy, setBusy] = useState(false)
  const go = (delta: number) => onIndex((index + delta + items.length) % items.length)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  })
  if (!d) return null
  return (
    <div className="fixed inset-0 z-[80] bg-black/92 backdrop-blur-sm flex flex-col" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-white" onClick={(e) => e.stopPropagation()}>
        <div className="min-w-0">
          <div className="font-bold truncate">{String((title && d[title.key]) || '')}</div>
          <div className="text-xs text-white/60">{index + 1} de {items.length}</div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" disabled={busy} onClick={async () => { setBusy(true); await downloadItem(fields, d); setBusy(false) }}
            className="inline-flex items-center gap-2 rounded-xl bg-[#ff6a00] text-[#140800] font-bold text-sm px-4 py-2 hover:brightness-110 disabled:opacity-60">
            <Download className="size-4" /> {busy ? 'Baixando…' : 'Baixar'}
          </button>
          <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-white/10" aria-label="Fechar"><X className="size-6" /></button>
        </div>
      </div>
      <div className="relative flex-1 min-h-0 flex items-center justify-center px-2 sm:px-16 pb-2">
        {image && <img src={String(d[image.key] ?? '')} alt="" className="max-h-full max-w-full object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />}
        {items.length > 1 && (
          <>
            <button type="button" onClick={(e) => { e.stopPropagation(); go(-1) }} className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white" aria-label="Anterior"><ChevronLeft className="size-6" /></button>
            <button type="button" onClick={(e) => { e.stopPropagation(); go(1) }} className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white" aria-label="Próximo"><ChevronRight className="size-6" /></button>
          </>
        )}
      </div>
      {renderMeta && <div className="px-4 pb-4 text-white/85 text-sm max-w-3xl mx-auto w-full" onClick={(e) => e.stopPropagation()}>{renderMeta(d)}</div>}
    </div>
  )
}
