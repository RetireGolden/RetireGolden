import { describe, expect, it, vi } from 'vitest'

import type {
  RecordedAnnuityPayment,
  RecordedAnnuityPurchase,
} from './annualCashFlowYearSites.js'
import type {
  AnnualAnnuityPurchaseFundingInput,
  AnnualAnnuityPurchaseFundingRow,
} from './internal/annualAnnuityPurchaseFunding.js'

interface Phase {
  readonly input: AnnualAnnuityPurchaseFundingInput
  readonly inputBalances: readonly Readonly<{
    accountId: string
    balance: number
    costBasis: number
  }>[]
  readonly natural: readonly AnnualAnnuityPurchaseFundingRow[]
  readonly injected: readonly AnnualAnnuityPurchaseFundingRow[]
}

const INJECTED_GAINS = [10_000_000_000_000_000, -10_000_000_000_000_000, 1] as const
const seam = vi.hoisted(() => ({
  mode: 'normal' as 'normal' | 'wrong-position' | 'missing-row' | 'wrong-funding',
  phases: [] as Phase[],
  postPurchaseBalances: [] as (readonly Readonly<{
    accountId: string
    balance: number
    costBasis: number
  }>[])[],
  recorded: [] as RecordedAnnuityPurchase[],
  payments: [] as RecordedAnnuityPayment[],
}))

vi.mock('./internal/annualAnnuityPurchaseFunding.js', async (importOriginal) => {
  const original = await importOriginal<
    typeof import('./internal/annualAnnuityPurchaseFunding.js')
  >()
  return {
    ...original,
    annualAnnuityPurchaseFunding: (
      input: AnnualAnnuityPurchaseFundingInput,
    ) => {
      const natural = original.annualAnnuityPurchaseFunding(input)
      const injected = natural.map((row) => {
        if (row.kind !== 'purchase') return row
        if (seam.mode === 'wrong-position') {
          return { ...row, accountIndex: row.accountIndex + 1 }
        }
        if (seam.mode === 'wrong-funding') {
          return { ...row, fundingIndex: (row.fundingIndex + 1) % input.balances.length }
        }
        const ordinal = row.record.annuityAccountId.startsWith('tax-annuity-')
          ? Number(row.record.annuityAccountId.slice(-1))
          : row.record.annuityAccountId === 'qualified-annuity' ? 3 : 4
        const funded = ordinal === 2 ? 17 : ordinal === 3 ? 13 : ordinal === 4 ? 19 : row.funded
        const record = {
          ...row.record,
          funded,
          capitalGainOrLoss: ordinal < 3 ? INJECTED_GAINS[ordinal]! : 0,
        }
        return {
          ...row,
          warnings: ordinal === 2
            ? [...row.warnings, 'injected annuity funding warning']
            : row.warnings,
          funded,
          capitalGainOrLoss: record.capitalGainOrLoss,
          capitalGainOrLossDelta:
            ordinal < 3 ? INJECTED_GAINS[ordinal]! : row.capitalGainOrLossDelta,
          closingBalance: [71, 62, 53, 87, 81][ordinal]!,
          closingCostBasis:
            ordinal < 3 ? [31, 22, 13][ordinal]! : row.closingCostBasis,
          record,
          debit: row.debit === null
            ? null
            : {
                ...row.debit,
                amountPlanDollars: funded + (ordinal + 1) / 10,
              },
        }
      })
      seam.phases.push({
        input,
        inputBalances: input.balances.map((state) => ({
          accountId: state.account.id,
          balance: state.balance,
          costBasis: state.costBasis,
        })),
        natural,
        injected,
      })
      return seam.mode === 'missing-row' ? injected.slice(1) : injected
    },
  }
})

vi.mock('./internal/distributedTaxableYieldRows.js', async (importOriginal) => {
  const original = await importOriginal<
    typeof import('./internal/distributedTaxableYieldRows.js')
  >()
  return {
    ...original,
    distributedTaxableYieldRows: (
      input: Parameters<typeof original.distributedTaxableYieldRows>[0],
    ) => {
      seam.postPurchaseBalances.push(input.states.map((state) => ({
        accountId: state.account.id,
        balance: state.balance,
        costBasis: 'costBasis' in state ? Number(state.costBasis) : 0,
      })))
      return original.distributedTaxableYieldRows(input)
    },
  }
})

vi.mock('./annualCashFlowYearSites.js', async (importOriginal) => {
  const original = await importOriginal<
    typeof import('./annualCashFlowYearSites.js')
  >()
  return {
    ...original,
    createAnnualCashFlowYearSites: () => {
      const sites = original.createAnnualCashFlowYearSites()
      return new Proxy(sites, {
        get(target, property) {
          if (property === 'recordAnnuityPurchase') {
            return (record: RecordedAnnuityPurchase) => {
              seam.recorded.push(record)
              target.recordAnnuityPurchase(record)
            }
          }
          if (property === 'recordAnnuityPayment') {
            return (record: RecordedAnnuityPayment) => {
              seam.payments.push(record)
              target.recordAnnuityPayment(record)
            }
          }
          const value: unknown = Reflect.get(target, property, target)
          return typeof value === 'function'
            ? (value as (...args: never[]) => unknown).bind(target)
            : value
        },
      })
    },
  }
})

import type { Account, Plan } from '../model/plan.js'
import { packForYear } from '../params/index.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { singlePersonPlan, validatePlan } from '../testing/planFixtures.js'
import { annuityExclusionMultiple } from './annuityForms.js'
import {
  simulatePlan,
  type SimulateAnnualCounterfactualRequest,
} from './simulate.js'
import type { OptimizerYearProbe } from './internal/types/optimizer.js'

const YEAR = 2026

function taxable(id: string): Account {
  return {
    type: 'taxable',
    id,
    name: id,
    ownerPersonId: 'p1',
    annualReturnPct: 0,
    balance: 100,
    costBasis: 40,
    annualContribution: 0,
    interestYieldPct: 0,
    dividendYieldPct: 0,
    taxExemptInterestYieldPct: 0,
  }
}

function annuity(
  id: string,
  fundingAccountId: string,
  taxQualification: 'qualified' | 'nonQualified',
): Account {
  return {
    type: 'annuity',
    id,
    name: id,
    ownerPersonId: 'p1',
    annualReturnPct: null,
    startAge: 56,
    monthlyAmount: id === 'tax-annuity-2' ? 10 / 12 : 0,
    colaPct: 0,
    taxablePct: 100,
    purchase: {
      year: YEAR,
      premium: 10,
      fundingAccountId,
      taxQualification,
    },
  }
}

function plan(): Plan {
  const value = singlePersonPlan({
    dob: '1970-01-01',
    retirementAge: 56,
    planningAge: 90,
  })
  value.id = 'annuity-funding-delegation'
  value.accounts = [
    taxable('tax-source-0'),
    taxable('tax-source-1'),
    taxable('tax-source-2'),
    {
      type: 'traditional',
      kind: 'ira',
      id: 'ira-source',
      name: 'ira-source',
      ownerPersonId: 'p1',
      annualReturnPct: 0,
      balance: 100,
      annualContribution: 0,
    },
    annuity('tax-annuity-0', 'tax-source-0', 'nonQualified'),
    annuity('tax-annuity-1', 'tax-source-1', 'nonQualified'),
    annuity('tax-annuity-2', 'tax-source-2', 'nonQualified'),
    annuity('qualified-annuity', 'ira-source', 'qualified'),
    {
      type: 'traditional',
      kind: 'ira',
      id: 'ira-source-2',
      name: 'ira-source-2',
      ownerPersonId: 'p1',
      annualReturnPct: 0,
      balance: 100,
      annualContribution: 0,
    },
    annuity('qualified-annuity-2', 'ira-source-2', 'qualified'),
  ]
  return validatePlan(value)
}

function run(value = plan()) {
  seam.phases.length = 0
  seam.postPurchaseBalances.length = 0
  seam.recorded.length = 0
  seam.payments.length = 0
  seam.mode = 'normal'
  const probes: OptimizerYearProbe[] = []
  const counterfactualReads: unknown[] = []
  const annualCounterfactual: SimulateAnnualCounterfactualRequest = {
    omitActionIds: [],
    taxUnitId: 'annuity-funding-delegation-unit',
    nonGroupTaxInputs: [{
      inputId: 'federalFilingStatus',
      value: { representation: 'declaredTerm', term: 'single' },
    }],
    capture: (reading) => counterfactualReads.push(reading),
  }
  const result = simulatePlan(value, {
    startYear: YEAR,
    horizonEndYear: YEAR,
    taxCalculator: createFlatTaxCalculator(0),
    captureAnnualCashFlow: true,
    captureOptimizerInputs: (probe) => probes.push(probe),
    annualCounterfactual,
  })
  return { result, probes, counterfactualReads }
}

function purchases(rows: readonly AnnualAnnuityPurchaseFundingRow[]) {
  return rows.filter((row): row is Extract<
    AnnualAnnuityPurchaseFundingRow,
    { kind: 'purchase' }
  > => row.kind === 'purchase')
}

describe('simulatePlan delegates annual annuity-purchase funding', () => {
  it('applies hostile rows once before counterfactual passes and publishes caller-owned effects', () => {
    const originalPlan = plan()
    const before = structuredClone(originalPlan)
    const { result, probes, counterfactualReads } = run(originalPlan)

    expect(originalPlan).toEqual(before)
    expect(seam.phases).toHaveLength(1)
    expect(counterfactualReads).toHaveLength(1)
    expect(seam.phases[0]!.input.accounts).toBe(originalPlan.accounts)
    expect(seam.phases[0]!.input.primaryPerson).toBe(
      originalPlan.household.people[0],
    )
    expect([...seam.phases[0]!.input.peopleById.entries()]).toEqual([
      ['p1', originalPlan.household.people[0]],
    ])
    expect(seam.phases[0]!.input.year).toBe(YEAR)
    expect(seam.phases[0]!.input.qlacPremiumCap).toBe(
      packForYear(YEAR).pack.annuities.qlacPremiumCap,
    )
    expect(seam.phases[0]!.input.limitGrowth).toBe(1)
    expect(seam.phases[0]!.input.balances.map(({ account }) => account)).toEqual([
      originalPlan.accounts[0],
      originalPlan.accounts[1],
      originalPlan.accounts[2],
      originalPlan.accounts[3],
      originalPlan.accounts[8],
    ])
    expect(seam.phases[0]!.inputBalances.map(({ balance, costBasis }) => ({
      balance,
      costBasis,
    }))).toEqual([
      { balance: 100, costBasis: 40 },
      { balance: 100, costBasis: 40 },
      { balance: 100, costBasis: 40 },
      { balance: 100, costBasis: 0 },
      { balance: 100, costBasis: 0 },
    ])
    const rows = purchases(seam.phases[0]!.injected)
    expect(rows).toHaveLength(5)
    expect(rows.map((row) => row.accountIndex)).toEqual([4, 5, 6, 7, 9])
    expect(rows.map((row) => row.fundingIndex)).toEqual([0, 1, 2, 3, 4])

    expect(seam.postPurchaseBalances).toHaveLength(1)
    expect(seam.postPurchaseBalances[0]).toEqual([
      { accountId: 'tax-source-0', balance: 71, costBasis: 31 },
      { accountId: 'tax-source-1', balance: 62, costBasis: 22 },
      { accountId: 'tax-source-2', balance: 53, costBasis: 13 },
      { accountId: 'ira-source', balance: 87, costBasis: 0 },
      { accountId: 'ira-source-2', balance: 81, costBasis: 0 },
    ])
    expect(seam.recorded).toHaveLength(5)
    rows.forEach((row, index) => expect(seam.recorded[index]).toBe(row.record))

    const leftAssociated = ((0 + INJECTED_GAINS[0]) + INJECTED_GAINS[1]) + INJECTED_GAINS[2]
    const regrouped = INJECTED_GAINS[0] + (INJECTED_GAINS[1] + INJECTED_GAINS[2])
    expect(leftAssociated).not.toBe(regrouped)
    expect(result.years[0]!.realizedGains).toBe(leftAssociated)
    expect(result.warnings).toContain('injected annuity funding warning')

    expect(probes).toHaveLength(1)
    expect(probes[0]!.exogenousStrategyAccountMovement).toEqual([
      { accountId: 'ira-source', amount: -13.4 },
      { accountId: 'ira-source-2', amount: -19.5 },
      { accountId: 'tax-source-0', amount: -10.1 },
      { accountId: 'tax-source-1', amount: -10.2 },
      { accountId: 'tax-source-2', amount: -17.3 },
    ])
    const paymentRows = seam.payments.filter(
      ({ accountId }) => accountId === 'tax-annuity-2',
    )
    expect(paymentRows).toHaveLength(1)
    const paymentAccount = originalPlan.accounts.find(
      (account): account is Extract<Account, { type: 'annuity' }> =>
        account.type === 'annuity' && account.id === 'tax-annuity-2',
    )!
    const multiple = annuityExclusionMultiple(
      packForYear(YEAR).pack,
      paymentAccount,
      originalPlan.household.people[0]!,
      undefined,
    )
    for (const payment of paymentRows) {
      expect(payment.paid).toBe(10)
      expect(payment.nonqualifiedExcludable).toBe(
        10 * (17 / (10 * multiple)),
      )
    }
    const applications = result.years[0]!.retirementRuntimeApplicationSource
      ?.applications ?? []
    expect(applications.map(({ mutationOrdinal, simulatorPhase }) => ({
      mutationOrdinal,
      simulatorPhase,
    }))).toEqual([
      { mutationOrdinal: 1, simulatorPhase: 'annuityPurchaseFunding' },
      { mutationOrdinal: 2, simulatorPhase: 'annuityPurchaseFunding' },
      { mutationOrdinal: 3, simulatorPhase: 'annuityPurchaseContractCredit' },
      { mutationOrdinal: 4, simulatorPhase: 'annuityPurchaseContractCredit' },
    ])
    expect(applications[0]).toMatchObject({
      sourceBalanceBeforePlanDollars: 100,
      appliedAmountPlanDollars: 13,
      sourceBalanceAfterPlanDollars: 87,
    })
    expect(applications[1]).toMatchObject({
      sourceBalanceBeforePlanDollars: 100,
      appliedAmountPlanDollars: 19,
      sourceBalanceAfterPlanDollars: 81,
    })
    expect(applications[2]).toMatchObject({
      destinationAnnuityAccountId: 'qualified-annuity',
      destinationContractValueBeforePlanDollars: 0,
      destinationCreditedAmountPlanDollars: 13,
      destinationContractValueAfterPlanDollars: 13,
    })
    expect(applications[3]).toMatchObject({
      destinationAnnuityAccountId: 'qualified-annuity-2',
      destinationContractValueBeforePlanDollars: 0,
      destinationCreditedAmountPlanDollars: 19,
      destinationContractValueAfterPlanDollars: 19,
    })
    const occurrences = result.years[0]!.retirementRuntimeSource
      ?.runtimeOccurrences.filter(({ kind }) => kind === 'annuityFundingTransfer') ?? []
    expect(occurrences).toMatchObject([
      {
        kind: 'annuityFundingTransfer',
        grossAmountPlanDollars: 13,
        ownerPersonId: 'p1',
        sourceAccountId: 'ira-source',
      },
      {
        kind: 'annuityFundingTransfer',
        grossAmountPlanDollars: 19,
        ownerPersonId: 'p1',
        sourceAccountId: 'ira-source-2',
      },
    ])
  })

  it('rejects same-cardinality rows that lose their Plan position', () => {
    seam.mode = 'wrong-position'
    seam.phases.length = 0
    expect(() => simulatePlan(plan(), {
      startYear: YEAR,
      horizonEndYear: YEAR,
      taxCalculator: createFlatTaxCalculator(0),
    })).toThrowError('Annuity-purchase funding row lost its position')
  })

  it.each([
    ['missing-row', 'Annuity-purchase funding row lost its position'],
    ['wrong-funding', 'Annuity-purchase funding row lost its position'],
  ] as const)('rejects %s helper output', (mode, message) => {
    seam.mode = mode
    seam.phases.length = 0
    expect(() => simulatePlan(plan(), {
      startYear: YEAR,
      horizonEndYear: YEAR,
      taxCalculator: createFlatTaxCalculator(0),
    })).toThrowError(message)
  })

  it('re-enters from fresh plan state after a complete hostile run', () => {
    const value = plan()
    const first = run(value)
    const firstPhase = structuredClone(seam.phases[0]!.inputBalances)
    const firstYear = structuredClone(first.result.years[0])
    const second = run(value)

    expect(seam.phases).toHaveLength(1)
    expect(seam.phases[0]!.inputBalances).toEqual(firstPhase)
    expect(second.result.years[0]).toEqual(firstYear)
    expect(second.counterfactualReads).toEqual(first.counterfactualReads)
  })
})
