/**
 * Survivor degenerate-timing predicate (#513). Table-driven: a timing is
 * degenerate only when nothing sits on either side of the transition and any
 * survivor shortfall was already there before the death. Each case flips one
 * fact from the all-zero baseline, so a criterion cannot be dropped or
 * widened without a row here changing verdict.
 */
import { describe, expect, it } from 'vitest'

import { isDegenerateTiming, type SurvivorScenarioRow, type SurvivorYearFacts } from './survivorAnalysis'

function facts(year: number, over: Partial<SurvivorYearFacts> = {}): SurvivorYearFacts {
  return { year, magi: 0, tax: 0, shortfall: 0, filingStatus: 'marriedFilingJointly', ...over }
}

/** The #513 row: $0 → $0, no tax, no balance, no estate, short on both sides of the death. */
function baseline(over: Partial<SurvivorScenarioRow> = {}): SurvivorScenarioRow {
  return {
    deceasedPersonId: 'p1',
    deathAge: 75,
    deathYear: 2037,
    filingTimeline: [],
    lastJointYear: facts(2037, { shortfall: 40_000 }),
    firstSurvivorYear: facts(2038, { shortfall: 40_000, filingStatus: 'single' }),
    ssBeforeDeath: 0,
    ssAfterDeath: 0,
    irmaaYears: [],
    ssa44PremiumSavings: 0,
    survivorShortfallYears: 25,
    minSurvivorInvestable: 0,
    baseEndingAfterTaxEstate: 0,
    baseLifetimeTax: 0,
    conversionLever: null,
    ...over,
  }
}

describe('isDegenerateTiming (#513)', () => {
  it('reads the #513 row as degenerate: all zero, shortfall on both sides of the death', () => {
    expect(isDegenerateTiming(baseline())).toBe(true)
  })

  it.each<[string, Partial<SurvivorScenarioRow>]>([
    ['Social Security before the death', { ssBeforeDeath: 24_000 }],
    ['Social Security after the death', { ssAfterDeath: 18_000 }],
    ['tax in the last joint year', { lastJointYear: facts(2037, { shortfall: 40_000, tax: 3_000 }) }],
    ['tax in the first survivor year', { firstSurvivorYear: facts(2038, { shortfall: 40_000, tax: 3_000 }) }],
    ['MAGI only, no tax, in the last joint year', { lastJointYear: facts(2037, { shortfall: 40_000, magi: 20_000 }) }],
    ['MAGI only, no tax, in the first survivor year', { firstSurvivorYear: facts(2038, { shortfall: 40_000, magi: 20_000 }) }],
    ['a surviving balance', { minSurvivorInvestable: 12_000 }],
    ['an after-tax estate', { baseEndingAfterTaxEstate: 50_000 }],
    ['lifetime tax later in the projection', { baseLifetimeTax: 9_000 }],
    ['an SSA-44 premium saving', { ssa44PremiumSavings: 1_200 }],
    // The death introduced the shortfall: the joint side was funded.
    ['survivor shortfall the last joint year did not have', { lastJointYear: facts(2037, { shortfall: 0 }) }],
    ['a real negative balance', { minSurvivorInvestable: -5_000 }],
  ])('keeps a row that has %s', (_what, over) => {
    expect(isDegenerateTiming(baseline(over))).toBe(false)
  })

  it('is symmetric on shortfall: no survivor shortfall at all is degenerate even with a funded joint side', () => {
    expect(isDegenerateTiming(baseline({ survivorShortfallYears: 0, lastJointYear: facts(2037, { shortfall: 0 }) }))).toBe(true)
  })

  it('treats a rounding remainder of either sign as nothing, and half a dollar as something', () => {
    expect(isDegenerateTiming(baseline({ ssAfterDeath: 0.49 }))).toBe(true)
    expect(isDegenerateTiming(baseline({ minSurvivorInvestable: -0.3 }))).toBe(true)
    expect(isDegenerateTiming(baseline({ ssAfterDeath: 0.5 }))).toBe(false)
    // The joint-side shortfall test has the same boundary.
    expect(isDegenerateTiming(baseline({ lastJointYear: facts(2037, { shortfall: 0.5 }) }))).toBe(false)
    expect(isDegenerateTiming(baseline({ lastJointYear: facts(2037, { shortfall: 0.51 }) }))).toBe(true)
  })
})
