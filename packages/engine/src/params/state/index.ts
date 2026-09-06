/**
 * Typed access to per-state tax packs. `stateParamsFor` resolves a year as:
 * the exact published pack when present; otherwise the latest pack for future
 * years (brackets left nominal, so state bracket creep is modeled); otherwise
 * the earliest published pack for every year before that earliest pack. There
 * is no supported-year guard and no validity marker — earlier years receive a
 * current-pack historical approximation, not enforcement of individual law
 * record `effectiveFrom` metadata. States with no entry return undefined —
 * the caller falls back to the flat effective-rate override.
 *
 * This no longer mirrors the federal engine, which now projects its
 * annually-indexed figures past the pack year (`indexFederalTaxPack`) because
 * IRC 1(j)(3)(B) and its siblings require it. Nothing equivalent is settled
 * for state BRACKETS: indexing them is a per-state question — some states
 * index, some fix them by statute, and several are on legislated rate ramps —
 * so holding them nominal stays the convention until each state's rule is
 * researched. It is a modeling gap, not a federal-law parallel.
 *
 * Borrowed federal standard-deduction components are the exception to nominal
 * pack-year brackets — see `conformStateStandardDeduction` for the two
 * independent adoption policies (whole-federal basic vs age-only addition).
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

/**
 * Tax parameters for a state in a year, or undefined if that state isn't modeled
 * yet. Year resolution follows the exact / latest / earliest pack convention
 * above with no supported-year guard or stand-in marker.
 */
export function stateParamsFor(code: string, year: number): StateTaxParams | undefined {
  return statesPackForYear(year).states[code.toUpperCase()]
}

/**
 * Resolve borrowed federal standard-deduction components onto a state pack for
 * the year being priced.
 *
 * Two independent adoption policies:
 *
 * - `standardDeductionConformity: 'federal'` — the pack's `standardDeduction`
 *   is the federal BASIC amount (eight packs: CO, DC, IA, ID, MO, MT, ND, NM;
 *   Arizona left that list on 2026-08-05). IRC 63(c)(7)(B)(ii) moves that
 *   amount after 2025, so the copy is scaled by the caller's inflation factor.
 *   Whole-federal adoption also implies the IRC 63(c)(3) age-65 addition,
 *   because 63(c)(1) makes "the standard deduction" the basic plus additional.
 * - `standardDeductionAge65AdditionConformity: 'federal'` — the state keeps its
 *   own published basic and adopts only the federal age-65 additional amount.
 *   Maine is the type case (36 M.R.S. §5124-C(1-B)). The basic is left alone;
 *   only the addition is attached and scaled.
 *
 * States that publish a fixed statutory age addition of their own carry it in the
 * pack instead; only a federally tagged value is attached and scaled here.
 *
 * When neither policy applies, params are returned unchanged. Blindness under
 * 63(f)(2) is not modeled. Nothing else in the pack is touched: not brackets,
 * and not retirement-exclusion caps.
 *
 * `inflationScale` is the caller's cumulative factor from the pack year — the
 * same guard as elsewhere: a non-finite or non-positive factor is ignored, and
 * a factor of exactly 1 leaves pack-year dollars untouched.
 */
export function conformStateStandardDeduction(
  params: StateTaxParams,
  federalAge65Addition: PerStatus<number>,
  inflationScale: number,
): StateTaxParams {
  const federalBasic = params.standardDeductionConformity === 'federal'
  const federalAdditional =
    federalBasic || params.standardDeductionAge65AdditionConformity === 'federal'
  if (!federalBasic && !federalAdditional) return params
  // Multiplying by exactly 1 is exact in IEEE-754, so a published year comes
  // through with its pack values untouched rather than needing a second branch.
  const scale = Number.isFinite(inflationScale) && inflationScale > 0 ? inflationScale : 1
  return {
    ...params,
    standardDeduction: federalBasic
      ? {
          single: params.standardDeduction.single * scale,
          marriedFilingJointly: params.standardDeduction.marriedFilingJointly * scale,
        }
      : params.standardDeduction,
    ...(federalAdditional
      ? {
          standardDeductionAge65Addition: {
            single: federalAge65Addition.single * scale,
            marriedFilingJointly: federalAge65Addition.marriedFilingJointly * scale,
          },
        }
      : {}),
  }
}

/** Two-letter codes with a modeled pack in the latest year (for UI hints). */
export function modeledStateCodes(): string[] {
  return Object.keys(packs[packs.length - 1]!.states).sort()
}

export type { StateTaxParams, StateTaxBracket, StateRetirementExclusion, StateTaxPack } from './types.js'
