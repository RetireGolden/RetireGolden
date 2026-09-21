import { expect, it } from 'vitest'
import type { RealYieldCurve } from '../params/types.js'
import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import { sizeBridge } from './bridge.js'

/** Zero real-yield curve as the worksheet states; endpoints held at 0%. */
function zeroCurve(): RealYieldCurve {
  return {
    asOfIso: '2026-09-17',
    source: 'evidence fixture',
    points: [
      { maturityYears: 1, realYieldPct: 0 },
      { maturityYears: 30, realYieldPct: 0 },
    ],
  }
}

describeCalculation(
  'ss-bridge-sizing',
  {
    example: {
      inputs: {
        piaMonthly: 2_000,
        age62ClaimFactor: 0.7,
        dob: { year: 1965, month: 1, day: 1 },
        claimAge: { years: 65, months: 0 },
        currentYear: 2026,
        retirementYear: 2026,
        realYieldPct: 0,
      },
      expected: {
        monthlyAge62Benefit: 1_400,
        annualRealAmount: 16_800,
        startYear: 2027,
        endYear: 2029,
        years: 3,
        ladderCost: 50_400,
      },
      tolerance: { abs: 1e-9 },
    },
    worksheet: 'DOCS/calculations/social-security/ss-bridge-sizing.md',
    mutation: 'DOCS/calculations/social-security/ss-bridge-sizing.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs
    const bridge = sizeBridge({
      piaMonthly: inputs.piaMonthly as number,
      dob: inputs.dob as { year: number; month: number; day: number },
      claimAge: inputs.claimAge as { years: number; months: number },
      currentYear: inputs.currentYear as number,
      retirementYear: inputs.retirementYear as number,
      curve: zeroCurve(),
    })

    it('pays the age-62 benefit of $1,400/month ($16,800/year) from 2027 through 2029', () => {
      expect(bridge).not.toBeNull()
      expect(bridge!.startYear).toBe(example.expected.startYear)
      expect(bridge!.endYear).toBe(example.expected.endYear)
      expect(bridge!.years).toBe(example.expected.years)
      const expectedMonthly = example.expected.monthlyAge62Benefit as number
      const expectedAnnual = example.expected.annualRealAmount as number
      expect(
        withinTolerance(bridge!.monthlyAge62Benefit, expectedMonthly, example.tolerance),
        `monthlyAge62Benefit ${bridge!.monthlyAge62Benefit} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expectedMonthly}`,
      ).toBe(true)
      expect(
        withinTolerance(bridge!.annualRealAmount, expectedAnnual, example.tolerance),
        `annualRealAmount ${bridge!.annualRealAmount} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expectedAnnual}`,
      ).toBe(true)
    })

    it('prices the three zero-yield payments at $50,400', () => {
      expect(bridge).not.toBeNull()
      const expected = example.expected.ladderCost as number
      expect(
        withinTolerance(bridge!.ladderCost, expected, example.tolerance),
        `ladderCost ${bridge!.ladderCost} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expected}`,
      ).toBe(true)
    })
  },
)
