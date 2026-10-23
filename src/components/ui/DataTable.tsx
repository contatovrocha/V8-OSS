import clsx from 'clsx'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Input, Select } from './primitives'

export interface Column<T> {
  key: string
  header: ReactNode
  cell: (row: T) => ReactNode
  sortValue?: (row: T) => string | number | null
  align?: 'left' | 'right' | 'center'
  className?: string
}

/** Tabela com pesquisa, ordenação e paginação no cliente. */
export function DataTable<T extends { id: string }>({
  rows, columns, searchText, initialSort, pageSize = 15, empty, onRowClick, toolbar, footer,
}: {
  rows: T[]
  columns: Column<T>[]
  searchText?: (row: T) => string
  initialSort?: { key: string; dir: 'asc' | 'desc' }
  pageSize?: number
  empty?: ReactNode
  onRowClick?: (row: T) => void
  toolbar?: ReactNode
  footer?: ReactNode
}) {
  const [q, setQ] = useState('')
  const [sort, setSort] = useState(initialSort ?? null)
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(pageSize)

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    let out = term && searchText ? rows.filter((r) => searchText(r).toLowerCase().includes(term)) : rows
    if (sort) {
      const col = columns.find((c) => c.key === sort.key)
      if (col?.sortValue) {
        out = [...out].sort((a, b) => {
          const va = col.sortValue!(a)
          const vb = col.sortValue!(b)
          if (va === null || va === undefined) return 1
          if (vb === null || vb === undefined) return -1
          const c = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'pt-BR')
          return sort.dir === 'asc' ? c : -c
        })
      }
    }
    return out
  }, [rows, q, sort, columns, searchText])

  const pages = Math.max(1, Math.ceil(filtered.length / size))
  const current = Math.min(page, pages - 1)
  const visible = filtered.slice(current * size, current * size + size)

  return (
    <div>
      {(searchText || toolbar) && (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {searchText && (
            <div className="relative flex-1 min-w-48 max-w-sm">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
              <Input className="pl-9" placeholder="Pesquisar..." value={q} onChange={(e) => { setQ(e.target.value); setPage(0) }} />
            </div>
          )}
          {toolbar}
        </div>
      )}
      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full text-sm">
          <thead className="bg-surface-2/80 text-muted text-xs uppercase tracking-wide">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={clsx('px-3 py-2.5 font-semibold whitespace-nowrap', c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left', c.sortValue && 'cursor-pointer hover:text-ink select-none')}
                  onClick={() => c.sortValue && setSort((s) => ({ key: c.key, dir: s?.key === c.key && s.dir === 'desc' ? 'asc' : 'desc' }))}
                >
                  <span className="inline-flex items-center gap-1">
                    {c.header}
                    {sort?.key === c.key && (sort.dir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id} onClick={() => onRowClick?.(r)} className={clsx('border-t border-line hover:bg-surface-2/60 transition', onRowClick && 'cursor-pointer')}>
                {columns.map((c) => (
                  <td key={c.key} className={clsx('px-3 py-2.5 align-middle', c.align === 'right' && 'text-right tabular-nums', c.align === 'center' && 'text-center', c.className)}>
                    {c.cell(r)}
                  </td>
                ))}
              </tr>
            ))}
            {!visible.length && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-10 text-center text-muted">{empty ?? 'Nenhum registro encontrado.'}</td>
              </tr>
            )}
          </tbody>
          {footer && <tfoot className="border-t border-line-strong bg-surface-2/60 font-semibold">{footer}</tfoot>}
        </table>
      </div>
      {filtered.length > 10 && (
        <div className="flex flex-wrap items-center justify-between gap-2 mt-3 text-xs text-muted">
          <span>{filtered.length} registro(s)</span>
          <div className="flex items-center gap-2">
            <Select className="!h-8 !w-auto text-xs" value={size} onChange={(e) => { setSize(+e.target.value); setPage(0) }}>
              {[10, 15, 25, 50, 100].map((n) => <option key={n} value={n}>{n} por página</option>)}
            </Select>
            <button disabled={current === 0} onClick={() => setPage(current - 1)} className="p-1.5 rounded-full hover:bg-surface-3 disabled:opacity-30" aria-label="Anterior"><ChevronLeft className="size-4" /></button>
            <span>{current + 1} / {pages}</span>
            <button disabled={current >= pages - 1} onClick={() => setPage(current + 1)} className="p-1.5 rounded-full hover:bg-surface-3 disabled:opacity-30" aria-label="Próxima"><ChevronRight className="size-4" /></button>
          </div>
        </div>
      )}
    </div>
  )
}
