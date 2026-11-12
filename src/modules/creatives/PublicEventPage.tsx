import '@fontsource/manrope/400.css'
import '@fontsource/manrope/600.css'
import '@fontsource/manrope/700.css'
import '@fontsource/manrope/800.css'
import { CalendarDays, Gift, MapPin, ShieldCheck, Users, Video } from 'lucide-react'
import { useEffect, useState } from 'react'
import v8Logo from '@/assets/brand/v8-logo.png'
import { Spinner } from '@/components/ui/primitives'
import { backend } from '@/data/client'
import type { PublicEventPage as PageData } from '@/data/backend'
import { dateLabel, formatLabel, locationLabel, money0 } from '@/lib/campaign'

/**
 * Página pública do evento, montada com a última campanha publicada do projeto.
 * Primeira dobra no celular (diretriz V8): foto atrás da headline com degradê → headline → subheadline →
 * botão com a largura toda → "a partir de R$ X" → data/formato/local com ícones, sem rolar, já em 360×640.
 */
export default function PublicEventPage({ slug }: { slug: string }) {
  const [d, setD] = useState<PageData | null | undefined>(undefined)
  useEffect(() => { backend.publicEventPage(slug).then(setD).catch(() => setD(null)) }, [slug])
  useEffect(() => { if (d) document.title = `${d.update.headline} · ${d.expert}` }, [d])

  if (d === undefined) return <div className="min-h-screen grid place-items-center bg-[#0a0a0c]"><Spinner className="size-8" /></div>
  if (d === null)
    return (
      <div className="min-h-screen grid place-items-center bg-[#0a0a0c] text-white text-center p-6">
        <div><img src={v8Logo} alt="V8" className="h-10 mx-auto mb-4" /><h1 className="text-xl font-bold">Página indisponível</h1><p className="text-white/60 text-sm mt-1">Este evento ainda não foi publicado ou o endereço mudou.</p></div>
      </div>
    )

  const u = d.update
  const date = dateLabel(u.event_date, u.event_time)
  const where = locationLabel(u)
  const cta = u.checkout_url || '#'
  const info = [
    date && { icon: CalendarDays, text: date },
    { icon: u.format === 'online' ? Video : MapPin, text: [formatLabel(u.format), where].filter(Boolean).join(' · ') },
    u.spots ? { icon: Users, text: `${u.spots} vagas` } : null,
  ].filter(Boolean) as { icon: typeof MapPin; text: string }[]

  const Button = ({ className = '' }: { className?: string }) => (
    <a href={cta} target={u.checkout_url ? '_blank' : undefined} rel="noreferrer"
      className={`flex items-center justify-center rounded-full bg-gradient-to-b from-[#ff8124] to-[#ff6a00] text-[#140800] font-extrabold uppercase tracking-wide text-[13px] sm:text-sm px-6 py-3.5 shadow-[0_14px_30px_-12px_#ff6a00] hover:brightness-110 transition ${className}`}>
      {u.cta_label || 'Quero garantir minha vaga'} →
    </a>
  )
  const Price = () => u.with_price && u.price !== null ? (
    <div className="flex items-baseline gap-2 flex-wrap">
      <span className="text-[13px] text-white/75">a partir de</span>
      <b className="text-[22px] sm:text-3xl font-extrabold text-[#ff7a1a]">{money0(u.price)}</b>
      {u.full_price ? <s className="text-[13px] text-white/45">{money0(u.full_price)}</s> : null}
    </div>
  ) : null

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white" style={{ fontFamily: 'Manrope, Inter, system-ui, sans-serif' }}>
      {/* primeira dobra */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(900px_500px_at_80%_0%,rgba(255,106,0,.2),transparent_60%)]" />
        {/* foto: no celular fica no topo, atrás da headline, com degradê */}
        {d.photo && (
          <div className="absolute inset-x-0 top-0 h-[min(46vh,330px)] sm:hidden [mask-image:linear-gradient(180deg,#000_45%,transparent_100%)]">
            <img src={d.photo} alt={d.expert} className="size-full object-cover object-[50%_25%]" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0a0a0c]/80" />
          </div>
        )}
        <img src={v8Logo} alt="V8" className="absolute top-4 left-4 sm:left-8 h-7 sm:h-9 z-10 drop-shadow" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-8 grid sm:grid-cols-[1.1fr_1fr] gap-10 items-center sm:min-h-[640px] sm:py-16">
          <div className={d.photo ? 'pt-[calc(min(46vh,330px)-88px)] sm:pt-0 pb-6' : 'pt-20 pb-6'}>
            <p className="hidden sm:block text-xs font-bold uppercase tracking-[0.2em] text-[#ff7a1a] mb-3">{d.expert}{d.expert_title ? ` · ${d.expert_title}` : ''}</p>
            <h1 className="text-[24px] leading-[1.1] sm:text-5xl sm:leading-[1.05] font-extrabold tracking-tight">{u.headline}</h1>
            {u.subheadline && <p className="mt-2 sm:mt-4 text-[14px] leading-snug sm:text-lg text-white/80 line-clamp-3 sm:line-clamp-none">{u.subheadline}</p>}
            <Button className="mt-3 sm:mt-7 w-full sm:w-auto sm:inline-flex" />
            <div className="mt-2.5 sm:mt-5"><Price /></div>
            <ul className="mt-1.5 sm:mt-4 grid gap-1 sm:gap-2">
              {info.map((i) => <li key={i.text} className="flex items-center gap-2 text-[12.5px] sm:text-base text-white/85"><i.icon className="size-4 text-[#ff7a1a] shrink-0" />{i.text}</li>)}
            </ul>
          </div>
          {d.photo && (
            <div className="hidden sm:block">
              <img src={d.photo} alt={d.expert} className="w-full max-w-[460px] ml-auto aspect-[4/5] object-cover rounded-3xl border border-[#ff6a00]/30 shadow-[0_30px_80px_rgba(0,0,0,.6),0_0_70px_rgba(255,98,0,.2)]" />
            </div>
          )}
        </div>
      </section>

      {/* segunda dobra */}
      <section className="border-t border-white/10 bg-[#0e0e11]">
        <div className="max-w-3xl mx-auto px-4 sm:px-8 py-12 space-y-6">
          {u.promise && (
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#ff7a1a] mb-2">O que você vai conquistar</p>
              <p className="text-2xl sm:text-3xl font-extrabold leading-tight">{u.promise}</p>
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-3">
            {info.map((i) => <div key={i.text} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-4"><i.icon className="size-5 text-[#ff7a1a]" /><span className="text-sm">{i.text}</span></div>)}
            {u.extras?.bonus && <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-4"><Gift className="size-5 text-[#ff7a1a]" /><span className="text-sm">Bônus: {u.extras.bonus}</span></div>}
            {u.extras?.garantia && <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-4"><ShieldCheck className="size-5 text-[#ff7a1a]" /><span className="text-sm">{u.extras.garantia}</span></div>}
          </div>
          <div className="pt-2 space-y-3"><Price /><Button className="w-full" /></div>
        </div>
      </section>
      <footer className="border-t border-white/10 py-6 text-center text-xs text-white/40">© {new Date().getFullYear()} {d.expert} · V8 Aceleração</footer>
    </div>
  )
}
