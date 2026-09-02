#!/usr/bin/env node
/** Recompute the pinned grouped scalar-QCD gift extraction proof. */
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, posix, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { authenticateObservedEngineTree } from './proof-git-provenance.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const engineDir = resolve(scriptDir, '..', '..')
const repoDir = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  cwd: engineDir,
  encoding: 'utf8',
}).trim()
const equivalenceRepoPath = 'packages/engine/scripts/equivalence.mjs'
const equivalence = resolve(repoDir, equivalenceRepoPath)
const specRepoPath =
  'packages/engine/scripts/equivalence/specs/simulate-qcd-gift-boundary.json'

function gitObject(revision) {
  return execFileSync('git', ['rev-parse', revision], {
    cwd: repoDir,
    encoding: 'utf8',
  }).trim()
}

function gitText(path) {
  return execFileSync('git', ['show', `HEAD:${path}`], {
    cwd: repoDir,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  })
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

function authenticateSpec() {
  const committedBlob = gitObject(`HEAD:${specRepoPath}`)
  assertEqual(
    workingTreeBlob(specRepoPath),
    committedBlob,
    'proof spec working-tree input',
  )
  const body = gitText(specRepoPath)
  // Close the read/check race before trusting any proof metadata.
  assertEqual(
    workingTreeBlob(specRepoPath),
    committedBlob,
    'proof spec stable working-tree input',
  )
  return body
}

// Do not parse or trust measuredProof until the spec's path-aware working blob
// is authenticated against the immutable blob at HEAD.
const specBody = authenticateSpec()
const spec = JSON.parse(specBody)
const proof = spec.measuredProof
if (proof === undefined) {
  throw new Error('scalar-QCD gift spec has no measuredProof')
}

function localImportSpecifiers(source) {
  const found = new Set()
  for (const pattern of [
    /\bfrom\s*['"]([^'"]+)['"]/gu,
    /\bimport\s*['"]([^'"]+)['"]/gu,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/gu,
  ]) {
    for (const match of source.matchAll(pattern)) found.add(match[1])
  }
  return [...found]
}

function resolveLocalImport(fromPath, specifier) {
  if (!specifier.startsWith('.')) return null
  const resolved = posix.normalize(posix.join(posix.dirname(fromPath), specifier))
  if (resolved.startsWith('../') || posix.isAbsolute(resolved)) {
    throw new Error(`local harness import escapes repository: ${fromPath} -> ${specifier}`)
  }
  return resolved
}

function authenticateHarnessClosure() {
  const expectedBlobs = proof.inputs.harnessBlobs
  if (expectedBlobs === undefined || Array.isArray(expectedBlobs)) {
    throw new Error('scalar-QCD proof has no harnessBlobs map')
  }
  const pending = [equivalenceRepoPath]
  const seen = new Set()
  while (pending.length > 0) {
    const path = pending.pop()
    if (seen.has(path)) continue
    seen.add(path)
    const expected = expectedBlobs[path]
    if (expected === undefined) {
      throw new Error(`unrecorded transitive harness input: ${path}`)
    }
    assertEqual(gitObject(`HEAD:${path}`), expected, `${path} committed input`)
    assertEqual(workingTreeBlob(path), expected, `${path} working-tree input`)
    const source = gitText(path)
    for (const specifier of localImportSpecifiers(source)) {
      const dependency = resolveLocalImport(path, specifier)
      if (dependency !== null) pending.push(dependency)
    }
  }
  assertEqual(
    JSON.stringify([...seen].sort()),
    JSON.stringify(Object.keys(expectedBlobs).sort()),
    'complete transitive harness closure',
  )
}

// Authenticate the complete local import closure, not a hand-selected subset,
// before a child process can dynamically load any harness module.
authenticateHarnessClosure()

assertEqual(
  gitObject(`${proof.base.commit}:packages/engine/src`),
  proof.base.engineSourceTree,
  'base engine source tree',
)
authenticateObservedEngineTree({
  repoDir,
  observedAtCommit: proof.head.sourceObservedAtCommit,
  engineSourceTree: proof.head.engineSourceTree,
  label: 'observed semantic source',
})
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

const scratch = mkdtempSync(join(tmpdir(), 'retiregolden-scalar-qcd-proof-'))
try {
  const baseSrc = join(scratch, 'base-src')
  const headSrc = join(scratch, 'head-src')
  const baseTar = join(scratch, 'base.tar')
  const headTar = join(scratch, 'head.tar')
  const authenticatedSpec = join(scratch, 'spec.json')
  const corpus = join(scratch, 'corpus.json')
  const baseDump = join(scratch, 'base.json')
  const headDump = join(scratch, 'head.json')
  const reach = join(scratch, 'reach.json')
  mkdirSync(baseSrc)
  mkdirSync(headSrc)
  writeFileSync(authenticatedSpec, specBody)

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
  runEquivalenceWithStatus(
    ['compare', '--base', baseDump, '--head', headDump],
    0,
  )
  runEquivalence([
    'reach',
    '--corpus', corpus,
    '--spec', authenticatedSpec,
    '--engine-src', headSrc,
    '--out', reach,
  ])

  const corpusBody = JSON.parse(readFileSync(corpus, 'utf8'))
  const baseManifest = JSON.parse(readFileSync(`${baseDump}.manifest.json`, 'utf8'))
  const headManifest = JSON.parse(readFileSync(`${headDump}.manifest.json`, 'utf8'))
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
  assertEqual(proof.capture.entriesMoved, 0, 'entries moved')
  assertEqual(proof.capture.entriesIdentical, proof.corpus.entries, 'entries identical')
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

  // Refuse to publish a result if either authenticated input changed while the
  // child processes ran.
  authenticateSpec()
  authenticateHarnessClosure()
  console.log('\nScalar QCD gift proof: VERIFIED')
} finally {
  rmSync(scratch, { recursive: true, force: true })
}
