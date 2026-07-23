import { describe, expect, it } from 'vitest'

// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { readFileSync } from 'node:fs'
// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { fileURLToPath } from 'node:url'

import {
  IMPORT_PROVENANCE_KIND,
  IMPORT_PROVENANCE_VERSION,
  MAX_IMPORT_PROVENANCE_JSON_CHARS,
  type ImportProvenanceInput,
  describeSourceLocator,
  parseImportProvenance,
  serializeImportProvenance,
} from './provenance'

// A fully-populated payload, hand-built (never derived from serializer output)
// so a round-trip test compares against independent expected values.
const sampleInput = (): ImportProvenanceInput => ({
  planSchemaVersion: 7,
  engineVersion: '0.1.5',
  sources: [
    { file: 'brokerage-2025.csv', sha256: 'a'.repeat(64), bytes: 4096, mapper: 'brokerCsv' },
    { file: '1040-2025.json', sha256: 'b'.repeat(64), bytes: 512, mapper: 'tenForty' },
  ],
  mappings: [
    {
      source: 'Row 12, "Total Value"',
      detail: 'Set Taxable brokerage balance to $250,000',
      locator: { kind: 'csvRow', row: 12, column: 'Total Value' },
      confidence: 'exact',
      decision: { state: 'accepted', decidedAtIso: '2026-07-23T12:00:00.000Z' },
    },
    {
      source: 'Form 1040 line 9',
      detail: 'Estimated wage growth from AGI',
      locator: {
        kind: 'derived',
        from: [
          { kind: 'form1040', line: '9' },
          { kind: 'jsonPath', path: '$.income.wages' },
        ],
        note: 'blended',
      },
      confidence: 'derived',
      decision: { state: 'overridden', overrideValue: '3.0%', note: 'user knows their raise' },
    },
  ],
  unresolved: [
    {
      source: 'Row 40, "Crypto"',
      detail: 'No account type matches — add by hand',
      locator: { kind: 'none', note: 'no mapping target' },
      confidence: 'unmapped',
    },
  ],
})

describe('serializeImportProvenance / parseImportProvenance', () => {
  it('round-trips locators, confidence, decisions, hashes and unresolved items', () => {
    const input = sampleInput()
    const json = serializeImportProvenance(input, () => new Date('2026-07-23T00:00:00.000Z'))
    const parsed = parseImportProvenance(json)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.provenance.kind).toBe(IMPORT_PROVENANCE_KIND)
    expect(parsed.provenance.version).toBe(IMPORT_PROVENANCE_VERSION)
    expect(parsed.provenance.exportedAtIso).toBe('2026-07-23T00:00:00.000Z')
    expect(parsed.provenance.planSchemaVersion).toBe(7)
    expect(parsed.provenance.engineVersion).toBe('0.1.5')
    expect(parsed.provenance.sources).toEqual(input.sources)
    expect(parsed.provenance.mappings).toEqual(input.mappings)
    expect(parsed.provenance.unresolved).toEqual(input.unresolved)
  })

  it('tolerates unknown top-level fields (host extension) without failing', () => {
    const json = serializeImportProvenance(sampleInput())
    const extended = { ...(JSON.parse(json) as Record<string, unknown>), advisorReviewId: 'r-1', future: { x: 1 } }
    const parsed = parseImportProvenance(JSON.stringify(extended))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.provenance.mappings).toHaveLength(2)
  })

  it('rejects a wrong kind', () => {
    const parsed = parseImportProvenance(JSON.stringify({ kind: 'retiregolden.v2.backup', version: 1 }))
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(parsed.reason).toBe('wrong_kind')
  })

  it('refuses a newer envelope version', () => {
    const parsed = parseImportProvenance(JSON.stringify({ kind: IMPORT_PROVENANCE_KIND, version: 2 }))
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(parsed.reason).toBe('unsupported_version')
  })

  it('rejects non-JSON', () => {
    const parsed = parseImportProvenance('{ not json')
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(parsed.reason).toBe('not_json')
  })

  it('rejects input over the size cap', () => {
    const parsed = parseImportProvenance('x'.repeat(MAX_IMPORT_PROVENANCE_JSON_CHARS + 1))
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(parsed.reason).toBe('too_large')
  })

  it('rejects malformed contents behind a valid kind/version instead of passing them through', () => {
    const valid = JSON.parse(serializeImportProvenance(sampleInput())) as Record<string, unknown>
    const corruptions: Array<Record<string, unknown>> = [
      { ...valid, mappings: [null] },
      { ...valid, mappings: [{ source: 'x' }] }, // missing detail/locator/confidence
      { ...valid, sources: [{ file: 'a.csv', bytes: 1, mapper: 'brokerCsv' }] }, // no sha256
      { ...valid, unresolved: [{ source: 'x', detail: 'y', locator: { kind: 'nonsense' }, confidence: 'unmapped' }] },
      { ...valid, mappings: [{ source: 'x', detail: 'y', locator: { kind: 'csvRow', row: 1 }, confidence: 'certain' }] },
      { ...valid, mappings: [{ source: 'x', detail: 'y', locator: { kind: 'derived', from: 'not-an-array' }, confidence: 'derived' }] },
      { ...valid, mappings: [{ source: 'x', detail: 'y', locator: { kind: 'csvRow', row: 1 }, confidence: 'exact', decision: { state: 'maybe' } }] },
      { ...valid, exportedAtIso: 42 },
      { ...valid, sources: 'not-an-array' },
    ]
    for (const corrupt of corruptions) {
      const parsed = parseImportProvenance(JSON.stringify(corrupt))
      expect(parsed.ok, JSON.stringify(corrupt).slice(0, 120)).toBe(false)
      if (!parsed.ok) expect(parsed.reason).toBe('malformed')
    }
  })

  it('rejects invalid source identity, source indexes, and decision invariants', () => {
    const valid = JSON.parse(serializeImportProvenance(sampleInput())) as Record<string, unknown>
    const entry = (patch: Record<string, unknown>) => ({
      source: 'x',
      detail: 'y',
      locator: { kind: 'csvRow', row: 1 },
      confidence: 'exact',
      ...patch,
    })
    const corruptions: Array<Record<string, unknown>> = [
      { ...valid, sources: [{ file: 'a.csv', sha256: 'not-a-hash', bytes: 1, mapper: 'brokerCsv' }] },
      { ...valid, sources: [{ file: 'a.csv', sha256: 'A'.repeat(64), bytes: 1, mapper: 'brokerCsv' }] }, // uppercase
      { ...valid, sources: [{ file: 'a.csv', sha256: 'a'.repeat(64), bytes: -1, mapper: 'brokerCsv' }] },
      { ...valid, sources: [{ file: 'a.csv', sha256: 'a'.repeat(64), bytes: 1.5, mapper: 'brokerCsv' }] },
      { ...valid, mappings: [entry({ locator: { kind: 'csvRow', row: 1, sourceIndex: 99 } })] }, // out of bounds
      { ...valid, mappings: [entry({ locator: { kind: 'csvRow', row: 1, sourceIndex: 0.5 } })] },
      { ...valid, mappings: [entry({ locator: { kind: 'csvRow', row: 1, sourceIndex: -1 } })] },
      { ...valid, mappings: [entry({ decision: { state: 'overridden' } })] }, // no overrideValue
      { ...valid, mappings: [entry({ decision: { state: 'accepted', overrideValue: 'stray' } })] },
    ]
    for (const corrupt of corruptions) {
      const parsed = parseImportProvenance(JSON.stringify(corrupt))
      expect(parsed.ok, JSON.stringify(corrupt).slice(0, 140)).toBe(false)
      if (!parsed.ok) expect(parsed.reason).toBe('malformed')
    }
    // An empty sha256 is the documented no-Web-Crypto degradation — accepted.
    const unhashed = { ...valid, sources: [{ file: 'a.csv', sha256: '', bytes: 1, mapper: 'brokerCsv' }] }
    expect(parseImportProvenance(JSON.stringify(unhashed)).ok).toBe(true)
  })

  it('answers malformed — without throwing — on absurdly nested derived locators', () => {
    // Well past MAX_LOCATOR_DEPTH but shallow enough for JSON.stringify itself.
    let locator: unknown = { kind: 'none', note: 'leaf' }
    for (let i = 0; i < 100; i++) locator = { kind: 'derived', from: [locator] }
    const valid = JSON.parse(serializeImportProvenance(sampleInput())) as Record<string, unknown>
    const corrupt = { ...valid, mappings: [{ source: 'x', detail: 'y', locator, confidence: 'derived' }] }
    const parsed = parseImportProvenance(JSON.stringify(corrupt))
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(parsed.reason).toBe('malformed')
  })

  it('serializes only contract fields — a caller extension carrying content is dropped', () => {
    const input = sampleInput()
    ;(input.sources[0] as unknown as Record<string, unknown>)['raw'] = 'THE WHOLE DOCUMENT'
    ;(input.mappings[0] as unknown as Record<string, unknown>)['scratch'] = 'NOTES WITH PII'
    const json = serializeImportProvenance(input)
    expect(json).not.toContain('THE WHOLE DOCUMENT')
    expect(json).not.toContain('NOTES WITH PII')
    expect(json).not.toContain('"raw"')
  })

  it('round-trips the optional target plan path and multi-source sourceIndex', () => {
    const input = sampleInput()
    input.mappings[0] = {
      ...input.mappings[0]!,
      target: 'accounts[3]',
      locator: { kind: 'csvRow', row: 12, column: 'Total Value', sourceIndex: 1 },
    }
    const parsed = parseImportProvenance(serializeImportProvenance(input))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.provenance.mappings[0]!.target).toBe('accounts[3]')
    expect(parsed.provenance.mappings[0]!.locator).toEqual({ kind: 'csvRow', row: 12, column: 'Total Value', sourceIndex: 1 })
  })

  it('never embeds raw source-document content — a source carries only identity', () => {
    // A source contributes file name, hash, byte count, and mapper; the bytes
    // themselves never enter the envelope. Pin the exact key set so a future
    // field named `content`/`text`/`raw` can't slip in unnoticed.
    const secretBody = 'ACCOUNT 123456789 BALANCE 250000 SSN 000-00-0000'
    const input = sampleInput()
    const json = serializeImportProvenance(input)
    expect(json).not.toContain(secretBody)
    const envelope = JSON.parse(json) as { sources: Array<Record<string, unknown>> }
    for (const source of envelope.sources) {
      expect(Object.keys(source).sort()).toEqual(['bytes', 'file', 'mapper', 'sha256'])
    }
  })

  it('is published by the exports map as ./import-provenance → this module', () => {
    const packageJson = JSON.parse(
      readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8'),
    ) as { exports: Record<string, string> }
    expect(packageJson.exports['./import-provenance']).toBe('./src/import/provenance.ts')
  })
})

describe('describeSourceLocator', () => {
  it('renders each locator kind', () => {
    expect(describeSourceLocator({ kind: 'csvRow', row: 12 })).toBe('CSV row 12')
    expect(describeSourceLocator({ kind: 'csvRow', row: 12, column: 'Total' })).toBe('CSV row 12, column Total')
    expect(describeSourceLocator({ kind: 'jsonPath', path: '$.income.wages' })).toBe('JSON $.income.wages')
    expect(describeSourceLocator({ kind: 'form1040', line: '9' })).toBe('Form 1040 line 9')
    expect(describeSourceLocator({ kind: 'none', note: 'no target' })).toBe('no target')
  })

  it('renders a derived locator by recursing into its parts', () => {
    const text = describeSourceLocator({
      kind: 'derived',
      from: [
        { kind: 'form1040', line: '9' },
        { kind: 'csvRow', row: 3 },
      ],
      note: 'blended',
    })
    expect(text).toBe('derived from Form 1040 line 9, CSV row 3 (blended)')
  })
})
