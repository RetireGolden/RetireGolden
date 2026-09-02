/** Hostile seam guard for the core annual-pass publication coordinator. */
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

import {
  singlePersonPlan,
  traditionalAccount,
  validatePlan,
} from '../testing/planFixtures.js'
import { simulatePlan } from './simulate.js'
import type { TaxCalculator } from './types.js'

const zeroTax: TaxCalculator = { compute: () => 0 }

describe('simulatePlan YearResult assembly delegation', () => {
  beforeEach(() => {
    seam.calls.length = 0
  })

  it('commits the exact coordinator object when no outer replay attaches', () => {
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
    expect(published.flexibleGoals).not.toBe(
      committedCall!.natural.flexibleGoals,
    )
    expect(published).not.toHaveProperty('ownedNonRothIraAnnualReplay')
  })

  it('preserves coordinator references through the outer IRA replay attachment', () => {
    const plan = singlePersonPlan({ dob: '1970-01-01', planningAge: 60 })
    plan.id = 'delegated-year-result-with-ira-replay'
    const ira = traditionalAccount('ira', 0.06, 'p1', 'ira')
    if (ira.type !== 'traditional') throw new Error('expected traditional IRA')
    plan.accounts = [
      {
        ...ira,
        annualReturnPct: 0,
        nondeductibleBasis: 0.01,
      },
      {
        type: 'roth',
        id: 'roth',
        name: 'Roth IRA',
        ownerPersonId: 'p1',
        kind: 'ira',
        balance: 0,
        annualReturnPct: 0,
        annualContribution: 0,
      },
    ]
    plan.strategies.rothConversion = {
      mode: 'manual',
      conversions: [{ year: 2026, amount: 0.03 }],
    }

    const result = simulatePlan(validatePlan(plan), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: zeroTax,
    })

    expect(result.years).toHaveLength(1)
    const published = result.years[0]!
    const committedCall = seam.calls.find(
      ({ injected }) => injected.flexibleGoals === published.flexibleGoals,
    )
    expect(committedCall).toBeDefined()
    expect(published).not.toBe(committedCall!.injected)
    expect(published.flexibleGoals).toBe(
      committedCall!.injected.flexibleGoals,
    )
    expect(published.balances).toBe(committedCall!.injected.balances)
    expect(published).toHaveProperty('ownedNonRothIraAnnualReplay')
    expect(Object.keys(published).at(-1)).toBe('ownedNonRothIraAnnualReplay')
  })
})
