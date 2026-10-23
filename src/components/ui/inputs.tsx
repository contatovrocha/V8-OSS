import clsx from 'clsx'
import { Bold, Crop, ImagePlus, Italic, List, ListOrdered, Paperclip, Plus, Trash2, Upload, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { backend } from '@/data/client'
import { parseMoney } from '@/lib/format'
import type { ChecklistItem, LinkItem } from '@/data/types'
import { Modal, useToast } from './overlay'
import { Button, Checkbox, IconButton, Input } from './primitives'

/** Campo monetário em formato brasileiro (1.234,56). */
export function MoneyInput({ value, onChange, invalid, placeholder = '0,00' }: { value: number | null | undefined; onChange: (v: number | null) => void; invalid?: boolean; placeholder?: string }) {
  const fmt = (v: number | null | undefined) => (v === null || v === undefined ? '' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
  const [text, setText] = useState(fmt(value))
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setText(fmt(value))
  }, [value])
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-faint">R$</span>
      <Input
        inputMode="decimal"
        className="pl-9 tabular-nums"
        invalid={invalid}
        placeholder={placeholder}
        value={text}
        onFocus={() => (focused.current = true)}
        onChange={(e) => {
          setText(e.target.value)
          onChange(parseMoney(e.target.value))
        }}
        onBlur={() => {
          focused.current = false
          setText(fmt(value))
        }}
      />
    </div>
  )
}

async function cropToBlob(src: string, area: Area): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image()
    i.crossOrigin = 'anonymous'
    i.onload = () => res(i)
    i.onerror = rej
    i.src = src
  })
  const c = document.createElement('canvas')
  const max = 900
  const scale = Math.min(1, max / Math.max(area.width, area.height))
  c.width = Math.round(area.width * scale)
  c.height = Math.round(area.height * scale)
  c.getContext('2d')!.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, c.width, c.height)
  return new Promise((res) => c.toBlob((b) => res(b!), 'image/jpeg', 0.88))
}

/**
 * Envio de imagem com recorte opcional. Envia ao storage do backend e devolve a URL.
 */
export function ImageUpload({
  value, onChange, folder, aspect = 1, round = false, disabled, label = 'Enviar imagem', className, crop = true, preview = true,
}: { preview?: boolean; value: string | null | undefined; onChange: (url: string | null) => void; folder: string; aspect?: number; round?: boolean; disabled?: boolean; label?: string; className?: string; crop?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [source, setSource] = useState<{ src: string; name: string } | null>(null)
  const [cropArea, setCropArea] = useState<Area | null>(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const pick = (f: File | undefined) => {
    if (!f) return
    if (!f.type.startsWith('image/')) return toast('error', 'Selecione um arquivo de imagem (JPG, PNG, WEBP ou SVG).')
    if (f.size > 8_000_000) return toast('error', 'Imagem muito grande. O limite é 8 MB.')
    if (!crop || f.type === 'image/svg+xml') return send(f, f.name)
    setSource({ src: URL.createObjectURL(f), name: f.name })
    setZoom(1)
    setPos({ x: 0, y: 0 })
  }

  const send = async (blob: Blob, name: string) => {
    setBusy(true)
    try {
      const url = await backend.upload(blob, folder, name)
      onChange(url)
      toast('success', 'Imagem atualizada.')
    } catch (e) {
      toast('error', (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const onCropDone = useCallback((_: Area, px: Area) => setCropArea(px), [])

  return (
    <div className={className}>
      <div className="flex items-center gap-3">
        {preview && <div className={clsx('relative shrink-0 overflow-hidden bg-surface-3 border border-line grid place-items-center', round ? 'rounded-full size-20' : 'rounded-xl h-20')} style={round ? undefined : { aspectRatio: aspect }}>
          {value ? <img src={value} alt="" className="size-full object-cover" /> : <ImagePlus className="size-6 text-faint" />}
        </div>}
        {!disabled && (
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" icon={Upload} loading={busy} onClick={() => inputRef.current?.click()}>{value ? 'Substituir' : label}</Button>
            {value && <Button type="button" size="sm" variant="ghost" icon={Trash2} onClick={() => onChange(null)}>Remover</Button>}
          </div>
        )}
        <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = '' }} />
      </div>
      <Modal
        open={!!source}
        onClose={() => setSource(null)}
        title="Recortar imagem"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSource(null)}>Cancelar</Button>
            <Button
              variant="primary"
              icon={Crop}
              loading={busy}
              onClick={async () => {
                if (!source || !cropArea) return
                const blob = await cropToBlob(source.src, cropArea)
                setSource(null)
                await send(blob, source.name.replace(/\.\w+$/, '.jpg'))
              }}
            >
              Aplicar recorte
            </Button>
          </>
        }
      >
        <div className="relative h-80 rounded-xl overflow-hidden bg-black">
          {source && <Cropper image={source.src} crop={pos} zoom={zoom} aspect={aspect} cropShape={round ? 'round' : 'rect'} onCropChange={setPos} onZoomChange={setZoom} onCropComplete={onCropDone} />}
        </div>
        <input type="range" min={1} max={3} step={0.05} value={zoom} onChange={(e) => setZoom(+e.target.value)} className="w-full mt-4 accent-[var(--brand-primary)]" aria-label="Zoom" />
      </Modal>
    </div>
  )
}

export function FileUpload({ onUploaded, folder, disabled }: { onUploaded: (f: { url: string; name: string; mime: string; size: number }) => void; folder: string; disabled?: boolean }) {
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  return (
    <>
      <Button type="button" size="sm" icon={Paperclip} loading={busy} disabled={disabled} onClick={() => ref.current?.click()}>Anexar arquivo</Button>
      <input
        ref={ref}
        type="file"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          setBusy(true)
          try {
            const url = await backend.upload(f, folder, f.name)
            onUploaded({ url, name: f.name, mime: f.type, size: f.size })
          } catch (err) {
            toast('error', (err as Error).message)
          } finally {
            setBusy(false)
          }
        }}
      />
    </>
  )
}

/** Editor de texto simples (negrito, itálico, listas). Salva HTML sanitizado. */
export function RichText({ value, onChange, disabled }: { value: string; onChange: (html: string) => void; disabled?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value && document.activeElement !== ref.current) ref.current.innerHTML = sanitize(value)
  }, [value])
  const cmd = (c: string) => {
    document.execCommand(c)
    ref.current?.focus()
    onChange(sanitize(ref.current?.innerHTML ?? ''))
  }
  return (
    <div className={clsx('rounded-xl border border-line-strong bg-bg/60 focus-within:border-primary', disabled && 'opacity-60')}>
      {!disabled && (
        <div className="flex gap-1 border-b border-line p-1">
          <IconButton type="button" icon={Bold} label="Negrito" onClick={() => cmd('bold')} />
          <IconButton type="button" icon={Italic} label="Itálico" onClick={() => cmd('italic')} />
          <IconButton type="button" icon={List} label="Lista" onClick={() => cmd('insertUnorderedList')} />
          <IconButton type="button" icon={ListOrdered} label="Lista numerada" onClick={() => cmd('insertOrderedList')} />
        </div>
      )}
      <div
        ref={ref}
        contentEditable={!disabled}
        suppressContentEditableWarning
        className="rich min-h-32 px-3 py-2 text-sm outline-none"
        onInput={(e) => onChange(sanitize((e.target as HTMLDivElement).innerHTML))}
      />
    </div>
  )
}

const ALLOWED = new Set(['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'UL', 'OL', 'LI', 'DIV', 'SPAN'])
export function sanitize(html: string): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
  const walk = (el: Element) => {
    for (const child of Array.from(el.children)) {
      if (!ALLOWED.has(child.tagName)) {
        child.replaceWith(...Array.from(child.childNodes))
        continue
      }
      for (const a of Array.from(child.attributes)) child.removeAttribute(a.name)
      walk(child)
    }
  }
  const root = doc.body.firstElementChild!
  walk(root)
  return root.innerHTML
}

export function TagInput({ value, onChange, placeholder, disabled }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; disabled?: boolean }) {
  const [text, setText] = useState('')
  const add = () => {
    const t = text.trim()
    if (t && !value.includes(t)) onChange([...value, t])
    setText('')
  }
  return (
    <div className="rounded-xl border border-line-strong bg-bg/60 p-2 flex flex-wrap gap-1.5">
      {value.map((v) => (
        <span key={v} className="inline-flex items-center gap-1 rounded-full bg-surface-3 px-2.5 py-1 text-xs">
          {v}
          {!disabled && <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} aria-label={`Remover ${v}`}><X className="size-3" /></button>}
        </span>
      ))}
      {!disabled && (
        <input
          className="flex-1 min-w-32 bg-transparent text-sm outline-none px-1"
          placeholder={placeholder ?? 'Digite e pressione Enter'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              add()
            }
          }}
          onBlur={add}
        />
      )}
    </div>
  )
}

export function LinkListInput({ value, onChange, disabled, labelPlaceholder = 'Rótulo' }: { value: LinkItem[]; onChange: (v: LinkItem[]) => void; disabled?: boolean; labelPlaceholder?: string }) {
  return (
    <div className="space-y-2">
      {value.map((l, i) => (
        <div key={i} className="flex gap-2">
          <Input className="!w-24 sm:!w-40 shrink-0" placeholder={labelPlaceholder} value={l.label} disabled={disabled} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
          <Input className="flex-1 min-w-0 !w-auto" placeholder="https://" value={l.url} disabled={disabled} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
          {!disabled && <IconButton type="button" className="shrink-0" icon={Trash2} label="Remover link" onClick={() => onChange(value.filter((_, j) => j !== i))} />}
        </div>
      ))}
      {!disabled && <Button type="button" size="sm" variant="ghost" icon={Plus} onClick={() => onChange([...value, { label: '', url: '' }])}>Adicionar link</Button>}
    </div>
  )
}

export function ChecklistEditor({ value, onChange, disabled }: { value: ChecklistItem[]; onChange: (v: ChecklistItem[]) => void; disabled?: boolean }) {
  const [text, setText] = useState('')
  const done = value.filter((c) => c.done).length
  return (
    <div className="space-y-2">
      {value.length > 0 && <p className="text-xs text-muted">{done} de {value.length} concluído(s)</p>}
      {value.map((c) => (
        <div key={c.id} className="flex items-center gap-2 group">
          <Checkbox checked={c.done} disabled={disabled} onChange={(v) => onChange(value.map((x) => (x.id === c.id ? { ...x, done: v } : x)))} label={<span className={clsx(c.done && 'line-through text-muted')}>{c.label}</span>} />
          {!disabled && <button type="button" className="opacity-0 group-hover:opacity-100 text-faint hover:text-danger ml-auto" onClick={() => onChange(value.filter((x) => x.id !== c.id))} aria-label="Remover item"><X className="size-3.5" /></button>}
        </div>
      ))}
      {!disabled && (
        <div className="flex gap-2">
          <Input
            placeholder="Novo item do checklist"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && text.trim()) {
                e.preventDefault()
                onChange([...value, { id: crypto.randomUUID(), label: text.trim(), done: false }])
                setText('')
              }
            }}
          />
          <Button type="button" size="sm" icon={Plus} disabled={!text.trim()} onClick={() => { onChange([...value, { id: crypto.randomUUID(), label: text.trim(), done: false }]); setText('') }}>Adicionar</Button>
        </div>
      )}
    </div>
  )
}
