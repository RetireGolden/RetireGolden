/**
 * B2-P1 slice 5 parity on the 29 example plans: the Social Security page's
 * claim-age sweep and month refinement now come from the engine
 * (@retiregolden/engine/decisions/claimAgeSweep), and this pins, row by row,
 * what that changed and what it did not, against copies of the retired
 * planner-ui functions kept here (ssAnalysis.ts#sweepClaimingStrategies with
 * the grid generator it read, #refineClaimingMonthly and #sweepVerdict).
 *
 * - Every row the retired sweep priced is priced bit for bit the same, except
 *   the one row each of the two examples whose claims were made before 2026.
 * - The winner's change is Object.is the retired subtraction wherever the
 *   plan's claims are grid points; four bridge-durability changes are negative
 *   (the retired page printed "+−$Nk" in green) and four print as $0.
 * - 85 notes become the unpriced-credit refusal (17 examples x 5 rankings),
 *   and 10 become "already claimed".
 * - The refinement ranks on the chosen objective: 8 lines change and the
 *   already-claimed example's 3 go.
 *
 * @see DOCS/calculations/social-security/social-security-claim-age-sweep.md
 * @see DOCS/calculations/social-security/social-security-claim-age-monthly-refinement.md
 */
import { describe, expect, it } from 'vitest'

import type { IncomeStream, Plan } from '@retiregolden/engine/model/plan'
import {
  createDecisionContext,
  evaluateCandidate,
  objectivePolicyForPlan,
  rankEvaluations,
  type DecisionCandidate,
  type DecisionContext,
  type ObjectivePolicyId,
} from '@retiregolden/engine/decisions'
import { refineClaimAgeMonthly, sweepClaimAges, type ClaimAgeSweep, type ClaimAgeValue } from '@retiregolden/engine/decisions/claimAgeSweep'
import { summarizeProjection, type ProjectionSummary } from '@retiregolden/engine/projection/compare'
import { simulatePlan } from '@retiregolden/engine/projection/simulate'
import { EXAMPLE_PLANS } from './examples/registry'
import { demoPlanId } from './examples/loadExample'
import { fmtMoneyCompact } from './format'
import { claimingPeople } from './ssAnalysis'
import { taxCalculatorFor } from './useProjection'

const START = 2026
const OBJECTIVES: ObjectivePolicyId[] = [
  'max-after-tax-estate',
  'max-spending-durability',
  'min-lifetime-tax-estate-floor',
  'protect-survivor-liquidity',
  'bridge-durability',
]
type SsStream = Extract<IncomeStream, { type: 'socialSecurity' }>

// ---------------------------------------------------------------- the retired functions
/** The retired grid generator: no already-claimed test, and 70 alone for someone past every grid age. */
function retiredGrid(ctx: DecisionContext): DecisionCandidate[] {
  const entries = ctx.plan.incomes
    .filter((income): income is SsStream => income.type === 'socialSecurity')
    .filter((income) => (income.piaMonthly !== null && income.piaMonthly > 0) || (income.earnings?.length ?? 0) > 0)
    .slice(0, 2)
    .map((stream) => ({ stream, person: ctx.plan.household.people.find((p) => p.id === stream.personId)! }))
  if (entries.length === 0) return []
  let combos: Record<string, number>[] = [{}]
  for (const { person } of entries) {
    const currentAge = START - Number(person.dob.slice(0, 4))
    const ages = [62, 63, 64, 65, 66, 67, 68, 69, 70].filter((age) => age >= currentAge)
    const grid = ages.length > 0 ? ages : [70]
    combos = combos.flatMap((partial) => grid.map((age) => ({ ...partial, [person.id]: age })))
  }
  return combos.map((claimByPersonId) => ({
    id: `ss-claim-grid-${entries.map(({ person }) => `${person.id}-${claimByPersonId[person.id]}`).join('-')}`,
    source: 'scenario-sweep',
    category: 'social-security',
    label: 'retired grid',
    explanation: 'retired grid',
    planPatch: {
      incomes: ctx.plan.incomes.map((income) =>
        income.type === 'socialSecurity' && claimByPersonId[income.personId] !== undefined
          ? { ...income, claimAge: { years: claimByPersonId[income.personId]!, months: 0 } }
          : income,
      ),
    },
    metadata: { decisionRule: 'socialSecurityClaimGrid', claimByPersonId },
  }))
}

interface RetiredRow { claimByPersonId: Record<string, number>; summary: ProjectionSummary; primaryValue: number; eligible: boolean }

/** The retired sweep's ledger runs do not depend on the ranking, so each plan's are priced once. */
const retiredEvaluations = new Map<Plan, { ctx: DecisionContext; evaluations: ReturnType<typeof evaluateCandidate>[] }>()

function retiredSweep(plan: Plan, objectiveId: ObjectivePolicyId) {
  const personIds = claimingPeople(plan, START).map((p) => p.person.id)
  if (!retiredEvaluations.has(plan)) {
    const ctx = createDecisionContext(plan, { startYear: START, taxCalculator: taxCalculatorFor(plan) })
    retiredEvaluations.set(plan, { ctx, evaluations: retiredGrid(ctx).map((c) => evaluateCandidate(ctx, c)) })
  }
  const { ctx, evaluations } = retiredEvaluations.get(plan)!
  const { ranked, winner } = rankEvaluations(evaluations, ctx, objectivePolicyForPlan(objectiveId, plan), 0)
  const toRow = (r: (typeof ranked)[number]): RetiredRow => {
    const claim = r.evaluation.candidate.metadata!['claimByPersonId'] as Record<string, number>
    return { claimByPersonId: Object.fromEntries(personIds.map((id) => [id, claim[id]!])), summary: r.evaluation.candidateSummary, primaryValue: r.primaryValue, eligible: r.eligible }
  }
  const rows = ranked.map(toRow)
  const winnerRow = winner === null ? null : toRow(winner)
  // The retired #sweepVerdict and #objectiveIsFlat.
  const eligible = rows.filter((r) => r.eligible)
  const verdict =
    rows.length === 0 ? 'empty'
      : winnerRow ? 'winner'
        : eligible.length === 0 ? 'ineligible'
          : eligible.length >= 2 && eligible.every((r) => Math.abs(r.primaryValue - eligible[0]!.primaryValue) <= 0.5) ? 'flat'
            : 'current-best'
  const current: Record<string, number> = {}
  for (const s of plan.incomes) if (s.type === 'socialSecurity' && personIds.includes(s.personId)) current[s.personId] = s.claimAge.years
  const currentRow = rows.find((r) => personIds.every((id) => r.claimByPersonId[id] === current[id])) ?? null
  return { personIds, rows, winner: winnerRow, verdict, currentRow }
}

/** The retired refinement: coordinate ascent on the estate, whatever objective ranked the sweep. */
function retiredRefine(plan: Plan, base: Record<string, number>, personIds: string[]) {
  const taxCalculator = taxCalculatorFor(plan)
  const evaluate = (claim: Record<string, ClaimAgeValue>): ProjectionSummary => {
    const next = structuredClone(plan)
    for (const s of next.incomes) if (s.type === 'socialSecurity' && claim[s.personId] !== undefined) s.claimAge = { ...claim[s.personId]! }
    return summarizeProjection(next, simulatePlan(next, { startYear: START, taxCalculator }))
  }
  let best: Record<string, ClaimAgeValue> = Object.fromEntries(personIds.map((id) => [id, { years: base[id]!, months: 0 }]))
  let bestSummary = evaluate(best)
  for (const id of personIds) {
    const person = plan.household.people.find((p) => p.id === id)!
    const currentAge = START - Number(person.dob.slice(0, 4))
    const baseYear = best[id]!.years
    let localBest = best[id]!
    for (let yy = baseYear - 1; yy <= baseYear + 1; yy++) {
      if (yy < 62 || yy > 70 || yy < currentAge) continue
      for (let mm = 0; mm <= (yy === 70 ? 0 : 11); mm++) {
        const summary = evaluate({ ...best, [id]: { years: yy, months: mm } })
        if (summary.endingAfterTaxEstate > bestSummary.endingAfterTaxEstate) {
          bestSummary = summary
          localBest = { years: yy, months: mm }
        }
      }
    }
    best = { ...best, [id]: localBest }
  }
  return { claim: best, estate: bestSummary.endingAfterTaxEstate }
}

// ---------------------------------------------------------------- the page's display
const fmtClaim = (c: ClaimAgeValue) => (c.months > 0 ? `${c.years}y ${c.months}m` : `${c.years}`)
const claims = (c: Record<string, ClaimAgeValue>, ids: readonly string[]) => ids.map((id) => fmtClaim(c[id]!)).join(' / ')
/** The page's signed change: the sign of the printed magnitude. */
function signed(value: number): string {
  const printed = fmtMoneyCompact(Math.abs(value))
  if (printed === fmtMoneyCompact(0)) return printed
  return `${value > 0 ? '+' : '−'}${printed}`
}

const examples = EXAMPLE_PLANS.map((ex) => ({ id: ex.id, plan: { ...ex.build(), id: demoPlanId(ex.id), origin: 'example' as const, exampleSourceId: ex.id } }))
const offered = examples.filter(({ plan }) => claimingPeople(plan, START).length > 0)

const UNPRICED = [
  'aggressive-saver', 'all-401k-no-bridge', 'barista-fire', 'bridge-early-retirement', 'brokerage-bridge-401k', 'brokerage-no-hsa',
  'coast-fire', 'early-career-match', 'example-couple', 'fixed-target-spending', 'guardrails-flex-goals', 'hsa-property-depth',
  'hsa-stealth-retirement', 'lean-fat-fire', 'no-head-start-grad', 'salary-growth-escalation', 'trump-account-head-start',
]
const ALREADY_CLAIMED = ['bracket-fill-roth', 'rmd-irmaa']
const NEGATIVE = {
  'annuity-purchases-estate/bridge-durability': '−$16k',
  'no-annuity-brokerage/bridge-durability': '−$134k',
  'glidepath-allocation/bridge-durability': '−$146k',
  'static-allocation-control/bridge-durability': '−$178k',
}
const ZERO = [
  'survivor-years/max-spending-durability',
  'survivor-years/min-lifetime-tax-estate-floor',
  'under-saved-single/bridge-durability',
  'under-saved-single/min-lifetime-tax-estate-floor',
]
/** The refinement lines the objective-ranked refinement changes: retired, then new (claim, printed change, objective change). */
const REFINED: Record<string, { retired: string; now: string }> = {
  'under-saved-single/min-lifetime-tax-estate-floor': { retired: '65, whole-year pick', now: '64y 8m, $0, +$2,519' },
  'annuity-purchases-estate/min-lifetime-tax-estate-floor': { retired: '69y 6m / 66, +$27k', now: '68 / 66, whole-year pick' },
  'annuity-purchases-estate/protect-survivor-liquidity': { retired: '69y 6m / 66, +$4,545', now: '68y 6m / 66, −$7,535, +$2,758' },
  'annuity-purchases-estate/bridge-durability': { retired: '69y 8m / 65y 11m, +$45k', now: '70 / 64, whole-year pick' },
  'no-annuity-brokerage/protect-survivor-liquidity': { retired: '70 / 69y 4m, +$708', now: '70 / 69y 4m, +$708, +$578' },
  'no-annuity-brokerage/bridge-durability': { retired: '70 / 65y 11m, +$86k', now: '70 / 64, whole-year pick' },
  'glidepath-allocation/bridge-durability': { retired: '66y 9m, +$55k', now: '65, whole-year pick' },
  'static-allocation-control/bridge-durability': { retired: '66y 9m, +$85k', now: '65, whole-year pick' },
}

describe('B2-P1 slice 5: the claim-age sweep on the 29 example plans', () => {
  it('offers the tab on 25 examples', () => {
    expect(examples).toHaveLength(29)
    expect(offered).toHaveLength(25)
  })

  const sweeps = new Map<string, { sweep: ClaimAgeSweep; retired: ReturnType<typeof retiredSweep> }>()
  const sweepOf = (id: string, plan: Plan, objectiveId: ObjectivePolicyId) => {
    const key = `${id}/${objectiveId}`
    if (!sweeps.has(key)) {
      sweeps.set(key, {
        sweep: sweepClaimAges(plan, { startYear: START, taxCalculator: taxCalculatorFor(plan), objectivePolicyId: objectiveId }),
        retired: retiredSweep(plan, objectiveId),
      })
    }
    return sweeps.get(key)!
  }

  it.each(offered.map((e) => [e.id, e.plan] as const))('%s: prices every retired row bit for bit, and changes only the verdicts and signs the slice names', (id, plan) => {
    for (const objectiveId of OBJECTIVES) {
      const { sweep, retired } = sweepOf(id, plan, objectiveId)
      const pair = `${id}/${objectiveId}`
      if (ALREADY_CLAIMED.includes(id)) {
        // One grid row (70 for everyone past it), which re-made a claim already made.
        expect(retired.rows).toHaveLength(1)
        expect(sweep.verdict).toBe('already-claimed')
        expect(sweep.rows).toEqual([])
        continue
      }
      const byKey = new Map(sweep.rows.map((r) => [sweep.personIds.map((pid) => r.claimByPersonId[pid]).join('-'), r]))
      expect(sweep.rows).toHaveLength(retired.rows.length)
      for (const row of retired.rows) {
        const next = byKey.get(retired.personIds.map((pid) => row.claimByPersonId[pid]).join('-'))!
        expect(Object.is(next.endingAfterTaxEstate, row.summary.endingAfterTaxEstate), pair).toBe(true)
        expect(Object.is(next.lifetimeTaxesAndPenalties, row.summary.lifetimeTaxesAndPenalties), pair).toBe(true)
        expect(Object.is(next.primaryValue, row.primaryValue), pair).toBe(true)
        expect(next.eligible, pair).toBe(row.eligible)
      }
      expect(sweep.verdict, pair).toBe(UNPRICED.includes(id) ? 'aca-unpriced' : retired.verdict)
      if (UNPRICED.includes(id)) expect(retired.verdict, pair).toBe('ineligible')
      if (sweep.winner && retired.winner && retired.currentRow) {
        // The first figure: the retired subtraction, now published signed.
        expect(Object.is(sweep.winnerEstateChangeVsCurrent, retired.winner.summary.endingAfterTaxEstate - retired.currentRow.summary.endingAfterTaxEstate), pair).toBe(true)
        const printed = signed(sweep.winnerEstateChangeVsCurrent!)
        if (pair in NEGATIVE) expect(printed, pair).toBe(NEGATIVE[pair as keyof typeof NEGATIVE])
        else if (ZERO.includes(pair)) expect(printed, pair).toBe('$0')
        else expect(printed.startsWith('+'), `${pair} prints ${printed}`).toBe(true)
      }
    }
  }, 300_000)

  it('refines 8 pairs differently on the objective, the rest as before, and none for claims already made', () => {
    for (const { id, plan } of offered) {
      for (const objectiveId of OBJECTIVES) {
        const pair = `${id}/${objectiveId}`
        const { sweep, retired } = sweepOf(id, plan, objectiveId)
        if (ALREADY_CLAIMED.includes(id)) {
          expect(refineClaimAgeMonthly(plan, sweep, { startYear: START, taxCalculator: taxCalculatorFor(plan) })).toBeNull()
          continue
        }
        if (sweep.winner === null) continue
        const ids = [...sweep.personIds]
        const refined = refineClaimAgeMonthly(plan, sweep, { startYear: START, taxCalculator: taxCalculatorFor(plan) })!
        const now = refined.moved
          ? `${claims(refined.claimByPersonId, ids)}, ${signed(refined.estateChangeVsWinner)}${objectiveId !== 'max-after-tax-estate' ? `, ${signed(refined.primaryChangeVsWinner)}` : ''}`
          : `${claims(refined.claimByPersonId, ids)}, whole-year pick`
        const old = retiredRefine(plan, retired.winner!.claimByPersonId, retired.personIds)
        const oldLine = old.estate > retired.winner!.summary.endingAfterTaxEstate
          ? `${claims(old.claim, ids)}, +${fmtMoneyCompact(old.estate - retired.winner!.summary.endingAfterTaxEstate)}`
          : `${claims(old.claim, ids)}, whole-year pick`
        if (pair in REFINED) {
          expect(oldLine, pair).toBe(REFINED[pair]!.retired)
          expect(now, pair).toBe(REFINED[pair]!.now)
        } else {
          // Unchanged: the same claim and the same printed change as the retired estate climb.
          expect(now, pair).toBe(oldLine)
        }
      }
    }
  }, 600_000)
})
