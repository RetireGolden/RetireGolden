#!/usr/bin/env node
/**
 * Every committed reach spec, measured against the blocks corpus in ONE
 * coverage pass, as the guard `reachGuard.test.mjs` runs in the unfiltered
 * engine suite.
 *
 * `equivalence.mjs reach` measures one spec per process, and each process
 * builds the corpus, loads the engine and runs every member in every mode
 * again: 32 specs cost 32 of those runs. Coverage is global, so one run over
 * the union of every spec's entries measures them all at once, and each spec's
 * verdict is then read from its own entries exactly as `reach` reads it: a
 * spec passes when every entry is reached and no entry holds a cold whole
 * line. Cold sub-line regions are reported by `reach`, not failed, and are
 * left out here.
 *
 * Nothing here differs from `corpus --name blocks` followed by `reach` on
 * each spec: the members are parsed and round-tripped through JSON as the
 * corpus file stores them, every spec is content-located and anchor-checked by
 * the same `usage.mjs` functions, and the recorder, modes and member runner
 * are the CLI's own modules. It imports and changes none of the files the
 * committed proofs pin.
 *
 *   node scripts/equivalence/reach-guard.mjs [--engine-src <dir>]
 *
 * Prints one line per spec, then one JSON line: `{ elapsedMs, members, specs:
 * [{ name, entries, unreached, cold }] }`, where `unreached` lists entry ids
 * and `cold` lists `{ id, file, lines: [{ line, text, window? }] }`; `window`
 * explains a line that PUBLICATION_WINDOWS names. Exit 0 when every spec
 * passes, 1 when any fails, 2 when compiled offsets do not match a file.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildCorpus } from './corpus/index.mjs'
import { configureEngineTree, loadEngine } from './engine-tree.mjs'
import { MODE_IDS, runMember, selectModes } from './modes.mjs'
import { ReachRecorder } from './reach.mjs'
import { assertReachEntryAnchors, assertReachSpecSchema, resolveReachSpecEntries } from './usage.mjs'

/**
 * Lines a member reaches only while a publication window is open, not by a
 * plan shape: when the window closes the line goes cold with no code change,
 * and the failure should say why rather than leave the reader to rediscover
 * it. Matched by the line's trimmed text and file, so the line number is read
 * from the run.
 */
const PUBLICATION_WINDOWS = [{
  file: 'projection/internal/annualAcaResultPublication.ts',
  text: "? ['income-tax-parameters-projected' as const]",
  explain: (line) =>
    `blocks:an1-povertyFloorThenOverCliff no longer reaches annualAcaResultPublication.ts line ${line}. ` +
    'That arm runs only while a year\'s ACA coverage block is published and its federal income-tax ' +
    'figures are still a stand-in, which an1\'s 2027 year was until 2027\'s federal income-tax figures ' +
    'landed. Move an1\'s second year (its ACA contract and its goal) to the next year whose ACA block ' +
    'is published before its income-tax figures.',
}]

const startedAt = Date.now()
const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const srcIndex = args.indexOf('--engine-src')
const src = configureEngineTree(srcIndex < 0 ? resolve(here, '..', '..', 'src') : args[srcIndex + 1])
const specsDir = resolve(here, 'specs')
const readSource = (file) => readFileSync(file, 'utf8')

const specs = readdirSync(specsDir)
  .filter((file) => file.endsWith('.json'))
  .sort()
  .map((file) => {
    const path = resolve(specsDir, file)
    const spec = JSON.parse(readFileSync(path, 'utf8'))
    assertReachSpecSchema(spec, path)
    const pathResolved = spec.entries.map((entry) => ({
      ...entry,
      file: resolve(src, entry.file).split('\\').join('/'),
    }))
    const entries = resolveReachSpecEntries(pathResolved, path, readSource)
    assertReachEntryAnchors(entries, path, readSource)
    return { name: file.replace(/\.json$/u, ''), entries }
  })

const recorder = new ReachRecorder(specs.flatMap((spec) => spec.entries))
let report
let members
try {
  await recorder.enable()
  const engine = await loadEngine()
  // Built after the engine loads, because the fixtures import it; stored as
  // the corpus file stores it, so each member runs from the same input bytes.
  members = (await buildCorpus('blocks')).members.map((member) => {
    const parsed = engine.parsePlan(member.plan)
    if (!parsed.ok) throw new Error(`corpus member "${member.id}" is invalid: ${parsed.issues.join('; ')}`)
    return JSON.parse(JSON.stringify({ ...member, plan: parsed.plan }))
  })
  await recorder.arm()
  const modes = selectModes(MODE_IDS)
  for (const member of members) {
    for (const mode of modes) runMember(engine, member, mode)
    await recorder.take(member.id)
  }
  report = recorder.report()
} finally {
  await recorder.close()
}

for (const [path, detail] of Object.entries(report.offsetsVerified)) {
  if (!detail.ok) {
    console.error(`REFUSING: compiled offsets do not match the file on disk for ${path}: ${JSON.stringify(detail)}`)
    process.exit(2)
  }
}

let offset = 0
const results = specs.map((spec) => {
  const entries = report.entries.slice(offset, offset + spec.entries.length)
  offset += spec.entries.length
  return {
    name: spec.name,
    entries: entries.length,
    unreached: entries.filter((entry) => entry.totalHits === 0).map((entry) => entry.id),
    cold: entries
      .filter((entry) => entry.totalHits > 0 && entry.coldLines.length > 0)
      .map((entry) => {
        const file = entry.file.slice(entry.file.lastIndexOf('/src/') + 5)
        return {
          id: entry.id,
          file,
          lines: entry.coldLines.map((cold) => {
            const window = PUBLICATION_WINDOWS.find((known) => known.file === file && known.text === cold.text)
            return window === undefined ? cold : { ...cold, window: window.explain(cold.line) }
          }),
        }
      }),
  }
})
for (const result of results) {
  const pass = result.unreached.length === 0 && result.cold.length === 0
  console.log(
    `${pass ? 'ok  ' : 'FAIL'} ${result.name}: ${result.entries} entries, ` +
      `${result.unreached.length} unreached, ${result.cold.length} with cold lines`,
  )
}
const elapsedMs = Date.now() - startedAt
console.log(JSON.stringify({ elapsedMs, members: members.length, specs: results }))
process.exitCode = results.every((result) => result.unreached.length === 0 && result.cold.length === 0) ? 0 : 1
