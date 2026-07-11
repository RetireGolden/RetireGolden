import { loadLongevity } from '../longevity/storage'
import { loadSs, type SsFormSnapshot } from './storage'

export const CLAIM_OPTIONS = [62, 63, 64, 65, 66, 67, 68, 69, 70] as const

export function parseDob(iso: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null
  return { y, m: mo, d }
}

export const SS_CHART_LINE_COLORS = [
  '#0d9488',
  '#6366f1',
  '#a855f7',
  '#ea580c',
  '#0891b2',
  '#16a34a',
  '#ca8a04',
  '#dc2626',
  '#db2777',
]

export function defaultEndAge(): number {
  const L = loadLongevity()
  if (L?.result?.illustrativePlanningAge) return L.result.illustrativePlanningAge
  return 90
}

export function initialSsForm(): SsFormSnapshot {
  const saved = loadSs()
  if (saved?.form) return saved.form
  return {
    householdMode: 'single',
    dob: '1962-06-15',
    piaSource: 'quick',
    quickPiaKind: 'authoritative',
    piaMonthly: 3200,
    claimAges: [62, 67, 70],
    endAge: defaultEndAge(),
    colaPercent: 0,
    discountPercent: 0,
  }
}
