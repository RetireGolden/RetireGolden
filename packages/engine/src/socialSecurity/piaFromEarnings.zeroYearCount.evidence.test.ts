import { expect, it } from 'vitest'

import { describeCalculation, worksheetExpectedRows, worksheetNumber } from '../rules/describeCalculation.js'
import { computePiaFromEarnings, isPiaFromEarningsError, piaInputFromEarnings, type PiaFromEarningsResult } from './piaFromEarnings.js'

const WORKSHEET = 'DOCS/calculations/social-security/aime-zero-year-count.md'
const MUTATION = 'DOCS/calculations/social-security/aime-zero-year-count.mutation.md'

// Columns: computationYearCount, zeroYearsInAime, AIME.
const rows = worksheetExpectedRows(WORKSHEET)
const cell = (label: string, column: number): number => worksheetNumber(rows.get(label)![column]!)

const years = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => ({ year: from + i, amount: 60_000 }))
function computed(from: number, to: number): PiaFromEarningsResult {
  const result = computePiaFromEarnings(piaInputFromEarnings(1966, 7, 20, years(from, to)))
  if (isPiaFromEarningsError(result)) throw new Error(result.message)
  return result
}

describeCalculation(
  'aime-zero-year-count',
  {
    example: {
      inputs: { dob: '1966-07-20', caseA: '1995-2024', caseB: '1988-2024', caseC: '2020-2024', amount: 60_000 },
      expected: { A: cell('A', 1), B: cell('B', 1), C: cell('C', 1) },
      tolerance: 'exact',
    },
    worksheet: WORKSHEET,
    mutation: MUTATION,
  },
  () => {
    it('case A: 5 of the 35 averaged years are $0 (not the 10 zero base years)', () => {
      const result = computed(1995, 2024)
      expect([result.computationYearCount, result.zeroYearsInAime, result.aime]).toEqual([cell('A', 0), cell('A', 1), cell('A', 2)])
      expect(result.indexedYears.filter((row) => row.indexedAnnual === 0)).toHaveLength(10)
    })

    it('case B: three $0 base years, all dropped, so none averaged', () => {
      const result = computed(1988, 2024)
      expect([result.computationYearCount, result.zeroYearsInAime, result.aime]).toEqual([cell('B', 0), cell('B', 1), cell('B', 2)])
    })

    it('case C: five earning years leave 30 averaged $0 years', () => {
      const result = computed(2020, 2024)
      expect([result.computationYearCount, result.zeroYearsInAime, result.aime]).toEqual([cell('C', 0), cell('C', 1), cell('C', 2)])
    })
  },
)
