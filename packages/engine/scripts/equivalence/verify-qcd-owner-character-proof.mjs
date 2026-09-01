#!/usr/bin/env node
/** Recompute the pinned grouped-QCD owner-character extraction proof. */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const engineDir = resolve(scriptDir, '..', '..')
const repoDir = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  cwd: engineDir,
  encoding: 'utf8',
}).trim()
const equivalence = resolve(engineDir, 'scripts', 'equivalence.mjs')
const specPath = resolve(
  scriptDir,
  'specs',
  'simulate-qcd-owner-character-boundary.json',
)
const spec = JSON.parse(readFileSync(specPath, 'utf8'))
const proof = spec.measuredProof

if (proof === undefined) {
  throw new Error('QCD owner-character spec has no measuredProof')
}

function gitObject(revision) {
  return execFileSync('git', ['rev-parse', revision], {
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

// Pin every mutable measurement input independently of the recorded outputs.
assertEqual(
  gitObject(`${proof.base.commit}:packages/engine/src`),
  proof.base.engineSourceTree,
  'base engine source tree',
)
assertEqual(
  gitObject(`${proof.head.observedAtCommit}:packages/engine/src`),
  proof.head.engineSourceTree,
  'observed head engine source tree',
)
assertEqual(
  gitObject('HEAD:packages/engine/src'),
  proof.head.engineSourceTree,
  'current engine source tree',
)
assertEqual(
  gitObject('HEAD:packages/engine/scripts/equivalence/corpus/blocks.mjs'),
  proof.inputs.corpusSourceBlob,
  'blocks corpus source blob',
)
assertEqual(
  gitObject('HEAD:packages/engine/scripts/equivalence.mjs'),
  proof.inputs.equivalenceRunnerBlob,
  'equivalence runner blob',
)
assertEqual(
  gitObject('HEAD:packages/engine/scripts/equivalence/engine-tree.mjs'),
  proof.inputs.engineTreeLoaderBlob,
  'engine-tree loader blob',
)
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
  const baseTar = join(scratch, 'base.tar')
  const headTar = join(scratch, 'head.tar')
  const corpus = join(scratch, 'corpus.json')
  const baseDump = join(scratch, 'base.json')
  const headDump = join(scratch, 'head.json')
  const reach = join(scratch, 'reach.json')
  const mutantDump = join(scratch, 'mutant.json')
  mkdirSync(baseSrc)
  mkdirSync(headSrc)
  mkdirSync(mutantSrc)

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

  runEquivalence([
    'corpus',
    '--name', 'blocks',
    '--out', corpus,
    '--engine-src', headSrc,
  ])
  runEquivalence([
    'capture',
    '--corpus', corpus,
    '--out', mutantDump,
    '--engine-src', mutantSrc,
    '--engine-label', 'calibration-ignore-qcd-section219',
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
  runEquivalence(['compare', '--base', baseDump, '--head', headDump])
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
