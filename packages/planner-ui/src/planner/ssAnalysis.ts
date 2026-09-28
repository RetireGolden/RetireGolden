/**
 * Social Security claiming analysis for the planner: the page's helpers
 * around the engine's models.
 *
 * Both layers are computed in the engine:
 *  - whole-plan sweep and its month refinement: every combination of claim
 *    ages run through the full deterministic projection, ranked by the chosen
 *    objective (@retiregolden/engine/decisions/claimAgeSweep);
 *  - benefits-only: mortality-weighted expected present value of the benefits
 *    alone, the actuarial lens
 *    (@retiregolden/engine/socialSecurity/analysis/expectedValue).
 *
 * @see DOCS/features/social-security.md
 */

import type { IncomeStream, Person, Plan } from '@retiregolden/engine/model/plan'
// The claimants module, not expectedValue: the Social Security step imports
// this file eagerly, and the models belong to the analysis page's own chunk.
import { benefitsOnlyClaimAges, socialSecurityClaimants } from '@retiregolden/engine/socialSecurity/analysis/claimants'
import {
  resolveStreamPiaMonthly,
  socialSecurityColaAssumptionPct,
  type PiaFromEarningsResult,
} from '@retiregolden/engine/socialSecurity/piaFromEarnings'
import { currentStartYear } from './useProjection'

type SsStream = Extract<IncomeStream, { type: 'socialSecurity' }>

export function dobParts(person: Person): { y: number; m: number; d: number } {
  return { y: Number(person.dob.slice(0, 4)), m: Number(person.dob.slice(5, 7)), d: Number(person.dob.slice(8, 10)) }
}

/**
 * Claim ages worth considering for a person: 62–70, but never earlier than the
 * age they have already reached (you can't claim in the past). Someone already
 * past 70 is left with 70. The engine's grid, which its benefits-only ranking
 * uses too.
 */
export function candidateClaimAges(person: Person, startYear: number): number[] {
  return benefitsOnlyClaimAges(person, startYear)
}

export function ssStreamFor(plan: Plan, personId: string): SsStream | undefined {
  return plan.incomes.find((s): s is SsStream => s.type === 'socialSecurity' && s.personId === personId)
}

/**
 * The projection's first year and the plan's COLA assumption: what brings an
 * earnings-derived PIA to the dollars of the year the ledger starts paying.
 */
export interface PiaAsOf {
  startYear: number
  colaAssumptionPct: number
}

export function piaAsOfPlan(plan: Plan, startYear: number = currentStartYear()): PiaAsOf {
  return { startYear, colaAssumptionPct: socialSecurityColaAssumptionPct(plan.assumptions) }
}

export interface ResolvedPia {
  /**
   * Monthly PIA as the projection pays it in its first year, or null if it
   * can't be resolved: an entered PIA as entered, and an earnings-derived PIA
   * raised by every cost-of-living increase from the eligibility year (the
   * year the person attains 62) through the year before the projection starts
   * (42 U.S.C. 415(i)(2)(A)(iii)). A person not yet eligible has no increase.
   */
  piaMonthly: number | null
  warning: string | null
  /**
   * Full earnings-mode computation detail (indexed years, projection, AIME),
   * when derived from earnings. Its `piaMonthly` is the eligibility-year PIA,
   * before the cost-of-living increases `piaMonthly` above includes.
   */
  detail: PiaFromEarningsResult | null
}

/**
 * A stream's PIA from the engine's one resolver
 * (socialSecurity/piaFromEarnings.ts#resolveStreamPiaMonthly, which the
 * projection and the claim-milestone insight call too): entered, or derived
 * from earnings and raised by the cost-of-living increases since eligibility
 * to the projection's first year, with the household step's warnings.
 */
export function resolvePia(person: Person, stream: SsStream, asOf: PiaAsOf): ResolvedPia {
  const resolved = resolveStreamPiaMonthly(stream, person, asOf)
  switch (resolved.status) {
    case 'entered':
      return { piaMonthly: resolved.piaMonthly, warning: null, detail: null }
    case 'noPiaNoEarnings':
      return { piaMonthly: null, warning: 'No PIA entered and no earnings history.', detail: null }
    case 'earningsError':
      return { piaMonthly: null, warning: `Earnings history could not be used (${resolved.error.code}).`, detail: null }
    case 'fromEarnings': {
      const warnings = [
        resolved.detail.usesStandInForFutureTables ? 'PIA uses stand-in SSA tables for years beyond published data.' : null,
        resolved.standInColaYears.length > 0
          ? `PIA uses the plan's COLA assumption for cost-of-living increases SSA has not yet announced (${resolved.standInColaYears.join(', ')}).`
          : null,
      ].filter((w): w is string => w !== null)
      return { piaMonthly: resolved.piaMonthly, warning: warnings.length > 0 ? warnings.join(' ') : null, detail: resolved.detail }
    }
  }
}

/**
 * People who have a Social Security stream with a resolvable benefit, each
 * with the PIA the projection starting in `startYear` pays from (the engine's
 * socialSecurityClaimants, which the benefits-only ranking reads too).
 */
export function claimingPeople(plan: Plan, startYear: number = currentStartYear()): { person: Person; stream: SsStream; pia: number }[] {
  return socialSecurityClaimants(plan, startYear).map(({ person, stream, piaMonthly }) => ({ person, stream, pia: piaMonthly }))
}

/**
 * The plan with each named person's Social Security claim set to a whole
 * year (the robustness check's and the bridge panel's variants).
 */
export function planWithClaimAges(plan: Plan, claimByPersonId: Readonly<Record<string, number>>): Plan {
  const next = structuredClone(plan)
  for (const stream of next.incomes) {
    if (stream.type === 'socialSecurity' && claimByPersonId[stream.personId] !== undefined) {
      stream.claimAge = { years: claimByPersonId[stream.personId]!, months: 0 }
    }
  }
  return next
}
