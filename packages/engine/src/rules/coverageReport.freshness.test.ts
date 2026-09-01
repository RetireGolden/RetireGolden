import { describe, expect, it } from 'vitest'
import {
  BASELINE_UNSWEPT,
  COVERAGE_ATTESTATIONS,
} from './coverageAttestations.js'
import { buildCoverageReport, describeRuleCallEnd } from './coverageReport.js'
import { declaredSymbolLinesOf, symbolAnchorLine, type DeclaredSymbol } from './symbolLines.js'
import {
  TAX_RULE_RECORD_MODULES,
  TAX_RULE_REGISTRY,
  TAX_RULE_VOLATILITIES,
  taxRuleDueOn,
  taxRuleIds,
  taxRulesDueForVerification,
} from './taxRuleRegistry.js'
import committedJson from '../../../../DOCS/operations/rule-coverage.json?raw'
import committedMarkdown from '../../../../DOCS/operations/rule-coverage.md?raw'
import { isGeneratedShardText, testSourcesInGlobShape } from '../../scripts/rules-coverage.mjs'

// Vite requires the options to be inline object literals.
const testSources = import.meta.glob('../**/*.test.{ts,mts,cts,tsx}', { query: '?raw', import: 'default', eager: true })
const engineSources = import.meta.glob('../**/*.ts', { query: '?raw', import: 'default', eager: true })
const operationJsonSources = import.meta.glob('../../../../DOCS/operations/*.json', {
  query: '?raw',
  import: 'default',
  eager: true,
})
const committedShardSources = import.meta.glob('../../../../DOCS/operations/rule-coverage/*.json', {
  query: '?raw',
  import: 'default',
  eager: true,
})
/** Committed shard text keyed by file name (`statesWest.json`). */
const committedShards = new Map(
  Object.entries(committedShardSources).map(([path, source]) => [
    path.slice(path.lastIndexOf('/') + 1),
    source as string,
  ]),
)
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

/**
 * Test-source lines keyed by EXACT canonical path (the same fold the builder
 * applies to glob keys), for the per-test line binds - a suffix match could
 * silently pick a same-named file from another directory.
 */
const testSourcesByCanonicalPath = new Map(
  Object.entries(testSources).map(([key, source]) => [
    key.replace(/^\.\.\//u, 'packages/engine/src/').replace(/^\.\//u, 'packages/engine/src/rules/'),
    source as string,
  ]),
)
const testSourceLineCache = new Map<string, readonly string[]>()
function testSourceLinesOf(fixturePath: string): readonly string[] {
  const cached = testSourceLineCache.get(fixturePath)
  if (cached !== undefined) return cached
  const source = testSourcesByCanonicalPath.get(fixturePath)
  if (source === undefined) throw new Error(fixturePath + ' is not a test source the glob can see')
  const lines = source.split('\n')
  testSourceLineCache.set(fixturePath, lines)
  return lines
}

/** Engine source text for a repo-relative pin path; Vite emits same-directory keys as `./name`. */
function engineSourceOf(path: string): string {
  const globKey = path
    .replace(/^packages\/engine\/src\/rules\//u, './')
    .replace(/^packages\/engine\/src\//u, '../')
  const source = engineSources[globKey] as string | undefined
  if (source === undefined) throw new Error(path + ' is not an engine source file the glob can see')
  return source
}

const symbolLineTables = new Map<string, ReadonlyMap<string, DeclaredSymbol>>()
function symbolLineFor(path: string, symbol: string): number {
  let table = symbolLineTables.get(path)
  if (table === undefined) {
    table = declaredSymbolLinesOf(path, engineSourceOf(path))
    symbolLineTables.set(path, table)
  }
  return symbolAnchorLine(table, path, symbol)
}

const report = buildCoverageReport({
  registry: TAX_RULE_REGISTRY,
  attestations: COVERAGE_ATTESTATIONS,
  baselineUnswept: BASELINE_UNSWEPT,
  testSources,
  quoteFidelityLedger,
  dueOnFor: taxRuleDueOn,
  symbolLineFor,
  recordModules: TAX_RULE_RECORD_MODULES,
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

  // The index alone is no longer the ledger: pinning it while the shards drift
  // would publish stale per-rule payloads under a fresh-looking index. The
  // committed shard SET is compared both ways, so a renamed module's orphan
  // file fails here rather than lingering as a second source of truth.
  it('matches every committed coverage shard, with no orphan shard files', () => {
    const generated = new Map(
      report.shards.map((shard) => [shard.path.slice(shard.path.lastIndexOf('/') + 1), shard.json]),
    )
    expect([...committedShards.keys()].sort()).toEqual([...generated.keys()].sort())
    for (const [fileName, json] of generated) {
      expect(normalizeNewlines(committedShards.get(fileName) ?? ''), fileName).toBe(normalizeNewlines(json))
    }
  })

  // The split's correctness condition, asserted against the registry rather
  // than against the builder: the shards partition the rules — every id exactly
  // once, none dropped, none duplicated across two shards.
  it('partitions every registry rule across the shards exactly once', () => {
    const shardedIds = report.shards.flatMap((shard) => shard.shard.rules.map((rule) => rule.id))
    expect(shardedIds.length).toBe(taxRuleIds.length)
    expect([...shardedIds].sort()).toEqual([...taxRuleIds].sort())
    expect(report.manifest.shards.map(({ module, ruleCount }) => [module, ruleCount])).toEqual(
      report.shards.map((shard) => [shard.module, shard.shard.rules.length]),
    )
    // Each shard holds exactly the ids its record module registers — the shard
    // boundary IS the record module, which is what makes the dispatch lock
    // narrow enough to be worth having.
    const recordIdsByModule = new Map(
      TAX_RULE_RECORD_MODULES.map(([name, records]) => [name, Object.keys(records).sort()]),
    )
    for (const shard of report.shards) {
      expect(shard.shard.rules.map((rule) => rule.id), shard.module).toEqual(recordIdsByModule.get(shard.module))
      expect(shard.shard.module, shard.module).toBe(shard.module)
      expect(shard.shard.version, shard.module).toBe(5)
    }
  })

  it('refuses to publish a rule that belongs to no record module', () => {
    expect(() =>
      buildCoverageReport({
        registry: TAX_RULE_REGISTRY,
        attestations: COVERAGE_ATTESTATIONS,
        baselineUnswept: BASELINE_UNSWEPT,
        testSources,
        quoteFidelityLedger: null,
        dueOnFor: taxRuleDueOn,
        symbolLineFor,
        recordModules: [],
      }),
    ).toThrow(/belongs to no record module/)
  })

  // The generator sweeps its shard directory so a renamed module cannot leave
  // an orphan behind. That sweep must recognise its OWN output rather than
  // deleting whatever .json it finds: a draft or scratch file somebody put
  // there is not a report writer's to destroy.
  it('recognises a generated shard by its kind, and nothing else', () => {
    // A real shard the builder just produced, so the accepted case is the
    // actual published text rather than a hand-written lookalike.
    const realShard = report.shards.find(({ module }) => module === 'statesWest')
    expect(realShard).toBeDefined()
    expect(isGeneratedShardText(realShard!.json)).toBe(true)
    // The index is NOT a shard: it carries the manifest kind, and sweeping it
    // would delete the file naming every shard.
    expect(isGeneratedShardText(report.json)).toBe(false)

    for (const [label, text] of [
      ['foreign kind', JSON.stringify({ kind: 'someone.elses.file', keep: true })],
      ['no kind at all', JSON.stringify({ notes: 'a draft somebody parked here' })],
      ['unparseable', '{ not json'],
      ['empty', ''],
      // Valid JSON that is not a plain object: `null` is the trap a bare
      // typeof check would call an object and delete.
      ['bare array', '[1, 2, 3]'],
      ['json null', 'null'],
      ['json string', '"retiregolden.rules-coverage.shard"'],
    ] as const) {
      expect(isGeneratedShardText(text), label).toBe(false)
    }
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
      const manifestRule = report.rules.find(
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
    implementedByFunctions: ['packages/engine/src/rules/coverageReport.ts#buildCoverageReport'],
  }
}

// The manifest projection is a public contract for the transparency page on
// retiregolden.org.
// Mirror-the-builder freshness checks cannot catch a wrong projection (both
// sides regenerate together), so these read expected values from the registry
// records themselves.
describe('manifest rule projection contract', () => {
  it('publishes manifest version 5, the discriminator for the sharded layout', () => {
    expect(report.manifest.version).toBe(5)
    // Version 5's breaking change is exactly this: the index stops carrying the
    // per-rule payloads and names the shards that do.
    expect((report.manifest as { rules?: unknown }).rules).toBeUndefined()
    expect(report.manifest.shards.length).toBeGreaterThan(0)
    for (const entry of report.manifest.shards) {
      expect(entry.path, entry.module).toBe('rule-coverage/' + entry.module + '.json')
    }
  })

  it('copies title, errorDirection, conventionRationale, and contraryReading from the registry', () => {
    for (const rule of report.rules) {
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
    for (const rule of report.rules) {
      expect(rule.errorDirection === null, rule.id).toBe(rule.classification !== 'approximated')
    }
  })

  it('keeps implementations aligned with implementedBy', () => {
    for (const rule of report.rules) {
      expect(rule.implementations.map(({ path }) => path), rule.id).toEqual(rule.implementedBy)
      const record = TAX_RULE_REGISTRY[rule.id as keyof typeof TAX_RULE_REGISTRY]
      const declared = record.implementedByFunctions
      const published = rule.implementations.flatMap(({ path, functions }) =>
        functions.map(({ name }) => `${path}#${name}`),
      )
      expect([...published].sort(), rule.id).toEqual([...declared].sort())
    }
  })

  it('keeps inherited §4974 shortfalls outside the owner sub-cent discharge record', () => {
    const inheritedPlanner =
      'packages/engine/src/projection/internal/annualInheritedIraDistributions.ts'
    const discharge = TAX_RULE_REGISTRY[
      'treas-reg-1-408-8-projection-sub-cent-distribution-discharge'
    ]
    expect(discharge.implementedBy).not.toContain(inheritedPlanner)
    expect(discharge.implementedByFunctions).not.toContain(
      `${inheritedPlanner}#annualInheritedIraDistributions`,
    )

    const linkedRecords = Object.values(TAX_RULE_REGISTRY).filter((record) =>
      record.implementedBy.includes(inheritedPlanner))
    expect(linkedRecords).toHaveLength(12)
    expect(COVERAGE_ATTESTATIONS[
      'projection/internal/annualInheritedIraDistributions.ts'
    ]?.note).toContain('Twelve inherited-RMD records name the helper.')
  })

  // Published lines are deep-link anchors on the transparency page, so each
  // one is bound to the source text itself: the named line must contain the
  // symbol. A resolver that agreed with the builder but pointed at the wrong
  // line would pass a mirror check and fail here.
  it('anchors every implementation function line to a source line containing the name', () => {
    for (const rule of report.rules) {
      for (const { path, functions } of rule.implementations) {
        const sourceLines = engineSourceOf(path).split('\n')
        for (const { name, line } of functions) {
          expect(Number.isInteger(line) && line >= 1, `${rule.id}: ${path}#${name}`).toBe(true)
          // An ancestor-qualified pin (ND.capitalGainsTaxablePct) anchors at
          // the member itself, so the member segment is what the line must
          // show, in declaration position: the name as its own token followed
          // by :, (, =, <, {, comma, or line end. A comment or prose mention of
          // the name does not qualify; a same-shaped call site still would,
          // which is why the synthetic anchor probes in the conformance
          // suite, not this bind, pin the resolution rule itself.
          const memberName = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1) : name
          const declares = new RegExp(`(?:^|[^\\w$.])${memberName}\\s*(?:[:(=<,{]|$)`, 'u')
          expect(
            declares.test(sourceLines[line - 1] ?? ''),
            `${rule.id}: ${path}#${name} line ${line} does not declare ${memberName}`,
          ).toBe(true)
        }
      }
    }
  })

  it('keeps fixtures and fixtureFiles consistent, with titles present in the scanned source', () => {
    for (const rule of report.rules) {
      const paths = [...new Set(rule.fixtures.map(({ path }) => path))]
      expect([...rule.fixtureFiles].sort(), rule.id).toEqual(paths.sort())
      for (const fixture of rule.fixtures) {
        expect(fixture.line, rule.id).toBeGreaterThanOrEqual(1)
        expect(fixture.tests.length, `${rule.id} ${fixture.path}`).toBeGreaterThan(0)
        const sourceLines = testSourceLinesOf(fixture.path)
        for (const test of fixture.tests) {
          // A test's it( sits inside its describeRule call, never before it,
          // and its published line is a deep-link anchor: that line of the
          // live source must carry an it( token of its own (the scanner's
          // boundary rule, so a longer identifier like submitIt( cannot
          // satisfy it), for EVERY fixture - an off-by-one that happens to
          // hold on one sample cannot pass. When the title's opening quote
          // shares the line (the formatter's normal shape), the title itself
          // must start there too, so landing on a SIBLING it( also fails.
          expect(test.line, `${rule.id} ${fixture.path}: ${test.title}`).toBeGreaterThanOrEqual(fixture.line)
          const line = sourceLines[test.line - 1] ?? ''
          const opened = /(?:^|[^\w$.])it\(\s*(['"`]?)/u.exec(line)
          expect(opened !== null, `${rule.id} ${fixture.path}#L${test.line}: ${test.title}`).toBe(true)
          const prefix = test.title.slice(0, 15)
          if (opened![1] !== '' && !/['"`\\]/u.test(prefix)) {
            expect(line, `${rule.id} ${fixture.path}#L${test.line} should open: ${test.title}`).toContain(prefix)
          }
        }
      }
    }
    // Spot-bind one fixture's titles to the live source text so the block
    // scan cannot drift into returning titles from a neighboring rule.
    const sample = report.rules.find((rule) => rule.fixtures.length > 0)
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
    for (const { title, line } of sample!.fixtures[0]!.tests) {
      expect(block, `${sample!.id}: ${title}`).toContain(title)
      // The published line is a deep-link anchor: that line of the live
      // source must actually start the it() the title came from.
      expect(source.split('\n')[line - 1] ?? '', `${sample!.id}: ${title}`).toContain('it(')
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
      symbolLineFor,
      recordModules: [['synthetic', syntheticRegistry]],
    })
    const alpha = syntheticReport.rules.find((rule) => rule.id === 'fixture-alpha')
    const beta = syntheticReport.rules.find((rule) => rule.id === 'fixture-beta')
    // Hand-counted lines in the synthetic source above: the it() lines are as
    // load-bearing as the titles now that the manifest publishes them.
    expect(alpha!.fixtures[0]!.tests).toEqual([{ title: 'alpha discriminates', line: 4 }])
    expect(alpha!.fixtures[0]!.path).toBe('packages/engine/src/rules/synthetic.test.ts')
    expect(alpha!.fixtures[0]!.line).toBe(3)
    expect(beta!.fixtures[0]!.tests).toEqual([{ title: 'gamma discriminates', line: 12 }])
    expect(beta!.fixtures[0]!.line).toBe(11)
    for (const rule of [alpha!, beta!]) {
      for (const fixture of rule.fixtures) {
        expect(fixture.tests.map(({ title }) => title), rule.id).not.toContain('beta belongs to nobody')
        expect(fixture.tests.map(({ title }) => title), rule.id).not.toContain('commented out title')
      }
    }
    expect(alpha!.fixtures[0]!.note).toBeNull()
    expect(beta!.fixtures[0]!.note).toBe('beta note')
  })

  it('captures an it() whose title the formatter broke onto its own line', () => {
    // The scanner's lookahead window must span the line break, and the
    // published line is the it( token's line, not the title's.
    const syntheticSource = [
      "describe" + "Rule('fixture-alpha', { readings: { a: 1, b: 2 }, accepted: 'a' }, ({ accepted }) => {",
      '  it(', //                                     line 2: the anchor
      "    'a very long title that the formatter pushed onto its own line discriminates',",
      '    () => { expect(1).toBe(accepted) },',
      '  )',
      '})',
    ].join('\n')
    const syntheticRegistry = {
      'fixture-alpha': syntheticRule('Alpha'),
    } as unknown as typeof TAX_RULE_REGISTRY
    const syntheticReport = buildCoverageReport({
      registry: syntheticRegistry,
      attestations: COVERAGE_ATTESTATIONS,
      baselineUnswept: BASELINE_UNSWEPT,
      testSources: { './synthetic.test.ts': syntheticSource },
      quoteFidelityLedger: null,
      dueOnFor: () => '2027-01-01',
      symbolLineFor,
      recordModules: [['synthetic', syntheticRegistry]],
    })
    const alpha = syntheticReport.rules.find((rule) => rule.id === 'fixture-alpha')
    expect(alpha!.fixtures[0]!.tests).toEqual([
      { title: 'a very long title that the formatter pushed onto its own line discriminates', line: 2 },
    ])
  })

  it('publishes unique authority identities with no quotedText', () => {
    for (const rule of report.rules) {
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
    // The rules now serialize into the shards, so the key contract and the leak
    // guards are asserted over the shard text — the index carries no rules at
    // all, and checking only it would pass vacuously.
    const published = report.shards.flatMap(
      (shard) => (JSON.parse(shard.json) as { rules: Record<string, unknown>[] }).rules,
    )
    expect(published.length).toBe(report.rules.length)
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
      'implementations',
      'implementedBy',
      'jurisdiction',
      'title',
      'verifiedOn',
      'volatility',
    ]
    for (const rule of published) {
      expect(Object.keys(rule).sort(), String(rule.id)).toEqual(documentedKeys)
    }
    // Key-level leak guards on the serialized text itself: a spread of the
    // registry record would reintroduce these long before a human noticed.
    for (const text of [report.json, ...report.shards.map(({ json }) => json)]) {
      expect(text).not.toContain('"quotedText":')
      expect(text).not.toContain('"statement":')
      expect(text).not.toContain('"authority":')
    }
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
        implementedByFunctions: ['packages/engine/src/rules/coverageReport.ts#buildCoverageReport'],
      },
    } as unknown as typeof TAX_RULE_REGISTRY
    const fixtureReport = buildCoverageReport({
      registry: fixtureRegistry,
      attestations: COVERAGE_ATTESTATIONS,
      baselineUnswept: BASELINE_UNSWEPT,
      testSources,
      quoteFidelityLedger: null,
      dueOnFor: () => '2027-01-01',
      // A hand-picked sentinel, so the expectation below proves the builder
      // publishes the injected resolver's line rather than deriving its own.
      symbolLineFor: () => 47,
      recordModules: [['synthetic', fixtureRegistry]],
    })
    const published = fixtureReport.shards.flatMap(
      (shard) => (JSON.parse(shard.json) as { rules: { id: string; authorities: unknown }[] }).rules,
    )
    const fixtureRule = published.find((rule) => rule.id === 'fixture-rule')
    expect(fixtureRule).toBeDefined()
    expect(fixtureRule!.authorities).toEqual([
      { kind: 'statute', citation: 'Fix. Code 1(a)', url: 'https://example.gov/1' },
      { kind: 'statute', citation: 'Fix. Code 1(b)', url: 'https://example.gov/1' },
    ])
    // Hand-written expectation, not a builder round-trip: the published
    // implementations must be exactly the declared pins grouped per file.
    expect((fixtureRule as { implementations?: unknown }).implementations).toEqual([
      { path: 'packages/engine/src/rules/coverageReport.ts', functions: [{ name: 'buildCoverageReport', line: 47 }] },
    ])
    for (const text of [fixtureReport.json, ...fixtureReport.shards.map(({ json }) => json)]) {
      expect(text).not.toContain('"quotedText":')
    }
  })
})
