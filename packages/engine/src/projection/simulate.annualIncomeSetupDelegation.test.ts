/**
 * Delegation and live-identity guards for the annual income-setup boundary.
 * The child producer suites own selection details. This file proves their
 * combined result is the one the caller mutates, records, and passes onward.
 */
import { describe, expect, it, vi } from 'vitest'

import type { Account, Plan } from '../model/plan.js'
import {
  cashAccount,
  singlePersonPlan,
  taxableAccount,
  validatePlan,
} from '../testing/planFixtures.js'
import type {
  RecordedDistributedYield,
  RecordedWage,
} from './annualCashFlowYearSites.js'
import type {
  AnnualIncomeSetupInput,
  AnnualIncomeSetupResult,
} from './internal/annualIncomeSetup.js'

interface PhaseCall {
  readonly input: AnnualIncomeSetupInput
  readonly inputBalances: readonly Readonly<{
    accountId: string
    balance: number
  }>[]
  readonly natural: AnnualIncomeSetupResult
  readonly returned: AnnualIncomeSetupResult
  readonly distributedYieldRecords: RecordedDistributedYield[]
  readonly wageRecords: RecordedWage[]
  socialSecurityWagesByPerson?: ReadonlyMap<string, number>
  assembledDistributedYieldByAccountId?: AnnualIncomeSetupResult['distributedYieldByAccountId']
  assembledTaxableYieldReinvested?: number
}

const seam = vi.hoisted(() => ({
  calls: [] as PhaseCall[],
  injectCounterfactual: false,
  activeDistributedYieldRecords: [] as RecordedDistributedYield[],
  activeWageRecords: [] as RecordedWage[],
}))

vi.mock('./internal/annualIncomeSetup.js', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('./internal/annualIncomeSetup.js')>()
  return {
    ...original,
    annualIncomeSetup: (input: AnnualIncomeSetupInput) => {
      seam.activeDistributedYieldRecords.length = 0
      seam.activeWageRecords.length = 0
      const natural = original.annualIncomeSetup(input)
      const returned: AnnualIncomeSetupResult = seam.injectCounterfactual
        ? {
            ...natural,
            incomes: { ...natural.incomes },
            ordinaryIncome: natural.ordinaryIncome + 19,
          }
        : natural
      seam.calls.push({
        input,
        inputBalances: input.distributedYield.states.map((state) => ({
          accountId: state.account.id,
          balance: state.balance,
        })),
        natural,
        returned,
        distributedYieldRecords: [...seam.activeDistributedYieldRecords],
        wageRecords: [...seam.activeWageRecords],
      })
      return returned
    },
  }
})

vi.mock('./annualCashFlowYearSites.js', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('./annualCashFlowYearSites.js')>()
  return {
    ...original,
    createAnnualCashFlowYearSites: () => {
      const sites = original.createAnnualCashFlowYearSites()
      return new Proxy(sites, {
        get(target, prop) {
          if (prop === 'recordDistributedYield') {
            return (record: RecordedDistributedYield) => {
              seam.activeDistributedYieldRecords.push(record)
              target.recordDistributedYield(record)
            }
          }
          if (prop === 'recordWages') {
            return (record: RecordedWage) => {
              seam.activeWageRecords.push(record)
              target.recordWages(record)
            }
          }
          const value: unknown = Reflect.get(target, prop, target)
          return typeof value === 'function'
            ? (value as (...args: never[]) => unknown).bind(target)
            : value
        },
      })
    },
  }
})

vi.mock('./internal/annualSocialSecurity.js', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('./internal/annualSocialSecurity.js')>()
  return {
    ...original,
    annualSocialSecurity: (
      input: Parameters<typeof original.annualSocialSecurity>[0],
    ) => {
      const call = seam.calls.at(-1)
      if (call !== undefined) {
        call.socialSecurityWagesByPerson = input.wagesByPerson
      }
      return original.annualSocialSecurity(input)
    },
  }
})

vi.mock('./annualCashFlowCapture.js', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('./annualCashFlowCapture.js')>()
  return {
    ...original,
    assembleYearCashFlow: (
      input: Parameters<typeof original.assembleYearCashFlow>[0],
    ) => {
      const call = seam.calls.at(-1)
      if (call !== undefined) {
        call.assembledDistributedYieldByAccountId =
          input.distributedYieldByAccountId
        call.assembledTaxableYieldReinvested = input.taxableYieldReinvested
      }
      return original.assembleYearCashFlow(input)
    },
  }
})

import type {
  CounterfactualAnnualLiabilityResult,
  SimulateAnnualCounterfactualRequest,
} from './simulate.js'
import { simulatePlan } from './simulate.js'
import type {
  TaxCalculator,
} from './types.js'

const zeroTax: TaxCalculator = { compute: () => 0 }
const START_YEAR = 2026
const END_YEAR = 2027

function plan(): Plan {
  const value = singlePersonPlan({
    dob: '1970-01-01',
    planningAge: 90,
  })
  const taxable = taxableAccount(
    'taxable-yield',
    100_000,
    50_000,
  ) as Extract<Account, { type: 'taxable' }>
  value.accounts = [
    cashAccount('cash', 1_000_000),
    {
      ...taxable,
      interestYieldPct: 1,
      dividendYieldPct: 2,
      qualifiedRatio: 0.5,
      taxExemptInterestYieldPct: 0.25,
      reinvestDividends: false,
    },
  ]
  value.incomes = [
    {
      type: 'wages',
      id: 'wage-first',
      personId: 'p1',
      annualGross: 20_000,
      endAge: 80,
      realGrowthPct: 0,
    },
    {
      type: 'wages',
      id: 'wage-second',
      personId: 'p1',
      annualGross: 30_000,
      endAge: 80,
      realGrowthPct: 0,
    },
  ]
  return validatePlan(value)
}

function annuityFundedYieldPlan(): Plan {
  const value = singlePersonPlan({
    dob: '1970-01-01',
    planningAge: 90,
  })
  const taxable = taxableAccount(
    'annuity-yield-source',
    100_000,
    50_000,
  ) as Extract<Account, { type: 'taxable' }>
  value.accounts = [
    cashAccount('cash', 1_000_000),
    {
      ...taxable,
      annualReturnPct: 0,
      interestYieldPct: 10,
      dividendYieldPct: 0,
      taxExemptInterestYieldPct: 0,
      reinvestDividends: false,
    },
    {
      type: 'annuity',
      id: 'taxable-funded-annuity',
      name: 'taxable-funded-annuity',
      ownerPersonId: 'p1',
      annualReturnPct: null,
      startAge: 56,
      monthlyAmount: 0,
      colaPct: 0,
      taxablePct: 100,
      purchase: {
        year: START_YEAR,
        premium: 40_000,
        fundingAccountId: taxable.id,
        taxQualification: 'nonQualified',
      },
    },
  ]
  return validatePlan(value)
}

function counterfactual(
  captured: CounterfactualAnnualLiabilityResult[],
): SimulateAnnualCounterfactualRequest {
  return {
    omitActionIds: [],
    taxUnitId: 'income-setup-counterfactual',
    nonGroupTaxInputs: [
      {
        inputId: 'federalFilingStatus',
        value: { representation: 'declaredTerm', term: 'single' },
      },
    ],
    capture: (result) => captured.push(result),
  }
}

function run(
  options: { inject?: boolean; reenter?: boolean } = {},
  target = plan(),
) {
  seam.calls.length = 0
  seam.injectCounterfactual = options.inject === true
  const captured: CounterfactualAnnualLiabilityResult[] = []
  const result = simulatePlan(target, {
    startYear: START_YEAR,
    horizonEndYear: END_YEAR,
    taxCalculator: zeroTax,
    captureAnnualCashFlow: true,
    ...(options.reenter === true
      ? { annualCounterfactual: counterfactual(captured) }
      : {}),
  })
  return { target, result, captured, calls: [...seam.calls] }
}

describe('simulatePlan delegates annual income setup', () => {
  it('calls once per year and retains the returned live object and maps', () => {
    const { target, result, calls } = run()

    expect(calls).toHaveLength(result.years.length)
    expect(calls).toHaveLength(END_YEAR - START_YEAR + 1)
    for (let index = 0; index < calls.length; index++) {
      const call = calls[index]!
      const year = result.years[index]!
      expect(call.input.wages.incomes).toBe(target.incomes)
      expect(call.input.distributedYield.states).toBe(
        calls[0]!.input.distributedYield.states,
      )
      expect(call.input.wages.year).toBe(year.year)
      expect(year.incomes).toBe(call.returned.incomes)
      expect(call.socialSecurityWagesByPerson).toBe(
        call.returned.wagesByPerson,
      )
      expect(call.assembledDistributedYieldByAccountId).toBe(
        call.returned.distributedYieldByAccountId,
      )
      expect(call.assembledTaxableYieldReinvested).toBe(
        call.returned.taxableYieldReinvested,
      )

      const yieldRows = call.returned.distributedYieldRows.filter(
        (row) => row.kind === 'yield',
      )
      expect(call.distributedYieldRecords).toHaveLength(yieldRows.length)
      for (let row = 0; row < yieldRows.length; row++) {
        expect(call.distributedYieldRecords[row]).toBe(yieldRows[row]!.record)
      }
      expect(call.wageRecords).toHaveLength(call.returned.wageRows.length)
      for (let row = 0; row < call.returned.wageRows.length; row++) {
        expect(call.wageRecords[row]).toBe(call.returned.wageRows[row]!.record)
      }
    }
  })

  it('publishes fixture-derived yield and wage totals independently of the seam', () => {
    const { result } = run()
    const first = result.years[0]!

    expect(first.incomes.wages).toBe(50_000)
    expect(first.incomes.taxableInterest).toBe(1_000)
    expect(first.incomes.ordinaryDividends).toBe(1_000)
    expect(first.incomes.qualifiedDividends).toBe(1_000)
    expect(first.incomes.taxableYield).toBe(3_000)
    expect(first.incomes.taxExemptInterest).toBe(250)
    expect(first.incomes.total).toBe(53_250)
  })

  it('runs annuity funding before setup while retaining opening-balance yield', () => {
    const { result, calls } = run({}, annuityFundedYieldPlan())
    const first = calls[0]!
    const taxableAtSetup = first.inputBalances.find(
      ({ accountId }) => accountId === 'annuity-yield-source',
    )

    // The purchase phase has already applied its $40,000 debit when the
    // extracted setup receives live balances. Distributed yield nevertheless
    // retains the pre-existing annual contract: it prices from the separately
    // captured start-of-year map, not from that post-purchase live balance.
    expect(taxableAtSetup).toEqual({
      accountId: 'annuity-yield-source',
      balance: 60_000,
    })
    const taxableBalanceIndex = first.inputBalances.findIndex(
      ({ accountId }) => accountId === 'annuity-yield-source',
    )
    expect(
      first.input.distributedYield.startOfYearBalances[taxableBalanceIndex],
    ).toBe(100_000)
    expect(first.natural.incomes.taxableInterest).toBe(10_000)
    expect(result.years[0]!.incomes.taxableInterest).toBe(10_000)
  })

  it('consumes a counterfactual return and stays outside annual-pass re-entry', () => {
    const baseline = run()
    const injected = run({ inject: true, reenter: true })

    expect(injected.captured).toHaveLength(injected.result.years.length)
    expect(injected.calls).toHaveLength(injected.result.years.length)
    for (let index = 0; index < injected.calls.length; index++) {
      const call = injected.calls[index]!
      const year = injected.result.years[index]!
      const baselineYear = baseline.result.years[index]!
      expect(call.returned.incomes).not.toBe(call.natural.incomes)
      expect(year.incomes).toBe(call.returned.incomes)
      expect(year.incomes).not.toBe(call.natural.incomes)
      expect(year.magi - baselineYear.magi).toBe(19)
    }
  })

  it('allocates fresh result state when the same parsed plan is simulated again', () => {
    const target = plan()
    const first = run({}, target)
    const second = run({}, target)

    expect(first.result).toEqual(second.result)
    for (let index = 0; index < first.calls.length; index++) {
      expect(first.calls[index]!.returned.incomes).not.toBe(
        second.calls[index]!.returned.incomes,
      )
      expect(first.calls[index]!.returned.wagesByPerson).not.toBe(
        second.calls[index]!.returned.wagesByPerson,
      )
      expect(first.calls[index]!.returned.distributedYieldByAccountId).not.toBe(
        second.calls[index]!.returned.distributedYieldByAccountId,
      )
    }
  })
})
