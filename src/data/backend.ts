import type { Profile, Role, Row, TableName } from './types'

export type Filter<T extends TableName> = Partial<Record<keyof Row<T>, unknown>>

export type RpcName =
  | 'set_phase_status'
  | 'delete_project'
  | 'duplicate_project'
  | 'purge_demo_data'
  | 'create_user'
  | 'meta_connect_url'
  | 'meta_sync'

export interface NewUserInput {
  email: string
  password: string
  full_name: string
  role: Role
  expert_ids: string[]
}

export interface ChangeEvent {
  table: TableName
}

/**
 * Contrato único de acesso a dados. Existem duas implementações:
 *  - SupabaseBackend: produção. Autenticação, RLS, triggers de auditoria e storage reais.
 *  - LocalBackend: modo demonstrativo sem servidor (localStorage). Emula as mesmas
 *    políticas de acesso para que o comportamento da interface seja idêntico.
 */
export interface Backend {
  readonly mode: 'supabase' | 'local'

  currentUser(): Promise<Profile | null>
  signIn(email: string, password: string): Promise<Profile>
  signOut(): Promise<void>
  onAuthChange(cb: (p: Profile | null) => void): () => void

  list<T extends TableName>(table: T, filter?: Filter<T>): Promise<Row<T>[]>
  insert<T extends TableName>(table: T, values: Partial<Row<T>>): Promise<Row<T>>
  insertMany<T extends TableName>(table: T, values: Partial<Row<T>>[]): Promise<Row<T>[]>
  update<T extends TableName>(table: T, id: string, patch: Partial<Row<T>>): Promise<Row<T>>
  remove(table: TableName, id: string): Promise<void>
  rpc<R = unknown>(name: RpcName, args: Record<string, unknown>): Promise<R>

  upload(file: Blob, folder: string, filename?: string): Promise<string>
  subscribe(cb: (e: ChangeEvent) => void): () => void
}

export class BackendError extends Error {
  readonly code: string
  constructor(message: string, code = 'error') {
    super(message)
    this.code = code
  }
}
