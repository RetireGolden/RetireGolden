import { describe, expect, it } from 'vitest'
import {
  BASELINE_UNSWEPT,
  COVERAGE_ATTESTATIONS,
} from './coverageAttestations.js'
import { buildCoverageReport } from './coverageReport.js'
import {
  DEFAULT_REVERIFICATION_INTERVAL_DAYS,
  TAX_RULE_REGISTRY,
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

describe('rules coverage report artifacts', () => {
  it('matches the deterministic report builder', () => {
    const report = buildCoverageReport({
      registry: TAX_RULE_REGISTRY,
      attestations: COVERAGE_ATTESTATIONS,
      baselineUnswept: BASELINE_UNSWEPT,
      testSources,
      intervals: DEFAULT_REVERIFICATION_INTERVAL_DAYS,
      quoteFidelityLedger,
    })
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
})

