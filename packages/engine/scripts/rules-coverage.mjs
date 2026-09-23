import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadModule, makeSymbolLineFor } from './rule-tooling-shared.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const engineDir = resolve(scriptDir, '..')
const repositoryDir = resolve(engineDir, '..', '..')
const sourceDir = join(engineDir, 'src')

const TEST_SOURCE = /\.test\.(ts|mts|cts|tsx)$/

export function testSourcesInGlobShape(directory = sourceDir) {
  const sources = {}
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
    left.name < right.name ? -1 : left.name > right.name ? 1 : 0)) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      Object.assign(sources, testSourcesInGlobShape(path))
    } else if (entry.isFile() && TEST_SOURCE.test(entry.name)) {
      const sourcePath = relative(sourceDir, path).split('\\').join('/')
      sources['../' + sourcePath] = readFileSync(path, 'utf8')
    }
  }
  return sources
}

/**
 * Whether `text` is a coverage shard this generator wrote, judged by the
 * shard's own `kind` discriminator rather than by its file name. Unparseable
 * content answers no, so the sweep below can only ever delete a file it
 * positively recognises.
 *
 * Pure and text-taking so the engine suite can pin it without importing
 * node:fs into `src/` — the engine's compile-time surface carries no node
 * types, and its purity lint would reject the import besides.
 */
/** File contents, or null when it cannot be read — an unreadable file is not recognisably ours. */
function readTextOrNull(path) {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return null
  }
}

function isKindedObject(text, kind) {
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    return false
  }
  return (
    typeof parsed === 'object' &&
    parsed !== null &&
    !Array.isArray(parsed) &&
    parsed.kind === kind
  )
}

export function isGeneratedShardText(text) {
  return isKindedObject(text, 'retiregolden.rules-coverage.shard')
}

export function isGeneratedCalculationShardText(text) {
  return isKindedObject(text, 'retiregolden.calculation-coverage.shard')
}

/**
 * Directories the source walks never enter: installed dependencies and build
 * output can carry files with any suffix, and the freshness suite's Vite globs
 * never expand into them, so the generator must not either or the two would
 * disagree the day a dependency ships a `*.external.golden.test.ts`.
 */
const SKIPPED_DIRECTORIES = new Set(['node_modules', 'dist'])

function walkFiles(directory, predicate, relativeRoot = directory, found = {}) {
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
    left.name < right.name ? -1 : left.name > right.name ? 1 : 0)) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      if (SKIPPED_DIRECTORIES.has(entry.name)) continue
      walkFiles(path, predicate, relativeRoot, found)
    } else if (entry.isFile() && predicate(entry.name, path)) {
      const sourcePath = relative(relativeRoot, path).split('\\').join('/')
      found[sourcePath] = readFileSync(path, 'utf8')
    }
  }
  return found
}

const WALKTHROUGH_TEST = /\.test\.tsx?$/

/**
 * The walkthrough test files directly under planner-ui's
 * `examples/walkthroughs/`, keyed by file name the way the freshness suite's
 * glob keys them; `{}` when the directory does not exist yet. The entries
 * themselves come from `walkthroughEntriesOf` in coverageReport.ts, so the
 * generator and the suite scan the same files the same way.
 */
function walkthroughTestSources(directory) {
  if (!existsSync(directory)) return {}
  const sources = {}
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
    left.name < right.name ? -1 : left.name > right.name ? 1 : 0)) {
    if (entry.isFile() && WALKTHROUGH_TEST.test(entry.name)) {
      sources[entry.name] = readFileSync(join(directory, entry.name), 'utf8')
    }
  }
  return sources
}

function sweepShards(shardDir, written, recognise) {
  mkdirSync(shardDir, { recursive: true })
  const removed = []
  const kept = []
  for (const name of readdirSync(shardDir)) {
    if (!name.endsWith('.json') || written.has(name)) continue
    const full = join(shardDir, name)
    const text = readTextOrNull(full)
    if (text !== null && recognise(text)) {
      unlinkSync(full)
      removed.push(name)
    } else {
      kept.push(name)
    }
  }
  return { removed, kept }
}

const lf = (text) => text.replace(/\r\n/g, '\n')

function writeShards(shardDir, shards, recognise, label) {
  mkdirSync(shardDir, { recursive: true })
  const written = new Set()
  for (const shard of shards) {
    const fileName = shard.path.slice(shard.path.lastIndexOf('/') + 1)
    written.add(fileName)
    writeFileSync(join(shardDir, fileName), lf(shard.json), 'utf8')
  }
  const { removed, kept } = sweepShards(shardDir, written, recognise)
  if (kept.length > 0) {
    console.warn(
      label + ': left ' + kept.length + ' unrecognized file(s) in ' + shardDir + ': ' + kept.join(', '),
    )
  }
  return removed
}

async function main() {
  const [
    { TAX_RULE_REGISTRY, TAX_RULE_RECORD_MODULES, taxRuleDueOn },
    { COVERAGE_ATTESTATIONS, BASELINE_UNSWEPT },
    { CALCULATION_REGISTRY, CALCULATION_RECORD_MODULES },
    { OUTPUT_FAMILIES },
    { buildCoverageReport, buildCalculationCoverageReport, walkthroughEntriesOf },
  ] = await Promise.all([
    loadModule('taxRuleRegistry.ts'),
    loadModule('coverageAttestations.ts'),
    loadModule('calculationRegistry.ts'),
    loadModule('outputFamilies.ts'),
    loadModule('coverageReport.ts'),
  ])
  const quoteFidelityPath = join(repositoryDir, 'DOCS', 'operations', 'quote-fidelity-ledger.json')
  const quoteFidelityLedger = existsSync(quoteFidelityPath) ? readFileSync(quoteFidelityPath, 'utf8') : null
  const symbolLineFor = await makeSymbolLineFor()
  const report = buildCoverageReport({
    registry: TAX_RULE_REGISTRY,
    attestations: COVERAGE_ATTESTATIONS,
    baselineUnswept: BASELINE_UNSWEPT,
    testSources: testSourcesInGlobShape(),
    quoteFidelityLedger,
    dueOnFor: taxRuleDueOn,
    symbolLineFor,
    recordModules: TAX_RULE_RECORD_MODULES,
  })
  const operationsDir = join(repositoryDir, 'DOCS', 'operations')
  writeFileSync(join(operationsDir, 'rule-coverage.md'), lf(report.markdown), 'utf8')
  writeFileSync(join(operationsDir, 'rule-coverage.json'), lf(report.json), 'utf8')

  // Shards are written under the index's own directory, and the directory is
  // then swept: a record module that was renamed or removed must not leave its
  // last shard behind, because the index would stop naming it while git kept
  // publishing it.
  const removed = writeShards(
    join(operationsDir, 'rule-coverage'),
    report.shards,
    isGeneratedShardText,
    'rules coverage',
  )

  const packagesDir = join(repositoryDir, 'packages')
  // Fixtures live under packages/<package>/src/, the inventory the freshness
  // suite globs too, so the two sides always read the same files.
  const externalGoldenSources = Object.fromEntries(
    Object.entries(walkFiles(packagesDir, (name) => name.endsWith('.external.golden.test.ts'), repositoryDir)).filter(
      ([path]) => /^packages\/[^/]+\/src\//u.test(path),
    ),
  )
  const oracleRegistryPath = join(repositoryDir, 'DOCS', 'external-oracles.md')
  const oracleRegistryText = existsSync(oracleRegistryPath) ? readFileSync(oracleRegistryPath, 'utf8') : null
  const docsDir = join(repositoryDir, 'DOCS', 'calculations')
  const calculationDocs = existsSync(docsDir)
    ? walkFiles(docsDir, (name) => name.endsWith('.md'), join(repositoryDir, 'DOCS', 'calculations'))
    : {}
  const docTextFor = (path) => {
    const prefix = 'DOCS/calculations/'
    if (!path.startsWith(prefix)) return existsSync(join(repositoryDir, path)) ? readFileSync(join(repositoryDir, path), 'utf8') : null
    return calculationDocs[path.slice(prefix.length)] ?? null
  }
  const walkthroughDir = join(repositoryDir, 'packages', 'planner-ui', 'src', 'planner', 'examples', 'walkthroughs')
  const calculationReport = buildCalculationCoverageReport({
    registry: CALCULATION_REGISTRY,
    recordModules: CALCULATION_RECORD_MODULES,
    families: OUTPUT_FAMILIES,
    attestations: COVERAGE_ATTESTATIONS,
    testSources: testSourcesInGlobShape(),
    externalGoldenSources,
    oracleRegistryText,
    walkthroughs: walkthroughEntriesOf(walkthroughTestSources(walkthroughDir)),
    symbolLineFor,
    docTextFor,
  })
  writeFileSync(join(operationsDir, 'calculation-coverage.json'), lf(calculationReport.json), 'utf8')
  const calculationRemoved = writeShards(
    join(operationsDir, 'calculation-coverage'),
    calculationReport.shards,
    isGeneratedCalculationShardText,
    'calculation coverage',
  )

  console.log(
    'rules coverage: ' + report.manifest.registry.total + ' rules, ' +
      report.manifest.attestations.sweptPct.toFixed(1) + '% swept, ' +
      report.manifest.unswept.length + ' unswept, ' +
      report.shards.length + ' shards' +
      (removed.length > 0 ? ' (' + removed.length + ' stale shard(s) removed)' : ''),
  )
  console.log(
    'calculation coverage: ' + calculationReport.manifest.records.total + ' records, ' +
      calculationReport.manifest.families.identified + ' families, ' +
      calculationReport.shards.length + ' shards' +
      (calculationRemoved.length > 0 ? ' (' + calculationRemoved.length + ' stale shard(s) removed)' : ''),
  )
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack : error)
    process.exitCode = 1
  })
}

