import { writeFileSync } from 'node:fs'
import { it } from 'vitest'
import { demoData, DEMO_INSERT_ORDER } from '@/data/seed'

// Exporta o seed demonstrativo para validação contra o schema SQL (supabase/tests).
it.runIf(!!process.env.EXPORT_SEED)('exporta seed', () => {
  const d = demoData('00000000-0000-0000-0000-00000000000a', 'Admin')
  writeFileSync(process.env.EXPORT_SEED!, JSON.stringify(DEMO_INSERT_ORDER.map((t) => ({ table: t, rows: d[t] }))))
})
