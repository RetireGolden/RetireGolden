/**
 * Delegation guard for annual property carrying costs. The mock runs the real
 * helper, then returns three cancellation-sensitive positional rows whose
 * records share a duplicate id. Downstream expenses and recorder-call identity
 * prove that `simulatePlan` consumes the returned rows rather than retaining an
 * inline copy, collapsing by id, rebuilding records, or changing row order.
 *
 * Scaffolding and the policy behind it live in
 * `simulate.seamGuard.test-support.ts`; the sentinels stay here.
 */
import { describe, expect, it, vi } from 'vitest'

import type { RecordedAccountAmount } from './annualCashFlowYearSites.js'
import type {
  AnnualPropertyCarryingCostsInput,
  AnnualPropertyCarryingCostRow,
} from './internal/annualPropertyCarryingCosts.js'

const hostile = vi.hoisted(() => ({
  recorded: [] as RecordedAccountAmount[],
}))

const seam = await vi.hoisted(
  async () =>
    (
      await import('./simulate.seamGuard.test-support.js')
    ).createSeamRecorder<
      AnnualPropertyCarryingCostsInput,
      readonly AnnualPropertyCarryingCostRow[]
    >(),
)

vi.mock('./internal/annualPropertyCarryingCosts.js', async (importOriginal) =>
  seam.through(
    await importOriginal<
      typeof import('./internal/annualPropertyCarryingCosts.js')
    >(),
    'annualPropertyCarryingCosts',
    (natural): readonly AnnualPropertyCarryingCostRow[] => {
      if (natural.length !== 3) {
        throw new Error(`delegation fixture expected 3 property rows, received ${natural.length}`)
      }
      const amounts = [1e16, -1e16, 1] as const
      const recordAmounts = [2e16, -2e16, 3] as const
      return natural.map((row, index) => {
        const amount = amounts[index]!
        const record: RecordedAccountAmount = {
          accountId: 'sentinel-duplicate-property',
          ownerPersonId: `sentinel-owner-${index}`,
          amount: recordAmounts[index]!,
        }
        return { ...row, amount, record }
      })
    },
  ),
)

vi.mock('./annualCashFlowYearSites.js', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('./annualCashFlowYearSites.js')>()
  return {
    ...original,
    createAnnualCashFlowYearSites: () => {
      const sites = original.createAnnualCashFlowYearSites()
      return new Proxy(sites, {
        get(target, prop) {
          if (prop === 'recordPropertyCosts') {
            return (row: RecordedAccountAmount) => {
              hostile.recorded.push(row)
              target.recordPropertyCosts(row)
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

import {
  expectPublishedFromSeam,
  expectSeamRan,
} from './simulate.seamGuard.test-support.js'
import type { Account, Plan } from '../model/plan.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { cashAccount, singlePersonPlan, validatePlan } from '../testing/planFixtures.js'
import { simulatePlan } from './simulate.js'

const START_YEAR = 2026
const END_YEAR = 2027
const noTax = createFlatTaxCalculator(0)

function property(
  id: string,
  propertyTaxAnnual: number,
  insuranceAnnual: number,
): Extract<Account, { type: 'property' }> {
  return {
    type: 'property',
    id,
    name: id,
    ownerPersonId: 'p1',
    annualReturnPct: 0,
    value: 100_000,
    plannedSaleYear: null,
    expectedNetProceeds: null,
    propertyTaxAnnual,
    insuranceAnnual,
  }
}

function plan(): Plan {
  const value = singlePersonPlan({ dob: '1966-01-01', planningAge: 62 })
  value.assumptions.inflationPct = 25
  value.assumptions.defaultReturnPct = 0
  value.expenses.baseAnnual = 0
  value.expenses.healthcare = {
    pre65MonthlyPremiumPerPerson: 0,
    applyAcaCredit: false,
    medicareExtrasMonthlyPerPerson: 0,
  }
  value.accounts = [
    cashAccount('cash', 100_000),
    property('first-property', 10, 1),
    property('second-property', 20, 2),
    property('third-property', 30, 3),
  ]
  return validatePlan(value)
}

describe('simulatePlan delegates annual property carrying costs', () => {
  it('passes the live annual inputs and preserves all natural property rows', () => {
    seam.reset()
    hostile.recorded.length = 0
    const input = plan()
    const result = simulatePlan(input, {
      startYear: START_YEAR,
      horizonEndYear: END_YEAR,
      taxCalculator: noTax,
      captureAnnualCashFlow: true,
    })

    expect(result.years).toHaveLength(2)
    const phases = expectSeamRan(seam, result.years.length)
    expect(phases.map((phase) => phase.input.year)).toEqual([START_YEAR, END_YEAR])
    expect(phases.map((phase) => phase.input.inflFactor)).toEqual([1, 1.25])
    for (const phase of phases) {
      expect(phase.input.accounts).toBe(input.accounts)
      expect(phase.input.anyAlive).toBe(true)
      expect(phase.natural.map((row) => row.account.id)).toEqual([
        'first-property',
        'second-property',
        'third-property',
      ])
    }
    expect(phases[0]!.natural.map((row) => row.amount)).toEqual([11, 22, 33])
    expect(phases[1]!.natural.map((row) => row.amount)).toEqual([13.75, 27.5, 41.25])
  })

  it('folds and records every returned row in order without rebuilding payloads', () => {
    seam.reset()
    hostile.recorded.length = 0
    const result = simulatePlan(plan(), {
      startYear: START_YEAR,
      horizonEndYear: END_YEAR,
      taxCalculator: noTax,
      captureAnnualCashFlow: true,
    })
    const phases = expectSeamRan(seam, result.years.length)

    // Sequentially: 0 + 1e16 - 1e16 + 1 = 1. Reversing the rows produces 0.
    expect([...phases[0]!.injected].reverse().reduce(
      (total, row) => total + row.amount,
      0,
    )).toBe(0)
    expect(phases[0]!.injected.reduce(
      (total, row) => total + row.record.amount,
      0,
    )).toBe(3)
    expect(result.years.map((year) => year.expenses.propertyCosts)).toEqual([1, 1])
    expect(hostile.recorded).toHaveLength(phases.length * 3)
    for (const [phaseIndex, phase] of phases.entries()) {
      const calls = hostile.recorded.slice(phaseIndex * 3, phaseIndex * 3 + 3)
      expect(phase.injected.map((row) => row.amount)).toEqual([1e16, -1e16, 1])
      expect(calls.map((record) => record.amount)).toEqual([2e16, -2e16, 3])
      expect(calls.map((record) => record.accountId)).toEqual([
        'sentinel-duplicate-property',
        'sentinel-duplicate-property',
        'sentinel-duplicate-property',
      ])
      for (let index = 0; index < calls.length; index++) {
        expectPublishedFromSeam(
          calls[index],
          phase.injected[index]!.record,
          'the recorded property-cost payload',
        )
        expect(phase.injected[index]!.amount).not.toBe(
          phase.injected[index]!.record.amount,
        )
      }
    }
  })
})
