import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildDispatchPrompt } from './packages/engine/scripts/rules-dispatch.mjs'
import { testSourcesInGlobShape } from './packages/engine/scripts/rules-coverage.mjs'

const root = dirname(fileURLToPath(import.meta.url))
const engineDir = join(root, 'packages', 'engine')
const rulesDir = join(engineDir, 'src', 'rules')

async function load(name) {
  return import(new URL(`./packages/engine/src/rules/${name}`, import.meta.url).href)
}

const outDir = join(root, '_tmp-dispatch-output')
mkdirSync(outDir, { recursive: true })

const [
  { TAX_RULE_REGISTRY, DEFAULT_REVERIFICATION_INTERVAL_DAYS, taxRuleDueOn, taxRulesDueForVerification },
  { COVERAGE_ATTESTATIONS, BASELINE_UNSWEPT },
  { buildCoverageReport },
] = await Promise.all([
  load('taxRuleRegistry.ts'),
  load('coverageAttestations.ts'),
  load('coverageReport.ts'),
])

const quoteFidelityPath = join(root, 'DOCS', 'operations', 'quote-fidelity-ledger.json')
let quoteFidelityLedger = null
try {
  quoteFidelityLedger = (await import('node:fs')).readFileSync(quoteFidelityPath, 'utf8')
} catch {}

const report = buildCoverageReport({
  registry: TAX_RULE_REGISTRY,
  attestations: COVERAGE_ATTESTATIONS,
  baselineUnswept: BASELINE_UNSWEPT,
  testSources: testSourcesInGlobShape(),
  quoteFidelityLedger,
  dueOnFor: taxRuleDueOn,
})

function run(label, fn) {
  const stdout = []
  const stderr = []
  const origOut = process.stdout.write.bind(process.stdout)
  const origErr = process.stderr.write.bind(process.stderr)
  process.stdout.write = (chunk) => { stdout.push(String(chunk)); return true }
  process.stderr.write = (chunk) => { stderr.push(String(chunk)); return true }
  let code = 0
  try {
    fn()
  } catch (e) {
    code = 1
    stderr.push(String(e?.stack ?? e))
  } finally {
    process.stdout.write = origOut
    process.stderr.write = origErr
  }
  writeFileSync(join(outDir, `${label}.json`), JSON.stringify({ exitCode: code, stdout: stdout.join(''), stderr: stderr.join('') }, null, 2))
}

// Command 1
run('cmd1', () => {
  const markdown = buildDispatchPrompt({
    asOf: new Date().toISOString().slice(0, 10),
    ruleIds: ['irc-4974-rmd-shortfall-excise-tax'],
    registry: TAX_RULE_REGISTRY,
    manifestRules: report.manifest.rules,
  })
  process.stdout.write(markdown)
})

// Command 2
run('cmd2', () => {
  const markdown = buildDispatchPrompt({
    asOf: new Date().toISOString().slice(0, 10),
    ruleIds: ['irc-223-f-4-B-hsa-death-exception'],
    registry: TAX_RULE_REGISTRY,
    manifestRules: report.manifest.rules,
  })
  process.stdout.write(markdown)
})

// Command 3
run('cmd3', () => {
  const asOf = '2027-09-01'
  const dueIds = taxRulesDueForVerification(asOf, DEFAULT_REVERIFICATION_INTERVAL_DAYS)
  const ruleIds = [...new Set(dueIds)]
  const chunkSize = 8
  const chunks = []
  const sorted = [...ruleIds].sort()
  for (let i = 0; i < sorted.length; i += chunkSize) chunks.push(sorted.slice(i, i + chunkSize))
  if (chunks.length > 1) {
    process.stderr.write(
      'Selected ' + ruleIds.length + ' rules exceeds chunk size ' + chunkSize +
        '; re-run with --out <path> to write numbered handoff files (e.g. handoff-1.md, handoff-2.md).\n',
    )
    process.exitCode = 1
  }
})

// Command 4
mkdirSync('C:/TEMP/claude-handoffs', { recursive: true })
run('cmd4', () => {
  const asOf = '2027-09-01'
  const dueIds = taxRulesDueForVerification(asOf, DEFAULT_REVERIFICATION_INTERVAL_DAYS)
  const ruleIds = [...new Set(dueIds)]
  const chunkSize = 8
  const outPath = 'C:/TEMP/claude-handoffs/test.md'
  const sorted = [...ruleIds].sort()
  const chunks = []
  for (let i = 0; i < sorted.length; i += chunkSize) chunks.push(sorted.slice(i, i + chunkSize))
  const split = (p) => {
    const lastDot = p.lastIndexOf('.')
    const lastSep = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))
    if (lastDot > lastSep) return { base: p.slice(0, lastDot), ext: p.slice(lastDot) }
    return { base: p, ext: '' }
  }
  const numbered = (p, index) => {
    const { base, ext } = split(p)
    return base + '-' + index + ext
  }
  for (let i = 0; i < chunks.length; i++) {
    const path = numbered(outPath, i + 1)
    const markdown = buildDispatchPrompt({ asOf, ruleIds: chunks[i], registry: TAX_RULE_REGISTRY, manifestRules: report.manifest.rules })
    writeFileSync(path, markdown.replace(/\r\n/g, '\n'), 'utf8')
    process.stdout.write(path + '\n')
  }
})

const { readdirSync, readFileSync } = await import('node:fs')
const files = readdirSync('C:/TEMP/claude-handoffs').filter((f) => /^test-\d+\.md$/.test(f)).sort()
const first5 = files.length ? readFileSync(join('C:/TEMP/claude-handoffs', files[0]), 'utf8').split('\n').slice(0, 5) : []
writeFileSync(join(outDir, 'cmd4-meta.json'), JSON.stringify({ fileCount: files.length, first5Lines: first5 }, null, 2))
