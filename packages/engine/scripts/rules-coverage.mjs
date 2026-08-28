import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

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
    { TAX_RULE_REGISTRY, taxRuleDueOn },
    { COVERAGE_ATTESTATIONS, BASELINE_UNSWEPT },
    { buildCoverageReport },
    { declaredSymbolLinesOf },
  ] = await Promise.all([
    loadModule('taxRuleRegistry.ts'),
    loadModule('coverageAttestations.ts'),
    loadModule('coverageReport.ts'),
    loadModule('symbolLines.ts'),
  ])
  const quoteFidelityPath = join(repositoryDir, 'DOCS', 'operations', 'quote-fidelity-ledger.json')
  const quoteFidelityLedger = existsSync(quoteFidelityPath) ? readFileSync(quoteFidelityPath, 'utf8') : null
  const symbolLineTables = new Map()
  const symbolLineFor = (path, symbol) => {
    let table = symbolLineTables.get(path)
    if (table === undefined) {
      table = declaredSymbolLinesOf(path, readFileSync(join(repositoryDir, path), 'utf8'))
      symbolLineTables.set(path, table)
    }
    const line = table.get(symbol)
    if (line === undefined) {
      throw new Error(path + '#' + symbol + ' has no declaration line; conformance and the manifest scan disagree')
    }
    return line
  }
  const report = buildCoverageReport({
    registry: TAX_RULE_REGISTRY,
    attestations: COVERAGE_ATTESTATIONS,
    baselineUnswept: BASELINE_UNSWEPT,
    testSources: testSourcesInGlobShape(),
    quoteFidelityLedger,
    dueOnFor: taxRuleDueOn,
    symbolLineFor,
  })
  const operationsDir = join(repositoryDir, 'DOCS', 'operations')
  writeFileSync(join(operationsDir, 'rule-coverage.md'), report.markdown.replace(/\r\n/g, '\n'), 'utf8')
  writeFileSync(join(operationsDir, 'rule-coverage.json'), report.json.replace(/\r\n/g, '\n'), 'utf8')
  console.log(
    'rules coverage: ' + report.manifest.registry.total + ' rules, ' +
      report.manifest.attestations.sweptPct.toFixed(1) + '% swept, ' +
      report.manifest.unswept.length + ' unswept',
  )
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack : error)
    process.exitCode = 1
  })
}

