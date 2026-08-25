import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { testSourcesInGlobShape } from './rules-coverage.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const engineDir = resolve(scriptDir, '..')
const repositoryDir = resolve(engineDir, '..', '..')
const sourceDir = join(engineDir, 'src')
const rulesDir = join(sourceDir, 'rules')

async function loadModule(name) {
  const path = join(rulesDir, name)
  return import(pathToFileURL(path).href)
}

function todayUtcIso() {
  return new Date().toISOString().slice(0, 10)
}

function validateAsOf(asOf) {
  if (new Date(asOf + 'T00:00:00Z').toISOString().slice(0, 10) !== asOf) {
    console.error('Invalid --as-of date: ' + asOf)
    process.exit(1)
  }
}

/** UTC calendar day-shift for probe dates only; dueOn always comes from taxRuleDueOn. */
function isoDateAfterDays(isoDate, days) {
  const date = new Date(isoDate + 'T00:00:00Z')
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function wholeDaysBetween(laterIso, earlierIso) {
  const later = Date.parse(laterIso + 'T00:00:00Z')
  const earlier = Date.parse(earlierIso + 'T00:00:00Z')
  return Math.floor((later - earlier) / 86_400_000)
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0
}

function buildRuleEntry(id, registry, taxRuleDueOn, intervals, asOf) {
  const rule = registry[id]
  const dueOn = taxRuleDueOn(id, intervals)
  return {
    id,
    volatility: rule.volatility,
    verifiedOn: rule.verifiedOn,
    dueOn,
    daysOverdue: wholeDaysBetween(asOf, dueOn),
  }
}

function formatTable(rows) {
  const header = ['Rule', 'Volatility', 'Verified on', 'Due on', 'Days overdue']
  const widths = header.map((cell, index) =>
    Math.max(cell.length, ...rows.map((row) => String(row[index]).length)),
  )
  const pad = (value, index) => String(value).padEnd(widths[index])
  const line = (cells) => cells.map((cell, index) => pad(cell, index)).join('  ')
  return [line(header), line(widths.map((width) => '-'.repeat(width))), ...rows.map((row) => line(row))].join('\n')
}

async function main() {
  // pnpm forwards the `--` separator itself, so `pnpm rules:due -- --check`
  // reaches node with a literal `--` first; strip leading separators so the
  // documented invocation parses the same as a direct node run.
  const args = process.argv.slice(2)
  while (args[0] === '--') args.shift()
  const { values } = parseArgs({
    args,
    options: {
      'as-of': { type: 'string' },
      json: { type: 'boolean', default: false },
      horizon: { type: 'string', default: '0' },
      check: { type: 'boolean', default: false },
    },
    allowPositionals: false,
  })

  const asOf = values['as-of'] ?? todayUtcIso()
  if (values['as-of'] !== undefined) validateAsOf(asOf)
  const horizonDays = Number(values.horizon)
  if (!Number.isFinite(horizonDays) || horizonDays < 0) {
    throw new RangeError('--horizon must be a non-negative number of days')
  }

  const [
    { TAX_RULE_REGISTRY, DEFAULT_REVERIFICATION_INTERVAL_DAYS, taxRulesDueForVerification, taxRuleDueOn },
    { COVERAGE_ATTESTATIONS, BASELINE_UNSWEPT },
    { buildCoverageReport },
  ] = await Promise.all([
    loadModule('taxRuleRegistry.ts'),
    loadModule('coverageAttestations.ts'),
    loadModule('coverageReport.ts'),
  ])

  const quoteFidelityPath = join(repositoryDir, 'DOCS', 'operations', 'quote-fidelity-ledger.json')
  const quoteFidelityLedger = existsSync(quoteFidelityPath) ? readFileSync(quoteFidelityPath, 'utf8') : null
  const report = buildCoverageReport({
    registry: TAX_RULE_REGISTRY,
    attestations: COVERAGE_ATTESTATIONS,
    baselineUnswept: BASELINE_UNSWEPT,
    testSources: testSourcesInGlobShape(),
    quoteFidelityLedger,
    dueOnFor: taxRuleDueOn,
  })
  const totalRules = report.manifest.registry.total

  const dueIds = taxRulesDueForVerification(asOf, DEFAULT_REVERIFICATION_INTERVAL_DAYS)
  const dueSet = new Set(dueIds)
  const due = dueIds
    .map((id) => buildRuleEntry(id, TAX_RULE_REGISTRY, taxRuleDueOn, DEFAULT_REVERIFICATION_INTERVAL_DAYS, asOf))
    .sort((left, right) => right.daysOverdue - left.daysOverdue || compareStrings(left.id, right.id))

  const horizonEnd = isoDateAfterDays(asOf, horizonDays)
  const upcoming = report.manifest.rules
    .filter((rule) => !dueSet.has(rule.id) && rule.dueOn > asOf && rule.dueOn <= horizonEnd)
    .map((rule) => ({
      id: rule.id,
      volatility: rule.volatility,
      verifiedOn: rule.verifiedOn,
      dueOn: rule.dueOn,
      daysUntilDue: wholeDaysBetween(rule.dueOn, asOf),
    }))
    .sort((left, right) => compareStrings(left.dueOn, right.dueOn) || compareStrings(left.id, right.id))

  if (values.json) {
    console.log(
      JSON.stringify({
        kind: 'retiregolden.rules-due',
        version: 1,
        asOf,
        horizonDays,
        due,
        upcoming,
      }) + '\n',
    )
  } else {
    if (due.length > 0) {
      console.log(formatTable(due.map((row) => [row.id, row.volatility, row.verifiedOn, row.dueOn, row.daysOverdue])))
      console.log('')
    } else {
      console.log('No rules due for re-verification as of ' + asOf + '.')
      console.log('')
    }
    console.log(
      due.length + ' due / ' + upcoming.length + ' upcoming within ' + horizonDays + ' days / ' + totalRules + ' rules',
    )
  }

  if (values.check && due.length > 0) {
    process.exitCode = 1
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack : error)
    process.exitCode = 1
  })
}
