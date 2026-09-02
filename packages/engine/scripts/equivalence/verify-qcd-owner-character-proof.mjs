#!/usr/bin/env node
/** Recompute the pinned grouped-QCD owner-character extraction proof. */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
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
const specRepoPath =
  'packages/engine/scripts/equivalence/specs/simulate-qcd-owner-character-boundary.json'
const equivalenceRepoPath = 'packages/engine/scripts/equivalence.mjs'

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
  return execFileSync('git', ['hash-object', `--path=${path}`, '--', path], {
    cwd: repoDir,
    encoding: 'utf8',
  }).trim()
}

function runEquivalence(equivalence, args) {
  execFileSync(process.execPath, [equivalence, ...args], {
    cwd: repoDir,
    stdio: 'inherit',
  })
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
  assertEqual(
    workingTreeBlob(specRepoPath),
    committedBlob,
    'proof spec stable working-tree input',
  )
  return body
}

const specBody = authenticateSpec()
const spec = JSON.parse(specBody)
const proof = spec.measuredProof

if (proof === undefined) {
  throw new Error('QCD owner-character spec has no measuredProof')
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
    throw new Error('QCD owner-character proof has no harnessBlobs map')
  }
  const pending = [equivalenceRepoPath]
  const seen = new Set()
  const authenticatedSources = new Map()
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
    authenticatedSources.set(path, source)
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
  return authenticatedSources
}

// Capture the complete local harness closure from immutable HEAD blobs before
// executing any of it. The captured sources are materialized below so no child
// process can race a later edit to the shared working tree.
const authenticatedHarnessSources = authenticateHarnessClosure()

assertEqual(
  gitObject(`${proof.base.commit}:packages/engine/src`),
  proof.base.engineSourceTree,
  'base engine source tree',
)
authenticateObservedEngineTree({
  repoDir,
  observedAtCommit: proof.head.observedAtCommit,
  engineSourceTree: proof.head.engineSourceTree,
  label: 'observed head',
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

const scratch = mkdtempSync(join(tmpdir(), 'retiregolden-qcd-proof-'))
try {
  const baseSrc = join(scratch, 'base-src')
  const headSrc = join(scratch, 'head-src')
  const mutantSrc = join(scratch, 'mutant-src')
  const harnessRoot = join(scratch, 'harness')
  const harnessEngineDir = join(harnessRoot, 'packages', 'engine')
  const authenticatedEquivalence = join(harnessRoot, ...equivalenceRepoPath.split('/'))
  const baseTar = join(scratch, 'base.tar')
  const headTar = join(scratch, 'head.tar')
  const authenticatedSpec = join(scratch, 'spec.json')
  const corpus = join(scratch, 'corpus.json')
  const baseDump = join(scratch, 'base.json')
  const headDump = join(scratch, 'head.json')
  const reach = join(scratch, 'reach.json')
  const mutantDump = join(scratch, 'mutant.json')
  mkdirSync(baseSrc)
  mkdirSync(headSrc)
  mkdirSync(mutantSrc)
  for (const [path, source] of authenticatedHarnessSources) {
    const destination = join(harnessRoot, ...path.split('/'))
    mkdirSync(dirname(destination), { recursive: true })
    writeFileSync(destination, source)
  }
  // Bare dependencies intentionally come from this exact installed engine
  // package for both compared trees; preserve that established resolver input
  // while keeping every local harness module immutable.
  symlinkSync(resolve(engineDir, 'node_modules'), join(harnessEngineDir, 'node_modules'), 'junction')
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
  execFileSync('tar', ['-xf', headTar, '-C', mutantSrc])

  const mutantHelper = join(
    mutantSrc,
    'projection',
    'internal',
    'annualLegacyQcdOwnerCharacterPlan.ts',
  )
  const helperSource = readFileSync(mutantHelper, 'utf8')
  const section219Read =
    'const section219 = input.qcdSection219ByDonor.get(ownerId) ?? 0'
  const mutationCount = helperSource.split(section219Read).length - 1
  assertEqual(mutationCount, 1, 'section 219 calibration mutation site count')
  writeFileSync(mutantHelper, helperSource.replace(section219Read, 'const section219 = 0'))

  runEquivalence(authenticatedEquivalence, [
    'corpus',
    '--name', 'blocks',
    '--out', corpus,
    '--engine-src', headSrc,
  ])
  runEquivalence(authenticatedEquivalence, [
    'capture',
    '--corpus', corpus,
    '--out', mutantDump,
    '--engine-src', mutantSrc,
    '--engine-label', 'calibration-ignore-qcd-section219',
  ])
  runEquivalence(authenticatedEquivalence, [
    'capture',
    '--corpus', corpus,
    '--out', baseDump,
    '--engine-src', baseSrc,
    '--engine-label', proof.base.engineSourceTree,
  ])
  runEquivalence(authenticatedEquivalence, [
    'capture',
    '--corpus', corpus,
    '--out', headDump,
    '--engine-src', headSrc,
    '--engine-label', proof.head.engineSourceTree,
  ])
  runEquivalence(authenticatedEquivalence, ['compare', '--base', baseDump, '--head', headDump])
  runEquivalence(authenticatedEquivalence, [
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
  const headDumpBody = JSON.parse(readFileSync(headDump, 'utf8'))
  const mutantDumpBody = JSON.parse(readFileSync(mutantDump, 'utf8'))
  const unreached = reachReport.entries.filter(
    (entry) => entry.totalHits === 0,
  ).length
  const withColdLines = reachReport.entries.filter(
    (entry) => entry.coldLines.length > 0,
  ).length
  const withColdRegions = reachReport.entries.filter(
    (entry) => entry.coldRegions.length > 0,
  ).length
  const movedCalibrationEntries = headDumpBody.entries.filter(
    (entry, index) => entry.sha256 !== mutantDumpBody.entries[index]?.sha256,
  )
  const movedCalibrationMembers = [...new Set(
    movedCalibrationEntries.map((entry) => entry.member),
  )]

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
    proof.capture.overallSha256,
    'base overall hash',
  )
  assertEqual(
    headManifest.overallSha256,
    proof.capture.overallSha256,
    'head overall hash',
  )
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
  assertEqual(
    movedCalibrationEntries.length,
    proof.calibration.entriesMoved,
    'calibration entries moved',
  )
  assertEqual(
    JSON.stringify(movedCalibrationMembers),
    JSON.stringify(proof.calibration.membersMoved),
    'calibration members moved',
  )

  console.log('\nGrouped QCD owner-character proof: VERIFIED')
} finally {
  rmSync(scratch, { recursive: true, force: true })
}
