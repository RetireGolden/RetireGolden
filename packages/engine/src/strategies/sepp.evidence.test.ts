import { expect, it } from 'vitest'

import type { Account } from '../model/plan.js'
import { packForYear, singleLifeExpectancyYears } from '../params/index.js'
import {
  annualSeppDistributions,
  type AnnualSeppBalanceView,
} from '../projection/internal/annualSeppDistributions.js'
import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import { SEPP_AMORTIZATION_RATE_PCT, seppActive, seppAnnualAmount } from './sepp.js'

const YEAR = 2026
const pack = packForYear(YEAR).pack

function expectWithin(
  actual: number,
  expected: number,
  tolerance: Parameters<typeof withinTolerance>[2],
  label: string,
): void {
  expect(
    withinTolerance(actual, expected, tolerance),
    `${label} ${actual} is not within ${JSON.stringify(tolerance)} of the worksheet's ${expected}`,
  ).toBe(true)
}

function seppAccount(startAge: number, method: 'rmd' | 'amortization', balance: number) {
  return {
    type: 'traditional',
    id: 'sepp-ira',
    name: 'SEPP IRA',
    ownerPersonId: 'p1',
    annualReturnPct: 0,
    kind: 'ira',
    balance,
    annualContribution: 0,
    sepp: { startAge, method },
  } as Extract<Account, { type: 'traditional' }>
}

describeCalculation(
  'sepp-active-annual-rule',
  {
    example: {
      inputs: {
        startAge: 55,
        firstEvaluatedAge: 59,
        secondEvaluatedAge: 60,
        minimumDurationYears: 5,
        approximatePenaltyBoundaryAge: 60,
      },
      expected: { activeAtFirstAge: 1, activeAtSecondAge: 0 },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/spending-and-withdrawals/sepp-active-annual-rule.md',
    mutation: 'DOCS/calculations/spending-and-withdrawals/sepp-active-annual-rule.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number>
    const balance = 316_000
    const runAtAge = (ageAttained: number) => {
      const account = seppAccount(inputs.startAge!, 'rmd', balance)
      const balances: readonly AnnualSeppBalanceView[] = [{ account, balance }]
      return annualSeppDistributions({
        balances,
        year: YEAR,
        primaryPersonId: 'p1',
        resolveOwnerState: () => ({ alive: true, ageAttained }),
        resolveOwnerRetirementAge: () => null,
        startOfYearBalance: new Map([[account.id, balance]]),
        amortizationAmountByAccountId: new Map(),
        pack,
      })
    }

    it('is still active at 59, four elapsed years and below the age-60 boundary', () => {
      expect(seppActive(inputs.startAge!, inputs.firstEvaluatedAge!)).toBe(true)
      expect(inputs.firstEvaluatedAge! - inputs.startAge!).toBeLessThan(inputs.minimumDurationYears!)
      expect(runAtAge(inputs.firstEvaluatedAge!).total).toBeGreaterThan(0)
    })

    it('ends at 60, where both the five years and the age boundary are satisfied', () => {
      expect(seppActive(inputs.startAge!, inputs.secondEvaluatedAge!)).toBe(false)
      expect(inputs.secondEvaluatedAge!).toBe(inputs.approximatePenaltyBoundaryAge)
      expect(runAtAge(inputs.secondEvaluatedAge!).total).toBe(0)
    })

    it('keeps a series begun at 50 running past five years to the age boundary', () => {
      // The second wrong reading: duration alone would end a series begun at
      // 50 at age 55, well before the penalty boundary.
      expect(seppActive(50, 55)).toBe(true)
      expect(seppActive(50, 60)).toBe(false)
    })

    it('is not active before the start age', () => {
      expect(seppActive(inputs.startAge!, inputs.startAge! - 1)).toBe(false)
    })
  },
)

describeCalculation(
  'sepp-amortization-method',
  {
    example: {
      inputs: {
        method: 'amortization',
        firstYearBalance: 316_000,
        startAge: 55,
        singleLifeTerm: 31.6,
        ratePct: 5,
      },
      expected: { annualAmount: 20_101.84 },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/spending-and-withdrawals/sepp-amortization-method.md',
    mutation: 'DOCS/calculations/spending-and-withdrawals/sepp-amortization-method.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number | string>
    const expected = example.expected as Record<string, number>

    it('amortizes 316,000 over the 31.6-year term at 5% into 20,101.84 a year', () => {
      expect(SEPP_AMORTIZATION_RATE_PCT).toBe(inputs.ratePct)
      expect(singleLifeExpectancyYears(pack, inputs.startAge as number)).toBe(inputs.singleLifeTerm)
      const amount = seppAnnualAmount(
        pack,
        'amortization',
        inputs.firstYearBalance as number,
        inputs.startAge as number,
      )
      expectWithin(amount, expected.annualAmount!, example.tolerance, 'annualAmount')
    })

    it('does not degenerate to simple division while the rate is nonzero', () => {
      // The first wrong reading: balance over the term would pay 10,000.
      const amount = seppAnnualAmount(
        pack,
        'amortization',
        inputs.firstYearBalance as number,
        inputs.startAge as number,
      )
      expect(amount).toBeGreaterThan(
        (inputs.firstYearBalance as number) / (inputs.singleLifeTerm as number),
      )
    })

    it('degenerates to balance over the term at a zero rate, as the comment states', () => {
      const atZero = seppAnnualAmount(
        pack,
        'amortization',
        inputs.firstYearBalance as number,
        inputs.startAge as number,
        0,
      )
      expectWithin(atZero, 10_000, example.tolerance, 'annualAmount at a zero rate')
    })
  },
)

describeCalculation(
  'sepp-rmd-method',
  {
    example: {
      inputs: {
        method: 'rmd',
        currentStartOfYearBalance: 316_000,
        ageAttained: 55,
        singleLifeDivisor: 31.6,
      },
      expected: { annualAmount: 10_000 },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/spending-and-withdrawals/sepp-rmd-method.md',
    mutation: 'DOCS/calculations/spending-and-withdrawals/sepp-rmd-method.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number | string>
    const expected = example.expected as Record<string, number>

    it('divides the 316,000 start-of-year balance by the age-55 divisor 31.6', () => {
      expect(singleLifeExpectancyYears(pack, inputs.ageAttained as number)).toBe(inputs.singleLifeDivisor)
      const amount = seppAnnualAmount(
        pack,
        'rmd',
        inputs.currentStartOfYearBalance as number,
        inputs.ageAttained as number,
      )
      expectWithin(amount, expected.annualAmount!, example.tolerance, 'annualAmount')
    })

    it('varies with the balance and the age, unlike the fixed amortization payment', () => {
      // The second wrong reading: treating the RMD method as fixed ignores the
      // annual recomputation.
      const sameBalanceOlder = seppAnnualAmount(
        pack,
        'rmd',
        inputs.currentStartOfYearBalance as number,
        (inputs.ageAttained as number) + 1,
      )
      const sameAgeSmaller = seppAnnualAmount(
        pack,
        'rmd',
        (inputs.currentStartOfYearBalance as number) - 16_000,
        inputs.ageAttained as number,
      )
      expect(sameBalanceOlder).not.toBe(expected.annualAmount)
      expect(sameAgeSmaller).not.toBe(expected.annualAmount)
    })

    it('pays nothing from a nonpositive balance', () => {
      expect(seppAnnualAmount(pack, 'rmd', 0, inputs.ageAttained as number)).toBe(0)
    })
  },
)
