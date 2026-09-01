import { describe, expect, it } from 'vitest'

import { parsePlan, type Account } from '../model/plan.js'
import { packForYear } from '../params/index.js'
import { requiredMinimumDistribution } from '../rmd/rmd.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import {
  cashAccount,
  singlePersonPlan,
  traditionalAccount,
} from '../testing/planFixtures.js'
import { simulatePlan } from './simulate.js'

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

    const owner = parsed.plan.household.people[0]!
    const pack = packForYear(YEAR).pack
    const duplicateObligation = requiredMinimumDistribution(
      pack,
      1953,
      73,
      53_000,
      { ownerSex: owner.sex },
    )
    const distinctObligation = requiredMinimumDistribution(
      pack,
      1953,
      73,
      79_500,
      { ownerSex: owner.sex },
    )
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

    const pack = packForYear(YEAR).pack
    const owner = parsed.plan.household.people[0]!
    const duplicateDeferred = requiredMinimumDistribution(
      pack,
      1953,
      73,
      2_000,
      { ownerSex: owner.sex },
    )
    const distinctDeferred = requiredMinimumDistribution(
      pack,
      1953,
      73,
      79_500,
      { ownerSex: owner.sex },
    )
    const duplicateCurrent = requiredMinimumDistribution(
      pack,
      1953,
      74,
      2_000,
      { ownerSex: owner.sex },
    )
    const distinctCurrent = requiredMinimumDistribution(
      pack,
      1953,
      74,
      79_500,
      { ownerSex: owner.sex },
    )

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
})
