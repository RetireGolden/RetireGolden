import { storedLifeTableEdition } from '@retiregolden/engine/longevity/ssaPeriodLifeTable'
import { lifeTableCitation } from '../longevity/constants'
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

/** A default end age taken from the saved questionnaire, with the SSA table it was computed on. */
export interface SavedEndAge {
  readonly age: number
  /** The table's citation label, e.g. "SSA period life table, 2022 (2025 Trustees Report)". */
  readonly tableLabel: string
}

/**
 * The saved questionnaire's planning age as it was saved, with the edition of
 * the table it was computed on (a result saved without one was made on the
 * 2022 table), or null when nothing usable is saved. A stored figure keeps
 * what it was computed on: it is not re-derived on a later table, and a
 * surface that prefills it shows `tableLabel` beside it.
 */
export function savedEndAge(): SavedEndAge | null {
  const L = loadLongevity()
  const age = L?.result?.illustrativePlanningAge
  if (!L || !age) return null
  return { age, tableLabel: lifeTableCitation(storedLifeTableEdition(L.result.tableEdition)).label }
}

/** The saved questionnaire's planning age (`savedEndAge`), else 90. */
export function defaultEndAge(): number {
  return savedEndAge()?.age ?? 90
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
