/**
 * Covers the optimize worker's shared runner (also the sync fallback used when
 * Worker is unavailable, e.g. here in vitest). Confirms it builds the standard
 * tax stack from the plan and returns a solved schedule — the seam the worker
 * and the UI both go through.
 */

import { describe, expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Account, type IncomeStream, type Plan } from '@retiregolden/engine/model/plan'
import { simulatePlan } from '@retiregolden/engine/projection/simulate'
import { combineTaxCalculators, createFederalTaxCalculator } from '@retiregolden/engine/tax/federalTax'
import { createStateTaxCalculator } from '@retiregolden/engine/tax/stateTax'
import { socialSecurityIncome } from '@retiregolden/engine/testing/planFixtures'
import { buildEarlyRetireeAca } from '../planner/examples/buildEarlyRetireeAca'
import { runOptimizeRequest } from './runOptimize'

let counter = 0
const ids = () => `ro-${++counter}`

function plan(): Plan {
  const p = createEmptyPlan({ newId: ids, now: () => new Date('2026-06-11T00:00:00.000Z') })
  p.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1958-06-15',
    sex: 'average',
    retirementAge: 65,
    longevity: { planningAge: 82, source: 'manual' },
  }
  p.assumptions.inflationPct = 0
  p.assumptions.defaultReturnPct = 4
  p.assumptions.stateEffectiveTaxPct = 0
  p.expenses.baseAnnual = 40_000
  p.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
  p.accounts = [
    { type: 'traditional', id: ids(), name: '401k', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 700_000, annualContribution: 0 } as Account,
    { type: 'roth', id: ids(), name: 'Roth', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 0, annualContribution: 0 } as Account,
    { type: 'cash', id: ids(), name: 'Cash', ownerPersonId: null, annualReturnPct: null, balance: 120_000, annualContribution: 0 } as Account,
  ]
  const r = parsePlan(p)
  if (!r.ok) throw new Error(r.issues.join('; '))
  return r.plan
}

/** Younger retiree claiming SS at 62 — gives the claim grid real candidates (67, 70). */
function ssPlan(): Plan {
  const p = createEmptyPlan({ newId: ids, now: () => new Date('2026-06-11T00:00:00.000Z') })
  p.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1964-01-01',
    sex: 'average',
    retirementAge: 62,
    longevity: { planningAge: 88, source: 'manual' },
  }
  p.assumptions.inflationPct = 0
  p.assumptions.defaultReturnPct = 4
  p.assumptions.stateEffectiveTaxPct = 0
  p.expenses.baseAnnual = 40_000
  p.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
  p.incomes = [socialSecurityIncome('ss', 2_400, 62)]
  p.accounts = [
    { type: 'traditional', id: ids(), name: 'IRA', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 700_000, annualContribution: 0 } as Account,
    { type: 'roth', id: ids(), name: 'Roth', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 0, annualContribution: 0 } as Account,
    { type: 'cash', id: ids(), name: 'Cash', ownerPersonId: null, annualReturnPct: null, balance: 250_000, annualContribution: 0 } as Account,
  ]
  const r = parsePlan(p)
  if (!r.ok) throw new Error(r.issues.join('; '))
  return r.plan
}

describe('runOptimizeRequest', () => {
  // This is a production-default search plus exact-ledger post-processing;
  // coverage instrumentation can legitimately exceed Vitest's 5s default.
  it('solves a plan and returns exact-ledger post-processing (sync fallback)', async () => {
    const result = await runOptimizeRequest({ plan: plan(), startYear: 2026, liquidationRatePct: 25 })
    const { schedule, postProcessed } = result

    expect(schedule.status).toBe('optimal')
    expect(schedule.conversions.reduce((a, c) => a + c.amount, 0)).toBeGreaterThan(0)
    expect(schedule.solveMs).toBeGreaterThanOrEqual(0)
    expect(postProcessed).not.toBeNull()
    expect(postProcessed?.rawSchedule).toEqual(schedule)
    expect(postProcessed?.cleanedSchedule.conversions.reduce((a, c) => a + c.amount, 0)).toBeGreaterThan(0)
    expect(postProcessed?.cleanedValidation.executedConversionRatio).toBeGreaterThan(0)
    expect(postProcessed?.cleanedExecutionByYear.length).toBeGreaterThan(0)
    expect(postProcessed?.minimumRequestedConversionDollars).toBeGreaterThan(0)
    expect(postProcessed).not.toHaveProperty('rawResult')
    expect(postProcessed).not.toHaveProperty('cleanedResult')

    // The tournament rides along and must be structured-clone safe: summaries
    // and schedules only, never a ProjectionResult.
    const { tournament } = result
    expect(tournament.candidates.length).toBeGreaterThan(0)
    expect(['milp', 'candidate', 'incumbent', 'none']).toContain(tournament.winnerSource)
    expect(Array.isArray(tournament.winnerConversions)).toBe(true)
    expect(tournament).not.toHaveProperty('result')
    expect(tournament.retirementActionReadinessVeto).not.toBeNull()
    expect(tournament.retirementActionReadinessVeto).not.toHaveProperty('vetoedResult')
    expect(() => structuredClone(tournament)).not.toThrow()

    // Claim-age co-optimization is opt-in; a plain request reports null.
    expect(result.claimAge).toBeNull()
  }, 20_000)

  it('co-optimizes the SS claim age when requested and stays structured-clone safe', async () => {
    // Minimal per-run budgets: the claim grid re-runs the full optimize per
    // candidate, so this keeps the test to three cheap solves.
    const result = await runOptimizeRequest({
      plan: ssPlan(),
      startYear: 2026,
      liquidationRatePct: 25,
      coOptimizeClaimAge: true,
      searchSimulationBudget: 0,
      convergenceIterations: 1,
    })

    const claimAge = result.claimAge
    expect(claimAge).not.toBeNull()
    expect(claimAge!.enabled).toBe(true)
    // Current claim 62 → canonical candidates 67 and 70, plus the base run.
    expect(claimAge!.combinationsEvaluated).toBe(3)
    // The joint optimum can never lose to the current-claim floor it's gated on.
    expect(claimAge!.jointExactEstate).toBeGreaterThanOrEqual(claimAge!.currentClaimExactEstate)
    // Label and patch travel together: both null (current claim won) or both set.
    expect(claimAge!.winningClaimPatch === null).toBe(claimAge!.winningClaimLabel === null)
    if (claimAge!.winningClaimPatch) {
      const ss = claimAge!.winningClaimPatch.incomes.find(
        (s): s is Extract<IncomeStream, { type: 'socialSecurity' }> => s.type === 'socialSecurity',
      )
      expect(ss).toBeDefined()
      expect(ss!.claimAge.years).not.toBe(62)
    }
    // The whole result must survive the worker's structured-clone boundary.
    expect(() => structuredClone(result)).not.toThrow()
  })

  it('reports the ACA actionability veto end to end while the example has non-actionable ACA years', async () => {
    // The curated early-retiree ACA example keeps marketplace coverage through
    // 2028 (Casey turns 65 in 2029), but only years with a sourced tax
    // parameter pack are ACA-actionable — later ACA years run on a stand-in
    // pack and report `tax-year-parameters-unsupported`. The decision doctrine
    // (DOCS/domain/domain-rules-reference.md) then refuses to present ANY
    // conversion schedule as executable: the exact ledger cannot price how a
    // candidate's extra pre-65 MAGI would erode the ACA credit in those years,
    // so a candidate's raw estate delta is ACA-blind and is not evidence to
    // act on.
    //
    // Retargeted 2026-08-03 for the IRC 1(j)(3)(B) indexing correction, and
    // NOT by relaxing a threshold. This test used to assert that `bracket-10`
    // beat the incumbent by more than the $1k switch margin, so that holding
    // the incumbent demonstrably cost the household something the veto was
    // choosing to forgo. That premise is gone: this example's own strategy IS
    // fill-to-the-10%-bracket, and once the bracket bound is indexed the
    // incumbent ladder widens every projected year and captures the benefit
    // itself. All twelve candidates now come in BELOW the incumbent
    // (bracket-10 at -2,805 on a ~539k estate, the rest far worse), so there is
    // no tempting row left on this plan and `vetoedCandidateIds` is correctly
    // empty. Re-tuning the example to manufacture one back would be the tail
    // wagging the dog — it was deliberately retuned 2026-07-30 for its ACA
    // credit story.
    //
    // What this test still earns is the end-to-end wiring: the veto object is
    // built, names the unpriceable years, carries its support code, and
    // survives the worker's structured-clone boundary. The blocking arithmetic
    // itself — a non-empty `vetoedCandidateIds` suppressing positive rows — is
    // unit-tested directly against `buildAcaActionabilityVeto` in
    // packages/engine/src/projection/optimizePlan.test.ts, and the UI copy for
    // a non-empty list in acaVetoCopy.test.ts and explainPanels.test.tsx.
    //
    // If the sourced-pack premise below ever fails (packs published through
    // every ACA year of the example), the veto legitimately lifts and the
    // winner assertions should be revisited rather than patched around.
    const plan = buildEarlyRetireeAca()
    // Minimal budgets: the veto fires before search runs and nulls whatever
    // the convergence loop would re-solve, so production budgets only add
    // MILP solve time without changing the pinned behavior.
    const result = await runOptimizeRequest({
      plan,
      startYear: 2026,
      liquidationRatePct: 22,
      searchSimulationBudget: 0,
      convergenceIterations: 1,
    })

    const bracket10 = result.tournament.candidates.find((c) => c.id === 'bracket-10')
    expect(bracket10).toBeDefined()
    // Post-indexing the incumbent dominates the whole field, so the winner is
    // the incumbent on merit as well as by veto. Pin that it is not a near-miss
    // the veto is quietly overriding: every candidate is genuinely below it.
    expect(result.tournament.candidates.length).toBeGreaterThan(0)
    for (const c of result.tournament.candidates) {
      expect(c.afterTaxEstateDelta).toBeLessThan(0)
    }
    expect(result.tournament.winnerSource).toBe('incumbent')
    expect(result.tournament.winnerLabel).toBe('your current conversion strategy')

    // The fallback explains itself: the veto diagnostic names the years the
    // exact ledger could not price and flags every positive-delta row it
    // blocked, so the UI never shows "no change recommended" beside an
    // unexplained positive number.
    const veto = result.tournament.acaActionabilityVeto
    expect(veto).not.toBeNull()
    expect(veto!.baselineNonActionableYears.length).toBeGreaterThan(0)
    expect(veto!.supportCodes).toContain('tax-year-parameters-unsupported')
    // The invariant that survives regardless of which rows are tempting: the
    // vetoed set is exactly the positive-delta set. It is empty here, and it
    // must stay in lockstep if a candidate ever turns positive again.
    expect(veto!.vetoedCandidateIds).toEqual(
      result.tournament.candidates.filter((c) => c.afterTaxEstateDelta > 1).map((c) => c.id),
    )
    // The diagnostic crosses the worker's structured-clone boundary intact.
    expect(() => structuredClone(result)).not.toThrow()

    // The veto's trigger: baseline ACA years past the sourced-pack horizon.
    const taxCalculator = combineTaxCalculators(
      createFederalTaxCalculator(),
      createStateTaxCalculator({
        overridePct: plan.assumptions.stateEffectiveTaxPct,
        localPct: plan.assumptions.localIncomeTaxPct,
      }),
    )
    const baseline = simulatePlan(plan, { startYear: 2026, taxCalculator })
    const acaYears = baseline.years.filter((y) => y.aca)
    expect(acaYears.length).toBeGreaterThan(0)
    expect(
      acaYears.some(
        (y) =>
          y.aca!.readiness === 'nonActionable' && y.aca!.supportCodes.includes('tax-year-parameters-unsupported'),
      ),
    ).toBe(true)
  })

  it('treats a non-positive search budget as search disabled', async () => {
    const result = await runOptimizeRequest({
      plan: plan(),
      startYear: 2026,
      liquidationRatePct: 25,
      searchSimulationBudget: 0,
    })
    // Zero budget must not spend even the seed evaluation.
    expect(result.tournament.searchSimulations).toBe(0)
    expect(result.tournament.searchRefined).toBe(false)
  })
})
