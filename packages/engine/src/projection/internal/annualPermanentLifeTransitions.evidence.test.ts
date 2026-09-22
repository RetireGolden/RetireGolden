import { expect, it } from 'vitest'

import type { InsurancePolicy } from '../../model/plan.js'
import { describeCalculation, withinTolerance } from '../../rules/describeCalculation.js'
import { annualPermanentLifeTransitions } from './annualPermanentLifeTransitions.js'

function expectWithin(
  actual: number,
  target: number,
  tolerance: Parameters<typeof withinTolerance>[2],
  label: string,
): void {
  expect(
    withinTolerance(actual, target, tolerance),
    `${label} ${actual} is not within ${JSON.stringify(tolerance)} of the worksheet's ${target}`,
  ).toBe(true)
}

describeCalculation(
  'insurance-cash-value-and-death-benefit-annual',
  {
    example: {
      inputs: {
        livingPolicy: {
          attainedAge: 65, deathAge: 90, cashValueMode: 'schedule',
          schedule: [{ age: 60, value: 20_000 }, { age: 70, value: 40_000 }],
          deathBenefit: 100_000,
        },
        settlingPolicy: {
          attainedAge: 70, deathAge: 70, cashValueMode: 'flatRate',
          entryCashValue: 60_000, cashValueGrowthPct: 0, deathBenefit: 50_000,
        },
      },
      expected: {
        insuranceCashValue: 30_000,
        deathBenefit: 60_000,
        lowerEndpointWrongReading: 20_000,
        faceOnlyWrongReading: 50_000,
        retainedSettledCashValueWrongReading: 90_000,
        yearAfterDeathAttainedAgeWrongReading: 71,
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/cash-flow-and-summary/insurance-cash-value-and-death-benefit-annual.md',
    mutation: 'DOCS/calculations/cash-flow-and-summary/insurance-cash-value-and-death-benefit-annual.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, Record<string, unknown>>
    const expected = example.expected as Record<string, number>
    const living = inputs.livingPolicy!
    const settling = inputs.settlingPolicy!

    const policies: readonly InsurancePolicy[] = [
      {
        kind: 'permanentLife', id: 'living', name: 'Living policy', insured: 'living-insured',
        beneficiary: 'estate', annualPremium: 0, premiumMode: 'paidUp',
        deathBenefit: living.deathBenefit as number,
        cashValue: 0,
        cashValueMode: 'schedule',
        cashValueSchedule: living.schedule as { age: number; value: number }[],
      },
      {
        kind: 'permanentLife', id: 'settling', name: 'Settling policy', insured: 'settling-insured',
        beneficiary: 'estate', annualPremium: 0, premiumMode: 'paidUp',
        deathBenefit: settling.deathBenefit as number,
        cashValue: settling.entryCashValue as number,
        cashValueMode: 'flatRate',
        cashValueGrowthPct: settling.cashValueGrowthPct as number,
      },
    ]

    /**
     * The worksheet's two rows at a chosen attained age for the settling
     * policy. Its Inputs row is attained age 70 against death age 70 — the
     * death year, the only state in which `max(face, cash value)` is paid at
     * all — and its last wrong reading moves that row to 71, the year after
     * the death year, which is asserted separately below.
     */
    function transitionsAt(settlingAttainedAge: number) {
      return annualPermanentLifeTransitions({
        policies,
        insuranceCashValues: new Map([
          ['living', 0],
          ['settling', settling.entryCashValue as number],
        ]),
        resolveInsured: (personId) =>
          personId === 'living-insured'
            ? { ageAttained: living.attainedAge as number, deathAge: living.deathAge as number }
            : { ageAttained: settlingAttainedAge, deathAge: settling.deathAge as number },
      })
    }

    it('interpolates 30000 of living cash value and settles 60000 on the max rule at attained age 70', () => {
      const result = transitionsAt(settling.attainedAge as number)
      expect(settling.attainedAge).toBe(settling.deathAge)
      const byId = new Map(result.transitions.map((row) => [row.policyId, row]))

      expectWithin(
        byId.get('living')!.cashValue,
        expected.insuranceCashValue!,
        example.tolerance,
        'living-policy cash value',
      )
      expectWithin(
        result.deathBenefitPaid,
        expected.deathBenefit!,
        example.tolerance,
        'deathBenefit',
      )

      // The settled policy stops being a cash-value asset in the same pass, so
      // the year-end insurance cash value is the living policy alone.
      expect(byId.get('settling')!.cashValue).toBe(0)
      const endingCashValue = result.transitions.reduce((sum, row) => sum + row.cashValue, 0)
      expectWithin(
        endingCashValue,
        expected.insuranceCashValue!,
        example.tolerance,
        'insuranceCashValue',
      )

      // The worksheet's first three wrong readings.
      expect(
        withinTolerance(byId.get('living')!.cashValue, expected.lowerEndpointWrongReading!, example.tolerance),
      ).toBe(false)
      expect(
        withinTolerance(result.deathBenefitPaid, expected.faceOnlyWrongReading!, example.tolerance),
      ).toBe(false)
      expect(
        withinTolerance(endingCashValue, expected.retainedSettledCashValueWrongReading!, example.tolerance),
      ).toBe(false)
    })

    it('pays nothing and holds zero cash value at attained age 71, the year after the death year', () => {
      // The worksheet's last wrong reading: moving the settling-policy row to
      // attained age 71 against death age 70 describes the year after death,
      // where the payout is null and the cash value 0 rather than the
      // death-year 60,000 settlement.
      const result = transitionsAt(expected.yearAfterDeathAttainedAgeWrongReading!)
      const byId = new Map(result.transitions.map((row) => [row.policyId, row]))
      expect(byId.get('settling')!.payout).toBe(null)
      expect(byId.get('settling')!.cashValue).toBe(0)
      expect(result.deathBenefitPaid).toBe(0)
      expect(
        withinTolerance(result.deathBenefitPaid, expected.deathBenefit!, example.tolerance),
      ).toBe(false)
    })
  },
)
