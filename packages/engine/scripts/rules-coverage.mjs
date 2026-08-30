import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { makeSymbolLineFor } from './rule-tooling-shared.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const engineDir = resolve(scriptDir, '..')
const repositoryDir = resolve(engineDir, '..', '..')
const sourceDir = join(engineDir, 'src')
const rulesDir = join(sourceDir, 'rules')

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

async function loadModule(name) {
  const path = join(rulesDir, name)
  return import(pathToFileURL(path).href)
}

async function main() {
  const [
    { TAX_RULE_REGISTRY, TAX_RULE_RECORD_MODULES, taxRuleDueOn },
    { COVERAGE_ATTESTATIONS, BASELINE_UNSWEPT },
    { buildCoverageReport },
  ] = await Promise.all([
    loadModule('taxRuleRegistry.ts'),
    loadModule('coverageAttestations.ts'),
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
  const lf = (text) => text.replace(/\r\n/g, '\n')
  writeFileSync(join(operationsDir, 'rule-coverage.md'), lf(report.markdown), 'utf8')
  writeFileSync(join(operationsDir, 'rule-coverage.json'), lf(report.json), 'utf8')

  // Shards are written under the index's own directory, and the directory is
  // then swept: a record module that was renamed or removed must not leave its
  // last shard behind, because the index would stop naming it while git kept
  // publishing it.
  const shardDir = join(operationsDir, 'rule-coverage')
  mkdirSync(shardDir, { recursive: true })
  const written = new Set()
  for (const shard of report.shards) {
    const fileName = shard.path.slice(shard.path.lastIndexOf('/') + 1)
    written.add(fileName)
    writeFileSync(join(shardDir, fileName), lf(shard.json), 'utf8')
  }
  const removed = readdirSync(shardDir).filter((name) => name.endsWith('.json') && !written.has(name))
  for (const name of removed) unlinkSync(join(shardDir, name))

  console.log(
    'rules coverage: ' + report.manifest.registry.total + ' rules, ' +
      report.manifest.attestations.sweptPct.toFixed(1) + '% swept, ' +
      report.manifest.unswept.length + ' unswept, ' +
      report.shards.length + ' shards' +
      (removed.length > 0 ? ' (' + removed.length + ' stale shard(s) removed)' : ''),
  )
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack : error)
    process.exitCode = 1
  })
}

