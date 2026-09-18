import { expect, it } from 'vitest'
import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import { HISTORICAL_YEARS, meanPortfolioReturnPct, portfolioReturnPct } from './historicalReturns.js'

describeCalculation(
  'historical-market-series',
  {
    example: {
      inputs: { firstYear: 1928, lastYear: 2023, inclusiveSpan: 96 },
      expected: {
        rowCount: 96,
        stockSumPct: 1118.9,
        bondSumPct: 466.6,
        inflationSumPct: 298.8,
        row1928: { stocksPct: 43.8, bondsPct: 0.8, inflationPct: -1.2 },
        row1929: { stocksPct: -8.3, bondsPct: 4.2, inflationPct: 0.6 },
        row2023: { stocksPct: 26.1, bondsPct: 3.9, inflationPct: 3.4 },
      },
      // Exact at the embedded one-decimal transcription. Non-integer sums
      // cannot use the 'exact' literal, so a zero absolute bound is the
      // withinTolerance equivalent for those leaves.
      tolerance: { abs: 0 },
    },
    worksheet: 'DOCS/calculations/monte-carlo/historical-market-series.md',
    mutation: 'DOCS/calculations/monte-carlo/historical-market-series.mutation.md',
  },
  ({ example }) => {
    const expectedCount = example.expected.rowCount as number

    it('stores 96 rows from 1928 through 2023 inclusive', () => {
      expect(HISTORICAL_YEARS).toHaveLength(expectedCount)
      expect(HISTORICAL_YEARS[0]!.year).toBe(example.inputs.firstYear)
      expect(HISTORICAL_YEARS[HISTORICAL_YEARS.length - 1]!.year).toBe(example.inputs.lastYear)
      expect(example.inputs.lastYear as number - (example.inputs.firstYear as number) + 1).toBe(
        example.inputs.inclusiveSpan,
      )
    })

    it('column sums are stocks 1118.9, bonds 466.6, inflation 298.8 percentage points', () => {
      // The worksheet's sums are exact at one-decimal transcription; binary
      // accumulation of 96 one-decimal literals is rounded back to that grid.
      const stockSum = Number(HISTORICAL_YEARS.reduce((sum, row) => sum + row.stocksPct, 0).toFixed(1))
      const bondSum = Number(HISTORICAL_YEARS.reduce((sum, row) => sum + row.bondsPct, 0).toFixed(1))
      const inflationSum = Number(HISTORICAL_YEARS.reduce((sum, row) => sum + row.inflationPct, 0).toFixed(1))
      expect(
        withinTolerance(stockSum, example.expected.stockSumPct as number, example.tolerance),
        `stockSumPct ${stockSum} is not the worksheet's ${example.expected.stockSumPct}`,
      ).toBe(true)
      expect(
        withinTolerance(bondSum, example.expected.bondSumPct as number, example.tolerance),
        `bondSumPct ${bondSum} is not the worksheet's ${example.expected.bondSumPct}`,
      ).toBe(true)
      expect(
        withinTolerance(inflationSum, example.expected.inflationSumPct as number, example.tolerance),
        `inflationSumPct ${inflationSum} is not the worksheet's ${example.expected.inflationSumPct}`,
      ).toBe(true)
    })

    it('pins the 1928, 1929, and 2023 sample rows the worksheet names', () => {
      const row1928 = HISTORICAL_YEARS.find((row) => row.year === 1928)!
      const row1929 = HISTORICAL_YEARS.find((row) => row.year === 1929)!
      const row2023 = HISTORICAL_YEARS.find((row) => row.year === 2023)!
      const expected1928 = example.expected.row1928 as { stocksPct: number; bondsPct: number; inflationPct: number }
      const expected1929 = example.expected.row1929 as { stocksPct: number; bondsPct: number; inflationPct: number }
      const expected2023 = example.expected.row2023 as { stocksPct: number; bondsPct: number; inflationPct: number }
      for (const [row, expected, label] of [
        [row1928, expected1928, '1928'],
        [row1929, expected1929, '1929'],
        [row2023, expected2023, '2023'],
      ] as const) {
        expect(
          withinTolerance(row.stocksPct, expected.stocksPct, example.tolerance),
          `${label} stocksPct ${row.stocksPct} is not the worksheet's ${expected.stocksPct}`,
        ).toBe(true)
        expect(
          withinTolerance(row.bondsPct, expected.bondsPct, example.tolerance),
          `${label} bondsPct ${row.bondsPct} is not the worksheet's ${expected.bondsPct}`,
        ).toBe(true)
        expect(
          withinTolerance(row.inflationPct, expected.inflationPct, example.tolerance),
          `${label} inflationPct ${row.inflationPct} is not the worksheet's ${expected.inflationPct}`,
        ).toBe(true)
      }
    })
  },
)

describeCalculation(
  'historical-portfolio-mean',
  {
    example: {
      inputs: { rowCount: 96, stockSumPct: 1118.9, bondSumPct: 466.6, equityWeightPct: 60 },
      expected: { meanPct: 8.93729166666667 },
      tolerance: { abs: 1e-12 },
    },
    worksheet: 'DOCS/calculations/monte-carlo/historical-portfolio-mean.md',
    mutation: 'DOCS/calculations/monte-carlo/historical-portfolio-mean.mutation.md',
  },
  ({ example }) => {
    const equityWeightPct = example.inputs.equityWeightPct as number
    const expected = example.expected.meanPct as number

    it('the 60/40 arithmetic mean of the 96 blended years is 8.93729166666667%', () => {
      const meanPct = meanPortfolioReturnPct(equityWeightPct)
      expect(
        withinTolerance(meanPct, expected, example.tolerance),
        `meanPct ${meanPct} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expected}`,
      ).toBe(true)
    })

    it('equals the weighted column-mean identity 0.6·(1118.9/96) + 0.4·(466.6/96)', () => {
      // The worksheet's linearity-of-sums identity, from the fixture's
      // column sums rather than from summing production rows a second way.
      const w = equityWeightPct / 100
      const fromSums =
        (w * (example.inputs.stockSumPct as number) + (1 - w) * (example.inputs.bondSumPct as number)) /
        (example.inputs.rowCount as number)
      expect(
        withinTolerance(fromSums, expected, example.tolerance),
        `column-sum mean ${fromSums} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expected}`,
      ).toBe(true)
    })
  },
)

describeCalculation(
  'historical-portfolio-return-blend',
  {
    example: {
      inputs: { stocksPct: 43.8, bondsPct: 0.8, equityWeightPct: 60, year: 1928 },
      expected: { blendedPct: 26.6 },
      tolerance: { abs: 1e-12 },
    },
    worksheet: 'DOCS/calculations/monte-carlo/historical-portfolio-return-blend.md',
    mutation: 'DOCS/calculations/monte-carlo/historical-portfolio-return-blend.mutation.md',
  },
  ({ example }) => {
    const year = {
      year: example.inputs.year as number,
      stocksPct: example.inputs.stocksPct as number,
      bondsPct: example.inputs.bondsPct as number,
      inflationPct: 0,
    }
    const equityWeightPct = example.inputs.equityWeightPct as number
    const expected = example.expected.blendedPct as number

    it('blends 1928 43.8/0.8 at 60% equity to 26.6%', () => {
      const blendedPct = portfolioReturnPct(year, equityWeightPct)
      expect(
        withinTolerance(blendedPct, expected, example.tolerance),
        `blendedPct ${blendedPct} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expected}`,
      ).toBe(true)
    })

    it('the 1928 embedded row blends to the same 26.6%', () => {
      // The worksheet names the 1928 stored row; the identity must hold on
      // that row, not only on a reconstructed triple.
      const embedded = HISTORICAL_YEARS.find((row) => row.year === year.year)!
      const blendedPct = portfolioReturnPct(embedded, equityWeightPct)
      expect(
        withinTolerance(blendedPct, expected, example.tolerance),
        `embedded 1928 blend ${blendedPct} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expected}`,
      ).toBe(true)
    })
  },
)
