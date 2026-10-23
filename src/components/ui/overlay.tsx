import clsx from 'clsx'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button, Input } from './primitives'

function useEsc(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', h)
      document.body.style.overflow = ''
    }
  }, [open, onClose])
}

export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md' }: { open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  useEsc(open, onClose)
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className={clsx(
          'relative w-full card !bg-surface flex flex-col max-h-[92vh] animate-fade-up rounded-b-none sm:rounded-b-[18px]',
          size === 'sm' && 'sm:max-w-md',
          size === 'md' && 'sm:max-w-xl',
          size === 'lg' && 'sm:max-w-3xl',
          size === 'xl' && 'sm:max-w-5xl',
        )}
      >
        <div className="flex items-start justify-between gap-4 p-5 pb-3">
          <div>
            <h3 className="text-base font-bold">{title}</h3>
            {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Fechar" className="text-muted hover:text-ink p-1 -m-1"><X className="size-5" /></button>
        </div>
        <div className="px-5 pb-5 overflow-y-auto">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 px-5 py-4 border-t border-line">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

export function Drawer({ open, onClose, title, subtitle, children, footer, width = 'max-w-xl' }: { open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; width?: string }) {
  useEsc(open, onClose)
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
      <aside className={clsx('absolute right-0 top-0 h-full w-full bg-surface border-l border-line flex flex-col animate-slide-in', width)}>
        <div className="flex items-start justify-between gap-4 p-5 border-b border-line">
          <div className="min-w-0">
            <h3 className="text-lg font-bold truncate">{title}</h3>
            {subtitle && <div className="text-sm text-muted mt-0.5">{subtitle}</div>}
          </div>
          <button onClick={onClose} aria-label="Fechar" className="text-muted hover:text-ink p-1 -m-1"><X className="size-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 p-4 border-t border-line">{footer}</div>}
      </aside>
    </div>,
    document.body,
  )
}

// ------------------------------------------------------------------ Confirmação

interface ConfirmOptions {
  title: string
  message: ReactNode
  confirmLabel?: string
  tone?: 'danger' | 'primary' | 'success'
  /** Exige que o usuário digite este texto para confirmar (exclusões críticas). */
  typeToConfirm?: string
}

const ConfirmCtx = createContext<(o: ConfirmOptions) => Promise<boolean>>(async () => false)
export const useConfirm = () => useContext(ConfirmCtx)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null)
  const [typed, setTyped] = useState('')
  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => { setTyped(''); setState({ ...o, resolve }) }), [])
  const close = (v: boolean) => {
    state?.resolve(v)
    setState(null)
  }
  const blocked = Boolean(state?.typeToConfirm && typed.trim() !== state.typeToConfirm)
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Modal
        open={!!state}
        onClose={() => close(false)}
        size="sm"
        title={state?.title}
        footer={
          <>
            <Button variant="ghost" onClick={() => close(false)}>Cancelar</Button>
            <Button variant={state?.tone === 'danger' ? 'danger' : state?.tone === 'success' ? 'success' : 'primary'} disabled={blocked} onClick={() => close(true)}>
              {state?.confirmLabel ?? 'Confirmar'}
            </Button>
          </>
        }
      >
        <div className="text-sm text-muted space-y-3">
          <div>{state?.message}</div>
          {state?.typeToConfirm && (
            <div>
              <p className="mb-1.5">Digite <strong className="text-ink">{state.typeToConfirm}</strong> para confirmar:</p>
              <Input autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} />
            </div>
          )}
        </div>
      </Modal>
    </ConfirmCtx.Provider>
  )
}

// ------------------------------------------------------------------ Toasts

type ToastKind = 'success' | 'error' | 'info' | 'warning'
interface ToastItem { id: number; kind: ToastKind; text: string; action?: { label: string; onClick: () => void } }

const ToastCtx = createContext<(kind: ToastKind, text: string, action?: ToastItem['action']) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const seq = useRef(0)
  const push = useCallback((kind: ToastKind, text: string, action?: ToastItem['action']) => {
    const id = ++seq.current
    setItems((s) => [...s.slice(-3), { id, kind, text, action }])
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), kind === 'error' ? 7000 : 3500)
  }, [])
  const Icon = { success: CheckCircle2, error: XCircle, info: Info, warning: AlertTriangle }
  return (
    <ToastCtx.Provider value={push}>
      {children}
      {createPortal(
        <div className="fixed z-[60] bottom-20 lg:bottom-6 right-4 left-4 sm:left-auto flex flex-col gap-2 sm:w-96 no-print" aria-live="polite">
          {items.map((t) => {
            const I = Icon[t.kind]
            return (
              <div key={t.id} className="card !bg-surface-2 px-4 py-3 flex items-start gap-3 animate-fade-up">
                <I className={clsx('size-5 shrink-0 mt-0.5', t.kind === 'success' && 'text-success', t.kind === 'error' && 'text-danger', t.kind === 'info' && 'text-primary', t.kind === 'warning' && 'text-warning')} />
                <p className="text-sm flex-1">{t.text}</p>
                {t.action && <button className="text-sm font-semibold text-primary" onClick={t.action.onClick}>{t.action.label}</button>}
              </div>
            )
          })}
        </div>,
        document.body,
      )}
    </ToastCtx.Provider>
  )
}

/** Executa uma ação assíncrona com feedback padronizado de sucesso/erro. */
export function useAction() {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const run = useCallback(
    async <R,>(fn: () => Promise<R>, success?: string): Promise<R | undefined> => {
      setBusy(true)
      try {
        const r = await fn()
        if (success) toast('success', success)
        return r
      } catch (e) {
        toast('error', (e as Error).message || 'Algo deu errado. Tente novamente.')
        return undefined
      } finally {
        setBusy(false)
      }
    },
    [toast],
  )
  return { run, busy }
}
