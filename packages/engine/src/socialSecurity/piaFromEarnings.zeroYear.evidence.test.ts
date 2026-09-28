import { expect, it } from 'vitest'

import { describeCalculation, withinTolerance, worksheetExpectedRows, worksheetNumber } from '../rules/describeCalculation.js'
import { bendTierForAime, piaInputFromEarnings, zeroYearReplacementGain, zeroYearSampleEarnings } from './piaFromEarnings.js'

const WORKSHEET = 'DOCS/calculations/social-security/zero-year-replacement-gain.md'
const MUTATION = 'DOCS/calculations/social-security/zero-year-replacement-gain.mutation.md'

// Columns: replaced year, piaBefore, piaAfter, gainMonthly, startYearGainMonthly (2026).
const rows = worksheetExpectedRows(WORKSHEET)
const cell = (label: string, column: number): number => worksheetNumber(rows.get(label)![column]!)

const years = (from: number, to: number, amount: number) => Array.from({ length: to - from + 1 }, (_, i) => ({ year: from + i, amount }))
const inputA = piaInputFromEarnings(1966, 7, 20, years(1995, 2024, 60_000))
const inputC = piaInputFromEarnings(1966, 7, 20, years(1995, 2024, 300_000))
const inputN = piaInputFromEarnings(1966, 7, 20, years(1988, 2024, 60_000))
const inputO = piaInputFromEarnings(1958, 6, 15, years(1985, 2015, 50_000))
const asOf2026 = { startYear: 2026, colaAssumptionPct: 2.5 }

function expectGain(label: string, input: typeof inputA, amount: number): void {
  const gain = zeroYearReplacementGain(input, amount, asOf2026)!
  const dime = { abs: 1e-9 }
  expect(gain.year).toBe(cell(label, 0))
  expect(gain.amount).toBe(amount)
  expect(withinTolerance(gain.piaBefore, cell(label, 1), dime), `${label} before ${gain.piaBefore}`).toBe(true)
  expect(withinTolerance(gain.piaAfter, cell(label, 2), dime), `${label} after ${gain.piaAfter}`).toBe(true)
  expect(withinTolerance(gain.gainMonthly, cell(label, 3), dime), `${label} gain ${gain.gainMonthly}`).toBe(true)
  expect(withinTolerance(gain.startYearGainMonthly, cell(label, 4), dime), `${label} 2026 gain ${gain.startYearGainMonthly}`).toBe(true)
}

describeCalculation(
  'zero-year-replacement-gain',
  {
    example: {
      inputs: { dob: '1966-07-20', caseA: '$60,000 1995-2024, sample 60,000', caseB: 'as A, sample 300,000', caseC: '$300,000 1995-2024, sample 300,000' },
      expected: { A: cell('A', 3), B: cell('B', 3), C: cell('C', 3), O: cell('O', 4) },
      tolerance: { abs: 1e-9 },
    },
    worksheet: WORKSHEET,
    mutation: MUTATION,
  },
  () => {
    it('case A: 2027 at $60,000, unindexed, adds $45.70 (3,141.70 to 3,187.40)', () => {
      expectGain('A', inputA, 60_000)
    })

    it('case B: $300,000 is capped at the base and crosses the second bend point: $110.40, not $228.57', () => {
      expectGain('B', inputA, 300_000)
      expect(withinTolerance(zeroYearReplacementGain(inputA, 300_000)!.gainMonthly, (300_000 / 420) * 0.32, { abs: 0.05 })).toBe(false)
    })

    it('case C: above the second bend point the capped year adds $66.00', () => {
      expectGain('C', inputC, 300_000)
    })

    it('case O: past 61 the latest $0 year, 2019, has passed; its 17.90 for 2020 is 22.50 in 2026 dollars', () => {
      expectGain('O', inputO, 50_000)
      expect(zeroYearReplacementGain(inputO, 50_000)!.startYearGainMonthly).toBe(cell('O', 3))
    })

    it('no gain when no averaged year is $0 or the sample is not positive; the sample is the latest reported year', () => {
      expect(zeroYearReplacementGain(inputN, 60_000)).toBeNull()
      expect(zeroYearReplacementGain(inputA, 0)).toBeNull()
      expect(zeroYearSampleEarnings(inputA)).toBe(60_000)
      const projected = piaInputFromEarnings(1966, 7, 20, years(1995, 2024, 60_000), { assumedAnnualEarnings: 45_000, throughAge: 60 })
      expect(zeroYearSampleEarnings(projected)).toBe(45_000)
      expect(bendTierForAime(7_487, 2028).label).toBe('32%')
      expect(bendTierForAime(12_252, 2028).label).toBe('15%')
    })
  },
)
