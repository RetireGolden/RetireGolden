/**
 * The stability contract of the `@retiregolden/planner-ui/complete-export`
 * subpath: it reads the real Pro manifest without re-serializing it, verifies
 * its exact manifest sidecar, and keeps compatibility labels liberal while
 * refusing broken integrity data.
 */

import { describe, expect, it } from 'vitest'

// @ts-expect-error -- node builtin in a node-env test; the app tsconfig omits node types
import { readFileSync } from 'node:fs'

import * as completeExportSubpath from '@retiregolden/planner-ui/complete-export'
import * as completeExportSource from './completeExport'

import {
  COMPLETE_EXPORT_FORMAT,
  COMPLETE_EXPORT_FORMAT_VERSION,
  MAX_COMPLETE_EXPORT_MANIFEST_BYTES,
  completeExportSha256Hex,
  parseCompleteExportManifest,
  parseManifestSha256Line,
  verifyComponentBytes,
  verifyManifestText,
  type CompleteExportComponentEntry,
} from './completeExport'

const fixtureBytes = readFileSync(new URL('./completeExportManifest.fixture.json', import.meta.url))
const fixtureText = fixtureBytes.toString('utf8')
const manifestSha256Line = 'd36fa156007130ce9fd25a886ba5d94b29053ab3a07e5db872e135ad93158674  manifest.json\n'

function fixtureObject(): Record<string, unknown> {
  return JSON.parse(fixtureText) as Record<string, unknown>
}

function entries(raw: Record<string, unknown>, key: string): Record<string, unknown>[] {
  return raw[key] as Record<string, unknown>[]
}

describe('complete-export subpath', () => {
  it('is published by the exports map as ./complete-export → this module', () => {
    const packageJson = JSON.parse(
      readFileSync(new URL('../../package.json', import.meta.url)).toString('utf8'),
    ) as { exports: Record<string, string> }
    expect(packageJson.exports['./complete-export']).toBe('./src/data/completeExport.ts')
  })

  it('resolves from the public subpath and re-exports this module', () => {
    expect(Object.keys(completeExportSubpath).sort()).toEqual(Object.keys(completeExportSource).sort())
    expect(completeExportSubpath.COMPLETE_EXPORT_FORMAT).toBe(COMPLETE_EXPORT_FORMAT)
    expect(completeExportSubpath.COMPLETE_EXPORT_FORMAT_VERSION).toBe(COMPLETE_EXPORT_FORMAT_VERSION)
    expect(completeExportSubpath.parseCompleteExportManifest).toBe(parseCompleteExportManifest)
  })
})

describe('complete export manifest fixture', () => {
  it('reads the byte-exact Pro manifest and verifies its canonical sidecar', async () => {
    const parsed = parseCompleteExportManifest(fixtureText)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return

    expect(parsed.manifest.format).toBe(COMPLETE_EXPORT_FORMAT)
    expect(parsed.manifest.formatVersion).toBe(COMPLETE_EXPORT_FORMAT_VERSION)
    expect(parsed.manifest.components).toHaveLength(23)
    expect(parsed.manifest.components.map((component) => component.path)).toEqual(
      expect.arrayContaining(['advisor/audit-ledger.jsonl', 'advisor/unlock-evidence.json']),
    )
    expect(parsed.manifest.omissions).toHaveLength(13)
    expect(parsed.manifest.omissions.every((omission) => omission.detail.length > 0)).toBe(true)
    expect(parsed.manifest.stores.find((store) => store.storeId === 'advisor-audit-ledger')?.disposition).toBe(
      'included',
    )
    expect(parsed.manifest.totals.components).toBe(parsed.manifest.components.length)
    expect(parsed.manifest.totals.bytes).toBe(
      parsed.manifest.components.reduce((sum, component) => sum + component.byteLength, 0),
    )
    expect(parsed.manifest.totals.logicalRecords).toBe(
      parsed.manifest.components.reduce((sum, component) => sum + component.logicalCount, 0),
    )
    await expect(verifyManifestText(fixtureText, manifestSha256Line)).resolves.toEqual({ ok: true })

    // Canonicalization belongs to the Pro producer: preserve its key order and
    // assert only the documented terminal newline, never a re-serialized form.
    expect(fixtureText.endsWith('\n')).toBe(true)
    expect(fixtureText.endsWith('\n\n')).toBe(false)
    expect(() => JSON.parse(fixtureText)).not.toThrow()
  })

  it('hashes empty UTF-8 input with SHA-256', async () => {
    await expect(completeExportSha256Hex('')).resolves.toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    )
  })
})

describe('complete export verification helpers', () => {
  const component: CompleteExportComponentEntry = {
    path: 'example/component.json',
    mediaType: 'application/json',
    schema: 'example.component',
    schemaVersion: 1,
    byteLength: 3,
    sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    logicalCount: 1,
    restorePolicy: 'insert',
    edition: 'example',
  }

  it('checks component byte length before its SHA-256', async () => {
    const correctBytes = new TextEncoder().encode('abc')
    await expect(verifyComponentBytes(component, correctBytes)).resolves.toEqual({ ok: true })
    await expect(verifyComponentBytes(component, correctBytes.subarray(0, 2))).resolves.toEqual({
      ok: false,
      reason: 'byte_length_mismatch',
    })
    await expect(verifyComponentBytes(component, new TextEncoder().encode('abd'))).resolves.toEqual({
      ok: false,
      reason: 'sha256_mismatch',
    })
  })

  it('refuses malformed manifest sidecar lines', () => {
    expect(parseManifestSha256Line(manifestSha256Line.slice(0, -1))).toEqual({ ok: false })
    expect(parseManifestSha256Line(manifestSha256Line.replace('  ', ' '))).toEqual({ ok: false })
    expect(parseManifestSha256Line(manifestSha256Line.replace(/^d/, 'D'))).toEqual({ ok: false })
  })
})

describe('parseCompleteExportManifest refusals and tolerances', () => {
  const expectRefusal = (mutate: (raw: Record<string, unknown>) => void, reason: string) => {
    const raw = fixtureObject()
    mutate(raw)
    expect(parseCompleteExportManifest(JSON.stringify(raw))).toMatchObject({ ok: false, reason })
  }

  it('refuses incompatible or malformed integrity data', () => {
    expectRefusal((raw) => {
      raw['format'] = 'other.complete-export'
    }, 'not_complete_export')
    expectRefusal((raw) => {
      raw['formatVersion'] = 2
    }, 'newer_than_supported')
    expectRefusal((raw) => {
      raw['formatVersion'] = 0
    }, 'malformed')
    expectRefusal((raw) => {
      const totals = raw['totals'] as Record<string, unknown>
      totals['bytes'] = 4288
    }, 'malformed')
    expectRefusal((raw) => {
      const totals = raw['totals'] as Record<string, unknown>
      totals['components'] = 22
    }, 'malformed')
    expectRefusal((raw) => {
      const totals = raw['totals'] as Record<string, unknown>
      totals['logicalRecords'] = 6
    }, 'malformed')
    expectRefusal((raw) => {
      entries(raw, 'components')[0]!['byteLength'] = 2 ** 53
    }, 'malformed')
    expectRefusal((raw) => {
      entries(raw, 'components')[0]!['path'] = '/absolute/path.json'
    }, 'malformed')
    expectRefusal((raw) => {
      entries(raw, 'components')[0]!['path'] = 'manifest.json'
    }, 'malformed')
    expectRefusal((raw) => {
      // Individually safe byteLengths whose IEEE sum collides with a rounded
      // total: without the overflow guard this parses "consistently".
      const components = entries(raw, 'components')
      components[0]!['byteLength'] = Number.MAX_SAFE_INTEGER
      components[1]!['byteLength'] = 2
      const totals = raw['totals'] as Record<string, unknown>
      totals['bytes'] = Number.MAX_SAFE_INTEGER + 2
    }, 'malformed')
    expectRefusal((raw) => {
      const component = entries(raw, 'components')[0]!
      const totals = raw['totals'] as Record<string, unknown>
      const limits = raw['limits'] as Record<string, unknown>
      limits['maxComponentBytes'] = 100
      component['byteLength'] = 101
      totals['bytes'] = (totals['bytes'] as number) - 194 + 101
    }, 'malformed')
    expectRefusal((raw) => {
      const limits = raw['limits'] as Record<string, unknown>
      limits['maxEntries'] = 24
    }, 'malformed')
    expectRefusal((raw) => {
      const snapshot = raw['snapshot'] as Record<string, unknown>
      snapshot['completedAtUtc'] = '2026-08-18T11:59:59.000Z'
    }, 'malformed')
    expectRefusal((raw) => {
      const free = (raw['compatibility'] as Record<string, Record<string, unknown>>)['free']!
      free['plansComponent'] = 'advisor/audit-ledger.jsonl'
    }, 'malformed')
    expectRefusal((raw) => {
      // Sub-millisecond precision would let Date.parse comparisons truncate
      // away a real ordering difference, so the timestamp grammar refuses it.
      const snapshot = raw['snapshot'] as Record<string, unknown>
      snapshot['startedAtUtc'] = '2026-08-18T12:00:00.0009Z'
    }, 'malformed')
    expectRefusal((raw) => {
      entries(raw, 'components')[0]!['path'] = 'MANIFEST.JSON'
    }, 'malformed')
    expectRefusal((raw) => {
      const pro = (raw['compatibility'] as Record<string, Record<string, unknown>>)['pro']!
      pro['minimumContainerVersion'] = 2
    }, 'malformed')
    expectRefusal((raw) => {
      const free = (raw['compatibility'] as Record<string, Record<string, unknown>>)['free']!
      delete free['reason']
    }, 'malformed')
    expectRefusal((raw) => {
      const limits = raw['limits'] as Record<string, unknown>
      limits['maxManifestBytes'] = 10
    }, 'malformed')
    expectRefusal((raw) => {
      // Case-folded duplicate: both entries extract to one path on Windows.
      const components = entries(raw, 'components')
      components.push({ ...components[0]!, path: (components[0]!['path'] as string).toUpperCase() })
    }, 'malformed')
    expectRefusal((raw) => {
      const components = entries(raw, 'components')
      components.push({ ...components[0]! })
    }, 'malformed')
    expectRefusal((raw) => {
      entries(raw, 'components')[0]!['path'] = '../evil'
    }, 'malformed')
    expectRefusal((raw) => {
      entries(raw, 'components')[0]!['path'] = 'evil\\path.json'
    }, 'malformed')
    expectRefusal((raw) => {
      const component = entries(raw, 'components')[0]!
      component['sha256'] = String(component['sha256']).toUpperCase()
    }, 'malformed')
    expectRefusal((raw) => {
      raw['plaintext'] = false
    }, 'malformed')
    expectRefusal((raw) => {
      const store = entries(raw, 'stores').find((entry) => entry['component'] !== undefined)!
      store['component'] = 'missing/component.json'
    }, 'malformed')
  })

  it('refuses every malformed contract field with a named detail', () => {
    const cases: Array<[string, (raw: Record<string, unknown>) => void]> = [
      ['exportId empty', (raw) => void (raw['exportId'] = '')],
      ['createdAtUtc not a timestamp', (raw) => void (raw['createdAtUtc'] = 'yesterday')],
      ['createdAtUtc impossible date', (raw) => void (raw['createdAtUtc'] = '2026-02-30T00:00:00Z')],
      ['app missing', (raw) => void delete raw['app']],
      ['app.product empty', (raw) => void (((raw['app'] as Record<string, unknown>)['product'] = ''))],
      ['app.version empty', (raw) => void (((raw['app'] as Record<string, unknown>)['version'] = ''))],
      ['app.platform empty', (raw) => void (((raw['app'] as Record<string, unknown>)['platform'] = ''))],
      ['purpose empty', (raw) => void (raw['purpose'] = '')],
      ['snapshot missing', (raw) => void delete raw['snapshot']],
      ['snapshot.generation negative', (raw) => void (((raw['snapshot'] as Record<string, unknown>)['generation'] = -1))],
      ['snapshot.startedAtUtc bad', (raw) => void (((raw['snapshot'] as Record<string, unknown>)['startedAtUtc'] = '12:00'))],
      ['components not an array', (raw) => void (raw['components'] = {})],
      ['component not an object', (raw) => void ((raw['components'] as unknown[])[0] = 7)],
      ['component.mediaType empty', (raw) => void (entries(raw, 'components')[0]!['mediaType'] = '')],
      ['component.schema empty', (raw) => void (entries(raw, 'components')[0]!['schema'] = '')],
      ['component.schemaVersion zero', (raw) => void (entries(raw, 'components')[0]!['schemaVersion'] = 0)],
      ['component.byteLength negative', (raw) => void (entries(raw, 'components')[0]!['byteLength'] = -1)],
      ['component.byteLength fractional', (raw) => void (entries(raw, 'components')[0]!['byteLength'] = 1.5)],
      ['component.sha256 short', (raw) => void (entries(raw, 'components')[0]!['sha256'] = 'abc')],
      ['component.logicalCount negative', (raw) => void (entries(raw, 'components')[0]!['logicalCount'] = -1)],
      ['component.restorePolicy empty', (raw) => void (entries(raw, 'components')[0]!['restorePolicy'] = '')],
      ['component.edition empty', (raw) => void (entries(raw, 'components')[0]!['edition'] = '')],
      ['component.path with colon', (raw) => void (entries(raw, 'components')[0]!['path'] = 'c:evil.json')],
      ['component.path with control char', (raw) => void (entries(raw, 'components')[0]!['path'] = 'a' + String.fromCharCode(7) + 'b.json')],
      ['component.path dot segment', (raw) => void (entries(raw, 'components')[0]!['path'] = 'a/./b.json')],
      ['component.path empty segment', (raw) => void (entries(raw, 'components')[0]!['path'] = 'a//b.json')],
      ['stores not an array', (raw) => void (raw['stores'] = 'stores')],
      ['store.storeId empty', (raw) => void (entries(raw, 'stores')[0]!['storeId'] = '')],
      ['store duplicate storeId', (raw) => {
        const stores = entries(raw, 'stores')
        stores.push({ storeId: stores[0]!['storeId'], disposition: 'excluded' })
      }],
      ['store.disposition empty', (raw) => void (entries(raw, 'stores')[0]!['disposition'] = '')],
      ['store.sourceCount negative', (raw) => void (entries(raw, 'stores')[0]!['sourceCount'] = -2)],
      ['store.reasonCode empty', (raw) => void (entries(raw, 'stores')[0]!['reasonCode'] = '')],
      ['store.detail non-string', (raw) => void (entries(raw, 'stores')[0]!['detail'] = 9)],
      ['omissions not an array', (raw) => void (raw['omissions'] = null)],
      ['omission.storeId empty', (raw) => void (entries(raw, 'omissions')[0]!['storeId'] = '')],
      ['omission.reasonCode empty', (raw) => void (entries(raw, 'omissions')[0]!['reasonCode'] = '')],
      ['omission.detail empty', (raw) => void (entries(raw, 'omissions')[0]!['detail'] = '')],
      ['totals missing', (raw) => void delete raw['totals']],
      ['compatibility missing', (raw) => void delete raw['compatibility']],
      ['compatibility.pro missing', (raw) => void delete (raw['compatibility'] as Record<string, unknown>)['pro']],
      ['compatibility.pro.importable non-boolean', (raw) => void (((raw['compatibility'] as Record<string, Record<string, unknown>>)['pro']!['importable'] = 'yes'))],
      ['compatibility.pro.minimumContainerVersion zero', (raw) => void (((raw['compatibility'] as Record<string, Record<string, unknown>>)['pro']!['minimumContainerVersion'] = 0))],
      ['compatibility.free missing', (raw) => void delete (raw['compatibility'] as Record<string, unknown>)['free']],
      ['compatibility.free.importableContainer non-boolean', (raw) => void (((raw['compatibility'] as Record<string, Record<string, unknown>>)['free']!['importableContainer'] = 1))],
      ['compatibility.free.reason non-string', (raw) => void (((raw['compatibility'] as Record<string, Record<string, unknown>>)['free']!['reason'] = 4))],
      ['limits missing', (raw) => void delete raw['limits']],
      ['limits.maxTotalStoredBytes zero', (raw) => void (((raw['limits'] as Record<string, unknown>)['maxTotalStoredBytes'] = 0))],
      ['limits.maxEntries non-integer', (raw) => void (((raw['limits'] as Record<string, unknown>)['maxEntries'] = 1.5))],
      ['limits.maxComponentBytes zero', (raw) => void (((raw['limits'] as Record<string, unknown>)['maxComponentBytes'] = 0))],
      ['limits.maxJsonlLineBytes zero', (raw) => void (((raw['limits'] as Record<string, unknown>)['maxJsonlLineBytes'] = 0))],
      ['limits.maxJsonNesting zero', (raw) => void (((raw['limits'] as Record<string, unknown>)['maxJsonNesting'] = 0))],
    ]
    for (const [label, mutate] of cases) {
      const raw = fixtureObject()
      mutate(raw)
      const parsed = parseCompleteExportManifest(JSON.stringify(raw))
      expect(parsed, label).toMatchObject({ ok: false, reason: 'malformed' })
    }
  })

  it('refuses oversized and invalid JSON text', () => {
    expect(parseCompleteExportManifest(' '.repeat(MAX_COMPLETE_EXPORT_MANIFEST_BYTES + 1))).toEqual({
      ok: false,
      reason: 'too_large',
    })
    expect(parseCompleteExportManifest('not json')).toEqual({ ok: false, reason: 'invalid_json' })
  })

  it('drops unknown fields and accepts future label values', () => {
    const raw = fixtureObject()
    raw['futureTopLevel'] = { retainedByTheProducer: true }
    const component = entries(raw, 'components')[0]!
    component['futureComponentField'] = 'ignored'
    raw['purpose'] = 'future-purpose'
    component['edition'] = 'future-edition'
    entries(raw, 'stores')[0]!['disposition'] = 'future-disposition'

    const parsed = parseCompleteExportManifest(JSON.stringify(raw))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.manifest.purpose).toBe('future-purpose')
    expect(parsed.manifest.components[0]!.edition).toBe('future-edition')
    expect(parsed.manifest.stores[0]!.disposition).toBe('future-disposition')
    expect(parsed.manifest).not.toHaveProperty('futureTopLevel')
    expect(parsed.manifest.components[0]).not.toHaveProperty('futureComponentField')
  })

  it('accepts the documented Free bridge: portable/plans-v2.json, free-compatible', () => {
    const raw = fixtureObject()
    const components = entries(raw, 'components')
    components.push({
      ...components[0]!,
      path: 'portable/plans-v2.json',
      mediaType: 'application/json',
      edition: 'free-compatible',
      restorePolicy: 'compatibility-only',
      byteLength: 0,
      logicalCount: 0,
      sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    })
    const totals = raw['totals'] as Record<string, unknown>
    totals['components'] = (totals['components'] as number) + 1
    const free = (raw['compatibility'] as Record<string, Record<string, unknown>>)['free']!
    free['plansComponent'] = 'portable/plans-v2.json'
    const parsed = parseCompleteExportManifest(JSON.stringify(raw))
    expect(parsed).toMatchObject({ ok: true })
  })

  it('never copies __proto__ or constructor keys onto the returned manifest', () => {
    const withProto = fixtureText.replace(
      '"format":',
      '"__proto__":{"polluted":true},"constructor":{"polluted":true},"format":',
    )
    const parsed = parseCompleteExportManifest(withProto)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(Object.getOwnPropertyNames(parsed.manifest)).not.toContain('__proto__')
    expect(Object.prototype.hasOwnProperty.call(parsed.manifest, 'constructor')).toBe(false)
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined()
  })
})
