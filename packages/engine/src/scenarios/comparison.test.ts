import { describe, expect, it } from 'vitest'

import { asAccountId, asActionId, asAllocationId, asPersonId } from '../actions/identity.js'
import { asPositiveUsdCents } from '../actions/money.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { simulatePlan } from '../projection/simulate.js'
import { createFederalTaxCalculator } from '../tax/federalTax.js'
import {
  cashAccount,
  recurringOrdinaryIncome,
  setAcaYearContract,
  singlePersonPlan,
  socialSecurityIncome,
  taxableAccount,
  traditionalAccount,
  validatePlan,
} from '../testing/planFixtures.js'
import { compareScenarioPlans, compareScenarioSpendingCapacityResults } from './comparison.js'
import { scenarioPlanSnapshotHash } from './patch.js'

const federalTax = createFederalTaxCalculator()

const noTax = createFlatTaxCalculator(0)
const stochastic = {
  model: { type: 'lognormal' as const, inflationMeanPct: 0 },
  pathCount: 16,
  seed: 731,
}

function comparisonPlan() {
  const plan = singlePersonPlan({
    dob: '1960-01-01',
    planningAge: 75,
    retirementAge: 65,
  })
  plan.accounts = [cashAccount('cash', 600_000)]
  plan.incomes = [recurringOrdinaryIncome('income', 35_000)]
  plan.expenses.baseAnnual = 45_000
  return validatePlan(plan)
}

function classifiedInheritedComparisonPlan() {
  const plan = singlePersonPlan({
    dob: '1960-01-01',
    planningAge: 75,
    retirementAge: 65,
  })
  const inherited = traditionalAccount('inherited', 100_000)
  if (inherited.type !== 'traditional') throw new Error('fixture must be traditional')
  inherited.inherited = {
    ownerDeathYear: 2025,
    decedentHadStartedRmds: true,
    beneficiary: {
      beneficiaryClass: 'designated-individual',
      edbCategory: 'none',
      beneficiaryBirthYear: 1960,
      soleBeneficiary: true,
      ownerBirthYear: 1940,
      ownerYearOfDeathRmdSatisfied: true,
      provenance: { source: 'comparison-test', asOf: '2026-08-08' },
    },
  }
  plan.accounts = [inherited]
  return validatePlan(plan)
}

/** E8 shape: spending must draw beyond the annual inherited requirement. */
function voluntaryInheritedComparisonPlan() {
  const plan = structuredClone(classifiedInheritedComparisonPlan())
  plan.accounts.push(cashAccount('cash', 1))
  plan.expenses.baseAnnual = 100_000
  return validatePlan(plan)
}

function allDeltas(value: unknown): number[] {
  if (Array.isArray(value)) return value.flatMap(allDeltas)
  if (typeof value !== 'object' || value === null) return []
  return Object.entries(value).flatMap(([key, child]) =>
    key === 'delta' && typeof child === 'number' ? [child] : allDeltas(child),
  )
}

describe('compareScenarioPlans', () => {
  it('gives an identical deep-cloned plan exact +0 deltas without NaN and does not mutate either input', () => {
    const baseline = comparisonPlan()
    const proposal = structuredClone(baseline)
    const beforeBaseline = structuredClone(baseline)
    const beforeProposal = structuredClone(proposal)

    const result = compareScenarioPlans(baseline, proposal, {
      startYear: 2026,
      taxCalculatorForPlan: () => noTax,
      stochastic,
    })

    const deltas = allDeltas(result)
    expect(deltas.length).toBeGreaterThan(30)
    for (const delta of deltas) {
      expect(Number.isNaN(delta)).toBe(false)
      expect(delta).toBe(0)
      expect(Object.is(delta, -0)).toBe(false)
    }
    expect(baseline).toEqual(beforeBaseline)
    expect(proposal).toEqual(beforeProposal)
    expect(result.provenance.baselineSnapshotHash).toBe(scenarioPlanSnapshotHash(baseline))
    expect(result.provenance.proposalSnapshotHash).toBe(scenarioPlanSnapshotHash(proposal))
    expect(result.moneyBasis.deltaConvention).toBe('proposal-minus-baseline')
  })

  it('is byte-stable for repeated same-seed shared-path comparisons', () => {
    const baseline = comparisonPlan()
    const proposal = structuredClone(baseline)
    proposal.expenses.baseAnnual += 10_000
    const options = { startYear: 2026, taxCalculatorForPlan: () => noTax, stochastic }
    expect(compareScenarioPlans(baseline, proposal, options).risk).toEqual(
      compareScenarioPlans(baseline, proposal, options).risk,
    )
  })

  it('threads exact shared-path progress without adding callbacks to provenance', () => {
    const baseline = comparisonPlan()
    const proposal = structuredClone(baseline)
    proposal.expenses.baseAnnual += 10_000
    const seen: Array<[completed: number, total: number]> = []
    const result = compareScenarioPlans(baseline, proposal, {
      startYear: 2026,
      taxCalculatorForPlan: () => noTax,
      stochastic: {
        ...stochastic,
        pathCount: 3,
        onProgress: (completed, total) => seen.push([completed, total]),
      },
    })

    expect(seen).toEqual([
      [1, 6],
      [2, 6],
      [3, 6],
      [4, 6],
      [5, 6],
      [6, 6],
    ])
    expect(result.risk?.provenance).toEqual({
      seed: stochastic.seed,
      pathCount: 3,
      model: stochastic.model,
      stochasticLongevity: false,
      ltcShock: null,
    })
  })

  it('aggregates deterministic income, spending, withdrawals, and annual ledger rows consistently', () => {
    const baseline = comparisonPlan()
    const proposal = structuredClone(baseline)
    proposal.expenses.baseAnnual += 5_000
    const result = compareScenarioPlans(baseline, proposal, {
      startYear: 2026,
      taxCalculatorForPlan: () => noTax,
    })

    expect(result.income.total.baseline).toBe(
      result.annual.reduce((total, row) => total + (row.values.income.baseline ?? 0), 0),
    )
    expect(result.spending.intended.proposal).toBe(
      result.annual.reduce((total, row) => total + (row.values.spendingIntended.proposal ?? 0), 0),
    )
    expect(result.withdrawals.total.proposal).toBe(
      result.annual.reduce((total, row) => total + (row.values.withdrawals.proposal ?? 0), 0),
    )
    expect(result.spending.intended.delta).toBeGreaterThan(0)
  })

  it('reconciles inherited annual values and withdrawal totals to the simulated ledger', () => {
    const baseline = classifiedInheritedComparisonPlan()
    const proposal = structuredClone(baseline)
    const baselineLedger = simulatePlan(baseline, { startYear: 2026, taxCalculator: noTax })
    const proposalLedger = simulatePlan(proposal, { startYear: 2026, taxCalculator: noTax })
    const result = compareScenarioPlans(baseline, proposal, {
      startYear: 2026,
      taxCalculatorForPlan: () => noTax,
    })

    expect(
      baselineLedger.years.some((year) =>
        (year.inheritedAccounts ?? []).some((account) => account.classification === 'settled'),
      ),
    ).toBe(true)
    for (const row of result.annual) {
      const baselineYear = baselineLedger.years.find((year) => year.year === row.year)!
      const proposalYear = proposalLedger.years.find((year) => year.year === row.year)!
      expect(row.values.inheritedDistribution.baseline).toBe(baselineYear.inheritedDistribution)
      expect(row.values.inheritedDistribution.proposal).toBe(proposalYear.inheritedDistribution)
      expect(row.values.inheritedRequired.baseline).toBe(
        (baselineYear.inheritedAccounts ?? []).reduce(
          (total, account) => total + account.executedRequiredAmount,
          0,
        ),
      )
      expect(row.values.inheritedRequired.proposal).toBe(
        (proposalYear.inheritedAccounts ?? []).reduce(
          (total, account) => total + account.executedRequiredAmount,
          0,
        ),
      )
    }

    for (const side of ['baseline', 'proposal'] as const) {
      const ledger = side === 'baseline' ? baselineLedger : proposalLedger
      expect(result.withdrawals.inherited[side]).toBe(
        ledger.years.reduce((total, year) => total + year.inheritedDistribution, 0),
      )
      expect(result.withdrawals.inherited[side]).toBe(
        result.annual.reduce((total, row) => total + (row.values.inheritedDistribution[side] ?? 0), 0),
      )
    }
    expect(result.withdrawals.inherited.baseline).toBeGreaterThan(0)
  })

  it('reconciles E8-style inherited voluntary draws from annual evidence', () => {
    const baseline = voluntaryInheritedComparisonPlan()
    const proposal = structuredClone(baseline)
    const baselineLedger = simulatePlan(baseline, { startYear: 2026, taxCalculator: noTax })
    const proposalLedger = simulatePlan(proposal, { startYear: 2026, taxCalculator: noTax })
    const result = compareScenarioPlans(baseline, proposal, {
      startYear: 2026,
      taxCalculatorForPlan: () => noTax,
    })

    for (const row of result.annual) {
      const baselineYear = baselineLedger.years.find((year) => year.year === row.year)!
      const proposalYear = proposalLedger.years.find((year) => year.year === row.year)!
      expect(row.values.inheritedVoluntary.baseline).toBe(
        (baselineYear.inheritedAccounts ?? []).reduce(
          (total, account) => total + account.voluntaryAmount,
          0,
        ),
      )
      expect(row.values.inheritedVoluntary.proposal).toBe(
        (proposalYear.inheritedAccounts ?? []).reduce(
          (total, account) => total + account.voluntaryAmount,
          0,
        ),
      )
    }
    expect(result.annual.some((row) => (row.values.inheritedVoluntary.baseline ?? 0) > 0)).toBe(true)
  })

  it('adds zero inherited values without changing withdrawal aggregates for plans without inherited accounts', () => {
    const baseline = comparisonPlan()
    const proposal = structuredClone(baseline)
    const ledger = simulatePlan(baseline, { startYear: 2026, taxCalculator: noTax })
    const result = compareScenarioPlans(baseline, proposal, {
      startYear: 2026,
      taxCalculatorForPlan: () => noTax,
    })

    for (const row of result.annual) {
      expect(row.values.inheritedDistribution).toEqual({ baseline: 0, proposal: 0, delta: 0 })
      expect(row.values.inheritedRequired).toEqual({ baseline: 0, proposal: 0, delta: 0 })
    }
    expect(result.withdrawals.inherited).toEqual({ baseline: 0, proposal: 0, delta: 0 })
    expect(result.withdrawals.total.baseline).toBe(
      ledger.years.reduce((total, year) => total + year.withdrawals.total, 0),
    )
    expect(result.withdrawals.rmd.baseline).toBe(
      ledger.years.reduce((total, year) => total + year.rmd, 0),
    )
    expect(result.withdrawals.qcd.baseline).toBe(
      ledger.years.reduce((total, year) => total + year.qcd, 0),
    )
  })

  it('includes canonical action rows from each already-computed projection', () => {
    const baseline = comparisonPlan()
    baseline.accounts[0]!.ownerPersonId = 'p1'
    baseline.strategies.retirementActions = [{
      actionId: asActionId('shared-action'),
      kind: 'ordinaryWithdrawal',
      personId: asPersonId('p1'),
      year: 2030,
      executionSequence: 1,
      requestedAmount: asPositiveUsdCents(12_345),
      allocations: [{
        allocationId: asAllocationId('shared-allocation'),
        sourceAccountId: asAccountId('cash'),
        requestedAmount: asPositiveUsdCents(12_345),
      }],
      purpose: { kind: 'spending' },
      provenance: { source: 'manual' },
    }]
    const proposal = structuredClone(baseline)
    proposal.strategies.retirementActions[0]!.year = 2031

    const result = compareScenarioPlans(validatePlan(baseline), validatePlan(proposal), {
      startYear: 2026,
      taxCalculatorForPlan: () => noTax,
    })

    expect(result.actionRows).toEqual([{
      actionId: 'shared-action',
      baseline: expect.objectContaining({
        actionId: 'shared-action',
        year: 2030,
        personId: 'p1',
        requestedAmountCents: 12_345,
        executedAmountCents: 12_345,
      }),
      proposal: expect.objectContaining({
        actionId: 'shared-action',
        year: 2031,
        personId: 'p1',
        requestedAmountCents: 12_345,
        executedAmountCents: 12_345,
      }),
      baselineScheduleDiagnostics: [],
      proposalScheduleDiagnostics: [],
    }])
  })

  it('does not drop actions refused before evidence publication by a schedule collision', () => {
    const baseline = comparisonPlan()
    baseline.accounts[0]!.ownerPersonId = 'p1'
    const scheduledAction = (
      actionId: string,
      allocationId: string,
      executionDate: string,
      executionSequence: number,
    ) => ({
      actionId: asActionId(actionId),
      kind: 'ordinaryWithdrawal' as const,
      personId: asPersonId('p1'),
      year: 2030,
      executionDate,
      executionSequence,
      requestedAmount: asPositiveUsdCents(100),
      allocations: [{
        allocationId: asAllocationId(allocationId),
        sourceAccountId: asAccountId('cash'),
        requestedAmount: asPositiveUsdCents(100),
      }],
      purpose: { kind: 'spending' as const },
      provenance: { source: 'manual' as const },
    })
    baseline.strategies.retirementActions = [
      scheduledAction('collision-b', 'allocation-b', '2030-06-01', 1),
      scheduledAction('independent', 'allocation-independent', '2030-07-01', 1),
      scheduledAction('collision-a', 'allocation-a', '2030-06-01', 1),
    ]
    const proposal = structuredClone(baseline)
    proposal.strategies.retirementActions = []

    const result = compareScenarioPlans(validatePlan(baseline), validatePlan(proposal), {
      startYear: 2026,
      taxCalculatorForPlan: () => noTax,
    })

    expect(result.actionRows.map((row) => row.actionId)).toEqual([
      'collision-a',
      'collision-b',
      'independent',
    ])
    for (const row of result.actionRows) {
      expect(row.baseline).toMatchObject({
        actionId: row.actionId,
        personId: 'p1',
        requestedAmountCents: 100,
        executedAmountCents: 0,
        unexecutedAmountCents: 100,
        readiness: 'nonActionable',
        outcome: 'refused',
        reasons: row.actionId === 'independent'
          ? [{ code: 'action-batch-schedule-conflict' }]
          : [{ code: 'action-sequence-conflict' }],
        sourceAllocations: [{
          allocationId:
            row.actionId === 'collision-a'
              ? 'allocation-a'
              : row.actionId === 'collision-b'
                ? 'allocation-b'
                : 'allocation-independent',
          sourceAccountId: 'cash',
          resolution: 'unresolved',
          requestedAmountCents: 100,
          executedAmountCents: 0,
          unexecutedAmountCents: 100,
        }],
      })
      expect(row.proposal).toBeNull()
      expect(row.proposalScheduleDiagnostics).toEqual([])
      expect(row.baselineScheduleDiagnostics).toEqual(
        row.actionId === 'independent'
          ? []
          : [expect.objectContaining({
              kind: 'executionSequenceConflict',
              actionId: row.actionId,
              collidingActionIds: ['collision-a', 'collision-b'],
              reason: expect.objectContaining({ code: 'action-sequence-conflict' }),
            })],
      )
    }
  })

  it('reconciles annual and lifetime ACA values from ledger facts only', () => {
    const baseline = singlePersonPlan({ dob: '1964-01-01', planningAge: 62 })
    baseline.accounts = [cashAccount('cash', 100_000)]
    baseline.incomes = [recurringOrdinaryIncome('income', 50_000, 2026)]
    setAcaYearContract(baseline)
    const proposal = structuredClone(baseline)
    proposal.incomes = [recurringOrdinaryIncome('income-2', 60_000, 2026)]

    const result = compareScenarioPlans(validatePlan(baseline), validatePlan(proposal), {
      startYear: 2026,
      taxCalculatorForPlan: () => noTax,
    })
    const annual = result.annual[0]!.values

    expect(result.aca.grossEnrollmentPremium.baseline).toBe(annual.acaGrossEnrollmentPremium.baseline)
    expect(result.aca.modeledAllowablePtc.baseline).toBe(annual.acaModeledAllowablePtc.baseline)
    expect(result.aca.economicNetPremium.proposal).toBe(annual.acaEconomicNetPremium.proposal)
    expect(result.aca.modeledAllowablePtc.delta).toBe(
      result.aca.modeledAllowablePtc.proposal - result.aca.modeledAllowablePtc.baseline,
    )

    const identical = compareScenarioPlans(validatePlan(baseline), validatePlan(structuredClone(baseline)), {
      startYear: 2026,
      taxCalculatorForPlan: () => noTax,
    })
    expect(identical.aca.grossEnrollmentPremium.delta).toBe(0)
    expect(identical.aca.modeledAllowablePtc.delta).toBe(0)
    expect(identical.aca.economicNetPremium.delta).toBe(0)
  })

  it('aligns annual rows by calendar year and uses null when only one horizon contains a year', () => {
    const baseline = comparisonPlan()
    const proposal = structuredClone(baseline)
    proposal.household.people[0]!.longevity.planningAge = 70
    const result = compareScenarioPlans(baseline, validatePlan(proposal), {
      startYear: 2026,
      taxCalculatorForPlan: () => noTax,
    })
    const last = result.annual.at(-1)!
    expect(last.year).toBe(2035)
    expect(last.values.netWorth.baseline).not.toBeNull()
    expect(last.values.netWorth.proposal).toBeNull()
    expect(last.values.netWorth.delta).toBeNull()
    expect(result.headline.depletionYear).toEqual({ baseline: null, proposal: null, delta: null })
    expect(result.headline.projectionEndYear.delta).toBe(-5)
  })

  it('uses each plan tax calculator and exposes ledger-native IRMAA surcharge dollars', () => {
    const baseline = comparisonPlan()
    baseline.assumptions.stateEffectiveTaxPct = 0
    baseline.assumptions.recentAnnualMagi = 50_000
    const proposal = structuredClone(baseline)
    proposal.assumptions.stateEffectiveTaxPct = 10
    proposal.assumptions.recentAnnualMagi = 200_000
    const seenRates: number[] = []

    const result = compareScenarioPlans(validatePlan(baseline), validatePlan(proposal), {
      startYear: 2026,
      taxCalculatorForPlan(plan) {
        seenRates.push(plan.assumptions.stateEffectiveTaxPct)
        return createFlatTaxCalculator(plan.assumptions.stateEffectiveTaxPct)
      },
    })

    expect(seenRates).toEqual([0, 10])
    expect(result.headline.lifetimeTaxesAndPenalties.delta).toBeGreaterThan(0)
    expect(result.irmaa.surcharge.baseline).toBe(0)
    expect(result.irmaa.surcharge.proposal).toBeGreaterThan(0)
    expect(result.irmaa.surcharge.delta).toBeGreaterThan(0)
  })

  it('reports shared-path risk provenance, aligned depletion curves, and optional spending capacity', () => {
    const baseline = comparisonPlan()
    const proposal = structuredClone(baseline)
    proposal.expenses.baseAnnual = 100_000
    const result = compareScenarioPlans(baseline, validatePlan(proposal), {
      startYear: 2026,
      taxCalculatorForPlan: () => noTax,
      stochastic,
      spendingCapacity: { maxSimulations: 8, resolutionDollars: 5_000 },
    })

    expect(result.risk?.provenance).toMatchObject({ seed: 731, pathCount: 16, stochasticLongevity: false })
    expect(result.risk?.successRate.proposal).toBeLessThanOrEqual(result.risk!.successRate.baseline)
    for (const row of result.risk!.depletionProbabilityByYear) {
      expect(row.cumulativeProbability.baseline).toBeGreaterThanOrEqual(0)
      expect(row.cumulativeProbability.proposal).toBeGreaterThanOrEqual(0)
    }
    expect(result.spendingCapacity).not.toBeNull()
    expect(result.spendingCapacity!.maxBaseAnnual.baseline).not.toBeNull()
    expect(result.moneyBasis.spendingCapacity).toBe('today')
  })

  it('normalizes identical spending-capacity deltas to exact +0', () => {
    const baseline = comparisonPlan()
    const result = compareScenarioPlans(baseline, structuredClone(baseline), {
      startYear: 2026,
      taxCalculatorForPlan: () => noTax,
      spendingCapacity: { maxSimulations: 8, resolutionDollars: 5_000 },
    })
    expect(result.spendingCapacity?.maxBaseAnnual.delta).toBe(0)
    expect(Object.is(result.spendingCapacity?.maxBaseAnnual.delta, -0)).toBe(false)
    expect(result.spendingCapacity?.spendingSlack.delta).toBe(0)
    expect(Object.is(result.spendingCapacity?.spendingSlack.delta, -0)).toBe(false)
  })

  it('compares worker-compatible capacity results without hiding non-convergence metadata', () => {
    const result = compareScenarioSpendingCapacityResults(
      {
        maxBaseAnnual: 50_000,
        spendingSlackDollars: 5_000,
        converged: false,
        simulationCount: 8,
        limitingConstraint: 'depletion',
        diagnostics: ['Feasible lower bound only.'],
      },
      {
        maxBaseAnnual: 55_000,
        spendingSlackDollars: 10_000,
        converged: true,
        simulationCount: 7,
        limitingConstraint: 'estate-floor',
        diagnostics: [],
      },
    )
    expect(result.maxBaseAnnual.delta).toBe(5_000)
    expect(result.baselineConverged).toBe(false)
    expect(result.baselineDiagnostics).toEqual(['Feasible lower bound only.'])
    expect(result.proposalConverged).toBe(true)
  })

  it('rejects invalid stochastic options before running simulations', () => {
    const plan = comparisonPlan()
    expect(() =>
      compareScenarioPlans(plan, plan, {
        startYear: 2026,
        taxCalculatorForPlan: () => noTax,
        stochastic: { ...stochastic, pathCount: 0 },
      }),
    ).toThrow('pathCount')
  })

  it('reconciles lifetime tax-exempt interest to annual ledger rows and raises tax through the §86 cascade', () => {
    const baseline = singlePersonPlan({
      dob: '1964-06-15',
      planningAge: 70,
      retirementAge: null,
    })
    baseline.accounts = [cashAccount('cash', 400_000), taxableAccount('brokerage', 100_000, 100_000)]
    baseline.incomes = [
      {
        type: 'oneTime',
        id: 'ordinary',
        label: 'Ordinary',
        year: 2026,
        inflationAdjusted: false,
        amount: 12_900,
        taxTreatment: 'ordinary',
      },
      socialSecurityIncome('ss', 2_000, 62),
    ]
    const proposal = structuredClone(baseline)
    const brokerage = proposal.accounts.find((a) => a.id === 'brokerage')
    if (!brokerage || brokerage.type !== 'taxable') throw new Error('expected brokerage')
    brokerage.taxExemptInterestYieldPct = 13
    brokerage.reinvestDividends = false

    const result = compareScenarioPlans(validatePlan(baseline), validatePlan(proposal), {
      startYear: 2026,
      taxCalculatorForPlan: () => federalTax,
    })

    const annualSum = result.annual.reduce(
      (total, row) => total + (row.values.taxExemptInterest.proposal ?? 0),
      0,
    )
    expect(result.income.taxExemptInterest.baseline).toBe(0)
    expect(result.income.taxExemptInterest.proposal).toBeCloseTo(annualSum, 6)
    expect(result.income.taxExemptInterest.delta).toBeCloseTo(annualSum, 6)
    expect(result.income.taxExemptInterest.delta).toBeGreaterThan(0)
    // Proposal pays more ordinary tax via higher taxable Social Security; the
    // exempt coupon itself never enters AGI as ordinary income.
    expect(result.headline.lifetimeTax.delta).toBeGreaterThan(0)
  })

  it('places §86 phase-in below / within / above saturation for single-year tax deltas', () => {
    // Three regimes for single-filer §86 (tier50 = 25k, tier85 = 34k):
    // 1. Below both thresholds → zero taxable-SS delta from the exempt coupon.
    // 2. Inside the 50% phase-in band → taxable-SS rises at ~½ × exempt.
    // 3. Above 85% saturation → zero marginal tax delta from more exempt interest.
    // Early-claim SS: PIA $2,000/mo × 0.70 factor at 62 × 12 = $16,800/yr.
    const ssAnnual = 16_800
    const compareRegime = (ordinary: number, yieldPct: number) => {
      const baseline = singlePersonPlan({
        dob: '1964-06-15',
        planningAge: 62,
        retirementAge: null,
      })
      baseline.accounts = [
        cashAccount('cash', 400_000),
        taxableAccount('brokerage', 100_000, 100_000),
      ]
      baseline.incomes = [
        {
          type: 'oneTime',
          id: 'ordinary',
          label: 'Ordinary',
          year: 2026,
          inflationAdjusted: false,
          amount: ordinary,
          taxTreatment: 'ordinary',
        },
        socialSecurityIncome('ss', 2_000, 62),
      ]
      const proposal = structuredClone(baseline)
      const brokerage = proposal.accounts.find((a) => a.id === 'brokerage')
      if (!brokerage || brokerage.type !== 'taxable') throw new Error('expected brokerage')
      brokerage.taxExemptInterestYieldPct = yieldPct
      brokerage.reinvestDividends = false
      return compareScenarioPlans(validatePlan(baseline), validatePlan(proposal), {
        startYear: 2026,
        taxCalculatorForPlan: () => federalTax,
      })
    }

    // Below: provisional without exempt = 0 + ½×16,800 = 8,400 < 25k;
    // +2k exempt still < 25k → no taxable SS on either side.
    const below = compareRegime(0, 2)
    expect(below.income.taxExemptInterest.delta).toBeCloseTo(2_000, 6)
    expect(below.headline.lifetimeTax.delta).toBe(0)

    // Within 50% band (not a below→85% jump):
    //   provisional₀ = ordinary 20,600 + ½×16,800 SS = 20,600 + 8,400 = 29,000
    //   which sits strictly in (25,000, 34,000). +3k exempt → provisional₁ = 32,000
    //   still ≤ 34k, so both sides stay in the 50% formula:
    //     taxable SS = min(½×SS, ½×(provisional − 25k))
    //   ⇒ ΔtaxableSS = ½ × Δexempt (not the 0.85 slope).
    const inside = compareRegime(20_600, 3)
    expect(inside.income.socialSecurity.baseline).toBeCloseTo(ssAnnual, 6)
    const ordinaryBaseline = inside.income.oneTime.baseline ?? 0
    const halfSs = 0.5 * (inside.income.socialSecurity.baseline ?? 0)
    const provisionalBaseline = ordinaryBaseline + halfSs
    expect(provisionalBaseline).toBeGreaterThan(25_000)
    expect(provisionalBaseline).toBeLessThan(34_000)
    const exempt = inside.income.taxExemptInterest.delta
    expect(exempt).toBeCloseTo(3_000, 6)
    const provisionalProposal = provisionalBaseline + exempt
    expect(provisionalProposal).toBeGreaterThan(25_000)
    expect(provisionalProposal).toBeLessThanOrEqual(34_000)
    // MAGI = ordinary + taxable SS + tax-exempt interest (no other income here),
    // so ΔtaxableSS = ΔMAGI − Δexempt.
    const magiDelta = inside.annual[0]!.values.magi.delta ?? 0
    const taxableSsDelta = magiDelta - exempt
    expect(Math.abs(taxableSsDelta - 0.5 * exempt)).toBeLessThan(5)
    expect(Math.abs(taxableSsDelta - 0.85 * exempt)).toBeGreaterThan(100)
    expect(inside.headline.lifetimeTax.delta).toBeGreaterThan(0)

    // Saturated: ordinary 50k + half SS already past the 85% cap; +5k exempt
    // cannot raise taxable SS further, so the tax delta stays 0.
    const above = compareRegime(50_000, 5)
    expect(above.income.taxExemptInterest.delta).toBeCloseTo(5_000, 6)
    expect(above.headline.lifetimeTax.delta).toBe(0)
  })

  it('lowers modeled ACA PTC pre-65 and moves IRMAA two years later from lookback MAGI', () => {
    // Pre-65 ACA: higher characterized MAGI from account-generated exempt yield
    // reduces modeled allowable PTC; delta reconciles to the year row.
    const acaBaseline = singlePersonPlan({
      dob: '1964-01-01',
      planningAge: 62,
      retirementAge: null,
    })
    acaBaseline.accounts = [taxableAccount('brokerage', 100_000, 100_000)]
    acaBaseline.incomes = [
      {
        type: 'oneTime',
        id: 'ordinary',
        label: 'Ordinary',
        year: 2026,
        inflationAdjusted: false,
        amount: 40_000,
        taxTreatment: 'ordinary',
      },
    ]
    setAcaYearContract(acaBaseline, {
      year: 2026,
      monthlyEnrollment: 1_000,
      monthlySlcsp: 1_000,
    })
    const acaProposal = structuredClone(acaBaseline)
    const acaBrokerage = acaProposal.accounts.find((a) => a.id === 'brokerage')
    if (!acaBrokerage || acaBrokerage.type !== 'taxable') throw new Error('expected brokerage')
    acaBrokerage.taxExemptInterestYieldPct = 20
    acaBrokerage.reinvestDividends = false

    const acaResult = compareScenarioPlans(validatePlan(acaBaseline), validatePlan(acaProposal), {
      startYear: 2026,
      taxCalculatorForPlan: () => federalTax,
    })
    const acaYear = acaResult.annual[0]!.values
    expect(acaResult.income.taxExemptInterest.delta).toBeCloseTo(20_000, 6)
    expect(acaResult.aca.modeledAllowablePtc.delta).toBe(
      acaYear.acaModeledAllowablePtc.delta,
    )
    expect(acaResult.aca.modeledAllowablePtc.delta).toBeLessThan(0)

    // 65+ IRMAA: exempt yield in the lookback year (2026) moves the premium in
    // 2028; surcharge delta reconciles to the 2028 annual row.
    const irmaaBaseline = singlePersonPlan({
      dob: '1960-06-15',
      planningAge: 68,
      retirementAge: null,
    })
    irmaaBaseline.assumptions.recentAnnualMagi = 0
    irmaaBaseline.accounts = [
      cashAccount('cash', 500_000),
      taxableAccount('brokerage', 100_000, 100_000),
    ]
    irmaaBaseline.incomes = [
      {
        type: 'oneTime',
        id: 'ordinary',
        label: 'Ordinary',
        year: 2026,
        inflationAdjusted: false,
        amount: 105_000,
        taxTreatment: 'ordinary',
      },
    ]
    const irmaaProposal = structuredClone(irmaaBaseline)
    const irmaaBrokerage = irmaaProposal.accounts.find((a) => a.id === 'brokerage')
    if (!irmaaBrokerage || irmaaBrokerage.type !== 'taxable') throw new Error('expected brokerage')
    irmaaBrokerage.taxExemptInterestYieldPct = 5
    irmaaBrokerage.reinvestDividends = false

    const irmaaResult = compareScenarioPlans(
      validatePlan(irmaaBaseline),
      validatePlan(irmaaProposal),
      {
        startYear: 2026,
        taxCalculatorForPlan: () => federalTax,
      },
    )
    const lookbackYear = irmaaResult.annual.find((row) => row.year === 2026)!
    const premiumYear = irmaaResult.annual.find((row) => row.year === 2028)!
    expect(lookbackYear.values.taxExemptInterest.delta).toBeCloseTo(5_000, 6)
    expect(lookbackYear.values.magi.delta).toBeCloseTo(5_000, 6)
    expect(premiumYear.values.irmaaSurcharge.delta).toBeGreaterThan(0)
    expect(irmaaResult.irmaa.surcharge.delta).toBe(
      irmaaResult.annual.reduce((total, row) => total + (row.values.irmaaSurcharge.delta ?? 0), 0),
    )
    expect(irmaaResult.irmaa.surcharge.delta).toBe(premiumYear.values.irmaaSurcharge.delta)
  })

  it('keeps tax delta exactly 0 when exempt yield cannot reach SS, ACA, or NIIT', () => {
    const baseline = singlePersonPlan({
      dob: '1966-01-01',
      planningAge: 60,
      retirementAge: null,
    })
    baseline.accounts = [taxableAccount('brokerage', 100_000, 100_000)]
    baseline.incomes = [
      {
        type: 'oneTime',
        id: 'ordinary',
        label: 'Ordinary',
        year: 2026,
        inflationAdjusted: false,
        amount: 30_000,
        taxTreatment: 'ordinary',
      },
    ]
    // No Social Security, ACA off, MAGI well under NIIT thresholds.
    const proposal = structuredClone(baseline)
    const brokerage = proposal.accounts.find((a) => a.id === 'brokerage')
    if (!brokerage || brokerage.type !== 'taxable') throw new Error('expected brokerage')
    brokerage.taxExemptInterestYieldPct = 50
    brokerage.reinvestDividends = false

    const result = compareScenarioPlans(validatePlan(baseline), validatePlan(proposal), {
      startYear: 2026,
      taxCalculatorForPlan: () => federalTax,
    })

    expect(result.income.taxExemptInterest.delta).toBeCloseTo(50_000, 6)
    expect(result.headline.lifetimeTax.delta).toBe(0)
    expect(result.annual[0]!.values.tax.delta).toBe(0)
  })
})
