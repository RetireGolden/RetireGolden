import { expect, it } from 'vitest'

import { describeCalculation, worksheetExpectedRows, worksheetNumber } from '../rules/describeCalculation.js'
import { ssa44PremiumDifference } from './survivorTransition.js'

const WORKSHEET = 'DOCS/calculations/social-security/survivor-ssa44-premium-difference.md'
const MUTATION = 'DOCS/calculations/social-security/survivor-ssa44-premium-difference.mutation.md'

const rows = worksheetExpectedRows(WORKSHEET)
const expectedOf = (label: string): number => worksheetNumber(rows.get(label)![0]!)

const without = [
  { year: 2040, medicarePremiums: 5_000 },
  { year: 2041, medicarePremiums: 4_800 },
  { year: 2042, medicarePremiums: 2_500 },
]
const withRelief = [
  { year: 2040, medicarePremiums: 3_000 },
  { year: 2041, medicarePremiums: 2_900 },
  { year: 2042, medicarePremiums: 2_510 },
]

describeCalculation(
  'survivor-ssa44-premium-difference',
  {
    example: {
      inputs: { without, withRelief, deathYear: 2039, reliefYears: [2040, 2041] },
      expected: { total: expectedOf('M-B total'), reliefYears: expectedOf('M-B relief years') },
      tolerance: 'exact',
    },
    worksheet: WORKSHEET,
    mutation: MUTATION,
  },
  ({ example }) => {
    it('M-B: the whole-projection difference carries the later knock-on; the relief-year part is the two years after the death', () => {
      const difference = ssa44PremiumDifference(without, withRelief, [2040, 2041])
      expect(difference.total).toBe(example.expected.total)
      expect(difference.reliefYears).toBe(example.expected.reliefYears)
      // A year the relief run lacks is skipped on both sums.
      expect(ssa44PremiumDifference(without, withRelief.slice(0, 2), [2040, 2041])).toEqual({ total: 3_900, reliefYears: 3_900 })
    })
  },
)
