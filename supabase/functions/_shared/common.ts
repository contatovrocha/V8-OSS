import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'

export const cors = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

/** Cliente com service role — usado apenas no servidor; a chave nunca chega ao navegador. */
export function admin(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
}

/** Valida o JWT do chamador e exige perfil administrador. */
export async function requireAdmin(req: Request): Promise<{ id: string; full_name: string }> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) throw new HttpError(401, 'Sessão ausente.')
  const sb = admin()
  const { data, error } = await sb.auth.getUser(token)
  if (error || !data.user) throw new HttpError(401, 'Sessão inválida ou expirada.')
  const { data: profile } = await sb.from('profiles').select('id, full_name, role').eq('id', data.user.id).single()
  if (profile?.role !== 'admin') throw new HttpError(403, 'Somente administradores podem executar esta ação.')
  return profile
}

export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}

export function handle(fn: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
    try {
      return await fn(req)
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500
      console.error(e)
      return json({ error: e instanceof Error ? e.message : 'Erro inesperado.' }, status)
    }
  }
}

export const GRAPH = `https://graph.facebook.com/${Deno.env.get('META_API_VERSION') ?? 'v21.0'}`
