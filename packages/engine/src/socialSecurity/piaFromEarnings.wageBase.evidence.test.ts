import { expect, it } from 'vitest'

import {
  describeCalculation,
  withinTolerance,
  worksheetExpectedRows,
  worksheetNumber,
} from '../rules/describeCalculation.js'
import {
  FIRST_COMPUTATION_BASE_YEAR,
  computePiaFromEarnings,
  isPiaFromEarningsError,
  piaInputFromEarnings,
  type PiaFromEarningsResult,
  type YearEarning,
} from './piaFromEarnings.js'
import { WAGE_BASE_BY_YEAR, wageBaseForYearOrLatest } from './ssaWageData.js'

const WORKSHEET = 'DOCS/calculations/social-security/aime-covered-earnings-cap.md'
const MUTATION = 'DOCS/calculations/social-security/aime-covered-earnings-cap.mutation.md'

// The Expected table's "Before" and "After" columns, read from the worksheet.
const rows = worksheetExpectedRows(WORKSHEET)
const before = (label: string): number => worksheetNumber(rows.get(label)![0]!)
const after = (label: string): number => worksheetNumber(rows.get(label)![1]!)

function pia(dob: [number, number, number], earnings: YearEarning[]): PiaFromEarningsResult {
  const result = computePiaFromEarnings(piaInputFromEarnings(dob[0], dob[1], dob[2], earnings))
  if (isPiaFromEarningsError(result)) throw new Error(result.code)
  return result
}

describeCalculation(
  'aime-covered-earnings-cap',
  {
    example: {
      inputs: {
        caseA: { dob: '1956-08-14', earnings: '50,000 each year 1978 through 2017' },
        caseB: { dob: '1925-03-03', earnings: '20,000 in 1960 and 1970' },
        basesFromSsa: { 1937: 3_000, 1950: 3_000, 1951: 3_600, 1955: 4_200, 1959: 4_800, 1966: 6_600, 1968: 7_800, 1972: 9_000, 1973: 10_800, 1974: 13_200, 1975: 14_100, 1976: 15_300, 1977: 16_500, 1978: 17_700, 1979: 22_900, 2026: 184_500 },
      },
      expected: {
        caseA1978Counted: after('A, 1978 counted'),
        caseA1978Indexed: after('A, 1978 indexed'),
        caseAAime: after('A, AIME'),
        caseAPia: after('A, PIA'),
        caseBFirstYear: after('B, first window year'),
        caseBYears: after('B, computation years'),
        caseBAime: after('B, AIME'),
        caseBPia: after('B, PIA'),
        beforeAAime: before('A, AIME'),
        beforeAPia: before('A, PIA'),
        beforeBAime: before('B, AIME'),
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: WORKSHEET,
    mutation: MUTATION,
  },
  ({ example }) => {
    const expected = example.expected as Record<string, number>
    const bases = (example.inputs as { basesFromSsa: Record<string, number> }).basesFromSsa

    it('carries SSA\'s contribution and benefit bases from 1937, and none before', () => {
      for (const [year, base] of Object.entries(bases)) expect(WAGE_BASE_BY_YEAR[Number(year)], year).toBe(base)
      for (let year = 1937; year <= 2026; year++) expect(WAGE_BASE_BY_YEAR[year], String(year)).toBeGreaterThan(0)
      expect(wageBaseForYearOrLatest(1936)).toBe(0)
      expect(wageBaseForYearOrLatest(2030)).toBe(184_500)
      expect(FIRST_COMPUTATION_BASE_YEAR).toBe(1951)
    })

    it('case A: the 1978 wage counts only its 17,700 base (AIME 7,436, PIA 2,551.90, not 7,790 and 2,605.00)', () => {
      const earnings = Array.from({ length: 40 }, (_, index) => ({ year: 1978 + index, amount: 50_000 }))
      const result = pia([1956, 8, 14], earnings)
      const row1978 = result.indexedYears.find((row) => row.year === 1978)!
      expect(row1978.cappedEarnings).toBe(expected.caseA1978Counted)
      expect(row1978.indexedAnnual).toBe(expected.caseA1978Indexed)
      expect(result.aime).toBe(expected.caseAAime)
      expect(withinTolerance(result.piaMonthly, expected.caseAPia!, example.tolerance), `PIA ${result.piaMonthly}`).toBe(true)
      expect(result.aime).not.toBe(expected.beforeAAime)
      expect(withinTolerance(result.piaMonthly, expected.beforeAPia!, example.tolerance)).toBe(false)
    })

    it('case B: the window starts at 1951 and each year counts its base (31 years, AIME 111, PIA 99.90)', () => {
      const result = pia([1925, 3, 3], [{ year: 1960, amount: 20_000 }, { year: 1970, amount: 20_000 }])
      expect(result.firstBaseYear).toBe(expected.caseBFirstYear)
      expect(result.computationYearCount).toBe(expected.caseBYears)
      expect(result.indexedYears.find((row) => row.year === 1960)!.cappedEarnings).toBe(4_800)
      expect(result.indexedYears.find((row) => row.year === 1970)!.cappedEarnings).toBe(7_800)
      expect(result.aime).toBe(expected.caseBAime)
      expect(withinTolerance(result.piaMonthly, expected.caseBPia!, example.tolerance), `PIA ${result.piaMonthly}`).toBe(true)
      expect(result.aime).not.toBe(expected.beforeBAime)
    })
  },
)
