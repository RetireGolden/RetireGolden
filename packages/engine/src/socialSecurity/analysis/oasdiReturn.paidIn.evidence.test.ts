import { expect, it } from 'vitest'

import {
  describeCalculation,
  withinTolerance,
  worksheetExpectedRows,
  worksheetNumber,
} from '../../rules/describeCalculation.js'
import { oasdiPaidIn, todayDollarFactor } from './oasdiReturn.js'

const WORKSHEET = 'DOCS/calculations/social-security/oasdi-paid-in-today-dollars.md'
const MUTATION = 'DOCS/calculations/social-security/oasdi-paid-in-today-dollars.mutation.md'

// The Expected table: paidInNominal, paidInToday, employerNominal, employerToday, projectedToday, projectedEmployerToday per case.
const rows = worksheetExpectedRows(WORKSHEET)
const cell = (label: string, column: number): number => worksheetNumber(rows.get(label)![column]!)

const years = (from: number, to: number, amount: number) => Array.from({ length: to - from + 1 }, (_, i) => ({ year: from + i, amount }))
const historyA = years(1982, 2021, 50_000)
const historyB = years(1975, 1978, 20_000)
const historyX = [{ year: 1936, amount: 10_000 }, { year: 1950, amount: 10_000 }, { year: 2030, amount: 10_000 }]
const historyP = years(2003, 2025, 60_000)
const projectedP = years(2026, 2042, 60_000)
const at2026 = { startYear: 2026, inflationPct: 2.5 }

function expectCase(label: string, result: ReturnType<typeof oasdiPaidIn>): void {
  const nominal = { abs: 1e-6 }
  const today = { rel: 1e-12 }
  expect(withinTolerance(result.paidInNominal, cell(label, 0), nominal), `${label} paidInNominal ${result.paidInNominal}`).toBe(true)
  expect(withinTolerance(result.paidInToday, cell(label, 1), today), `${label} paidInToday ${result.paidInToday}`).toBe(true)
  expect(withinTolerance(result.employerNominal, cell(label, 2), nominal), `${label} employerNominal ${result.employerNominal}`).toBe(true)
  expect(withinTolerance(result.employerToday, cell(label, 3), today), `${label} employerToday ${result.employerToday}`).toBe(true)
  expect(withinTolerance(result.projectedToday, cell(label, 4), nominal), `${label} projectedToday ${result.projectedToday}`).toBe(true)
  expect(withinTolerance(result.projectedEmployerToday, cell(label, 5), nominal), `${label} projectedEmployerToday ${result.projectedEmployerToday}`).toBe(true)
}

describeCalculation(
  'oasdi-paid-in-today-dollars',
  {
    example: {
      inputs: { historyA, historyB, historyX, historyP, projectedP, at2026 },
      expected: { aToday: cell('A', 1), aNominal: cell('A', 0), bToday: cell('B', 1), pProjected: cell('P', 4) },
      tolerance: { rel: 1e-12 },
    },
    worksheet: WORKSHEET,
    mutation: MUTATION,
  },
  () => {
    it('case A: each year\'s effective rate and base, restated by CPI-U to 2025 and 2.5% to 2026 (225,418.24)', () => {
      expectCase('A', oasdiPaidIn(historyA, { selfEmployed: false, ...at2026 }))
      // The retired figure: today's 6.2% on every year, summed nominally.
      expect(withinTolerance(oasdiPaidIn(historyA, { selfEmployed: false, ...at2026 }).paidInNominal, 119_306.6, { abs: 1e-6 })).toBe(false)
    })

    it('case A self-employed: the self-employment rates, 8.05% in 1982 to 12.4% from 1990, and no employer share', () => {
      expectCase('A-SE', oasdiPaidIn(historyA, { selfEmployed: true, ...at2026 }))
    })

    it('case B: the bases before 1979 cap each year (3,165.90 nominal, 17,644.76 today)', () => {
      expectCase('B', oasdiPaidIn(historyB, { selfEmployed: false, ...at2026 }))
    })

    it('case X: before 1937 and self-employed before 1951 are named and not counted; 2030 is projected work at its face amount', () => {
      const result = oasdiPaidIn(historyX, { selfEmployed: true, ...at2026 })
      expectCase('X', result)
      expect(result.excludedYears).toEqual([1936, 1950])
      expect(result.projectedYears).toEqual([2030])
      expect(result.cpiLatestYear).toBe(2025)
    })

    it('case P: the projection\'s years 2026 to 2042 are the projected work, 17 x 3,720, beside the 116,507.46 paid in so far', () => {
      const result = oasdiPaidIn(historyP, { selfEmployed: false, ...at2026, projectedEarnings: projectedP })
      expectCase('P', result)
      expect(result.projectedYears).toEqual(projectedP.map((row) => row.year))
      expect(result.excludedYears).toEqual([])
    })

    it('1937, the first taxed year, is counted at 1%; an entered start-year row is paid in so far; negative rows are ignored', () => {
      const first = oasdiPaidIn([{ year: 1937, amount: 1_000 }], { selfEmployed: false, ...at2026 })
      expect(first.paidInNominal).toBe(10)
      expect(first.excludedYears).toEqual([])
      const startYearRow = oasdiPaidIn([{ year: 2026, amount: 50_000 }, { year: 2026, amount: -10_000 }], { selfEmployed: false, ...at2026 })
      expect(startYearRow.paidInNominal).toBe(3_100)
      expect(startYearRow.paidInToday).toBe(3_100)
      expect(startYearRow.projectedYears).toEqual([])
    })

    it('a projected year after the published bases is capped at the latest base, 184,500 in 2026, at the current 6.2%', () => {
      const result = oasdiPaidIn([], { selfEmployed: false, ...at2026, projectedEarnings: [{ year: 2035, amount: 300_000 }] })
      expect(result.projectedToday).toBe((184_500 * 6.2) / 100)
      expect(result.projectedEmployerToday).toBe((184_500 * 6.2) / 100)
    })

    it('restates by the published averages: 1982 is 321.943 / 96.5 x 1.025, and a year after 2025 uses the plan\'s inflation', () => {
      expect(todayDollarFactor(1982, 2026, 2.5)).toBe((321.943 / 96.5) * 1.025)
      expect(todayDollarFactor(2026, 2026, 2.5)).toBe(1)
      expect(todayDollarFactor(2025, 2025, 2.5)).toBe(1)
    })
  },
)
