import { Download, ImageOff } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Badge, Spinner } from '@/components/ui/primitives'
import { backend } from '@/data/client'
import type { PublicGallery } from '@/data/backend'
import v8Logo from '@/assets/brand/v8-logo.png'
import { downloadItem, GalleryGrid, Lightbox, type GalleryData } from './Gallery'

/** Página pública (sem login) de uma galeria compartilhada. Mostra somente esta seção. */
export default function PublicGalleryPage({ token }: { token: string }) {
  const [g, setG] = useState<PublicGallery | null | undefined>(undefined)
  const [zoom, setZoom] = useState<number | null>(null)
  const [filter, setFilter] = useState<Record<string, string>>({})
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    backend.publicGallery(token).then(setG).catch(() => setG(null))
  }, [token])
  useEffect(() => { if (g) document.title = `${g.project ? `${g.name} · ${g.project}` : g.name} · V8` }, [g])

  const filterable = useMemo(() => (g?.fields ?? []).filter((f) => f.filterable && ['select', 'status'].includes(f.type)), [g])
  const items = useMemo(() => (g?.records ?? []).filter((d) => Object.entries(filter).every(([k, v]) => !v || String(d[k] ?? '') === v)), [g, filter])

  const meta = (d: GalleryData) => {
    const text = g!.fields.find((f) => f.type === 'textarea' && f.show_in_card)
    const chips = g!.fields.filter((f) => ['select', 'status', 'multiselect'].includes(f.type) && f.show_in_card && d[f.key])
    return (
      <div className="space-y-2">
        {text && d[text.key] ? <p className="text-sm text-muted leading-relaxed">{String(d[text.key])}</p> : null}
        {chips.length > 0 && <div className="flex flex-wrap gap-1.5">{chips.flatMap((f) => (Array.isArray(d[f.key]) ? (d[f.key] as string[]) : [String(d[f.key])]).map((v) => <Badge key={f.key + v}>{v}</Badge>))}</div>}
      </div>
    )
  }

  const downloadAll = async () => {
    setDownloading(true)
    for (const d of items) {
      await downloadItem(g!.fields, d)
      await new Promise((r) => setTimeout(r, 350))
    }
    setDownloading(false)
  }

  return (
    <div className="min-h-screen bg-[#07070a] text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#07070a]/85 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5"><img src={v8Logo} alt="V8" className="h-8 w-auto" /><span className="font-extrabold tracking-[0.3em] text-sm">OS</span></div>
          {g && items.length > 0 && (
            <button type="button" onClick={downloadAll} disabled={downloading}
              className="inline-flex items-center gap-2 rounded-xl bg-[#ff6a00] text-[#140800] font-bold text-sm px-4 py-2 hover:brightness-110 disabled:opacity-60">
              <Download className="size-4" /> {downloading ? 'Baixando…' : `Baixar todos (${items.length})`}
            </button>
          )}
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {g === undefined ? (
          <div className="min-h-[50vh] grid place-items-center"><Spinner className="size-8" /></div>
        ) : g === null ? (
          <div className="min-h-[50vh] grid place-items-center text-center">
            <div><ImageOff className="size-10 mx-auto text-white/40 mb-3" /><h1 className="text-xl font-bold">Link indisponível</h1><p className="text-white/60 text-sm mt-1">Este link de compartilhamento foi desativado ou não existe.</p></div>
          </div>
        ) : (
          <>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#ff7a1a] mb-2">{g.expert ? `${g.expert} · ` : ''}Galeria compartilhada</p>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">{g.project ? `${g.name} · ${g.project}` : g.name}</h1>
            {g.description && <p className="text-white/70 mt-2 max-w-2xl">{g.description}</p>}
            {filterable.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-6">
                {filterable.map((f) => (
                  <select key={f.key} value={filter[f.key] ?? ''} onChange={(e) => setFilter((s) => ({ ...s, [f.key]: e.target.value }))}
                    className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm" aria-label={f.label}>
                    <option value="">{f.label}: todos</option>
                    {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ))}
              </div>
            )}
            <div className="mt-6">
              {items.length ? <GalleryGrid fields={g.fields} items={items} onOpen={setZoom} renderMeta={meta} /> : <p className="text-white/60">Nenhum item com esse filtro.</p>}
            </div>
          </>
        )}
      </main>
      {g && zoom !== null && items[zoom] && <Lightbox fields={g.fields} items={items} index={zoom} onIndex={setZoom} onClose={() => setZoom(null)} renderMeta={meta} />}
    </div>
  )
}
