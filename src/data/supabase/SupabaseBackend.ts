import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { BackendError, type Backend, type ChangeEvent, type Filter, type RpcName } from '../backend'
import type { Profile, Row, TableName } from '../types'

const FUNCTION_RPCS: RpcName[] = ['create_user', 'meta_connect_url', 'meta_sync']
const PAGE = 1000

function wrap(e: { message: string; code?: string } | null): never | void {
  if (!e) return
  const msg = e.message || 'Erro ao comunicar com o servidor.'
  if (e.code === '42501' || /row-level security|permission denied/i.test(msg)) throw new BackendError('Seu perfil não tem permissão para esta ação.', 'forbidden')
  if (e.code === '23505') throw new BackendError('Registro duplicado.', 'duplicate')
  if (e.code === '23503') throw new BackendError('Existem registros vinculados que impedem esta operação.', 'conflict')
  throw new BackendError(msg, e.code ?? 'error')
}

/**
 * Backend de produção. A segurança é garantida no banco (RLS + funções SECURITY DEFINER);
 * a interface apenas reflete as permissões.
 */
export class SupabaseBackend implements Backend {
  readonly mode = 'supabase' as const
  readonly client: SupabaseClient

  constructor(url: string, anonKey: string) {
    this.client = createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } })
  }

  private async profile(userId: string): Promise<Profile | null> {
    const { data, error } = await this.client.from('profiles').select('*').eq('id', userId).maybeSingle()
    wrap(error)
    return (data as Profile) ?? null
  }

  async currentUser() {
    const { data } = await this.client.auth.getSession()
    return data.session ? this.profile(data.session.user.id) : null
  }

  async signIn(email: string, password: string) {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password })
    if (error) throw new BackendError(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message, 'auth')
    const p = await this.profile(data.user.id)
    if (!p) throw new BackendError('Perfil não encontrado. Peça a um administrador para concluir seu cadastro.', 'auth')
    return p
  }

  async signOut() {
    await this.client.auth.signOut()
  }

  onAuthChange(cb: (p: Profile | null) => void) {
    const { data } = this.client.auth.onAuthStateChange(async (_e, session) => cb(session ? await this.profile(session.user.id) : null))
    return () => data.subscription.unsubscribe()
  }

  async list<T extends TableName>(table: T, filter?: Filter<T>): Promise<Row<T>[]> {
    const out: Row<T>[] = []
    for (let from = 0; ; from += PAGE) {
      let q = this.client.from(table).select('*').range(from, from + PAGE - 1)
      for (const [k, v] of Object.entries(filter ?? {})) q = v === null ? q.is(k, null) : q.eq(k, v)
      const { data, error } = await q
      wrap(error)
      out.push(...((data ?? []) as Row<T>[]))
      if (!data || data.length < PAGE) break
    }
    return out
  }

  private clean<T>(v: T): T {
    const o = { ...(v as Record<string, unknown>) }
    for (const k of ['created_at', 'updated_at']) if (o[k] === undefined) delete o[k]
    return o as T
  }

  async insert<T extends TableName>(table: T, values: Partial<Row<T>>) {
    const { data, error } = await this.client.from(table).insert(this.clean(values) as never).select('*').single()
    wrap(error)
    return data as Row<T>
  }

  async insertMany<T extends TableName>(table: T, values: Partial<Row<T>>[]) {
    const out: Row<T>[] = []
    for (let i = 0; i < values.length; i += 500) {
      const { data, error } = await this.client.from(table).insert(values.slice(i, i + 500).map((v) => this.clean(v)) as never).select('*')
      wrap(error)
      out.push(...((data ?? []) as Row<T>[]))
    }
    return out
  }

  async update<T extends TableName>(table: T, id: string, patch: Partial<Row<T>>) {
    const p = { ...(patch as Record<string, unknown>) }
    delete p.id
    delete p.created_at
    delete p.updated_at
    const { data, error } = await this.client.from(table).update(p).eq('id', id).select('*').maybeSingle()
    wrap(error)
    if (!data) throw new BackendError('Seu perfil não tem permissão para esta ação ou o registro não existe mais.', 'forbidden')
    return data as Row<T>
  }

  async remove(table: TableName, id: string) {
    if (table === 'projects') {
      await this.rpc('delete_project', { project_id: id })
      return
    }
    const { error, count } = await this.client.from(table).delete({ count: 'exact' }).eq('id', id)
    wrap(error)
    if (count === 0) throw new BackendError('Seu perfil não tem permissão para excluir este registro.', 'forbidden')
  }

  async rpc<R = unknown>(name: RpcName, args: Record<string, unknown>): Promise<R> {
    if (FUNCTION_RPCS.includes(name)) {
      const fn = name === 'create_user' ? 'admin-create-user' : name === 'meta_connect_url' ? 'meta-oauth' : 'meta-sync'
      const { data, error } = await this.client.functions.invoke(fn, { body: { action: name, ...args } })
      if (error) {
        let msg = error.message
        try {
          const body = await (error as { context?: Response }).context?.json()
          if (body?.error) msg = body.error
        } catch { /* corpo não-JSON */ }
        throw new BackendError(msg, 'function')
      }
      return data as R
    }
    const { data, error } = await this.client.rpc(name, args)
    wrap(error)
    return data as R
  }

  async upload(file: Blob, folder: string, filename = 'arquivo') {
    const safe = filename.normalize('NFD').replace(/[^\w.-]+/g, '_').slice(-60)
    const path = `${folder}/${crypto.randomUUID()}-${safe}`
    const { error } = await this.client.storage.from('media').upload(path, file, { contentType: file.type || undefined, upsert: false })
    if (error) throw new BackendError(`Falha no envio do arquivo: ${error.message}`, 'storage')
    return this.client.storage.from('media').getPublicUrl(path).data.publicUrl
  }

  subscribe(cb: (e: ChangeEvent) => void) {
    const ch = this.client
      .channel('launchos-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => cb({ table: payload.table as TableName }))
      .subscribe()
    return () => {
      this.client.removeChannel(ch)
    }
  }
}
