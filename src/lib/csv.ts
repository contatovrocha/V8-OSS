/** Downloads e impressão são bloqueados quando o app roda dentro do visualizador do claude.ai. */
export const CAN_EXPORT = import.meta.env.VITE_TARGET !== 'artifact'

/** Exporta CSV compatível com Excel em português (separador ;, BOM UTF-8, decimal com vírgula). */
export function downloadCSV(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const cell = (v: string | number | null | undefined) => {
    if (v === null || v === undefined) return ''
    const s = typeof v === 'number' ? String(Math.round(v * 100) / 100).replace('.', ',') : String(v)
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [headers, ...rows].map((r) => r.map(cell).join(';')).join('\r\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
