/** Hostile seam guard for the final annual-publication coordinator. */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  AnnualYearResultAssemblyInput,
} from './internal/annualYearResultAssembly.js'
import type { YearResult } from './types.js'

interface AssemblyCall {
  readonly input: AnnualYearResultAssemblyInput
  readonly natural: YearResult
  readonly injected: YearResult
}

const seam = vi.hoisted(() => ({ calls: [] as AssemblyCall[] }))

vi.mock('./internal/annualYearResultAssembly.js', async (importOriginal) => {
  const original = await importOriginal<
    typeof import('./internal/annualYearResultAssembly.js')
  >()
  return {
    ...original,
    annualYearResultAssembly: (
      input: AnnualYearResultAssemblyInput,
    ): YearResult => {
      const natural = original.annualYearResultAssembly(input)
      const ordinal = seam.calls.length
      const injected: YearResult = {
        ...natural,
        balances: { [`delegated-year-result-${ordinal}`]: 90_000 + ordinal },
        flexibleGoals: {
          funded: 100 + ordinal,
          partiallyFunded: 200 + ordinal,
          deferred: 300 + ordinal,
          skipped: 400 + ordinal,
          fundedAmount: 500 + ordinal,
          unfundedAmount: 600 + ordinal,
        },
      }
      seam.calls.push({ input, natural, injected })
      return injected
    },
  }
})

import { singlePersonPlan, validatePlan } from '../testing/planFixtures.js'
import { simulatePlan } from './simulate.js'
import type { TaxCalculator } from './types.js'

const zeroTax: TaxCalculator = { compute: () => 0 }

describe('simulatePlan YearResult assembly delegation', () => {
  beforeEach(() => {
    seam.calls.length = 0
  })

  it('commits the coordinator-owned object and its injected references', () => {
    const plan = singlePersonPlan({ dob: '1970-01-01', planningAge: 60 })
    plan.accounts = []
    plan.expenses.baseAnnual = 0
    plan.expenses.healthcare = {
      pre65MonthlyPremiumPerPerson: 0,
      applyAcaCredit: false,
      medicareExtrasMonthlyPerPerson: 0,
    }

    const result = simulatePlan(validatePlan(plan), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: zeroTax,
    })

    expect(seam.calls.length).toBeGreaterThan(0)
    expect(result.years).toHaveLength(1)
    const published = result.years[0]!
    const committedCall = seam.calls.find(
      ({ injected }) => injected === published,
    )
    expect(committedCall).toBeDefined()
    expect(published.balances).toBe(committedCall!.injected.balances)
    expect(published.flexibleGoals).toBe(
      committedCall!.injected.flexibleGoals,
    )
    expect(committedCall!.input).toMatchObject({
      chronology: { year: 2026, filingStatus: 'single' },
      ledger: { contributions: 0, employerMatch: 0 },
      retirement: { rmd: 0, sepp: 0, qcd: 0, rothConversion: 0 },
      tax: { penalties: 0, tax: 0 },
      funding: { surplusInvested: 0, shortfall: 0 },
      balanceSheet: { ladderValue: 0, deathBenefit: 0, hecmDraw: 0 },
    })
    expect(committedCall!.input.cashFlowInput).toBeUndefined()
    expect(committedCall!.natural.balances).toEqual({})
    expect(published.balances).not.toBe(committedCall!.natural.balances)
  })
})
