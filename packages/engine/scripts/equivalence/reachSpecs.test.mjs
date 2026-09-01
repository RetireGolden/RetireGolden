import { readFileSync, readdirSync } from 'node:fs'
import { dirname, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { assertReachEntryAnchors, assertReachSpecSchema } from './usage.mjs'

const engineRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const specsDirectory = resolve(engineRoot, 'scripts/equivalence/specs')
const sourceDirectory = resolve(engineRoot, 'src')
const simulateSourcePath = normalize(resolve(sourceDirectory, 'projection/simulate.ts'))

function resolveReachEntries(entries) {
  return entries.map((entry) => ({
    ...entry,
    file: normalize(resolve(sourceDirectory, entry.file)),
  }))
}

function assertSimulateEntriesAnchored(entries, specFile) {
  for (const entry of entries.filter(({ file }) => file === simulateSourcePath)) {
    if ((entry.anchors?.length ?? 0) === 0) {
      throw new Error(
        `${specFile} entry ${entry.id} must anchor its positional simulate.ts range`,
      )
    }
  }
}

describe('committed equivalence reach specs', () => {
  it('keeps every anchor current and every simulate callsite anchored', () => {
    const specFiles = readdirSync(specsDirectory)
      .filter((file) => file.endsWith('.json'))
      .sort()
    expect(specFiles.length).toBeGreaterThan(0)

    for (const specFile of specFiles) {
      const specPath = resolve(specsDirectory, specFile)
      const spec = JSON.parse(readFileSync(specPath, 'utf8'))
      assertReachSpecSchema(spec, specPath)
      expect(Array.isArray(spec.entries), `${specFile} must carry entries`).toBe(true)
      const rawEntries = spec.entries ?? []
      const resolvedEntries = resolveReachEntries(rawEntries)
      assertSimulateEntriesAnchored(resolvedEntries, specFile)
      assertReachEntryAnchors(
        resolvedEntries,
        specPath,
        (file) => readFileSync(file, 'utf8'),
      )
    }
  })

  it('cannot bypass simulate anchors through a normalized path alias', () => {
    const entries = resolveReachEntries([{
      id: 'alias',
      file: 'projection/../projection/simulate.ts',
      lines: [1, 1],
    }])

    expect(() => assertSimulateEntriesAnchored(entries, 'alias.json')).toThrow(
      /alias\.json entry alias must anchor its positional simulate\.ts range/u,
    )
  })
})
