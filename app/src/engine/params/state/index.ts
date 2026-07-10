/**
 * Typed access to per-state tax packs. Mirrors the federal `packForYear`
 * pattern: future years use the latest published pack (nominal brackets, so
 * bracket creep is modeled). States with no entry return undefined — the
 * caller falls back to the flat effective-rate override.
 */

import type { StateTaxPack, StateTaxParams } from './types'
import { stateYear2026 } from './data/year2026'

const packs: StateTaxPack[] = [stateYear2026]
// Keep sorted ascending by year as packs are added each fall.

export const LATEST_STATE_PACK_YEAR = packs[packs.length - 1]!.year

function statesPackForYear(year: number): StateTaxPack {
  const exact = packs.find((p) => p.year === year)
  if (exact) return exact
  if (year > LATEST_STATE_PACK_YEAR) return packs[packs.length - 1]!
  return packs[0]!
}

/** Tax parameters for a state in a year, or undefined if that state isn't modeled yet. */
export function stateParamsFor(code: string, year: number): StateTaxParams | undefined {
  return statesPackForYear(year).states[code.toUpperCase()]
}

/** Two-letter codes with a modeled pack in the latest year (for UI hints). */
export function modeledStateCodes(): string[] {
  return Object.keys(packs[packs.length - 1]!.states).sort()
}

export type { StateTaxParams, StateTaxBracket, StateRetirementExclusion, StateTaxPack } from './types'
