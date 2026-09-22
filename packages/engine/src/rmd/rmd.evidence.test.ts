import { expect, it } from 'vitest'

import { packForYear, uniformLifetimeDivisor } from '../params/index.js'
import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import { jointLifeTableDivisor } from './jointLifeTable.js'
import { requiredMinimumDistribution } from './rmd.js'

const pack = packForYear(2026).pack

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

describeCalculation(
  'rmd-uniform-lifetime-divisor',
  {
    example: {
      inputs: {
        birthYear: 1951,
        ageAttained: 75,
        priorYearEndBalance: 246_000,
        uniformDivisorAt75: 24.6,
        soleSpouseMoreThanTenYearsYounger: 0,
      },
      expected: { rmd: 10_000 },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/rmd/rmd-uniform-lifetime-divisor.md',
    mutation: 'DOCS/calculations/rmd/rmd-uniform-lifetime-divisor.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number>
    const expected = example.expected as Record<string, number>

    it('divides the 246,000 prior year-end balance by the age-75 divisor 24.6', () => {
      expect(uniformLifetimeDivisor(pack, inputs.ageAttained!)).toBe(inputs.uniformDivisorAt75)
      const rmd = requiredMinimumDistribution(
        pack,
        inputs.birthYear!,
        inputs.ageAttained!,
        inputs.priorYearEndBalance!,
      )
      expectWithin(rmd, expected.rmd!, example.tolerance, 'rmd')
    })

    it('requires nothing before the cohort applicable age', () => {
      // The gate the claim names: the age-attained year is the first one with
      // a requirement, and a 1951 owner attains age 73 first.
      expect(requiredMinimumDistribution(pack, inputs.birthYear!, 72, inputs.priorYearEndBalance!)).toBe(0)
      expect(
        requiredMinimumDistribution(pack, inputs.birthYear!, 73, inputs.priorYearEndBalance!),
      ).toBeGreaterThan(0)
    })

    it('uses the prior year-end balance, so a different balance publishes a different RMD', () => {
      // The second wrong reading: 240,000 of current year-end balance would
      // publish about 9,756.10 instead.
      const fromCurrentYearEnd = requiredMinimumDistribution(pack, inputs.birthYear!, inputs.ageAttained!, 240_000)
      expect(fromCurrentYearEnd).not.toBe(expected.rmd)
    })
  },
)

describeCalculation(
  'rmd-joint-life-divisor',
  {
    example: {
      inputs: {
        ownerAgeAttained: 75,
        soleSpouseAgeAttained: 60,
        ageDifference: 15,
        priorYearEndBalance: 246_000,
        jointLifeDivisor: 28.3,
      },
      expected: { rmd: 8_692.58 },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/rmd/rmd-joint-life-divisor.md',
    mutation: 'DOCS/calculations/rmd/rmd-joint-life-divisor.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number>
    const expected = example.expected as Record<string, number>
    const BIRTH_YEAR = 1951

    it('divides by the 28.3 joint-life entry for a 75-year-old owner and a 60-year-old spouse', () => {
      expect(inputs.ownerAgeAttained! - inputs.soleSpouseAgeAttained!).toBe(inputs.ageDifference)
      expect(jointLifeTableDivisor(inputs.ownerAgeAttained!, inputs.soleSpouseAgeAttained!)).toBe(
        inputs.jointLifeDivisor,
      )
      const rmd = requiredMinimumDistribution(
        pack,
        BIRTH_YEAR,
        inputs.ownerAgeAttained!,
        inputs.priorYearEndBalance!,
        { spouse: { ageAttained: inputs.soleSpouseAgeAttained!, sex: 'average' } },
      )
      expectWithin(rmd, expected.rmd!, example.tolerance, 'rmd')
    })

    it('keeps the Uniform divisor when the gap is exactly ten years', () => {
      // "More than ten" is strict: a ten-year gap is not a qualifying spouse.
      const tenYearGap = requiredMinimumDistribution(
        pack,
        BIRTH_YEAR,
        inputs.ownerAgeAttained!,
        inputs.priorYearEndBalance!,
        { spouse: { ageAttained: inputs.ownerAgeAttained! - 10, sex: 'average' } },
      )
      expectWithin(tenYearGap, 10_000, example.tolerance, 'rmd at a ten-year gap')
    })
  },
)
