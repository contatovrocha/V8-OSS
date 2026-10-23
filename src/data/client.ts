import type { Backend } from './backend'
import { LocalBackend } from './local/LocalBackend'
import { SupabaseBackend } from './supabase/SupabaseBackend'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * Com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY definidos, usa o Supabase (produção).
 * Sem eles, roda no modo demonstrativo local (localStorage), indicado na interface.
 */
export const backend: Backend = url && key ? new SupabaseBackend(url, key) : new LocalBackend()
