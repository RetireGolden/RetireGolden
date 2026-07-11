import { describe, expect, it } from 'vitest'

import { couplePlan, singlePersonPlan, socialSecurityIncome, validatePlan } from '@retiregolden/engine/testing/planFixtures'
import { benefitsOnlyRanking } from './ssAnalysis'

/**
 * ORACLE-007 (external-oracle-comparisons.md) - Social Security claiming vs
 * Open Social Security, single-person claiming fixture.
 *
 * Oracle: Open Social Security (https://github.com/MikePiper/open-social-security)
 * Commit: 6e177deaf2944c809aed5d525169c7a94dd9440b
 * Source fixture: src/app/maximize-pv.service.spec.ts,
 *   "should tell a single person to file ASAP with very high discount rate".
 * Access date: 2026-06-30. License: MIT.
 *
 * Oracle inputs:
 *   Marital status: single; no spouse, children, disability, WEP/GPO, earnings test,
 *     prior filing, or benefit cut assumption.
 *   Worker: male, born April 1960, PIA $1,000/month.
 *   Valuation date: November 2018.
 *   Mortality: OpenSS "SSA" table (SSA period table option in the oracle fixture).
 *   Real discount rate: 9%.
 *
 * Oracle output:
 *   OpenSS recommends the first available retirement benefit date, May 2022
 *   (the first month after age 62 for the fixture's mid-month birthday).
 *
 * Comparable RetireGolden output:
 *   RetireGolden's benefits-only ranking is currently a whole-year grid, so the
 *   comparable assertion is that age 62 is the top-ranked claiming age. We do
 *   not assert OpenSS PV dollars here because OpenSS evaluates monthly dates and
 *   uses a lives-remaining mortality table, while RetireGolden derives annual
 *   survival from its SSA remaining-life-expectancy table.
 */

describe('ORACLE-007: single-person claiming vs Open Social Security', () => {
  it('matches the OpenSS ASAP-claiming result for a high-discount single worker', () => {
    const plan = singlePersonPlan({ dob: '1960-04-15' })
    plan.household.people[0] = { ...plan.household.people[0]!, sex: 'male' }
    plan.incomes = [socialSecurityIncome('ss-oracle-007', 1_000, 67, 'p1')]

    const ranking = benefitsOnlyRanking(validatePlan(plan), 0.09, 2018)

    expect(ranking.personIds).toEqual(['p1'])
    expect(ranking.rows).toHaveLength(9)
    expect(ranking.ranked[0]!.claimByPersonId).toEqual({ p1: 62 })
    for (const row of ranking.ranked.slice(1)) {
      expect(row.expectedPv).toBeLessThan(ranking.ranked[0]!.expectedPv)
    }
  })
})

/**
 * ORACLE-008 (external-oracle-comparisons.md) - Social Security claiming vs
 * Open Social Security, married-couple claiming fixture.
 *
 * Oracle: Open Social Security (https://github.com/MikePiper/open-social-security)
 * Commit: 6e177deaf2944c809aed5d525169c7a94dd9440b
 * Source fixture: src/app/maximize-pv.service.spec.ts,
 *   "should tell a high-PIA spouse to wait until 70, with low discount rate and
 *   long lifespans".
 * Access date: 2026-06-30. License: MIT.
 *
 * Oracle inputs:
 *   Marital status: married; no children, disability, WEP/GPO, prior filing,
 *     earnings test, or benefit cut assumption.
 *   Lower-PIA spouse: male, born September 1964, PIA $1,200/month.
 *   Higher-PIA spouse: female, born October 1964, PIA $1,900/month.
 *   Valuation date: December 2018.
 *   Mortality: OpenSS long-life presets (male NS2, female NS1).
 *   Real discount rate: 1%.
 *
 * Oracle output:
 *   OpenSS returns two retirement benefit dates, sorted by date, with the
 *   higher-PIA spouse's retirement date second: October 2034, her age-70 month.
 *
 * Comparable RetireGolden output:
 *   RetireGolden's benefits-only ranking is a whole-year grid and does not expose
 *   OpenSS's NS1/NS2 mortality presets. Because the cited OpenSS test freezes
 *   only the higher-PIA spouse's date, the comparable assertion is that every
 *   higher-PIA-spouse non-age-70 row ranks below the top age-70 row.
 */

describe('ORACLE-008: married-couple claiming vs Open Social Security', () => {
  it('matches the OpenSS high-earner-delay result for a low-discount married couple', () => {
    const plan = couplePlan({ p1Dob: '1964-09-15', p2Dob: '1964-10-11' })
    plan.household.people[0] = { ...plan.household.people[0]!, name: 'Lower PIA spouse', sex: 'male' }
    plan.household.people[1] = { ...plan.household.people[1]!, name: 'Higher PIA spouse', sex: 'female' }
    plan.incomes = [
      socialSecurityIncome('ss-oracle-008-low', 1_200, 67, 'p1'),
      socialSecurityIncome('ss-oracle-008-high', 1_900, 67, 'p2'),
    ]

    const ranking = benefitsOnlyRanking(validatePlan(plan), 0.01, 2018)

    expect(ranking.personIds).toEqual(['p1', 'p2'])
    expect(ranking.rows).toHaveLength(81)
    const best = ranking.ranked[0]!
    expect(best.claimByPersonId['p2']).toBe(70)
    for (const row of ranking.rows.filter((r) => r.claimByPersonId['p2'] !== 70)) {
      expect(row.expectedPv).toBeLessThan(best.expectedPv)
    }
  })
})
