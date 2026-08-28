import { describe, expect, it } from 'vitest'
import {
  BASELINE_UNSWEPT,
  COVERAGE_ATTESTATIONS,
} from './coverageAttestations.js'
import { buildCoverageReport } from './coverageReport.js'
import {
  TAX_RULE_REGISTRY,
  TAX_RULE_VOLATILITIES,
  taxRuleDueOn,
  taxRuleIds,
  taxRulesDueForVerification,
} from './taxRuleRegistry.js'
import committedJson from '../../../../DOCS/operations/rule-coverage.json?raw'
import committedMarkdown from '../../../../DOCS/operations/rule-coverage.md?raw'
import { testSourcesInGlobShape } from '../../scripts/rules-coverage.mjs'

// Vite requires the options to be inline object literals.
const testSources = import.meta.glob('../**/*.test.{ts,mts,cts,tsx}', { query: '?raw', import: 'default', eager: true })
const operationJsonSources = import.meta.glob('../../../../DOCS/operations/*.json', {
  query: '?raw',
  import: 'default',
  eager: true,
})
const quoteFidelityLedger = Object.entries(operationJsonSources)
  .find(([path]) => path.endsWith('/quote-fidelity-ledger.json'))?.[1] ?? null

function normalizeNewlines(source: string): string {
  return source.replace(/\r\n/g, '\n')
}

/** Shifts a probe date; the expected values themselves only ever come from the built manifest. */
function dayBefore(isoDate: string): string {
  const date = new Date(isoDate + 'T00:00:00Z')
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().slice(0, 10)
}

const report = buildCoverageReport({
  registry: TAX_RULE_REGISTRY,
  attestations: COVERAGE_ATTESTATIONS,
  baselineUnswept: BASELINE_UNSWEPT,
  testSources,
  quoteFidelityLedger,
  dueOnFor: taxRuleDueOn,
})

describe('rules coverage report artifacts', () => {
  it('matches the deterministic report builder', () => {
    expect(report.manifest.registry.total).toBe(taxRuleIds.length)
    const classificationTotal = Object.values(report.manifest.registry.byClassification)
      .reduce((sum, count) => sum + count, 0)
    expect(classificationTotal).toBe(report.manifest.registry.total)
    expect(report.manifest.attestations.totalFiles).toBe(Object.keys(COVERAGE_ATTESTATIONS).length)
    expect(normalizeNewlines(committedMarkdown)).toBe(normalizeNewlines(report.markdown))
    expect(normalizeNewlines(committedJson)).toBe(normalizeNewlines(report.json))
  })

  // Binds the freshness test to the coverage script's glob walk, not only to the
  // report builder. Raw keys legitimately differ in two ways — Vite emits
  // same-directory files as `./name` while the script walk emits `../rules/name`,
  // and import.meta.glob never includes the importing module — so the contract is
  // equality of the CANONICAL fixture paths the builder derives, which is the only
  // form that reaches the committed artifacts.
  it('aligns script test-source glob keys with the Vite glob', () => {
    const thisModule = 'coverageReport.freshness.test.ts'
    const canonical = (path: string): string =>
      path.replace(/^\.\.\//u, 'packages/engine/src/').replace(/^\.\//u, 'packages/engine/src/rules/')
    const canonicalize = (sources: Readonly<Record<string, string>>): Map<string, string> =>
      new Map(
        Object.entries(sources)
          .filter(([path]) => !path.endsWith(thisModule))
          .map(([path, source]) => [canonical(path), source as string]),
      )
    const fromScript = canonicalize(testSourcesInGlobShape() as Record<string, string>)
    const fromGlob = canonicalize(testSources as Record<string, string>)
    expect([...fromScript.keys()].sort()).toEqual([...fromGlob.keys()].sort())
    for (const [key, source] of fromScript) {
      expect(fromGlob.get(key), key).toBe(source)
    }
  })

  // The dueOn each row PUBLISHES is the value under test — read from the built
  // manifest, never recomputed here, so a drifting builder formula fails instead
  // of being mirrored by a local copy of the same arithmetic.
  it('agrees taxRulesDueForVerification due dates with the report builder', () => {
    for (const volatility of TAX_RULE_VOLATILITIES) {
      const manifestRule = report.manifest.rules.find(
        (candidate) => TAX_RULE_REGISTRY[candidate.id as keyof typeof TAX_RULE_REGISTRY]?.volatility === volatility,
      )
      expect(manifestRule, 'manifest rule for volatility ' + volatility).toBeDefined()
      expect(taxRulesDueForVerification(manifestRule!.dueOn)).toContain(manifestRule!.id)
      expect(taxRulesDueForVerification(dayBefore(manifestRule!.dueOn))).not.toContain(manifestRule!.id)
    }
  })
})


// The report builder's identity check (id · citation · url) cannot see a
// quotedText edit hiding behind an unchanged citation and URL, and it stays
// crypto-free for browser bundling. This node-side test closes that last gap:
// every ledger verdict must carry the hash of the exact quote it judged.
describe('quote-fidelity ledger hash binding', () => {
  it('binds every ledger verdict to the registry quote it judged', async () => {
    // The repo commits a ledger from this change on; a glob or path miss must
    // fail loudly here, never pass as a silently skipped binding check.
    expect(quoteFidelityLedger, 'committed quote-fidelity ledger must be found by the glob').not.toBeNull()
    const { createHash } = await import('node:crypto')
    const hash = (text: string): string =>
      createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 16)

    const expected: string[] = []
    for (const [id, rule] of Object.entries(TAX_RULE_REGISTRY)) {
      for (const authority of rule.authority) {
        expected.push(`${id} ${authority.citation} ${authority.url} ${hash(authority.quotedText)}`)
      }
    }
    const parsed = JSON.parse(quoteFidelityLedger) as {
      results: { id: string; citation: string; url: string; quoteSha256: string }[]
    }
    const found = parsed.results.map(
      (result) => `${result.id} ${result.citation} ${result.url} ${result.quoteSha256}`,
    )
    expect(found.sort()).toEqual(expected.sort())
  })
})
