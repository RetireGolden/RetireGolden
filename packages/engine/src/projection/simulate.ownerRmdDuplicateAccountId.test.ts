import { describe, expect, it } from 'vitest'

import { parsePlan, type Account } from '../model/plan.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { validateOwnedNonRothIraRuntimeSourceSeries } from '../internal/ownedNonRothIraRuntimeSourceSeries.js'
import {
  cashAccount,
  singlePersonPlan,
  taxableAccount,
  traditionalAccount,
} from '../testing/planFixtures.js'
import { simulatePlan } from './simulate.js'
import type { OptimizerYearProbe } from './types.js'

const YEAR = 2026

describe('simulatePlan owner RMD duplicate account IDs', () => {
  it('uses one aggregate ID group while a distinct account still distributes', () => {
    // Unreferenced compatible duplicate account IDs form one logical account.
    // The RMD base and published balance aggregate both physical rows.
    // At age 73 the Uniform Lifetime divisor is 26.5, so the independently
    // derived obligations are 318,000 / 26.5 = 12,000 and
    // 79,500 / 26.5 = 3,000. One candidate and one debit per ID must publish
    // exactly 15,000 with one occurrence/application per logical ID.
    const plan = singlePersonPlan({
      dob: '1953-01-01',
      planningAge: 80,
      retirementAge: null,
    })
    plan.id = 'owner-rmd-duplicate-account-id'
    const firstDuplicate = traditionalAccount('duplicate-ira', 265_000, 'p1', 'ira')
    firstDuplicate.name = 'Superseded duplicate row'
    const selectedDuplicate = traditionalAccount('duplicate-ira', 53_000, 'p1', 'ira')
    selectedDuplicate.name = 'Last duplicate row'
    plan.accounts = [
      firstDuplicate,
      selectedDuplicate,
      traditionalAccount('distinct-ira', 79_500, 'p1', 'ira'),
      cashAccount('cash', 0),
    ]

    const parsed = parsePlan(plan)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) throw new Error(parsed.issues.join('; '))
    expect(parsed.plan.accounts.map((account) => account.id)).toEqual([
      'duplicate-ira',
      'duplicate-ira',
      'distinct-ira',
      'cash',
    ])

    // Pub. 590-B (2025), Uniform Lifetime Table: age 73 divisor = 26.5.
    // These worksheets are independent of the engine's RMD helper.
    const duplicateOpening = 265_000 + 53_000
    const duplicateObligation = duplicateOpening / 26.5
    const distinctObligation = 79_500 / 26.5
    expect(duplicateObligation).toBe(12_000)
    expect(distinctObligation).toBe(3_000)

    const year = simulatePlan(parsed.plan, {
      startYear: YEAR,
      horizonEndYear: YEAR,
      taxCalculator: createFlatTaxCalculator(0),
      captureAnnualCashFlow: true,
    }).years[0]!

    expect(year.rmd).toBe(duplicateObligation + distinctObligation)
    expect(year.balances).toMatchObject({
      'duplicate-ira': duplicateOpening - duplicateObligation,
      'distinct-ira': 79_500 - distinctObligation,
    })
    expect(
      year.retirementRuntimeSource?.runtimeOccurrences.filter(
        (occurrence) => occurrence.kind === 'ownedIraRmd',
      ),
    ).toEqual([
      expect.objectContaining({
        producerOccurrenceKey: JSON.stringify(['ownedIraRmd', 'distinct-ira']),
        grossAmountPlanDollars: distinctObligation,
        ownerPersonId: 'p1',
        sourceAccountId: 'distinct-ira',
      }),
      expect.objectContaining({
        producerOccurrenceKey: JSON.stringify(['ownedIraRmd', 'duplicate-ira']),
        grossAmountPlanDollars: duplicateObligation,
        ownerPersonId: 'p1',
        sourceAccountId: 'duplicate-ira',
      }),
    ])
    expect(
      year.retirementRuntimeApplicationSource?.applications.filter(
        (application) => application.simulatorPhase === 'ownerRmdDistribution',
      ),
    ).toEqual([
      expect.objectContaining({
        mutationOrdinal: 1,
        sourceAccountId: 'duplicate-ira',
        sourceBalanceBeforePlanDollars: duplicateOpening,
        appliedAmountPlanDollars: duplicateObligation,
        sourceBalanceAfterPlanDollars: duplicateOpening - duplicateObligation,
      }),
      expect.objectContaining({
        mutationOrdinal: 2,
        sourceAccountId: 'distinct-ira',
        sourceBalanceBeforePlanDollars: 79_500,
        appliedAmountPlanDollars: distinctObligation,
        sourceBalanceAfterPlanDollars: 79_500 - distinctObligation,
      }),
    ])
    expect(
      year.cashFlow?.sourceLines.filter(
        (line) => line.kind === 'requiredMinimumDistribution',
      ),
    ).toEqual([expect.objectContaining({
      id: 'source:requiredMinimumDistribution:ownedIraPool:p1',
      amountPlanDollars: duplicateObligation + distinctObligation,
      identities: [{ entityKind: 'requiredDistributionPool', personId: 'p1' }],
    })])
    expect(year.rmdShortfallExciseDetails).toEqual([expect.objectContaining({
      requiredAmount: duplicateObligation + distinctObligation,
      distributedByDeadline: duplicateObligation + distinctObligation,
      shortfall: 0,
      tax: 0,
    })])
    expect(year.cashFlow?.reconciliation).toMatchObject({
      status: 'reconciled',
      cash: { differencePlanDollars: 0 },
      uses: { differencePlanDollars: 0 },
      transfers: { differencePlanDollars: 0 },
      reasonCodes: [],
      diagnostics: [],
    })
  })

  it('uses aggregate logical capacity for April 1 and current-year obligations', () => {
    const plan = singlePersonPlan({
      dob: '1953-01-01',
      planningAge: 80,
      retirementAge: null,
    })
    plan.id = 'owner-rmd-duplicate-account-id-sweep'
    plan.accounts = [
      traditionalAccount('duplicate-ira', 265_000, 'p1', 'ira'),
      traditionalAccount('duplicate-ira', 2_000, 'p1', 'ira'),
      traditionalAccount('distinct-ira', 79_500, 'p1', 'ira'),
      cashAccount('cash', 100_000),
    ]
    const parsed = parsePlan(plan)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) throw new Error(parsed.issues.join('; '))

    // Uniform Lifetime divisors are 26.5 at age 73 and 25.5 at age 74.
    const duplicateOpening = 265_000 + 2_000
    const duplicateDeferred = duplicateOpening / 26.5
    const distinctDeferred = 79_500 / 26.5
    const duplicateCurrent = duplicateOpening / 25.5
    const distinctCurrent = 79_500 / 25.5

    const result = simulatePlan(parsed.plan, {
      startYear: YEAR,
      horizonEndYear: YEAR + 1,
      taxCalculator: createFlatTaxCalculator(0),
      captureAnnualCashFlow: true,
      rmdFirstYearDeferrals: [{
        distributionCalendarYear: YEAR,
        applicablePlan: { kind: 'ownedTraditionalIras', payeePersonId: 'p1' },
      }],
    })
    expect(result.years[0]!.rmd).toBe(0)

    const dueYear = result.years[1]!
    const deferredRequired = duplicateDeferred + distinctDeferred
    const duplicateTake = deferredRequired + duplicateCurrent
    expect(dueYear.rmd).toBe(duplicateTake + distinctCurrent)
    expect(dueYear.balances).toMatchObject({
      'duplicate-ira': duplicateOpening - duplicateTake,
      'distinct-ira': 79_500 - distinctCurrent,
    })
    expect(
      dueYear.retirementRuntimeApplicationSource?.applications.filter(
        (application) => application.simulatorPhase === 'ownerRmdDistribution',
      ),
    ).toEqual([
      expect.objectContaining({
        mutationOrdinal: 1,
        sourceAccountId: 'duplicate-ira',
        sourceBalanceBeforePlanDollars: duplicateOpening,
        appliedAmountPlanDollars: duplicateTake,
        sourceBalanceAfterPlanDollars: duplicateOpening - duplicateTake,
      }),
      expect.objectContaining({
        mutationOrdinal: 2,
        sourceAccountId: 'distinct-ira',
        sourceBalanceBeforePlanDollars: 79_500,
        appliedAmountPlanDollars: distinctCurrent,
        sourceBalanceAfterPlanDollars: 79_500 - distinctCurrent,
      }),
    ])
    expect(dueYear.rmdShortfallExciseTax).toBe(0)
    expect(dueYear.rmdShortfallExciseDetails?.map((detail) => ({
      requiredAmount: detail.requiredAmount,
      distributedByDeadline: detail.distributedByDeadline,
      shortfall: detail.shortfall,
      tax: detail.tax,
    }))).toEqual([
      {
        requiredAmount: deferredRequired,
        distributedByDeadline: deferredRequired,
        shortfall: 0,
        tax: 0,
      },
      {
        requiredAmount: duplicateCurrent + distinctCurrent,
        distributedByDeadline: duplicateCurrent + distinctCurrent,
        shortfall: 0,
        tax: 0,
      },
    ])
    expect(dueYear.cashFlow?.reconciliation).toMatchObject({
      status: 'reconciled',
      cash: { differencePlanDollars: 0 },
      uses: { differencePlanDollars: 0 },
      transfers: { differencePlanDollars: 0 },
      reasonCodes: [],
      diagnostics: [],
    })
  })

  it('uses one aggregate logical account on the inherited RMD path', () => {
    const plan = singlePersonPlan({
      dob: '1965-06-15',
      planningAge: 100,
      retirementAge: null,
    })
    plan.id = 'inherited-rmd-duplicate-account-id'
    const inheritedFacts = {
      ownerDeathYear: 2022,
      decedentHadStartedRmds: true,
      beneficiary: {
        beneficiaryClass: 'designated-individual' as const,
        edbCategory: 'none' as const,
        beneficiaryBirthYear: 1965,
        soleBeneficiary: true,
        ownerBirthYear: 1940,
        ownerYearOfDeathRmdSatisfied: true,
        provenance: { source: 'test', asOf: '2026-01-01' },
      },
    }
    const inheritedRow = (name: string, balance: number): Account => {
      const account = traditionalAccount('inherited-ira', balance, 'p1', 'ira')
      if (account.type !== 'traditional') {
        throw new Error('fixture did not create a traditional account')
      }
      return { ...account, name, inherited: inheritedFacts }
    }
    plan.accounts = [
      inheritedRow('Superseded inherited row', 600_000),
      inheritedRow('Last inherited row', 300_000),
      cashAccount('cash', 1_000_000),
    ]
    const parsed = parsePlan(plan)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) throw new Error(parsed.issues.join('; '))
    expect(parsed.plan.accounts.map((account) => account.id)).toEqual([
      'inherited-ira',
      'inherited-ira',
      'cash',
    ])

    // Death in 2022 and beneficiary age 58 then gives Single Life 28.9;
    // reducing by 2023–2025 yields the 2026 divisor 25.9.
    const opening = 600_000 + 300_000
    const required = opening / 25.9
    const year = simulatePlan(parsed.plan, {
      startYear: YEAR,
      horizonEndYear: YEAR,
      taxCalculator: createFlatTaxCalculator(0),
      captureAnnualCashFlow: true,
    }).years[0]!

    expect(year.inheritedDistribution).toBeCloseTo(required, 10)
    expect(year.balances['inherited-ira']).toBeCloseTo(opening - required, 10)
    expect(year.inheritedAccounts).toEqual([expect.objectContaining({
      accountId: 'inherited-ira',
      requirementKind: 'annual-rmd',
      divisor: 25.9,
      requiredAmount: required,
      executedRequiredAmount: required,
    })])
    expect(
      year.retirementRuntimeSource?.runtimeOccurrences.filter(
        (occurrence) => occurrence.kind === 'inheritedIraRmd',
      ),
    ).toEqual([expect.objectContaining({
      producerOccurrenceKey: JSON.stringify(['inheritedIraRmd', 'inherited-ira']),
      grossAmountPlanDollars: required,
      sourceAccountId: 'inherited-ira',
    })])
    expect(year.rmdShortfallExciseTax).toBe(0)
    expect(year.rmdShortfallExciseDetails).toEqual([expect.objectContaining({
      requiredAmount: required,
      distributedByDeadline: required,
      shortfall: 0,
      tax: 0,
    })])
    expect(year.cashFlow?.reconciliation).toMatchObject({
      status: 'reconciled',
      cash: { differencePlanDollars: 0 },
      uses: { differencePlanDollars: 0 },
      transfers: { differencePlanDollars: 0 },
      reasonCodes: [],
      diagnostics: [],
    })
  })

  it('executes an active SEPP once from the aggregate logical account', () => {
    const plan = singlePersonPlan({
      dob: '1970-03-15',
      planningAge: 70,
      retirementAge: 56,
    })
    const superseded = traditionalAccount('duplicate-ira', 612_000, 'p1', 'ira')
    const selected = traditionalAccount('duplicate-ira', 306_000, 'p1', 'ira')
    if (superseded.type !== 'traditional' || selected.type !== 'traditional') {
      throw new Error('fixture did not create traditional accounts')
    }
    superseded.sepp = { startAge: 56, method: 'rmd' }
    selected.sepp = { startAge: 56, method: 'rmd' }
    plan.accounts = [superseded, selected, cashAccount('cash', 0)]

    const parsed = parsePlan(plan)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) throw new Error(parsed.issues.join('; '))
    const year = simulatePlan(parsed.plan, {
      startYear: YEAR,
      horizonEndYear: YEAR,
      taxCalculator: createFlatTaxCalculator(0),
    }).years[0]!

    // Notice 2022-6 Single Life Table divisor at 56 is 30.6.
    expect(year.sepp).toBe(30_000)
    expect(year.balances['duplicate-ira']).toBe(888_000)
    expect(
      year.retirementRuntimeSource?.runtimeOccurrences.filter(
        (occurrence) => occurrence.kind === 'automaticSeppDistribution',
      ),
    ).toHaveLength(1)
  })

  it('uses aggregate logical capacity and basis for QCD and Form 8606', () => {
    const plan = singlePersonPlan({
      dob: '1950-01-01',
      planningAge: 90,
      retirementAge: null,
    })
    const superseded = traditionalAccount('duplicate-ira', 1_000_000, 'p1', 'ira')
    const selected = traditionalAccount('duplicate-ira', 100_000, 'p1', 'ira')
    if (superseded.type !== 'traditional' || selected.type !== 'traditional') {
      throw new Error('fixture did not create traditional accounts')
    }
    superseded.nondeductibleBasis = 0
    selected.nondeductibleBasis = 60_000
    plan.accounts = [superseded, selected, cashAccount('cash', 50_000)]
    plan.strategies.qcdAnnual = 50_000

    const parsed = parsePlan(plan)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) throw new Error(parsed.issues.join('; '))
    const result = simulatePlan(parsed.plan, {
      startYear: YEAR,
      horizonEndYear: YEAR,
      taxCalculator: createFlatTaxCalculator(0),
    })
    const year = result.years[0]!

    // Pub. 590-B Uniform Lifetime Table divisor at age 76 is 23.7. Both
    // physical members form the 1,100,000 logical account used by the
    // requirement and the §408(d)(8)(D) aggregate includible ceiling.
    expect(year.rmd).toBeCloseTo(1_100_000 / 23.7, 10)
    expect(year.qcd).toBe(50_000)
    expect(year.balances['duplicate-ira']).toBe(1_050_000)
    expect(
      year.retirementRuntimeSource?.runtimeOccurrences.filter(
        (occurrence) => occurrence.kind === 'legacyQcd',
      ),
    ).toHaveLength(1)
    expect(result.endingNondeductibleIraBasis).toBe(60_000)
    expect(year.ownedTraditionalIraAggregateActivity).toEqual([])
  })

  it('aggregates Form 8606 basis across compatible physical members', () => {
    const plan = singlePersonPlan({
      dob: '1964-01-01',
      planningAge: 90,
      retirementAge: null,
    })
    const superseded = traditionalAccount('duplicate-ira', 100_000, 'p1', 'ira')
    const selected = traditionalAccount('duplicate-ira', 100_000, 'p1', 'ira')
    if (superseded.type !== 'traditional' || selected.type !== 'traditional') {
      throw new Error('fixture did not create traditional accounts')
    }
    superseded.nondeductibleBasis = 40_000
    selected.nondeductibleBasis = 10_000
    plan.accounts = [superseded, selected, cashAccount('cash', 0)]

    const parsed = parsePlan(plan)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) throw new Error(parsed.issues.join('; '))
    const result = simulatePlan(parsed.plan, {
      startYear: YEAR,
      horizonEndYear: YEAR,
      taxCalculator: createFlatTaxCalculator(0),
    })

    expect(result.years[0]?.balances['duplicate-ira']).toBe(200_000)
    expect(result.endingNondeductibleIraBasis).toBe(50_000)
  })

  it('uses the aggregate logical account in the optimizer opening snapshot', () => {
    const plan = singlePersonPlan({
      dob: '1964-01-01',
      planningAge: 90,
      retirementAge: null,
    })
    plan.accounts = [
      traditionalAccount('duplicate-ira', 300_000, 'p1', 'ira'),
      traditionalAccount('duplicate-ira', 30_000, 'p1', 'ira'),
      cashAccount('cash', 0),
    ]

    const parsed = parsePlan(plan)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) throw new Error(parsed.issues.join('; '))
    const probes: OptimizerYearProbe[] = []
    simulatePlan(parsed.plan, {
      startYear: YEAR,
      horizonEndYear: YEAR,
      taxCalculator: createFlatTaxCalculator(0),
      captureOptimizerInputs: (probe) => probes.push(probe),
    })

    expect(probes).toHaveLength(1)
    expect(probes[0]?.startTraditional).toBe(330_000)
  })

  it('preserves duplicate contribution rows outside the RMD selection boundary', () => {
    const plan = singlePersonPlan({
      dob: '1966-01-01',
      planningAge: 70,
      retirementAge: 65,
    })
    const first = traditionalAccount('duplicate-ira', 0, 'p1', 'ira')
    const second = traditionalAccount('duplicate-ira', 0, 'p1', 'ira')
    if (first.type !== 'traditional' || second.type !== 'traditional') {
      throw new Error('fixture did not create traditional accounts')
    }
    first.annualContribution = 3_000
    second.annualContribution = 3_000
    first.nondeductibleBasis = 100
    second.nondeductibleBasis = 50
    plan.accounts = [first, second, cashAccount('cash', 0)]
    plan.incomes = [{
      type: 'wages',
      id: 'wages',
      personId: 'p1',
      annualGross: 50_000,
      endAge: null,
      realGrowthPct: 0,
    }]

    const parsed = parsePlan(plan)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) throw new Error(parsed.issues.join('; '))
    const year = simulatePlan(parsed.plan, {
      startYear: YEAR,
      horizonEndYear: YEAR,
      taxCalculator: createFlatTaxCalculator(0),
    }).years[0]!

    // Both positional rows contribute. A global last-row canonicalization
    // would report only 3,000 and breaks the held-contribution occurrence key.
    expect(year.contributions).toBe(6_000)
    expect(validateOwnedNonRothIraRuntimeSourceSeries(parsed.plan, YEAR, [year]))
      .toMatchObject({ status: 'ownedNonRothIraRuntimeSourceSeriesComplete', issues: [] })
    expect(year.ownedNonRothIraAnnualReplay).toMatchObject({
      status: 'committedOwnedNonRothIraAnnualReplay',
      settlement: 'exactReplayEffectsMatched',
    })
    expect(year.ownedNonRothIraPhysicalBalancesBeforeGrowth).toEqual([
      { sourceAccountId: 'duplicate-ira', balanceIndex: 0, balancePlanDollars: 3_000 },
      { sourceAccountId: 'duplicate-ira', balanceIndex: 1, balancePlanDollars: 3_000 },
    ])
  })

  it('preserves positional growth and investable wealth across duplicate rows', () => {
    const plan = singlePersonPlan({ planningAge: 70 })
    const superseded = traditionalAccount('duplicate-ira', 100_000, 'p1', 'ira')
    const selected = traditionalAccount('duplicate-ira', 50_000, 'p1', 'ira')
    superseded.annualReturnPct = 10
    selected.annualReturnPct = 10
    plan.accounts = [superseded, selected, cashAccount('cash', 0)]

    const parsed = parsePlan(plan)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) throw new Error(parsed.issues.join('; '))
    const years = simulatePlan(parsed.plan, {
      startYear: YEAR,
      horizonEndYear: YEAR + 1,
      taxCalculator: createFlatTaxCalculator(0),
    }).years

    // Publication aggregates the physical rows, matching positional wealth.
    expect(years[0]!.balances['duplicate-ira']).toBeCloseTo(165_000, 8)
    expect(years[1]!.balances['duplicate-ira']).toBeCloseTo(181_500, 8)
    expect(years[0]!.investableTotal).toBeCloseTo(165_000, 8)
    expect(years[1]!.investableTotal).toBeCloseTo(181_500, 8)
  })

  it('prices distributed yield from each physical row opening exactly once', () => {
    const plan = singlePersonPlan({ planningAge: 70 })
    const first = taxableAccount('duplicate-taxable', 100_000, 70_000)
    const second = taxableAccount('duplicate-taxable', 10_000, 8_000)
    if (first.type !== 'taxable' || second.type !== 'taxable') {
      throw new Error('fixture did not create taxable accounts')
    }
    first.interestYieldPct = 1
    first.dividendYieldPct = 0
    first.reinvestDividends = false
    second.interestYieldPct = 2
    second.dividendYieldPct = 0
    second.reinvestDividends = false
    plan.accounts = [first, second]

    const parsed = parsePlan(plan)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) throw new Error(parsed.issues.join('; '))
    const year = simulatePlan(parsed.plan, {
      startYear: YEAR,
      horizonEndYear: YEAR,
      taxCalculator: createFlatTaxCalculator(0),
    }).years[0]!

    // 100,000 × 1% + 10,000 × 2% = 1,200. Reusing the aggregate logical
    // opening (110,000) for both physical rows would incorrectly report 3,300.
    expect(year.taxableYield).toBe(1_200)
    expect(year.advisoryFederalTax?.input.taxableInterestIncome).toBe(1_200)
  })

  it('reinvests each duplicate taxable row’s own distributed yield without losing wealth', () => {
    const plan = singlePersonPlan({ planningAge: 70 })
    const first = taxableAccount('duplicate-taxable', 200, 100)
    const second = taxableAccount('duplicate-taxable', 100, 50)
    if (first.type !== 'taxable' || second.type !== 'taxable') throw new Error('fixture drift')
    first.annualReturnPct = 0
    first.interestYieldPct = 10
    first.dividendYieldPct = 0
    first.reinvestDividends = true
    second.annualReturnPct = 0
    second.interestYieldPct = 20
    second.dividendYieldPct = 0
    second.reinvestDividends = true
    plan.accounts = [first, second]

    const parsed = parsePlan(plan)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) throw new Error(parsed.issues.join('; '))
    const year = simulatePlan(parsed.plan, {
      startYear: YEAR,
      horizonEndYear: YEAR,
      taxCalculator: createFlatTaxCalculator(0),
      captureAnnualCashFlow: true,
    }).years[0]!

    expect(year.taxableYield).toBe(40)
    expect(year.balances['duplicate-taxable']).toBe(300)
    expect(year.investableTotal).toBe(300)
    expect(year.cashFlow?.transferLines.filter((line) => line.kind === 'reinvestedYield'))
      .toMatchObject([{ debitPlanDollars: 40, creditPlanDollars: 40 }])
  })

  it('counts each positional opening row once in the guardrail signal', () => {
    const plan = singlePersonPlan({ planningAge: 70 })
    const falling = cashAccount('duplicate-cash', 100_000)
    const steady = cashAccount('duplicate-cash', 50_000)
    falling.annualReturnPct = -50
    steady.annualReturnPct = 0
    plan.accounts = [falling, steady]
    plan.expenses.baseAnnual = 30_000
    plan.expenses.spendingPolicy = { mode: 'withdrawalRateGuardrails' }
    plan.incomes = [{
      type: 'wages',
      id: 'wages',
      personId: 'p1',
      annualGross: 30_000,
      endAge: null,
      realGrowthPct: 0,
    }]

    const parsed = parsePlan(plan)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) throw new Error(parsed.issues.join('; '))
    const years = simulatePlan(parsed.plan, {
      startYear: YEAR,
      horizonEndYear: YEAR + 1,
      taxCalculator: createFlatTaxCalculator(0),
    }).years

    // Opening wealth falls from 150,000 to 100,000, so the withdrawal-rate
    // signal rises by 50% and crosses the default 120% upper guardrail. The
    // former alias bug instead read the selected 50,000 twice in both years.
    expect(years[0]!.guardrailAction).toBe('hold')
    expect(years[1]!.guardrailAction).toBe('cut')
    expect(years[1]!.expenses.guardrailFactor).toBe(0.9)
  })

  it('plans, characterizes, penalizes, and commits one need-based debit per ID', () => {
    const plan = singlePersonPlan({
      dob: '1970-01-01',
      planningAge: 70,
      retirementAge: null,
    })
    const superseded = traditionalAccount('duplicate-ira', 100_000, 'p1', 'ira')
    const selected = traditionalAccount('duplicate-ira', 10_000, 'p1', 'ira')
    if (superseded.type !== 'traditional' || selected.type !== 'traditional') {
      throw new Error('fixture did not create traditional accounts')
    }
    superseded.nondeductibleBasis = 80_000
    selected.nondeductibleBasis = 2_000
    plan.accounts = [superseded, selected]
    plan.expenses.baseAnnual = 5_000

    const parsed = parsePlan(plan)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) throw new Error(parsed.issues.join('; '))
    const result = simulatePlan(parsed.plan, {
      startYear: YEAR,
      horizonEndYear: YEAR,
      taxCalculator: createFlatTaxCalculator(0),
    })
    const year = result.years[0]!

    // The logical account has 82,000 basis over 110,000, so 28,000/110,000
    // of the gross is taxable and subject to the 10% early penalty.
    const taxableFraction = 28_000 / 110_000
    const gross = 5_000 / (1 - 0.1 * taxableFraction)
    const taxable = gross * taxableFraction
    expect(year.withdrawals.traditional).toBeCloseTo(gross, 2)
    expect(year.magi).toBeCloseTo(taxable, 2)
    expect(year.penalties).toBeCloseTo(taxable * 0.1, 2)
    expect(year.balances['duplicate-ira']).toBeCloseTo(110_000 - gross, 2)
    expect(year.investableTotal).toBeCloseTo(110_000 - gross, 2)
    // Exact-cent Form 8606 allocation rounds the returned basis before carry.
    expect(result.endingNondeductibleIraBasis).toBe(78_175.38)
    expect(
      year.retirementRuntimeApplicationSource?.applications.filter(
        (application) =>
          application.simulatorPhase === 'legacyNeedBasedWithdrawal' &&
          application.sourceAccountId === 'duplicate-ira',
      ),
    ).toHaveLength(1)
  })

  it('keeps Roth ordering character positional while debiting one selected ID row', () => {
    const plan = singlePersonPlan({
      dob: '1970-01-01',
      planningAge: 70,
      retirementAge: null,
    })
    const rothRow = (
      name: string,
      balance: number,
      contributionBasis: number,
    ): Account => ({
      type: 'roth',
      id: 'duplicate-roth',
      name,
      ownerPersonId: 'p1',
      annualReturnPct: 0,
      kind: 'ira',
      balance,
      annualContribution: 0,
      contributionBasis,
    })
    plan.accounts = [
      rothRow('Superseded Roth row', 100_000, 100_000),
      rothRow('Selected Roth row', 10_000, 0),
    ]
    plan.expenses.baseAnnual = 5_000

    const parsed = parsePlan(plan)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) throw new Error(parsed.issues.join('; '))
    const year = simulatePlan(parsed.plan, {
      startYear: YEAR,
      horizonEndYear: YEAR,
      taxCalculator: createFlatTaxCalculator(0),
    }).years[0]!

    // Roth ordering is owner-pool economics: the earlier row's 100,000 of
    // contribution basis remains wealth and covers this draw. Withdrawal
    // planning and commit are one ID-keyed logical debit allocated pro rata
    // across both physical members.
    expect(year.withdrawals.roth).toBe(5_000)
    expect(year.penalties).toBe(0)
    expect(year.balances['duplicate-roth']).toBe(105_000)
    expect(year.investableTotal).toBe(105_000)
  })
})
