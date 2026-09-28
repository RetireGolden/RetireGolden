import { expect, it } from 'vitest'
import { baselineRemainingYears } from '../longevity/ssaPeriod2022.js'
import { describeCalculation, withinTolerance, worksheetExpectedRows, worksheetNumber } from '../rules/describeCalculation.js'
import { annualMortality, MAX_AGE, type Sex } from './mortality.js'
import {
  hazardForExpectancyMultiplier,
  jointSurvivalPercentileAge,
  survivalCurve,
  survivalPercentileAge,
  survivalProbabilityTo,
  type SurvivalPerson,
} from './survival.js'

// The survival curve's cases, from the worksheet's Expected table (revision of 2026-09-27).
const curveRows = worksheetExpectedRows('DOCS/calculations/longevity/survival-probability-product.md')
const curveValue = (label: string): number => worksheetNumber(curveRows.get(label)![0]!)

/** The product as survivalProbabilityTo computed it before the curve existed, kept to pin the view bit for bit. */
function retiredProduct(currentAge: number, sex: Sex, targetAge: number): number {
  const from = Math.floor(Math.max(currentAge, 0))
  const to = Math.floor(targetAge)
  let s = 1
  for (let age = from; age < to; age++) {
    const q = annualMortality(age, sex)
    s *= q >= 1 ? 0 : Math.pow(1 - q, 1)
    if (s <= 0) return 0
  }
  return s
}

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

    it('survivalCurve: a man of 117 survives one year with 0.09/1.04, two with 0.04 of that, three not at all', () => {
      const curve = survivalCurve(117, 'male')
      expect(curve.survivalTo(0)).toBe(1)
      expect(curve.survivalTo(1)).toBe(curveValue('Male from 117, survivalTo(1)'))
      expect(curve.survivalTo(2)).toBe(curveValue('Male from 117, survivalTo(2)'))
      expect(curve.survivalTo(3)).toBe(curveValue('Male from 117, survivalTo(3)'))
      const deaths = [0, 1, 2, 3].map((t) => curve.deathProbabilityInYear(t))
      expect(withinTolerance(deaths.reduce((sum, p) => sum + p, 0), 1, { abs: 1e-15 })).toBe(true)
    })

    it('survivalCurve: a woman of 63 reaches 67 with 0.9580296085257168, and her yearly deaths sum to 1', () => {
      const curve = survivalCurve(63, 'female')
      expect(withinTolerance(curve.survivalTo(4), curveValue('Female from 63, survivalTo(4)'), { rel: 1e-15 })).toBe(true)
      let total = 0
      for (let t = 0; t <= MAX_AGE + 1 - 63; t++) total += curve.deathProbabilityInYear(t)
      expect(withinTolerance(total, 1, { abs: 1e-12 })).toBe(true)
      expect(() => survivalCurve(64.5, 'female')).toThrow(RangeError)
      expect(() => survivalCurve(63, 'female', 0)).toThrow(RangeError)
      // Before the start there is no death to weigh.
      expect(curve.deathProbabilityInYear(-1)).toBe(0)
    })

    it('survivalProbabilityTo is the curve, bit for bit the product it computed before, at every integer pair and sex', () => {
      const mismatches: string[] = []
      for (const s of ['male', 'female', 'average'] as const) {
        for (let from = 0; from <= MAX_AGE + 1; from++) {
          const curve = survivalCurve(from, s)
          for (let to = from + 1; to <= MAX_AGE + 2; to++) {
            const view = survivalProbabilityTo(from, s, to)
            if (view !== retiredProduct(from, s, to) || view !== curve.survivalTo(to - from)) mismatches.push(`${s} ${from}->${to}`)
          }
        }
      }
      // A count and the first few pairs, so a failure stays readable.
      expect({ count: mismatches.length, first: mismatches.slice(0, 5) }).toEqual({ count: 0, first: [] })
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
