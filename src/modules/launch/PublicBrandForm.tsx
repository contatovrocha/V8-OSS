import '@fontsource/manrope/400.css'
import '@fontsource/manrope/600.css'
import '@fontsource/manrope/700.css'
import '@fontsource/manrope/800.css'
import { ArrowLeft, ArrowRight, Check, CheckCircle2, CloudUpload, Send } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import v8Logo from '@/assets/brand/v8-logo.png'
import { Spinner } from '@/components/ui/primitives'
import { backend } from '@/data/client'
import type { PublicBrandDoc } from '@/data/backend'
import { answeredCount, BRAND_QUESTIONS, BRAND_SECTIONS } from '@/lib/brandDoc'

/**
 * Formulário público do Documento de Marca do Expert (V1), aberto pelo link enviado ao expert.
 * Uma seção por vez, salvamento automático e envio final. Sem login.
 */
export default function PublicBrandForm({ token }: { token: string }) {
  const [doc, setDoc] = useState<PublicBrandDoc | null | undefined>(undefined)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [name, setName] = useState('')
  const [step, setStep] = useState(-1) // -1 = abertura; BRAND_SECTIONS.length = revisão
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const dirty = useRef(false)
  const top = useRef<HTMLDivElement>(null)

  useEffect(() => {
    backend.publicBrandDoc(token).then((d) => {
      setDoc(d)
      if (d) { setAnswers(d.answers ?? {}); setName(d.respondent_name ?? '') }
    }).catch(() => setDoc(null))
  }, [token])
  useEffect(() => { document.title = 'Documento de Marca · V8 Aceleração' }, [])

  const persist = useCallback(async (final: boolean) => {
    setSaving('saving')
    try {
      await backend.submitBrandDoc(token, answers, name, final)
      dirty.current = false
      setSaving('saved')
    } catch {
      setSaving('error')
      throw new Error('save')
    }
  }, [token, answers, name])

  // Salvamento automático 1,5 s depois da última digitação.
  useEffect(() => {
    if (!dirty.current) return
    const t = setTimeout(() => { persist(false).catch(() => {}) }, 1500)
    return () => clearTimeout(t)
  }, [answers, name, persist])

  const set = (k: string, v: string) => { dirty.current = true; setAnswers((a) => ({ ...a, [k]: v })) }
  const go = (n: number) => {
    if (dirty.current) persist(false).catch(() => {})
    setStep(n)
    requestAnimationFrame(() => top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }
  const submit = async () => {
    setSending(true)
    try { await persist(true); setSent(true) } catch { /* aviso abaixo */ } finally { setSending(false) }
  }

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-[#0a0a0c] text-white" style={{ fontFamily: 'Manrope, Inter, system-ui, sans-serif' }}>
      <div className="absolute inset-x-0 top-0 h-80 bg-[radial-gradient(700px_320px_at_70%_0%,rgba(255,106,0,.18),transparent_70%)] pointer-events-none" />
      <div ref={top} className="relative max-w-2xl mx-auto px-4 sm:px-6 py-5 sm:py-8">{children}</div>
    </div>
  )

  if (doc === undefined) return <div className="min-h-screen grid place-items-center bg-[#0a0a0c]"><Spinner className="size-8" /></div>
  if (doc === null) return shell(
    <div className="text-center pt-24"><img src={v8Logo} alt="V8" className="h-10 mx-auto mb-4" /><h1 className="text-xl font-bold">Link indisponível</h1><p className="text-white/60 text-sm mt-1">Este formulário não existe mais ou o endereço está incompleto. Fale com a equipe da V8.</p></div>,
  )

  const total = BRAND_QUESTIONS.length
  const done = answeredCount(answers)
  const pct = Math.round((done / total) * 100)
  const first = doc.expert.split(' ')[0]

  if (sent) return shell(
    <div className="text-center pt-16 sm:pt-24">
      <img src={v8Logo} alt="V8 Aceleração" className="h-9 mx-auto mb-8" />
      <div className="size-16 rounded-full bg-[#ff6a00]/15 text-[#ff7a1a] grid place-items-center mx-auto mb-5"><CheckCircle2 className="size-9" /></div>
      <h1 className="text-2xl sm:text-3xl font-extrabold">Recebemos, {first}!</h1>
      <p className="text-white/70 mt-2 max-w-md mx-auto">O seu Documento de Marca já está com o time da V8. Ele é a base do posicionamento e de toda a estrutura do seu lançamento. Se lembrar de algo, é só abrir este mesmo link e ajustar.</p>
    </div>,
  )

  const header = (
    <div className="flex items-center justify-between gap-3 mb-5">
      <img src={v8Logo} alt="V8 Aceleração" className="h-7 sm:h-8" />
      <div className="text-[11px] text-white/55 flex items-center gap-1.5">
        {saving === 'saving' ? <><Spinner className="size-3" />Salvando…</> : saving === 'saved' ? <><CloudUpload className="size-3.5 text-[#ff7a1a]" />Salvo automaticamente</> : saving === 'error' ? <span className="text-red-400">Sem conexão. Tentaremos de novo.</span> : null}
      </div>
    </div>
  )
  const bar = (
    <div className="mb-6">
      <div className="flex justify-between text-[11px] text-white/55 mb-1.5"><span>{step >= 0 && step < BRAND_SECTIONS.length ? `Parte ${step + 1} de ${BRAND_SECTIONS.length}` : 'Revisão'}</span><span>{done} de {total} respostas</span></div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-[#ff8124] to-[#ff6a00] transition-all duration-500" style={{ width: `${pct}%` }} /></div>
    </div>
  )

  if (step === -1) return shell(
    <>
      {header}
      <div className="pt-4 sm:pt-10">
        <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#ff7a1a]">Documento de Marca do Expert · V1</div>
        <h1 className="text-[28px] leading-[1.1] sm:text-5xl font-extrabold mt-2">{first}, vamos construir o seu posicionamento.</h1>
        <p className="text-white/70 mt-3 text-[15px] sm:text-lg">Responda com calma, do seu jeito. São {BRAND_SECTIONS.length} partes curtas e tudo é salvo automaticamente: pode parar e continuar depois pelo mesmo link.</p>
        <label className="block mt-6">
          <span className="text-xs font-semibold text-white/70">Seu nome</span>
          <input value={name} onChange={(e) => { dirty.current = true; setName(e.target.value) }} placeholder="Como você gostaria de ser chamado" className="mt-1.5 w-full rounded-xl bg-white/[.06] border border-white/15 px-4 py-3 text-[15px] outline-none focus:border-[#ff6a00] focus:ring-2 focus:ring-[#ff6a00]/30" />
        </label>
        <button onClick={() => go(0)} className="mt-5 w-full flex items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#ff8124] to-[#ff6a00] text-[#140800] font-extrabold uppercase tracking-wide text-sm px-6 py-4 shadow-[0_14px_30px_-12px_#ff6a00] hover:brightness-110 transition">
          {done > 0 ? 'Continuar de onde parei' : 'Começar'} <ArrowRight className="size-4" />
        </button>
        <ul className="mt-6 grid grid-cols-2 gap-2 text-[13px] text-white/70">
          {BRAND_SECTIONS.map((s, i) => (
            <li key={s.id}><button onClick={() => go(i)} className="w-full text-left rounded-lg border border-white/10 px-3 py-2 hover:border-[#ff6a00]/60 transition flex items-center gap-2">
              <span className="size-5 rounded-full bg-[#ff6a00]/15 text-[#ff7a1a] text-[10px] font-bold grid place-items-center shrink-0">{s.questions.every((q) => answers[q.key]?.trim()) ? <Check className="size-3" /> : i + 1}</span>{s.title}
            </button></li>
          ))}
        </ul>
      </div>
    </>,
  )

  if (step >= BRAND_SECTIONS.length) return shell(
    <>
      {header}{bar}
      <h2 className="text-2xl sm:text-3xl font-extrabold">Tudo certo para enviar?</h2>
      <p className="text-white/70 mt-2">Você respondeu {done} de {total} perguntas.{done < total ? ' Pode enviar assim mesmo e completar depois pelo mesmo link.' : ''}</p>
      <div className="mt-5 space-y-2">
        {BRAND_SECTIONS.map((s, i) => {
          const n = s.questions.filter((q) => answers[q.key]?.trim()).length
          return (
            <button key={s.id} onClick={() => go(i)} className="w-full flex items-center justify-between rounded-xl border border-white/10 bg-white/[.03] px-4 py-3 hover:border-[#ff6a00]/60 transition text-left">
              <span className="font-semibold text-[15px]">{s.title}</span>
              <span className={`text-xs font-bold ${n === s.questions.length ? 'text-[#ff7a1a]' : 'text-white/50'}`}>{n}/{s.questions.length}</span>
            </button>
          )
        })}
      </div>
      {saving === 'error' && <p className="text-red-400 text-sm mt-4">Não conseguimos salvar agora. Verifique a internet e tente de novo.</p>}
      <div className="mt-6 flex gap-3">
        <button onClick={() => go(BRAND_SECTIONS.length - 1)} className="rounded-full border border-white/20 px-5 py-3.5 text-sm font-bold hover:border-white/50"><ArrowLeft className="size-4" /></button>
        <button onClick={submit} disabled={sending} className="flex-1 flex items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#ff8124] to-[#ff6a00] text-[#140800] font-extrabold uppercase tracking-wide text-sm px-6 py-4 shadow-[0_14px_30px_-12px_#ff6a00] hover:brightness-110 transition disabled:opacity-60">
          {sending ? <Spinner className="size-4" /> : <Send className="size-4" />} Enviar para a V8
        </button>
      </div>
    </>,
  )

  const sec = BRAND_SECTIONS[step]
  return shell(
    <>
      {header}{bar}
      <div key={sec.id} className="animate-fade-up">
        <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#ff7a1a]">Parte {step + 1}</div>
        <h2 className="text-2xl sm:text-3xl font-extrabold mt-1">{sec.title}</h2>
        {sec.intro && <p className="text-white/65 text-sm mt-2 leading-relaxed">{sec.intro}</p>}
        <div className="mt-5 space-y-5">
          {sec.questions.map((q) => (
            <label key={q.key} className="block">
              <span className="text-[15px] font-bold leading-snug">{q.label}</span>
              {q.hint && <span className="block text-xs text-white/55 mt-0.5">{q.hint}</span>}
              {q.short
                ? <input value={answers[q.key] ?? ''} onChange={(e) => set(q.key, e.target.value)} className="mt-2 w-full rounded-xl bg-white/[.06] border border-white/15 px-4 py-3 text-[15px] outline-none focus:border-[#ff6a00] focus:ring-2 focus:ring-[#ff6a00]/30" />
                : <textarea value={answers[q.key] ?? ''} onChange={(e) => set(q.key, e.target.value)} rows={4} className="mt-2 w-full rounded-xl bg-white/[.06] border border-white/15 px-4 py-3 text-[15px] leading-relaxed outline-none focus:border-[#ff6a00] focus:ring-2 focus:ring-[#ff6a00]/30 resize-y min-h-28" />}
            </label>
          ))}
        </div>
      </div>
      <div className="mt-7 flex gap-3 sticky bottom-3">
        <button onClick={() => go(step - 1)} className="rounded-full border border-white/20 bg-[#0a0a0c]/90 backdrop-blur px-5 py-3.5 text-sm font-bold hover:border-white/50" aria-label="Voltar"><ArrowLeft className="size-4" /></button>
        <button onClick={() => go(step + 1)} className="flex-1 flex items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#ff8124] to-[#ff6a00] text-[#140800] font-extrabold uppercase tracking-wide text-sm px-6 py-3.5 shadow-[0_14px_30px_-12px_#ff6a00] hover:brightness-110 transition">
          {step === BRAND_SECTIONS.length - 1 ? 'Revisar e enviar' : 'Próxima parte'} <ArrowRight className="size-4" />
        </button>
      </div>
    </>,
  )
}
