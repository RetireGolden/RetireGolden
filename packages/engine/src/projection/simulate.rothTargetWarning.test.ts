/**
 * D-ROTH-TARGET-WARNING: the warning that spending withdrawals pushed income
 * above the Roth-conversion target is raised only in a year whose final
 * value of the sized metric (here federal taxable income, for a bracket-top
 * target) ends above the target's ceiling. Before the decision it was raised
 * whenever a fill-to-target conversion and a need-based traditional draw
 * shared a year, whatever the income.
 *
 * Both plans are a 2026 married couple, 70 and 68 (no RMD yet), with 20,000
 * of cash, a 300,000 IRA each, 40,000 of spending and a fill to the top of
 * the 12% bracket (100,800 of joint taxable income in 2026). Cash runs out,
 * so each year draws on the IRAs for spending.
 */
import { describe, expect, it } from 'vitest'

import type { Account, Plan } from '../model/plan.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import {
  cashAccount,
  couplePlan,
  productionTaxCalculator,
  taxableAccount,
  traditionalAccount,
  validatePlan,
} from '../testing/planFixtures.js'
import { simulatePlan } from './simulate.js'
import type { YearResult } from './types.js'

const OVERSHOOT_WARNING =
  'Spending withdrawals from traditional accounts pushed income above the Roth-conversion target in some years.'
/** Top of the 2026 joint 12% bracket: the 22% bracket starts above 100,800. */
const TWELVE_PERCENT_TOP_2026_JOINT = 100_800

function rothIra(id: string, ownerPersonId: string): Account {
  return {
    type: 'roth',
    kind: 'ira',
    id,
    name: id,
    ownerPersonId,
    annualReturnPct: 0,
    balance: 0,
    annualContribution: 0,
  }
}

function bracketFillCouple(rothOwners: readonly string[]): Plan {
  const plan = couplePlan({ p1Dob: '1956-03-01', p2Dob: '1958-03-01', p1PlanningAge: 95, p2PlanningAge: 95 })
  const ira1 = traditionalAccount('ira-p1', 300_000, 'p1')
  const ira2 = traditionalAccount('ira-p2', 300_000, 'p2')
  plan.accounts = [
    cashAccount('cash', 20_000),
    { ...ira1, annualReturnPct: 0 } as Account,
    { ...ira2, annualReturnPct: 0 } as Account,
    ...rothOwners.map((owner) => rothIra(`roth-${owner}`, owner)),
  ]
  plan.expenses.baseAnnual = 40_000
  plan.strategies.rothConversion = {
    mode: 'fillToTarget',
    target: 'topOfBracket',
    targetValue: 12,
    startYear: 2026,
    endYear: 2026,
  }
  return validatePlan(plan)
}

function run(plan: Plan): { year: YearResult; warnings: readonly string[] } {
  const result = simulatePlan(plan, {
    startYear: 2026,
    horizonEndYear: 2026,
    taxCalculator: productionTaxCalculator(),
  })
  const year = result.years.find((row) => row.year === 2026)
  if (year === undefined) throw new Error('missing 2026')
  return { year, warnings: result.warnings }
}

describe('Roth-conversion target overshoot warning', () => {
  it('stays silent when the year ends below the target despite a spending draw from the IRAs', () => {
    // Only Pat holds a Roth IRA, so Robin's half of the household conversion
    // has nowhere to go and is dropped (the bracket-fill example's shape):
    // the year converts about half the sized amount and ends well under the
    // ceiling even with the spending draw on top.
    const { year, warnings } = run(bracketFillCouple(['p1']))
    expect(year.rothConversion).toBeGreaterThan(0)
    expect(year.withdrawals.traditional - year.rmd).toBeGreaterThan(0.01)
    const taxableIncome = year.advisoryFederalTax?.detail.taxableIncome
    expect(taxableIncome).toBeDefined()
    expect(taxableIncome!).toBeLessThan(TWELVE_PERCENT_TOP_2026_JOINT)
    expect(warnings).not.toContain(OVERSHOOT_WARNING)
  })

  it('warns when the spending draw carries taxable income past the target', () => {
    // Both hold a Roth IRA, so the whole sized conversion lands and fills the
    // bracket to its top before the year's spending; the IRA draw that pays
    // for it then carries taxable income past 100,800.
    const { year, warnings } = run(bracketFillCouple(['p1', 'p2']))
    expect(year.rothConversion).toBeGreaterThan(0)
    expect(year.withdrawals.traditional - year.rmd).toBeGreaterThan(0.01)
    const taxableIncome = year.advisoryFederalTax?.detail.taxableIncome
    expect(taxableIncome).toBeDefined()
    expect(taxableIncome!).toBeGreaterThan(TWELVE_PERCENT_TOP_2026_JOINT + 0.01)
    expect(warnings).toContain(OVERSHOOT_WARNING)
  })

  it('reads the metric the target sized: MAGI for a fixed-MAGI target, not taxable income', () => {
    // Fixed-MAGI target of 100,000 and no tax, so the draw is the spending gap
    // alone: 40,000 of spending plus 4,869.60 of Part B premiums, less 20,000
    // of cash, is a 24,869.60 IRA draw. The conversion is sized to MAGI
    // 100,000 before spending, so the year ends at MAGI 124,869.60, above the
    // target. Taxable income is MAGI less the 32,200 joint deduction, 3,300 of
    // age-65 additions and the 12,000 senior deduction: 77,369.60, under
    // 100,000. A warning that read taxable income would stay silent here.
    const plan = bracketFillCouple(['p1', 'p2'])
    plan.strategies.rothConversion = { mode: 'fillToTarget', target: 'fixedMagi', targetValue: 100_000, startYear: 2026, endYear: 2026 }
    const result = simulatePlan(validatePlan(plan), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: createFlatTaxCalculator(0),
    })
    const year = result.years[0]!
    expect(year.rothConversion).toBeGreaterThan(0)
    expect(year.withdrawals.traditional - year.rmd).toBeCloseTo(24_869.6, 2)
    const detail = year.advisoryFederalTax?.detail
    expect(detail?.agiBeforeFloor).toBeCloseTo(124_869.6, 1)
    expect(detail?.taxableIncome).toBeCloseTo(77_369.6, 1)
    expect(result.warnings).toContain(OVERSHOOT_WARNING)
  })

  it('stays silent on an overshoot that no spending draw from the IRAs caused', () => {
    // The spending comes from a brokerage account whose sales realize gains, so
    // taxable income ends above the 12% bracket top with no traditional
    // spending draw at all. The warning is about spending draws from
    // traditional accounts, so it stays silent.
    const plan = bracketFillCouple(['p1', 'p2'])
    plan.accounts = [
      taxableAccount('brokerage', 200_000, 20_000),
      ...plan.accounts.filter((account) => account.type !== 'cash'),
    ]
    const { year, warnings } = run(validatePlan(plan))
    expect(year.rothConversion).toBeGreaterThan(0)
    expect(year.withdrawals.traditional - year.rmd).toBeLessThanOrEqual(0.01)
    expect(year.withdrawals.taxable).toBeGreaterThan(0)
    expect(year.advisoryFederalTax!.detail.taxableIncome).toBeGreaterThan(TWELVE_PERCENT_TOP_2026_JOINT + 0.01)
    expect(warnings).not.toContain(OVERSHOOT_WARNING)
  })
})
