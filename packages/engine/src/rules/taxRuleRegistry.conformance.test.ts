import { describe, expect, it } from 'vitest'
import { describeRefusal } from './describeRefusal.js'
import { describeRule } from './describeRule.js'
import { declaredSymbolLinesOf, symbolAnchorLine, type DeclaredSymbol } from './symbolLines.js'
import {
  DEFAULT_REVERIFICATION_INTERVAL_DAYS,
  TAX_RULE_RECORD_MODULES,
  TAX_RULE_REGISTRY,
  taxRuleIds,
  taxRulesDueForVerification,
  type TaxRuleAuthorityKind,
  type TaxRuleId,
  type TaxRuleJurisdiction,
  type TaxRuleVolatility,
  type UsStateCode,
} from './taxRuleRegistry.js'
import { annuityRecords } from './records/annuities.js'
import { charitableDeductionRecords } from './records/charitableDeductions.js'
import { charitableDistributionRecords } from './records/charitableDistributions.js'
import { contributionAndDeferralLimitRecords } from './records/contributionAndDeferralLimits.js'
import { earlyDistributionAndSeppRecords } from './records/earlyDistributionsAndSepp.js'
import { healthSavingsAccountRecords } from './records/healthSavingsAccounts.js'
import { individualIncomeTaxRecords } from './records/individualIncomeTax.js'
import { investmentIncomeAndBasisRecords } from './records/investmentIncomeAndBasis.js'
import { iraBasisAndRolloverRecords } from './records/iraBasisAndRollovers.js'
import { medicareAndHealthCoverageRecords } from './records/medicareAndHealthCoverage.js'
import { requiredMinimumDistributionRecords } from './records/requiredMinimumDistributions.js'
import { rothAccountRecords } from './records/rothAccounts.js'
import { socialSecurityRecords } from './records/socialSecurity.js'
import { midwestStateRecords } from './records/statesMidwest.js'
import { northeastStateRecords } from './records/statesNortheast.js'
import { southAtlanticStateRecords } from './records/statesSouthAtlantic.js'
import { southCentralStateRecords } from './records/statesSouthCentral.js'
import { westStateRecords } from './records/statesWest.js'
import { transferAndUnmodeledRegimeRecords } from './records/transfersAndUnmodeledRegimes.js'

/**
 * Every module `taxRuleRegistry.ts` spreads into the registry, imported
 * directly so the duplicate-key guard below can count each one's keys. Spread
 * silently lets a later duplicate win, so the registry alone cannot show that a
 * rule id was registered twice; only the parts can.
 */
const RECORD_MODULES: readonly (readonly [string, Readonly<Record<string, unknown>>])[] = [
  ['charitableDeductions', charitableDeductionRecords],
  ['charitableDistributions', charitableDistributionRecords],
  ['iraBasisAndRollovers', iraBasisAndRolloverRecords],
  ['requiredMinimumDistributions', requiredMinimumDistributionRecords],
  ['rothAccounts', rothAccountRecords],
  ['earlyDistributionsAndSepp', earlyDistributionAndSeppRecords],
  ['annuities', annuityRecords],
  ['contributionAndDeferralLimits', contributionAndDeferralLimitRecords],
  ['healthSavingsAccounts', healthSavingsAccountRecords],
  ['medicareAndHealthCoverage', medicareAndHealthCoverageRecords],
  ['socialSecurity', socialSecurityRecords],
  ['investmentIncomeAndBasis', investmentIncomeAndBasisRecords],
  ['individualIncomeTax', individualIncomeTaxRecords],
  ['transfersAndUnmodeledRegimes', transferAndUnmodeledRegimeRecords],
  ['statesNortheast', northeastStateRecords],
  ['statesMidwest', midwestStateRecords],
  ['statesSouthAtlantic', southAtlanticStateRecords],
  ['statesSouthCentral', southCentralStateRecords],
  ['statesWest', westStateRecords],
]

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

/**
 * Keywords after which `/` starts a regex rather than division, checked in
 * addition to the punctuation set below. Not exhaustive of every keyword a
 * full parser would accept — `else`, `do`, and the rest of the statement
 * keywords never precede a regex literal directly in practice — but wide
 * enough to cover how a regex literal is actually written in this repo's test
 * sources.
 */
const REGEX_LITERAL_PRECEDING_KEYWORDS = new Set([
  'return',
  'typeof',
  'instanceof',
  'in',
  'of',
  'new',
  'delete',
  'void',
  'throw',
  'yield',
  'case',
])

/**
 * Whether a regex literal can begin at `index`: true at the start of the
 * source, after `( , = : ; ! & | ? { [` (skipping whitespace), or after one of
 * `REGEX_LITERAL_PRECEDING_KEYWORDS` — the same heuristic a parser uses to
 * decide `/` opens a regex rather than division, plus the keyword-preceded
 * case a punctuation-only check misses. Needed so a quote inside a regex
 * literal — such as the `'` in this very file's own `(['"\`]?)` character
 * class — is never mistaken by `stripComments` for a string opener, which
 * would make it skip forward to some unrelated later quote and silently fail
 * to blank a comment (or a commented-out fixture call) hiding inside that
 * misread span.
 *
 * Deliberately still returns false after `)` and `]`: a full parser resolves
 * those by tracking whether the matching open punctuation started an
 * expression or a control-flow head, which this character scanner does not
 * do. `coverageReport.ts`'s `regexCanFollow` — the accepted, shipped sibling
 * of this heuristic — has the identical limitation; extending past it here
 * would mean guessing at disambiguation this repo's own precedent does not
 * attempt either.
 */
function regexLiteralCanOpenAt(source: string, index: number): boolean {
  let cursor = index - 1
  while (cursor >= 0 && /\s/u.test(source[cursor]!)) cursor -= 1
  if (cursor < 0) return true
  if ('(,=:;!&|?{['.includes(source[cursor]!)) return true
  if (!/[a-zA-Z0-9_$]/u.test(source[cursor]!)) return false
  let wordStart = cursor
  while (wordStart >= 0 && /[a-zA-Z0-9_$]/u.test(source[wordStart]!)) wordStart -= 1
  const word = source.slice(wordStart + 1, cursor + 1)
  return REGEX_LITERAL_PRECEDING_KEYWORDS.has(word)
}

/**
 * Blanks out `//` and `/* *\/` comments in `source`, replacing each with
 * whitespace of the same length so a commented-out `describeRule(` or
 * `describeRefusal(` call can never satisfy the coverage scans below —
 * without this, deleting a real fixture but leaving it commented out would
 * still count as coverage under a plain regex scan. String, template, and
 * regex literal contents are walked past but left intact, since the id
 * argument the scans capture lives inside a string, and a quote or `//`-
 * shaped sequence inside a regex literal must never be mistaken for a string
 * opener or a comment.
 */
function stripComments(source: string): string {
  let out = ''
  let i = 0
  while (i < source.length) {
    const c = source[i]!
    const next = source[i + 1]
    if (c === '/' && next === '/') {
      const eol = source.indexOf('\n', i)
      const end = eol === -1 ? source.length : eol
      out += ' '.repeat(end - i)
      i = end
      continue
    }
    if (c === '/' && next === '*') {
      const close = source.indexOf('*/', i + 2)
      const end = close === -1 ? source.length : close + 2
      out += source.slice(i, end).replace(/[^\n]/gu, ' ')
      i = end
      continue
    }
    if (c === "'" || c === '"') {
      let cursor = i + 1
      while (cursor < source.length && source[cursor] !== c) {
        cursor += source[cursor] === '\\' ? 2 : 1
      }
      cursor = Math.min(cursor + 1, source.length)
      out += source.slice(i, cursor)
      i = cursor
      continue
    }
    if (c === '`') {
      let cursor = i + 1
      while (cursor < source.length && source[cursor] !== '`') {
        cursor += source[cursor] === '\\' ? 2 : 1
      }
      cursor = Math.min(cursor + 1, source.length)
      out += source.slice(i, cursor)
      i = cursor
      continue
    }
    if (c === '/' && regexLiteralCanOpenAt(source, i)) {
      let cursor = i + 1
      let inClass = false
      let closed = false
      while (cursor < source.length) {
        const cc = source[cursor]!
        if (cc === '\\') {
          cursor += 2
          continue
        }
        if (cc === '[') {
          inClass = true
        } else if (cc === ']') {
          inClass = false
        } else if (cc === '/' && !inClass) {
          cursor += 1
          closed = true
          break
        } else if (cc === '\n') {
          break // not a regex after all; bail at EOL and fall through to plain '/'
        }
        cursor += 1
      }
      if (closed) {
        while (cursor < source.length && /[a-z]/iu.test(source[cursor]!)) cursor += 1
        out += source.slice(i, cursor)
        i = cursor
        continue
      }
    }
    out += c
    i += 1
  }
  return out
}

/**
 * Index just past the closing parenthesis of the call whose first `(` is at
 * or after `start`, skipping parens that appear inside string or template
 * literals so quoted content cannot misalign the depth count. `source` is
 * assumed to already have comments stripped (see `stripComments`).
 */
function callEnd(source: string, start: number): number {
  const open = source.indexOf('(', start)
  if (open === -1) return source.length
  let depth = 0
  let i = open
  while (i < source.length) {
    const c = source[i]!
    if (c === "'" || c === '"') {
      let cursor = i + 1
      while (cursor < source.length && source[cursor] !== c) {
        cursor += source[cursor] === '\\' ? 2 : 1
      }
      i = Math.min(cursor + 1, source.length)
      continue
    }
    if (c === '`') {
      let cursor = i + 1
      while (cursor < source.length && source[cursor] !== '`') {
        cursor += source[cursor] === '\\' ? 2 : 1
      }
      i = Math.min(cursor + 1, source.length)
      continue
    }
    if (c === '(') depth += 1
    if (c === ')') {
      depth -= 1
      if (depth === 0) return i + 1
    }
    i += 1
  }
  return source.length
}

/**
 * Whether `expect(...)` at `matchStart` (the index of its `e`) within `body`
 * is chained into an actual matcher — `.toBe(`, `.not.toContain(`, and so on
 * — immediately after its balanced close, rather than standing alone as the
 * no-op `expect(value)` is in Vitest with nothing chained onto it.
 */
function isChainedExpect(body: string, matchStart: number): boolean {
  const close = callEnd(body, matchStart)
  let cursor = close
  while (cursor < body.length && /\s/u.test(body[cursor]!)) cursor += 1
  return body[cursor] === '.'
}

/**
 * Whether the balanced `describeRefusal(...)` call body registers at least
 * one `it(` test that itself calls a chained `expect(...).<matcher>(...)`.
 * `describeRefusal` validates the rule id, its classification, and the
 * fixture's prose fields, but nothing about the helper itself forces the
 * suite callback to assert anything — `describeRefusal(id, spec, () => {})`
 * would otherwise satisfy the backlog-equality ratchet below while driving no
 * refusal at all, and so would `describeRefusal(id, spec, () => { it('todo',
 * () => {}) })` (an `it` that registers but asserts nothing) or
 * `describeRefusal(id, spec, () => { it('x', () => { expect(plan) }) })` (an
 * `expect(...)` with no matcher chained on, a no-op in Vitest). Requiring a
 * real `it(` AND an `expect(...)` immediately followed by `.` closes all
 * three: an empty suite, a suite whose only `it` is a no-op, and a suite
 * whose only `expect` carries no matcher, are none of them counted as
 * coverage, so the rule id stays "uncovered" and must stay in
 * `REFUSAL_FIXTURE_BACKLOG` until a real fixture is written.
 */
function registersATest(source: string, start: number, end: number): boolean {
  const body = source.slice(start, end)
  if (!/\bit\(\s*['"`]/u.test(body)) return false
  for (const match of body.matchAll(/\bexpect\(/gu)) {
    if (isChainedExpect(body, match.index)) return true
  }
  return false
}

const claimedRuleIds = new Map<string, string[]>()
// `describeRefusal` is scanned separately rather than folded into the regex
// above. The two helpers make different claims - a discriminating computed
// value against a typed refusal - and merging them would let a refusal fixture
// satisfy the settled/unsettled/approximated coverage tests, which is the one
// substitution neither classification can afford.
const claimedRefusalRuleIds = new Map<string, string[]>()
for (const [path, rawSource] of Object.entries(testSources)) {
  if (path.endsWith(CONFORMANCE_SOURCE)) continue
  const source = stripComments(rawSource as string)
  for (const match of source.matchAll(/describeRule\(\s*'([^']+)'/gu)) {
    const ruleId = match[1]!
    claimedRuleIds.set(ruleId, [...(claimedRuleIds.get(ruleId) ?? []), path])
  }
  for (const match of source.matchAll(/describeRefusal\(\s*'([^']+)'/gu)) {
    const ruleId = match[1]!
    const start = match.index ?? 0
    const end = callEnd(source, start)
    // A call whose suite body registers no `it(` test is not coverage: leave
    // it out of claimedRefusalRuleIds so the id stays "uncovered" below.
    if (!registersATest(source, start, end)) continue
    claimedRefusalRuleIds.set(ruleId, [...(claimedRefusalRuleIds.get(ruleId) ?? []), path])
  }
}

/**
 * `outOfScope` rules that do not yet have a refusal fixture.
 *
 * A shrinking allowlist, not a permanent exemption. `describeRefusal` and the
 * coverage test below landed together with three fixtures, against 73 records
 * that claim the engine fails closed; authoring the rest is a program, not a
 * commit, and a coverage test that failed on all 70 from the first day would
 * have been deleted rather than worked off.
 *
 * The test asserts EQUALITY against this list rather than containment, so it
 * ratchets in both directions: authoring a fixture without deleting its id
 * fails, and deleting an id without authoring a fixture fails. A record
 * reclassified out of `outOfScope` has to leave here too.
 *
 * Not every entry can take a fixture as written. The classification covers two
 * shapes (see `TaxRuleClassification`): a rule the engine fails closed on, and
 * a rule whose triggering fact the input model cannot express at all, so no
 * accepted input ever reaches it. The second kind has no refusal to drive, and
 * `wa-rcw-82-87-capital-gains-excise` says so in its own statement - the state
 * tax path emits zero and continues, with no refusal naming the missing levy.
 * Working the list will therefore mean reclassifying some of these rather than
 * fixturing them, which is itself the point of looking at all 70.
 */
const REFUSAL_FIXTURE_BACKLOG: readonly string[] = [
    'al-form40-cost-recovery-not-modeled',
    'al-form40-railroad-retirement-not-modeled',
    'cfr-20-404-1584-blind-sga-monthly-amount',
    'cfr-20-404-1592b-expedited-reinstatement',
    'cfr-20-404-640-application-withdrawal-repayment',
    'cfr-20-418-1205-1230-irmaa-life-change-redetermination',
    'cfr-31-363-52-savings-bond-annual-purchase-limit',
    'irc-135-education-savings-bond-interest-exclusion',
    'irc-1400z-2-qof-deferral-and-ten-year-basis-election',
    'irc-162-l-1-self-employed-health-insurance-not-modeled',
    'irc-170-b-1-C-capital-gain-property-ceiling-not-modeled',
    'irc-171-tips-bond-premium-amortization',
    'irc-199A-a-qualified-business-income-deduction-not-modeled',
    'irc-2010-c-3-basic-exclusion-amount-not-modeled',
    'irc-2010-c-5-dsue-portability-election-not-modeled',
    'irc-213-d-10-eligible-ltc-premium-caps-2026',
    'irc-223-b-7-medicare-part-a-retroactive-entitlement',
    'irc-223-f-4-B-hsa-death-exception',
    'irc-2503-b-annual-gift-exclusion-not-modeled',
    'irc-401-k-11-simple-401-k-elective-deferral-limit',
    'irc-401-m-employee-contribution-mega-backdoor-roth-not-modeled',
    'irc-402-e-4-B-lump-sum-employer-securities-nua-exclusion',
    'irc-402-g-2-excess-elective-deferral-correction',
    'irc-402-g-7-403b-15-year-catch-up',
    'irc-402A-c-4-E-in-plan-roth-transfer-not-modeled',
    'irc-402A-e-1-A-plesa-optional-designated-roth-subaccount',
    'irc-402A-e-3-A-plesa-participant-contribution-cap',
    'irc-402A-e-7-B-i-plesa-distribution-qualified-roth-treatment',
    'irc-404-a-3-a-employer-deduction-limit',
    'irc-408-p-2-E-i-II-simple-enhanced-elective-deferral-election',
    'irc-411-a-2-vesting-schedule-maximums',
    'irc-414-v-7-402-g-7-403b-15-year-catch-up-exclusion',
    'irc-454-savings-bond-interest-deferral',
    'irc-457-b-3-final-three-year-catch-up',
    'irc-4966-d-donor-advised-fund-vehicle-not-modeled',
    'irc-529-c-3-E-529-to-roth-rollover-not-modeled',
    'irc-6433-a-1-savers-match-qualified-retirement-savings-contributions',
    'irc-6433-f-6-savers-match-early-distribution-recovery-tax',
    'irc-664-charitable-remainder-trust-payout-and-character-mechanics-not-modeled',
    'irc-72-t-1-qualified-retirement-plan-scope',
    'irc-72-t-2-J-plesa-withdrawal-early-distribution-exception',
    'irc-72-t-4-sepp-modification-recapture',
    'irc-7520-and-2522-split-interest-valuation-not-modeled',
    'irs-notice-2014-54-employer-plan-after-tax-rollover-allocation',
    'notice-2022-6-3-02-e-modification-trigger-detection',
    'notice-2022-6-3-03-b-one-time-method-change',
    'pl-118-273-sec-2-3-wep-gpo-repeal',
    'rev-rul-2008-5-ira-wash-sale-permanent-loss-disallowance',
    'treas-reg-1-1275-7-f-2-deflation-basis-decrease-not-modeled',
    'treas-reg-1-1275-7-f-3-tips-acquisition-premium',
    'usc-42-1395p-enrollment-periods',
    'usc-42-1395r-b-part-b-late-enrollment-penalty',
    'usc-42-1395w-113-b-pl-117-169-part-d-penalty-and-cost-sharing',
    'usc-42-402-d-2-child-survivor-benefit',
    'usc-42-402-d-2-ssdi-child-auxiliary',
    'usc-42-402-e-1-a-current-survivor-remarriage-before-60',
    'usc-42-402-e-1-b-ii-cfr-20-404-335-disabled-widow-age-50-prescribed-period',
    'usc-42-402-i-lump-sum-death-payment',
    'usc-42-402-r-survivor-deemed-filing-exemption',
    'usc-42-426-b-disability-trial-work-medicare-continuation',
    'wa-rcw-82-87-capital-gains-excise',
]

/**
 * Structural symbol table per file, shared with the coverage manifest's
 * deep-link line resolution (symbolLines.ts) so the set of names this guard
 * admits and the set of names the manifest can anchor are one implementation.
 * The synthetic probes below therefore guard both consumers.
 */
const declaredSymbolCache = new Map<string, ReadonlyMap<string, DeclaredSymbol>>()

function declaredSymbolsOf(globKey: string, source: string): ReadonlyMap<string, DeclaredSymbol> {
  const cached = declaredSymbolCache.get(globKey)
  if (cached !== undefined) return cached
  const lines = declaredSymbolLinesOf(globKey, source)
  declaredSymbolCache.set(globKey, lines)
  return lines
}

/**
 * Glob keys are relative to this directory; registry paths are repo-relative.
 * Vite emits same-directory files as `./name`, not `../rules/name`, so both
 * folds are needed or a pin under src/rules/ would be invisible here.
 */
const engineGlobKeyOf = (repoPath: string): string =>
  repoPath.replace(/^packages\/engine\/src\/rules\//u, './').replace(/^packages\/engine\/src\//u, '../')

const engineSourcePaths = new Set(
  Object.keys(engineSources).map((path) =>
    path.replace(/^\.\.\//u, 'packages/engine/src/').replace(/^\.\//u, 'packages/engine/src/rules/'),
  ),
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
  'ssa.gov', // The Social Security Act and ssa.gov publications
  // POMS is served only from this subdomain, so it is listed deliberately per
  // the subdomain rule above rather than folded into the bare host.
  'secure.ssa.gov', // POMS
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
  //
  // Every host below is a legislature, a code publisher, or a revenue
  // department — never a state's general www portal. Pennsylvania is where that
  // line had to be drawn on purpose. The Department of Revenue moved its
  // Personal Income Tax Guide off revenue.pa.gov onto www.pa.gov/agencies/
  // revenue/..., so citing the Guide would mean admitting the bare publisher
  // `pa.gov`, and `pa.gov` is the whole executive branch: labor, transportation,
  // health, and everything else Pennsylvania publishes would become admissible
  // authority for a Pennsylvania tax record. That is not a narrower version of
  // the ND precedent, it is the opposite of it — the tier exists to name the
  // publisher that speaks for the tax, and a state portal names no publisher at
  // all. Nor is a host under active reorganisation a good thing to pin a
  // citation to.
  //
  // So Pennsylvania is sourced to the Pennsylvania Code instead. Both PA records
  // rest on 61 Pa. Code § 101.6 and § 103.13, which carry the operative language
  // the Guide restates, are the Department's own regulations rather than its
  // summary of them, and have a `kind` this registry can label honestly —
  // `regulation`.
  //
  // `TaxRuleAuthorityKind` has since gained `stateAgencyPublication`, and that
  // does NOT reopen the Pennsylvania question. The kind names what a citation
  // IS; this table names which publisher it may come FROM, and the two guards
  // are independent. Pennsylvania still has a regulation carrying the operative
  // language, so it still has no need to cite a department summary, and the
  // reason `pa.gov` stays out is unchanged: it is the whole executive branch.
  // What the new kind changed is the states where no such regulation exists —
  // see the SD, TN and WY entries below, each of which had to admit a publisher
  // deliberately because the negative it registers has no code section to quote.
  // Added 2026-08-05 with the remaining no-individual-income-tax states. Each
  // host below was fetched and confirmed to serve the text the record quotes,
  // which for these states is not a formality: the claim being registered is an
  // absence, so the publisher IS the authority rather than a convenient copy of
  // a statute that exists elsewhere.
  AK: [
    // Alaska Legislature, Alaska Statutes. Chapter 43.20 text is served only by
    // the print-fetch endpoint; the practitioner URL returns a shell.
    'akleg.gov',
  ],
  AL: [
    // Verified 2026-08-28 against the staged Form 40 booklet PDF and the
    // Department of Revenue individual-income-tax page. Alabama's Code host
    // does not supply quote-verifiable operative text for these limbs; the
    // Department's own booklet and agency page are deliberately admitted as
    // the primary publishers — the same form-instruction / agency-publication
    // boundary used for Georgia, Oklahoma, and Utah where script-rendered
    // code pages cannot carry the quote.
    //
    // Bare `revenue.alabama.gov`: usable document URLs carry
    // `www.revenue.alabama.gov`, and `hostAndPublisherOf` strips the prefix.
    'revenue.alabama.gov', // Alabama Department of Revenue
  ],
  AR: [
    // Verified 2026-08-05. Arkansas is the state where "primary source" cannot
    // mean the codified statute: the Arkansas Code and Constitution of 1874 is
    // published by LexisNexis under contract, arkleg links out to
    // advance.lexis.com for it, and that host is commercial, JavaScript-only,
    // and unreadable to any verifier. So the operative statutory text comes
    // from ENROLLED ACTS on the legislature's own host, which print the amended
    // section in full, and the operative dollar amounts come from DFA, which is
    // the only publisher of the indexed schedules 26-51-201(d)(1) and
    // 26-51-430(c) require. Neither host is decorative.
    //
    // Two document-URL traps, recorded because both fail with HTTP 200 rather
    // than a 404: an act URL of the form /Acts/FTPDocument?...&file=ACT<N>.pdf
    // returns a zero-byte body, and sessions before about 2016 are reachable
    // only through /Acts/FTPDocument?...&file=<N>.pdf while later ones want
    // /Home/FTPDocument?path=...ACT<N>.pdf.
    'arkleg.state.ar.us', // Arkansas General Assembly: enrolled acts, session laws
    // Recorded bare, like ND's tax.nd.gov and for the same reason: every usable
    // document URL carries `www.dfa.arkansas.gov` (the bare host answers 301 to
    // it) and `hostAndPublisherOf` strips a leading `www.` before comparing, so
    // the bare entry admits both spellings. That normalisation is pinned by the
    // North Dakota test below, which exercises the identical shape.
    'dfa.arkansas.gov', // Department of Finance and Administration, Revenue Division
  ],
  AZ: [
    // Verified 2026-08-05. The mirror image of the North Dakota host handling:
    // azleg serves both `azleg.gov` and `www.azleg.gov` directly with no
    // redirect either way, and `www.azdor.gov` answers 301 to the BARE
    // `azdor.gov`, which is the host every AZDOR document URL carries. The
    // entries below are the bare canonical publishers only; a `www.` citation
    // still matches because `hostAndPublisherOf` strips the prefix, so no
    // `www.` variant is (or should be) listed here.
    //
    // The trap on azleg is not the host but the path. A.R.S. 43-1011 exists in
    // two published versions, and /ars/43/01011.htm — the URL any reasonable
    // citation would use — stops at the 2019-2021 graduated schedule and does
    // NOT contain the 2.5% flat rate. Only /ars/43/01011.01.htm does. A guard
    // that checks host and status would accept the wrong page for the single
    // most important Arizona claim in the pack.
    'azleg.gov', // Arizona Legislature, Arizona Revised Statutes
    'azdor.gov', // Arizona Department of Revenue: forms and instructions
  ],
  CA: [
    'leginfo.legislature.ca.gov', // California Legislative Information, Revenue and Taxation Code
  ],
  CO: [
    'olls.info', // Colorado Office of Legislative Legal Services, Colorado Revised Statutes
  ],
  CT: [
    'cga.ct.gov', // Connecticut General Assembly, General Statutes
  ],
  DE: [
    'delcode.delaware.gov', // Delaware Code Online, Title 30
  ],
  DC: [
    'code.dccouncil.gov', // Council of the District of Columbia, Code of the District of Columbia
  ],
  FL: [
    'flsenate.gov', // Florida Senate: the Constitution and the Florida Statutes
    // Office of Economic and Demographic Research — the Legislature's own
    // research office, and the publisher of the Florida Tax Handbook. Its own
    // host rather than a state portal: `edr.state.fl.us` names one office.
    'edr.state.fl.us',
  ],
  GA: [
    // Georgia's Code host renders its provisions client-side, so it cannot
    // provide a quote-verifiable statute. The Department of Revenue's own
    // retirement-exclusion page and IT-511 booklet instead supply the
    // operative filing instruction and worksheet the records quote. This is a
    // deliberate agency-publication admission, not a shortcut around a usable
    // code publisher; it follows the SD/TN/WY no-verifiable-code precedent.
    'dor.georgia.gov', // Georgia Department of Revenue
  ],
  HI: [
    'files.hawaii.gov', // Hawaii Department of Taxation, HRS compilation
  ],
  IA: [
    'legis.iowa.gov', // Iowa Legislature, Iowa Code
  ],
  ID: [
    'legislature.idaho.gov', // Idaho Legislature, Idaho Code
  ],
  IL: [
    'ilga.gov', // Illinois General Assembly, Illinois Compiled Statutes
  ],
  IN: [
    // Verified 2026-08-05, and the only state here needing THREE entries.
    //
    // `iga.in.gov` carries the Indiana Code, but not where a citation would
    // look for it: `/laws/{year}/ic/titles/6/...` is a client-side route with
    // no server-rendered text at all, and the machine-readable Code is at
    // `/ic/{year}/Title_{n}/Article_{a}/Chapter_{c}.pdf`, a pattern that
    // appears nowhere on the site. The host also serves a 691-byte React shell
    // to any client without a browser User-Agent — every path, `/api/*`
    // included — so a fetcher trusting HTTP 200 records an empty document as
    // "the statute". Both traps fail silently, which is why they are recorded
    // here and not only in the research file.
    'iga.in.gov', // Indiana General Assembly, Indiana Code
    // The entry nobody would guess. Indiana DOR's form index page is on
    // in.gov, but every form link on it points at a different registrable
    // host, and the forms are the operative instruction source for the
    // military deduction and the exemptions.
    'forms.in.gov', // Indiana DOR forms and instruction booklets
    // And the uncomfortable one, admitted deliberately rather than by
    // oversight: `in.gov` is a shared executive portal, which is the shape
    // refused for Pennsylvania a few entries above. Three things distinguish
    // it. Indiana DOR publishes its departmental notices and information
    // bulletins under `www.in.gov/dor/files/` and NOWHERE else, so unlike
    // Pennsylvania there is no narrower host to prefer and no Indiana
    // regulation carrying the same language. IC 6-3-2-1(e) names Departmental
    // Notice #1 as the vehicle by which the department must publish each
    // even-numbered year's rate, so that document is statutorily designated
    // rather than merely convenient. And the claim it is cited for — that a
    // county levy attaches to every Indiana resident — has no code section
    // stating it, which is precisely the case `stateAgencyPublication` exists
    // for. What this cannot do is narrow to `/dor/files/`: the table holds
    // hosts, not paths. That cost is real and is stated rather than glossed.
    'in.gov', // Indiana DOR departmental notices and information bulletins
  ],
  KS: [
    'ksrevisor.gov', // Kansas Revisor of Statutes, Kansas Statutes Annotated
  ],
  NM: [
    // Verified 2026-08-27 against the staged Batch C fetches. New Mexico
    // Taxation and Revenue Department: the Social Security
    // exemption page is the operative state publication staged for this
    // record; the statutes index itself is only an index/shell.
    'tax.newmexico.gov',
  ],
  NC: [
    // Verified 2026-08-27 against the staged North Carolina General Statute.
    'ncleg.gov', // North Carolina General Assembly
  ],
  OH: [
    // Verified 2026-08-27 against the staged Ohio Revised Code sections.
    'codes.ohio.gov', // Ohio Revised Code
  ],
  OK: [
    // Verified 2026-08-27 against the staged Oklahoma Tax Commission Form
    // 511 packet. BLOCKED-SOURCE: the Oklahoma Legislature Title 68 page
    // carries an ASP.NET/navigation shell but no quotable statute text, so the
    // Tax Commission's official packet is the deliberately admitted primary
    // publisher for this record.
    'oklahoma.gov',
  ],
  OR: [
    // Verified 2026-08-27 against the staged ORS fetch; the OR-17 PDF is
    // corroborating material but is not cited from the broad oregon.gov host.
    'oregonlegislature.gov', // Oregon Revised Statutes
  ],
  RI: [
    // Verified 2026-08-27 against the staged Rhode Island statutes.
    // Rhode Island publishes the statutes from this webserver subdomain; the
    // host is listed exactly because only a leading `www.` is normalized.
    'webserver.rilegislature.gov',
  ],
  UT: [
    // Verified 2026-08-27 against the staged Utah State Tax Commission pages.
    // BLOCKED-SOURCE: le.utah.gov's xcode pages carry a script-rendered
    // heading/navigation shell but no operative section text; the Commission's
    // own incometax.utah.gov publication carries the operative instructions.
    // BLOCKED-SOURCE: the staged incometax.utah.gov Social Security-credit URL
    // is a 404 page; the TC-40A page is the operative credit source.
    'incometax.utah.gov',
  ],
  VA: [
    // Verified 2026-08-27 against the staged Virginia Code page.
    'law.lis.virginia.gov', // Virginia Code, Legislative Information System
  ],
  VT: [
    // Verified 2026-08-27 against the staged Vermont statutes and DOR page.
    'legislature.vermont.gov', // Vermont Statutes Online
    'tax.vermont.gov', // Vermont Department of Taxes guidance
  ],
  WA: [
    // Verified 2026-08-27 against the staged DOR and RCW pages.
    'dor.wa.gov', // Washington Department of Revenue
    'app.leg.wa.gov', // Revised Code of Washington
  ],
  WI: [
    // Verified 2026-08-27 against the staged Schedule SB and rates page.
    'revenue.wi.gov', // Wisconsin Department of Revenue forms and instructions
  ],
  KY: [
    // Verified 2026-08-27 from the staged KRS section PDFs. Kentucky serves
    // each section as a PDF at `statute.aspx?id=…` on this apps subdomain —
    // the chapter TOC page is only catchlines. The subdomain is listed
    // deliberately: this table strips only a leading `www.`, so the apex
    // `legislature.ky.gov` would admit nothing that was checked.
    'apps.legislature.ky.gov', // Kentucky Legislative Research Commission, KRS
  ],
  // Verified 2026-08-27 from the staged WS4d-B fetches. Bare `legis.la.gov`:
  // every usable Law.aspx URL carries `www.legis.la.gov`, and
  // `hostAndPublisherOf` strips a leading `www.` before comparing.
  LA: [
    'legis.la.gov', // Louisiana State Legislature, Louisiana Revised Statutes
  ],
  // Verified 2026-08-27 from the staged WS4d-B fetches.
  MA: [
    'malegislature.gov', // General Court of the Commonwealth, General Laws
  ],
  MD: [
    // The 2026 compilation of Tax-General §10-207 is served as a PDF from
    // this host (SS record). The HTML StatuteText page for §10-209 is the
    // source the pension-cap record quotes; same publisher.
    'mgaleg.maryland.gov', // Maryland General Assembly, Maryland Code
  ],
  MI: [
    // Bare `legislature.mi.gov`: usable MCL URLs carry `www.legislature.mi.gov`.
    'legislature.mi.gov', // Michigan Legislature, Michigan Compiled Laws
  ],
  MN: [
    'revisor.mn.gov', // Office of the Revisor of Statutes, Minnesota Statutes
  ],
  MT: [
    // Verified 2026-08-29. `mca.legmt.gov` serves the current Montana Code
    // Annotated (2025 compilation; `archive.legmt.gov` section URLs now 301
    // there), which unblocked the 2026-08-27 BLOCKED-SOURCE residual and
    // carries the operative 15-30-2101/2120 text plus the 15-30-2110 repeal
    // line. `revenue.mt.gov` is the department's 2026 withholding notice,
    // admitted because that notice is the source for the federal
    // standard-deduction effect on Montana taxable income. Subdomains are
    // listed deliberately: this table strips only a leading `www.`, so the
    // apex would admit nothing that was checked.
    'mca.legmt.gov', // Montana Legislative Services, current Montana Code Annotated
    'revenue.mt.gov', // Montana Department of Revenue
  ],
  NE: [
    // Verified 2026-08-27. Bare `nebraskalegislature.gov`: usable statute
    // URLs carry `www.nebraskalegislature.gov`.
    'nebraskalegislature.gov', // Nebraska Legislature, Nebraska Revised Statutes
  ],
  NH: [
    // Verified 2026-08-27 from the staged RSA Chapter 77 repeal page. The
    // General Court's RSA publisher is admitted deliberately: the claim is
    // that the Taxation of Incomes chapter is gone, and this host is the
    // one that prints the repeal. `revenue.nh.gov` was the plan's DOR
    // host; the staged DOR fetch was Access Denied, so it is not listed.
    // The `www.` alias is folded by `hostAndPublisherOf`; the subdomain
    // is not.
    'gencourt.state.nh.us', // New Hampshire General Court, Revised Statutes Annotated
  ],
  NJ: [
    // Verified 2026-08-27. P.L.2021, c.129 is served from this host as the
    // enrolled act that reprints N.J.S.A. 54A:6-10 in full. `nj.gov` is NOT
    // listed: it is the whole executive branch, the shape refused for
    // `pa.gov`. The Treasury topic page restates the same exclusion; the
    // enrolled act is the operative language and has a narrower publisher.
    'pub.njleg.gov', // New Jersey Legislature, public laws
  ],
  ME: [
    'legislature.maine.gov', // Office of the Revisor of Statutes, Maine Revised Statutes
  ],
  MO: [
    'revisor.mo.gov', // Missouri Revisor of Statutes
  ],
  MS: [
    // Verified 2026-08-05. Mississippi is the second state, after Arkansas,
    // where "primary source" cannot mean the codified statute: the Mississippi
    // Code is published by LexisNexis under contract, legislature.ms.gov's only
    // link to it is `lexisnexis.com/hottopics/mscode/`, and that redirects into
    // a cookie-and-JavaScript session app on advance.lexis.com serving no text
    // to a verifier. The statutory language therefore comes from BILLS, which
    // reprint the affected section in full — preferring one that BRINGS a
    // section FORWARD, since that prints it unmarked, over one that amends it,
    // where the strike-through and underline markup interleaves.
    'billstatus.ls.state.ms.us', // Mississippi Legislature bill status: bill text as introduced and enrolled
    // The department, for the 2026 rate, the forms and the FAQ. Its form
    // filenames contain SPACES, so a citation must keep the `%20`.
    'dor.ms.gov', // Mississippi Department of Revenue
    //
    // NOT listed, and the omission is the point: `sos.ms.gov` publishes Title
    // 35, Part III of the Mississippi Administrative Code — the department's
    // own income tax regulations — and returns HTTP 403 to every non-browser
    // client, with a browser User-Agent, with a Referer from the linking DOR
    // page, over http, and on the apex domain alike. No Mississippi record can
    // rest on regulation authority until someone pulls that PDF with a real
    // browser, which matters most for `ms-early-or-excess-distribution-not-exempt`.
  ],
  ND: [
    // Re-checked 2026-08-05, when the second slice of North Dakota records was
    // written, because North Dakota is the state whose entry has to carry real
    // weight: the Century Code prints only the 2023 statutory bracket amounts,
    // N.D.C.C. 57-38-30.3(1)(g) makes the commissioner's cost-of-living-adjusted
    // schedule apply in lieu of them, and the department is the sole publisher
    // of that schedule. Without this host the pack could not cite its own
    // bracket data at all.
    //
    // Recorded bare rather than as `www.tax.nd.gov`, which is the host every
    // usable document URL actually carries: `https://tax.nd.gov/...` answers
    // 301 to the `www.` form, and every form and instruction lives under
    // `www.tax.nd.gov/sites/www/files/...`. `hostAndPublisherOf` strips a
    // leading `www.` before comparing, so the bare entry admits both spellings
    // and adding the `www.` variant would be a second name for one publisher.
    // Pinned by a test below rather than left to be re-derived from the
    // stripping rule, since the failure mode is a conformance suite rejecting
    // the correct primary source.
    'tax.nd.gov', // Office of State Tax Commissioner
    'ndlegis.gov', // Century Code, Title 57 Taxation (ch. 57-38, Income Tax)
  ],
  NV: [
    'leg.state.nv.us', // Nevada Legislature: the Constitution and NRS
  ],
  NY: [
    'nysenate.gov', // New York State Senate, Consolidated Laws (Tax Law)
  ],
  PA: [
    'pacodeandbulletin.gov', // Pennsylvania Code and Bulletin (61 Pa. Code, Revenue)
  ],
  SC: [
    'scstatehouse.gov', // South Carolina Legislature, Code of Laws
  ],
  SD: [
    // South Dakota is the state where this table had to be built from what
    // exists rather than from what one would want. No .gov host serves South
    // Dakota Codified Laws to a non-browser client at all — every
    // sdlegislature.gov /Statutes/ path returns a Vue shell — so there is no
    // code publisher to admit, and the SD record rests on the two below.
    'dor.sd.gov', // Department of Revenue
    'sdsos.gov', // Secretary of State: the South Dakota Constitution
  ],
  TN: [
    // Secretary of State's publications server. A .com name for a state
    // publisher is unusual enough to say out loud: this is where Tennessee
    // publishes its constitution and its public acts, and sos.tn.gov links out
    // to it. It is admitted as the Secretary of State, not as a commercial
    // host, and as the `publications.` subdomain specifically: this table
    // strips only a leading `www.`, so the bare name would admit nothing and
    // the apex would admit more than was checked.
    'publications.tnsosfiles.com',
    // The Department of Revenue, and the one entry in this table that admits
    // more than its record needs. Tennessee's Hall-tax repeal has no other
    // citable publisher: Tennessee Code Unannotated is published through
    // LexisNexis, which is not a state host at all, and the two enrolled acts
    // that produced the repeal are scans whose OCR cannot be quoted. So the
    // department's own statement is the only usable authority, and it lives at
    // www.tn.gov/revenue/... — which means admitting `tn.gov`, the whole
    // executive branch, exactly as the Pennsylvania note above refused to do
    // for `pa.gov`.
    //
    // The difference is that Pennsylvania had an alternative and Tennessee does
    // not. 61 Pa. Code carries the operative language the PA Guide restates;
    // there is no Tennessee equivalent, because the thing being registered is a
    // repeal and a repealed chapter has no text. Admitting `tn.gov` is a real
    // cost recorded here rather than a line quietly crossed: it means a future
    // Tennessee record could be sourced to any Tennessee agency without this
    // table objecting, and reviewers of such a record should say so.
    'tn.gov',
  ],
  TX: [
    // Texas Legislative Council, which publishes the constitution as a dated
    // PDF. This replaced `statutes.capitol.texas.gov` on 2026-08-05: that host
    // is now a JavaScript application serving a 1,354-character shell to
    // anything that is not a browser, so a citation to it could never be
    // verified. It is REMOVED rather than left alongside, because a host in
    // this table reads as "checked and admissible" and that one is checked and
    // unusable.
    'tlc.texas.gov',
    // Texas Legislature Online, which serves enrolled bill and resolution text
    // as plain HTML. Cited where the compilation's page furniture falls inside
    // a provision — see sec. 24-b(b).
    'capitol.texas.gov',
  ],
  WV: [
    'code.wvlegislature.gov', // West Virginia Legislature, West Virginia Code
  ],
  WY: [
    'wyoleg.gov', // Wyoming Legislature, Wyoming Statutes (title 39)
    // Secretary of State, publisher of the Wyoming Constitution. The Department
    // of Revenue cannot serve here: revenue.wyo.gov is a Google Sites page
    // whose reports are Google Drive links, so Wyoming's tax agency publishes
    // nothing at a citable wyo.gov URL.
    'sos.wyo.gov',
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

/**
 * The part of a record the authority-kind guard reads. Separate from
 * `CitableRule` for the same reason that one is narrower than `TaxRuleRecord`:
 * the guard has to be exercisable against a synthetic record, and a synthetic
 * one written for the publisher tier has no business also carrying a `kind`.
 */
interface KindedRule {
  readonly jurisdiction: TaxRuleJurisdiction
  readonly authority: readonly { readonly citation: string, readonly kind: TaxRuleAuthorityKind }[]
}

/**
 * Authority kinds a rule of the given jurisdiction may NOT use.
 *
 * One entry today, and the mechanism is deliberately the same shape as the
 * publisher tier rather than a bare `if`. `stateAgencyPublication` names a state
 * revenue department's or state legislature's own statement of its state's law.
 * That is authority for the state that published it and for nothing else, so a
 * federal record carrying it would be an assertion about the Internal Revenue
 * Code resting on a body with no power over it — the same erosion the publisher
 * tier prevents one layer down, and one the URL check cannot catch on its own.
 * A federal record could cite an admissible federal URL and still label it a
 * state agency statement, or a state record could be flipped to `federal` while
 * its citations were left alone.
 */
const JURISDICTION_INADMISSIBLE_KINDS: readonly TaxRuleAuthorityKind[] = ['stateAgencyPublication']

/** Authorities whose kind their rule's jurisdiction cannot use. */
function offJurisdictionAuthorityKinds(
  entries: readonly (readonly [string, KindedRule])[],
): readonly string[] {
  const offKind: string[] = []
  for (const [ruleId, rule] of entries) {
    if (rule.jurisdiction !== 'federal') continue
    for (const authority of rule.authority) {
      if (JURISDICTION_INADMISSIBLE_KINDS.includes(authority.kind)) {
        offKind.push(`${ruleId}:${authority.citation}:${authority.kind}`)
      }
    }
  }
  return offKind
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

/**
 * Where a state rule's state-specific behaviour has to live.
 *
 * `tax/stateTax.ts` is generic. It applies brackets, one retirement exclusion,
 * one standard deduction and a handful of flags in exactly the same way for all
 * fifty-one jurisdictions, and it cannot tell North Dakota from Nevada except
 * through the params it is handed. Everything that makes a state's treatment
 * that state's treatment is under `params/state/` — the pack entry, the pack
 * shape in `types.ts`, and the conformity indexer in `index.ts`.
 *
 * So a `state:` record whose `implementedBy` names nothing under that directory
 * is not merely under-documented, it is self-contradicting: it claims the engine
 * implements a state-specific rule in code that does not know which state it is,
 * and it sends a reader to a file that reads identically for every other state.
 * One record shipped that way and was caught in review rather than by a test,
 * which is what this exists to change.
 *
 * Deliberately the DIRECTORY and not `data/year2026.ts`. A new pack lands each
 * autumn, so pinning the filename would either fail on a rule first appearing in
 * a later pack or force a stale citation. It also leaves room for the two
 * legitimate non-data cases: a rule whose whole implementation is the conformity
 * indexer in `index.ts`, and an `outOfScope` rule whose point is that the pack
 * shape cannot express it — which is a fact about `types.ts`, and belongs there.
 *
 * What that costs, stated plainly: this cannot catch a trail that names SOME
 * file under `params/state/` and omits another that matters. A second review
 * finding was exactly that shape — a record naming `index.ts` for the conformity
 * indexer while omitting the pack entry that sets the tag it reads — and no
 * directory rule can see it. "Did you list every file that matters" is not
 * decidable; this guard answers the one part of the question that is.
 */
const STATE_IMPLEMENTATION_ROOT = 'packages/engine/src/params/state/'

interface ImplementedRule {
  readonly jurisdiction: TaxRuleJurisdiction
  readonly implementedBy: readonly string[]
}

/** State rules whose implementation trail stops at the generic calculator. */
function stateRulesMissingPackImplementation(
  entries: readonly (readonly [string, ImplementedRule])[],
): readonly string[] {
  return entries
    .filter(([, rule]) => rule.jurisdiction !== 'federal')
    .filter(([, rule]) => !rule.implementedBy.some((path) => path.startsWith(STATE_IMPLEMENTATION_ROOT)))
    .map(([ruleId]) => ruleId)
}

const registryEntries: readonly (readonly [string, CitableRule])[] =
  taxRuleIds.map((ruleId) => [ruleId, TAX_RULE_REGISTRY[ruleId]] as const)

const kindedEntries: readonly (readonly [string, KindedRule])[] =
  taxRuleIds.map((ruleId) => [ruleId, TAX_RULE_REGISTRY[ruleId]] as const)

const implementationEntries: readonly (readonly [string, ImplementedRule])[] =
  taxRuleIds.map((ruleId) => [ruleId, TAX_RULE_REGISTRY[ruleId]] as const)

/**
 * Every record module on disk, read from the source scan rather than from the
 * hand-kept list above. `engineSources` already holds every engine `.ts`, and
 * Vite emits this directory's children under either prefix, so both spellings
 * are matched for the same reason `engineGlobKeyOf` folds both.
 */
const RECORD_MODULE_FILE = /^(?:\.\.\/rules|\.)\/records\/([^/]+)\.ts$/u

const recordModuleFileNames = Object.keys(engineSources)
  .map((path) => RECORD_MODULE_FILE.exec(path)?.[1])
  .filter((name): name is string => name !== undefined)
  .sort()

describe('tax rule registry conformance', () => {
  it('accounts for every record module on disk, so an orphan cannot hide', () => {
    // The key-count guard below sums RECORD_MODULES, a hand-kept list, against
    // the registry. A new records/*.ts that is written but added to NEITHER the
    // list nor the registry spread satisfies that sum trivially — its keys are
    // on neither side — and nothing else sees it: the coverage attestation for
    // the file only has to exist, and `isRecordStore` in
    // coverageAttestations.conformance.test.ts exempts every records/*.ts from
    // the implementedBy check. So the directory itself is the authority here,
    // and the list has to account for all of it — including a stray
    // records/*.test.ts, which would otherwise be invisible to this guard and
    // exempt from attestation checking at once. A glob prefix that stopped
    // matching would empty the left side and fail this too, rather than pass
    // vacuously.
    expect(recordModuleFileNames).toEqual([...RECORD_MODULES.map(([name]) => name)].sort())
  })

  it('keeps the registry\'s published module list identical to this one', () => {
    // `TAX_RULE_RECORD_MODULES` ships beside the spread so the tooling can shard
    // the coverage ledger and narrow the dispatch lock by module. It is a THIRD
    // hand-kept copy of the same list, so it is pinned to the one above — which
    // the directory guard has already checked against `records/` on disk — by
    // name and by record-object identity. A module added to the registry export
    // but not to the spread (or pointed at the wrong records object) would
    // otherwise publish a shard that no longer matches what the registry holds.
    expect([...TAX_RULE_RECORD_MODULES].map(([name]) => name).sort())
      .toEqual([...RECORD_MODULES.map(([name]) => name)].sort())
    const publishedByName = new Map(TAX_RULE_RECORD_MODULES.map(([name, records]) => [name, records]))
    for (const [name, records] of RECORD_MODULES) {
      expect(publishedByName.get(name), name).toBe(records)
    }
  })

  it('registers each rule id in exactly one record module', () => {
    // Object spread lets a later duplicate key overwrite an earlier one, and
    // the losing record then vanishes from TAX_RULE_REGISTRY with no compile
    // error and nothing naming it. Counting keys module by module catches that:
    // if two modules register the same id, the parts sum to more than the whole.
    const perModule = RECORD_MODULES.map(([name, records]) => [name, Object.keys(records).length] as const)
    const total = perModule.reduce((sum, [, count]) => sum + count, 0)
    expect({ total, perModule }).toEqual({ total: taxRuleIds.length, perModule })
  })

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

  it('covers every outOfScope rule with a refusal fixture', () => {
    // The classification with no coverage obligation at all until now: a slice
    // of the registry (73 of 416 records, under a fifth) that says "we will
    // not answer this". An outOfScope
    // record claims the engine fails closed with a typed refusal; nothing
    // checked that the refusal existed, still existed, or still had the shape
    // the record describes. That is the same rot `produced` was invented to
    // stop on the approximated records, in the direction that reads as the most
    // responsible: "we refuse this" keeps sounding careful long after the
    // refusal was replaced by a number, or deleted.
    //
    // Equality against the backlog, not containment, so the list can only
    // shrink deliberately: see REFUSAL_FIXTURE_BACKLOG.
    const uncovered = taxRuleIds.filter((ruleId) =>
      TAX_RULE_REGISTRY[ruleId].classification === 'outOfScope' && !claimedRefusalRuleIds.has(ruleId))
    expect([...uncovered].sort()).toEqual([...REFUSAL_FIXTURE_BACKLOG].sort())
  })

  it('keeps the refusal backlog to real, still-outOfScope rules', () => {
    // A backlog entry that is not a registry key, or no longer outOfScope, is
    // an allowlist that has stopped describing anything - the failure mode of
    // every hand-kept exemption list. Both are caught here rather than showing
    // up as a confusing diff in the equality assertion above.
    const stale = REFUSAL_FIXTURE_BACKLOG.filter(
      (ruleId) =>
        !(ruleId in TAX_RULE_REGISTRY) ||
        TAX_RULE_REGISTRY[ruleId as TaxRuleId].classification !== 'outOfScope',
    )
    expect(stale).toEqual([])
    expect(new Set(REFUSAL_FIXTURE_BACKLOG).size).toBe(REFUSAL_FIXTURE_BACKLOG.length)
  })

  it('never lets a refusal fixture stand in for a computed-value fixture', () => {
    // describeRefusal only accepts an outOfScope id, so this can only break by
    // someone widening the describeRule scan to swallow both call shapes.
    for (const ruleId of claimedRefusalRuleIds.keys()) {
      expect(ruleId in TAX_RULE_REGISTRY, ruleId).toBe(true)
      expect(TAX_RULE_REGISTRY[ruleId as TaxRuleId].classification, ruleId).toBe('outOfScope')
      expect(claimedRuleIds.has(ruleId), ruleId).toBe(false)
    }
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
    for (const [, paths] of [...claimedRuleIds, ...claimedRefusalRuleIds]) {
      expect(paths.every((path) => !path.endsWith(CONFORMANCE_SOURCE))).toBe(true)
    }
  })

  it('rejects prose that cites a rule id the registry does not have', () => {
    // THE CLASS THIS KILLS. A record id written into a docblock is a promise
    // that the reader can go and find the record. Nothing checked it, so this
    // slice shipped five comments and two type docs pointing at
    // `engine-convention-ira-annuity-contract-value-premium-less-payments`,
    // which was never a registry key -- the record it meant is registered under
    // its authority, as every id here is. A reader who followed any of the five
    // would have concluded the convention was unregistered, which is exactly
    // the impression an unregistered convention is supposed to give.
    //
    // TWO RULES, BOTH ZERO-FALSE-POSITIVE ON THE CURRENT TREE, and the reason
    // there are two is that neither alone catches enough. The first is the
    // house convention made checkable: record ids are anchored on their
    // authority, so a backticked kebab token whose first segment is one this
    // registry actually uses -- `irc`, `treas`, `usc`, `cfr`, `notice`, a state
    // code -- is claiming to be a record and had better be one. The second
    // catches the phrasing that produced the bug: whatever follows "registered
    // as" is a citation whatever it looks like.
    //
    // WHAT THEY DO NOT CATCH, stated so the arm is not read as a proof. An id
    // that is neither authority-prefixed nor introduced by "registered as"
    // slips both -- the original phantom would have slipped the first, and was
    // caught by the second only because four of its five sites used that
    // phrase. The kebab-case vocabulary in this engine is not all record ids:
    // disposition reason codes (`conversion-source-owner-mismatch`,
    // `withdrawal-source-type-unsupported`) share the shape, which is why a
    // blanket "every kebab token must be a key" rule was measured, found to
    // flag thirteen legitimate codes, and rejected in favour of these two.
    const registryPrefixes = new Set(
      taxRuleIds.map((ruleId) => ruleId.split('-')[0]!),
    )
    // A token that looks like an authority-anchored record id: kebab, four
    // segments or more, so a two-word hyphenation cannot trip it. The character
    // class is deliberately NOT lowercase-only -- this family numbers its
    // subparagraphs the way the Code does, `irc-408-d-2-C` and
    // `irc-408-d-8-D`, and a lowercase-only pattern was blind to sixty-seven of
    // the registry's own keys when this arm was first written.
    const authorityShaped = /`([A-Za-z0-9]+(?:-[A-Za-z0-9]+){3,})`/gu
    // "registered as `x`", "Registered, with its direction, as `x`" -- comment
    // decoration between the phrase and the token is allowed, prose is not.
    const citedAsRegistered =
      /[Rr]egistered(?:,[^`]{0,80})? as[\s*/]*`([A-Za-z0-9][A-Za-z0-9-]*)`/gu
    // A bare section reference is not a dangling citation. `irc-408-d-2-C` is
    // the subparagraph two records are anchored on, and prose that names it is
    // pointing at the statute rather than at a record, so a token that is a
    // strict prefix of some key is admitted.
    const isSectionReference = (cited: string): boolean =>
      taxRuleIds.some((ruleId) => ruleId.startsWith(`${cited}-`))
    const dangling: string[] = []
    for (const [path, source] of Object.entries(engineSources)) {
      if (path.endsWith(CONFORMANCE_SOURCE)) continue
      const text = source as string
      for (const match of text.matchAll(authorityShaped)) {
        const cited = match[1]!
        if (!registryPrefixes.has(cited.split('-')[0]!)) continue
        if (cited in TAX_RULE_REGISTRY || isSectionReference(cited)) continue
        dangling.push(`${path}: ${cited}`)
      }
      for (const match of text.matchAll(citedAsRegistered)) {
        const cited = match[1]!
        if (cited in TAX_RULE_REGISTRY || isSectionReference(cited)) continue
        dangling.push(`${path}: ${cited}`)
      }
    }
    expect([...new Set(dangling)].sort()).toEqual([])
  })

  it('admits module-scope symbols and refuses function locals, per a synthetic source', () => {
    // The guard itself is guarded: a table that regressed to admitting
    // locals (or dropping members) fails here on hand-written cases before
    // any live mapping could exploit it.
    const synthetic = [
      'export function outerCalculator(input: number): number {',
      '  const innerLocal = input * 2',
      '  return innerLocal',
      '}',
      'export const dataPack = {',
      '  states: {',
      '    ZZ: { leafField: 1 },',
      '  },',
      '}',
      'export interface ShapeType {',
      '  memberField: number',
      '}',
    ].join('\n')
    const symbols = declaredSymbolsOf('synthetic-guard-probe.ts', synthetic)
    expect(symbols.has('outerCalculator')).toBe(true)
    expect(symbols.has('dataPack')).toBe(true)
    expect(symbols.has('leafField')).toBe(true)
    expect(symbols.has('memberField')).toBe(true)
    expect(declaredSymbolsOf('synthetic-guard-probe-2.ts', 'export enum Kind { First } export class Box { set value(v: number) {} }').has('First')).toBe(true)
    expect(declaredSymbolsOf('synthetic-guard-probe-2.ts', 'export enum Kind { First } export class Box { set value(v: number) {} }').has('value')).toBe(true)
    expect(symbols.has('innerLocal')).toBe(false)
    expect(symbols.has('neverDeclaredAnywhere')).toBe(false)
  })

  it('anchors symbols per the two-tier line rule, on hand-counted synthetic lines', () => {
    // The published deep-link lines ride on this resolution, so the rule is
    // pinned by hand: module scope beats a same-named member, merged
    // module-scope declarations keep the first line, a unique member anchors
    // at its own line, a repeated member is refused until parent-qualified.
    const synthetic = [
      'interface Summary {', //                       line 1
      '  computeThing: number', //                    line 2: member tier
      '}',
      'export function computeThing(): number {', //  line 4: module tier wins
      '  return 1',
      '}',
      'export function overloaded(a: number): number', // line 7: first wins
      'export function overloaded(a: string): string',
      'export function overloaded(a: unknown): unknown {',
      '  return a',
      '}',
      'const pack = {', //                            line 12
      '  AZ: {', //                                   line 13
      '    rate: 1,', //                              line 14: member != parent line
      '    retirement: { cap: 10 },', //              line 15
      '  },',
      '  ND: {', //                                   line 17
      '    rate: 2,', //                              line 18
      '    retirement: { cap: 20 },', //              line 19
      '  },',
      '}',
      'export class Box {', //                        line 22
      '  get value(): number {', //                   line 23: get/set = one member
      '    return 1',
      '  }',
      '  set value(next: number) {}',
      '}',
    ].join('\n')
    const probe = 'synthetic-anchor-probe.ts'
    const table = declaredSymbolsOf(probe, synthetic)
    expect(symbolAnchorLine(table, probe, 'computeThing')).toBe(4)
    expect(symbolAnchorLine(table, probe, 'overloaded')).toBe(7)
    expect(symbolAnchorLine(table, probe, 'pack')).toBe(12)
    expect(symbolAnchorLine(table, probe, 'AZ')).toBe(13)
    // The member anchors at ITS line, not its parent's - the parent sits on
    // a different line here precisely so a parent-line regression fails.
    expect(symbolAnchorLine(table, probe, 'AZ.rate')).toBe(14)
    expect(symbolAnchorLine(table, probe, 'ND.rate')).toBe(18)
    // Deep nesting qualifies through the ancestor chain: the immediate
    // parent alone (retirement.cap) is still ambiguous across states.
    expect(symbolAnchorLine(table, probe, 'AZ.retirement.cap')).toBe(15)
    expect(symbolAnchorLine(table, probe, 'ND.retirement.cap')).toBe(19)
    expect(() => symbolAnchorLine(table, probe, 'rate')).toThrow(/ambiguous/u)
    expect(() => symbolAnchorLine(table, probe, 'cap')).toThrow(/ambiguous/u)
    expect(() => symbolAnchorLine(table, probe, 'retirement.cap')).toThrow(/ambiguous/u)
    // A get/set pair is one logical member, not an ambiguity.
    expect(symbolAnchorLine(table, probe, 'Box.value')).toBe(23)
    expect(symbolAnchorLine(table, probe, 'value')).toBe(23)
    expect(() => symbolAnchorLine(table, probe, 'neverDeclaredAnywhere')).toThrow(/not a declared symbol/u)
    // Same-named members in DIFFERENT elements of one array are distinct
    // declarations: position separates their identity, so the name is
    // ambiguous rather than collapsed onto the first row's line.
    const rows = declaredSymbolsOf(
      'synthetic-array-probe.ts',
      'const rows = [\n  { rate: 1 },\n  { rate: 2 },\n]\n',
    )
    expect(() => symbolAnchorLine(rows, 'synthetic-array-probe.ts', 'rate')).toThrow(/ambiguous/u)
    expect(() => symbolAnchorLine(rows, 'synthetic-array-probe.ts', 'rows.rate')).toThrow(/ambiguous/u)
  })

  it('resolves every implementedByFunctions entry to a listed file and a live symbol', () => {
    // The transparency page renders these as the chain's deepest level; an
    // entry naming a renamed or deleted function must fail here, not rot
    // publicly. Violations accumulate so one failure cannot mask the rest.
    const violations: string[] = []
    for (const [ruleId, rule] of Object.entries(TAX_RULE_REGISTRY)) {
      const entries = rule.implementedByFunctions
      if (new Set(entries).size !== entries.length) {
        violations.push(`${ruleId}: implementedByFunctions carries duplicate entries`)
      }
      const pinnedPaths = new Set(entries.map((entry) => entry.split('#')[0]))
      for (const path of rule.implementedBy) {
        if (!pinnedPaths.has(path)) violations.push(`${ruleId}: ${path} is on the trail but carries no function pin`)
      }
      for (const entry of entries) {
        const parts = entry.split('#')
        if (parts.length !== 2 || parts[1]!.length === 0) {
          violations.push(`${ruleId}: ${entry} must be <path>#<symbol>`)
          continue
        }
        const [path, symbol] = parts as [string, string]
        if (!rule.implementedBy.includes(path)) {
          violations.push(`${ruleId}: ${entry} path must be in implementedBy`)
          continue
        }
        const globKey = engineGlobKeyOf(path)
        const source = engineSources[globKey] as string | undefined
        if (source === undefined) {
          violations.push(`${ruleId}: ${path} not found among engine sources`)
          continue
        }
        try {
          // Resolvability is the bar, not mere membership: the manifest
          // publishes this pin's anchor line, so an ambiguous member pin
          // (a repeated pack field) must fail here with the qualify hint.
          symbolAnchorLine(declaredSymbolsOf(globKey, source), path, symbol)
        } catch (error) {
          violations.push(`${ruleId}: ${error instanceof Error ? error.message : String(error)}`)
        }
      }
    }
    expect(violations).toEqual([])
  })

  it('assigns the legacy scalar QCD planner to its complete rule-owner set', () => {
    const helper =
      'packages/engine/src/projection/internal/annualLegacyQcdGiftPlan.ts#annualLegacyQcdGiftPlan'
    const actualOwners = Object.entries(TAX_RULE_REGISTRY)
      .filter(([, record]) => record.implementedByFunctions.includes(helper))
      .map(([ruleId]) => ruleId)

    // Hand-audited across the complete cross-domain registry. This boundary
    // owns stand-down, the annual age proxy, household attribution, and the
    // exact-cent sub-cent discharge; character and section-219 logic remain in
    // the already-registered owner-character boundary.
    expect(actualOwners).toEqual([
      'irc-408-d-8-A-named-qcd-limit-after-the-pack-year',
      'irc-408-d-8-B-ii-projection-annual-age-proxy',
      'irc-408-d-8-A-projection-household-qcd-aggregation',
      'treas-reg-1-408-8-projection-sub-cent-distribution-discharge',
    ])
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

  it('admits the www. spelling a state department actually serves', () => {
    // The North Dakota tier is recorded as the bare `tax.nd.gov`, but no
    // citation can carry that host: it answers 301 to `www.tax.nd.gov`, and
    // every form and instruction is published under the `www.` form. The
    // entry is only useful if the publisher comparison sees through that, so
    // assert it rather than infer it from `hostAndPublisherOf`.
    expect(offSourceAuthorities([['nd-fictional', {
      jurisdiction: 'state:ND',
      authority: [{
        citation: '2026 Forms ND-1 and ND-EZ Tax Rate Schedules',
        url: 'https://www.tax.nd.gov/sites/www/files/documents/forms/individual/2025-iit/28709-form-nd-1es-2026.pdf',
      }],
    }]])).toEqual([])
    // ...and it is still that state's own source, so it satisfies the
    // own-sovereign requirement on its own.
    expect(stateRulesMissingStateAuthority([['nd-fictional', {
      jurisdiction: 'state:ND',
      authority: [{
        citation: '2026 Forms ND-1 and ND-EZ Tax Rate Schedules',
        url: 'https://www.tax.nd.gov/sites/www/files/documents/forms/individual/2025-iit/28709-form-nd-1es-2026.pdf',
      }],
    }]])).toEqual([])
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

  it('refuses a state agency statement as authority for a federal rule', () => {
    // The kind half of the same asymmetry the publisher tier enforces on hosts.
    // A state revenue department may state what its own state levies; it cannot
    // state what the Internal Revenue Code requires, and a record that labelled
    // a citation `stateAgencyPublication` under `jurisdiction: 'federal'` would
    // be claiming exactly that. Asserted over the registry AND against a
    // synthetic pair, so the guard is provably live rather than vacuously
    // passing because no record happens to be shaped that way yet.
    expect(offJurisdictionAuthorityKinds(kindedEntries)).toEqual([])
    expect(offJurisdictionAuthorityKinds([['irc-fictional-federal', {
      jurisdiction: 'federal',
      authority: [{ citation: 'S.D. Dept. of Revenue, Taxes', kind: 'stateAgencyPublication' }],
    }]])).toEqual(['irc-fictional-federal:S.D. Dept. of Revenue, Taxes:stateAgencyPublication'])
  })

  it('admits a state agency statement for a rule of that state', () => {
    // The positive direction. The kind exists because a state that levies
    // nothing has no operative language to quote, so the department's own
    // sentence is the only affirmative text the negative can rest on.
    expect(offJurisdictionAuthorityKinds([['sd-fictional', {
      jurisdiction: 'state:SD',
      authority: [{ citation: 'S.D. Dept. of Revenue, Taxes', kind: 'stateAgencyPublication' }],
    }]])).toEqual([])
    // ...and every other kind stays admissible on a federal rule, so the guard
    // is a refusal of one member rather than a filter on the federal tier.
    expect(offJurisdictionAuthorityKinds([['irc-fictional-federal', {
      jurisdiction: 'federal',
      authority: [
        { citation: 'IRC 1', kind: 'statute' },
        { citation: '26 CFR 1.401-1', kind: 'regulation' },
        { citation: 'SSA POMS GN 00204.035', kind: 'agencyGuidance' },
        { citation: 'IRS Publication 590-B', kind: 'irsPublication' },
        { citation: '2025 Form 1040 instructions', kind: 'formInstruction' },
        { citation: 'IRS Notice 2025-1', kind: 'irsNotice' },
        { citation: 'H.R. 1, 119th Cong.', kind: 'legislativeHistory' },
      ],
    }]])).toEqual([])
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

  it('requires a state rule to name the parameter pack that makes it state-specific', () => {
    // The citation guard above proves a state record rests on its own
    // sovereign's law. This is the same question asked of the CODE: a state
    // record must point at the params that carry the state's treatment, not
    // only at the calculator that is identical for all fifty-one of them.
    expect(stateRulesMissingPackImplementation(implementationEntries)).toEqual([])
    expect(stateRulesMissingPackImplementation([['pa-fictional', {
      jurisdiction: 'state:PA',
      implementedBy: ['packages/engine/src/tax/stateTax.ts'],
    }]])).toEqual(['pa-fictional'])
    expect(stateRulesMissingPackImplementation([['pa-fictional', {
      jurisdiction: 'state:PA',
      implementedBy: [
        'packages/engine/src/tax/stateTax.ts',
        'packages/engine/src/params/state/data/year2026.ts',
      ],
    }]])).toEqual([])
    // The two non-data cases the directory rule is written to admit.
    expect(stateRulesMissingPackImplementation([['nd-fictional', {
      jurisdiction: 'state:ND',
      implementedBy: ['packages/engine/src/params/state/index.ts'],
    }], ['ca-fictional-out-of-scope', {
      jurisdiction: 'state:CA',
      implementedBy: ['packages/engine/src/params/state/types.ts'],
    }]])).toEqual([])
  })

  it('leaves the pack requirement off federal rules, which have no state params', () => {
    // The asymmetry matters as much here as it does in the citation tier. Most
    // federal records touch no state file at all, and requiring one would be
    // the same category error in the opposite direction.
    expect(stateRulesMissingPackImplementation([['irc-fictional-federal', {
      jurisdiction: 'federal',
      implementedBy: ['packages/engine/src/tax/federalTax.ts'],
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

describe('describeRefusal guards', () => {
  // A refusal fixture is only worth its line count if the harness refuses the
  // ways it could be written to prove nothing. These assert the refusals rather
  // than trusting the helper.
  const noop = (): void => {}
  const spec = {
    entryPoint: 'packages/engine/src/strategies/accountEligibility.ts#evaluateQcd',
    outOfScopeInput: 'a QCD whose source account is a Roth IRA',
    refusal: "reason code 'qcd-roth-source-unsupported'",
  }

  it('refuses to cover an unknown rule', () => {
    expect(() => describeRefusal('not-a-registered-rule' as TaxRuleId, spec, noop))
      .toThrow(/Unknown tax rule/u)
  })

  it('refuses a rule the engine computes an answer for', () => {
    // The substitution that would matter most: a settled or approximated record
    // has a figure to get wrong, and a fixture pinning some refusal path near it
    // would report coverage while leaving the figure unwatched.
    expect(() => describeRefusal('irc-170-b-1-I-floor-ordering' as TaxRuleId, spec, noop))
      .toThrow(/cover its computed value with describeRule instead/u)
    expect(() => describeRefusal('irc-213-a-medical-expense-deduction' as TaxRuleId, spec, noop))
      .toThrow(/cover its computed value with describeRule instead/u)
  })

  it('refuses an entry point the record does not claim', () => {
    // What keeps the fixture and the published record pointing at the same
    // module. A fixture free to name any symbol would keep passing after the
    // refusal moved, and the transparency page would keep naming a function
    // nothing drives.
    expect(() => describeRefusal('irc-408-d-8-roth-ira-source' as TaxRuleId, {
      ...spec,
      entryPoint: 'packages/engine/src/tax/federalTax.ts#computeFederalTax',
    }, noop)).toThrow(/does not name .* in implementedByFunctions/u)
  })

  it('refuses a blank entry point, input, or refusal', () => {
    expect(() => describeRefusal('irc-408-d-8-roth-ira-source' as TaxRuleId, {
      ...spec, entryPoint: '   ',
    }, noop)).toThrow(/nonblank entryPoint/u)
    expect(() => describeRefusal('irc-408-d-8-roth-ira-source' as TaxRuleId, {
      ...spec, outOfScopeInput: '',
    }, noop)).toThrow(/nonblank outOfScopeInput/u)
    expect(() => describeRefusal('irc-408-d-8-roth-ira-source' as TaxRuleId, {
      ...spec, refusal: ' ',
    }, noop)).toThrow(/nonblank refusal/u)
  })
})
