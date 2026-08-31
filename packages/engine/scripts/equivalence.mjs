#!/usr/bin/env node
/**
 * DIFFERENTIAL EQUIVALENCE DUMP — the engine compared against ITSELF across two
 * source trees, for refactors that must not move a single bit.
 *
 * TERMINOLOGY, deliberately. `DOCS/testing.md` reserves "oracle" for a
 * CORRECTNESS oracle and says the app is never its own oracle. This is not one.
 * It can say "nothing moved". It can NEVER say "this is right".
 *
 * WHAT IT IS FOR. `packages/engine/src/projection/simulate.ts` is being broken
 * up one annual phase at a time. Behaviour must be byte-for-byte identical for
 * every plan and every year, and "the tests pass" is not evidence of that: a
 * helper that silently under-produced rows once passed all 5,495 of them. So
 * each phase is verified by capturing the COMPLETE output of a corpus before
 * and after, at full precision, and comparing every leaf.
 *
 * WHY IT IS COMMITTED. Every earlier phase rebuilt this from scratch in a
 * scratch directory and it died with the pull request, taking its corpus, its
 * calibration and its reach evidence with it. Here it sits beside
 * `pack-smoke.mjs` and `rules-coverage.mjs`; `scripts/` is not published (the
 * package ships `files: ["dist"]`), so nothing about it reaches a consumer.
 *
 * WHAT IT CANNOT SEE, stated up front so no one reads a PASS as more than it is:
 *   - object IDENTITY. A caller that publishes a field-for-field REBUILD of a
 *     helper's payload dumps identically to one that publishes the helper's own
 *     object. A byte-identical dump likewise passes a helper that is never
 *     called at all — measured on phase 3, not assumed. Delegation and identity
 *     are a delegation test's job (`toBe`), never this tool's.
 *   - branches the corpus does not execute. That is what `reach` is for, and
 *     its output names the cold lines rather than leaving them implied. Read
 *     `reach`'s verdict precisely: it FAILS on a spec entry no member reaches
 *     and on a spec entry containing a line no member executed, and it reports
 *     but does not fail an untaken SUB-LINE branch (a cold region), because an
 *     untaken defensive `?? 0` arm is a legitimate steady state. A green
 *     `reach` therefore means "every line of every named range ran", never
 *     "every branch inside them was taken".
 *   - anything downstream of a mode the capture did not run. See `modes.mjs`.
 *   - a constant whose neighbourhood the corpus does not straddle. Reaching the
 *     line that reads `youngestAge < 62` is not the same as having a borrower
 *     aged 61 and one aged 62; that is a unit test's job, and this tool will
 *     report IDENTICAL for a threshold moved past every member. Measured on
 *     block C, which is why `internal/hecmLineOpenings.test.ts` pins that
 *     constant from both sides.
 *
 * CAPTURE FROM AN IMMUTABLE TREE. `describeTree()` samples `git status` once,
 * at the start of a capture. A worktree another session writes to DURING the
 * run therefore yields a manifest that says `observed <sha>` with no DIRTY flag
 * while some of the numbers came from different bytes — and that is the one
 * failure mode that makes a byte-identical PASS meaningless. It is not
 * hypothetical: 11 of ~436 captures taken from this shared worktree during
 * review deviated, in two windows that coincide with source-file writes by
 * another process, while ~316 interleaved captures of the same commit
 * materialized by `git archive` never deviated once. So point `--engine-src` at
 * a `git archive <sha>` directory (`--engine-label <sha>` records the
 * provenance as `declared`), or at minimum run the capture twice and require
 * the same `dumpSha256`.
 *
 * COMMANDS
 *   corpus  --name <corpus> --out <corpus.json> [--engine-src <dir>]
 *   capture --corpus <corpus.json> --out <dump.json> [--engine-src <dir>]
 *           [--engine-label <sha>] [--modes a,b] [--member <id>]...
 *   compare --base <dump.json> --head <dump.json> [--limit 12]
 *   reach   --corpus <corpus.json> --spec <spec.json> [--engine-src <dir>]
 *           [--modes a,b] [--member <id>]... [--out <reach.json>]
 *   list
 *
 * EXIT CODES
 *   0  identical / every spec entry reached with no cold line inside it
 *   1  any difference, or a spec entry no corpus member reaches, or a spec
 *      entry that IS reached but contains a line no member ever executed
 *   2  usage error, INCOMPARABLE inputs — two dumps whose schema, corpus hash
 *      or mode list disagree are refused rather than compared; the throwaway
 *      comparator this replaced matched on member/mode and printed `MISSING`
 *      for the rest, which is a false-negative generator — or a CORRUPT dump,
 *      one whose stored per-entry `sha256` does not re-derive from that
 *      entry's own `value`.
 *
 * `--out` is required for `corpus` and `capture`, the two commands that write
 * a large file, and optional for `reach`. Nothing defaults to a path inside
 * the repository, so a dump — 71 MB for the `full` corpus, 46 MB for
 * `examples` and 25 MB for `blocks` — can never be staged by accident and
 * `.gitignore` needs no new entry.
 *
 * Run from anywhere: `node packages/engine/scripts/equivalence.mjs …`, or
 * `pnpm --filter @retiregolden/engine equivalence …`.
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { diffEncoded, encode, encodeToText } from './equivalence/encode.mjs'
import {
  configureEngineTree,
  describeTree,
  loadEngine,
  resolvedDependencyVersions,
} from './equivalence/engine-tree.mjs'
import { MODE_IDS, runMember } from './equivalence/modes.mjs'
import { ReachRecorder } from './equivalence/reach.mjs'
import { CORPORA, CORPUS_NAMES, buildCorpus, examplesTierLocation } from './equivalence/corpus/index.mjs'
import { UsageError, modesFromFlag, assertReachSpecSchema } from './equivalence/usage.mjs'

const SCHEMA = 'retiregolden.equivalence-dump/1'
const CORPUS_SCHEMA = 'retiregolden.equivalence-corpus/1'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const engineDir = resolve(scriptDir, '..')
const DEFAULT_ENGINE_SRC = resolve(engineDir, 'src')

const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex')

function usage() {
  return `Differential equivalence dump for @retiregolden/engine.

Usage:
  node packages/engine/scripts/equivalence.mjs corpus  --name <corpus> --out <corpus.json> [--engine-src <dir>]
  node packages/engine/scripts/equivalence.mjs capture --corpus <corpus.json> --out <dump.json>
                                                      [--engine-src <dir>] [--engine-label <sha>]
                                                      [--modes ${MODE_IDS.join(',')}] [--member <id>]...
  node packages/engine/scripts/equivalence.mjs compare --base <dump.json> --head <dump.json> [--limit 12]
  node packages/engine/scripts/equivalence.mjs reach   --corpus <corpus.json> --spec <spec.json>
                                                      [--engine-src <dir>] [--modes ...] [--member <id>]... [--out <reach.json>]
  node packages/engine/scripts/equivalence.mjs list

Corpora: ${CORPUS_NAMES.join(', ')}
Modes:   ${MODE_IDS.join(', ')}

Exit: 0 identical / all reached with no cold lines  ·  1 a difference, an unreached spec entry, or a
      cold line inside a reached one  ·  2 usage, incomparable inputs, or a corrupt dump.
--out is mandatory for corpus and capture (optional for reach): a dump is large and must never land
inside the repository by default.`
}

function takeValue(argv, i, name) {
  const value = argv[i + 1]
  if (value === undefined || value.startsWith('--')) throw new UsageError(`${name} requires a value`)
  return value
}

function parseArgs(argv, shape) {
  const opts = { ...shape.defaults }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') {
      console.log(usage())
      process.exit(0)
    }
    const handler = shape.flags[arg]
    if (handler === undefined) throw new UsageError(`unknown option: ${arg}`)
    if (handler.boolean) opts[handler.key] = true
    else if (handler.many) opts[handler.key] = [...opts[handler.key], takeValue(argv, i++, arg)]
    else opts[handler.key] = takeValue(argv, i++, arg)
  }
  for (const required of shape.required) {
    if (opts[required] === null) throw new UsageError(`--${required.replace(/[A-Z]/gu, (c) => `-${c.toLowerCase()}`)} is required`)
  }
  return opts
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

// ---------------------------------------------------------------------------
// corpus
// ---------------------------------------------------------------------------

async function commandCorpus(argv) {
  const opts = parseArgs(argv, {
    defaults: { name: null, out: null, engineSrc: DEFAULT_ENGINE_SRC },
    flags: {
      '--name': { key: 'name' },
      '--out': { key: 'out' },
      '--engine-src': { key: 'engineSrc' },
    },
    required: ['name', 'out'],
  })
  const src = configureEngineTree(opts.engineSrc)
  const engine = await loadEngine()
  const { name, members, tiers } = await buildCorpus(opts.name)
  // Members are VALIDATED and normalized here, once, so a misbuilt plan fails
  // at corpus-build time rather than as a confusing mid-capture throw. The
  // stored plan is the parse OUTPUT; `capture` re-parses it in whichever tree
  // it is running, so each tree still runs its own `parsePlan`.
  const normalized = members.map((member) => {
    const parsed = engine.parsePlan(member.plan)
    if (!parsed.ok) throw new Error(`corpus member "${member.id}" is invalid: ${parsed.issues.join('; ')}`)
    return { ...member, plan: parsed.plan }
  })
  // The identity that matters is the INPUTS, not the provenance block: two
  // corpora with the same members are comparable however and wherever they
  // were built. Hashing the whole file instead would let a note about the
  // building tree make two identical corpora refuse to compare.
  const membersSha256 = sha256(JSON.stringify(normalized))
  const body = {
    schema: CORPUS_SCHEMA,
    name,
    tiers,
    membersSha256,
    builtFrom: { engineSrc: src, ...describeTree(src) },
    members: normalized,
  }
  const text = JSON.stringify(body)
  writeFileSync(opts.out, text, 'utf8')
  console.log(`corpus   ${name}  (tiers: ${tiers.join(', ')})`)
  console.log(`members  ${members.length}`)
  console.log(`members sha256 ${membersSha256}`)
  console.log(`file    sha256 ${sha256(text)}`)
  console.log(`bytes    ${Buffer.byteLength(text, 'utf8')}`)
  console.log(`written  ${opts.out}`)
  return 0
}

// ---------------------------------------------------------------------------
// capture
// ---------------------------------------------------------------------------

function loadCorpusFile(path, memberFilter) {
  const corpus = readJson(path)
  if (corpus.schema !== CORPUS_SCHEMA) {
    throw new UsageError(`${path} is not a ${CORPUS_SCHEMA} corpus (found "${corpus.schema}")`)
  }
  // Recomputed rather than trusted: a corpus file edited by hand after it was
  // written must fail here, not silently compare as if it were the original.
  const sha = sha256(JSON.stringify(corpus.members))
  if (corpus.membersSha256 !== sha) {
    throw new UsageError(
      `${path} has been modified since it was written ` +
        `(members sha256 ${sha.slice(0, 16)}, file says ${String(corpus.membersSha256).slice(0, 16)})`,
    )
  }
  let members = corpus.members
  if (memberFilter.length > 0) {
    const wanted = new Set(memberFilter)
    members = members.filter((member) => wanted.has(member.id))
    const missing = memberFilter.filter((id) => !members.some((member) => member.id === id))
    if (missing.length > 0) throw new UsageError(`no such corpus member(s): ${missing.join(', ')}`)
  }
  return { corpus, sha, members }
}

async function commandCapture(argv) {
  const opts = parseArgs(argv, {
    defaults: {
      corpus: null,
      out: null,
      engineSrc: DEFAULT_ENGINE_SRC,
      engineLabel: null,
      modes: MODE_IDS.join(','),
      member: [],
    },
    flags: {
      '--corpus': { key: 'corpus' },
      '--out': { key: 'out' },
      '--engine-src': { key: 'engineSrc' },
      '--engine-label': { key: 'engineLabel' },
      '--modes': { key: 'modes' },
      '--member': { key: 'member', many: true },
    },
    required: ['corpus', 'out'],
  })
  const modes = modesFromFlag(opts.modes)
  const { corpus, sha, members } = loadCorpusFile(opts.corpus, opts.member)
  const src = configureEngineTree(opts.engineSrc)
  const engine = await loadEngine()

  const startedAt = Date.now()
  const entries = []
  const emptyChannels = []
  for (const member of members) {
    for (const mode of modes) {
      const output = runMember(engine, member, mode)
      const text = encodeToText(output)
      entries.push({
        member: member.id,
        mode: mode.id,
        covers: member.covers,
        sha256: sha256(text),
        value: encode(output),
      })
      const size = mode.channelSize(output)
      if (size !== null && size <= 0) emptyChannels.push(`${member.id}/${mode.id}`)
    }
  }
  const elapsedMs = Date.now() - startedAt

  const overallSha256 = sha256(entries.map((entry) => `${entry.member}/${entry.mode}=${entry.sha256}`).join('\n'))
  const dumpText = JSON.stringify({
    schema: SCHEMA,
    modes: modes.map((mode) => mode.id),
    corpusSha256: sha,
    entries: entries.map(({ member, mode, sha256: hash, value }) => ({ member, mode, sha256: hash, value })),
  })
  writeFileSync(opts.out, dumpText, 'utf8')
  const dumpSha256 = sha256(dumpText)

  const manifest = {
    schema: SCHEMA,
    modes: modes.map((mode) => ({ id: mode.id, why: mode.why })),
    corpus: {
      name: corpus.name,
      sha256: sha,
      members: members.length,
      selected: opts.member.length > 0 ? opts.member : null,
      builtFrom: corpus.builtFrom,
    },
    engine: describeTree(src, opts.engineLabel),
    runtime: { node: process.version, platform: process.platform, ...resolvedDependencyVersions() },
    // A mode whose channel came back empty contributes nothing and would make
    // the capture look broader than it is. Recorded, never silently tolerated.
    emptyChannels,
    entries: entries.map(({ member, mode, covers, sha256: hash }) => ({ member, mode, covers, sha256: hash })),
    overallSha256,
    dumpSha256,
    bytes: Buffer.byteLength(dumpText, 'utf8'),
    elapsedMs,
  }
  writeFileSync(`${opts.out}.manifest.json`, JSON.stringify(manifest, null, 2), 'utf8')

  console.log(`engine     ${src}`)
  console.log(`           ${manifest.engine.provenance} ${manifest.engine.gitSha ?? '(unknown)'}${manifest.engine.dirty ? ' DIRTY' : ''}`)
  if (manifest.engine.dirty) for (const path of manifest.engine.dirtyPaths) console.log(`           dirty: ${path}`)
  console.log(`corpus     ${corpus.name}  ${members.length} members  sha256 ${sha.slice(0, 16)}`)
  console.log(`modes      ${modes.map((mode) => mode.id).join(', ')}`)
  console.log(`entries    ${entries.length}`)
  if (emptyChannels.length > 0) {
    console.log(`EMPTY CHANNELS (${emptyChannels.length}):`)
    for (const key of emptyChannels) console.log(`           ${key}`)
  }
  console.log(`dump       ${opts.out}`)
  console.log(`bytes      ${manifest.bytes}`)
  console.log(`dumpSha256    ${dumpSha256}`)
  console.log(`overallSha256 ${overallSha256}`)
  console.log(`elapsedMs  ${elapsedMs}`)
  return 0
}

// ---------------------------------------------------------------------------
// compare
// ---------------------------------------------------------------------------

function manifestFor(dumpPath) {
  try {
    return readJson(`${dumpPath}.manifest.json`)
  } catch {
    return null
  }
}

function commandCompare(argv) {
  const opts = parseArgs(argv, {
    defaults: { base: null, head: null, limit: '12' },
    flags: {
      '--base': { key: 'base' },
      '--head': { key: 'head' },
      '--limit': { key: 'limit' },
    },
    required: ['base', 'head'],
  })
  const limit = Number(opts.limit)
  if (!Number.isInteger(limit) || limit < 1) throw new UsageError('--limit must be a positive integer')

  const baseText = readFileSync(opts.base, 'utf8')
  const headText = readFileSync(opts.head, 'utf8')
  const baseSha = sha256(baseText)
  const headSha = sha256(headText)
  const base = JSON.parse(baseText)
  const head = JSON.parse(headText)

  // INCOMPARABLE inputs are refused, not compared. Two dumps built from
  // different corpora, different mode sets or a different schema can agree on
  // every entry they happen to share and still say nothing about the change.
  const reasons = []
  if (base.schema !== head.schema) reasons.push(`schema ${base.schema} vs ${head.schema}`)
  if (base.schema !== SCHEMA) reasons.push(`schema is not ${SCHEMA}`)
  if (base.corpusSha256 !== head.corpusSha256) {
    reasons.push(`corpus sha256 ${String(base.corpusSha256).slice(0, 16)} vs ${String(head.corpusSha256).slice(0, 16)}`)
  }
  if (JSON.stringify(base.modes) !== JSON.stringify(head.modes)) {
    reasons.push(`modes [${base.modes}] vs [${head.modes}]`)
  }
  const baseKeys = base.entries.map((entry) => `${entry.member}/${entry.mode}`)
  const headKeys = head.entries.map((entry) => `${entry.member}/${entry.mode}`)
  if (JSON.stringify(baseKeys) !== JSON.stringify(headKeys)) {
    const baseSet = new Set(baseKeys)
    const headSet = new Set(headKeys)
    const onlyBase = baseKeys.filter((key) => !headSet.has(key))
    const onlyHead = headKeys.filter((key) => !baseSet.has(key))
    reasons.push(
      `entry sets differ (${baseKeys.length} vs ${headKeys.length}` +
        `${onlyBase.length > 0 ? `; only in base: ${onlyBase.slice(0, 5).join(', ')}` : ''}` +
        `${onlyHead.length > 0 ? `; only in head: ${onlyHead.slice(0, 5).join(', ')}` : ''})`,
    )
  }
  if (reasons.length > 0) {
    console.error('INCOMPARABLE — refusing to compare:')
    for (const reason of reasons) console.error(`  ${reason}`)
    return 2
  }

  const baseManifest = manifestFor(opts.base)
  const headManifest = manifestFor(opts.head)
  const describe = (manifest) =>
    manifest === null
      ? '(no manifest)'
      : `${manifest.engine.provenance} ${manifest.engine.gitSha ?? '(unknown)'}${manifest.engine.dirty ? ' DIRTY' : ''}`
  console.log(`base  ${opts.base}`)
  console.log(`      file sha256 ${baseSha}   engine ${describe(baseManifest)}`)
  console.log(`head  ${opts.head}`)
  console.log(`      file sha256 ${headSha}   engine ${describe(headManifest)}`)
  console.log(`(a) file hashes ${baseSha === headSha ? 'IDENTICAL' : 'DIFFER'}`)

  // A dump's stored per-entry hash is RE-DERIVED from that entry's own value
  // before either is trusted, exactly as `loadCorpusFile` re-derives a corpus
  // hash. Without this the walk below is skipped for any entry whose stored
  // hashes happen to agree, which is precisely the entry a hand-edited value
  // would produce: the verdict would still be DIFFERENT (the whole-file hashes
  // disagree) but the operator would be shown an empty mismatch report — the
  // tool's entire diagnostic value, missing exactly when something is wrong.
  const corrupt = []
  for (const [label, dump] of [['base', base], ['head', head]]) {
    for (const entry of dump.entries) {
      const derived = sha256(JSON.stringify(entry.value))
      if (derived !== entry.sha256) {
        corrupt.push(
          `${label} entry ${entry.member}/${entry.mode}: stored ${String(entry.sha256).slice(0, 16)}, ` +
            `value hashes to ${derived.slice(0, 16)}`,
        )
      }
    }
  }
  if (corrupt.length > 0) {
    console.error('CORRUPT DUMP — refusing to compare:')
    for (const reason of corrupt.slice(0, 12)) console.error(`  ${reason}`)
    if (corrupt.length > 12) console.error(`  ... ${corrupt.length - 12} more`)
    return 2
  }
  console.log(`(a2) per-entry hashes re-derived from their values: ${base.entries.length * 2} checked, 0 corrupt`)

  console.log('\n(b) per-entry structural walk')
  let moved = 0
  const movedMembers = new Set()
  for (let i = 0; i < base.entries.length; i++) {
    const b = base.entries[i]
    const h = head.entries[i]
    const key = `${b.member}/${b.mode}`
    if (b.sha256 === h.sha256) continue
    moved++
    movedMembers.add(b.member)
    const mismatches = diffEncoded(b.value, h.value, limit)
    console.log(
      `  DIFFERS  ${key}   base=${b.sha256.slice(0, 16)} head=${h.sha256.slice(0, 16)}` +
        `  (${mismatches.length}${mismatches.length >= limit ? '+' : ''} leaf mismatches shown)`,
    )
    for (const mismatch of mismatches) {
      console.log(`             ${mismatch.path}`)
      console.log(`               base ${mismatch.base}`)
      console.log(`               head ${mismatch.head}`)
    }
  }
  console.log(`\nentries compared: ${base.entries.length}   entries that moved: ${moved}`)
  console.log(`members that moved: ${movedMembers.size > 0 ? [...movedMembers].join(', ') : '(none)'}`)
  const identical = baseSha === headSha && moved === 0
  console.log(identical ? '\nRESULT: IDENTICAL' : '\nRESULT: DIFFERENT')
  return identical ? 0 : 1
}

// ---------------------------------------------------------------------------
// reach
// ---------------------------------------------------------------------------

async function commandReach(argv) {
  const opts = parseArgs(argv, {
    defaults: {
      corpus: null,
      spec: null,
      out: null,
      engineSrc: DEFAULT_ENGINE_SRC,
      modes: MODE_IDS.join(','),
      member: [],
    },
    flags: {
      '--corpus': { key: 'corpus' },
      '--spec': { key: 'spec' },
      '--out': { key: 'out' },
      '--engine-src': { key: 'engineSrc' },
      '--modes': { key: 'modes' },
      '--member': { key: 'member', many: true },
    },
    required: ['corpus', 'spec'],
  })
  const modes = modesFromFlag(opts.modes)
  const { members } = loadCorpusFile(opts.corpus, opts.member)
  const src = configureEngineTree(opts.engineSrc)

  const spec = readJson(opts.spec)
  assertReachSpecSchema(spec, opts.spec)
  const entries = spec.entries.map((entry) => ({
    ...entry,
    file: resolve(src, entry.file).split('\\').join('/'),
  }))
  // The recorder attaches its debugger BEFORE the engine is imported (that is
  // when `scriptParsed` names the compiled script), verifies offsets, and only
  // then starts counting — so no count here belongs to module top-level work.
  const recorder = new ReachRecorder(entries)
  let report
  try {
    const engine = await loadEngine()
    recorder.arm()
    for (const member of members) {
      for (const mode of modes) {
        runMember(engine, member, mode)
      }
      recorder.take(member.id)
    }
    report = recorder.report()
  } finally {
    recorder.close()
  }
  report.corpus = opts.corpus
  report.engineSrc = src
  report.modes = modes.map((mode) => mode.id)

  for (const [path, detail] of Object.entries(report.offsetsVerified)) {
    if (!detail.ok) {
      console.error(`REFUSING: compiled offsets do not match the file on disk for ${path}`)
      console.error(`  ${JSON.stringify(detail)}`)
      return 2
    }
    console.log(
      `offsets verified  ${path}: ${detail.fileLines} lines, ` +
        `0 with a different length in the compiled source, ` +
        `${detail.trailingBytesPastFile} trailing bytes (Node's sourceURL footer)`,
    )
  }

  // A REACHED verdict is LINE-EXECUTED, not branch-taken: `totalHits` sums the
  // per-member PEAK line count anywhere in the range, so a multi-line entry
  // whose gate line runs for every member reports REACHED even if its body
  // never ran once. Cold LINES are what close that hole, and they are counted
  // into the exit code rather than being printed under a verdict that
  // contradicts them. Cold REGIONS are deliberately NOT fatal: an untaken
  // defensive `?? 0` arm is a legitimate steady state, and six spec entries
  // here have one.
  let unreached = 0
  let withColdLines = 0
  for (const entry of report.entries) {
    const status = entry.totalHits > 0 ? 'REACHED' : 'NOT REACHED'
    if (entry.totalHits === 0) unreached++
    if (entry.coldLines.length > 0) withColdLines++
    console.log(`\n${entry.id}  ${status}   ${entry.label}`)
    console.log(`  lines ${entry.lines[0]}-${entry.lines[1]}  members that reach it: ${entry.labelsThatReach}/${entry.labelsTotal}  Σ per-member peak line count: ${entry.totalHits}`)
    if (entry.note !== undefined) console.log(`  NOTE: ${entry.note}`)
    for (const row of entry.perLabel.slice(0, 8)) console.log(`    ${String(row.hits).padStart(8)}  ${row.label}`)
    if (entry.perLabel.length > 8) console.log(`    ... ${entry.perLabel.length - 8} more`)
    if (entry.coldLines.length > 0) {
      console.log(`  COLD LINES (${entry.coldLines.length}) — no corpus member executed these at all:`)
      for (const cold of entry.coldLines) console.log(`    ${cold.line}: ${cold.text}`)
    }
    if (entry.coldRegions.length > 0) {
      console.log(`  COLD REGIONS (${entry.coldRegions.length}) — sub-line branches no corpus member ever took:`)
      for (const cold of entry.coldRegions) console.log(`    line ${cold.line}: ${cold.text}`)
    }
  }
  if (opts.out !== null) {
    writeFileSync(opts.out, JSON.stringify(report, null, 2), 'utf8')
    console.log(`\nwritten ${opts.out}`)
  }
  console.log(
    `\nspec entries: ${report.entries.length}   unreached: ${unreached}   ` +
      `entries with cold lines: ${withColdLines}   ` +
      `entries with a cold region (reported, not fatal): ${report.entries.filter((e) => e.coldRegions.length > 0).length}`,
  )
  return unreached === 0 && withColdLines === 0 ? 0 : 1
}

// ---------------------------------------------------------------------------

function commandList() {
  console.log('corpora:')
  for (const [name, spec] of Object.entries(CORPORA)) {
    console.log(`  ${name.padEnd(10)} ${spec.why}`)
    console.log(`  ${''.padEnd(10)} tiers: ${spec.tiers.join(', ')}`)
  }
  console.log(`\nthe "examples" tier reads ${examplesTierLocation()}`)
  console.log('\nmodes:')
  for (const id of MODE_IDS) console.log(`  ${id}`)
  return 0
}

async function main() {
  const argv = process.argv.slice(2)
  const command = argv[0]
  if (command === undefined || command === '--help' || command === '-h') {
    console.log(usage())
    return command === undefined ? 2 : 0
  }
  const rest = argv.slice(1)
  if (command === 'corpus') return commandCorpus(rest)
  if (command === 'capture') return commandCapture(rest)
  if (command === 'compare') return commandCompare(rest)
  if (command === 'reach') return commandReach(rest)
  if (command === 'list') return commandList()
  throw new UsageError(`unknown command: ${command}`)
}

main()
  .then((code) => {
    process.exitCode = code
  })
  .catch((error) => {
    if (error instanceof UsageError) {
      console.error(`${error.message}\n`)
      console.error(usage())
      process.exitCode = 2
      return
    }
    console.error(error)
    process.exitCode = 2
  })
