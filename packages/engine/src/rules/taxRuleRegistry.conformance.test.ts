import { describe, expect, it } from 'vitest'
import { describeRule } from './describeRule.js'
import {
  DEFAULT_REVERIFICATION_INTERVAL_DAYS,
  TAX_RULE_REGISTRY,
  taxRuleIds,
  taxRulesDueForVerification,
  type TaxRuleId,
  type TaxRuleVolatility,
} from './taxRuleRegistry.js'

/**
 * Coverage is discovered by scanning sources rather than recorded at runtime,
 * because Vitest isolates test files and a module-level registry would not be
 * shared across them. `describeRule` enforces the discriminating requirement
 * locally at call time; this file enforces coverage globally.
 */
// Vite requires the options to be an inline object literal.
const testSources = import.meta.glob('../**/*.test.ts', { query: '?raw', import: 'default', eager: true })
const engineSources = import.meta.glob('../**/*.ts', { query: '?raw', import: 'default', eager: true })

// This file is excluded from its own scan. Its guard tests call describeRule
// with a deliberately unregistered ID and with a real rule ID, so counting them
// would both trip the unknown-rule assertion and let a guard-only reference
// launder coverage for a rule whose actual fixture had been deleted.
const CONFORMANCE_SOURCE = 'taxRuleRegistry.conformance.test.ts'
const claimedRuleIds = new Map<string, string[]>()
for (const [path, source] of Object.entries(testSources)) {
  if (path.endsWith(CONFORMANCE_SOURCE)) continue
  for (const match of source.matchAll(/describeRule\(\s*'([^']+)'/gu)) {
    const ruleId = match[1]!
    claimedRuleIds.set(ruleId, [...(claimedRuleIds.get(ruleId) ?? []), path])
  }
}

/** Glob keys are relative to this directory; registry paths are repo-relative. */
const engineSourcePaths = new Set(
  Object.keys(engineSources).map((path) => path.replace(/^\.\.\//u, 'packages/engine/src/')),
)

describe('tax rule registry conformance', () => {
  it('covers every settled rule with a discriminating fixture', () => {
    const uncovered = taxRuleIds.filter((ruleId) =>
      TAX_RULE_REGISTRY[ruleId].classification === 'settled' && !claimedRuleIds.has(ruleId))
    expect(uncovered).toEqual([])
  })

  it('covers every unsettled rule, so the reading we took is pinned', () => {
    // An unsettled rule is the likeliest to be "corrected" into a defect by a
    // later reader who does not know the question was researched. Requiring a
    // fixture makes the chosen reading fail loudly rather than drift silently.
    const uncovered = taxRuleIds.filter((ruleId) =>
      TAX_RULE_REGISTRY[ruleId].classification === 'unsettled' && !claimedRuleIds.has(ruleId))
    expect(uncovered).toEqual([])
  })

  it('never counts its own guard calls as coverage', () => {
    // The guard tests below call describeRule with a real rule ID and with an
    // unregistered one. Counting either would be wrong: the first would launder
    // coverage for a rule whose actual fixture had been deleted, the second
    // would trip the unknown-rule assertion.
    //
    // Vite's glob already excludes the importing module, so this file is not in
    // `testSources` at all — but that is an implicit property of the bundler,
    // not something the scan should depend on, hence the explicit skip.
    expect(Object.keys(testSources).some((path) => path.endsWith(CONFORMANCE_SOURCE)))
      .toBe(false)
    for (const [, paths] of claimedRuleIds) {
      expect(paths.every((path) => !path.endsWith(CONFORMANCE_SOURCE))).toBe(true)
    }
  })

  it('rejects a fixture claiming a rule that is not registered', () => {
    const unknown = [...claimedRuleIds.keys()].filter((ruleId) => !(ruleId in TAX_RULE_REGISTRY))
    expect(unknown).toEqual([])
  })

  it('requires an unsettled rule to record the reading it rejected', () => {
    const missing = taxRuleIds.filter((ruleId) => {
      const rule = TAX_RULE_REGISTRY[ruleId]
      return rule.classification === 'unsettled'
        && (rule.contraryReading === null || rule.contraryReading.trim().length === 0)
    })
    expect(missing).toEqual([])
  })

  it('requires a settled rule to record no contrary reading', () => {
    const spurious = taxRuleIds.filter((ruleId) =>
      TAX_RULE_REGISTRY[ruleId].classification === 'settled'
      && TAX_RULE_REGISTRY[ruleId].contraryReading !== null)
    expect(spurious).toEqual([])
  })

  it('quotes operative language for every authority rather than paraphrasing', () => {
    // A paraphrase is where misreadings hide. Defects in this engine's history
    // came from prose summaries that dropped the qualifier the statute turned
    // on, so a bare citation is not enough to register a rule.
    const thin: string[] = []
    for (const ruleId of taxRuleIds) {
      for (const authority of TAX_RULE_REGISTRY[ruleId].authority) {
        if (authority.quotedText.trim().length < 40) thin.push(`${ruleId}:${authority.citation}:quote`)
        if (!authority.url.startsWith('https://')) thin.push(`${ruleId}:${authority.citation}:url`)
      }
    }
    expect(thin).toEqual([])
  })

  it('names an implementing engine source that exists for every rule', () => {
    const missing: string[] = []
    for (const ruleId of taxRuleIds) {
      for (const path of TAX_RULE_REGISTRY[ruleId].implementedBy) {
        if (!engineSourcePaths.has(path)) missing.push(`${ruleId}:${path}`)
      }
    }
    expect(missing).toEqual([])
  })

  it('records a verification date that is a real calendar date', () => {
    const malformed = taxRuleIds.filter((ruleId) => {
      const { verifiedOn } = TAX_RULE_REGISTRY[ruleId]
      return !/^\d{4}-\d{2}-\d{2}$/u.test(verifiedOn)
        || Number.isNaN(Date.parse(`${verifiedOn}T00:00:00Z`))
    })
    expect(malformed).toEqual([])
  })
})

describe('periodic re-verification', () => {
  // The scheduled research pass reads this to decide what to re-check, so the
  // tiering has to hold: a rule awaiting guidance falls due long before settled
  // statutory mechanics, and an indexed figure falls due within the year so the
  // autumn COLA notice is picked up before the tax year turns.
  it('tiers rules so volatile ones fall due first', () => {
    expect(DEFAULT_REVERIFICATION_INTERVAL_DAYS.awaitingGuidance)
      .toBeLessThan(DEFAULT_REVERIFICATION_INTERVAL_DAYS.annuallyIndexed)
    expect(DEFAULT_REVERIFICATION_INTERVAL_DAYS.annuallyIndexed)
      .toBeLessThan(DEFAULT_REVERIFICATION_INTERVAL_DAYS.staticStatute)
    expect(DEFAULT_REVERIFICATION_INTERVAL_DAYS.annuallyIndexed).toBeLessThanOrEqual(365)
  })

  it('reports nothing due on the most recent verification date', () => {
    // Derived rather than hard-coded: rules are verified on different days, and
    // a fixed date would drift into meaninglessness as records are added.
    const latest = taxRuleIds
      .map((ruleId) => TAX_RULE_REGISTRY[ruleId].verifiedOn)
      .reduce((newest, date) => (date > newest ? date : newest))
    expect(taxRulesDueForVerification(latest)).toEqual([])
  })

  it('refuses an interval table missing a volatility rather than never reporting due', () => {
    // A missing key would make the comparison false and silently report the
    // rule as never due, so it must fail closed instead.
    expect(() => taxRulesDueForVerification('2027-09-01', {
      staticStatute: 365, annuallyIndexed: 120, awaitingGuidance: 90,
    } as unknown as Readonly<Record<TaxRuleVolatility, number>>)).toThrow(RangeError)
  })

  it('refuses a date that is parseable but not an ISO calendar date', () => {
    expect(() => taxRulesDueForVerification('August 3, 2026')).toThrow(RangeError)
    expect(() => taxRulesDueForVerification('2026-8-3')).toThrow(RangeError)
  })

  it('brings unsettled rules due before settled statutory mechanics', () => {
    const atNinetyDays = taxRulesDueForVerification('2026-11-01')
    expect(atNinetyDays).toContain('irc-408-d-8-includible-qcd-basis' satisfies TaxRuleId)
    expect(atNinetyDays).toContain('irc-170-p-standard-deduction-carryover' satisfies TaxRuleId)
    expect(atNinetyDays).not.toContain('irc-170-b-1-I-floor-ordering' satisfies TaxRuleId)
  })

  it('brings the indexed QCD limit due before the tax year turns', () => {
    expect(taxRulesDueForVerification('2026-12-15'))
      .toContain('irc-408-d-8-A-annual-qcd-limit' satisfies TaxRuleId)
  })

  it('eventually brings every rule due', () => {
    expect(taxRulesDueForVerification('2027-09-01')).toEqual([...taxRuleIds])
  })

  it('rejects a malformed as-of date rather than silently reporting nothing', () => {
    expect(() => taxRulesDueForVerification('not-a-date')).toThrow(RangeError)
  })
})

describe('describeRule guards', () => {
  // The gate is only worth anything if a fixture that cannot distinguish the
  // candidate readings is actually refused. These assert the refusals rather
  // than trusting the helper.
  const noop = (): void => {}

  it('refuses a fixture offering only one reading', () => {
    expect(() => describeRule('irc-170-b-1-I-floor-ordering', {
      readings: { statute: 450 }, accepted: 'statute',
    }, noop)).toThrow(/at least two candidate readings/u)
  })

  it('refuses readings that predict the same value', () => {
    // This is the exact shape of the fixture that let the 170(b)(1)(I) ordering
    // defect survive a full adversarial review: green, and proving nothing.
    expect(() => describeRule('irc-170-b-1-I-floor-ordering', {
      readings: { statute: 950, rejectedFloorBeforeCeiling: 950 }, accepted: 'statute',
    }, noop)).toThrow(/predicting identical values/u)
  })

  it('refuses an accepted reading that is not among the candidates', () => {
    expect(() => describeRule('irc-170-b-1-I-floor-ordering', {
      readings: { statute: 450, rejected: 500 },
      accepted: 'somethingElse' as 'statute',
    }, noop)).toThrow(/not among its candidate readings/u)
  })

  it('refuses to cover an unknown rule', () => {
    expect(() => describeRule('not-a-registered-rule' as TaxRuleId, {
      readings: { a: 1, b: 2 }, accepted: 'a',
    }, noop)).toThrow(/Unknown tax rule/u)
  })
})
