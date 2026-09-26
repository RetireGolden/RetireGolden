import { describe, expect, it } from 'vitest'

import type { AllocationWeights, Plan } from '../model/plan.js'
import { ASSET_CLASS_IDS, createEmptyPlan, parsePlan } from '../model/plan.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { createDecisionContext, evaluateCandidate } from './evaluateCandidate.js'
import {
  assetLocationGenerator,
  milpScheduleGenerator,
  noConversionGenerator,
  probabilityBandSpendingGuardrailGenerator,
  simpleRothConversionGenerator,
  socialSecurityClaimGridGenerator,
  withdrawalOrderGenerator,
} from './generators.js'
import { assetLocationPlan, noTraditionalPlan, simOptions } from '../testing/decisionFixtures.js'

describe('simpleRothConversionGenerator ACA evidence gate', () => {
  it('emits the ACA-cliff candidate only when a baseline year is actionable', () => {
    const absent = createDecisionContext(noTraditionalPlan(), simOptions())
    expect(simpleRothConversionGenerator.generate(absent).some((candidate) => candidate.id === 'aca-cliff-cap')).toBe(false)

    const nonActionable = createDecisionContext(noTraditionalPlan(), simOptions())
    nonActionable.baselineResult.years[0]!.aca = { readiness: 'nonActionable' } as never
    expect(
      simpleRothConversionGenerator.generate(nonActionable).some((candidate) => candidate.id === 'aca-cliff-cap'),
    ).toBe(false)

    const actionable = createDecisionContext(noTraditionalPlan(), simOptions())
    actionable.baselineResult.years[0]!.aca = { readiness: 'actionable' } as never
    expect(simpleRothConversionGenerator.generate(actionable).some((candidate) => candidate.id === 'aca-cliff-cap')).toBe(true)
  })

  it('finds the first spending draw on traditional accounts even beside a non-qualified inherited Roth slice', () => {
    // D-INHERITED-ROTH-SLICE. A disabled beneficiary born 1965 takes 100 a
    // year from an inherited Roth (2,610 over 26.1, then 2,510 over 25.1); the
    // decedent's first Roth year is 2024, so neither draw is qualified, and
    // with 60 of basis the 2027 draw is 100 of taxable earnings. Spending of
    // 1,000 with 1,750 of cash and no tax leaves 850 of cash for 2027, so the
    // owned IRA pays a 50 spending draw that year. inheritedTraditionalDistribution
    // is 100 then, so reading it as the forced traditional amount gave
    // 50 - 0 - 100 < 1 and no "while cash and taxable cover spending" window.
    const plan = createEmptyPlan({ newId: () => 'slice-generator', now: () => new Date('2026-01-01T00:00:00.000Z') })
    plan.household.people[0] = {
      id: 'beneficiary', name: 'Beneficiary', dob: '1965-06-15',
      sex: 'average', retirementAge: null, longevity: { planningAge: 64, source: 'manual' },
    }
    plan.assumptions.inflationPct = 0
    plan.assumptions.defaultReturnPct = 0
    plan.expenses.baseAnnual = 1_000
    plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
    plan.accounts = [
      { type: 'cash', id: 'cash', name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 1_750, annualContribution: 0 },
      { type: 'traditional', id: 'ira', name: 'IRA', ownerPersonId: 'beneficiary', annualReturnPct: 0, kind: 'ira', balance: 100_000, annualContribution: 0 },
      {
        type: 'roth', id: 'inherited', name: 'Inherited Roth', ownerPersonId: 'beneficiary', annualReturnPct: 0,
        kind: 'ira', balance: 2_610, annualContribution: 0,
        inherited: {
          ownerDeathYear: 2024, ownerDeathDate: '2024-06-01', decedentId: 'decedent', decedentHadStartedRmds: false,
          beneficiary: {
            beneficiaryClass: 'designated-individual', edbCategory: 'disabled', beneficiaryBirthYear: 1965,
            soleBeneficiary: true, ownerBirthYear: 1960, provenance: { source: 'test', asOf: '2026-01-01' },
          },
        },
      },
    ] as Plan['accounts']
    plan.inheritedRothTaxCharacterPools = [{
      beneficiaryPersonId: 'beneficiary', decedentId: 'decedent',
      firstRothContributionTaxYear: 2024, remainingRegularContributionBasis: 60,
      conversionLayers: [], priorDistributionsConsumedAmount: 0,
      provenance: { source: 'Complete decedent Roth records', asOf: '2026-01-01' },
    }]
    const parsed = parsePlan(plan)
    if (!parsed.ok) throw new Error(parsed.issues.join('; '))
    const ctx = createDecisionContext(parsed.plan, { startYear: 2026, taxCalculator: createFlatTaxCalculator(0) })
    const [year2026, year2027] = ctx.baselineResult.years
    // The facts the window reads: no spending draw on the IRA in 2026, a 50
    // one in 2027, and a Roth slice larger than it.
    expect(year2026!.withdrawals.traditional).toBe(0)
    expect(year2027!.withdrawals.traditional).toBeCloseTo(50, 8)
    expect(year2027!.inheritedTraditionalDistribution).toBeCloseTo(100, 8)
    expect(year2027!.withdrawals.roth).toBeCloseTo(100, 8)

    const ids = simpleRothConversionGenerator.generate(ctx).map((candidate) => candidate.id)
    expect(ids).toContain('bracket-12-until-2027')
  })

  /**
   * A surviving spouse born 1947-06-15 elects on 2027-12-31 to treat a 300,000
   * inherited account as her own. In that election year the beneficiary take
   * is suppressed: the account's inheritedAccounts row publishes the
   * owner-reconciled amount, while nothing moves out of it as an inherited
   * distribution. Neither case has any spending, so neither has a spending
   * draw on traditional accounts, and neither may open a "while cash and
   * taxable cover spending" window.
   */
  function spousalElectionPlan(type: 'traditional' | 'roth', acceptedBeforeElection: number, ownedIra: boolean): Plan {
    const plan = createEmptyPlan({ newId: () => 'spousal-election', now: () => new Date('2026-01-01T00:00:00.000Z') })
    plan.household.people[0] = {
      id: 'beneficiary', name: 'Beneficiary', dob: '1947-06-15',
      sex: 'average', retirementAge: null, longevity: { planningAge: 84, source: 'manual' },
    }
    plan.assumptions.inflationPct = 0
    plan.assumptions.defaultReturnPct = 0
    plan.expenses.baseAnnual = 0
    plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
    const receipt = (asOf: string) => ({ source: 'Custodian completed statutory distribution record', asOf })
    plan.accounts = [
      { type: 'cash', id: 'cash', name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 1_000_000, annualContribution: 0 },
      ...(ownedIra
        ? [{ type: 'traditional', id: 'ira', name: 'IRA', ownerPersonId: 'beneficiary', annualReturnPct: 0, kind: 'ira', balance: 100_000, annualContribution: 0 }]
        : []),
      {
        type, id: 'inherited', name: 'Inherited', ownerPersonId: 'beneficiary', annualReturnPct: 0,
        kind: 'ira', balance: 300_000, annualContribution: 0,
        inherited: {
          ownerDeathYear: 2024, decedentHadStartedRmds: type === 'traditional',
          decedentId: 'spouse-decedent', ownerDeathDate: '2024-06-01',
          annualDistributionHistory: [{
            taxYear: 2025,
            requiredAmount: type === 'traditional' ? 1_000 : 0,
            distributedAmount: type === 'traditional' ? 1_000 : 0,
            observedAsOfDate: '2025-12-31', legalDistributionDeadline: '2025-12-31',
            provenance: receipt('2025-12-31'),
          }],
          beneficiary: {
            beneficiaryClass: 'designated-individual', edbCategory: 'surviving-spouse', beneficiaryBirthYear: 1947,
            soleBeneficiary: true, ownerBirthYear: 1945, election: 'treat-as-own', spouseUnlimitedWithdrawalRight: true,
            treatAsOwnElectionYear: 2028, ...(type === 'traditional' ? { ownerYearOfDeathRmdSatisfied: true } : {}),
            provenance: { source: 'test', asOf: '2026-01-01' },
            spousalElectionFacts: {
              directSpouseNamedOnIra: 'verifiedYes', affirmativeElectionDate: '2027-12-31',
              affirmativeElectionYear: 2027, nonRolloverContributionYears: [], lateElectionCatchUp: null,
              preElectionDistributionMethod: 'lifeExpectancyRule',
              section402c2j4Inputs: {
                transaction: 'affirmativeTreatAsOwnElection', spouseBirthDate: '1947-06-15',
                decedentBirthDate: '1945-01-01', distributionYear: 2027, currentYearRmdReferenceBalance: 0,
                actualPriorYearDistributions: [], actualPreElectionDistributionsCurrentYear: acceptedBeforeElection,
                currentDistributionOrRemainingInterest: 0,
                provenance: { source: 'Custodian life-expectancy method evidence', asOf: '2027-12-31' },
              },
              provenance: { source: 'Executed custodian owner redesignation', asOf: '2027-12-31' },
            },
          },
        },
      },
    ] as Plan['accounts']
    const parsed = parsePlan(plan)
    if (!parsed.ok) throw new Error(parsed.issues.join('; '))
    return parsed.plan
  }
  const windowedIds = (plan: Plan): string[] =>
    simpleRothConversionGenerator
      .generate(createDecisionContext(plan, { startYear: 2026, taxCalculator: createFlatTaxCalculator(0) }))
      .map((candidate) => candidate.id)
      .filter((id) => id.includes('-until-'))

  it('opens no spending window in a spousal election year on an inherited Roth', () => {
    // 5,000 was accepted before the election; the Roth row publishes it as
    // executed although nothing moved out of the account as an inherited
    // distribution. Reading the rows as the forced amount made a 5,000
    // "draw" out of a year with no traditional withdrawal at all.
    const plan = spousalElectionPlan('roth', 5_000, false)
    const year2027 = createDecisionContext(plan, { startYear: 2026, taxCalculator: createFlatTaxCalculator(0) })
      .baselineResult.years.find((year) => year.year === 2027)!
    expect(year2027.withdrawals.traditional).toBe(0)
    expect(year2027.inheritedDistribution).toBe(0)
    expect(year2027.inheritedAccounts?.find((row) => row.accountId === 'inherited')?.executedRequiredAmount).toBe(5_000)
    expect(windowedIds(plan)).toEqual([])
  })

  it('opens no spending window in a spousal election year on an inherited traditional IRA', () => {
    // The owner-reconciled take is inside rmd and moves nothing out as an
    // inherited distribution; the row still publishes it as executed.
    // Summing the traditional rows would subtract it a second time.
    const plan = spousalElectionPlan('traditional', 0, true)
    const year2027 = createDecisionContext(plan, { startYear: 2026, taxCalculator: createFlatTaxCalculator(0) })
      .baselineResult.years.find((year) => year.year === 2027)!
    expect(year2027.inheritedDistribution).toBe(0)
    expect(year2027.rmd).toBeGreaterThan(0)
    expect(year2027.inheritedAccounts?.find((row) => row.accountId === 'inherited')?.executedRequiredAmount).toBeGreaterThan(0)
    expect(windowedIds(plan)).toEqual([])
  })

  it('marks every aggregate fill candidate explicitly exploratory', () => {
    const candidates = simpleRothConversionGenerator.generate(createDecisionContext(noTraditionalPlan(), simOptions()))
    expect(candidates.length).toBeGreaterThan(0)
    for (const candidate of candidates) {
      expect(candidate.retirementActionReadiness).toMatchObject({ state: 'exploratoryNonActionable' })
    }
  })
})

describe('aggregate retirement-action generator readiness', () => {
  it('keeps the removal-only no-conversion candidate actionable without identities', () => {
    const plan = noTraditionalPlan()
    plan.strategies.rothConversion = {
      mode: 'manual',
      conversions: [{ year: 2027, amount: 1_000 }],
    }
    const ctx = createDecisionContext(plan, simOptions())
    const [candidate] = noConversionGenerator.generate(ctx)

    expect(candidate?.retirementActionReadiness).toBeUndefined()
    const evaluation = evaluateCandidate(ctx, candidate!)
    expect(evaluation.recommendationState).not.toBe('diagnostic')
    expect(evaluation.diagnostics.join(' ')).not.toMatch(/identity|retirement-action/i)
    expect(evaluation.candidateResult.years.reduce((sum, year) => sum + year.rothConversion, 0)).toBe(0)
  })

  it('marks withdrawal candidates exploratory independent of account-array order', () => {
    const plan = noTraditionalPlan()
    const permutedPlan = { ...plan, accounts: [...plan.accounts].reverse() }
    const original = withdrawalOrderGenerator.generate(createDecisionContext(plan, simOptions()))
    const permuted = withdrawalOrderGenerator.generate(createDecisionContext(permutedPlan, simOptions()))

    expect(permuted.map((candidate) => candidate.id)).toEqual(original.map((candidate) => candidate.id))
    for (const candidate of [...original, ...permuted]) {
      expect(candidate.retirementActionReadiness).toMatchObject({ state: 'exploratoryNonActionable' })
    }
  })

  it('marks raw optimizer schedules exploratory rather than identity-complete', () => {
    const [candidate] = milpScheduleGenerator({
      cleanedConversions: [{ year: 2027, amount: 25_000 }],
    }).generate(createDecisionContext(noTraditionalPlan(), simOptions()))

    expect(candidate?.retirementActionReadiness).toMatchObject({ state: 'exploratoryNonActionable' })
  })
})

describe('probabilityBandSpendingGuardrailGenerator', () => {
  it('emits a ledger-native guardrail patch with probability-band metadata', () => {
    const plan = noTraditionalPlan()
    plan.expenses.baseAnnual = 50_000
    const ctx = createDecisionContext(plan, simOptions())

    const candidates = probabilityBandSpendingGuardrailGenerator({ lowerSuccessPct: 75, upperSuccessPct: 95 }).generate(ctx)

    expect(candidates).toHaveLength(1)
    expect(candidates[0]!.category).toBe('spending')
    expect(candidates[0]!.metadata).toMatchObject({
      decisionRule: 'probabilityBandSafeSpend',
      lowerSuccessPct: 75,
      upperSuccessPct: 95,
    })
    expect(candidates[0]!.planPatch).toMatchObject({
      expenses: {
        requiredAnnual: 40_000,
        spendingPolicy: { mode: 'withdrawalRateGuardrails' },
      },
    })
  })

  it('does not duplicate an already active guardrail policy', () => {
    const plan = noTraditionalPlan()
    plan.expenses.spendingPolicy = { mode: 'withdrawalRateGuardrails' }
    const ctx = createDecisionContext(plan, simOptions())

    expect(probabilityBandSpendingGuardrailGenerator().generate(ctx)).toEqual([])
  })
})

describe('assetLocationGenerator', () => {
  /** Household dollars per class across all statically allocated accounts. */
  function householdClassDollars(plan: Plan): Record<string, number> {
    const totals: Record<string, number> = { usStocks: 0, intlStocks: 0, bonds: 0, cash: 0 }
    for (const account of plan.accounts) {
      if (!('allocation' in account) || account.allocation?.mode !== 'static') continue
      const weights = account.allocation.weights as AllocationWeights
      for (const id of ASSET_CLASS_IDS) totals[id] = totals[id]! + (weights[id] / 100) * account.balance
    }
    return totals
  }

  it('emits a bounded set of location-swap patches that preserve the household class mix', () => {
    const plan = assetLocationPlan()
    const ctx = createDecisionContext(plan, simOptions())
    const candidates = assetLocationGenerator.generate(ctx)

    expect(candidates.length).toBeGreaterThan(0)
    expect(candidates.length).toBeLessThanOrEqual(3)
    const before = householdClassDollars(plan)
    for (const candidate of candidates) {
      expect(candidate.category).toBe('asset-location')
      const patched = { ...plan, accounts: (candidate.planPatch as { accounts: Plan['accounts'] }).accounts }
      const after = householdClassDollars(patched)
      for (const id of ASSET_CLASS_IDS) expect(after[id]).toBeCloseTo(before[id]!, 4)
    }
  })

  it('produces nothing when no account opts into a static allocation', () => {
    const ctx = createDecisionContext(noTraditionalPlan(), simOptions())
    expect(assetLocationGenerator.generate(ctx)).toEqual([])
  })

  it('exact evaluation prices the location change (bonds→traditional improves the after-tax estate)', () => {
    const plan = assetLocationPlan()
    const ctx = createDecisionContext(plan, simOptions())
    const candidate = assetLocationGenerator
      .generate(ctx)
      .find((c) => c.id === 'asset-location-bonds-to-traditional')!
    const evaluation = evaluateCandidate(ctx, candidate)

    expect(evaluation.recommendationState).toBe('beneficial')
    expect(evaluation.deltas.endingAfterTaxEstate).toBeGreaterThan(0)
  })
})

describe('socialSecurityClaimGridGenerator', () => {
  it('emits the full whole-year grid including the current claim age', () => {
    const plan = noTraditionalPlan()
    plan.household.people[0] = { ...plan.household.people[0]!, dob: '1964-06-15' } // 62 in 2026
    plan.incomes = [
      { type: 'socialSecurity', id: 'ss1', personId: 'p1', piaMonthly: 2_500, earnings: null, claimAge: { years: 70, months: 0 } },
    ]
    const ctx = createDecisionContext(plan, simOptions())

    const candidates = socialSecurityClaimGridGenerator.generate(ctx)

    expect(candidates).toHaveLength(9)
    expect(candidates.some((candidate) => candidate.id === 'ss-claim-grid-p1-70')).toBe(true)
    expect(candidates[0]!.metadata).toMatchObject({ decisionRule: 'socialSecurityClaimGrid' })
    expect(candidates.map((candidate) => (candidate.metadata?.['claimByPersonId'] as Record<string, number>)['p1'])).toEqual([
      62, 63, 64, 65, 66, 67, 68, 69, 70,
    ])
  })

  it('excludes a zero-PIA spouse so the grid stays a single-person sweep', () => {
    const plan = noTraditionalPlan()
    plan.household.people[0] = { ...plan.household.people[0]!, dob: '1964-06-15' } // 62 in 2026
    plan.household.people = [
      plan.household.people[0]!,
      { id: 'p2', name: 'Spouse', dob: '1964-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 90, source: 'manual' } },
    ]
    plan.incomes = [
      { type: 'socialSecurity', id: 'ss1', personId: 'p1', piaMonthly: 2_500, earnings: null, claimAge: { years: 70, months: 0 } },
      // Default record the planner creates for the spouse: PIA 0, no earnings.
      { type: 'socialSecurity', id: 'ss2', personId: 'p2', piaMonthly: 0, earnings: null, claimAge: { years: 67, months: 0 } },
    ]
    const ctx = createDecisionContext(plan, simOptions())

    const candidates = socialSecurityClaimGridGenerator.generate(ctx)

    // Only p1 is a real claiming stream, so 9 candidates (not 81) and no p2 ages.
    expect(candidates).toHaveLength(9)
    for (const candidate of candidates) {
      expect((candidate.metadata?.['claimByPersonId'] as Record<string, number>)['p2']).toBeUndefined()
    }
  })
})
