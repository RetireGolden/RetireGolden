import { readLocal, removeLocal, writeLocal } from '../data/localStore'
import { LONGEVITY_PARTNER_STORAGE_KEY, LONGEVITY_STORAGE_KEY } from './constants'
import { parseLongevityPersistedLoose } from './persistedGuard'
import type { LongevityPersisted, LongevityResult } from '@retiregolden/engine/longevity/types'

/**
 * The planning age a questionnaire result gives the plan: its illustrative
 * age, whole and within the plan's 60 to 120. Household's Calculate applies
 * it (planner/LongevityModal.tsx), and the Assumptions card matches a
 * questionnaire planning age to the saved result that gave it.
 */
export function questionnairePlanningAge(result: LongevityResult): number {
  return Math.min(120, Math.max(60, Math.round(result.illustrativePlanningAge)))
}

export function loadLongevity(): LongevityPersisted | null {
  try {
    const raw = readLocal(LONGEVITY_STORAGE_KEY)
    if (!raw) return null
    return parseLongevityPersistedLoose(JSON.parse(raw) as unknown)
  } catch {
    return null
  }
}

export function saveLongevity(data: LongevityPersisted): void {
  writeLocal(LONGEVITY_STORAGE_KEY, JSON.stringify(data))
}

export function clearLongevity(): void {
  removeLocal(LONGEVITY_STORAGE_KEY)
}

export function loadLongevityPartner(): LongevityPersisted | null {
  try {
    const raw = readLocal(LONGEVITY_PARTNER_STORAGE_KEY)
    if (!raw) return null
    return parseLongevityPersistedLoose(JSON.parse(raw) as unknown)
  } catch {
    return null
  }
}

export function saveLongevityPartner(data: LongevityPersisted): void {
  writeLocal(LONGEVITY_PARTNER_STORAGE_KEY, JSON.stringify(data))
}

export function clearLongevityPartner(): void {
  removeLocal(LONGEVITY_PARTNER_STORAGE_KEY)
}
