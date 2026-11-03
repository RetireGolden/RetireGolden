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
function citedRuleIds(text: string): { ids: Set<string>; sites: number } {
  const ids = new Set<string>()
  let sites = 0
  // incomplete(code, ruleId, ...) — the leaf refusal helper.
  for (const match of text.matchAll(/\bincomplete\(\s*'[^']+',\s*'([^']+)'/g)) { ids.add(match[1]!); sites++ }
  // Inline warning objects: { code, ruleId: '...', ... }.
  for (const match of text.matchAll(/\bruleId:\s*'([^']+)'/g)) { ids.add(match[1]!); sites++ }
  // requireKnown(fact, missing, ruleId) — the HSA known-money helper, on one line or several.
  for (const match of text.matchAll(/\brequireKnown\(\s*[^,()]+,\s*(?:'[^']+'|name),\s*'([^']+)'/g)) { ids.add(match[1]!); sites++ }
  return { ids, sites }
}

describe('stateQcdHsa.ts warning rule ids (#808)', () => {
  const { ids, sites } = citedRuleIds(source)

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

  it('cites the Kansas QCD record for the covered charitable-credit gate', () => {
    // K.S.A. 79-32,117(b)(vii), quoted in ks-direct-qcd-conformity, adds a
    // contribution claimed as the basis for the K.S.A. 79-32,196 credit.
    expect(source).not.toContain('ks-qcd-charitable-credit-adjustment')
    expect(source).toMatch(/incomplete\('ks-qcd-charitable-credit-unknown', 'ks-direct-qcd-conformity'/)
  })
})
