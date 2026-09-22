import { expect, it } from 'vitest'

import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import type { Account, Plan } from '../model/plan.js'
import { cashAccount, singlePersonPlan, validatePlan } from '../testing/planFixtures.js'
import {
  analyzePensionElections,
  curveNominalDiscountRatePct,
  pensionAnnuityPresentValue,
} from './pensionElection.js'

const START_YEAR = 2026

/**
 * A single household (so no survivor extends the horizon) whose only account
 * beside a cash balance is a pension carrying a lump-sum offer — the analysis
 * skips a pension without one. Born 1962, so the current age at the 2026
 * valuation is 64; planning age 70 puts the curve horizon at six years and,
 * because the analysis passes the planning age as the owner's death age, also
 * puts six payments in the published stream.
 */
function pensionPlan(monthlyAmount: number, planningAge: number, inflationPct: number): Plan {
  const plan = singlePersonPlan({ dob: '1962-06-15', planningAge })
  plan.assumptions.inflationPct = inflationPct
  plan.accounts = [
    cashAccount('cash', 10_000),
    {
      type: 'pension', id: 'pen', name: 'Pension', ownerPersonId: 'p1', annualReturnPct: 0,
      startAge: 65, monthlyAmount, colaPct: 0, survivorPct: 0,
      lumpSumOffer: { amount: 300_000, electionYear: START_YEAR },
    } as unknown as Account,
  ]
  return validatePlan(plan)
}

describeCalculation(
  'pension-election-annuity-present-value',
  {
    example: {
      inputs: {
        ownerCurrentAndStartAge: [64, 65],
        planningAge: 70,
        helperOwnerDeathAge: 67,
        monthlyPension: 1_000,
        colaPct: 0,
        survivorPct: 0,
        planInflationPct: 2,
        fiveYearRealYieldPct: 1.85,
        sevenYearRealYieldPct: 2.05,
        rateTolerance: { abs: 1e-9 },
      },
      expected: {
        curveRatePct: 3.95,
        presentValueAtCurveRate: 63_008.166010097986,
        threePaymentHelperPresentValue: 33_332.7193407416,
        fiveYearEndpointWrongReadingRate: 3.85,
        fiveYearEndpointWrongReadingPv: 63_213.991361387314,
        noInflationWrongReadingPv: 67_330.738824470143,
        undiscountedWrongReadingPv: 36_000,
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/accounts-and-growth/pension-election-annuity-present-value.md',
    mutation: 'DOCS/calculations/accounts-and-growth/pension-election-annuity-present-value.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number | number[] | { abs: number }>
    const expected = example.expected as Record<string, number>
    const [currentAge, startAge] = inputs.ownerCurrentAndStartAge as number[]
    const planningAge = inputs.planningAge as number
    const helperDeathAge = inputs.helperOwnerDeathAge as number
    const monthlyPension = inputs.monthlyPension as number
    const inflationPct = inputs.planInflationPct as number
    const rateTolerance = inputs.rateTolerance as { abs: number }

    function expectWithin(actual: number, target: number, label: string): void {
      expect(
        withinTolerance(actual, target, example.tolerance),
        `${label} ${actual} is not within ${JSON.stringify(example.tolerance)} of ${target}`,
      ).toBe(true)
    }

    const base = {
      monthlyAmount: monthlyPension,
      colaPct: inputs.colaPct as number,
      survivorPct: inputs.survivorPct as number,
      startAge: startAge!,
      ownerCurrentAge: currentAge!,
    }

    function analysis() {
      const [first] = analyzePensionElections(pensionPlan(monthlyPension, planningAge, inflationPct), START_YEAR)
      if (first === undefined) throw new Error('expected one pension analysis')
      return first
    }

    it('anchors the discount rate at 3.95%: the six-year real yield plus plan inflation', () => {
      const curveRatePct = analysis().curveRatePct
      expect(
        withinTolerance(curveRatePct, expected.curveRatePct!, rateTolerance),
        `curveRatePct ${curveRatePct} is not within ${JSON.stringify(rateTolerance)} of ${expected.curveRatePct}`,
      ).toBe(true)
      // ... and it is the interpolation the worksheet states, midway between
      // the 5- and 7-year anchors, plus the plan's inflation.
      expect(
        withinTolerance(
          curveRatePct,
          (inputs.fiveYearRealYieldPct as number) +
            ((inputs.sevenYearRealYieldPct as number) - (inputs.fiveYearRealYieldPct as number)) / 2 +
            inflationPct,
          rateTolerance,
        ),
      ).toBe(true)
      // The worksheet's second wrong reading: the 5-year endpoint uninterpolated.
      expect(withinTolerance(curveRatePct, expected.fiveYearEndpointWrongReadingRate!, rateTolerance)).toBe(false)
      expect(curveNominalDiscountRatePct(5, inflationPct)).toBe(expected.fiveYearEndpointWrongReadingRate)
    })

    it('values presentValueAtCurveRate at 63008.166010097986: six payments through the planning age', () => {
      const { curveRatePct, presentValueAtCurveRate } = analysis()
      expectWithin(presentValueAtCurveRate, expected.presentValueAtCurveRate!, 'presentValueAtCurveRate')
      // ... and it is the stream valued to the PLANNING age, which is the same
      // number that set the six-year curve horizon: one input drives both.
      expectWithin(
        presentValueAtCurveRate,
        pensionAnnuityPresentValue({ ...base, ownerDeathAge: planningAge, discountRatePct: curveRatePct }),
        'presentValueAtCurveRate against the planning-age stream',
      )
      // The worksheet's first wrong reading: stopping the published field's
      // stream at a death age apart from the planning age that derived its
      // rate, which reports the helper's three-payment value instead.
      expect(
        withinTolerance(presentValueAtCurveRate, expected.threePaymentHelperPresentValue!, example.tolerance),
      ).toBe(false)
      // The worksheet's second and third wrong readings, priced over the same
      // six payments: the uninterpolated 5-year endpoint, and omitting the
      // plan's inflation from the nominal rate.
      expectWithin(
        pensionAnnuityPresentValue({
          ...base,
          ownerDeathAge: planningAge,
          discountRatePct: expected.fiveYearEndpointWrongReadingRate!,
        }),
        expected.fiveYearEndpointWrongReadingPv!,
        'five-year-endpoint present value',
      )
      expectWithin(
        pensionAnnuityPresentValue({
          ...base,
          ownerDeathAge: planningAge,
          discountRatePct: curveRatePct - inflationPct,
        }),
        expected.noInflationWrongReadingPv!,
        'no-inflation present value',
      )
    })

    it('discounts the helper\'s three payments at that rate to 33332.7193407416', () => {
      const curveRatePct = analysis().curveRatePct
      const pv = pensionAnnuityPresentValue({
        ...base,
        ownerDeathAge: helperDeathAge,
        discountRatePct: curveRatePct,
      })
      expectWithin(pv, expected.threePaymentHelperPresentValue!, 'three-payment pensionAnnuityPresentValue')
      // The worksheet's fourth wrong reading: the three payments taken as
      // valuation-date cash rather than discounted at offsets 1 through 3.
      expect(withinTolerance(pv, expected.undiscountedWrongReadingPv!, example.tolerance)).toBe(false)
    })
  },
)
