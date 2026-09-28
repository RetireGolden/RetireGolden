import { describe, expect, it } from 'vitest'

import { applyScenarioPatch } from '../../scenarios/scenarios.js'
import { summarizeProjection } from '../../projection/compare.js'
import { simulatePlan } from '../../projection/simulate.js'
import { SURVIVOR_LEVER_BRACKET_PCT, conversionLeverPatch } from '../../projection/survivorTransition.js'
import { couplePlan, productionTaxCalculator, traditionalAccount, validatePlan } from '../../testing/planFixtures.js'
import type { DetectorContext } from '../types.js'
import { widowsPenalty } from './widowsPenalty.js'

/**
 * The widows-penalty insight keeps its replacement patch (B2-P1 slice 5, open
 * call 9), while the survivor page's lever adds the same 12% fill to the plan's
 * own conversions (owner decision R16). The two coincide only because the
 * insight fires on plans that convert nothing; these tests pin that chain: the
 * card's patch is the replacement fill, and on a plan with no conversion
 * strategy the replacement and the addition give the same projection.
 */
describe('the widows-penalty preview and the survivor lever', () => {
  it('previews the replacement 12% fill through the last joint year', () => {
    const plan = couplePlan({ p1Dob: '1960-01-01', p2Dob: '1958-01-01' })
    plan.accounts = [traditionalAccount('trad', 600_000, 'p1')] as never
    const people = (alive: number, year: number) => [
      { personId: 'p1', alive: true, ageAttained: year - 1960 },
      { personId: 'p2', alive: alive === 2, ageAttained: year - 1958 },
    ]
    const years = [2026, 2027, 2028].map((year) => ({
      year,
      filingStatus: year < 2028 ? 'marriedFilingJointly' : 'single',
      magi: 120_000,
      irmaaTier: 0,
      people: people(year < 2028 ? 2 : 1, year),
      balances: { trad: 600_000 },
    }))
    const card = widowsPenalty.screen({
      plan,
      params: { year: 2026 },
      projection: { startYear: 2026, result: { years }, deflate: (_year: number, amount: number) => amount },
    } as unknown as DetectorContext)
    if (card?.action.kind !== 'preview-scenario') throw new Error('expected a preview scenario')
    expect(card.action.patch).toEqual(conversionLeverPatch(2026, 2027))
  })

  it('gives the same projection as the added fill when the plan converts nothing', () => {
    const plan = couplePlan({ p1Dob: '1960-01-01', p2Dob: '1958-01-01', p1PlanningAge: 95, p2PlanningAge: 95 })
    plan.accounts = [
      traditionalAccount('trad', 600_000, 'p1'),
      { type: 'roth', id: 'roth', name: 'Roth IRA', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 0, annualContribution: 0 },
      { type: 'cash', id: 'cash', name: 'Cash', ownerPersonId: null, annualReturnPct: null, balance: 400_000, annualContribution: 0 },
    ] as never
    plan.expenses.baseAnnual = 40_000
    const clean = validatePlan(plan)
    expect(clean.strategies.rothConversion.mode).toBe('none')
    const taxCalculator = productionTaxCalculator()
    const options = { startYear: 2026, taxCalculator, deathAgeByPersonId: { p2: 72 } }
    const patched = applyScenarioPatch(clean, conversionLeverPatch(2026, 2030))
    if (!patched.ok) throw new Error(patched.issues.join('; '))
    const replaced = simulatePlan(patched.plan, options)
    const added = simulatePlan(clean, { ...options, additionalBracketFill: { bracketPct: SURVIVOR_LEVER_BRACKET_PCT, startYear: 2026, endYear: 2030 } })
    expect(added.years.map((y) => [y.year, y.rothConversion, y.tax, y.investableTotal])).toEqual(
      replaced.years.map((y) => [y.year, y.rothConversion, y.tax, y.investableTotal]),
    )
    // Every figure agrees; only the replacement's over-capacity warning is gone,
    // because the lever caps its fill at the convertible balance (independent
    // check C1), so the year never requests more than there is.
    const { warnings: addedWarnings, ...addedSummary } = summarizeProjection(clean, added)
    const { warnings: replacedWarnings, ...replacedSummary } = summarizeProjection(patched.plan, replaced)
    expect(addedSummary).toEqual(replacedSummary)
    expect(replacedWarnings).toContain('A requested Roth conversion exceeded the available traditional balance and was reduced.')
    expect(addedWarnings).toEqual(replacedWarnings.filter((w) => w !== 'A requested Roth conversion exceeded the available traditional balance and was reduced.'))
    expect(added.years.filter((y) => y.year <= 2030).every((y) => y.rothConversion > 0)).toBe(true)
  })
})
