// OAuth com a Meta (Facebook Login for Business) para a Marketing API.
//  POST  { action: 'meta_connect_url', redirect_to }  → (admin) devolve a URL de autorização
//  GET   ?code=...&state=...                         → retorno da Meta: troca o código por token de longa duração,
//                                                      lista as contas de anúncios e salva o token no schema privado.
// Segredos necessários: META_APP_ID, META_APP_SECRET, META_REDIRECT_URI (URL pública desta função).
import { admin, GRAPH, handle, HttpError, json, requireAdmin } from '../_shared/common.ts'

const APP_ID = Deno.env.get('META_APP_ID')
const APP_SECRET = Deno.env.get('META_APP_SECRET')
const REDIRECT_URI = Deno.env.get('META_REDIRECT_URI')

function back(to: string, params: Record<string, string>) {
  const u = new URL(to)
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v)
  return Response.redirect(u.toString(), 302)
}

async function graph<T>(path: string, params: Record<string, string>): Promise<T> {
  const u = new URL(path.startsWith('http') ? path : `${GRAPH}${path}`)
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v)
  const r = await fetch(u)
  const body = await r.json()
  if (!r.ok || body.error) throw new HttpError(400, body.error?.message ?? 'Falha na comunicação com a Meta.')
  return body as T
}

Deno.serve(handle(async (req) => {
  if (!APP_ID || !APP_SECRET || !REDIRECT_URI) throw new HttpError(412, 'Integração Meta não configurada: defina META_APP_ID, META_APP_SECRET e META_REDIRECT_URI nos segredos das Edge Functions.')
  const sb = admin()

  if (req.method === 'POST') {
    const user = await requireAdmin(req)
    const { redirect_to } = await req.json()
    if (!redirect_to || !/^https?:\/\//.test(redirect_to)) throw new HttpError(400, 'redirect_to inválido.')
    const state = crypto.randomUUID()
    const { error } = await sb.rpc('meta_put_state', { p_state: state, p_user: user.id, p_redirect: redirect_to })
    if (error) throw new HttpError(500, error.message)
    const url = new URL('https://www.facebook.com/dialog/oauth')
    url.searchParams.set('client_id', APP_ID)
    url.searchParams.set('redirect_uri', REDIRECT_URI)
    url.searchParams.set('state', state)
    url.searchParams.set('scope', 'ads_read,business_management')
    return json({ url: url.toString() })
  }

  // Retorno da Meta
  const q = new URL(req.url).searchParams
  const { data: st } = await sb.rpc('meta_take_state', { p_state: q.get('state') ?? '' })
  const state = Array.isArray(st) ? st[0] : null
  if (!state) return new Response('Solicitação de autorização expirada ou inválida. Volte ao Launch OS e tente novamente.', { status: 400 })
  if (q.get('error')) return back(state.redirect_to, { meta: 'erro', motivo: q.get('error_description') ?? q.get('error')! })

  try {
    const short = await graph<{ access_token: string }>('/oauth/access_token', { client_id: APP_ID, client_secret: APP_SECRET, redirect_uri: REDIRECT_URI, code: q.get('code') ?? '' })
    const long = await graph<{ access_token: string; expires_in?: number }>('/oauth/access_token', { grant_type: 'fb_exchange_token', client_id: APP_ID, client_secret: APP_SECRET, fb_exchange_token: short.access_token })
    const me = await graph<{ id: string }>('/me', { access_token: long.access_token, fields: 'id' })
    const accounts = await graph<{ data: { id: string; name: string; currency: string }[] }>('/me/adaccounts', { access_token: long.access_token, fields: 'id,name,currency', limit: '200' })
    if (!accounts.data.length) return back(state.redirect_to, { meta: 'erro', motivo: 'Nenhuma conta de anúncios autorizada para este usuário.' })
    const expires = long.expires_in ? new Date(Date.now() + long.expires_in * 1000).toISOString() : null
    for (const a of accounts.data) {
      // Conta fica "pendente" até a primeira sincronização bem-sucedida.
      const { data: row, error } = await sb.from('ad_accounts')
        .upsert({ platform: 'meta', external_id: a.id, name: a.name, currency: a.currency, status: 'pendente', last_error: null }, { onConflict: 'platform,external_id' })
        .select('id').single()
      if (error) throw error
      await sb.rpc('meta_save_token', { p_account: row.id, p_token: long.access_token, p_expires: expires, p_meta_user: me.id })
    }
    return back(state.redirect_to, { meta: 'ok' })
  } catch (e) {
    return back(state.redirect_to, { meta: 'erro', motivo: e instanceof Error ? e.message : 'falha na autorização' })
  }
}))
