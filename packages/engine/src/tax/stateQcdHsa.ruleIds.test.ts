/**
 * Every rule id a stateQcdHsa.ts warning cites must name a registered record
 * and a published rule-coverage row (#808). A warning that cites an id the
 * registry does not hold points a reader at no authority at all.
 */
import { describe, expect, it } from 'vitest'
import source from './stateQcdHsa.ts?raw'
import { TAX_RULE_REGISTRY } from '../rules/taxRuleRegistry.js'

const coverageShards = import.meta.glob('../../../../DOCS/operations/rule-coverage/*.json', {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>

/** The rule ids cited by warning sites in the module source. */
function citedRuleIds(text: string): { ids: Set<string>; uncited: Set<string>; sites: number } {
  const ids = new Set<string>()
  const uncited = new Set<string>()
  let sites = 0
  // incomplete(code, ruleId, ...) — the leaf refusal helper.
  for (const match of text.matchAll(/\bincomplete\(\s*'[^']+',\s*'([^']+)'/g)) { ids.add(match[1]!); sites++ }
  // incomplete(code, null, ...) — an engine-wide gate no sovereign's law creates.
  for (const match of text.matchAll(/\bincomplete\(\s*'([^']+)',\s*null,/g)) { uncited.add(match[1]!); sites++ }
  // Inline warning objects: { code, ruleId: '...', ... }.
  for (const match of text.matchAll(/\bruleId:\s*'([^']+)'/g)) { ids.add(match[1]!); sites++ }
  // requireKnown(fact, missing, ruleId) — the HSA known-money helper, on one line or several.
  for (const match of text.matchAll(/\brequireKnown\(\s*[^,()]+,\s*(?:'[^']+'|name),\s*'([^']+)'/g)) { ids.add(match[1]!); sites++ }
  return { ids, uncited, sites }
}

describe('stateQcdHsa.ts warning rule ids (#808)', () => {
  const { ids, uncited, sites } = citedRuleIds(source)

  it('reads every warning site in the module', () => {
    // One definition of incomplete() and one of requireKnown() are not call sites.
    const incompleteCalls = (source.match(/\bincomplete\(/g) ?? []).length - 1
    const requireKnownCalls = (source.match(/\brequireKnown\(/g) ?? []).length - 1
    const inlineRuleIds = (source.match(/\bruleId:\s*'/g) ?? []).length
    expect(sites).toBe(incompleteCalls + requireKnownCalls + inlineRuleIds)
    // A shorthand `ruleId,` is a helper parameter (incomplete, requireKnown), nothing else.
    expect((source.match(/\bruleId,/g) ?? []).length).toBe(2)
    expect(ids.size).toBeGreaterThan(0)
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
