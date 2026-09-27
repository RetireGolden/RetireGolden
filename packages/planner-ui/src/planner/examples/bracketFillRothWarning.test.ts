import { describe, expect, it } from 'vitest'

import type { Plan } from '@retiregolden/engine/model/plan'
import { simulatePlan } from '@retiregolden/engine/projection/simulate'

import { taxCalculatorFor } from '../../planTaxCalculator'
import { buildBracketFillRoth } from './buildBracketFillRoth'
import { EXAMPLE_FIXED_YEAR } from './buildContext'

const OVERSHOOT_WARNING =
  'Spending withdrawals from traditional accounts pushed income above the Roth-conversion target in some years.'

/** Projects 2026 to 2029 and returns the three later rows with the run's warnings. */
function laterYears(plan: Plan) {
  const result = simulatePlan(plan, {
    startYear: EXAMPLE_FIXED_YEAR,
    horizonEndYear: 2029,
    taxCalculator: taxCalculatorFor(plan),
  })
  const rows = [2027, 2028, 2029].map((year) => {
    const row = result.years.find((entry) => entry.year === year)
    expect(row, String(year)).toBeDefined()
    // The two facts the old condition read are both present in each year...
    expect(row!.rothConversion, String(year)).toBeGreaterThan(0)
    expect(row!.withdrawals.traditional - row!.rmd, String(year)).toBeGreaterThan(0.01)
    const detail = row!.advisoryFederalTax?.detail
    expect(detail, String(year)).toBeDefined()
    // ... and the target is the top of the 22% bracket, indexed for the year
    // exactly as the conversion sizing indexes it.
    const target = 211_400 * (row!.inflationScale ?? 1)
    return { year, taxableIncome: detail!.taxableIncome, target }
  })
  return { rows, warnings: result.warnings }
}

/**
 * D-ROTH-TARGET-WARNING on the bracket-fill example: the overshoot warning
 * fires only when a year's taxable income ends above the conversion target.
 * From 2027 each year converts and also draws on the IRAs for spending, the
 * two facts the old condition read, so the example shows both directions.
 */
describe('bracket-fill example: Roth-conversion target warning', () => {
  it('warns as built: both shares convert, so each year from 2027 to 2029 ends above the target', () => {
    // Since D-BRACKET-FILL-ROTH-EXAMPLE Riley holds her own Roth IRA, so the
    // conversion fills the bracket, and the need-based IRA draw that follows
    // it (the conversion is sized before the draw) lands above the top.
    const { rows, warnings } = laterYears(buildBracketFillRoth())
    for (const { year, taxableIncome, target } of rows) {
      expect(taxableIncome, String(year)).toBeGreaterThan(target)
    }
    expect(warnings).toContain(OVERSHOOT_WARNING)
  })

  it('stays silent for the household before Riley had a Roth IRA, whose years end well under the target', () => {
    // The household the example had until D-BRACKET-FILL-ROTH-EXAMPLE: Riley's
    // share had nowhere to convert, so taxable income ended each year well
    // under the target (the bracket-fill walkthrough derived the margins for
    // that household: 64,977.21, 43,471.24 and 61,127.60 in 2027, 2028 and
    // 2029), and the old condition's warning was false.
    const plan = buildBracketFillRoth()
    plan.accounts = plan.accounts.filter((account) => !(account.type === 'roth' && account.name === 'Riley Roth IRA'))
    expect(plan.accounts.filter((account) => account.type === 'roth')).toHaveLength(1)
    const { rows, warnings } = laterYears(plan)
    for (const { year, taxableIncome, target } of rows) {
      expect(taxableIncome, String(year)).toBeLessThan(target - 40_000)
    }
    expect(warnings).not.toContain(OVERSHOOT_WARNING)
  })
})
