import { readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { assertReachEntryAnchors, assertReachSpecSchema } from './usage.mjs'

const engineRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const specsDirectory = resolve(engineRoot, 'scripts/equivalence/specs')
const sourceDirectory = resolve(engineRoot, 'src')

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
      for (const entry of rawEntries.filter(({ file }) => file === 'projection/simulate.ts')) {
        expect(
          entry.anchors?.length ?? 0,
          `${specFile} entry ${entry.id} must anchor its positional simulate.ts range`,
        ).toBeGreaterThan(0)
      }
      const resolvedEntries = rawEntries.map((entry) => ({
        ...entry,
        file: resolve(sourceDirectory, entry.file),
      }))
      assertReachEntryAnchors(
        resolvedEntries,
        specPath,
        (file) => readFileSync(file, 'utf8'),
      )
    }
  })
})
