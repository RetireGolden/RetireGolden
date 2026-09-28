import { expect, it } from 'vitest'

import { describeCalculation, worksheetExpectedRows, worksheetNumber } from '../rules/describeCalculation.js'
import { survivorShortfallYearCount } from './survivorTransition.js'

const WORKSHEET = 'DOCS/calculations/social-security/survivor-shortfall-year-count.md'
const MUTATION = 'DOCS/calculations/social-security/survivor-shortfall-year-count.mutation.md'

const rows = worksheetExpectedRows(WORKSHEET)
const expectedOf = (label: string): number => worksheetNumber(rows.get(label)![0]!)

const alive = [{ alive: true }, { alive: false }]
const years = [
  { year: 2040, requiredShortfall: 900, people: [{ alive: true }, { alive: true }] },
  { year: 2041, requiredShortfall: 0, people: alive },
  { year: 2042, requiredShortfall: 0.004, people: alive },
  { year: 2043, requiredShortfall: 0.006, people: alive },
  { year: 2044, requiredShortfall: 1_200, people: alive },
  { year: 2045, requiredShortfall: 5_000, people: [{ alive: false }, { alive: false }] },
]

describeCalculation(
  'survivor-shortfall-year-count',
  {
    example: {
      inputs: { deathYear: 2040, years },
      expected: { count: expectedOf('C-A count') },
      tolerance: 'exact',
    },
    worksheet: WORKSHEET,
    mutation: MUTATION,
  },
  ({ example }) => {
    it('C-A: counts required-spending shortfalls above the funding tolerance after the death year, with someone alive', () => {
      expect(survivorShortfallYearCount(years, 2040)).toBe(example.expected.count)
    })
  },
)
