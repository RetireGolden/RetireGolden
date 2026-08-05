/**
 * Typed access to per-state tax packs. Future years use the latest published
 * pack with its brackets left nominal, so state bracket creep is modeled.
 * States with no entry return undefined — the caller falls back to the flat
 * effective-rate override.
 *
 * This no longer mirrors the federal engine, which now projects its
 * annually-indexed figures past the pack year (`indexFederalTaxPack`) because
 * IRC 1(j)(3)(B) and its siblings require it. Nothing equivalent is settled
 * for state BRACKETS: indexing them is a per-state question — some states
 * index, some fix them by statute, and several are on legislated rate ramps —
 * so holding them nominal stays the convention until each state's rule is
 * researched. It is a modeling gap, not a federal-law parallel.
 *
 * The standard deduction of a conforming state is the one exception, and it is
 * not a state-law question at all — see `conformStateStandardDeduction`.
 */

import type { PerStatus } from '../types.js'
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

/**
 * The FEDERAL standard deduction, carried forward inside the state pack for the
 * nine jurisdictions that define their own by reference to it, resolved to what
 * the federal figure actually is for the year being priced.
 *
 * Nine packs — AZ, CO, DC, IA, ID, MO, MT, ND, NM — do not carry a state figure
 * in `standardDeduction` at all. They carry a copy of the federal one, because
 * that is what their law points at (and, for CO and ND, because their brackets
 * run on federal taxable income and this field is what converts the engine's
 * gross base into it). Two things follow, and this function does both.
 *
 * FIRST, the copy has to move when the original moves. IRC 63(c)(7)(B)(ii)
 * increases the federal amount for every taxable year beginning after 2025, and
 * `indexFederalTaxPack` projects that increase onto years the pack only stands
 * in for. Leaving the copy at the pack year would put two different values on
 * one statutory amount inside a single projected year, and every dollar of the
 * widening gap would be taxed at the state's rate — an error that grows with
 * the horizon and that did not exist while both figures were frozen together.
 *
 * SECOND, the copy has to be the WHOLE federal standard deduction. IRC 63(c)(1)
 * defines "the standard deduction" as the basic standard deduction plus the
 * additional standard deduction, and 63(c)(3)/63(f)(1) is where the additional
 * amount for age 65 or older comes from. A state pointing at "the federal
 * standard deduction" is pointing at that sum. Five of the nine (CO, IA, ID,
 * MT, ND) start from federal TAXABLE income, which is already net of the whole
 * thing; MO adopts the allowable federal standard deduction by name; NM
 * excludes an amount equal to the deduction allowed by Section 63. Carrying
 * only the basic amount over-stated state tax for every 65-and-over household
 * in all nine, in every projected year — so `standardDeductionAge65Addition`
 * carries the per-person additional amount alongside.
 *
 * Neither is the per-state indexing question the brackets pose. Nothing here
 * decides how a state adjusts a figure of its own; it keeps a borrowed federal
 * figure equal to the federal figure. `standardDeductionConformity` marks
 * exactly which packs borrow it, so a state that decouples (ME and SC did for
 * 2026) simply loses the tag, keeps its own amount, and gets no age-65 addition
 * from here — its own law decides whether it has one.
 *
 * `inflationScale` is the caller's cumulative factor from the pack year, the
 * same one `computeFederalTax` hands `indexFederalTaxPack` — and the same
 * guard: a non-finite or non-positive factor is ignored, and a factor of
 * exactly 1 (what a year with its own published pack gets) leaves both amounts
 * at their pack values. A deflating factor carries them down for the reason it
 * carries the federal ones down. Nothing else in the pack is touched: not the
 * brackets, and not the retirement exclusion caps, which are state dollar
 * figures under state law.
 */
export function conformStateStandardDeduction(
  params: StateTaxParams,
  federalAge65Addition: PerStatus<number>,
  inflationScale: number,
): StateTaxParams {
  if (params.standardDeductionConformity !== 'federal') return params
  // Multiplying by exactly 1 is exact in IEEE-754, so a published year comes
  // through with its pack values untouched rather than needing a second branch.
  const scale = Number.isFinite(inflationScale) && inflationScale > 0 ? inflationScale : 1
  return {
    ...params,
    standardDeduction: {
      single: params.standardDeduction.single * scale,
      marriedFilingJointly: params.standardDeduction.marriedFilingJointly * scale,
    },
    standardDeductionAge65Addition: {
      single: federalAge65Addition.single * scale,
      marriedFilingJointly: federalAge65Addition.marriedFilingJointly * scale,
    },
  }
}

/** Two-letter codes with a modeled pack in the latest year (for UI hints). */
export function modeledStateCodes(): string[] {
  return Object.keys(packs[packs.length - 1]!.states).sort()
}

export type { StateTaxParams, StateTaxBracket, StateRetirementExclusion, StateTaxPack } from './types.js'
