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
import { claimFactor } from '@retiregolden/engine/socialSecurity/claimFactor'
import {
  divorcedExFirstMonthIndex,
  spouseDualEntitlementMonthly,
  spouseEntitlementAgeMonths,
  spouseReductionFactorAtAgeMonths,
} from '@retiregolden/engine/socialSecurity/dualEntitlement'
import { DIVORCED_MIN_MARRIAGE_YEARS } from '@retiregolden/engine/socialSecurity/maritalBenefits'
import {
  computePiaFromEarnings,
  isPiaFromEarningsError,
  piaInputFromEarnings,
  piaWithCostOfLivingIncreases,
  resolveEarningsProjection,
  socialSecurityColaAssumptionPct,
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
 * Resolve a stream's PIA the same way the projection does
 * (projection/simulate.ts, the resolved-PIA loop): entered, or derived from
 * earnings and raised by the cost-of-living increases since eligibility to the
 * projection's first year, so the analysis page's models and the household
 * step show the amount the ledger pays from.
 */
export function resolvePia(person: Person, stream: SsStream, asOf: PiaAsOf): ResolvedPia {
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
  const atStart = piaWithCostOfLivingIncreases(result.piaMonthly, result.eligibilityYear, asOf.startYear - 1, asOf.colaAssumptionPct)
  const warnings = [
    result.usesStandInForFutureTables ? 'PIA uses stand-in SSA tables for years beyond published data.' : null,
    atStart.standInYears.length > 0
      ? `PIA uses the plan's COLA assumption for cost-of-living increases SSA has not yet announced (${atStart.standInYears.join(', ')}).`
      : null,
  ].filter((w): w is string => w !== null)
  return {
    piaMonthly: atStart.piaMonthly,
    warning: warnings.length > 0 ? warnings.join(' ') : null,
    detail: result,
  }
}

/**
 * People who have a Social Security stream with a resolvable benefit, each
 * with the PIA the projection starting in `startYear` pays from.
 */
export function claimingPeople(plan: Plan, startYear: number = currentStartYear()): { person: Person; stream: SsStream; pia: number }[] {
  const out: { person: Person; stream: SsStream; pia: number }[] = []
  const asOf = piaAsOfPlan(plan, startYear)
  for (const person of plan.household.people) {
    const stream = ssStreamFor(plan, person.id)
    if (!stream) continue
    const { piaMonthly } = resolvePia(person, stream, asOf)
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
  /**
   * The engine's pick: the first eligible row that strictly improves the
   * objective over the current claim, after tie-breakers. Null when nothing
   * does, which is the only state in which a claim age may be called best.
   */
  winner: SweepRow | null
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
 * Run the full projection for every claim-age combination (62-70 per claiming
 * person) and rank by ending after-tax estate: 9 evaluations for one claimer,
 * 81 for two.
 *
 * That is not a frame's worth of work. A two-person run of this module's own
 * test plan measured 139 ms, so the caller keeps it off the render path and
 * shows a loading state, the way the survivor-transition sweep does. The
 * comment here used to claim the opposite ("well under a frame budget on the
 * main thread"), which is how the page came to call it inside a `useMemo`.
 */
export function sweepClaimingStrategies(
  plan: Plan,
  startYear = currentStartYear(),
  objectivePolicyId: ObjectivePolicyId = 'max-after-tax-estate',
): SweepResult {
  const people = claimingPeople(plan, startYear)
  const personIds = people.map((p) => p.person.id)
  const taxCalculator = taxCalculatorFor(plan)
  if (personIds.length === 0) {
    const policy = objectivePolicyForPlan(objectivePolicyId, plan)
    return { personIds, objectivePolicyId, primaryMetricLabel: policy.primaryMetricLabel, rows: [], ranked: [], winner: null }
  }

  const ctx = createDecisionContext(plan, { startYear, taxCalculator })
  const policy = objectivePolicyForPlan(objectivePolicyId, plan)
  const candidates = socialSecurityClaimGridGenerator.generate(ctx)
  const evaluations = candidates.map((candidate) => evaluateCandidate(ctx, candidate))
  const { ranked: rankedDecisions, winner: winningDecision } = rankEvaluations(evaluations, ctx, policy, 0)

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
  const winner = winningDecision ? (rowByCandidateId.get(winningDecision.evaluation.candidate.id) ?? null) : null
  return { personIds, objectivePolicyId, primaryMetricLabel: policy.primaryMetricLabel, rows, ranked, winner }
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
  const people = claimingPeople(plan, startYear)
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
 * The monthly benefit a currently-unmarried claimant is paid on the best
 * divorced-spouse record, the ledger's dual-entitlement composition
 * (@retiregolden/engine socialSecurity/dualEntitlement.ts): the own benefit at
 * the claim age, held at the own PIA, plus half the ex's PIA less the own PIA,
 * reduced for the claimant's age in the first month of the spouse benefit (the
 * later of the own claim and the first month the ex is 62 throughout), and
 * never less than the own benefit. 0 when no ex meets the marriage-duration
 * gate or the household is a couple. Benefits-only is one amount for every year
 * from the claim, so it pays this from the claim age even when the ex is not
 * yet 62; the ledger (In your plan) waits for the year the spouse benefit
 * starts. Survivor benefits are handled by the survivor-switching analysis.
 */
export function divorcedSpouseTotalMonthly(
  person: Person,
  stream: SsStream,
  ownPiaMonthly: number,
  claimYears: number,
  householdSingle: boolean,
): number {
  if (!householdSingle) return 0
  const { y, m, d } = dobParts(person)
  const claimantDob = { year: y, month: m, day: d }
  const ownActualMonthly = ownPiaMonthly * claimFactor(y, m, d, { years: claimYears, months: 0 })
  let best = 0
  for (const r of stream.formerSpouses ?? []) {
    if (r.relationship !== 'divorced' || r.marriageYears < DIVORCED_MIN_MARRIAGE_YEARS) continue
    const exDob = { year: Number(r.dob.slice(0, 4)), month: Number(r.dob.slice(5, 7)), day: Number(r.dob.slice(8, 10)) }
    const spouseAgeMonths = spouseEntitlementAgeMonths(claimantDob, claimYears * 12, divorcedExFirstMonthIndex(exDob))
    best = Math.max(
      best,
      spouseDualEntitlementMonthly({
        ownPiaMonthly,
        ownActualMonthly,
        spouseBaseMonthly: 0.5 * r.piaMonthly,
        spouseFactor: spouseReductionFactorAtAgeMonths(claimantDob, spouseAgeMonths),
      }),
    )
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
  const people = claimingPeople(plan, startYear)
  const personIds = people.map((p) => p.person.id)
  const householdSingle = plan.household.people.length === 1
  const rows: BenefitsPvRow[] = []

  if (people.length === 1) {
    const { person, pia, stream } = people[0]!
    for (const age of candidateClaimAges(person, startYear)) {
      const benefitFloorMonthly = divorcedSpouseTotalMonthly(person, stream, pia, age, householdSingle)
      const pv = expectedPvSingle({ ...claimantInput(person, pia, age, startYear), benefitFloorMonthly }, { discountRate })
      rows.push({ claimByPersonId: { [person.id]: age }, expectedPv: pv })
    }
  } else if (people.length === 2) {
    const a = people[0]!
    const b = people[1]!
    for (const ageA of candidateClaimAges(a.person, startYear)) {
      for (const ageB of candidateClaimAges(b.person, startYear)) {
        const pv = expectedPvCouple(
          claimantInput(a.person, a.pia, ageA, startYear),
          claimantInput(b.person, b.pia, ageB, startYear),
          { discountRate },
        )
        rows.push({ claimByPersonId: { [a.person.id]: ageA, [b.person.id]: ageB }, expectedPv: pv })
      }
    }
  }

  const ranked = [...rows].sort((x, y) => y.expectedPv - x.expectedPv)
  return { personIds, rows, ranked }
}
/** Half a unit of the objective metric (a dollar or a year): closer than this is the same score. */
const FLAT_TOLERANCE = 0.5

/**
 * True when the selected objective scores every eligible candidate the same
 * (for example, every after-tax estate is $0 on a plan with no assets), so
 * no claim age can honestly be called best on it (#454). Ineligible rows are
 * ranked below the eligible ones and do not count.
 */
export function objectiveIsFlat(ranked: readonly SweepRow[]): boolean {
  const eligible = ranked.filter((row) => row.eligible)
  if (eligible.length < 2) return false
  const first = eligible[0]!.primaryValue
  return eligible.every((row) => Math.abs(row.primaryValue - first) <= FLAT_TOLERANCE)
}

export type SweepVerdict = 'winner' | 'flat' | 'current-best' | 'ineligible' | 'empty'

/**
 * What the page may say about the sweep. Only `winner` crowns a claim age:
 * the engine found an eligible row that strictly improves on the current
 * claim. The rest are notes: the objective cannot separate the candidates
 * (`flat`), the current claim already leads (`current-best`), nothing meets
 * the objective's constraints (`ineligible`), or nobody claims (`empty`).
 */
export function sweepVerdict(sweep: Pick<SweepResult, 'ranked' | 'winner'>): SweepVerdict {
  if (sweep.ranked.length === 0) return 'empty'
  if (sweep.winner) return 'winner'
  if (!sweep.ranked.some((row) => row.eligible)) return 'ineligible'
  return objectiveIsFlat(sweep.ranked) ? 'flat' : 'current-best'
}

