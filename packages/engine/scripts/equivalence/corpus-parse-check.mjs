#!/usr/bin/env node
/**
 * Parses every member of every corpus tier the equivalence tool builds
 * (`corpus/index.mjs#CORPORA`) under the current tree's `parsePlan`, and
 * prints one JSON line: the tiers checked, how many members, and each member
 * the plan schema refuses with its issues. It builds members and parses them,
 * nothing more: no capture, dump or reach run.
 *
 * `equivalence.mjs corpus` refuses the first invalid member when a corpus is
 * built, but nothing builds a corpus in CI, so a schema change that
 * invalidates a member went unnoticed until someone next built one (#765's
 * schema v7 left blocks j1 and v3 refused). `corpusParses.test.mjs` runs this
 * in the unfiltered engine suite. It runs as its own process because the
 * engine tree is loaded through the resolve hook `configureEngineTree`
 * installs, which a vitest worker does not have.
 *
 *   node scripts/equivalence/corpus-parse-check.mjs [--engine-src <dir>] [--blocks <file>]
 *
 * `--blocks` reads the blocks tier from another copy of `corpus/blocks.mjs`
 * (a file beside this one's, so its own imports still resolve), which is how
 * the test proves it refuses a member the schema refuses.
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { CORPORA } from './corpus/index.mjs'
import { exampleMembers, examplesTierAvailable } from './corpus/examples.mjs'
import { configureEngineTree, loadEngine } from './engine-tree.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const option = (name) => {
  const index = args.indexOf(name)
  return index < 0 ? null : args[index + 1] ?? null
}
configureEngineTree(option('--engine-src') ?? resolve(here, '..', '..', 'src'))
const engine = await loadEngine()

const blocksFile = option('--blocks') ?? resolve(here, 'corpus', 'blocks.mjs')
const tiers = [...new Set(Object.values(CORPORA).flatMap((corpus) => corpus.tiers))].sort()
const checked = []
const skipped = []
const invalid = []
let members = 0
for (const tier of tiers) {
  let tierMembers
  if (tier === 'blocks') {
    tierMembers = await (await import(pathToFileURL(blocksFile).href)).blockMembers()
  } else if (tier === 'examples') {
    if (!examplesTierAvailable()) {
      skipped.push(tier)
      continue
    }
    tierMembers = await exampleMembers()
  } else {
    throw new Error(`corpus-parse-check does not know the tier "${tier}"`)
  }
  checked.push(tier)
  for (const member of tierMembers) {
    members += 1
    const parsed = engine.parsePlan(member.plan)
    if (!parsed.ok) invalid.push({ tier, id: member.id, issues: parsed.issues })
  }
}
process.stdout.write(`${JSON.stringify({ tiers: checked, skipped, members, invalid })}\n`)
