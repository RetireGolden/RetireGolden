/**
 * Typed access to per-state tax packs. Future years use the latest published
 * pack with its brackets left nominal, so state bracket creep is modeled.
 * States with no entry return undefined — the caller falls back to the flat
 * effective-rate override.
 *
 * This no longer mirrors the federal engine, which now projects its
 * annually-indexed figures past the pack year (`indexFederalTaxPack`) because
 * IRC 1(j)(3)(B) and its siblings require it. Nothing equivalent is settled
 * here: indexing is a per-state question — some states index their brackets,
 * some fix them by statute, and several are on legislated rate ramps — so
 * holding them nominal stays the convention until each state's rule is
 * researched. It is a modeling gap, not a federal-law parallel.
 */

import type { StateTaxPack, StateTaxParams } from './types.js'
import { stateYear2026 } from './data/year2026.js'

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

export type { StateTaxParams, StateTaxBracket, StateRetirementExclusion, StateTaxPack } from './types.js'
