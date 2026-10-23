// Imagens demonstrativas embutidas como data URI: funcionam em qualquer endereço de publicação
// e continuam válidas no banco mesmo após novos deploys.

import camilaSvg from '@/assets/demo/camila.svg?raw'
import coverCamilaSvg from '@/assets/demo/cover-camila.svg?raw'
import coverJantarSvg from '@/assets/demo/cover-jantar.svg?raw'
import coverMentoriaSvg from '@/assets/demo/cover-mentoria.svg?raw'
import coverPodcastSvg from '@/assets/demo/cover-podcast.svg?raw'
import creative1Svg from '@/assets/demo/creative-01.svg?raw'
import creative2Svg from '@/assets/demo/creative-02.svg?raw'
import creative3Svg from '@/assets/demo/creative-03.svg?raw'
import creative4Svg from '@/assets/demo/creative-04.svg?raw'
import creative5Svg from '@/assets/demo/creative-05.svg?raw'
import creative6Svg from '@/assets/demo/creative-06.svg?raw'
import pageCheckoutSvg from '@/assets/demo/page-checkout.svg?raw'
import pageConfirmacaoSvg from '@/assets/demo/page-confirmacao.svg?raw'
import pageEventoSvg from '@/assets/demo/page-evento.svg?raw'
import pageInscricaoSvg from '@/assets/demo/page-inscricao.svg?raw'
import rafaelSvg from '@/assets/demo/rafael.svg?raw'

const uri = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

export const DEMO_IMG: Record<string, string> = {
  'camila': uri(camilaSvg),
  'cover-camila': uri(coverCamilaSvg),
  'cover-jantar': uri(coverJantarSvg),
  'cover-mentoria': uri(coverMentoriaSvg),
  'cover-podcast': uri(coverPodcastSvg),
  'creative-01': uri(creative1Svg),
  'creative-02': uri(creative2Svg),
  'creative-03': uri(creative3Svg),
  'creative-04': uri(creative4Svg),
  'creative-05': uri(creative5Svg),
  'creative-06': uri(creative6Svg),
  'page-checkout': uri(pageCheckoutSvg),
  'page-confirmacao': uri(pageConfirmacaoSvg),
  'page-evento': uri(pageEventoSvg),
  'page-inscricao': uri(pageInscricaoSvg),
  'rafael': uri(rafaelSvg),
}
