#!/usr/bin/env node
/** Recompute the pinned grouped inherited-IRA extraction proof. */
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const engineDir = resolve(scriptDir, '..', '..')
const repoDir = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  cwd: engineDir,
  encoding: 'utf8',
}).trim()
const equivalence = resolve(engineDir, 'scripts', 'equivalence.mjs')
const specRepoPath = 'packages/engine/scripts/equivalence/specs/simulate-inherited-ira-boundary.json'
const specPath = resolve(repoDir, specRepoPath)
const spec = JSON.parse(readFileSync(specPath, 'utf8'))

function gitObject(revision) {
  return execFileSync('git', ['rev-parse', revision], {
    cwd: repoDir,
    encoding: 'utf8',
  }).trim()
}

function requiredHistoricalGitObject(revision, label) {
  try {
    return gitObject(revision)
  } catch (cause) {
    throw new Error(
      `${label} Git object "${revision}" is unavailable. ` +
      'Fetch the pinned commit in a full-history checkout before rerunning ' +
      'this verifier.',
      { cause },
    )
  }
}

function workingTreeBlob(path) {
  // Apply the path's configured clean filter (notably CRLF normalization on
  // Windows), then require the exact blob Git would commit from these bytes.
  return execFileSync('git', ['hash-object', `--path=${path}`, '--', path], {
    cwd: repoDir,
    encoding: 'utf8',
  }).trim()
}

function runEquivalence(args) {
  execFileSync(process.execPath, [equivalence, ...args], {
    cwd: repoDir,
    stdio: 'inherit',
  })
}

function runEquivalenceWithStatus(args, expectedStatus) {
  const result = spawnSync(process.execPath, [equivalence, ...args], {
    cwd: repoDir,
    stdio: 'inherit',
  })
  if (result.error !== undefined) throw result.error
  assertEqual(result.status, expectedStatus, `equivalence ${args[0]} exit status`)
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(
      `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    )
  }
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

// The proof document supplies every expected blob and output hash below. Refuse
// to trust it unless Node read the exact bytes committed at HEAD.
assertEqual(
  workingTreeBlob(specRepoPath),
  gitObject(`HEAD:${specRepoPath}`),
  'proof spec working-tree input',
)
const proof = spec.measuredProof
if (proof === undefined) {
  throw new Error('inherited-IRA spec has no measuredProof')
}

// Pin every mutable measurement input independently of the recorded outputs.
assertEqual(
  requiredHistoricalGitObject(
    `${proof.base.commit}:packages/engine/src`,
    'base proof',
  ),
  proof.base.engineSourceTree,
  'base engine source tree',
)
assertEqual(
  requiredHistoricalGitObject(
    `${proof.head.observedAtCommit}:packages/engine/src`,
    'observed-head proof',
  ),
  proof.head.engineSourceTree,
  'observed head engine source tree',
)
assertEqual(
  gitObject('HEAD:packages/engine/src'),
  proof.head.engineSourceTree,
  'current engine source tree',
)
const pinnedInputPaths = {
  corpusSourceBlob: 'packages/engine/scripts/equivalence/corpus/blocks.mjs',
  corpusIndexBlob: 'packages/engine/scripts/equivalence/corpus/index.mjs',
  corpusExamplesBlob: 'packages/engine/scripts/equivalence/corpus/examples.mjs',
  equivalenceRunnerBlob: 'packages/engine/scripts/equivalence.mjs',
  engineTreeLoaderBlob: 'packages/engine/scripts/equivalence/engine-tree.mjs',
  treeDescriberBlob: 'packages/engine/scripts/equivalence/describe-tree.mjs',
  encoderBlob: 'packages/engine/scripts/equivalence/encode.mjs',
  modesBlob: 'packages/engine/scripts/equivalence/modes.mjs',
  reachRecorderBlob: 'packages/engine/scripts/equivalence/reach.mjs',
  typescriptSourceResolutionBlob: 'packages/engine/scripts/typescript-source-resolution.mjs',
  usageBlob: 'packages/engine/scripts/equivalence/usage.mjs',
}
for (const [field, path] of Object.entries(pinnedInputPaths)) {
  const expected = proof.inputs[field]
  assertEqual(gitObject(`HEAD:${path}`), expected, `${field} committed input`)
  assertEqual(workingTreeBlob(path), expected, `${field} working-tree input`)
}
assertEqual(
  sha256(JSON.stringify({
    schema: spec.schema,
    name: spec.name,
    why: spec.why,
    entries: spec.entries,
  })),
  proof.inputs.specMeasurementSha256,
  'reach spec measurement input',
)

// Load the encoder only after its committed and on-disk bytes have both been
// authenticated. All other pinned modules are first executed by the child
// equivalence process below, after the same checks have completed.
const { diffEncoded } = await import(
  pathToFileURL(resolve(repoDir, pinnedInputPaths.encoderBlob)).href
)

const scratch = mkdtempSync(join(tmpdir(), 'retiregolden-inherited-ira-proof-'))
try {
  const baseSrc = join(scratch, 'base-src')
  const headSrc = join(scratch, 'head-src')
  const baseTar = join(scratch, 'base.tar')
  const headTar = join(scratch, 'head.tar')
  const corpus = join(scratch, 'corpus.json')
  const baseDump = join(scratch, 'base.json')
  const headDump = join(scratch, 'head.json')
  const reach = join(scratch, 'reach.json')
  mkdirSync(baseSrc)
  mkdirSync(headSrc)

  execFileSync(
    'git',
    ['archive', '--format=tar', '-o', baseTar, proof.base.engineSourceTree],
    { cwd: repoDir },
  )
  execFileSync(
    'git',
    ['archive', '--format=tar', '-o', headTar, proof.head.engineSourceTree],
    { cwd: repoDir },
  )
  execFileSync('tar', ['-xf', baseTar, '-C', baseSrc])
  execFileSync('tar', ['-xf', headTar, '-C', headSrc])

  runEquivalence([
    'corpus',
    '--name', 'blocks',
    '--out', corpus,
    '--engine-src', headSrc,
  ])
  runEquivalence([
    'capture',
    '--corpus', corpus,
    '--out', baseDump,
    '--engine-src', baseSrc,
    '--engine-label', proof.base.engineSourceTree,
  ])
  runEquivalence([
    'capture',
    '--corpus', corpus,
    '--out', headDump,
    '--engine-src', headSrc,
    '--engine-label', proof.head.engineSourceTree,
  ])
  // This extraction is a strict refactor, so the generic comparator must
  // report IDENTICAL. The independent walk below also rejects any moved entry.
  runEquivalenceWithStatus(
    ['compare', '--base', baseDump, '--head', headDump],
    0,
  )
  runEquivalence([
    'reach',
    '--corpus', corpus,
    '--spec', specPath,
    '--engine-src', headSrc,
    '--out', reach,
  ])

  const corpusBody = JSON.parse(readFileSync(corpus, 'utf8'))
  const baseManifest = JSON.parse(readFileSync(`${baseDump}.manifest.json`, 'utf8'))
  const headManifest = JSON.parse(readFileSync(`${headDump}.manifest.json`, 'utf8'))
  const baseDumpBody = JSON.parse(readFileSync(baseDump, 'utf8'))
  const headDumpBody = JSON.parse(readFileSync(headDump, 'utf8'))
  const reachReport = JSON.parse(readFileSync(reach, 'utf8'))
  const unreached = reachReport.entries.filter(
    (entry) => entry.totalHits === 0,
  ).length
  const withColdLines = reachReport.entries.filter(
    (entry) => entry.coldLines.length > 0,
  ).length
  const withColdRegions = reachReport.entries.filter(
    (entry) => entry.coldRegions.length > 0,
  ).length

  assertEqual(corpusBody.members.length, proof.corpus.members, 'corpus members')
  assertEqual(
    corpusBody.membersSha256,
    proof.corpus.membersSha256,
    'corpus member hash',
  )
  assertEqual(baseManifest.entries.length, proof.corpus.entries, 'base entries')
  assertEqual(headManifest.entries.length, proof.corpus.entries, 'head entries')
  assertEqual(
    baseManifest.dumpSha256,
    proof.capture.baseDumpSha256,
    'base dump hash',
  )
  assertEqual(
    headManifest.dumpSha256,
    proof.capture.headDumpSha256,
    'head dump hash',
  )
  assertEqual(
    baseManifest.overallSha256,
    proof.capture.baseOverallSha256,
    'base overall hash',
  )
  assertEqual(
    headManifest.overallSha256,
    proof.capture.headOverallSha256,
    'head overall hash',
  )

  const moved = []
  for (let index = 0; index < baseDumpBody.entries.length; index++) {
    const baseEntry = baseDumpBody.entries[index]
    const headEntry = headDumpBody.entries[index]
    if (baseEntry.sha256 === headEntry.sha256) continue
    moved.push({
      id: `${baseEntry.member}/${baseEntry.mode}`,
      baseEntry,
      headEntry,
    })
  }
  assertEqual(moved.length, proof.capture.entriesMoved, 'entries moved')
  assertEqual(
    baseDumpBody.entries.length - moved.length,
    proof.capture.entriesIdentical,
    'entries identical',
  )
  assertEqual(
    JSON.stringify(moved.map((entry) => entry.id)),
    JSON.stringify(proof.allowedMovedEntries.map((entry) => entry.id)),
    'allowed moved entry ids',
  )

  for (let index = 0; index < moved.length; index++) {
    const actual = moved[index]
    const expected = proof.allowedMovedEntries[index]
    assertEqual(actual.baseEntry.sha256, expected.baseSha256, `${actual.id} base hash`)
    assertEqual(actual.headEntry.sha256, expected.headSha256, `${actual.id} head hash`)
    const mismatches = diffEncoded(
      actual.baseEntry.value,
      actual.headEntry.value,
      10_000,
    )
    assertEqual(
      mismatches.length,
      expected.leafMismatches,
      `${actual.id} leaf mismatch count`,
    )
    assertEqual(
      sha256(JSON.stringify(mismatches)),
      expected.mismatchSha256,
      `${actual.id} mismatch hash`,
    )
    for (const fact of proof.sharedMovementFacts) {
      const mismatch = mismatches.find((candidate) => candidate.path === fact.path)
      if (mismatch === undefined) {
        throw new Error(`${actual.id} is missing movement fact ${fact.path}`)
      }
      assertEqual(mismatch.base, fact.base, `${actual.id} ${fact.path} base`)
      assertEqual(mismatch.head, fact.head, `${actual.id} ${fact.path} head`)
    }
  }

  assertEqual(reachReport.entries.length, proof.reach.entries, 'reach entries')
  assertEqual(unreached, proof.reach.unreached, 'unreached entries')
  assertEqual(
    withColdLines,
    proof.reach.entriesWithColdWholeLines,
    'entries with cold whole lines',
  )
  assertEqual(
    withColdRegions,
    proof.reach.entriesWithReportedColdSubLineRegions,
    'entries with reported cold regions',
  )

  console.log('\nInherited IRA proof: VERIFIED')
} finally {
  rmSync(scratch, { recursive: true, force: true })
}
