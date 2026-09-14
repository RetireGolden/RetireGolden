import { expect, it } from 'vitest'
import type { RealYieldCurve } from '../params/types.js'
import type { YearResult } from '../projection/types.js'
import { describeCalculation } from '../rules/describeCalculation.js'
import { computeFundedRatio } from './fundedRatio.js'

interface WorksheetYear {
  readonly offset: number
  readonly nominalEssential: number
  readonly nominalGuaranteed: number
}

/**
 * The worksheet's absolute tolerance for the exact one-half ratio, tighter
 * than the fixture's dollar tolerance; the fixture object carries only one
 * tolerance, so the ratio's is named here beside its assertion.
 */
const RATIO_ABS_TOLERANCE_PCT = 1e-12

describeCalculation(
  'funded-ratio-hand-present-value',
  {
    example: {
      inputs: {
        startYear: 2026,
        discountRatePct: 5,
        inflationPct: 5,
        years: [
          { offset: 0, nominalEssential: 100, nominalGuaranteed: 50 },
          { offset: 1, nominalEssential: 115.5, nominalGuaranteed: 57.75 },
          { offset: 2, nominalEssential: 133.4025, nominalGuaranteed: 66.70125 },
        ],
      },
      expected: {
        essentialSpendingPv: 314.5124716553,
        guaranteedIncomePv: 157.2562358277,
        fundedRatioPct: 50,
        unfundedPv: 157.2562358277,
      },
      tolerance: { abs: 1e-9 },
    },
    worksheet: 'DOCS/calculations/ladders-and-valuation/funded-ratio-hand-present-value.md',
    mutation: 'DOCS/calculations/ladders-and-valuation/funded-ratio-hand-present-value.mutation.md',
  },
  ({ example }) => {
    const abs = example.tolerance === 'exact' ? 0 : (example.tolerance.abs ?? 0)
    const startYear = example.inputs.startYear as number
    const inflationPct = example.inputs.inflationPct as number
    const discountRatePct = example.inputs.discountRatePct as number
    const rows = example.inputs.years as WorksheetYear[]

    // computeFundedRatio reads only `year`, `expenses.requiredSpending` and
    // `incomes.socialSecurity + pension + annuity + tipsLadder` from each
    // row; nothing else on YearResult is consulted, so the worksheet's rows
    // are built as plain objects and cast once. The nominal guaranteed
    // amount is carried entirely as Social Security; the other three
    // guaranteed fields are zero.
    const years = rows.map((row) => ({
      year: startYear + row.offset,
      expenses: { requiredSpending: row.nominalEssential },
      incomes: { socialSecurity: row.nominalGuaranteed, pension: 0, annuity: 0, tipsLadder: 0 },
    })) as unknown as YearResult[]

    // Deflator to today's dollars: 1/1.05^t, the worksheet's third column.
    const deflate = (year: number, amount: number): number =>
      amount / Math.pow(1 + inflationPct / 100, year - startYear)

    // The 5% curve is flat, endpoints included.
    const curve: RealYieldCurve = {
      asOfIso: '2026-09-14',
      source: 'evidence fixture',
      points: [
        { maturityYears: 1, realYieldPct: discountRatePct },
        { maturityYears: 30, realYieldPct: discountRatePct },
      ],
    }

    const result = computeFundedRatio({ years, startYear, deflate, curve })

    it('discounts the deflated essential flows to E = 138,700/441 with the year-0 flow undiscounted', () => {
      expect(result).not.toBeNull()
      expect(Math.abs(result!.essentialSpendingPv - (example.expected.essentialSpendingPv as number))).toBeLessThanOrEqual(abs)
    })

    it('discounts the deflated guaranteed flows to G = 69,350/441', () => {
      expect(Math.abs(result!.guaranteedIncomePv - (example.expected.guaranteedIncomePv as number))).toBeLessThanOrEqual(abs)
    })

    it('reports the funded ratio 100·G/E = 50% and the unfunded PV E - G', () => {
      expect(Math.abs(result!.fundedRatioPct - (example.expected.fundedRatioPct as number))).toBeLessThanOrEqual(
        RATIO_ABS_TOLERANCE_PCT,
      )
      expect(Math.abs(result!.unfundedPv - (example.expected.unfundedPv as number))).toBeLessThanOrEqual(abs)
    })

    it('returns null when no year falls in the window, because the essential PV is not positive', () => {
      // Domain boundary from the worksheet: positive essential PV.
      expect(computeFundedRatio({ years, startYear, deflate, curve, fromYear: startYear + 3 })).toBeNull()
    })
  },
)
