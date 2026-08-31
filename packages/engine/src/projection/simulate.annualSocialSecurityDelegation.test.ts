/** Hostile seam guard: the helper returns values that disagree with its natural
 * calculation, so every downstream channel must prove which result it used. */
import { describe, expect, it, vi } from 'vitest'

import type {
  AnnualSocialSecurityInput,
  AnnualSocialSecurityResult,
} from './internal/annualSocialSecurity.js'

interface Phase {
  readonly input: AnnualSocialSecurityInput
  readonly withheldAtCall: readonly (readonly [string, number])[]
  readonly natural: AnnualSocialSecurityResult
  readonly injected: AnnualSocialSecurityResult
}

const seam = vi.hoisted(() => ({ phases: [] as Phase[] }))

vi.mock('./internal/annualSocialSecurity.js', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('./internal/annualSocialSecurity.js')>()
  return {
    ...original,
    annualSocialSecurity: (input: AnnualSocialSecurityInput) => {
      const natural = original.annualSocialSecurity(input)
      const ordinal = input.year - 2026
      const activities = [
        {
          personId: 'p1',
          streamId: 'ss-delegated-first',
          source: 'own-retirement' as const,
          annualAmount: 9_000 + ordinal,
          claimInForce: true,
          preWithholdingAnnual: 9_500 + ordinal,
          isSpousalSurvivorGateStream: false,
        },
        {
          personId: 'p1',
          streamId: 'ss-delegated-zero',
          source: 'none' as const,
          annualAmount: 0,
          claimInForce: false,
          preWithholdingAnnual: 0,
          isSpousalSurvivorGateStream: false,
        },
        {
          personId: 'p1',
          streamId: 'ss-delegated-last',
          source: 'survivor' as const,
          annualAmount: 3_000,
          claimInForce: true,
          preWithholdingAnnual: 3_500,
          isSpousalSurvivorGateStream: true,
        },
      ]
      const injected: AnnualSocialSecurityResult = {
        socialSecurity: 12_000 + ordinal,
        socialSecurityStreams: activities,
        ssEarningsTestWithheld: 700 + ordinal,
        ssdiPaid: 300 + ordinal,
        withheldMonthWrites: [
          { personId: 'p1', value: 40 + ordinal },
          { personId: 'p1', value: 45 + ordinal },
        ],
        warnings: [`delegated Social Security warning ${input.year}`],
      }
      seam.phases.push({
        input,
        withheldAtCall: [...input.withheldMonthsByPerson],
        natural,
        injected,
      })
      return injected
    },
  }
})

import { createFlatTaxCalculator } from '../testing/flatTax.js'
import {
  cashAccount,
  singlePersonPlan,
  socialSecurityIncome,
  validatePlan,
} from '../testing/planFixtures.js'
import { simulatePlan } from './simulate.js'

function run() {
  seam.phases.length = 0
  const plan = singlePersonPlan({ dob: '1960-01-01', planningAge: 90 })
  plan.accounts = [cashAccount('cash', 0)]
  plan.incomes = [socialSecurityIncome('ss-natural', 1_000, 67)]
  plan.expenses.baseAnnual = 6_000
  const validated = validatePlan(plan)
  const result = simulatePlan(validated, {
    startYear: 2026,
    horizonEndYear: 2027,
    taxCalculator: createFlatTaxCalculator(10),
    captureAnnualCashFlow: true,
  })
  return { plan: validated, result, phases: [...seam.phases] }
}

describe('simulatePlan delegates annual Social Security', () => {
  it('applies fresh year effects and consumes the exact returned activities everywhere', () => {
    const { plan, result, phases } = run()

    expect(phases).toHaveLength(2)
    expect(phases.map((phase) => phase.input.year)).toEqual([2026, 2027])
    expect(phases[0]!.input.incomes).toBe(plan.incomes)
    expect(phases[0]!.input.people).toBe(plan.household.people)
    expect(phases[0]!.withheldAtCall).toEqual([])
    expect(phases[1]!.withheldAtCall).toEqual([['p1', 45]])
    expect(phases[0]!.injected.socialSecurityStreams)
      .not.toBe(phases[1]!.injected.socialSecurityStreams)
    for (let index = 0; index < phases[0]!.injected.socialSecurityStreams.length; index++) {
      expect(phases[0]!.injected.socialSecurityStreams[index])
        .not.toBe(phases[1]!.injected.socialSecurityStreams[index])
    }

    let expectedCashBalance = 0
    for (let ordinal = 0; ordinal < result.years.length; ordinal++) {
      const year = result.years[ordinal]!
      const phase = phases[ordinal]!
      const expectedTax = (12_000 + ordinal) * 0.85 * 0.1
      const expectedSurplus = 12_000 + ordinal - year.expenses.total - expectedTax
      expect(year.incomes.socialSecurity).toBe(12_000 + ordinal)
      expect(year.incomes.total).toBe(12_000 + ordinal)
      expect(year.socialSecurityStreams).toBe(phase.injected.socialSecurityStreams)
      expect(year.socialSecurityStreams).toHaveLength(3)
      for (let index = 0; index < phase.injected.socialSecurityStreams.length; index++) {
        expect(year.socialSecurityStreams![index]).toBe(phase.injected.socialSecurityStreams[index])
      }
      expect(year.ssEarningsTestWithheld).toBe(700 + ordinal)
      expect(year.ssdiPaid).toBe(300 + ordinal)
      expect(year.tax).toBe(expectedTax)
      expect(year.withdrawals.total).toBe(0)
      expect(year.shortfall).toBe(0)
      expect(year.surplusInvested).toBe(expectedSurplus)
      expectedCashBalance += expectedSurplus
      expect(year.balances.cash).toBe(expectedCashBalance)

      expect(year.cashFlow!.sourceLines
        .filter((line) => line.kind === 'socialSecurity')
        .map((line) => ({ id: line.id, amountPlanDollars: line.amountPlanDollars })))
        .toEqual([
          {
            id: 'source:socialSecurity:ss-delegated-first',
            amountPlanDollars: 9_000 + ordinal,
          },
          {
            id: 'source:socialSecurity:ss-delegated-last',
            amountPlanDollars: 3_000,
          },
        ])
    }

    expect(result.warnings).toEqual(expect.arrayContaining([
      'delegated Social Security warning 2026',
      'delegated Social Security warning 2027',
    ]))
  })
})
