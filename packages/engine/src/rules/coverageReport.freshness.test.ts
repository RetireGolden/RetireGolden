import { describe, expect, it } from 'vitest'
import {
  BASELINE_UNSWEPT,
  COVERAGE_ATTESTATIONS,
} from './coverageAttestations.js'
import { buildCoverageReport, describeRuleCallEnd } from './coverageReport.js'
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
    // fail loudly here, never pass as a silently skipped binding check. A
    // throw (not an expect) so the null check also narrows for tsc.
    if (quoteFidelityLedger === null) {
      throw new Error('committed quote-fidelity ledger must be found by the glob')
    }
    // WebCrypto, not node:crypto — the engine's compile-time surface is
    // deliberately free of node and DOM types, so the minimal runtime shapes
    // vitest actually provides are declared here instead of widening tsconfig.
    interface MinimalTextEncoder {
      encode(input: string): Uint8Array
    }
    interface MinimalWebCrypto {
      subtle: { digest(algorithm: string, data: Uint8Array): Promise<ArrayBuffer> }
    }
    const { TextEncoder: TextEncoderConstructor } = globalThis as unknown as {
      TextEncoder: new () => MinimalTextEncoder
    }
    const webCrypto = crypto as unknown as MinimalWebCrypto
    const encoder = new TextEncoderConstructor()
    const hash = async (text: string): Promise<string> => {
      const digest = await webCrypto.subtle.digest('SHA-256', encoder.encode(text))
      return [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('')
        .slice(0, 16)
    }

    const expected: string[] = []
    for (const [id, rule] of Object.entries(TAX_RULE_REGISTRY)) {
      for (const authority of rule.authority) {
        expected.push(`${id} ${authority.citation} ${authority.url} ${await hash(authority.quotedText)}`)
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

function syntheticRule(title: string) {
  return {
    title,
    statement: 'Synthetic statement for scan-contract tests.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [
      { kind: 'statute', citation: 'Fix. Code 1', url: 'https://example.gov/1', quotedText: 'synthetic quoted text' },
    ],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: ['packages/engine/src/rules/coverageReport.ts'],
  }
}

// The manifest projection is a public contract for the transparency page on
// retiregolden.org.
// Mirror-the-builder freshness checks cannot catch a wrong projection (both
// sides regenerate together), so these read expected values from the registry
// records themselves.
describe('manifest rule projection contract', () => {
  it('publishes manifest version 2, the discriminator for the new required fields', () => {
    expect(report.manifest.version).toBe(2)
  })

  it('copies title, errorDirection, conventionRationale, and contraryReading from the registry', () => {
    for (const rule of report.manifest.rules) {
      const record = TAX_RULE_REGISTRY[rule.id as keyof typeof TAX_RULE_REGISTRY]
      expect(record, rule.id).toBeDefined()
      expect(rule.title, rule.id).toBe(record.title)
      expect(rule.errorDirection, rule.id).toBe(record.errorDirection)
      expect(rule.conventionRationale, rule.id).toBe(record.conventionRationale)
      expect(rule.contraryReading, rule.id).toBe(record.contraryReading)
      expect(rule.title.trim().length, rule.id).toBeGreaterThan(0)
      if (rule.conventionRationale !== null) expect(rule.conventionRationale.trim().length, rule.id).toBeGreaterThan(0)
      if (rule.contraryReading !== null) expect(rule.contraryReading.trim().length, rule.id).toBeGreaterThan(0)
    }
  })

  it('keeps errorDirection null exactly when the rule is not approximated', () => {
    for (const rule of report.manifest.rules) {
      expect(rule.errorDirection === null, rule.id).toBe(rule.classification !== 'approximated')
    }
  })

  it('keeps fixtures and fixtureFiles consistent, with titles present in the scanned source', () => {
    for (const rule of report.manifest.rules) {
      const paths = [...new Set(rule.fixtures.map(({ path }) => path))]
      expect([...rule.fixtureFiles].sort(), rule.id).toEqual(paths.sort())
      for (const fixture of rule.fixtures) {
        expect(fixture.line, rule.id).toBeGreaterThanOrEqual(1)
        expect(fixture.testTitles.length, `${rule.id} ${fixture.path}`).toBeGreaterThan(0)
      }
    }
    // Spot-bind one fixture's titles to the live source text so the block
    // scan cannot drift into returning titles from a neighboring rule.
    const sample = report.manifest.rules.find((rule) => rule.fixtures.length > 0)
    expect(sample).toBeDefined()
    const globKey = Object.keys(testSources).find((key) =>
      sample!.fixtures[0]!.path.endsWith(key.replace(/^\.\.\//u, '').replace(/^\.\//u, 'rules/')),
    )
    expect(globKey, sample!.fixtures[0]!.path).toBeDefined()
    const source = testSources[globKey!] as string
    const callMarker = 'describe' + `Rule('${sample!.id}'`
    const callStart = source.indexOf(callMarker)
    expect(callStart, sample!.id).toBeGreaterThanOrEqual(0)
    // Bind titles to the call's own balanced extent - the production walker
    // itself - so a sibling suite between two describeRule calls cannot
    // satisfy this check.
    const block = source.slice(callStart, describeRuleCallEnd(source, callStart))
    for (const title of sample!.fixtures[0]!.testTitles) {
      expect(block, `${sample!.id}: ${title}`).toContain(title)
    }
  })

  it('never attributes sibling it() titles that follow a describeRule call', () => {
    // Two describeRule calls with a plain describe between them: the sibling
    // suite's title must land on neither rule. This is the leak class the
    // sequential-slice scan shipped with, pinned so it cannot return.
    const syntheticSource = [
      '// synthetic fixture source for the scan contract',
      "// an it('commented out title') here must not be captured",
      // 'describe' + 'Rule' is split so the conformance suite's raw-text scan
      // does not read these synthetic ids as claimed fixtures.
      "describe" + "Rule('fixture-alpha', { readings: { a: 1, b: 2 }, accepted: 'a' }, ({ accepted }) => {",
      "  it('alpha discriminates', () => { expect(1).toBe(accepted) })",
      '})',
      '',
      "describe('unrelated neighborhood', () => {",
      "  it('beta belongs to nobody', () => { expect(true).toBe(true) })",
      '})',
      '',
      "describe" + "Rule('fixture-beta', { readings: { a: 1, b: 2 }, accepted: 'a', note: 'beta note' }, ({ accepted }) => {",
      "  it('gamma discriminates', () => { expect(1).toBe(accepted) })",
      '})',
      '',
    ].join('\n')
    const syntheticRegistry = {
      'fixture-alpha': syntheticRule('Alpha'),
      'fixture-beta': syntheticRule('Beta'),
    } as unknown as typeof TAX_RULE_REGISTRY
    const syntheticReport = buildCoverageReport({
      registry: syntheticRegistry,
      attestations: COVERAGE_ATTESTATIONS,
      baselineUnswept: BASELINE_UNSWEPT,
      testSources: { './synthetic.test.ts': syntheticSource },
      quoteFidelityLedger: null,
      dueOnFor: () => '2027-01-01',
    })
    const alpha = syntheticReport.manifest.rules.find((rule) => rule.id === 'fixture-alpha')
    const beta = syntheticReport.manifest.rules.find((rule) => rule.id === 'fixture-beta')
    expect(alpha!.fixtures[0]!.testTitles).toEqual(['alpha discriminates'])
    expect(alpha!.fixtures[0]!.path).toBe('packages/engine/src/rules/synthetic.test.ts')
    expect(alpha!.fixtures[0]!.line).toBe(3)
    expect(beta!.fixtures[0]!.testTitles).toEqual(['gamma discriminates'])
    expect(beta!.fixtures[0]!.line).toBe(11)
    for (const rule of [alpha!, beta!]) {
      for (const fixture of rule.fixtures) {
        expect(fixture.testTitles, rule.id).not.toContain('beta belongs to nobody')
        expect(fixture.testTitles, rule.id).not.toContain('commented out title')
      }
    }
    expect(alpha!.fixtures[0]!.note).toBeNull()
    expect(beta!.fixtures[0]!.note).toBe('beta note')
  })

  it('publishes unique authority identities with no quotedText', () => {
    for (const rule of report.manifest.rules) {
      const record = TAX_RULE_REGISTRY[rule.id as keyof typeof TAX_RULE_REGISTRY]
      expect(record, rule.id).toBeDefined()
      // Exact first-seen-unique equality against the registry: this is what
      // rules out empty lists, url-only dedupe, and last-wins ordering.
      const seen = new Set<string>()
      const expectedIdentities: { kind: string; citation: string; url: string }[] = []
      for (const { kind, citation, url } of record.authority) {
        const key = `${kind}\u0000${citation}\u0000${url}`
        if (seen.has(key)) continue
        seen.add(key)
        expectedIdentities.push({ kind, citation, url })
      }
      expect(rule.authorities, rule.id).toEqual(expectedIdentities)
      expect(rule.authorities.length, rule.id).toBeGreaterThan(0)
      for (const authority of rule.authorities) {
        expect(Object.keys(authority).sort(), rule.id).toEqual(['citation', 'kind', 'url'])
      }
    }
  })

  it('publishes exactly the documented rule keys, with no quotedText or statement, in the serialized JSON', () => {
    const published = JSON.parse(report.json) as { rules: Record<string, unknown>[] }
    const documentedKeys = [
      'authorities',
      'classification',
      'contraryReading',
      'conventionRationale',
      'dueOn',
      'effectiveFrom',
      'effectiveThrough',
      'errorDirection',
      'fixtureFiles',
      'fixtures',
      'id',
      'implementedBy',
      'jurisdiction',
      'title',
      'verifiedOn',
      'volatility',
    ]
    for (const rule of published.rules) {
      expect(Object.keys(rule).sort(), String(rule.id)).toEqual(documentedKeys)
    }
    // Key-level leak guards on the serialized text itself: a spread of the
    // registry record would reintroduce these long before a human noticed.
    expect(report.json).not.toContain('"quotedText":')
    expect(report.json).not.toContain('"statement":')
    expect(report.json).not.toContain('"authority":')
  })

  it('collapses duplicate identities per a hand-written fixture, not the builder algorithm', () => {
    // Two quotes of one provision (one identity), a second citation sharing
    // the URL (its own identity), and quotedText that must not surface. The
    // expected list is written by hand so this cannot mirror the builder.
    const fixtureRegistry = {
      'fixture-rule': {
        title: 'Fixture rule',
        statement: 'Fixture statement that must not be published.',
        classification: 'settled',
        contraryReading: null,
        errorDirection: null,
        conventionRationale: null,
        jurisdiction: 'federal',
        authority: [
          { kind: 'statute', citation: 'Fix. Code 1(a)', url: 'https://example.gov/1', quotedText: 'first quote' },
          { kind: 'statute', citation: 'Fix. Code 1(a)', url: 'https://example.gov/1', quotedText: 'second quote of the same span' },
          { kind: 'statute', citation: 'Fix. Code 1(b)', url: 'https://example.gov/1', quotedText: 'same url, different citation' },
        ],
        volatility: 'staticStatute',
        effectiveFrom: 2026,
        effectiveThrough: null,
        verifiedOn: '2026-08-27',
        implementedBy: ['packages/engine/src/rules/coverageReport.ts'],
      },
    } as unknown as typeof TAX_RULE_REGISTRY
    const fixtureReport = buildCoverageReport({
      registry: fixtureRegistry,
      attestations: COVERAGE_ATTESTATIONS,
      baselineUnswept: BASELINE_UNSWEPT,
      testSources,
      quoteFidelityLedger: null,
      dueOnFor: () => '2027-01-01',
    })
    const published = JSON.parse(fixtureReport.json) as {
      rules: { id: string; authorities: unknown }[]
    }
    const fixtureRule = published.rules.find((rule) => rule.id === 'fixture-rule')
    expect(fixtureRule).toBeDefined()
    expect(fixtureRule!.authorities).toEqual([
      { kind: 'statute', citation: 'Fix. Code 1(a)', url: 'https://example.gov/1' },
      { kind: 'statute', citation: 'Fix. Code 1(b)', url: 'https://example.gov/1' },
    ])
    expect(fixtureReport.json).not.toContain('"quotedText":')
  })
})
