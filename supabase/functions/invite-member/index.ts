// Convida colaboradores por e-mail e monta a equipe de cada expert, com a função de cada pessoa.
// Quem pode: dono e administradores (qualquer expert) ou o gestor da equipe daquele expert (can_manage_team).
// Se o e-mail não puder ser enviado (limite do Supabase/SMTP), devolve um link de convite para enviar manualmente.
import { admin, handle, HttpError, json, requireUser, type Caller } from '../_shared/common.ts'

const FUNCOES = ['expert', 'estrategista', 'gestor_trafego', 'closer', 'sdr', 'social_seller', 'gerente_projeto']
const UUID = /^[0-9a-f-]{36}$/i
// O link do e-mail volta para a tela de criar senha do sistema.
const APP_URL = (Deno.env.get('APP_URL') ?? 'https://sistema.v8.ia.br/').replace(/\/?$/, '/')
const REDIRECT = `${APP_URL}?reset=1`

const isAdmin = (c: Caller) => c.role === 'owner' || c.role === 'admin'

async function managesAll(callerId: string, expertIds: string[]) {
  const { data } = await admin().from('user_experts').select('expert_id').eq('user_id', callerId).eq('can_manage_team', true).in('expert_id', expertIds)
  return new Set((data ?? []).map((r) => r.expert_id)).size === new Set(expertIds).size
}

Deno.serve(handle(async (req) => {
  const caller = await requireUser(req)
  const body = await req.json()
  const sb = admin()

  if (body.action === 'invite_link') {
    // Novo link de acesso para quem ainda não entrou (ou perdeu o e-mail).
    const userId = String(body.user_id ?? '')
    if (!UUID.test(userId)) throw new HttpError(400, 'Usuário inválido.')
    const { data: target } = await sb.from('profiles').select('id, email, role').eq('id', userId).single()
    if (!target) throw new HttpError(404, 'Usuário não encontrado.')
    if (!isAdmin(caller)) {
      const { data: links } = await sb.from('user_experts').select('expert_id').eq('user_id', userId)
      const ids = (links ?? []).map((l) => l.expert_id)
      const { data: mine } = ids.length ? await sb.from('user_experts').select('expert_id').eq('user_id', caller.id).eq('can_manage_team', true).in('expert_id', ids) : { data: [] }
      if (!mine?.length) throw new HttpError(403, 'Você só gera convites para a sua equipe.')
      if (target.role !== 'expert') throw new HttpError(403, 'Administradores são convidados pelo dono.')
    }
    const { data, error } = await sb.auth.admin.generateLink({ type: 'magiclink', email: target.email, options: { redirectTo: REDIRECT } })
    if (error) throw new HttpError(400, error.message)
    return json({ link: data.properties.action_link })
  }

  // ---------------------------------------------------------------- convite / vínculo
  const email = String(body.email ?? '').trim().toLowerCase()
  const fullName = String(body.full_name ?? '').trim()
  const funcao = String(body.funcao ?? '')
  const expertIds: string[] = Array.isArray(body.expert_ids) ? body.expert_ids.map(String).filter((x: string) => UUID.test(x)) : []
  const makeAdmin = Boolean(body.make_admin)
  const canManageTeam = Boolean(body.can_manage_team)

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, 'E-mail inválido.')
  if (fullName.length < 2) throw new HttpError(400, 'Informe o nome.')
  if (!FUNCOES.includes(funcao)) throw new HttpError(400, 'Selecione a função.')
  if (!makeAdmin && !expertIds.length) throw new HttpError(400, 'Selecione pelo menos um expert.')
  if (makeAdmin && caller.role !== 'owner') throw new HttpError(403, 'Somente o dono cria administradores.')
  if (!isAdmin(caller)) {
    if (makeAdmin || canManageTeam) throw new HttpError(403, 'Somente administradores definem quem gerencia a equipe.')
    if (!(await managesAll(caller.id, expertIds))) throw new HttpError(403, 'Você só adiciona pessoas na equipe dos experts que gerencia.')
  }

  const { data: existing } = await sb.from('profiles').select('id, role, funcao').eq('email', email).maybeSingle()
  let userId: string
  let status: 'invited' | 'linked'
  let emailSent = false
  let link: string | null = null

  if (existing) {
    userId = existing.id
    status = 'linked'
    if (existing.role === 'owner' || (existing.role !== 'expert' && !makeAdmin)) return json({ user_id: userId, status: 'already_admin', email_sent: false, link: null })
    if (!existing.funcao) await sb.from('profiles').update({ funcao }).eq('id', userId)
  } else {
    const meta = { full_name: fullName, funcao }
    const inv = await sb.auth.admin.inviteUserByEmail(email, { data: meta, redirectTo: REDIRECT })
    if (!inv.error && inv.data.user) {
      userId = inv.data.user.id
      emailSent = true
    } else {
      const gen = await sb.auth.admin.generateLink({ type: 'invite', email, options: { data: meta, redirectTo: REDIRECT } })
      if (gen.error || !gen.data.user) throw new HttpError(400, gen.error?.message ?? inv.error?.message ?? 'Não foi possível criar o convite.')
      userId = gen.data.user.id
      link = gen.data.properties.action_link
    }
    status = 'invited'
    await sb.from('profiles').update({ full_name: fullName, funcao }).eq('id', userId)
  }

  if (makeAdmin) {
    await sb.from('profiles').update({ role: 'admin' }).eq('id', userId)
  } else {
    const rows = expertIds.map((expert_id) => ({ user_id: userId, expert_id, funcao, can_manage_team: isAdmin(caller) && canManageTeam, added_by: caller.id }))
    const { error } = await sb.from('user_experts').upsert(rows, { onConflict: 'user_id,expert_id' })
    if (error) throw new HttpError(400, error.message)
  }

  await sb.from('activity_log').insert({
    entity_type: 'profiles', entity_id: userId, action: status === 'invited' ? 'invite_user' : 'link_user', is_audit: true,
    summary: `${status === 'invited' ? 'Convite enviado' : 'Acesso liberado'}: ${email}${makeAdmin ? ' (administrador)' : ''}`,
    user_id: caller.id, user_name: caller.full_name,
  })
  return json({ user_id: userId, status, email_sent: emailSent, link })
}))
