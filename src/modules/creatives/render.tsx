import { toBlob } from 'html-to-image'
import { createRoot } from 'react-dom/client'
import { sizeOf } from '@/lib/campaign'
import { CreativeArt, type ArtProps } from './CreativeArt'
import m400 from '@fontsource/manrope/files/manrope-latin-400-normal.woff2?url'
import m600 from '@fontsource/manrope/files/manrope-latin-600-normal.woff2?url'
import m700 from '@fontsource/manrope/files/manrope-latin-700-normal.woff2?url'
import m800 from '@fontsource/manrope/files/manrope-latin-800-normal.woff2?url'

// A fonte vai embutida no PNG a partir de arquivos do próprio sistema (a folha do Google não pode ser lida na exportação).
let fontCss: Promise<string> | null = null
const toDataUrl = async (url: string) => {
  const blob = await (await fetch(url)).blob()
  return new Promise<string>((r) => { const fr = new FileReader(); fr.onload = () => r(String(fr.result)); fr.readAsDataURL(blob) })
}
function embeddedFonts() {
  fontCss ??= Promise.all(([[400, m400], [600, m600], [700, m700], [800, m800]] as const).map(async ([w, url]) => {
    const data = await toDataUrl(url)
    return `@font-face{font-family:'Manrope';font-style:normal;font-weight:${w};font-display:block;src:url(${data}) format('woff2')}`
  })).then((x) => x.join('\n'))
  return fontCss
}

const waitImages = (el: HTMLElement) =>
  Promise.all([...el.querySelectorAll('img')].map((img) => (img.complete && img.naturalWidth ? Promise.resolve() : new Promise<void>((r) => { img.onload = () => r(); img.onerror = () => r() }))))

/** Desenha o criativo fora da tela no tamanho real e devolve o PNG (sem servidor, sem IA). */
export async function renderCreativePng(props: ArtProps): Promise<Blob> {
  const { w, h } = sizeOf(props.format)
  const host = document.createElement('div')
  host.style.cssText = `position:fixed;left:-${w + 200}px;top:0;width:${w}px;height:${h}px;pointer-events:none;z-index:-1`
  document.body.appendChild(host)
  const root = createRoot(host)
  try {
    root.render(<CreativeArt {...props} />)
    await new Promise((r) => setTimeout(r, 60))
    await waitImages(host)
    const fontEmbedCSS = await embeddedFonts()
    await document.fonts.ready
    const node = host.firstElementChild as HTMLElement
    const blob = await toBlob(node, { width: w, height: h, pixelRatio: 1, cacheBust: true, fontEmbedCSS })
    if (!blob) throw new Error('Não foi possível gerar a imagem do criativo.')
    return blob
  } finally {
    root.unmount()
    host.remove()
  }
}
