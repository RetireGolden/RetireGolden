import { expect, it } from 'vitest'
import { SSA_PERIOD_LIFE_TABLE } from '../longevity/ssaPeriodLifeTable.js'
import { describeCalculation, withinTolerance, worksheetExpectedRows, worksheetNumber } from '../rules/describeCalculation.js'
import { annualMortality, jointLastSurvivorExpectancy, MAX_AGE, sampleDeathAge, type Sex, type TableSex } from './mortality.js'
import type { Rng } from './rng.js'
import { survivalCurve } from './survival.js'

/** An Rng that hands out the worksheet's draws in order and counts them. */
function drawsRng(draws: readonly number[]): Rng & { readonly consumed: () => number } {
  let index = 0
  return {
    next: () => {
      const draw = draws[index]
      if (draw === undefined) throw new RangeError(`the fixture supplies ${draws.length} draws; draw ${index} was requested`)
      index += 1
      return draw
    },
    nextNormal: () => {
      throw new RangeError('nextNormal is not part of the death-age walk')
    },
    nextInt: () => {
      throw new RangeError('nextInt is not part of the death-age walk')
    },
    consumed: () => index,
  }
}

/** The largest double below 1: at least every probability of dying below 1, so a year drawn with it is survived. */
const SURVIVE = 1 - 2 ** -53

/**
 * The probability sampleDeathAge compares its draw with in year t, found
 * through sampleDeathAge alone: every earlier year is survived, and the
 * smallest draw that survives year t is that probability (the walk dies when
 * the draw is below it). Bisection over doubles until the two ends are
 * adjacent.
 */
function probedDeathProbability(from: number, sex: Sex, t: number): number {
  const dies = (u: number): boolean => {
    let index = 0
    const rng: Rng = {
      next: () => (index++ === t ? u : SURVIVE),
      nextNormal: () => 0,
      nextInt: () => 0,
    }
    return sampleDeathAge(rng, from, sex) === from + t
  }
  // A walk that never dies in year t, even on a draw of 0, has no probability to find.
  if (!dies(0)) return Number.NaN
  let lo = 0 // dies
  let hi = 1 // survives
  for (;;) {
    const mid = (lo + hi) / 2
    if (mid === lo || mid === hi) return hi
    if (dies(mid)) lo = mid
    else hi = mid
  }
}

const publishedRows = worksheetExpectedRows('DOCS/calculations/longevity/mortality-published-death-probability.md')
const published = (label: string): number => worksheetNumber(publishedRows.get(label)![0]!)
const tableRows = worksheetExpectedRows('DOCS/calculations/longevity/ssa-period-life-table.md')

describeCalculation(
  'mortality-published-death-probability',
  {
    example: {
      inputs: { ages: [65.9, 65, 118, 119, 130, -1], sexes: ['male', 'female'] },
      expected: {
        male65point9: published('Male, age 65.9'),
        female65: published('Female, age 65'),
        male118: published('Male, age 118'),
        at119: published('Either sex, age 119'),
        at130: published('Either sex, age 130'),
        belowZero: published('Either sex, age −1'),
      },
      tolerance: { abs: 0 },
    },
    worksheet: 'DOCS/calculations/longevity/mortality-published-death-probability.md',
    mutation: 'DOCS/calculations/longevity/mortality-published-death-probability.mutation.md',
  },
  ({ example }) => {
    const expected = example.expected as Record<string, number>

    it('reads SSA\'s published q at the floored age: a man of 65.9 is 0.016455, a woman of 65 is 0.010188, a man of 118 is 0.88248', () => {
      expect(annualMortality(65.9, 'male')).toBe(expected.male65point9)
      expect(annualMortality(65, 'female')).toBe(expected.female65)
      expect(annualMortality(118, 'male')).toBe(expected.male118)
    })

    it('equals the ssa-period-life-table worksheet\'s q for every age 0 to 118 and both sexes, with no arithmetic', () => {
      const mismatches: string[] = []
      for (const [age, cells] of tableRows) {
        const x = Number(age)
        if (x > 118) continue
        if (annualMortality(x, 'male') !== worksheetNumber(cells[0]!)) mismatches.push(`male ${x}`)
        if (annualMortality(x, 'female') !== worksheetNumber(cells[2]!)) mismatches.push(`female ${x}`)
      }
      expect(mismatches).toEqual([])
    })

    it('closes the table at 119: 1 at 119 and 130, although SSA prints 0.926604 at 119; 0 below age 0', () => {
      expect(MAX_AGE).toBe(119)
      for (const sex of ['male', 'female'] as const) {
        expect(annualMortality(MAX_AGE, sex)).toBe(expected.at119)
        expect(annualMortality(130, sex)).toBe(expected.at130)
        expect(annualMortality(-1, sex)).toBe(expected.belowZero)
        expect(SSA_PERIOD_LIFE_TABLE[sex].q[MAX_AGE]).toBe(published('Printed q(119), carried and not read'))
      }
    })

    it('refuses \'average\', which has no single death probability', () => {
      expect(() => annualMortality(65, 'average' as TableSex)).toThrow(RangeError)
    })
  },
)

const drawRows = worksheetExpectedRows('DOCS/calculations/longevity/mortality-sampled-death-age.md')
const drawValue = (label: string): number => worksheetNumber(drawRows.get(label)![0]!)

describeCalculation(
  'mortality-sampled-death-age',
  {
    example: {
      inputs: {
        currentAge: 65,
        sex: 'male',
        draws: [0.5, 0.01],
        q65: 0.016455,
        q66: 0.017574,
        averageDraws: [0.5, 0.01422, 0],
      },
      expected: { deathAge: 66, averageDeathAge: 67 },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/longevity/mortality-sampled-death-age.md',
    mutation: 'DOCS/calculations/longevity/mortality-sampled-death-age.mutation.md',
  },
  ({ example }) => {
    const sex = example.inputs.sex as TableSex
    const currentAge = example.inputs.currentAge as number
    const draws = example.inputs.draws as readonly number[]

    it('survives 65 on a 0.5 draw, dies in the age-66 interval on a 0.01 draw: returns 66', () => {
      const rng = drawsRng(draws)
      expect(sampleDeathAge(rng, currentAge, sex)).toBe(example.expected.deathAge)
      expect(example.expected.deathAge).toBe(drawValue('Male from 65, draws 0.5 and 0.01: death age'))
      // One draw per year walked: exactly the two the worksheet supplies.
      expect(rng.consumed()).toBe(draws.length)
    })

    it('compares each draw against SSA\'s published q(x)', () => {
      // The worksheet's two comparisons: 0.5 >= q65 (survive), 0.01 < q66 (die).
      expect(annualMortality(65, sex)).toBe(example.inputs.q65)
      expect(annualMortality(66, sex)).toBe(example.inputs.q66)
      expect(draws[0]!).toBeGreaterThanOrEqual(annualMortality(65, sex))
      expect(draws[1]!).toBeLessThan(annualMortality(66, sex))
    })

    it('\'average\' walks the mixture: draws 0.5, 0.01422, 0 survive 65 and 66 and die at 67, where the mean of q would die at 66', () => {
      const averageDraws = example.inputs.averageDraws as readonly number[]
      const rng = drawsRng(averageDraws)
      expect(sampleDeathAge(rng, currentAge, 'average')).toBe(example.expected.averageDeathAge)
      expect(example.expected.averageDeathAge).toBe(drawValue('\'average\' from 65, draws 0.5, 0.01422 and 0: death age'))
      expect(rng.consumed()).toBe(3)
      // The second draw sits between the mixture's 0.0142164 and the mean q(66), 0.014227.
      const meanQ66 = (annualMortality(66, 'male') + annualMortality(66, 'female')) / 2
      expect(averageDraws[1]!).toBeLessThan(meanQ66)
    })

    it('the draw\'s distribution is the curve\'s: probed through sampleDeathAge alone, one draw per year, it is the mixture\'s for \'average\' and q itself for a man', () => {
      // Each year's probability, measured as the smallest surviving draw.
      const labels = [
        '\'average\' from 65, dying at 65 given alive',
        '\'average\' from 65, dying at 66 given alive',
        '\'average\' from 65, dying at 67 given alive',
      ]
      labels.forEach((label, t) => {
        const probed = probedDeathProbability(65, 'average', t)
        // One minus a ratio of survivals near 1: two digits go to cancellation in doubles.
        expect(withinTolerance(probed, drawValue(label), { rel: 1e-13 }), `${label}: ${probed}`).toBe(true)
      })
      expect(probedDeathProbability(65, 'average', 1)).not.toBe((annualMortality(66, 'male') + annualMortality(66, 'female')) / 2)
      for (let t = 0; t < 5; t++) expect(probedDeathProbability(65, 'male', t)).toBe(annualMortality(65 + t, 'male'))
      // P(death at from + t) = the earlier years' survivals times this year's death: the curve's deathProbabilityInYear.
      const misses: string[] = []
      for (const from of [0, 22, 65, 85, 110]) {
        const curve = survivalCurve(from, 'average')
        let alive = 1
        let total = 0
        for (let t = 0; from + t < MAX_AGE; t++) {
          const g = probedDeathProbability(from, 'average', t)
          if (g !== curve.deathProbabilityGivenAlive(t)) misses.push(`from ${from}, year ${t}: probed ${g} against ${curve.deathProbabilityGivenAlive(t)}`)
          const p = alive * g
          total += p
          if (!withinTolerance(p, curve.deathProbabilityInYear(t), { abs: 1e-15 })) misses.push(`from ${from}, year ${t}: ${p} against ${curve.deathProbabilityInYear(t)}`)
          alive *= 1 - g
        }
        // Whoever is left at 119 dies there, without a draw.
        total += alive
        if (!withinTolerance(total, 1, { abs: 1e-12 })) misses.push(`from ${from}: total ${total}`)
      }
      expect(misses).toEqual([])
      expect(withinTolerance(survivalCurve(65, 'average').deathProbabilityInYear(1), drawValue('\'average\' from 65, P(death at 66)'), { rel: 1e-13 })).toBe(true)
      expect(withinTolerance(survivalCurve(65, 'average').deathProbabilityInYear(2), drawValue('\'average\' from 65, P(death at 67)'), { rel: 1e-13 })).toBe(true)
    })

    it('floors a fractional starting age: a man of 65.9 on the draws 0.5 and 0.01 dies at 66, as a man of 65 does', () => {
      const rng = drawsRng(draws)
      expect(sampleDeathAge(rng, 65.9, sex)).toBe(drawValue('Male from 65.9, draws 0.5 and 0.01: death age'))
      expect(rng.consumed()).toBe(2)
    })

    it('draws at each age below 119 and none at 119: a man of 117 who survives two draws is returned at 119 after two', () => {
      const rng = drawsRng([SURVIVE, SURVIVE])
      expect(sampleDeathAge(rng, 117, sex)).toBe(drawValue('Male from 117, surviving both draws: death age'))
      expect(rng.consumed()).toBe(drawValue('Male from 117, surviving both draws: draws consumed'))
    })

    it('at the table endpoint returns 119 without consuming a draw', () => {
      // Degenerate case of the walk: nobody is sampled past the last row.
      const rng = drawsRng([])
      expect(sampleDeathAge(rng, MAX_AGE, sex)).toBe(drawValue('From 119: death age, with no draw'))
      expect(sampleDeathAge(rng, MAX_AGE, 'average')).toBe(MAX_AGE)
      expect(rng.consumed()).toBe(0)
    })
  },
)

const jointRows = worksheetExpectedRows('DOCS/calculations/longevity/mortality-joint-last-survivor-expectancy.md')
const jointValue = (label: string): number => worksheetNumber(jointRows.get(label)![0]!)

describeCalculation(
  'mortality-joint-last-survivor-expectancy',
  {
    example: {
      inputs: { ageA: 118, sexA: 'male', ageB: 118, sexB: 'male', q118: 0.88248 },
      expected: { jointExpectancyYears: 0.7212290496 },
      tolerance: { abs: 1e-12 },
    },
    worksheet: 'DOCS/calculations/longevity/mortality-joint-last-survivor-expectancy.md',
    mutation: 'DOCS/calculations/longevity/mortality-joint-last-survivor-expectancy.mutation.md',
  },
  ({ example }) => {
    const ageA = example.inputs.ageA as number
    const ageB = example.inputs.ageB as number
    const sexA = example.inputs.sexA as TableSex
    const sexB = example.inputs.sexB as TableSex

    it('two male lives at 118: 0.5 + (1 - 0.88248^2) = 0.7212290496 years', () => {
      const expectancy = jointLastSurvivorExpectancy(ageA, sexA, ageB, sexB)
      const expected = example.expected.jointExpectancyYears as number
      expect(expected).toBe(jointValue('Two men of 118'))
      expect(
        withinTolerance(expectancy, expected, example.tolerance),
        `jointExpectancyYears ${expectancy} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expected}`,
      ).toBe(true)
    })

    it('one-year survival for either life at 118 is 1 - 0.88248 = 0.11752, and the closed last row forces zero survival after', () => {
      expect(annualMortality(ageA, sexA)).toBe(example.inputs.q118)
      const survivalAt118 = survivalCurve(ageA, sexA).survivalTo(1)
      expect(withinTolerance(survivalAt118, jointValue('One-year survival of a man of 118'), example.tolerance)).toBe(true)
      expect(survivalCurve(ageA, sexA).survivalTo(2)).toBe(0)
    })

    it('a man of 70 and a woman of 67: 21.80655867930931 years; two \'average\' lives of those ages: the mean of the four sex pairings, 21.52705755500049', () => {
      const mixed = jointLastSurvivorExpectancy(70, 'male', 67, 'female')
      expect(withinTolerance(mixed, jointValue('Man of 70, woman of 67'), { rel: 1e-12 }), `70/67: ${mixed}`).toBe(true)
      const bothAverage = jointLastSurvivorExpectancy(70, 'average', 67, 'average')
      expect(withinTolerance(bothAverage, jointValue('Two \'average\' lives of 70 and 67'), { rel: 1e-12 }), `average/average: ${bothAverage}`).toBe(true)
      const pairings = (['male', 'female'] as const).flatMap((a) => (['male', 'female'] as const).map((b) => jointLastSurvivorExpectancy(70, a, 67, b)))
      const fourPairings = pairings.reduce((sum, value) => sum + value, 0) / 4
      expect(withinTolerance(bothAverage, fourPairings, { rel: 1e-12 })).toBe(true)
      // Not the opposite-sex reading, the mean of the two mixed pairings only.
      const oppositeSex = (pairings[1]! + pairings[2]!) / 2
      expect(withinTolerance(bothAverage, oppositeSex, { rel: 1e-4 })).toBe(false)
    })

    it('floors fractional ages, and a negative age survives with certainty until it reaches 0', () => {
      const floored = jointLastSurvivorExpectancy(118.7, 'male', 118.2, 'male')
      expect(withinTolerance(floored, jointValue('Two men of 118.7 and 118.2 (floored ages)'), example.tolerance), `${floored}`).toBe(true)
      expect(floored).toBe(jointLastSurvivorExpectancy(118, 'male', 118, 'male'))
      const negative = jointLastSurvivorExpectancy(-2, 'male', 118, 'male')
      expect(withinTolerance(negative, jointValue('A man at age −2 and a man of 118'), { rel: 1e-12 }), `${negative}`).toBe(true)
    })

    it('at the table endpoint both lives die within the year: exactly the 0.5 convention', () => {
      // Degenerate case: the closed last row makes both survivals 0 from t = 1 on.
      expect(jointLastSurvivorExpectancy(MAX_AGE, sexA, MAX_AGE, sexB)).toBe(0.5)
      expect(jointLastSurvivorExpectancy(MAX_AGE, 'average', MAX_AGE, 'average')).toBe(0.5)
    })
  },
)
