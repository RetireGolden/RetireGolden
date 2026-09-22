import { expect, it } from 'vitest'

import { rmdStartAgeForBirthYear } from '../params/index.js'
import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import { applicableAgeAttainYears, deriveRbdComparison } from './applicableAge.js'

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
  'rmd-applicable-age-attain-year',
  {
    example: {
      inputs: { ownerBirthYear: 1955, cohortApplicableAge: 73 },
      expected: { applicableAge: 73, attainYears: [2028], rbdYear: 2029, rbdMonth: 4, rbdDay: 1 },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/rmd/rmd-applicable-age-attain-year.md',
    mutation: 'DOCS/calculations/rmd/rmd-applicable-age-attain-year.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number>
    const expected = example.expected as { applicableAge: number; attainYears: number[]; rbdYear: number }

    it('places a 1955 birth in the settled age-73 cohort attaining that age in 2028', () => {
      expect(rmdStartAgeForBirthYear(inputs.ownerBirthYear!)).toBe(expected.applicableAge)
      expect(inputs.cohortApplicableAge).toBe(expected.applicableAge)
      const attainYears = applicableAgeAttainYears(inputs.ownerBirthYear!)
      expect(attainYears).toHaveLength(expected.attainYears.length)
      attainYears.forEach((year, index) => {
        expectWithin(year, expected.attainYears[index]!, example.tolerance, `attainYears[${index}]`)
      })
    })

    it('derives a required beginning date in calendar 2029, so a 2028 death is before it', () => {
      // The RBD year is internal; it is observable through the comparison. A
      // 2028 death is unambiguously before an RBD of April 1, 2029, and the
      // derivation refuses a contrary assertion for that same year.
      expect(
        deriveRbdComparison({
          ownerDeathYear: expected.rbdYear - 1,
          decedentHadStartedRmds: false,
          ownerBirthYear: inputs.ownerBirthYear!,
        }),
      ).toEqual({ kind: 'resolved', comparison: 'before-rbd', contestedApplicableAge: false })
      const contradicted = deriveRbdComparison({
        ownerDeathYear: expected.rbdYear - 1,
        decedentHadStartedRmds: true,
        ownerBirthYear: inputs.ownerBirthYear!,
      })
      expect(contradicted.kind).toBe('needs-review')
    })

    it('treats a death after the RBD year as on or after the required beginning date', () => {
      expect(
        deriveRbdComparison({
          ownerDeathYear: expected.rbdYear + 1,
          decedentHadStartedRmds: true,
          ownerBirthYear: inputs.ownerBirthYear!,
        }),
      ).toEqual({ kind: 'resolved', comparison: 'on-or-after-rbd', contestedApplicableAge: false })
    })

    it('does not borrow the contested 1959 cohort or the age-75 cohort', () => {
      // Both wrong readings shift the attain year: age 72 to 2027, age 75 to
      // 2030. Neither cohort claims a 1955 birth.
      expect(applicableAgeAttainYears(1959)).toEqual([2032, 2034])
      expect(applicableAgeAttainYears(1960)).toEqual([2035])
    })
  },
)
