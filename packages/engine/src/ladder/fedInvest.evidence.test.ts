import { expect, it } from 'vitest'
import { describeCalculation } from '../rules/describeCalculation.js'
import {
  latestPriceDate,
  latestPriceDateIso,
  nearestTipsForYear,
  parseFedInvestCsv,
  type FedInvestTips,
} from './fedInvest.js'

describeCalculation(
  'fedinvest-csv-tips-parsing',
  {
    example: {
      // Synthetic row: cusip, type, rate (decimal fraction), maturity
      // MM/DD/YYYY, call, buy, sell, end-of-day price per $100 face.
      inputs: { csvRow: '912TEST01,TIPS,0.00125,01/15/2030,,99.500000,99.500000,99.50' },
      expected: { cusip: '912TEST01', ratePct: 0.125, maturityIso: '2030-01-15', endOfDayPrice: 99.5 },
      tolerance: { abs: 1e-12 },
    },
    worksheet: 'DOCS/calculations/ladders-and-valuation/fedinvest-csv-tips-parsing.md',
    mutation: 'DOCS/calculations/ladders-and-valuation/fedinvest-csv-tips-parsing.mutation.md',
  },
  ({ example }) => {
    const abs = example.tolerance === 'exact' ? 0 : (example.tolerance.abs ?? 0)
    const csvRow = example.inputs.csvRow as string

    it('parses one synthetic TIPS row: rate to percent, date to ISO, price per $100 face as-is', () => {
      const tips = parseFedInvestCsv(csvRow)
      expect(tips).toHaveLength(1)
      const [row] = tips
      expect(row!.cusip).toBe(example.expected.cusip)
      expect(row!.maturityIso).toBe(example.expected.maturityIso)
      expect(Math.abs(row!.ratePct - (example.expected.ratePct as number))).toBeLessThanOrEqual(abs)
      expect(Math.abs(row!.endOfDayPrice - (example.expected.endOfDayPrice as number))).toBeLessThanOrEqual(abs)
    })

    it('retains only TIPS: the same row typed as a note is dropped', () => {
      // Boundary of the "retains TIPS" claim.
      expect(parseFedInvestCsv(csvRow.replace(',TIPS,', ',MARKET BASED NOTE,'))).toEqual([])
    })
  },
)

describeCalculation(
  'fedinvest-latest-price-date',
  {
    example: {
      // Sunday 2026-07-12 at noon, local civil time (no zone suffix).
      inputs: { nowLocal: '2026-07-12T12:00:00' },
      expected: { year: 2026, month: 7, day: 10, weekday: 5, priceDateIso: '2026-07-10' },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/ladders-and-valuation/fedinvest-latest-price-date.md',
    mutation: 'DOCS/calculations/ladders-and-valuation/fedinvest-latest-price-date.mutation.md',
  },
  ({ example }) => {
    const now = new Date(example.inputs.nowLocal as string)

    it('walks Sunday 2026-07-12 back past Saturday to Friday 2026-07-10', () => {
      const date = latestPriceDate(now)
      expect(date.getFullYear()).toBe(example.expected.year)
      expect(date.getMonth() + 1).toBe(example.expected.month)
      expect(date.getDate()).toBe(example.expected.day)
      expect(date.getDay()).toBe(example.expected.weekday)
    })

    it('formats that date from local components as 2026-07-10', () => {
      expect(latestPriceDateIso(now)).toBe(example.expected.priceDateIso)
    })

    it('reaches the same Friday from Saturday 2026-07-11, the intermediate step of the walk', () => {
      // The worksheet's arithmetic passes through Saturday; starting there
      // must land on the same business day.
      expect(latestPriceDateIso(new Date('2026-07-11T12:00:00'))).toBe(example.expected.priceDateIso)
    })
  },
)

describeCalculation(
  'fedinvest-nearest-tips-maturity',
  {
    example: {
      inputs: {
        targetYear: 2033,
        // Worksheet cases A, B and C: maturity years only; rate and price are
        // not read by nearestTipsForYear.
        caseA: [2032, 2036],
        caseB: [2030, 2035],
        caseC: [2033, 2034],
      },
      expected: { caseA: 'T2032', caseB: null, caseC: 'T2033' },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/ladders-and-valuation/fedinvest-nearest-tips-maturity.md',
    mutation: 'DOCS/calculations/ladders-and-valuation/fedinvest-nearest-tips-maturity.mutation.md',
  },
  ({ example }) => {
    const tipsOf = (years: number[]): FedInvestTips[] =>
      years.map((year) => ({ cusip: `T${year}`, maturityIso: `${year}-01-15`, ratePct: 0.125, endOfDayPrice: 100 }))
    const targetYear = example.inputs.targetYear as number
    const pick = (years: number[]): string | null => {
      const selected = nearestTipsForYear(tipsOf(years), targetYear)
      return selected === null ? null : selected.cusip
    }

    it('case A: selects the one candidate within a year of the target (2032 for 2033)', () => {
      expect(pick(example.inputs.caseA as number[])).toBe(example.expected.caseA)
    })

    it('case B: returns null when the nearest candidate is two years away (2030/2035 for 2033)', () => {
      // First derivation expected the 2035 row here; the one-year window was
      // not stated in the doc comment until 2026-09-14.
      expect(pick(example.inputs.caseB as number[])).toBe(example.expected.caseB)
    })

    it('case C: the nearer of two in-window candidates wins (2033 over 2034)', () => {
      expect(pick(example.inputs.caseC as number[])).toBe(example.expected.caseC)
    })

    it('returns null from an empty list', () => {
      expect(nearestTipsForYear([], targetYear)).toBeNull()
    })
  },
)
