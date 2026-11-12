import '@fontsource/manrope/400.css'
import '@fontsource/manrope/600.css'
import '@fontsource/manrope/700.css'
import '@fontsource/manrope/800.css'
import type { CSSProperties, ReactNode } from 'react'
import v8Logo from '@/assets/brand/v8-logo.png'
import type { CreativeContent, CreativeFormat, CreativeLayout, CreativePerson } from '@/data/types'
import { money0, sizeOf } from '@/lib/campaign'

// Modelos de criativo com a identidade V8, em pixels reais (1080 de largura). Estilos inline para
// que a exportação em PNG (html-to-image) saia idêntica à prévia.

const OR = '#ff6a00'
const OR2 = '#ff9a4d'
const BG = '#0a0a0c'
const FONT = "Manrope, Inter, system-ui, sans-serif"

export interface ArtProps {
  format: CreativeFormat
  layout: CreativeLayout
  content: CreativeContent
  people: CreativePerson[]
}

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke={OR} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d={d} /></svg>
)
const I_CAL = 'M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z'
const I_FMT = 'M12 21s-7-6.3-7-11a7 7 0 0 1 14 0c0 4.7-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z'
const I_LIVE = 'M3 7h13v10H3zM16 10l5-3v10l-5-3'

function Info({ c, size = 32, gap = 14 }: { c: CreativeContent; size?: number; gap?: number }) {
  const rows = [
    c.date_label && { d: I_CAL, t: c.date_label },
    c.format_label && { d: c.format_label.startsWith('Online') ? I_LIVE : I_FMT, t: [c.format_label, c.location_label].filter(Boolean).join(' · ') },
  ].filter(Boolean) as { d: string; t: string }[]
  return (
    <div style={{ display: 'grid', gap }}>
      {rows.map((r) => <div key={r.t} style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: size, color: '#e8e8ec', fontWeight: 600 }}><Icon d={r.d} />{r.t}</div>)}
    </div>
  )
}

function Price({ c, size = 64 }: { c: CreativeContent; size?: number }) {
  if (!c.show_price || c.price === null) return null
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, flexWrap: 'wrap' }}>
      <span style={{ fontSize: size * 0.42, color: '#cfcfd4', fontWeight: 600 }}>a partir de</span>
      <span style={{ fontSize: size, color: OR, fontWeight: 800, letterSpacing: -1 }}>{money0(c.price)}</span>
      {c.full_price ? <span style={{ fontSize: size * 0.4, color: '#8a8a90', textDecoration: 'line-through' }}>{money0(c.full_price)}</span> : null}
    </div>
  )
}

function Kicker({ text, light }: { text: string; light?: boolean }) {
  if (!text) return null
  return <span style={{ display: 'inline-block', alignSelf: 'flex-start', background: light ? 'rgba(255,106,0,.15)' : OR, color: light ? OR2 : '#140800', border: light ? `2px solid ${OR}` : 'none', fontWeight: 800, fontSize: 30, letterSpacing: 4, textTransform: 'uppercase', padding: '12px 26px', borderRadius: 999 }}>{text}</span>
}

function Cta({ text }: { text: string }) {
  return <div style={{ background: `linear-gradient(180deg,#ff8124,${OR})`, color: '#140800', fontWeight: 800, fontSize: 36, letterSpacing: 2, textTransform: 'uppercase', textAlign: 'center', padding: '30px 20px', borderRadius: 999, boxShadow: '0 20px 50px -18px rgba(255,106,0,.8)' }}>{text} →</div>
}

const Logo = ({ h = 70 }: { h?: number }) => <img src={v8Logo} alt="" style={{ height: h, width: 'auto', alignSelf: 'flex-start', flexShrink: 0 }} crossOrigin="anonymous" />

function Photo({ p, style }: { p?: CreativePerson; style?: CSSProperties }) {
  if (!p) return <div style={{ background: 'radial-gradient(circle at 50% 30%, #3a1a06, #0a0a0c 70%)', ...style }} />
  return <img src={p.photo_url} alt="" crossOrigin="anonymous" style={{ objectFit: 'cover', objectPosition: '50% 20%', ...style }} />
}

function Frame({ format, children }: { format: CreativeFormat; children: ReactNode }) {
  const { w, h } = sizeOf(format)
  return (
    <div style={{ width: w, height: h, position: 'relative', overflow: 'hidden', background: BG, fontFamily: FONT, color: '#fff' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(900px 700px at 80% 0%, rgba(255,106,0,.22), transparent 60%)' }} />
      {children}
    </div>
  )
}

export function CreativeArt({ format, layout, content: c, people }: ArtProps) {
  const tall = format === 'stories'
  const pad = 72
  const H = (n: number) => (tall ? Math.round(n * 1.12) : n)

  if (layout === 'destaque') {
    return (
      <Frame format={format}>
        <Photo p={people[0]} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: tall ? '62%' : '64%' }} />
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, rgba(10,10,12,.55) 0%, rgba(10,10,12,0) 18%, rgba(10,10,12,0) 34%, ${BG} ${tall ? 64 : 66}%)` }} />
        <div style={{ position: 'absolute', top: pad - 12, left: pad, right: pad, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><Kicker text={c.kicker} /><Logo /></div>
        <div style={{ position: 'absolute', left: pad, right: pad, bottom: pad, display: 'flex', flexDirection: 'column', gap: H(28) }}>
          <div style={{ fontSize: H(74), lineHeight: 1.04, fontWeight: 800, letterSpacing: -1.5 }}>{c.headline}</div>
          {c.subheadline && <div style={{ fontSize: H(34), lineHeight: 1.3, color: '#d6d6db' }}>{c.subheadline}</div>}
          <Info c={c} />
          <Price c={c} />
          <Cta text={c.cta} />
        </div>
      </Frame>
    )
  }

  if (layout === 'dividido') {
    return (
      <Frame format={format}>
        <Photo p={people[0]} style={tall ? { position: 'absolute', top: 0, left: 0, width: '100%', height: '50%' } : { position: 'absolute', top: 0, right: 0, width: '48%', height: '100%' }} />
        <div style={{ position: 'absolute', inset: 0, background: tall ? `linear-gradient(180deg, transparent 30%, ${BG} 52%)` : `linear-gradient(90deg, ${BG} 50%, rgba(10,10,12,.2) 70%, transparent 85%)` }} />
        <div style={{ position: 'absolute', left: pad, top: tall ? '48%' : pad, width: tall ? 1080 - pad * 2 : 600, bottom: pad, display: 'flex', flexDirection: 'column', gap: H(30), justifyContent: tall ? 'flex-start' : 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
            {!tall && <Logo h={64} />}
            <Kicker text={c.kicker} light />
            <div style={{ fontSize: H(66), lineHeight: 1.05, fontWeight: 800, letterSpacing: -1 }}>{c.headline}</div>
            {c.subheadline && <div style={{ fontSize: H(32), lineHeight: 1.32, color: '#d6d6db' }}>{c.subheadline}</div>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 26, marginTop: tall ? 'auto' : 0 }}>
            <Info c={c} size={30} />
            <Price c={c} size={58} />
            <Cta text={c.cta} />
          </div>
        </div>
        {tall && <div style={{ position: 'absolute', top: pad - 12, right: pad }}><Logo /></div>}
        {!tall && people[0] && <div style={{ position: 'absolute', right: 40, bottom: 40, background: 'rgba(10,10,12,.75)', borderLeft: `6px solid ${OR}`, padding: '14px 22px', fontSize: 28, fontWeight: 700 }}>{people[0].name}{people[0].title && <div style={{ fontSize: 22, fontWeight: 500, color: '#bdbdc4' }}>{people[0].title}</div>}</div>}
      </Frame>
    )
  }

  if (layout === 'convite') {
    const [d, , m] = c.date_label.split(' · ')[0].split(' ')
    return (
      <Frame format={format}>
        <div style={{ position: 'absolute', inset: 44, border: `3px solid ${OR}`, borderRadius: 48 }} />
        <div style={{ position: 'absolute', inset: 44 + 70, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: H(34), justifyContent: 'space-between' }}>
          <div><Logo h={80} /></div>
          <div style={{ fontSize: 30, letterSpacing: 10, color: OR2, fontWeight: 800, textTransform: 'uppercase' }}>{c.kicker || 'Você está convidado'}</div>
          <div style={{ display: 'flex', gap: 20, justifyContent: 'center' }}>
            {people.slice(0, 3).map((p) => <Photo key={p.id} p={p} style={{ width: H(200), height: H(200), borderRadius: '50%', border: `5px solid ${OR}` }} />)}
          </div>
          <div style={{ fontSize: H(66), lineHeight: 1.06, fontWeight: 800, letterSpacing: -1 }}>{c.headline}</div>
          {d && m && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
              <div style={{ fontSize: H(150), fontWeight: 800, color: OR, lineHeight: 0.9 }}>{d}</div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: H(46), fontWeight: 800, textTransform: 'uppercase' }}>{m}</div>
                <div style={{ fontSize: H(30), color: '#cfcfd4' }}>{[c.date_label.split(' · ')[1], c.format_label].filter(Boolean).join(' · ')}</div>
              </div>
            </div>
          )}
          {c.location_label && <div style={{ fontSize: H(30), color: '#d6d6db' }}>{c.location_label}</div>}
          <Price c={c} size={56} />
          <div style={{ width: '100%' }}><Cta text={c.cta} /></div>
        </div>
      </Frame>
    )
  }

  // grupo
  const crew = people.slice(0, 4)
  return (
    <Frame format={format}>
      <div style={{ position: 'absolute', top: pad - 12, left: pad, right: pad, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><Kicker text={c.kicker} /><Logo /></div>
      <div style={{ position: 'absolute', left: pad, right: pad, top: pad + 100, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ fontSize: H(68), lineHeight: 1.05, fontWeight: 800, letterSpacing: -1 }}>{c.headline}</div>
        {c.subheadline && <div style={{ fontSize: H(32), lineHeight: 1.3, color: '#d6d6db' }}>{c.subheadline}</div>}
      </div>
      <div style={{ position: 'absolute', left: pad, right: pad, top: tall ? 720 : 450, height: tall ? 640 : 400, display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, crew.length)}, 1fr)`, gap: 18 }}>
        {(crew.length ? crew : [undefined]).map((p, i) => (
          <div key={p?.id ?? i} style={{ position: 'relative', borderRadius: 28, overflow: 'hidden', border: `3px solid ${i === 0 ? OR : 'rgba(255,255,255,.12)'}` }}>
            <Photo p={p} style={{ width: '100%', height: '100%' }} />
            {p && <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '60px 16px 16px', background: 'linear-gradient(transparent, rgba(0,0,0,.85))', fontSize: crew.length > 2 ? 24 : 30, fontWeight: 700, textAlign: 'center' }}>{p.name}</div>}
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', left: pad, right: pad, bottom: pad, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <Info c={c} size={30} />
        <Price c={c} size={56} />
        <Cta text={c.cta} />
      </div>
    </Frame>
  )
}

/** Prévia reduzida (CSS transform), sem perder a proporção real. */
export function ArtPreview({ width, ...props }: ArtProps & { width: number }) {
  const { w, h } = sizeOf(props.format)
  const k = width / w
  return (
    <div style={{ width, height: h * k, overflow: 'hidden', borderRadius: 12, position: 'relative' }}>
      <div style={{ transform: `scale(${k})`, transformOrigin: 'top left', width: w, height: h }}><CreativeArt {...props} /></div>
    </div>
  )
}
