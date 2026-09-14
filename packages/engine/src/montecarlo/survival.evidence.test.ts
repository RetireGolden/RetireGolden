import { expect, it } from 'vitest'
import { baselineRemainingYears } from '../longevity/ssaPeriod2022.js'
import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import { MAX_AGE, type Sex } from './mortality.js'
import {
  hazardForExpectancyMultiplier,
  jointSurvivalPercentileAge,
  survivalPercentileAge,
  survivalProbabilityTo,
  type SurvivalPerson,
} from './survival.js'

describeCalculation(
  'survival-probability-product',
  {
    example: {
      inputs: { currentAge: 65, sex: 'male', targetAge: 67, hazard: 1 },
      expected: { survivalProbability: 0.963150477964002, atCurrentAge: 1 },
      tolerance: { abs: 1e-12 },
    },
    worksheet: 'DOCS/calculations/longevity/survival-probability-product.md',
    mutation: 'DOCS/calculations/longevity/survival-probability-product.mutation.md',
  },
  ({ example }) => {
    const currentAge = example.inputs.currentAge as number
    const sex = example.inputs.sex as Sex
    const targetAge = example.inputs.targetAge as number
    const hazard = example.inputs.hazard as number

    it('multiplies p65 and p66 from the SSA male rows: S(67) = 0.963150477964002', () => {
      const survival = survivalProbabilityTo(currentAge, sex, targetAge, hazard)
      const expected = example.expected.survivalProbability as number
      expect(
        withinTolerance(survival, expected, example.tolerance),
        `survivalProbability ${survival} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expected}`,
      ).toBe(true)
    })

    it('returns exactly 1 when the target age is not later than the current age', () => {
      // Domain endpoint of the claim: an empty product.
      expect(survivalProbabilityTo(currentAge, sex, currentAge, hazard)).toBe(example.expected.atCurrentAge)
      expect(survivalProbabilityTo(currentAge, sex, currentAge - 1, hazard)).toBe(example.expected.atCurrentAge)
    })
  },
)

describeCalculation(
  'survival-percentile-age',
  {
    example: {
      inputs: { currentAge: 65, sex: 'male', pct: 97, hazard: 1 },
      expected: { percentileAge: 66 },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/longevity/survival-percentile-age.md',
    mutation: 'DOCS/calculations/longevity/survival-percentile-age.mutation.md',
  },
  ({ example }) => {
    const currentAge = example.inputs.currentAge as number
    const sex = example.inputs.sex as Sex
    const pct = example.inputs.pct as number
    const hazard = example.inputs.hazard as number

    it('the oldest age with conditional survival >= 97% from 65 is 66', () => {
      expect(survivalPercentileAge(currentAge, sex, pct, hazard)).toBe(example.expected.percentileAge)
    })

    it('brackets the threshold: S(66) >= 0.97 and S(67) < 0.97', () => {
      // The worksheet's two comparisons, through the product record's entry.
      expect(survivalProbabilityTo(currentAge, sex, 66, hazard)).toBeGreaterThanOrEqual(pct / 100)
      expect(survivalProbabilityTo(currentAge, sex, 67, hazard)).toBeLessThan(pct / 100)
    })

    it('is bounded below by the current age: a 100% threshold returns 65', () => {
      // Boundary of the claim: S(66) < 1, so no later age qualifies and the
      // current age, already reached, is the answer.
      expect(survivalPercentileAge(currentAge, sex, 100, hazard)).toBe(currentAge)
    })
  },
)

describeCalculation(
  'joint-survival-percentile-age',
  {
    example: {
      inputs: {
        primary: { age: 65, sex: 'male', hazard: 1 },
        partner: { age: 65, sex: 'male', hazard: 1 },
        pct: 99,
      },
      expected: {
        jointPercentileAge: 70,
        singleSurvivalByAge: { 69: 0.923392932, 70: 0.902507417, 71: 0.879847618 },
        jointSurvivalByAge: { 69: 0.994131357, 70: 0.990495196, 71: 0.985563405 },
      },
      // The worksheet's tolerance for its intermediate display values; the
      // age itself is an exact integer and is asserted with toBe below.
      tolerance: { abs: 1e-9 },
    },
    worksheet: 'DOCS/calculations/longevity/joint-survival-percentile-age.md',
    mutation: 'DOCS/calculations/longevity/joint-survival-percentile-age.mutation.md',
  },
  ({ example }) => {
    const primary = example.inputs.primary as SurvivalPerson
    const partner = example.inputs.partner as SurvivalPerson
    const pct = example.inputs.pct as number
    const single = example.expected.singleSurvivalByAge as Record<string, number>
    const joint = example.expected.jointSurvivalByAge as Record<string, number>

    it('two 65-year-old men at 99%: the last-survivor percentile age is 70', () => {
      expect(jointSurvivalPercentileAge(primary, partner, pct)).toBe(example.expected.jointPercentileAge)
    })

    it('single-life survival to 69, 70, 71 matches the worksheet within 1e-9', () => {
      for (const [age, expected] of Object.entries(single)) {
        const survival = survivalProbabilityTo(primary.age, primary.sex, Number(age), primary.hazard)
        expect(
          withinTolerance(survival, expected, example.tolerance),
          `single-life survival to ${age} ${survival} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expected}`,
        ).toBe(true)
      }
    })

    it('either-alive survival 1 - (1 - S)^2 qualifies at 70 (0.9905 >= 0.99) and fails at 71 (0.9856)', () => {
      // The worksheet's intermediate joint values, recomputed from the
      // single-life survivals the engine returns; the boundary the
      // production walk must stop at.
      for (const [age, expected] of Object.entries(joint)) {
        const s = survivalProbabilityTo(primary.age, primary.sex, Number(age), primary.hazard)
        const eitherAlive = 1 - (1 - s) * (1 - s)
        expect(
          withinTolerance(eitherAlive, expected, example.tolerance),
          `either-alive survival to ${age} ${eitherAlive} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expected}`,
        ).toBe(true)
      }
      expect(joint['70']!).toBeGreaterThanOrEqual(pct / 100)
      expect(joint['71']!).toBeLessThan(pct / 100)
    })

    it('exceeds the single-life 99th-percentile age of 65, which the last-survivor construction must not return', () => {
      // The worksheet's second wrong reading: one person's answer.
      expect(survivalPercentileAge(primary.age, primary.sex, pct, primary.hazard)).toBe(65)
      expect(jointSurvivalPercentileAge(primary, partner, pct)).toBeGreaterThan(65)
    })
  },
)

describeCalculation(
  'survival-hazard-from-expectancy-multiplier',
  {
    example: {
      inputs: { age: 65, sex: 'male', multiplier: 1, baselineRemainingYears: 17.48 },
      expected: { hazardPower: 1, adjustedExpectancyYears: 17.48 },
      tolerance: { abs: 1e-6 },
    },
    worksheet: 'DOCS/calculations/longevity/survival-hazard-from-expectancy-multiplier.md',
    mutation: 'DOCS/calculations/longevity/survival-hazard-from-expectancy-multiplier.mutation.md',
  },
  ({ example }) => {
    const age = example.inputs.age as number
    const sex = example.inputs.sex as Sex
    const multiplier = example.inputs.multiplier as number

    it('reads the 17.48-year SSA male baseline at 65 that the multiplier scales', () => {
      expect(baselineRemainingYears(age, sex)).toBe(example.inputs.baselineRemainingYears)
    })

    it('the identity multiplier m = 1 solves to hazard power 1 within 1e-6', () => {
      const hazard = hazardForExpectancyMultiplier(age, sex, multiplier)
      const expected = example.expected.hazardPower as number
      expect(
        withinTolerance(hazard, expected, example.tolerance),
        `hazardPower ${hazard} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expected}`,
      ).toBe(true)
    })

    it('the adjusted expectancy at the solved power reproduces the 17.48 baseline', () => {
      // expectancyUnderHazard is module-private; 0.5 + sum of S(t) is rebuilt
      // from the exported survival product at the solved power, which is the
      // same running product the solver sums. The worksheet gives h's
      // tolerance as 1e-6 and leaves E's as "the corresponding solver
      // tolerance"; the bisection's 40 halvings of [0.2, 8] leave h within
      // 8e-12 of the root, so E sits within |dE/dh| * 8e-12 (about 1e-10) of
      // the baseline and the same 1e-6 figure is used for both.
      const hazard = hazardForExpectancyMultiplier(age, sex, multiplier)
      let expectancy = 0.5
      for (let target = age + 1; target <= MAX_AGE + 1; target++) {
        expectancy += survivalProbabilityTo(age, sex, target, hazard)
      }
      const expected = example.expected.adjustedExpectancyYears as number
      expect(
        withinTolerance(expectancy, expected, example.tolerance),
        `adjustedExpectancyYears ${expectancy} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expected}`,
      ).toBe(true)
    })
  },
)
