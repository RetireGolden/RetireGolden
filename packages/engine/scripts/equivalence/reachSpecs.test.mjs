import { readFileSync, readdirSync } from 'node:fs'
import { dirname, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  assertReachEntryAnchors,
  assertReachSpecSchema,
  resolveReachSpecEntries,
} from './usage.mjs'

const engineRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const specsDirectory = resolve(engineRoot, 'scripts/equivalence/specs')
const sourceDirectory = resolve(engineRoot, 'src')
function resolveReachEntries(entries) {
  return entries.map((entry) => ({
    ...entry,
    file: normalize(resolve(sourceDirectory, entry.file)),
  }))
}

describe('committed equivalence reach specs', () => {
  it('keeps every committed positional source range uniquely content-located', () => {
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
      const pathResolved = resolveReachEntries(rawEntries)
      const resolvedEntries = resolveReachSpecEntries(
        pathResolved,
        specPath,
        (file) => readFileSync(file, 'utf8'),
      )
      assertReachEntryAnchors(
        resolvedEntries,
        specPath,
        (file) => readFileSync(file, 'utf8'),
      )
      for (let index = 0; index < rawEntries.length; index++) {
        const raw = rawEntries[index]
        const resolved = resolvedEntries[index]
        const delta = resolved.lines[0] - raw.lines[0]
        expect(resolved.lines[1] - raw.lines[1], `${specFile}:${raw.id}`).toBe(delta)
        expect(resolved.anchors?.length, `${specFile}:${raw.id}`).toBe(raw.anchors?.length)
        for (let anchorIndex = 0; anchorIndex < (raw.anchors?.length ?? 0); anchorIndex++) {
          expect(resolved.anchors[anchorIndex].line - raw.anchors[anchorIndex].line).toBe(delta)
          expect(resolved.anchors[anchorIndex].text).toBe(raw.anchors[anchorIndex].text.trim())
        }
      }
    }
  })

  it('cannot bypass mandatory anchors through a normalized path alias', () => {
    const entries = resolveReachEntries([{
      id: 'alias',
      file: 'projection/../projection/simulate.ts',
      lines: [1, 1],
    }])

    expect(() => resolveReachSpecEntries(entries, 'alias.json', () => '')).toThrow(
      /alias\.json entry "alias" must anchor its positional source range/u,
    )
  })
})
