import { describe, expect, it } from 'vitest'
import { describeRule } from './describeRule.js'
import {
  DEFAULT_REVERIFICATION_INTERVAL_DAYS,
  TAX_RULE_REGISTRY,
  taxRuleIds,
  taxRulesDueForVerification,
  type TaxRuleId,
  type TaxRuleJurisdiction,
  type TaxRuleVolatility,
  type UsStateCode,
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

/**
 * Publisher domains admissible as authority for a FEDERAL rule.
 *
 * The parameter pack's own comments cite Tax Foundation and Kiplinger for
 * figures this registry will eventually have to carry. Those are fine for
 * orientation and are not authority: a secondary source can be right and still
 * cannot be quoted as the operative language. Locking the publisher list keeps
 * that distinction from eroding one convenient citation at a time.
 *
 * Listed as publisher domains rather than as the exact hosts the current URLs
 * happen to use: www.irs.gov and irs.gov are the same publisher, and a guard
 * that admits one while rejecting the other is not enforcing provenance, it is
 * enforcing a spelling. Only the `www.` alias is folded in; every other
 * subdomain still has to be listed here deliberately.
 */
const FEDERAL_PRIMARY_PUBLISHERS: readonly string[] = [
  'law.cornell.edu', // U.S. Code and CFR
  'uscode.house.gov', // Office of the Law Revision Counsel
  'govinfo.gov', // GPO official compilations
  'irs.gov', // Revenue procedures, notices, publications
  'ecfr.gov', // Electronic CFR
  'ssa.gov', // POMS and the Social Security Act
  'jct.gov', // Joint Committee on Taxation
]

/**
 * Publisher domains admissible as authority for a rule of the named state, in
 * ADDITION to the federal list above.
 *
 * A second tier rather than more entries in the first, because the two are not
 * interchangeable in both directions. State income tax is created by a state
 * code and administered by a state revenue department, so those hosts are the
 * only primary sources for it — and they have no authority whatever over a
 * federal rule. Concatenating the lists would have admitted every state host as
 * authority for every IRC record, which is a larger hole than the one the state
 * tier was opened to close.
 *
 * Keyed by state so a North Dakota rule cannot be sourced to another state's
 * department. A state absent from this table admits nothing, so the tier fails
 * closed: hosts are added when that state's first rule is registered and its
 * publishers have actually been checked, not pre-populated from memory. An
 * unverified host list here would be the same unearned confidence the registry
 * header warns about, one layer up.
 */
const STATE_PRIMARY_PUBLISHERS: Readonly<Partial<Record<UsStateCode, readonly string[]>>> = {
  // Verified 2026-08-04 against the sites themselves.
  ND: [
    'tax.nd.gov', // Office of State Tax Commissioner
    'ndlegis.gov', // Century Code, Title 57 Taxation (ch. 57-38, Income Tax)
  ],
}

/**
 * Secondary sources that are permanently outside BOTH tiers, however convenient
 * and however accurate. They summarise; they do not publish operative language,
 * and a summary cannot be quoted to a preparer as the thing the rule says.
 */
const SECONDARY_AGGREGATORS: readonly string[] = [
  'taxfoundation.org',
  'kiplinger.com',
  'learn.valur.com',
]

/**
 * The part of a record the citation guard reads. Narrower than `TaxRuleRecord`
 * so the guard can be exercised against a synthetic state record without one
 * having to be registered first — the state tier has to be provably enforced
 * before the records that depend on it are written, not after.
 */
interface CitableRule {
  readonly jurisdiction: TaxRuleJurisdiction
  readonly authority: readonly { readonly citation: string, readonly url: string }[]
}

function admissiblePublishers(jurisdiction: TaxRuleJurisdiction): readonly string[] {
  if (jurisdiction === 'federal') return FEDERAL_PRIMARY_PUBLISHERS
  const stateCode = jurisdiction.slice('state:'.length) as UsStateCode
  return [...FEDERAL_PRIMARY_PUBLISHERS, ...STATE_PRIMARY_PUBLISHERS[stateCode] ?? []]
}

/**
 * The host a URL resolves to, or null when the URL will not parse, alongside
 * the publisher that host belongs to. Both are returned because a violation is
 * reported against the host as written while admissibility is decided on the
 * publisher.
 */
function hostAndPublisherOf(url: string): { host: string, publisher: string } | null {
  let host: string
  try {
    // Parsed rather than sliced: `hostname` lower-cases and drops any
    // credentials or port, so https://www.irs.gov@example.com/ resolves to
    // example.com and is caught instead of reading as the IRS.
    host = new URL(url).hostname
  } catch {
    return null
  }
  return { host, publisher: host.startsWith('www.') ? host.slice(4) : host }
}

/** Citations drawn from a publisher their rule's jurisdiction cannot reach. */
function offSourceAuthorities(
  entries: readonly (readonly [string, CitableRule])[],
): readonly string[] {
  const offSource: string[] = []
  for (const [ruleId, rule] of entries) {
    const admissible = admissiblePublishers(rule.jurisdiction)
    for (const authority of rule.authority) {
      const parsed = hostAndPublisherOf(authority.url)
      if (parsed === null) {
        // Reported rather than thrown, so a malformed URL names the record it
        // came from instead of failing the run with a bare 'Invalid URL'.
        offSource.push(`${ruleId}:${authority.citation}:unparseable-url`)
        continue
      }
      if (!admissible.includes(parsed.publisher)) {
        offSource.push(`${ruleId}:${authority.citation}:${parsed.host}`)
      }
    }
  }
  return offSource
}

/** State rules resting on no source from the sovereign that creates the tax. */
function stateRulesMissingStateAuthority(
  entries: readonly (readonly [string, CitableRule])[],
): readonly string[] {
  return entries
    .filter(([, rule]) => rule.jurisdiction !== 'federal')
    .filter(([, rule]) => {
      const stateCode = rule.jurisdiction.slice('state:'.length) as UsStateCode
      const stateHosts = STATE_PRIMARY_PUBLISHERS[stateCode] ?? []
      return !rule.authority.some((authority) => {
        const parsed = hostAndPublisherOf(authority.url)
        return parsed !== null && stateHosts.includes(parsed.publisher)
      })
    })
    .map(([ruleId]) => ruleId)
}

const registryEntries: readonly (readonly [string, CitableRule])[] =
  taxRuleIds.map((ruleId) => [ruleId, TAX_RULE_REGISTRY[ruleId]] as const)

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

  it('covers every approximated rule, so the record fails when the gap closes', () => {
    // The classification that rots fastest, and in the most flattering
    // direction: an approximated record says "we know this figure is wrong",
    // which keeps reading as diligence long after the figure stopped being
    // wrong. Two such records survived on main describing behaviour a parallel
    // branch had already fixed, and one of them contradicted a settled record
    // about the same statute. Neither the publisher guard nor the
    // error-direction guard can see that — they check a record's shape, never
    // its prose against the engine. A fixture naming the produced reading can,
    // because the day the engine stops producing it the assertion fails.
    const uncovered = taxRuleIds.filter((ruleId) =>
      TAX_RULE_REGISTRY[ruleId].classification === 'approximated' && !claimedRuleIds.has(ruleId))
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

  it('requires an approximated rule to state which way its figure errs', () => {
    // An approximation without a direction is worse than an unrecorded gap. It
    // tells a reader the number is wrong and leaves them unable to say whether
    // acting on it costs the taxpayer money or exposes them to the IRS, which
    // are not the same risk and do not call for the same disclosure.
    const directionless = taxRuleIds.filter((ruleId) => {
      const rule = TAX_RULE_REGISTRY[ruleId]
      return rule.classification === 'approximated' && rule.errorDirection === null
    })
    expect(directionless).toEqual([])
  })

  it('requires every other classification to record no error direction', () => {
    // A direction on a settled rule would be a contradiction in the record: the
    // engine either produces the authority's figure or it does not. Left
    // unguarded, a stale direction survives a reclassification and reads as a
    // live warning about a rule that no longer has anything wrong with it.
    const spurious = taxRuleIds.filter((ruleId) => {
      const rule = TAX_RULE_REGISTRY[ruleId]
      return rule.classification !== 'approximated' && rule.errorDirection !== null
    })
    expect(spurious).toEqual([])
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

  it('sources every federal authority from a federal primary publisher', () => {
    expect(offSourceAuthorities(registryEntries)).toEqual([])
  })

  it('refuses a state host as authority for a federal rule', () => {
    // The negative direction of the two-tier guard, and the one that matters:
    // adding a state tier is only safe if it cannot leak sideways into the
    // federal one. A federal rule sourced to a state revenue department is not
    // a near miss, it is a claim about the Internal Revenue Code resting on a
    // publisher with no authority over it at all.
    expect(offSourceAuthorities([['irc-fictional-federal', {
      jurisdiction: 'federal',
      authority: [{ citation: 'IRC 1', url: 'https://www.tax.nd.gov/' }],
    }]])).toEqual(['irc-fictional-federal:IRC 1:www.tax.nd.gov'])
  })

  it('admits a state host only for a rule of that state', () => {
    // A flat state tier would let a North Dakota rule be sourced to California's
    // Franchise Tax Board, which is the same erosion as the federal case one
    // sovereign further down. The tier is keyed by state so it cannot.
    expect(offSourceAuthorities([['nd-fictional', {
      jurisdiction: 'state:ND',
      authority: [{ citation: 'NDCC 57-38-01', url: 'https://ndlegis.gov/cencode/t57c38.html' }],
    }]])).toEqual([])
    expect(offSourceAuthorities([['nd-fictional', {
      jurisdiction: 'state:ND',
      authority: [{ citation: 'NDCC 57-38-01', url: 'https://www.ftb.ca.gov/' }],
    }]])).toEqual(['nd-fictional:NDCC 57-38-01:www.ftb.ca.gov'])
  })

  it('admits nothing for a state with no researched publisher tier', () => {
    // Fails closed rather than open. A state whose hosts have not been verified
    // has an absent tier, not an empty permission, so the first record written
    // for it cannot cite anything until someone does the research.
    expect(offSourceAuthorities([['ca-fictional', {
      jurisdiction: 'state:CA',
      authority: [{ citation: 'Cal. Rev. & Tax. Code 17041', url: 'https://www.ftb.ca.gov/' }],
    }]])).toEqual(['ca-fictional:Cal. Rev. & Tax. Code 17041:www.ftb.ca.gov'])
  })

  it('lets a state rule rest on the federal law its state code incorporates', () => {
    // The asymmetry is deliberate and runs one way only. State income tax
    // generally starts from a federal figure -- North Dakota computes its tax
    // from federal taxable income -- so a state rule that cites the Code is
    // citing the law its own code adopted by reference. The converse is never
    // true: no federal rule takes its content from a state.
    expect(offSourceAuthorities([['nd-fictional', {
      jurisdiction: 'state:ND',
      authority: [{ citation: 'IRC 63', url: 'https://www.law.cornell.edu/uscode/text/26/63' }],
    }]])).toEqual([])
  })

  it('requires a state rule to rest on at least one source from its own state', () => {
    // Without this a state rule could be laundered entirely through federal
    // citations -- every quotation impeccable, and not one of them from the
    // sovereign that actually creates the tax.
    expect(stateRulesMissingStateAuthority(registryEntries)).toEqual([])
    expect(stateRulesMissingStateAuthority([['nd-fictional', {
      jurisdiction: 'state:ND',
      authority: [{ citation: 'IRC 63', url: 'https://www.law.cornell.edu/uscode/text/26/63' }],
    }]])).toEqual(['nd-fictional'])
    expect(stateRulesMissingStateAuthority([['nd-fictional', {
      jurisdiction: 'state:ND',
      authority: [
        { citation: 'IRC 63', url: 'https://www.law.cornell.edu/uscode/text/26/63' },
        { citation: 'NDCC 57-38-30.3', url: 'https://ndlegis.gov/cencode/t57c38.html' },
      ],
    }]])).toEqual([])
  })

  it('never admits a secondary aggregator to either tier', () => {
    // Named rather than described, because the concrete instance is the point:
    // North Dakota's treatment is presently sourced in the research notes to
    // learn.valur.com alone, and a summary that is right today is still not the
    // operative language and cannot be quoted as though it were. This assertion
    // exists so a future state tier cannot admit one of these as a shortcut to
    // a citation nobody wanted to go and find.
    const admitted = SECONDARY_AGGREGATORS.filter((host) =>
      FEDERAL_PRIMARY_PUBLISHERS.includes(host)
      || Object.values(STATE_PRIMARY_PUBLISHERS).some((hosts) => hosts.includes(host)))
    expect(admitted).toEqual([])
  })

  // A guard requiring every citation to name a subdivision was tried here and
  // removed: 20 CFR 404.313 is a complete section, IRS Publication 590-B
  // carries a letter, and (JCS-1-26) carries hyphens, so a subdivision pattern
  // flags legitimate forms alongside the two that are genuinely vague. Two
  // records do cite a whole publication without a locator -- 'IRS Publication
  // 969' and 'IRS SIMPLE IRA plan FAQs' -- and tightening those is worth doing
  // by hand rather than by a pattern that cries wolf on five others.

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
    // The as-of date is DERIVED, not written down. What this test proves is a
    // tiering property -- an awaitingGuidance rule falls due while a
    // staticStatute one does not -- and a hardcoded date couples that property
    // to whenever the named records were last verified. It has already broken
    // once that way, on a re-verification that moved a record two days past a
    // literal, turning a statement about tiering into a failure about
    // arithmetic.
    //
    // Only the INPUT is derived. The three expectations below stay written out,
    // so the test still says which rules must appear and which must not.
    const awaitingGuidanceDue = [
      'irc-408-d-8-includible-qcd-basis',
      'irc-170-p-standard-deduction-carryover',
    ] as const satisfies readonly TaxRuleId[]
    const latestVerifiedOn = awaitingGuidanceDue
      .map((ruleId) => TAX_RULE_REGISTRY[ruleId].verifiedOn)
      .reduce((left, right) => (left > right ? left : right))
    // Built from the record's own date, never from the clock. `new Date()` here
    // would make the suite pass or fail according to when it runs, which is the
    // same coupling this comment exists to remove, only worse.
    const ninetyDaysOn = new Date(latestVerifiedOn + 'T00:00:00.000Z')
    ninetyDaysOn.setUTCDate(ninetyDaysOn.getUTCDate() + 90)
    const atNinetyDays = taxRulesDueForVerification(ninetyDaysOn.toISOString().slice(0, 10))
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

  it('refuses an approximated rule that does not name the reading it produces', () => {
    // Reachable only through a widened rule ID, which is what the cast stands
    // in for: with a literal ID the omission is a compile error. Both layers
    // are wanted. The type stops it at authoring time; the throw stops a
    // fixture that reaches describeRule some other way, and is what this
    // assertion pins.
    expect(() => describeRule('irc-213-a-medical-expense-deduction' as TaxRuleId, {
      readings: { statute: 1200, engineOmitsIt: 0 }, accepted: 'statute',
    }, noop)).toThrow(/name the reading this engine produces/u)
  })

  it('refuses an approximated rule whose produced reading is the accepted one', () => {
    // The way an approximated record would otherwise be laundered into looking
    // covered: point `produced` at the statute and assert the engine matches
    // it. That fixture passes, proves the opposite of what the record claims,
    // and leaves the gap unpinned.
    expect(() => describeRule('irc-213-a-medical-expense-deduction' as TaxRuleId, {
      readings: { statute: 1200, engineOmitsIt: 0 },
      accepted: 'statute',
      produced: 'statute',
    } as never, noop)).toThrow(/a rule the engine gets right is not approximated/u)
  })

  it('refuses a produced reading that is not among the candidates', () => {
    expect(() => describeRule('irc-213-a-medical-expense-deduction' as TaxRuleId, {
      readings: { statute: 1200, engineOmitsIt: 0 },
      accepted: 'statute',
      produced: 'somethingElse',
    } as never, noop)).toThrow(/produced reading is not among/u)
  })

  it('refuses a settled rule that admits the engine produces something else', () => {
    expect(() => describeRule('irc-170-b-1-I-floor-ordering' as TaxRuleId, {
      readings: { statute: 450, rejected: 500 },
      accepted: 'statute',
      produced: 'rejected',
    } as never, noop)).toThrow(/reclassify it as approximated/u)
  })
})
