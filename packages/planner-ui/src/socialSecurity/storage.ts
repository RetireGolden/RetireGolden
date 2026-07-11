import { readLocal, STORAGE_KEYS, writeLocal } from '../data/localStore'
import { parseSsPersistedLoose } from './persistedSsGuard'

export const SS_STORAGE_KEY = STORAGE_KEYS.socialSecurityForm

export type PiaSourceMode = 'quick' | 'earnings'

/** Household scope for Social Security workbench (M6). */
export type HouseholdMode = 'single' | 'couple'

/** How the quick-mode PIA number should be interpreted (for disclosure only). */
export type QuickPiaKind = 'authoritative' | 'ssa_estimate'

export interface SsFormSnapshot {
  /** When `couple`, partner fields apply and analysis uses household strategies. */
  householdMode?: HouseholdMode
  dob: string
  /** Default `quick`: enter PIA manually. `earnings`: derive PIA from pasted earnings. */
  piaSource?: PiaSourceMode
  piaMonthly: number
  /** Meaning of the quick-mode PIA figure; optional for backward compatibility. */
  quickPiaKind?: QuickPiaKind
  /** When `quickPiaKind` is `ssa_estimate`, optional age through which SSA assumed work. */
  ssaEstimateWorkThroughAge?: number | null
  /** Lines of `year amount` for earnings mode; see `parseEarningsLines`. */
  earningsPaste?: string
  /** Last calendar year with covered earnings (earnings mode); omit to use last base year. */
  lastEarningsYear?: number | null
  claimAges: number[]
  /** Partner (second earner) — used when `householdMode === 'couple'`. */
  partnerDob?: string
  partnerPiaSource?: PiaSourceMode
  partnerPiaMonthly?: number
  partnerQuickPiaKind?: QuickPiaKind
  partnerSsaEstimateWorkThroughAge?: number | null
  partnerEarningsPaste?: string
  partnerLastEarningsYear?: number | null
  partnerClaimAges?: number[]
  /** When true, household cumulative uses illustrative death ages (see below). */
  survivorOverlayEnabled?: boolean
  /** Completed age through which primary receives benefits (inclusive). */
  survivorPrimaryDeathAge?: number | null
  /** Completed age through which partner receives benefits (inclusive). */
  survivorPartnerDeathAge?: number | null
  endAge: number
  colaPercent: number
  discountPercent: number
}

export interface SsPersisted {
  version: 1
  form: SsFormSnapshot
  updatedAt: string
}

export function loadSs(): SsPersisted | null {
  try {
    const raw = readLocal(SS_STORAGE_KEY)
    if (!raw) return null
    return parseSsPersistedLoose(JSON.parse(raw) as unknown)
  } catch {
    return null
  }
}

export function saveSs(form: SsFormSnapshot): void {
  const data: SsPersisted = { version: 1, form, updatedAt: new Date().toISOString() }
  writeLocal(SS_STORAGE_KEY, JSON.stringify(data))
}
