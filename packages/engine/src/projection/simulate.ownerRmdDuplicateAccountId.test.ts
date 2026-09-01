import { describe, expect, it } from 'vitest'

import { parsePlan, type Account } from '../model/plan.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import {
  cashAccount,
  singlePersonPlan,
  traditionalAccount,
} from '../testing/planFixtures.js'
import { simulatePlan } from './simulate.js'
import type { OptimizerYearProbe } from './types.js'

const YEAR = 2026

describe('simulatePlan owner RMD duplicate account IDs', () => {
  it('uses the last ID row once while a distinct account still distributes', () => {
    // Unreferenced duplicate account IDs are intentionally parseable. Every
    // ID-keyed annual state channel is last-wins: the prior-Dec-31 balance Map
    // and published balance record therefore select the second duplicate row.
    // At age 73 the Uniform Lifetime divisor is 26.5, so the independently
    // derived obligations are 53,000 / 26.5 = 2,000 and
    // 79,500 / 26.5 = 3,000. One candidate and one debit per ID must publish
    // exactly 5,000; processing the duplicate twice previously published
    // 11,000 by applying its combined 4,000 take to both duplicate rows.
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
    const duplicateObligation = 53_000 / 26.5
    const distinctObligation = 79_500 / 26.5
    expect(duplicateObligation).toBe(2_000)
    expect(distinctObligation).toBe(3_000)

    const year = simulatePlan(parsed.plan, {
      startYear: YEAR,
      horizonEndYear: YEAR,
      taxCalculator: createFlatTaxCalculator(0),
      captureAnnualCashFlow: true,
    }).years[0]!

    expect(year.rmd).toBe(duplicateObligation + distinctObligation)
    expect(year.balances).toMatchObject({
      'duplicate-ira': 53_000 - duplicateObligation,
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
        sourceBalanceBeforePlanDollars: 53_000,
        appliedAmountPlanDollars: duplicateObligation,
        sourceBalanceAfterPlanDollars: 53_000 - duplicateObligation,
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

  it('uses unique last rows for April 1 capacity and the current-year IRA sweep', () => {
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
    const duplicateDeferred = 2_000 / 26.5
    const distinctDeferred = 79_500 / 26.5
    const duplicateCurrent = 2_000 / 25.5
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
    const distinctTake =
      (deferredRequired - 2_000) + distinctCurrent + duplicateCurrent
    expect(dueYear.rmd).toBe(2_000 + distinctTake)
    expect(dueYear.balances).toMatchObject({
      'duplicate-ira': 0,
      'distinct-ira': 79_500 - distinctTake,
    })
    expect(
      dueYear.retirementRuntimeApplicationSource?.applications.filter(
        (application) => application.simulatorPhase === 'ownerRmdDistribution',
      ),
    ).toEqual([
      expect.objectContaining({
        mutationOrdinal: 1,
        sourceAccountId: 'duplicate-ira',
        sourceBalanceBeforePlanDollars: 2_000,
        appliedAmountPlanDollars: 2_000,
        sourceBalanceAfterPlanDollars: 0,
      }),
      expect.objectContaining({
        mutationOrdinal: 2,
        sourceAccountId: 'distinct-ira',
        sourceBalanceBeforePlanDollars: 79_500,
        appliedAmountPlanDollars: distinctTake,
        sourceBalanceAfterPlanDollars: 79_500 - distinctTake,
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

  it('selects the same last row once on the inherited RMD path', () => {
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
    const required = 300_000 / 25.9
    const year = simulatePlan(parsed.plan, {
      startYear: YEAR,
      horizonEndYear: YEAR,
      taxCalculator: createFlatTaxCalculator(0),
      captureAnnualCashFlow: true,
    }).years[0]!

    expect(year.inheritedDistribution).toBeCloseTo(required, 10)
    expect(year.balances['inherited-ira']).toBeCloseTo(300_000 - required, 10)
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

  it('executes an active SEPP once from the selected RMD row', () => {
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
    expect(year.sepp).toBe(10_000)
    expect(year.balances['duplicate-ira']).toBe(296_000)
    expect(
      year.retirementRuntimeSource?.runtimeOccurrences.filter(
        (occurrence) => occurrence.kind === 'automaticSeppDistribution',
      ),
    ).toHaveLength(1)
  })

  it('uses the selected row for QCD capacity and Form 8606 basis', () => {
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

    // Pub. 590-B Uniform Lifetime Table divisor at age 76 is 23.7. The
    // selected 100,000 row—not the two rows' 1,100,000 sum—sets both the
    // requirement and the §408(d)(8)(D) aggregate includible ceiling.
    expect(year.rmd).toBeCloseTo(100_000 / 23.7, 10)
    expect(year.qcd).toBe(50_000)
    expect(year.balances['duplicate-ira']).toBe(50_000)
    expect(
      year.retirementRuntimeSource?.runtimeOccurrences.filter(
        (occurrence) => occurrence.kind === 'legacyQcd',
      ),
    ).toHaveLength(1)
    expect(result.endingNondeductibleIraBasis).toBe(50_000)
    expect(year.ownedTraditionalIraAggregateActivity).toEqual([])
  })

  it('seeds Form 8606 basis from the selected row rather than summing aliases', () => {
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

    // The ID-keyed balance/denominator is 100,000. Its matching last row owns
    // 10,000 of basis; summing both aliases would incorrectly publish 50,000.
    expect(result.years[0]?.balances['duplicate-ira']).toBe(100_000)
    expect(result.endingNondeductibleIraBasis).toBe(10_000)
  })

  it('uses the selected row once in the optimizer opening snapshot', () => {
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
    expect(probes[0]?.startTraditional).toBe(30_000)
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

    // Publication is ID-keyed and therefore selects 50,000 -> 55,000 ->
    // 60,500. Economic growth and investable wealth remain positional, so the
    // superseded 100,000 row grows beside it: 165,000 -> 181,500 in total.
    expect(years[0]!.balances['duplicate-ira']).toBeCloseTo(55_000, 8)
    expect(years[1]!.balances['duplicate-ira']).toBeCloseTo(60_500, 8)
    expect(years[0]!.investableTotal).toBeCloseTo(165_000, 8)
    expect(years[1]!.investableTotal).toBeCloseTo(181_500, 8)
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

    // At age 56, 20% basis makes 80% of the gross taxable and subject to the
    // 10% early-distribution penalty. Solve g - .10(.80g) = 5,000.
    const gross = 5_000 / 0.92
    const taxable = gross * 0.8
    expect(year.withdrawals.traditional).toBeCloseTo(gross, 2)
    expect(year.magi).toBeCloseTo(taxable, 2)
    expect(year.penalties).toBeCloseTo(taxable * 0.1, 2)
    expect(year.balances['duplicate-ira']).toBeCloseTo(10_000 - gross, 2)
    expect(year.investableTotal).toBeCloseTo(110_000 - gross, 2)
    expect(result.endingNondeductibleIraBasis).toBeCloseTo(2_000 - gross * 0.2, 2)
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

    // Roth ordering is owner-pool economics: the superseded row's 100,000 of
    // contribution basis remains wealth and covers this draw. Withdrawal
    // planning and commit are still ID-keyed, so only the selected 10,000 row
    // loses the 5,000. Last-row-only character would instead penalize earnings.
    expect(year.withdrawals.roth).toBe(5_000)
    expect(year.penalties).toBe(0)
    expect(year.balances['duplicate-roth']).toBe(5_000)
    expect(year.investableTotal).toBe(105_000)
  })
})
