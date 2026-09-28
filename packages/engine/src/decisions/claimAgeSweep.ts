/**
 * The Social Security page's whole-plan claim-age sweep and its month
 * refinement.
 *
 * The sweep runs every whole-year claim-age combination of the plan's open
 * claims (socialSecurity/openClaims.ts) through the full ledger with the plan's
 * own conversion strategy held fixed, ranks the rows by the chosen objective
 * policy (margin 0), and publishes the signed change in ending after-tax estate
 * of the winner against the plan as entered, claim months included. It
 * refuses, with the reason, when every claim was already made, when every open
 * claim is a disability benefit (a claim age does not start it; one beside an
 * ordinary claim is held as the ledger pays it and the other claim ranked), and
 * when the plan has a Marketplace year whose premium tax credit cannot be
 * priced (all Social Security counts in that credit's income in the years it
 * is paid, 26 U.S.C. 36B(d)(2)(B)(iii), so an unpriced credit could change
 * which row comes out ahead, in either direction).
 *
 * The refinement starts from the winner and tries every month within a year of
 * it, one open claim at a time in household order, ranked on the same
 * objective: a month replaces the incumbent only when its row is eligible
 * under the objective's constraints and its primary metric is strictly
 * greater.
 *
 * It differs from the Optimize page's co-optimization
 * (projection/optimizePlan.ts#optimizePlanCoOptimizingClaimAge), which
 * re-optimizes conversions at 62, full retirement age and 70, one stream at a
 * time, ranks on the estate only and needs a $1,000 margin.
 *
 * @see DOCS/calculations/social-security/social-security-claim-age-sweep.md
 * @see DOCS/calculations/social-security/social-security-claim-age-monthly-refinement.md
 */
import type { Plan } from '../model/plan.js'
import type { AcaSupportCode } from '../projection/internal/types/aca.js'
import { isBlockingAcaSupportCode } from '../projection/internal/types/aca.js'
import type { ProjectionResult, TaxCalculator } from '../projection/types.js'
import { socialSecurityDobParts } from '../socialSecurity/annualTiming.js'
import {
  gridClaimAges,
  openClaims,
  type AlreadyClaimed,
  type ClaimAgeValue,
  type OpenClaim,
} from '../socialSecurity/openClaims.js'
import { createDecisionContext, evaluateCandidate } from './evaluateCandidate.js'
import { claimAgeGridClaims, socialSecurityClaimGridGenerator } from './generators.js'
import {
  objectivePolicyForPlan,
  rankedMetricBasis,
  type ObjectivePolicyId,
  type RankedMetricBasis,
} from './objectives.js'
import { rankEvaluations, type RankedDecision } from './tournament.js'
import type { DecisionCandidate, DecisionContext } from './types.js'

export type { AlreadyClaimed, ClaimAgeValue, OpenClaim } from '../socialSecurity/openClaims.js'

/** Half a unit of the objective metric (a dollar or a year): closer than this is the same score. */
export const CLAIM_AGE_SWEEP_FLAT_TOLERANCE = 0.5

/** A Marketplace year whose premium tax credit the ledger could not price, with its own reasons. */
export interface UnpricedAcaYear {
  readonly year: number
  /** The year's blocking support codes (informational codes left out). */
  readonly reasons: readonly AcaSupportCode[]
}

/**
 * The years of a projection whose premium tax credit could not be priced
 * (`aca.readiness` 'nonActionable'), each with its own blocking support codes,
 * ascending.
 */
export function unpricedAcaYears(result: ProjectionResult): UnpricedAcaYear[] {
  return result.years
    .filter((year) => year.aca?.readiness === 'nonActionable')
    .map((year) => ({ year: year.year, reasons: (year.aca?.supportCodes ?? []).filter(isBlockingAcaSupportCode) }))
}

export type ClaimAgeSweepVerdict =
  /** An eligible row strictly improves the objective on the plan as entered. */
  | 'winner'
  /** The plan's own claims lead: no eligible row improves the objective. */
  | 'current-best'
  /** At least two eligible rows, all within half a unit of the first. */
  | 'flat'
  /** No row meets the objective's constraints, for a reason other than an unpriced credit. */
  | 'ineligible'
  /** The plan has a Marketplace year whose credit cannot be priced, so no row is ranked. */
  | 'aca-unpriced'
  /** Every claim was made before the plan starts. */
  | 'already-claimed'
  /** An open claim is a disability benefit, which a claim age does not start. */
  | 'disability'
  /** The plan has no Social Security claim. */
  | 'empty'

export interface ClaimAgeSweepRow {
  /** Whole-year claim age per open claim's person. */
  readonly claimByPersonId: Readonly<Record<string, number>>
  readonly endingAfterTaxEstate: number
  readonly lifetimeTaxesAndPenalties: number
  readonly depletionYear: number | null
  /** The objective's primary metric against the plan as entered; higher is better. */
  readonly primaryValue: number
  /** What the primary metric measured for this row (bridge durability and survivor liquidity can fall back to the estate). */
  readonly rankedOn: RankedMetricBasis
  readonly eligible: boolean
  readonly lossReason: string | null
  /** This row's ending after-tax estate minus the plan's as entered; signed, nominal dollars of `estateYear`. */
  readonly estateChangeVsCurrent: number
  /** Every open claim of the plan is a whole year equal to this row's. */
  readonly isCurrent: boolean
}

export interface ClaimAgeSweep {
  readonly verdict: ClaimAgeSweepVerdict
  readonly objectivePolicyId: ObjectivePolicyId
  readonly primaryMetricLabel: string
  /** The open claims' people in household order: the heatmap's rows and columns. */
  readonly personIds: readonly string[]
  /** The whole-year ages swept for each open claim's person. */
  readonly agesByPersonId: Readonly<Record<string, readonly number[]>>
  /** Claims made before the plan starts, held at their own age in every row. */
  readonly alreadyClaimed: readonly AlreadyClaimed[]
  /**
   * Open claims whose benefit is paid as a disability benefit from its onset:
   * a claim age does not start it, so it is held as the ledger pays it and not
   * swept; the verdict is 'disability' when every open claim is one.
   */
  readonly disabilityPersonIds: readonly string[]
  /** Rows in grid order. */
  readonly rows: readonly ClaimAgeSweepRow[]
  /** Rows by the objective, best first (ineligible rows last). */
  readonly ranked: readonly ClaimAgeSweepRow[]
  readonly winner: ClaimAgeSweepRow | null
  /** The plan as entered: its open claims with their months, and its ending after-tax estate. */
  readonly current: { readonly claimByPersonId: Readonly<Record<string, ClaimAgeValue>>; readonly endingAfterTaxEstate: number } | null
  /** The winner's estate minus the plan's as entered; signed, unrounded, nominal dollars of `estateYear`. */
  readonly winnerEstateChangeVsCurrent: number | null
  /** The plan's last projection year: the year whose dollars every estate figure is in. */
  readonly estateYear: number | null
  /** The plan's unpriced credit years, each with its reasons; non-empty whenever the verdict is 'aca-unpriced'. */
  readonly unpricedAca: readonly UnpricedAcaYear[]
}

export interface ClaimAgeSweepOptions {
  readonly startYear: number
  readonly taxCalculator: TaxCalculator
  readonly objectivePolicyId: ObjectivePolicyId
}

function rowFrom(
  ranked: RankedDecision,
  ctx: DecisionContext,
  policyId: ObjectivePolicyId,
  personIds: readonly string[],
  current: Readonly<Record<string, ClaimAgeValue>>,
): ClaimAgeSweepRow {
  const claim = ranked.evaluation.candidate.metadata?.['claimByPersonId'] as Record<string, number>
  const claimByPersonId = Object.fromEntries(personIds.map((id) => [id, claim[id]!]))
  return {
    claimByPersonId,
    endingAfterTaxEstate: ranked.evaluation.candidateSummary.endingAfterTaxEstate,
    lifetimeTaxesAndPenalties: ranked.evaluation.candidateSummary.lifetimeTaxesAndPenalties,
    depletionYear: ranked.evaluation.candidateSummary.depletionYear,
    primaryValue: ranked.primaryValue,
    rankedOn: rankedMetricBasis(policyId, ranked.evaluation, ctx),
    eligible: ranked.eligible,
    lossReason: ranked.lossReason,
    estateChangeVsCurrent: ranked.evaluation.deltas.endingAfterTaxEstate,
    isCurrent: personIds.every((id) => current[id]!.months === 0 && current[id]!.years === claimByPersonId[id]),
  }
}

function refused(
  verdict: 'already-claimed' | 'disability' | 'empty',
  policy: { id: ObjectivePolicyId; primaryMetricLabel: string },
  claims: { open: readonly OpenClaim[]; alreadyClaimed: readonly AlreadyClaimed[] },
  disabilityPersonIds: readonly string[],
): ClaimAgeSweep {
  return {
    verdict,
    objectivePolicyId: policy.id,
    primaryMetricLabel: policy.primaryMetricLabel,
    personIds: claims.open.map((claim) => claim.personId),
    agesByPersonId: {},
    alreadyClaimed: claims.alreadyClaimed,
    disabilityPersonIds,
    rows: [],
    ranked: [],
    winner: null,
    current: null,
    winnerEstateChangeVsCurrent: null,
    estateYear: null,
    unpricedAca: [],
  }
}

/**
 * The verdict of a ranked sweep with open claims: 'winner' when the ranking
 * crowned an eligible row that strictly improves the objective (margin 0);
 * otherwise, when no row is eligible, 'aca-unpriced' if the plan has an
 * unpriced credit year and 'ineligible' if not; otherwise 'flat' when at least
 * two eligible rows all lie within half a unit of the first eligible one
 * (ranked order), and 'current-best' when they do not.
 */
export function claimAgeSweepVerdict(
  ranked: readonly { readonly eligible: boolean; readonly primaryValue: number }[],
  hasWinner: boolean,
  unpricedAcaYearCount: number,
): ClaimAgeSweepVerdict {
  if (hasWinner) return 'winner'
  const eligible = ranked.filter((row) => row.eligible)
  if (eligible.length === 0) return unpricedAcaYearCount > 0 ? 'aca-unpriced' : 'ineligible'
  const first = eligible[0]!.primaryValue
  return eligible.length >= 2 && eligible.every((row) => Math.abs(row.primaryValue - first) <= CLAIM_AGE_SWEEP_FLAT_TOLERANCE)
    ? 'flat'
    : 'current-best'
}

/**
 * Run the whole-year claim-age grid of the plan's open claims through the
 * ledger, rank it by the objective, and publish the verdict, the rows and the
 * winner's signed estate change against the plan as entered.
 */
export function sweepClaimAges(plan: Plan, options: ClaimAgeSweepOptions): ClaimAgeSweep {
  const { startYear, taxCalculator, objectivePolicyId } = options
  const policy = objectivePolicyForPlan(objectivePolicyId, plan)
  const claims = openClaims(plan, startYear)
  const people = new Map(plan.household.people.map((person) => [person.id, person]))
  const policyFacts = { id: objectivePolicyId, primaryMetricLabel: policy.primaryMetricLabel }
  if (claims.open.length === 0 && claims.alreadyClaimed.length === 0) return refused('empty', policyFacts, claims, [])
  if (claims.open.length === 0) return refused('already-claimed', policyFacts, claims, [])
  const swept = claimAgeGridClaims(plan, startYear)
  const disabilityPersonIds = claims.open
    .filter((claim) => !swept.some((s) => s.streamId === claim.streamId))
    .map((claim) => claim.personId)
  if (swept.length === 0) return refused('disability', policyFacts, claims, disabilityPersonIds)

  const personIds = swept.map((claim) => claim.personId)
  const current = Object.fromEntries(swept.map((claim) => [claim.personId, claim.claimAge]))
  const ctx = createDecisionContext(plan, { startYear, taxCalculator })
  const candidates = socialSecurityClaimGridGenerator.generate(ctx)
  const evaluations = candidates.map((candidate) => evaluateCandidate(ctx, candidate))
  const { ranked, winner } = rankEvaluations(evaluations, ctx, policy, 0)
  const byId = new Map(ranked.map((row) => [row.evaluation.candidate.id, rowFrom(row, ctx, objectivePolicyId, personIds, current)]))
  const rows = candidates.map((candidate) => byId.get(candidate.id)!)
  const rankedRows = ranked.map((row) => byId.get(row.evaluation.candidate.id)!)
  const winnerRow = winner === null ? null : byId.get(winner.evaluation.candidate.id)!
  const unpricedAca = unpricedAcaYears(ctx.baselineResult)
  const verdict = claimAgeSweepVerdict(rankedRows, winnerRow !== null, unpricedAca.length)
  return {
    verdict,
    objectivePolicyId,
    primaryMetricLabel: policy.primaryMetricLabel,
    personIds,
    agesByPersonId: Object.fromEntries(personIds.map((id) => [id, gridClaimAges(people.get(id)!, startYear)])),
    alreadyClaimed: claims.alreadyClaimed,
    disabilityPersonIds,
    rows,
    ranked: rankedRows,
    winner: winnerRow,
    current: { claimByPersonId: current, endingAfterTaxEstate: ctx.baselineSummary.endingAfterTaxEstate },
    winnerEstateChangeVsCurrent: winnerRow === null ? null : winnerRow.estateChangeVsCurrent,
    estateYear: ctx.baselineResult.endYear,
    unpricedAca,
  }
}

export interface ClaimAgeRefinement {
  /** The refined claim per open claim's person, with its months. */
  readonly claimByPersonId: Readonly<Record<string, ClaimAgeValue>>
  readonly endingAfterTaxEstate: number
  readonly primaryValue: number
  /** Whether any claim left the winner's whole year. */
  readonly moved: boolean
  /** The refined estate minus the winner's; signed, nominal dollars of the plan's last year. */
  readonly estateChangeVsWinner: number
  /** The refined primary metric minus the winner's (the objective's own units). */
  readonly primaryChangeVsWinner: number
  /** Ledger runs spent. */
  readonly evaluations: number
  /** Months that ranked higher on the metric but broke one of the objective's constraints, so were not taken. */
  readonly rejectedIneligibleBetter: number
}

function monthCandidate(plan: Plan, streamIdByPerson: ReadonlyMap<string, string>, claim: Readonly<Record<string, ClaimAgeValue>>): DecisionCandidate {
  const incomes = plan.incomes.map((income) => {
    if (income.type !== 'socialSecurity') return income
    const personId = [...streamIdByPerson].find(([, streamId]) => streamId === income.id)?.[0]
    return personId === undefined ? income : { ...income, claimAge: { years: claim[personId]!.years, months: claim[personId]!.months } }
  })
  const key = [...streamIdByPerson.keys()].map((id) => `${id}-${claim[id]!.years}-${claim[id]!.months}`).join('-')
  return {
    id: `ss-claim-month-${key}`,
    source: 'scenario-sweep',
    category: 'social-security',
    label: `Social Security claim ages to the month: ${key}`,
    explanation: 'Runs one month-level Social Security claim-age combination through the shared exact-ledger decision engine.',
    planPatch: { incomes },
    metadata: { decisionRule: 'socialSecurityClaimMonth' },
  }
}

/** One ranked month of the refinement: the objective's metric, its constraints, and the estate beside it. */
export interface ClaimMonthRow {
  readonly primaryValue: number
  readonly eligible: boolean
  readonly endingAfterTaxEstate: number
}

export interface ClaimMonthSearch {
  readonly claimByPersonId: Readonly<Record<string, ClaimAgeValue>>
  readonly row: ClaimMonthRow
  readonly moved: boolean
  readonly evaluations: number
  readonly rejectedIneligibleBetter: number
}

/**
 * The refinement's search, apart from the ledger: starting from the whole-year
 * pick and its ranked row, for each person in order, every claim from a year
 * below that person's pick to a year above it (62 to 70, none below the age
 * reached in the start year; 70 only at 70y0m, months 0 to 11 otherwise), with
 * the other people at the running best. A month replaces the incumbent only
 * when its row is eligible and its primary metric is strictly greater; a
 * greater but ineligible month is counted and rejected.
 */
export function refineClaimMonths(
  start: { readonly claimByPersonId: Readonly<Record<string, number>>; readonly row: ClaimMonthRow },
  people: readonly { readonly personId: string; readonly currentAge: number }[],
  rank: (claim: Readonly<Record<string, ClaimAgeValue>>) => ClaimMonthRow,
): ClaimMonthSearch {
  let best: Record<string, ClaimAgeValue> = Object.fromEntries(
    people.map(({ personId }) => [personId, { years: start.claimByPersonId[personId]!, months: 0 }]),
  )
  let bestRow = start.row
  let evaluations = 0
  let rejectedIneligibleBetter = 0
  for (const { personId, currentAge } of people) {
    const baseYears = best[personId]!.years
    let localBest = best[personId]!
    for (let years = baseYears - 1; years <= baseYears + 1; years++) {
      if (years < 62 || years > 70 || years < currentAge) continue
      const lastMonth = years === 70 ? 0 : 11
      for (let months = 0; months <= lastMonth; months++) {
        const row = rank({ ...best, [personId]: { years, months } })
        evaluations++
        if (!(row.primaryValue > bestRow.primaryValue)) continue
        if (!row.eligible) {
          rejectedIneligibleBetter++
          continue
        }
        bestRow = row
        localBest = { years, months }
      }
    }
    best = { ...best, [personId]: localBest }
  }
  const moved = people.some(({ personId }) => best[personId]!.years !== start.claimByPersonId[personId] || best[personId]!.months !== 0)
  return { claimByPersonId: best, row: bestRow, moved, evaluations, rejectedIneligibleBetter }
}

/**
 * Refine the sweep's winner to the month on the sweep's own objective
 * (#refineClaimMonths, each month priced through the same ledger, policy and
 * baseline as the sweep). Null when the sweep has no winner.
 */
export function refineClaimAgeMonthly(
  plan: Plan,
  sweep: ClaimAgeSweep,
  options: { readonly startYear: number; readonly taxCalculator: TaxCalculator },
): ClaimAgeRefinement | null {
  const winner = sweep.winner
  if (winner === null) return null
  const { startYear, taxCalculator } = options
  const policy = objectivePolicyForPlan(sweep.objectivePolicyId, plan)
  const claims = claimAgeGridClaims(plan, startYear)
  const streamIdByPerson = new Map(claims.map((claim) => [claim.personId, claim.streamId]))
  const people = new Map(plan.household.people.map((person) => [person.id, person]))
  const ctx = createDecisionContext(plan, { startYear, taxCalculator })
  const search = refineClaimMonths(
    { claimByPersonId: winner.claimByPersonId, row: winner },
    sweep.personIds.map((personId) => ({ personId, currentAge: startYear - socialSecurityDobParts(people.get(personId)!).y })),
    (claim) => {
      const row = rankEvaluations([evaluateCandidate(ctx, monthCandidate(plan, streamIdByPerson, claim))], ctx, policy, 0).ranked[0]!
      return { primaryValue: row.primaryValue, eligible: row.eligible, endingAfterTaxEstate: row.evaluation.candidateSummary.endingAfterTaxEstate }
    },
  )
  return {
    claimByPersonId: search.claimByPersonId,
    endingAfterTaxEstate: search.row.endingAfterTaxEstate,
    primaryValue: search.row.primaryValue,
    moved: search.moved,
    estateChangeVsWinner: search.row.endingAfterTaxEstate - winner.endingAfterTaxEstate,
    primaryChangeVsWinner: search.row.primaryValue - winner.primaryValue,
    evaluations: search.evaluations,
    rejectedIneligibleBetter: search.rejectedIneligibleBetter,
  }
}
