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
 * One exception to the stand-in: a figure a state has already enacted,
 * unconditionally, for a year after the latest pack (`./data/enacted<year>.ts`).
 * For a year past the pack, every enacted year at or before it is applied in
 * order, each replacing the fields it names (a rate schedule, the standard
 * deduction, a retirement exclusion), so each field reads the latest step
 * enacted for it, carried forward nominally as a pack's would be. A field no
 * entry names still comes from the pack.
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
import type { StateEnactedFigures, StateEnactedYear, StateTaxPack, StateTaxParams } from './types.js'
import { stateYear2026 } from './data/year2026.js'
import { stateEnacted2027 } from './data/enacted2027.js'
import { stateEnacted2028 } from './data/enacted2028.js'
import { stateEnacted2029 } from './data/enacted2029.js'
import { stateEnacted2030 } from './data/enacted2030.js'
import { stateEnacted2031 } from './data/enacted2031.js'
import { stateEnacted2032 } from './data/enacted2032.js'
import { stateEnacted2033 } from './data/enacted2033.js'

const packs: StateTaxPack[] = [stateYear2026]
// Keep sorted ascending by year as packs are added each fall.

export const LATEST_STATE_PACK_YEAR = packs[packs.length - 1]!.year

/**
 * Figures enacted for years after the latest pack. Keep sorted ascending by year,
 * and retire a year once a pack for it is published: its figures then belong in
 * that pack, and an enacted year at or before the pack year is never read.
 */
export const STATE_ENACTED_YEARS: readonly StateEnactedYear[] = [
  stateEnacted2027,
  stateEnacted2028,
  stateEnacted2029,
  stateEnacted2030,
  stateEnacted2031,
  stateEnacted2032,
  stateEnacted2033,
]

function statesPackForYear(year: number): StateTaxPack {
  const exact = packs.find((p) => p.year === year)
  if (exact) return exact
  if (year > LATEST_STATE_PACK_YEAR) return packs[packs.length - 1]!
  return packs[0]!
}

/**
 * Every enacted year after `packYear` and at or before `year` that sets `code`,
 * ascending, so a later year's fields override an earlier year's.
 */
function enactedFor(code: string, packYear: number, year: number): StateEnactedYear[] {
  return STATE_ENACTED_YEARS.filter(
    (enacted) => enacted.year > packYear && enacted.year <= year && enacted.states[code] !== undefined,
  )
}

/**
 * The latest enacted year `stateParamsFor(code, year)` reads, or null when every
 * field comes from a pack (its own, or the latest standing in).
 */
export function stateEnactedYearFor(code: string, year: number): number | null {
  const upper = code.toUpperCase()
  return enactedFor(upper, statesPackForYear(year).year, year).at(-1)?.year ?? null
}

/**
 * Tax parameters for a state in a year, or undefined if that state isn't modeled
 * yet. Year resolution follows the exact / latest / earliest pack convention
 * above with no supported-year guard or stand-in marker, except that a year past
 * the pack takes every enacted year at or before it, in order: each field an
 * enacted entry names replaces the field (or, named as `null`, ends it), and a
 * field no entry names keeps the pack's.
 */
export function stateParamsFor(code: string, year: number): StateTaxParams | undefined {
  const upper = code.toUpperCase()
  const pack = statesPackForYear(year)
  const params = pack.states[upper]
  if (params === undefined) return undefined
  const enacted = enactedFor(upper, pack.year, year)
  if (enacted.length === 0) return params
  const resolved: Record<string, unknown> = { ...params }
  for (const entry of enacted) {
    const figures: StateEnactedFigures = entry.states[upper]!
    for (const [key, value] of Object.entries(figures)) {
      if (value === null) delete resolved[key]
      else resolved[key] = value
    }
  }
  return resolved as unknown as StateTaxParams
}

/**
 * Resolve borrowed federal standard-deduction components onto a state pack for
 * the year being priced.
 *
 * Two independent adoption policies:
 *
 * - `standardDeductionConformity: 'federal'` — the pack's `standardDeduction`
 *   is the federal BASIC amount (seven packs: CO, IA, ID, MO, MT, ND, NM, and DC from 2030;
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

export type {
  StateTaxParams,
  StateTaxBracket,
  StateRetirementExclusion,
  StateTaxPack,
  StateEnactedFigures,
  StateEnactedYear,
} from './types.js'
