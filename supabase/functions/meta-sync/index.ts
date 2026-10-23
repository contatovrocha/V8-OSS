// Sincronização Meta Ads → Launch OS (campanhas, conjuntos, anúncios, criativos e métricas diárias por anúncio).
// POST { ad_account_id, days?: number }  — somente administradores.
// Idempotente: upserts por (conta, id externo) e métricas por (anúncio, data, origem) — sem duplicidade.
import { admin, GRAPH, handle, HttpError, json, requireAdmin } from '../_shared/common.ts'

type Paged<T> = { data: T[]; paging?: { next?: string } }

class MetaError extends Error {
  constructor(readonly code: number, message: string) {
    super(message)
  }
}

async function getAll<T>(path: string, token: string, params: Record<string, string>): Promise<T[]> {
  const out: T[] = []
  let url: string | undefined = (() => {
    const u = new URL(`${GRAPH}${path}`)
    for (const [k, v] of Object.entries({ ...params, access_token: token, limit: '200' })) u.searchParams.set(k, v)
    return u.toString()
  })()
  for (let page = 0; url && page < 50; page++) {
    const r: Response = await fetch(url)
    const body: Paged<T> & { error?: { code?: number; message: string } } = await r.json()
    if (body.error) throw new MetaError(body.error.code ?? 0, body.error.message)
    out.push(...(body as Paged<T>).data)
    url = (body as Paged<T>).paging?.next
  }
  return out
}

type Action = { action_type: string; value: string }
/** Usa um único tipo de ação por métrica (o primeiro disponível na ordem de preferência), evitando somar o mesmo evento duas vezes. */
function pick(actions: Action[] | undefined, prefs: string[]): number {
  if (!actions) return 0
  for (const p of prefs) {
    const a = actions.find((x) => x.action_type === p)
    if (a) return Number(a.value) || 0
  }
  return 0
}
const LEAD = ['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead']
const PURCHASE = ['purchase', 'omni_purchase', 'offsite_conversion.fb_pixel_purchase']

Deno.serve(handle(async (req) => {
  await requireAdmin(req)
  const { ad_account_id, days = 90 } = await req.json()
  const sb = admin()
  const { data: account } = await sb.from('ad_accounts').select('*').eq('id', ad_account_id).single()
  if (!account) throw new HttpError(404, 'Conta de anúncios não encontrada.')
  if (account.is_demo) throw new HttpError(400, 'Contas demonstrativas não são sincronizadas.')
  const { data: tok } = await sb.rpc('meta_get_token', { p_account: account.id })
  const token = Array.isArray(tok) ? tok[0]?.access_token : null
  if (!token) throw new HttpError(412, 'Conta sem autorização. Conecte a conta Meta novamente em Configurações → Integrações.')

  const fail = async (status: 'erro' | 'expirada', message: string) => {
    await sb.from('ad_accounts').update({ status, last_sync_status: 'erro', last_error: message }).eq('id', account.id)
    throw new HttpError(502, message)
  }

  try {
    const { data: proj } = await sb.from('projects').select('id').eq('ad_account_id', account.id).limit(1)
    const projectId = proj?.[0]?.id ?? null
    const act = account.external_id

    const campaigns = await getAll<{ id: string; name: string; objective: string; effective_status: string }>(`/${act}/campaigns`, token, { fields: 'id,name,objective,effective_status' })
    const { data: campRows, error: ce } = await sb.from('campaigns').upsert(
      campaigns.map((c) => ({ ad_account_id: account.id, project_id: projectId, external_id: c.id, name: c.name, objective: c.objective ?? '', status: c.effective_status ?? '' })),
      { onConflict: 'ad_account_id,external_id' },
    ).select('id, external_id')
    if (ce) throw ce
    const campId = new Map((campRows ?? []).map((c) => [c.external_id, c.id]))

    const adsets = await getAll<{ id: string; name: string; campaign_id: string; effective_status: string }>(`/${act}/adsets`, token, { fields: 'id,name,campaign_id,effective_status' })
    const setRowsIn = adsets.filter((s) => campId.has(s.campaign_id)).map((s) => ({ campaign_id: campId.get(s.campaign_id), external_id: s.id, name: s.name, status: s.effective_status ?? '' }))
    const { data: setRows, error: se } = await sb.from('ad_sets').upsert(setRowsIn, { onConflict: 'campaign_id,external_id' }).select('id, external_id')
    if (se) throw se
    const setId = new Map((setRows ?? []).map((s) => [s.external_id, s.id]))

    type MetaAd = { id: string; name: string; adset_id: string; campaign_id: string; effective_status: string; creative?: { thumbnail_url?: string; image_url?: string; video_id?: string; body?: string; title?: string; object_story_spec?: { link_data?: { message?: string; name?: string; description?: string } } } }
    const ads = await getAll<MetaAd>(`/${act}/ads`, token, { fields: 'id,name,adset_id,campaign_id,effective_status,creative{thumbnail_url,image_url,video_id,body,title,object_story_spec}', thumbnail_width: '600', thumbnail_height: '600' })
    const adRowsIn = ads.filter((a) => setId.has(a.adset_id)).map((a) => {
      const link = a.creative?.object_story_spec?.link_data
      return {
        ad_set_id: setId.get(a.adset_id), campaign_id: campId.get(a.campaign_id), ad_account_id: account.id, project_id: projectId, external_id: a.id, name: a.name,
        status: a.effective_status ?? '', platform: 'Meta', placement: '', creative_type: a.creative?.video_id ? 'video' : 'imagem',
        thumbnail_url: a.creative?.image_url ?? a.creative?.thumbnail_url ?? null, video_url: null,
        primary_text: a.creative?.body ?? link?.message ?? '', headline: a.creative?.title ?? link?.name ?? '', description: link?.description ?? '',
      }
    })
    const { data: adRows, error: ae } = await sb.from('ads').upsert(adRowsIn, { onConflict: 'ad_account_id,external_id' }).select('id, external_id')
    if (ae) throw ae
    const adId = new Map((adRows ?? []).map((a) => [a.external_id, a.id]))

    const until = new Date().toISOString().slice(0, 10)
    const since = new Date(Date.now() - Number(days) * 86400000).toISOString().slice(0, 10)
    type Insight = { ad_id: string; date_start: string; spend: string; impressions: string; reach: string; inline_link_clicks?: string; actions?: Action[]; action_values?: Action[] }
    const insights = await getAll<Insight>(`/${act}/insights`, token, {
      level: 'ad', time_increment: '1', time_range: JSON.stringify({ since, until }),
      fields: 'ad_id,date_start,spend,impressions,reach,inline_link_clicks,actions,action_values',
      action_attribution_windows: '["7d_click","1d_view"]',
    })
    const syncedAt = new Date().toISOString()
    const metrics = insights.filter((i) => adId.has(i.ad_id)).map((i) => ({
      ad_id: adId.get(i.ad_id), ad_account_id: account.id, date: i.date_start, spend: Number(i.spend) || 0, impressions: Number(i.impressions) || 0,
      reach: Number(i.reach) || 0, link_clicks: Number(i.inline_link_clicks) || 0, leads: pick(i.actions, LEAD), purchases: pick(i.actions, PURCHASE),
      purchase_value: pick(i.action_values, PURCHASE), attribution_setting: '7 dias após o clique / 1 dia após visualização', source: 'meta', synced_at: syncedAt,
    }))
    for (let k = 0; k < metrics.length; k += 500) {
      const { error } = await sb.from('ad_metrics_daily').upsert(metrics.slice(k, k + 500), { onConflict: 'ad_id,date,source' })
      if (error) throw error
    }

    // Conexão só é considerada concluída após autorização válida E sincronização bem-sucedida.
    await sb.from('ad_accounts').update({ status: 'conectada', last_sync_at: syncedAt, last_sync_status: 'ok', last_error: null }).eq('id', account.id)
    return json({ campaigns: campaigns.length, adsets: setRowsIn.length, ads: adRowsIn.length, metrics: metrics.length, since, until })
  } catch (e) {
    if (e instanceof HttpError) throw e
    if (e instanceof MetaError) {
      if (e.code === 190) return await fail('expirada', 'Autorização expirada ou revogada. Reconecte a conta Meta.')
      if ([4, 17, 32, 613, 80000, 80004].includes(e.code)) return await fail('erro', 'Limite de chamadas da API Meta atingido. Tente novamente em alguns minutos.')
      if (e.code === 200 || e.code === 10) return await fail('erro', 'Permissão insuficiente na conta de anúncios (ads_read).')
      return await fail('erro', `Meta: ${e.message}`)
    }
    return await fail('erro', e instanceof Error ? e.message : 'Falha na sincronização.')
  }
}))
