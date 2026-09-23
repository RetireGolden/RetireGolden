import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { WALKTHROUGHS, runWalkthrough, type Walkthrough } from './walkthroughs'

/**
 * The walkthrough evidence files, DOCS/operations/walkthroughs/<id>.json, are
 * what the site renders: each hand table beside the engine's figures at the
 * commit the site pins, plus the plan as built. This suite computes each file
 * from the walkthrough definitions and the engine and holds the committed copy
 * to it, the same way the engine's coverage freshness suite holds the
 * calculation index. `pnpm walkthroughs:export` runs this suite with
 * RG_WALKTHROUGH_EXPORT=1, which writes the files instead of comparing them.
 */

export const WALKTHROUGH_EVIDENCE_KIND = 'retiregolden.walkthrough-evidence'
export const WALKTHROUGH_EVIDENCE_VERSION = 1

const here = dirname(fileURLToPath(import.meta.url))
const evidenceDirectory = resolve(here, '../../../../../DOCS/operations/walkthroughs')
const exporting = process.env.RG_WALKTHROUGH_EXPORT === '1'

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

/** The it() title of the walkthrough's own test file, read from its source so the two cannot drift. */
function walkthroughTestNameOf(id: string): string {
  const source = readFileSync(join(here, 'walkthroughs', `${id}.test.ts`), 'utf8')
  const match = /^\s*it\('([^']+)'/mu.exec(source)
  if (!match) throw new Error(`walkthroughs/${id}.test.ts has no it() title`)
  return match[1]!
}

describe('walkthrough evidence files', () => {
  it('lists every walkthrough once, each with a test file and a derivation of its id', () => {
    const ids = WALKTHROUGHS.map((walkthrough) => walkthrough.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) {
      expect(existsSync(join(here, 'walkthroughs', `${id}.test.ts`)), `${id}.test.ts`).toBe(true)
      expect(existsSync(resolve(here, '../../../../../DOCS/walkthroughs', `${id}.md`)), `DOCS/walkthroughs/${id}.md`).toBe(true)
    }
    for (const walkthrough of WALKTHROUGHS) {
      expect(existsSync(resolve(here, '../../../../..', walkthrough.review)), walkthrough.review).toBe(true)
    }
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
      const committed = readFileSync(path, 'utf8').replace(/\r\n/g, '\n')
      expect(committed).toBe(computed)
    })
  }
})
