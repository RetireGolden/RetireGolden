import { describe, expect, it } from 'vitest'

import { simulatePlan } from '@retiregolden/engine/projection/simulate'

import { taxCalculatorFor } from '../../planTaxCalculator'
import { buildBracketFillRoth } from './buildBracketFillRoth'
import { EXAMPLE_FIXED_YEAR } from './buildContext'

const OVERSHOOT_WARNING =
  'Spending withdrawals from traditional accounts pushed income above the Roth-conversion target in some years.'

/**
 * D-ROTH-TARGET-WARNING on the bracket-fill example. From 2027 each year
 * converts Morgan's share and draws on the IRAs for spending, so the old
 * condition (a fill-to-target conversion plus a need-based traditional draw)
 * raised the overshoot warning. Riley's share has nowhere to convert, so
 * taxable income ends each of those years well under the top of the 22%
 * bracket the strategy targets (the bracket-fill walkthrough derives the
 * margins: 64,977.21, 43,471.24 and 61,127.60 in 2027, 2028 and 2029), and
 * the warning is now absent.
 */
describe('bracket-fill example: Roth-conversion target warning', () => {
  it('raises no overshoot warning through 2029, when every year ends below the target', () => {
    const plan = buildBracketFillRoth()
    const result = simulatePlan(plan, {
      startYear: EXAMPLE_FIXED_YEAR,
      horizonEndYear: 2029,
      taxCalculator: taxCalculatorFor(plan),
    })
    for (const year of [2027, 2028, 2029]) {
      const row = result.years.find((entry) => entry.year === year)
      expect(row, String(year)).toBeDefined()
      // The two facts the old condition read are both present...
      expect(row!.rothConversion, String(year)).toBeGreaterThan(0)
      expect(row!.withdrawals.traditional - row!.rmd, String(year)).toBeGreaterThan(0.01)
      // ... and the year still ends under the top of the 22% bracket, indexed
      // for the year exactly as the conversion sizing indexes it.
      const detail = row!.advisoryFederalTax?.detail
      expect(detail, String(year)).toBeDefined()
      const scale = row!.inflationScale ?? 1
      const twentyFourStartsAbove = 211_400 * scale
      expect(detail!.taxableIncome, String(year)).toBeLessThan(twentyFourStartsAbove - 40_000)
    }
    expect(result.warnings).not.toContain(OVERSHOOT_WARNING)
  })
})
