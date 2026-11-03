/**
 * Every rule id a stateQcdHsa.ts warning cites must name a registered record
 * and a published rule-coverage row (#808). A warning that cites an id the
 * registry does not hold points a reader at no authority at all.
 *
 * The scan classifies every `ruleId` token and every call of the two warning
 * helpers. A form it does not recognize (a computed id, a variable, a helper
 * called with a non-literal id) is reported, not skipped, so the inventory
 * cannot silently stop covering a warning site (#839 r1-8, r1-10).
 */
import { describe, expect, it } from 'vitest'
import source from './stateQcdHsa.ts?raw'
import { TAX_RULE_REGISTRY } from '../rules/taxRuleRegistry.js'

const coverageShards = import.meta.glob('../../../../DOCS/operations/rule-coverage/*.json', {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>

interface RuleIdScan {
  /** Literal rule ids cited by warning sites and helper calls. */
  readonly ids: Set<string>
  /** Codes of incomplete() calls that cite no rule (an explicit null). */
  readonly uncited: Set<string>
  /** Source snippets the scan cannot read as a literal citation. */
  readonly unrecognized: string[]
}

/** Blank out comments, keeping offsets, so prose naming `ruleId` is not a site. */
function withoutComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (comment) => comment.replace(/[^\n]/g, ' '))
}

const LITERAL = String.raw`'([^'\\\n]+)'`

/** Classify every `ruleId` token and every incomplete()/requireKnown() call. */
function scanRuleIds(text: string): RuleIdScan {
  const code = withoutComments(text)
  const ids = new Set<string>()
  const uncited = new Set<string>()
  const unrecognized: string[] = []
  const snippet = (at: number) => code.slice(Math.max(0, at - 30), at + 60).replace(/\s+/g, ' ')

  // The two helper definitions: their parameters and the shorthand that
  // forwards them. Each must occur exactly once.
  const helperForms = [
    /function incomplete\(code: string, ruleId: string \| null, /g,
    /ruleId === null \? \{ code, message, missingFacts \} : \{ code, ruleId, message, missingFacts \}/g,
    /code: 'state-hsa-money-unknown',\s*ruleId,/g,
  ]
  const helperSpans: [number, number][] = []
  for (const form of helperForms) {
    const matches = [...code.matchAll(form)]
    if (matches.length !== 1) unrecognized.push(`helper form ${form.source} occurs ${matches.length} times`)
    for (const match of matches) helperSpans.push([match.index, match.index + match[0].length])
  }

  for (const match of code.matchAll(/\bruleId\b/g)) {
    const at = match.index
    if (helperSpans.some(([start, end]) => at >= start && at < end)) continue
    // ruleId: 'literal' (a warning object), or ruleId: 'a' | 'b' (the
    // requireKnown parameter, whose literal union is what its calls may cite).
    const literal = new RegExp(String.raw`^ruleId:\s*${LITERAL}((?:\s*\|\s*'[^'\\\n]+')*)\s*[,}\n]`).exec(code.slice(at))
    if (literal === null) {
      unrecognized.push(snippet(at))
      continue
    }
    ids.add(literal[1]!)
    for (const extra of literal[2]!.matchAll(new RegExp(LITERAL, 'g'))) ids.add(extra[1]!)
  }

  for (const match of code.matchAll(/\bincomplete\(/g)) {
    const rest = code.slice(match.index)
    if (rest.startsWith('incomplete(code: string')) continue
    const call = new RegExp(String.raw`^incomplete\(\s*${LITERAL},\s*(?:${LITERAL}|(null))\s*,`).exec(rest)
    if (call === null) unrecognized.push(snippet(match.index))
    else if (call[3] === 'null') uncited.add(call[1]!)
    else ids.add(call[2]!)
  }

  for (const match of code.matchAll(/\brequireKnown\(/g)) {
    const rest = code.slice(match.index)
    if (/^requireKnown\(\s*fact: /.test(rest)) continue
    // requireKnown(fact, missing, 'id'): the fact may be a property path, the
    // missing-fact name a literal or a variable; the id must be a literal.
    const call = new RegExp(String.raw`^requireKnown\(\s*[\w.]+,\s*(?:'[^'\\\n]+'|\w+),\s*${LITERAL},?\s*\)`).exec(rest)
    if (call === null) unrecognized.push(snippet(match.index))
    else ids.add(call[1]!)
  }
  return { ids, uncited, unrecognized }
}

describe('stateQcdHsa.ts warning rule ids (#808)', () => {
  const { ids, uncited, unrecognized } = scanRuleIds(source)

  it('reads every rule id site in the module as a literal citation or an explicit null', () => {
    expect(unrecognized).toEqual([])
    expect(ids.size).toBeGreaterThan(0)
  })

  it('reports a computed, variable or non-literal rule id instead of skipping it', () => {
    const helpers = [
      "function incomplete(code: string, ruleId: string | null, message: string, missingFacts: string[]) {",
      "  return [ruleId === null ? { code, message, missingFacts } : { code, ruleId, message, missingFacts }]",
      "}",
      "function requireKnown(",
      "  fact: KnownMoney | undefined,",
      "  missing: string,",
      "  ruleId: 'nj-hsa-state-basis-nonconformity',",
      ") {",
      "  return { warning: { code: 'state-hsa-money-unknown', ruleId, message: 'm', missingFacts: [missing] } }",
      "}",
    ].join('\n')
    expect(scanRuleIds(helpers).unrecognized).toEqual([])
    for (const site of [
      "warnings.push({ code: 'x', ruleId: SOME_ID, message: 'm', missingFacts: [] })",
      "warnings.push({ code: 'x', ruleId: lookupRule(state), message: 'm', missingFacts: [] })",
      "warnings.push({ code: 'x', ruleId: `nj-${kind}`, message: 'm', missingFacts: [] })",
      "parts.push(incomplete('x', ruleFor(state), 'm', []))",
      "parts.push(incomplete(code, 'nj-direct-qcd-ira-basis-treatment', 'm', []))",
      "const known = requireKnown(facts.realizedGains, 'realizedGains', RULE)",
      "const warning = { code: 'x', ruleId }",
    ]) {
      expect(scanRuleIds(`${helpers}\n${site}`).unrecognized, site).toHaveLength(1)
    }
    // A commented-out site is prose, not a warning.
    expect(scanRuleIds(`${helpers}\n// ruleId: SOME_ID`).unrecognized).toEqual([])
    // An unregistered literal is read, so the registry check below rejects it.
    const unregistered = scanRuleIds(`${helpers}\nparts.push(incomplete('x', 'not-a-registered-rule', 'm', []))`)
    expect([...unregistered.ids]).toContain('not-a-registered-rule')
    expect(Object.prototype.hasOwnProperty.call(TAX_RULE_REGISTRY, 'not-a-registered-rule')).toBe(false)
  })

  it.each([...ids].sort())('%s is a registered record with a rule-coverage row', (id) => {
    expect(Object.prototype.hasOwnProperty.call(TAX_RULE_REGISTRY, id)).toBe(true)
    const published = Object.values(coverageShards).some((text) => text.includes(`"id": "${id}"`))
    expect(published).toBe(true)
  })

  it('cites no single state\'s record from a gate every state shares', () => {
    // The registry's jurisdiction is federal or one state, so a multi-state
    // record cannot be expressed. The split-interest and direct-transfer gates
    // enforce IRC 408(d)(8) and cite its federal records; the unresearched
    // policy and residency gates are engine-wide and carry no rule id, as
    // state-pack-unavailable does.
    expect(source).not.toContain('state-direct-qcd-conformity-policies')
    expect(source).toMatch(/incomplete\('state-qcd-split-interest-refused', 'irc-408-d-8-F-i-split-interest-direct-payment'/)
    expect(source).toMatch(/incomplete\('state-qcd-direct-transfer-required', 'irc-408-d-8-B-i-qualified-recipient'/)
    expect([...uncited].sort()).toEqual(['state-qcd-policy-unknown', 'state-qcd-residency-incomplete'])
    for (const id of ['irc-408-d-8-F-i-split-interest-direct-payment', 'irc-408-d-8-B-i-qualified-recipient'] as const) {
      expect(TAX_RULE_REGISTRY[id].jurisdiction).toBe('federal')
    }
  })

  it('cites the Kansas QCD record for the covered charitable-credit gate', () => {
    // K.S.A. 79-32,117(b)(vii), quoted in ks-direct-qcd-conformity, adds a
    // contribution claimed as the basis for the K.S.A. 79-32,196 credit.
    expect(source).not.toContain('ks-qcd-charitable-credit-adjustment')
    expect(source).toMatch(/incomplete\('ks-qcd-charitable-credit-unknown', 'ks-direct-qcd-conformity'/)
  })
})
