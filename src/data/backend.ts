import type { FieldConfig, Funcao, Profile, Role, Row, TableName } from './types'

export type Filter<T extends TableName> = Partial<Record<keyof Row<T>, unknown>>

export type RpcName =
  | 'set_phase_status'
  | 'delete_project'
  | 'duplicate_project'
  | 'purge_demo_data'
  | 'create_user'
  | 'meta_connect_url'
  | 'meta_sync'
  | 'invite_member'
  | 'invite_link'

export interface NewUserInput {
  email: string
  password: string
  full_name: string
  role: Role
  expert_ids: string[]
}

/** Convite de colaborador (Edge Function invite-member). */
export interface InviteInput {
  email: string
  full_name: string
  funcao: Funcao
  expert_ids: string[]
  /** Só o dono: cria administrador (acesso a todos os experts). */
  make_admin?: boolean
  /** Só administradores: a pessoa pode montar a equipe destes experts. */
  can_manage_team?: boolean
}

export interface InviteResult {
  user_id: string
  status: 'invited' | 'linked' | 'already_admin'
  email_sent: boolean
  /** Link para enviar manualmente quando o e-mail não pôde ser enviado. */
  link: string | null
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
export interface SignUpInput {
  full_name: string
  email: string
  password: string
  funcao: Funcao
}

/** profile = null quando o Supabase exige confirmação por e-mail antes do primeiro acesso. */
export interface SignUpResult {
  profile: Profile | null
  confirmEmail: boolean
}

export interface PublicGallery {
  name: string
  description: string
  icon: string
  fields: FieldConfig[]
  records: Record<string, unknown>[]
}

export interface Backend {
  readonly mode: 'supabase' | 'local'

  currentUser(): Promise<Profile | null>
  signIn(email: string, password: string): Promise<Profile>
  /** Cadastro pela tela de login. O primeiro usuário vira administrador; os demais entram sem acesso até o admin liberar. */
  signUp(input: SignUpInput): Promise<SignUpResult>
  /** Login com conta Google (OAuth). Redireciona o navegador; só existe no modo Supabase. */
  signInWithGoogle(): Promise<void>
  /** Envia o e-mail com o link para criar uma senha nova. */
  requestPasswordReset(email: string): Promise<void>
  /** Troca a senha do usuário logado (usado após abrir o link de recuperação). */
  updatePassword(password: string): Promise<void>
  /** Galeria pública de uma seção pelo token do link compartilhado (não exige login). null = link inválido ou desativado. */
  publicGallery(token: string): Promise<PublicGallery | null>
  /** Avisa quando o usuário chegou pelo link de recuperação de senha. */
  onPasswordRecovery(cb: () => void): () => void
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
