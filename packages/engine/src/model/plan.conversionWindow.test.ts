/**
 * Cross-field refinements for the two windows a person types by hand, and for
 * the fill-to-target value that steers a Roth conversion (#495 decisions D5 and
 * D6, answered 2026-09-02; issues #508 and #524).
 *
 * Expected values are NOT taken from reading the new code. Each one comes from
 * a citable source, and each fixture discriminates: the value the source
 * publishes parses, the adjacent value it does not publish fails.
 *
 * - Bracket rates. `irc-1-j-2-progressive-ordinary-rate-schedule` in the rule
 *   registry (packages/engine/src/rules/records/individualIncomeTax.ts) states
 *   the schedule as "the 10/12/22/24/32/35/37 structure is current law
 *   indefinitely", on IRC 1(j)(2)(C) and Rev. Proc. 2025-32 section 4.01,
 *   Table 3. So 24 is a rate the statute publishes and 23, 25 and 30 are not,
 *   whatever the engine happens to do with them.
 * - IRMAA tiers. `usc-42-1395r-i-irmaa-applicable-percentage` states the
 *   sliding scale as "35, 50, 65, 80 or 85 percent" of program cost on
 *   42 U.S.C. 1395r(i)(3) — five steps above the standard premium, so tier 5
 *   exists and tier 6 does not.
 * - The window rules are the TIPS ladder's, transposed: a window that ends
 *   before it starts covers no year at all, which
 *   `strategies/rothConversion.ts` and the ladder both treat as a shape the
 *   ledger cannot price.
 */

import { describe, expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Plan } from './plan.js'
import { TAX_RULE_REGISTRY } from '../rules/taxRuleRegistry.js'
import { packForYear } from '../params/index.js'

let counter = 0
const testIds = () => `wt-${++counter}`
const fixedNow = () => new Date('2026-06-11T00:00:00.000Z')

/** The window this suite validates always opens in a year the pack publishes. */
const TAX_YEAR = 2026

function basePlan(): Plan {
  return createEmptyPlan({ newId: testIds, now: fixedNow })
}

function withFillToTarget(
  target: 'topOfBracket' | 'irmaaTier' | 'acaCliff' | 'fixedMagi',
  targetValue: number | null,
  years: { startYear: number; endYear: number } = { startYear: TAX_YEAR, endYear: TAX_YEAR + 10 },
): Plan {
  const plan = basePlan()
  plan.strategies.rothConversion = { mode: 'fillToTarget', target, targetValue, ...years }
  return plan
}

function issuesOf(plan: Plan): string[] {
  const parsed = parsePlan(structuredClone(plan))
  return parsed.ok ? [] : parsed.issues
}

describe('recurring income window (#524, decision D5)', () => {
  function withRecurring(startYear: number | null, endYear: number | null): Plan {
    const plan = basePlan()
    plan.incomes = [
      {
        type: 'recurring',
        id: 'rent',
        label: 'Rental',
        annualAmount: 24_000,
        startYear,
        endYear,
        inflationAdjusted: true,
        taxTreatment: 'ordinary',
      },
    ]
    return plan
  }

  it('refuses an end year before the start year, at the end-year field', () => {
    const issues = issuesOf(withRecurring(2040, 2030))
    expect(issues).toContain('incomes.0.endYear: a recurring income must end in or after the year it starts')
  })

  it('accepts a one-year window and an ordinary window', () => {
    expect(issuesOf(withRecurring(2040, 2040))).toEqual([])
    expect(issuesOf(withRecurring(2030, 2040))).toEqual([])
  })

  it('leaves an open-ended stream alone: either bound may be absent', () => {
    expect(issuesOf(withRecurring(null, 2030))).toEqual([])
    expect(issuesOf(withRecurring(2040, null))).toEqual([])
    expect(issuesOf(withRecurring(null, null))).toEqual([])
  })

  it('does not reach a wages or one-time stream, which carry no such pair', () => {
    // Wages are bounded by an age, not a year pair, and a one-time stream has a
    // single year, so neither can be inverted and neither may be refused here.
    const plan = basePlan()
    const personId = plan.household.people[0]!.id
    plan.incomes = [
      { type: 'wages', id: 'job', personId, annualGross: 120_000, endAge: 65, realGrowthPct: 1 },
      { type: 'oneTime', id: 'sale', label: 'Sale', year: 2030, inflationAdjusted: false, amount: 50_000, taxTreatment: 'capitalGain' },
    ]
    expect(issuesOf(plan)).toEqual([])
  })
})

describe('Roth fill-to-target window (#508, decision D5)', () => {
  it('refuses an end year before the start year, at the end-year field', () => {
    const issues = issuesOf(withFillToTarget('topOfBracket', 22, { startYear: 2050, endYear: 2036 }))
    expect(issues).toContain(
      'strategies.rothConversion.endYear: a conversion window must end in or after the year it starts',
    )
  })

  it('accepts a single-year window', () => {
    expect(issuesOf(withFillToTarget('topOfBracket', 22, { startYear: 2036, endYear: 2036 }))).toEqual([])
  })
})

describe('Roth fill-to-target value by target kind (#508, decision D6)', () => {
  // The rates the registry record names, quoted from its own statement.
  const PUBLISHED_RATES = [10, 12, 22, 24, 32, 35, 37]
  // The steps 42 U.S.C. 1395r(i)(3) puts above the standard premium.
  const PUBLISHED_IRMAA_APPLICABLE_PCTS = [35, 50, 65, 80, 85]

  it('the sources this suite cites are the ones the engine implements', () => {
    // The rule records are the authority; the pack is what the engine reads.
    // If they ever disagree, this fails before any fixture below is trusted.
    expect(TAX_RULE_REGISTRY['irc-1-j-2-progressive-ordinary-rate-schedule'].statement).toContain(
      '10/12/22/24/32/35/37',
    )
    expect(TAX_RULE_REGISTRY['usc-42-1395r-i-irmaa-applicable-percentage'].statement).toContain(
      '35, 50, 65, 80 or 85 percent',
    )
    const pack = packForYear(TAX_YEAR).pack
    expect(pack.federalTax.brackets.single.map((b) => b.ratePct)).toEqual(PUBLISHED_RATES)
    expect(pack.federalTax.brackets.marriedFilingJointly.map((b) => b.ratePct)).toEqual(PUBLISHED_RATES)
    expect(pack.medicare.irmaaTiers.map((t) => t.applicablePct)).toEqual(PUBLISHED_IRMAA_APPLICABLE_PCTS)
  })

  it.each(PUBLISHED_RATES)('accepts the published %i%% bracket rate', (rate) => {
    expect(issuesOf(withFillToTarget('topOfBracket', rate))).toEqual([])
  })

  it.each([
    // Adjacent to a published rate on each side, and the round number a person
    // reaches for. IRC 1(j)(2)(C) publishes none of them.
    [11],
    [23],
    [25],
    [30],
    [37.5],
    [99],
  ])('refuses %s%%, which the statute does not publish as a bracket rate', (rate) => {
    const issues = issuesOf(withFillToTarget('topOfBracket', rate))
    expect(issues).toContain(
      'strategies.rothConversion.targetValue: a bracket target must be one of the published rates (10, 12, 22, 24, 32, 35, 37)',
    )
  })

  it('refuses a missing bracket rate', () => {
    expect(issuesOf(withFillToTarget('topOfBracket', null)).join(' ')).toContain('a bracket target must be one of the published')
  })

  it.each([1, 2, 3, 4, 5])('accepts IRMAA tier %i, which the statute publishes', (tier) => {
    expect(issuesOf(withFillToTarget('irmaaTier', tier))).toEqual([])
  })

  it.each([
    // One below the first published step and one above the last: the statute's
    // scale starts at the 35% step and stops at the 85% one.
    [0],
    [6],
    [-1],
    [1.5],
  ])('refuses IRMAA tier %s, which is outside the published table', (tier) => {
    const issues = issuesOf(withFillToTarget('irmaaTier', tier))
    expect(issues).toContain(
      `strategies.rothConversion.targetValue: an IRMAA tier target must be a whole number from ${1} to ${PUBLISHED_IRMAA_APPLICABLE_PCTS.length}`,
    )
  })

  it('refuses a missing IRMAA tier', () => {
    expect(issuesOf(withFillToTarget('irmaaTier', null)).join(' ')).toContain('an IRMAA tier target must be')
  })

  it('accepts a fixed MAGI at or above zero and refuses a negative one', () => {
    expect(issuesOf(withFillToTarget('fixedMagi', 0))).toEqual([])
    expect(issuesOf(withFillToTarget('fixedMagi', 150_000))).toEqual([])
    expect(issuesOf(withFillToTarget('fixedMagi', -1))).toContain(
      'strategies.rothConversion.targetValue: a fixed MAGI target cannot be negative',
    )
  })

  it('leaves the ACA cliff target alone: its ceiling is the FPL, not a typed value', () => {
    expect(issuesOf(withFillToTarget('acaCliff', null))).toEqual([])
  })

  it('does not reach the other conversion modes', () => {
    const manual = basePlan()
    manual.strategies.rothConversion = { mode: 'manual', conversions: [{ year: 2030, amount: 40_000 }] }
    expect(issuesOf(manual)).toEqual([])
    expect(issuesOf(basePlan())).toEqual([])
  })
})
