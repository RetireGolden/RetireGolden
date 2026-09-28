import { expect, it } from 'vitest'

import { describeCalculation, worksheetExpectedRows, worksheetNumber } from '../../rules/describeCalculation.js'
import { QUARTER_OF_COVERAGE_AMOUNT_BY_YEAR } from '../ssaWageData.js'
import { creditsForYear, estimateCredits } from './credits.js'

const WORKSHEET = 'DOCS/calculations/social-security/covered-work-credit-estimate.md'
const MUTATION = 'DOCS/calculations/social-security/covered-work-credit-estimate.mutation.md'

// Rows A to E: credits, eligible, the retired figure; rows "QC <year>": SSA's amount.
const rows = worksheetExpectedRows(WORKSHEET)
const credits = (label: string): number => worksheetNumber(rows.get(label)![0]!)
const eligible = (label: string): boolean => rows.get(label)![1] === 'yes'

const caseA = [{ year: 1980, amount: 1_200 }, { year: 1990, amount: 1_500 }, { year: 2025, amount: 5_000 }, { year: 2026, amount: 7_000 }]
const caseB = [{ year: 1975, amount: 900 }, ...caseA]
const caseC = Array.from({ length: 10 }, (_, i) => ({ year: 2016 + i, amount: 7_240 }))
const caseE = [{ year: 1936, amount: 5_000 }, { year: 2025, amount: 1_000 }, { year: 2025, amount: 1_000 }]

describeCalculation(
  'covered-work-credit-estimate',
  {
    example: {
      inputs: { caseA, caseB, caseC, caseD: { override: 12 }, caseE },
      expected: { A: credits('A'), B: credits('B'), C: credits('C'), D: credits('D'), E: credits('E') },
      tolerance: 'exact',
    },
    worksheet: WORKSHEET,
    mutation: MUTATION,
  },
  () => {
    it('case A: each year at its own quarter-of-coverage amount (11, where one 2025 amount gave 5)', () => {
      const estimate = estimateCredits(caseA, null)
      expect(estimate).toEqual({ credits: credits('A'), eligible: eligible('A'), estimated: true })
      expect(estimate.credits).not.toBe(worksheetNumber(rows.get('A')![2]!))
    })

    it('case B: a year before 1978 counts at most one credit per $50, up to four (15)', () => {
      expect(estimateCredits(caseB, null)).toEqual({ credits: credits('B'), eligible: eligible('B'), estimated: true })
      expect(creditsForYear(1975, 900)).toBe(4)
      expect(creditsForYear(1975, 120)).toBe(2)
    })

    it('case C: ten years at four credits reach 40, eligible', () => {
      expect(estimateCredits(caseC, null)).toEqual({ credits: credits('C'), eligible: eligible('C'), estimated: true })
    })

    it('case D: an entered count wins and is not an estimate', () => {
      expect(estimateCredits(caseA, 12)).toEqual({ credits: credits('D'), eligible: eligible('D'), estimated: false })
    })

    it('case E: nothing before 1937, and the rows for one year are added before the cap', () => {
      expect(estimateCredits(caseE, null)).toEqual({ credits: credits('E'), eligible: eligible('E'), estimated: true })
      expect(estimateCredits([{ year: 2025, amount: 7_240 }, { year: 2025, amount: 7_240 }], null).credits).toBe(4)
    })

    it("carries SSA's quarter-of-coverage amount for every year 1978 to 2026, 2026's $1,890 included", () => {
      const sheet = [...rows].filter(([key]) => key.startsWith('QC ')).map(([key, cells]) => [Number(key.slice(3)), worksheetNumber(cells[0]!)] as const)
      expect(Object.keys(QUARTER_OF_COVERAGE_AMOUNT_BY_YEAR).map(Number).sort((a, b) => a - b)).toEqual(sheet.map(([year]) => year))
      expect(sheet.filter(([year, amount]) => QUARTER_OF_COVERAGE_AMOUNT_BY_YEAR[year] !== amount)).toEqual([])
      expect(QUARTER_OF_COVERAGE_AMOUNT_BY_YEAR[2026]).toBe(1_890)
      // A later year uses the latest published amount.
      expect(creditsForYear(2030, 7_560)).toBe(4)
      expect(creditsForYear(2030, 7_559)).toBe(3)
    })
  },
)
