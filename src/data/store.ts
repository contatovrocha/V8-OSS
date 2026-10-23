import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { backend } from './client'
import type { Row, TableName } from './types'

interface Entry {
  rows: unknown[]
  loading: boolean
  error: string | null
  loaded: boolean
  inflight: Promise<void> | null
}

const cache = new Map<TableName, Entry>()
const subs = new Map<TableName, Set<() => void>>()
let generation = 0

const entry = (t: TableName): Entry => {
  let e = cache.get(t)
  if (!e) {
    e = { rows: [], loading: false, error: null, loaded: false, inflight: null }
    cache.set(t, e)
  }
  return e
}

const notify = (t: TableName) => subs.get(t)?.forEach((f) => f())

export function refresh(t: TableName): Promise<void> {
  const e = entry(t)
  const gen = generation
  e.loading = true
  const p = backend
    .list(t)
    .then((rows) => {
      if (gen !== generation) return
      cache.set(t, { rows, loading: false, error: null, loaded: true, inflight: null })
    })
    .catch((err: Error) => {
      if (gen !== generation) return
      cache.set(t, { ...entry(t), loading: false, error: err.message, loaded: true, inflight: null })
    })
    .finally(() => notify(t))
  e.inflight = p
  return p
}

/** Limpa o cache (troca de usuário). */
export function resetStore() {
  generation++
  cache.clear()
  subs.forEach((_s, t) => notify(t))
}

let realtimeBound = false
function bindRealtime() {
  if (realtimeBound) return
  realtimeBound = true
  backend.subscribe(({ table }) => {
    if (subs.get(table)?.size) refresh(table)
    else cache.delete(table)
  })
}

export function useRows<T extends TableName>(table: T) {
  bindRealtime()
  const subscribe = useCallback(
    (cb: () => void) => {
      if (!subs.has(table)) subs.set(table, new Set())
      subs.get(table)!.add(cb)
      return () => subs.get(table)!.delete(cb)
    },
    [table],
  )
  const snapshot = useSyncExternalStore(subscribe, () => cache.get(table))
  useEffect(() => {
    const e = entry(table)
    if (!e.loaded && !e.inflight) refresh(table)
  }, [table, snapshot])
  return {
    rows: (snapshot?.rows ?? []) as Row<T>[],
    loading: !snapshot?.loaded,
    error: snapshot?.error ?? null,
    reload: () => refresh(table),
  }
}

/** Após uma mutação, atualiza imediatamente as tabelas afetadas (o realtime também atualiza). */
export function invalidate(...tables: TableName[]) {
  return Promise.all(tables.map((t) => refresh(t)))
}
