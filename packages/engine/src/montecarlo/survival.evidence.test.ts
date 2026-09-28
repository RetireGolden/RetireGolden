import { expect, it } from 'vitest'
import { baselineRemainingYears } from '../longevity/ssaPeriodLifeTable.js'
import { describeCalculation, withinTolerance, worksheetExpectedRows, worksheetNumber } from '../rules/describeCalculation.js'
import { annualMortality, MAX_AGE, type Sex, type TableSex } from './mortality.js'
import {
  hazardForExpectancyMultiplier,
  jointSurvivalPercentileAge,
  survivalCurve,
  survivalPercentileAge,
  survivalProbabilityTo,
  type SurvivalPerson,
} from './survival.js'

// The survival curve's cases, from the worksheet's Expected table (revision of 2026-09-27, D-LIFE-TABLE-2023).
const curveRows = worksheetExpectedRows('DOCS/calculations/longevity/survival-probability-product.md')
const curveValue = (label: string): number => worksheetNumber(curveRows.get(label)![0]!)

/** A man's or a woman's product as survivalProbabilityTo computed it before the curve existed, kept to pin the view bit for bit. */
function tableSexProduct(currentAge: number, sex: TableSex, targetAge: number): number {
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

/** The reference for every sex: the product for a man or a woman, and for 'average' the mean of the two products. */
function referenceProduct(currentAge: number, sex: Sex, targetAge: number): number {
  if (sex === 'average') return (tableSexProduct(currentAge, 'male', targetAge) + tableSexProduct(currentAge, 'female', targetAge)) / 2
  return tableSexProduct(currentAge, sex, targetAge)
}

/** 0.5 + the sum of the curve's survivals, stopped once one is at most 1e-12: the record's E(h), through the exported curve. */
function curveExpectancy(age: number, sex: Sex, hazard: number): number {
  const curve = survivalCurve(age, sex, hazard)
  let e = 0.5
  for (let t = 1; age + t <= MAX_AGE + 1; t++) {
    const s = curve.survivalTo(t)
    e += s
    if (s <= 1e-12) break
  }
  return e
}

describeCalculation(
  'survival-probability-product',
  {
    example: {
      inputs: { currentAge: 65, sex: 'male', targetAge: 67, hazard: 1 },
      expected: { survivalProbability: 0.96626018017, atCurrentAge: 1 },
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

    it('multiplies p65 and p66 from SSA\'s published male q: S(67) = 0.983545 x 0.982426 = 0.96626018017', () => {
      const survival = survivalProbabilityTo(currentAge, sex, targetAge, hazard)
      const expected = example.expected.survivalProbability as number
      expect(expected).toBe(curveValue('Male from 65, survivalTo(2)'))
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

    it('survivalCurve from 65 for a man, a woman and \'average\', four years each, at the worksheet\'s values', () => {
      const labels = { male: 'Male', female: 'Female', average: 'Average' } as const
      for (const s of ['male', 'female', 'average'] as const) {
        const curve = survivalCurve(65, s)
        for (let t = 1; t <= 4; t++) {
          const label = `${labels[s]} from 65, survivalTo(${t})`
          expect(withinTolerance(curve.survivalTo(t), curveValue(label), { rel: 1e-15 }), `${label}: ${curve.survivalTo(t)}`).toBe(true)
        }
        let total = 0
        for (let t = 0; t <= MAX_AGE + 1 - 65; t++) total += curve.deathProbabilityInYear(t)
        expect(withinTolerance(total, 1, { abs: 1e-12 })).toBe(true)
      }
    })

    it('\'average\' is the mixture, not a q table: dying at 66 given alive from 65 is 0.0142164, not the mean q(66), 0.014227', () => {
      const curve = survivalCurve(65, 'average')
      const givenAlive = curve.deathProbabilityGivenAlive(1)
      // One minus a ratio of survivals near 1: two digits go to cancellation in doubles.
      expect(withinTolerance(givenAlive, curveValue('Average from 65, dying at 66 given alive'), { rel: 1e-13 }), `${givenAlive}`).toBe(true)
      expect(givenAlive).not.toBe((annualMortality(66, 'male') + annualMortality(66, 'female')) / 2)
      // At the starting age it is the mean of the two q, and the year's death is the difference of the survivals.
      expect(curve.deathProbabilityGivenAlive(0)).toBe(1 - curve.survivalTo(1))
      expect(curve.deathProbabilityInYear(1)).toBe(curve.survivalTo(1) - curve.survivalTo(2))
      // For a man at power 1 the probability given alive is q itself, exactly.
      expect(survivalCurve(65, 'male').deathProbabilityGivenAlive(1)).toBe(annualMortality(66, 'male'))
      expect(curve.deathProbabilityGivenAlive(-1)).toBe(0)
      expect(curve.deathProbabilityInYear(-1)).toBe(0)
    })

    it('floors a fractional target, reads the curve at whole years only, and gives 1 for dying once nobody is alive', () => {
      expect(survivalProbabilityTo(65, 'male', 67.9)).toBe(curveValue('Male from 65 to the target age 67.9 (floored)'))
      expect(survivalProbabilityTo(65, 'male', 67.9)).toBe(survivalProbabilityTo(65, 'male', 67))
      expect(() => survivalCurve(65, 'male').survivalTo(1.5)).toThrow(RangeError)
      expect(() => survivalCurve(65, 'average').deathProbabilityInYear(0.5)).toThrow(RangeError)
      const late = survivalCurve(118, 'average')
      expect(late.survivalTo(2)).toBe(0)
      expect(late.deathProbabilityGivenAlive(2)).toBe(curveValue('Average from 118, dying in year 2 given alive (survival 0)'))
    })

    it('survivalCurve: a man of 117 survives one year with 0.159543, two with 0.01874949336, three not at all (the closed last row)', () => {
      const curve = survivalCurve(117, 'male')
      expect(curve.survivalTo(0)).toBe(1)
      expect(withinTolerance(curve.survivalTo(1), curveValue('Male from 117, survivalTo(1)'), { rel: 1e-15 })).toBe(true)
      expect(withinTolerance(curve.survivalTo(2), curveValue('Male from 117, survivalTo(2)'), { rel: 1e-15 })).toBe(true)
      expect(curve.survivalTo(3)).toBe(curveValue('Male from 117, survivalTo(3)'))
      const deaths = [0, 1, 2, 3].map((t) => curve.deathProbabilityInYear(t))
      expect(withinTolerance(deaths.reduce((sum, p) => sum + p, 0), 1, { abs: 1e-15 })).toBe(true)
      expect(curve.deathProbabilityGivenAlive(2)).toBe(1)
      expect(() => survivalCurve(64.5, 'female')).toThrow(RangeError)
      expect(() => survivalCurve(63, 'female', 0)).toThrow(RangeError)
    })

    it('survivalProbabilityTo is the curve, bit for bit the product for a man or a woman and the mean of the two for \'average\', at every integer pair', () => {
      const mismatches: string[] = []
      for (const s of ['male', 'female', 'average'] as const) {
        for (let from = 0; from <= MAX_AGE + 1; from++) {
          const curve = survivalCurve(from, s)
          for (let to = from + 1; to <= MAX_AGE + 2; to++) {
            const view = survivalProbabilityTo(from, s, to)
            if (view !== referenceProduct(from, s, to) || view !== curve.survivalTo(to - from)) mismatches.push(`${s} ${from}->${to}`)
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
    const rows = worksheetExpectedRows('DOCS/calculations/longevity/survival-percentile-age.md')
    const ages = (label: string): number[] => rows.get(label)![0]!.split(',').map((age) => Number(age.trim()))

    it('the oldest age with conditional survival >= 97% from 65 is 66', () => {
      expect(survivalPercentileAge(currentAge, sex, pct, hazard)).toBe(example.expected.percentileAge)
      expect(ages('Male from 65 at 97%')).toEqual([example.expected.percentileAge])
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

    it('returns the floored current age for a current age past the table: 125 at 50 percent is 125', () => {
      expect(survivalPercentileAge(125, 'male', 50)).toBe(ages('Male from 125 at 50%')[0])
      expect(survivalPercentileAge(125.6, 'female', 10)).toBe(125)
    })

    it('reads \'average\' off the mixture: 85/91/95 at 65, not the means of a man\'s 83/89/94 and a woman\'s 86/92/96', () => {
      const at = (s: Sex) => [50, 25, 10].map((p) => survivalPercentileAge(65, s, p))
      expect(at('male')).toEqual(ages('Male from 65 at 50%, 25%, 10%'))
      expect(at('female')).toEqual(ages('Female from 65 at 50%, 25%, 10%'))
      expect(at('average')).toEqual(ages('Average from 65 at 50%, 25%, 10%'))
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
        singleSurvivalByAge: { 69: 0.929212164769243, 70: 0.9093586176567833, 71: 0.88853157723659 },
        jointSurvivalByAge: { 69: 0.9949890823833432, 70: 0.9917841398069108, 71: 0.9875747907266377 },
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
    const rows = worksheetExpectedRows('DOCS/calculations/longevity/joint-survival-percentile-age.md')

    it('two 65-year-old men at 99%: the last-survivor percentile age is 70', () => {
      expect(jointSurvivalPercentileAge(primary, partner, pct)).toBe(example.expected.jointPercentileAge)
    })

    it('single-life survival to 69, 70, 71 matches the worksheet within 1e-9', () => {
      for (const [age, expected] of Object.entries(single)) {
        expect(expected).toBe(worksheetNumber(rows.get(age)![0]!))
        const survival = survivalProbabilityTo(primary.age, primary.sex, Number(age), primary.hazard)
        expect(
          withinTolerance(survival, expected, example.tolerance),
          `single-life survival to ${age} ${survival} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expected}`,
        ).toBe(true)
      }
    })

    it('either-alive survival 1 - (1 - S)^2 qualifies at 70 (0.9918 >= 0.99) and fails at 71 (0.9876)', () => {
      // The worksheet's intermediate joint values, recomputed from the
      // single-life survivals the engine returns; the boundary the
      // production walk must stop at.
      for (const [age, expected] of Object.entries(joint)) {
        expect(expected).toBe(worksheetNumber(rows.get(age)![1]!))
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

    it('applies the partner\'s hazard to the partner\'s curve: a man of 65 with a woman of 63 at hazard 1.5 is 89/93/96, not 91/95/99', () => {
      const cell = rows.get('A man of 65 with a woman of 63 at hazard 1.5, at 50%, 25%, 10%')![0]!
      const expected = cell.split(',').map((age) => Number(age.trim()))
      const him = { age: 65, sex: 'male' as const, hazard: 1 }
      const her = { age: 63, sex: 'female' as const, hazard: 1.5 }
      expect([50, 25, 10].map((p) => jointSurvivalPercentileAge(him, her, p))).toEqual(expected)
      expect([50, 25, 10].map((p) => jointSurvivalPercentileAge(him, { ...her, hazard: 1 }, p))).not.toEqual(expected)
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
      inputs: { age: 65, multiplier: 0.8, identityAges: '18 to 110', printedMaleBaseline: 18.12 },
      expected: { male: 1.6380679198085089, female: 1.7644201878877537, average: 1.7001583225654944, ratio: 0.8 },
      tolerance: { abs: 1e-9 },
    },
    worksheet: 'DOCS/calculations/longevity/survival-hazard-from-expectancy-multiplier.md',
    mutation: 'DOCS/calculations/longevity/survival-hazard-from-expectancy-multiplier.mutation.md',
  },
  ({ example }) => {
    const age = example.inputs.age as number
    const m = example.inputs.multiplier as number
    const rows = worksheetExpectedRows('DOCS/calculations/longevity/survival-hazard-from-expectancy-multiplier.md')
    const sheet = (label: string): number => worksheetNumber(rows.get(label)![0]!)

    it('the identity multiplier m = 1 is exactly power 1 at all 279 age and sex points from 18 to 110', () => {
      const misses: string[] = []
      for (const sex of ['male', 'female', 'average'] as const) {
        for (let a = 18; a <= 110; a++) {
          const h = hazardForExpectancyMultiplier(a, sex, 1)
          if (h !== sheet('Power at m = 1, every age 18 to 110 and sex')) misses.push(`${sex} ${a}: ${h}`)
        }
      }
      expect({ count: misses.length, first: misses.slice(0, 5) }).toEqual({ count: 0, first: [] })
    })

    it('m = 0.8 at 65 aims at 0.8 times the curve\'s own expectancy: 1.63807 for a man, 1.76442 for a woman, 1.70016 for \'average\'', () => {
      const expected = example.expected as Record<string, number>
      const labels = { male: 'Male at 65, m = 0.8', female: 'Female at 65, m = 0.8', average: 'Average at 65, m = 0.8' } as const
      for (const sex of ['male', 'female', 'average'] as const) {
        const h = hazardForExpectancyMultiplier(age, sex, m)
        expect(expected[sex]).toBe(sheet(labels[sex]))
        expect(withinTolerance(h, expected[sex]!, example.tolerance), `${sex}: ${h}`).toBe(true)
        // The adjusted curve's expectancy is m times the unadjusted curve's.
        const ratio = curveExpectancy(age, sex, h) / curveExpectancy(age, sex, 1)
        expect(withinTolerance(ratio, sheet('Expectancy ratio at the solved power, m = 0.8'), example.tolerance), `${sex} ratio ${ratio}`).toBe(true)
      }
    })

    it('the questionnaire\'s baseline stays SSA\'s printed e (18.12 for a man of 65); the curve\'s own E(1) is 18.116335599472606', () => {
      expect(baselineRemainingYears(age, 'male')).toBe(sheet('Male printed e(65)'))
      expect(baselineRemainingYears(age, 'male')).toBe(example.inputs.printedMaleBaseline)
      expect(withinTolerance(curveExpectancy(age, 'male', 1), sheet('Male E(1) at 65'), { rel: 1e-12 })).toBe(true)
    })

    it('only m = 1 exactly returns 1: m = 0.9991, within 1e-3 of it, is bisected (1.00214 for a man of 65)', () => {
      const h = hazardForExpectancyMultiplier(age, 'male', 0.9991)
      expect(h).not.toBe(1)
      expect(withinTolerance(h, sheet('Male at 65, m = 0.9991'), example.tolerance), `${h}`).toBe(true)
    })

    it('a pick at m = 1 does not move: a woman of 25 at 10 percent gets 95, the unadjusted pick', () => {
      const h = hazardForExpectancyMultiplier(25, 'female', 1)
      expect(survivalPercentileAge(25, 'female', 10, h)).toBe(sheet('Female of 25 at 10%, power for m = 1'))
      expect(survivalPercentileAge(25, 'female', 10, h)).toBe(survivalPercentileAge(25, 'female', 10))
    })
  },
)
