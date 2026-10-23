// Cria usuários (admin ou expert) com a service role, sem expor a chave ao navegador.
import { admin, handle, HttpError, json, requireAdmin } from '../_shared/common.ts'

Deno.serve(handle(async (req) => {
  const caller = await requireAdmin(req)
  const { email, password, full_name, role, expert_ids } = await req.json()
  if (!email || !String(email).includes('@')) throw new HttpError(400, 'E-mail inválido.')
  if (!password || String(password).length < 6) throw new HttpError(400, 'A senha deve ter pelo menos 6 caracteres.')
  if (!['admin', 'expert'].includes(role)) throw new HttpError(400, 'Perfil inválido.')
  const sb = admin()
  const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name, role } })
  if (error) throw new HttpError(400, error.message.includes('already') ? 'Já existe um usuário com este e-mail.' : error.message)
  const id = data.user.id
  // o trigger handle_new_user cria o perfil; garante papel e nome informados
  await sb.from('profiles').update({ role, full_name }).eq('id', id)
  if (role === 'expert' && Array.isArray(expert_ids) && expert_ids.length) {
    const { error: e2 } = await sb.from('user_experts').insert(expert_ids.map((expert_id: string) => ({ user_id: id, expert_id })))
    if (e2) throw new HttpError(400, e2.message)
  }
  await sb.from('activity_log').insert({ entity_type: 'profiles', entity_id: id, action: 'create_user', summary: `Usuário criado: ${email} (${role})`, user_id: caller.id, user_name: caller.full_name, is_audit: true })
  return json({ id, email, full_name, role })
}))
