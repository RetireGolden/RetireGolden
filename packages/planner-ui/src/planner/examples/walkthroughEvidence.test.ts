import { describe, expect, it } from 'vitest'

// @ts-expect-error -- node builtin in a node-env test; the package tsconfig omits node types
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs'
// @ts-expect-error -- node builtin in a node-env test; the package tsconfig omits node types
import { dirname, join, resolve } from 'node:path'
// @ts-expect-error -- node builtin in a node-env test; the package tsconfig omits node types
import { fileURLToPath } from 'node:url'

import { WALKTHROUGHS, runWalkthrough, type Walkthrough } from './walkthroughs'

/**
 * The walkthrough evidence files, DOCS/operations/walkthroughs/<id>.json, are
 * what the site renders: each hand table beside the engine's figures at the
 * commit the site pins, plus the plan as built. This suite computes each file
 * from the walkthrough definitions and the engine and holds the committed copy
 * to it, the same way the engine's coverage freshness suite holds the
 * calculation index; it also refuses a leftover file for a walkthrough that
 * is no longer registered, since the site would keep rendering it.
 * `pnpm walkthroughs:export` runs this suite with RG_WALKTHROUGH_EXPORT=1,
 * which writes the files (and sweeps leftovers) instead of comparing them.
 */

export const WALKTHROUGH_EVIDENCE_KIND = 'retiregolden.walkthrough-evidence'
export const WALKTHROUGH_EVIDENCE_VERSION = 1

const here: string = dirname(fileURLToPath(import.meta.url))
const repoRoot: string = resolve(here, '../../../../..')
const evidenceDirectory: string = resolve(repoRoot, 'DOCS/operations/walkthroughs')
// `process` is read off globalThis: the package tsconfig omits node types, and vitest runs in node.
const exporting =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.RG_WALKTHROUGH_EXPORT === '1'

/** Stable JSON: keys in insertion order, numbers as JavaScript prints them, LF line endings. */
function render(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

export function walkthroughEvidenceOf(walkthrough: Walkthrough, testName: string) {
  const { plan, tables } = runWalkthrough(walkthrough)
  return {
    kind: WALKTHROUGH_EVIDENCE_KIND,
    version: WALKTHROUGH_EVIDENCE_VERSION,
    id: walkthrough.id,
    title: walkthrough.title,
    exampleId: walkthrough.exampleId,
    derivation: `DOCS/walkthroughs/${walkthrough.id}.md`,
    review: walkthrough.review,
    testFile: `packages/planner-ui/src/planner/examples/walkthroughs/${walkthrough.id}.test.ts`,
    testName,
    inputs: walkthrough.inputs,
    contractNotes: walkthrough.contractNotes,
    tables,
    plan,
  }
}

/**
 * Every it() or test() title in a walkthrough test file, single- or
 * double-quoted, in source order: what the engine's walkthrough census
 * publishes for that id. A walkthrough test file carries exactly one, so the
 * evidence file's `testName` and the census entry cannot drift.
 */
export function walkthroughTestTitlesOf(source: string): readonly string[] {
  return [...source.matchAll(/^\s*(?:it|test)\((['"])((?:(?!\1).)+)\1/gmu)].map((match) => match[2]!)
}

function walkthroughTestNameOf(id: string): string {
  const source: string = readFileSync(join(here, 'walkthroughs', `${id}.test.ts`), 'utf8')
  const titles = walkthroughTestTitlesOf(source)
  if (titles.length !== 1) {
    throw new Error(
      `walkthroughs/${id}.test.ts must carry exactly one it() or test() title (found ${titles.length}); ` +
        'the census publishes every title and the evidence file names one',
    )
  }
  return titles[0]!
}

/** The committed evidence files that are ours: every .json of the evidence kind in the directory. */
function committedEvidenceFiles(): readonly string[] {
  if (!existsSync(evidenceDirectory)) return []
  const names: string[] = readdirSync(evidenceDirectory)
  return names
    .filter((name: string) => name.endsWith('.json'))
    .filter((name: string) => {
      try {
        const text: string = readFileSync(join(evidenceDirectory, name), 'utf8')
        const parsed = JSON.parse(text) as { kind?: unknown }
        return parsed.kind === WALKTHROUGH_EVIDENCE_KIND
      } catch {
        return false
      }
    })
    .sort()
}

describe('walkthrough evidence files', () => {
  it('lists every walkthrough once, each with a test file, a derivation and a check of its id', () => {
    const ids = WALKTHROUGHS.map((walkthrough) => walkthrough.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const walkthrough of WALKTHROUGHS) {
      expect(existsSync(join(here, 'walkthroughs', `${walkthrough.id}.test.ts`)), `${walkthrough.id}.test.ts`).toBe(true)
      expect(existsSync(resolve(repoRoot, 'DOCS/walkthroughs', `${walkthrough.id}.md`)), `DOCS/walkthroughs/${walkthrough.id}.md`).toBe(true)
      expect(existsSync(resolve(repoRoot, walkthrough.review)), walkthrough.review).toBe(true)
    }
  })

  it('reads it() and test() titles in either quote style', () => {
    expect(walkthroughTestTitlesOf(`it('year 2026 equals the hand table', () => {})`)).toEqual(['year 2026 equals the hand table'])
    expect(walkthroughTestTitlesOf(`  test("year 2028's table", () => {})`)).toEqual(["year 2028's table"])
    expect(walkthroughTestTitlesOf(`it('a', () => {})\nit("b", () => {})`)).toEqual(['a', 'b'])
    expect(walkthroughTestTitlesOf(`describe('walkthrough', () => {})`)).toEqual([])
  })

  it(`${exporting ? 'sweeps' : 'refuses'} an evidence file for a walkthrough that is no longer registered`, () => {
    const registered = new Set(WALKTHROUGHS.map((walkthrough) => `${walkthrough.id}.json`))
    const leftovers = committedEvidenceFiles().filter((name) => !registered.has(name))
    if (exporting) {
      for (const name of leftovers) unlinkSync(join(evidenceDirectory, name))
      return
    }
    expect(leftovers, 'evidence files with no registered walkthrough: run pnpm walkthroughs:export').toEqual([])
  })

  for (const walkthrough of WALKTHROUGHS) {
    it(`${exporting ? 'writes' : 'matches'} DOCS/operations/walkthroughs/${walkthrough.id}.json`, () => {
      const computed = render(walkthroughEvidenceOf(walkthrough, walkthroughTestNameOf(walkthrough.id)))
      const path = join(evidenceDirectory, `${walkthrough.id}.json`)
      if (exporting) {
        mkdirSync(evidenceDirectory, { recursive: true })
        writeFileSync(path, computed, 'utf8')
        return
      }
      expect(existsSync(path), `${path} is missing: run pnpm walkthroughs:export`).toBe(true)
      const text: string = readFileSync(path, 'utf8')
      const committed = text.replace(/\r\n/g, '\n')
      expect(committed).toBe(computed)
    })
  }
})
