/**
 * Social Security claiming analysis for the planner.
 *
 * Two layers, mirroring the V5 plan:
 *  - whole-plan sweep: for every combination of claim ages, run the full
 *    deterministic projection and rank by ending after-tax estate (the choice
 *    interacts with taxes, Roth conversions, IRMAA, ACA, RMDs);
 *  - benefits-only: mortality-weighted expected present value of the benefits
 *    alone (socialSecurity/expectedPv), the actuarial lens.
 *
 * @see DOCS/features/social-security.md
 */

import type { IncomeStream, Person, Plan } from '@retiregolden/engine/model/plan'
import { summarizeProjection, type ProjectionSummary } from '@retiregolden/engine/projection/compare'
import { simulatePlan } from '@retiregolden/engine/projection/simulate'
import {
  createDecisionContext,
  evaluateCandidate,
  objectivePolicyForPlan,
  rankEvaluations,
  socialSecurityClaimGridGenerator,
  type ObjectivePolicyId,
} from '@retiregolden/engine/decisions'
import {
  expectedPvCouple,
  expectedPvSingle,
  type ClaimantInput,
} from '../socialSecurity/expectedPv'
import { spousalBenefitFactor } from '@retiregolden/engine/socialSecurity/claimFactor'
import { DIVORCED_MIN_MARRIAGE_YEARS } from '@retiregolden/engine/socialSecurity/maritalBenefits'
import {
  computePiaFromEarnings,
  isPiaFromEarningsError,
  piaInputFromEarnings,
  resolveEarningsProjection,
  type PiaFromEarningsResult,
} from '@retiregolden/engine/socialSecurity/piaFromEarnings'
import { currentStartYear, taxCalculatorFor } from './useProjection'

type SsStream = Extract<IncomeStream, { type: 'socialSecurity' }>

export const CLAIM_AGES = [62, 63, 64, 65, 66, 67, 68, 69, 70] as const

export function dobParts(person: Person): { y: number; m: number; d: number } {
  return { y: Number(person.dob.slice(0, 4)), m: Number(person.dob.slice(5, 7)), d: Number(person.dob.slice(8, 10)) }
}

/**
 * Claim ages worth considering for a person: 62–70, but never earlier than the
 * age they have already reached (you can't claim in the past). Someone already
 * past 70 is left with 70.
 */
export function candidateClaimAges(person: Person, startYear: number): number[] {
  const currentAge = startYear - dobParts(person).y
  const ages = CLAIM_AGES.filter((a) => a >= currentAge)
  return ages.length > 0 ? ages : [70]
}

export function ssStreamFor(plan: Plan, personId: string): SsStream | undefined {
  return plan.incomes.find((s): s is SsStream => s.type === 'socialSecurity' && s.personId === personId)
}

export interface ResolvedPia {
  /** Monthly PIA at FRA in today's dollars, or null if it can't be resolved. */
  piaMonthly: number | null
  warning: string | null
  /** Full earnings-mode computation detail (indexed years, projection, AIME), when derived from earnings. */
  detail: PiaFromEarningsResult | null
}

/** Resolve a stream's PIA the same way the engine does: entered, or derived from earnings. */
export function resolvePia(person: Person, stream: SsStream): ResolvedPia {
  if (stream.piaMonthly !== null) return { piaMonthly: stream.piaMonthly, warning: null, detail: null }
  if (!stream.earnings || stream.earnings.length === 0) {
    return { piaMonthly: null, warning: 'No PIA entered and no earnings history.', detail: null }
  }
  const { y, m, d } = dobParts(person)
  const projection = resolveEarningsProjection(stream.earningsProjection, person.retirementAge)
  const result = computePiaFromEarnings(piaInputFromEarnings(y, m, d, stream.earnings, projection))
  if (isPiaFromEarningsError(result)) {
    return { piaMonthly: null, warning: `Earnings history could not be used (${result.code}).`, detail: null }
  }
  return {
    piaMonthly: result.piaMonthly,
    warning: result.usesStandInForFutureTables ? 'PIA uses stand-in SSA tables for years beyond published data.' : null,
    detail: result,
  }
}

/** People who have a Social Security stream with a resolvable benefit. */
export function claimingPeople(plan: Plan): { person: Person; stream: SsStream; pia: number }[] {
  const out: { person: Person; stream: SsStream; pia: number }[] = []
  for (const person of plan.household.people) {
    const stream = ssStreamFor(plan, person.id)
    if (!stream) continue
    const { piaMonthly } = resolvePia(person, stream)
    if (piaMonthly !== null && piaMonthly > 0) out.push({ person, stream, pia: piaMonthly })
  }
  return out
}

// ---------------------------------------------------------------------------
// Whole-plan sweep
// ---------------------------------------------------------------------------

export interface SweepRow {
  /** Claim age (years) per claiming person, keyed by personId. */
  claimByPersonId: Record<string, number>
  summary: ProjectionSummary
  /** Objective-policy metric delta versus the current plan; higher is better. */
  primaryValue: number
  eligible: boolean
  lossReason: string | null
}

export interface SweepResult {
  /** personId order the grid axes follow (1 entry = single, 2 = couple). */
  personIds: string[]
  objectivePolicyId: ObjectivePolicyId
  primaryMetricLabel: string
  rows: SweepRow[]
  /** Rows sorted by the selected objective policy, descending. */
  ranked: SweepRow[]
}

export function planWithClaimAges(plan: Plan, claimByPersonId: Record<string, number>): Plan {
  const next = structuredClone(plan)
  for (const stream of next.incomes) {
    if (stream.type === 'socialSecurity' && claimByPersonId[stream.personId] !== undefined) {
      stream.claimAge = { years: claimByPersonId[stream.personId]!, months: 0 }
    }
  }
  return next
}

/**
 * Run the full projection for every claim-age combination (62–70 per claiming
 * person) and rank by ending after-tax estate. 9 runs single, 81 couple —
 * each ~a few ms, so this stays well under a frame budget on the main thread.
 */
export function sweepClaimingStrategies(
  plan: Plan,
  startYear = currentStartYear(),
  objectivePolicyId: ObjectivePolicyId = 'max-after-tax-estate',
): SweepResult {
  const people = claimingPeople(plan)
  const personIds = people.map((p) => p.person.id)
  const taxCalculator = taxCalculatorFor(plan)
  if (personIds.length === 0) {
    const policy = objectivePolicyForPlan(objectivePolicyId, plan)
    return { personIds, objectivePolicyId, primaryMetricLabel: policy.primaryMetricLabel, rows: [], ranked: [] }
  }

  const ctx = createDecisionContext(plan, { startYear, taxCalculator })
  const policy = objectivePolicyForPlan(objectivePolicyId, plan)
  const candidates = socialSecurityClaimGridGenerator.generate(ctx)
  const evaluations = candidates.map((candidate) => evaluateCandidate(ctx, candidate))
  const { ranked: rankedDecisions } = rankEvaluations(evaluations, ctx, policy, 0)

  const rowByCandidateId = new Map<string, SweepRow>()
  for (const row of rankedDecisions) {
    const claimByPersonId = row.evaluation.candidate.metadata?.['claimByPersonId']
    if (!claimByPersonId || typeof claimByPersonId !== 'object') continue
    const claim = claimByPersonId as Record<string, number>
    if (!personIds.every((id) => typeof claim[id] === 'number')) continue
    rowByCandidateId.set(row.evaluation.candidate.id, {
      claimByPersonId: Object.fromEntries(personIds.map((id) => [id, claim[id]!])),
      summary: row.evaluation.candidateSummary,
      primaryValue: row.primaryValue,
      eligible: row.eligible,
      lossReason: row.lossReason,
    })
  }

  const rows = candidates
    .map((candidate) => rowByCandidateId.get(candidate.id))
    .filter((row): row is SweepRow => row !== undefined)
  const ranked = rankedDecisions
    .map((row) => rowByCandidateId.get(row.evaluation.candidate.id))
    .filter((row): row is SweepRow => row !== undefined)
  return { personIds, objectivePolicyId, primaryMetricLabel: policy.primaryMetricLabel, rows, ranked }
}

// ---------------------------------------------------------------------------
// Monthly refinement around the best whole-year strategy
// ---------------------------------------------------------------------------

export interface MonthlyClaim {
  years: number
  months: number
}

export interface MonthlyRefinement {
  claimByPersonId: Record<string, MonthlyClaim>
  summary: ProjectionSummary
}

export function planWithClaimAgesMonthly(plan: Plan, claimByPersonId: Record<string, MonthlyClaim>): Plan {
  const next = structuredClone(plan)
  for (const stream of next.incomes) {
    if (stream.type === 'socialSecurity' && claimByPersonId[stream.personId] !== undefined) {
      stream.claimAge = { ...claimByPersonId[stream.personId]! }
    }
  }
  return next
}

/**
 * Second-pass monthly refinement: starting from the best whole-year strategy,
 * sweep each claiming person's claim age to the month within ±1 year (clamped to
 * 62y0m–70y0m and the current age) by coordinate ascent, keeping the best
 * after-tax estate. ~25 runs per person, so it stays on the main thread.
 */
export function refineClaimingMonthly(
  plan: Plan,
  baseClaimYears: Record<string, number>,
  startYear = currentStartYear(),
): MonthlyRefinement {
  const people = claimingPeople(plan)
  const taxCalculator = taxCalculatorFor(plan)
  const evaluate = (claim: Record<string, MonthlyClaim>): ProjectionSummary => {
    const candidate = planWithClaimAgesMonthly(plan, claim)
    return summarizeProjection(candidate, simulatePlan(candidate, { startYear, taxCalculator }))
  }

  let best: Record<string, MonthlyClaim> = {}
  for (const id of Object.keys(baseClaimYears)) best[id] = { years: baseClaimYears[id]!, months: 0 }
  let bestSummary = evaluate(best)

  for (const { person } of people) {
    const baseYear = best[person.id]!.years
    const currentAge = startYear - dobParts(person).y
    let localBest = best[person.id]!
    for (let yy = baseYear - 1; yy <= baseYear + 1; yy++) {
      if (yy < 62 || yy > 70 || yy < currentAge) continue
      const maxMonth = yy === 70 ? 0 : 11 // engine caps claim at 70y0m
      for (let mm = 0; mm <= maxMonth; mm++) {
        const summary = evaluate({ ...best, [person.id]: { years: yy, months: mm } })
        if (summary.endingAfterTaxEstate > bestSummary.endingAfterTaxEstate) {
          bestSummary = summary
          localBest = { years: yy, months: mm }
        }
      }
    }
    best = { ...best, [person.id]: localBest }
  }
  return { claimByPersonId: best, summary: bestSummary }
}

// ---------------------------------------------------------------------------
// Benefits-only (actuarial) ranking
// ---------------------------------------------------------------------------

export interface BenefitsPvRow {
  claimByPersonId: Record<string, number>
  expectedPv: number
}

function claimantInput(person: Person, pia: number, claimYears: number, startYear: number): ClaimantInput {
  const { y, m, d } = dobParts(person)
  return {
    currentAge: Math.max(0, startYear - y),
    dob: { year: y, month: m, day: d },
    sex: person.sex,
    piaMonthly: pia,
    claimAge: { years: claimYears, months: 0 },
  }
}

/**
 * Best divorced-spousal monthly benefit (0.5 × ex PIA, reduced for the claim age)
 * across eligible ex-spouses, for a currently-unmarried claimant. The actuarial
 * view assumes the ex is eligible; survivor benefits are handled separately by
 * the survivor-switching analysis.
 */
function divorcedSpousalFloorMonthly(person: Person, stream: SsStream, claimYears: number, householdSingle: boolean): number {
  if (!householdSingle) return 0
  const { y, m, d } = dobParts(person)
  let best = 0
  for (const r of stream.formerSpouses ?? []) {
    if (r.relationship !== 'divorced' || r.marriageYears < DIVORCED_MIN_MARRIAGE_YEARS) continue
    best = Math.max(best, 0.5 * r.piaMonthly * spousalBenefitFactor(y, m, d, { years: claimYears, months: 0 }))
  }
  return best
}

/**
 * Mortality-weighted expected PV of benefits for every claim-age combination,
 * ranked descending. Ignores the portfolio and taxes — the pure insurance view.
 */
export function benefitsOnlyRanking(plan: Plan, discountRate: number, startYear = currentStartYear()): {
  personIds: string[]
  rows: BenefitsPvRow[]
  ranked: BenefitsPvRow[]
} {
  const people = claimingPeople(plan)
  const personIds = people.map((p) => p.person.id)
  const householdSingle = plan.household.people.length === 1
  const rows: BenefitsPvRow[] = []

  if (people.length === 1) {
    const { person, pia, stream } = people[0]!
    for (const age of candidateClaimAges(person, startYear)) {
      const benefitFloorMonthly = divorcedSpousalFloorMonthly(person, stream, age, householdSingle)
      const pv = expectedPvSingle({ ...claimantInput(person, pia, age, startYear), benefitFloorMonthly }, { discountRate })
      rows.push({ claimByPersonId: { [person.id]: age }, expectedPv: pv })
    }
  } else if (people.length === 2) {
    const [a, b] = people
    for (const ageA of candidateClaimAges(a!.person, startYear)) {
      for (const ageB of candidateClaimAges(b!.person, startYear)) {
        const pv = expectedPvCouple(
          claimantInput(a!.person, a!.pia, ageA, startYear),
          claimantInput(b!.person, b!.pia, ageB, startYear),
          { discountRate },
        )
        rows.push({ claimByPersonId: { [a!.person.id]: ageA, [b!.person.id]: ageB }, expectedPv: pv })
      }
    }
  }

  const ranked = [...rows].sort((x, y) => y.expectedPv - x.expectedPv)
  return { personIds, rows, ranked }
}
