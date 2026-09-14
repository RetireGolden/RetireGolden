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
        candidates: [
          { cusip: 'T2030', maturityIso: '2030-01-15' },
          { cusip: 'T2035', maturityIso: '2035-01-15' },
        ],
      },
      expected: { selectedCusip: 'T2035', distanceYears: 2 },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/ladders-and-valuation/fedinvest-nearest-tips-maturity.md',
    mutation: 'DOCS/calculations/ladders-and-valuation/fedinvest-nearest-tips-maturity.mutation.md',
  },
  ({ example }) => {
    // Rate and price are not read by nearestTipsForYear; placeholders keep
    // the fixture to the worksheet's maturity column.
    const tipsOf = (rows: Array<{ cusip: string; maturityIso: string }>): FedInvestTips[] =>
      rows.map((row) => ({ ...row, ratePct: 0.125, endOfDayPrice: 100 }))
    const candidates = tipsOf(example.inputs.candidates as Array<{ cusip: string; maturityIso: string }>)
    const targetYear = example.inputs.targetYear as number

    it('selects the 2035 TIPS for 2033: distance 2 beats distance 3', () => {
      // FINDING (2026-09-14): production returns null here. nearestTipsForYear
      // also requires the nearest maturity to lie within one calendar year
      // of the target (`bestDistance <= 1`), a window the worksheet did not
      // derive from the signature comment. This assertion carries the
      // worksheet's value and fails until that discrepancy is settled.
      const selected = nearestTipsForYear(candidates, targetYear)
      expect(selected === null ? null : selected.cusip).toBe(example.expected.selectedCusip)
    })

    it('returns null from an empty list', () => {
      expect(nearestTipsForYear([], targetYear)).toBeNull()
    })

    it('prefers a later maturity when it is nearer than the earlier one', () => {
      // |2034 - 2033| = 1 beats |2031 - 2033| = 2 under the worksheet's
      // absolute-distance rule; this case also sits inside production's
      // one-year window, so it passes on the unmutated code.
      const later = tipsOf([
        { cusip: 'T2031', maturityIso: '2031-01-15' },
        { cusip: 'T2034', maturityIso: '2034-01-15' },
      ])
      const selected = nearestTipsForYear(later, targetYear)
      expect(selected === null ? null : selected.cusip).toBe('T2034')
    })
  },
)
