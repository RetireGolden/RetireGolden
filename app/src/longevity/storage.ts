import { readLocal, removeLocal, writeLocal } from '../data/localStore'
import { LONGEVITY_PARTNER_STORAGE_KEY, LONGEVITY_STORAGE_KEY } from './constants'
import { parseLongevityPersistedLoose } from './persistedGuard'
import type { LongevityPersisted } from './types'

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
