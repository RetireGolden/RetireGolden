import { expect, it } from 'vitest'
import { MALE } from '../longevity/ssaPeriod2022.js'
import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import { annualMortality, jointLastSurvivorExpectancy, MAX_AGE, sampleDeathAge, type Sex } from './mortality.js'
import type { Rng } from './rng.js'

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

describeCalculation(
  'mortality-ex-to-qx-identity',
  {
    example: {
      inputs: { sex: 'male', expectancyRows: { 65: 17.48, 66: 16.79, 67: 16.11, 68: 15.43 } },
      expected: {
        q65: 0.0179294389820704,
        q66: 0.0192655027092113,
        q67: 0.0200878844946641,
        twoYearSurvival: 0.963150477964002,
      },
      tolerance: { abs: 1e-12 },
    },
    worksheet: 'DOCS/calculations/longevity/mortality-ex-to-qx-identity.md',
    mutation: 'DOCS/calculations/longevity/mortality-ex-to-qx-identity.mutation.md',
  },
  ({ example }) => {
    const sex = example.inputs.sex as Sex
    const rows = example.inputs.expectancyRows as Record<string, number>

    it('reads the worksheet\'s SSA 2022 male rows e(65..68) from the embedded table', () => {
      // The production function reads the embedded table, so the fixture's
      // inputs are checked against it rather than injected.
      for (const [age, expectancy] of Object.entries(rows)) {
        expect(MALE[Number(age)]).toBe(expectancy)
      }
    })

    it('derives q(65), q(66), q(67) as 1 - (e(x) - 0.5)/(e(x+1) + 0.5)', () => {
      const q65 = annualMortality(65, sex)
      const q66 = annualMortality(66, sex)
      const q67 = annualMortality(67, sex)
      const expectedQ65 = example.expected.q65 as number
      const expectedQ66 = example.expected.q66 as number
      const expectedQ67 = example.expected.q67 as number
      expect(
        withinTolerance(q65, expectedQ65, example.tolerance),
        `q(65) ${q65} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expectedQ65}`,
      ).toBe(true)
      expect(
        withinTolerance(q66, expectedQ66, example.tolerance),
        `q(66) ${q66} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expectedQ66}`,
      ).toBe(true)
      expect(
        withinTolerance(q67, expectedQ67, example.tolerance),
        `q(67) ${q67} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expectedQ67}`,
      ).toBe(true)
    })

    it('two-year survival (1 - q65)(1 - q66) = 0.963150477964002', () => {
      const survival = (1 - annualMortality(65, sex)) * (1 - annualMortality(66, sex))
      const expected = example.expected.twoYearSurvival as number
      expect(
        withinTolerance(survival, expected, example.tolerance),
        `twoYearSurvival ${survival} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expected}`,
      ).toBe(true)
    })

    it('forces death at the table endpoint: q(119) = 1', () => {
      // Endpoint of the claim: the last row has no e(x+1) to divide by.
      expect(MAX_AGE).toBe(119)
      expect(annualMortality(MAX_AGE, sex)).toBe(1)
      // The planner-ui copy of this identity (socialSecurity/expectedPv.ts)
      // is proved to agree with annualMortality in that package's own suite,
      // expectedPv.mortalityParity.test.ts, so this file never loads a UI
      // module (record limits; relocation packet B2-P1).
    })
  },
)

describeCalculation(
  'mortality-sampled-death-age',
  {
    example: {
      inputs: {
        currentAge: 65,
        sex: 'male',
        draws: [0.5, 0.01],
        q65: 0.0179294389820704,
        q66: 0.0192655027092113,
      },
      expected: { deathAge: 66 },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/longevity/mortality-sampled-death-age.md',
    mutation: 'DOCS/calculations/longevity/mortality-sampled-death-age.mutation.md',
  },
  ({ example }) => {
    const sex = example.inputs.sex as Sex
    const currentAge = example.inputs.currentAge as number
    const draws = example.inputs.draws as readonly number[]

    it('survives 65 on a 0.5 draw, dies in the age-66 interval on a 0.01 draw: returns 66', () => {
      const rng = drawsRng(draws)
      expect(sampleDeathAge(rng, currentAge, sex)).toBe(example.expected.deathAge)
      // One draw per year walked: exactly the two the worksheet supplies.
      expect(rng.consumed()).toBe(draws.length)
    })

    it('compares each draw against the q(x) the worksheet derives', () => {
      // The worksheet's two comparisons: 0.5 >= q65 (survive), 0.01 < q66 (die).
      expect(draws[0]!).toBeGreaterThanOrEqual(annualMortality(65, sex))
      expect(draws[1]!).toBeLessThan(annualMortality(66, sex))
      // The fixture's tolerance is 'exact' for the integer death age; the
      // worksheet's q(x) inputs are checked at the identity record's 1e-12.
      const q65 = annualMortality(65, sex)
      const q66 = annualMortality(66, sex)
      const inputQ65 = example.inputs.q65 as number
      const inputQ66 = example.inputs.q66 as number
      expect(
        withinTolerance(q65, inputQ65, { abs: 1e-12 }),
        `q(65) ${q65} is not within 1e-12 of the worksheet's ${inputQ65}`,
      ).toBe(true)
      expect(
        withinTolerance(q66, inputQ66, { abs: 1e-12 }),
        `q(66) ${q66} is not within 1e-12 of the worksheet's ${inputQ66}`,
      ).toBe(true)
    })

    it('at the table endpoint returns 119 without consuming a draw', () => {
      // Degenerate case of the walk: nobody is sampled past the last row.
      const rng = drawsRng([])
      expect(sampleDeathAge(rng, MAX_AGE, sex)).toBe(MAX_AGE)
      expect(rng.consumed()).toBe(0)
    })
  },
)

describeCalculation(
  'mortality-joint-last-survivor-expectancy',
  {
    example: {
      inputs: { ageA: 118, sexA: 'male', ageB: 118, sexB: 'male', expectancyRows: { 118: 0.54, 119: 0.5 } },
      expected: { jointExpectancyYears: 0.5784 },
      tolerance: { abs: 1e-12 },
    },
    worksheet: 'DOCS/calculations/longevity/mortality-joint-last-survivor-expectancy.md',
    mutation: 'DOCS/calculations/longevity/mortality-joint-last-survivor-expectancy.mutation.md',
  },
  ({ example }) => {
    const ageA = example.inputs.ageA as number
    const ageB = example.inputs.ageB as number
    const sexA = example.inputs.sexA as Sex
    const sexB = example.inputs.sexB as Sex
    const rows = example.inputs.expectancyRows as Record<string, number>

    it('reads the worksheet\'s SSA 2022 male rows e(118) and e(119) from the embedded table', () => {
      for (const [age, expectancy] of Object.entries(rows)) {
        expect(MALE[Number(age)]).toBe(expectancy)
      }
    })

    it('two male lives at 118: 0.5 + (1 - 0.96^2) = 0.5784 years', () => {
      const expectancy = jointLastSurvivorExpectancy(ageA, sexA, ageB, sexB)
      const expected = example.expected.jointExpectancyYears as number
      expect(
        withinTolerance(expectancy, expected, example.tolerance),
        `jointExpectancyYears ${expectancy} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expected}`,
      ).toBe(true)
    })

    it('one-year survival for either life at 118 is 0.04, and the endpoint forces zero survival after', () => {
      // The worksheet's intermediate: (0.54 - 0.5)/(0.50 + 0.5) = 0.04.
      const survivalAt118 = 1 - annualMortality(ageA, sexA)
      expect(
        withinTolerance(survivalAt118, 0.04, example.tolerance),
        `one-year survival at 118 ${survivalAt118} is not within ${JSON.stringify(example.tolerance)} of the worksheet's 0.04`,
      ).toBe(true)
      expect(annualMortality(ageA + 1, sexA)).toBe(1)
    })

    it('at the table endpoint both lives die within the year: exactly the 0.5 convention', () => {
      // Degenerate case: q(119) = 1 makes both survivals 0 from t = 1 on.
      expect(jointLastSurvivorExpectancy(MAX_AGE, sexA, MAX_AGE, sexB)).toBe(0.5)
    })
  },
)
