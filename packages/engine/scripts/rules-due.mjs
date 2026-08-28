import { parseArgs } from 'node:util'
import { testSourcesInGlobShape } from './rules-coverage.mjs'
import { loadModule, stripLeadingSeparators, todayUtcIso, validateAsOf } from './rule-tooling-shared.mjs'

const HELP = `Usage: pnpm rules:due [-- --as-of YYYY-MM-DD] [--horizon N] [--check] [--json] [--silent]

  --as-of <date>   As-of calendar date (default: today UTC)
  --horizon <n>    Include rules due within the next N whole days (default: 0)
  --check          Exit 1 when any rule is due (for automation)
  --json           Emit machine-readable JSON (includes totalRules)
  --help           Show this message and exit 0

For machine-readable output without pnpm lifecycle banners, invoke from the repo root:
  pnpm --silent rules:due -- --json
`

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

function formatTable(rows, daysColumnLabel) {
  const header = ['Rule', 'Volatility', 'Verified on', 'Due on', daysColumnLabel]
  const widths = header.map((cell, index) =>
    Math.max(cell.length, ...rows.map((row) => String(row[index]).length)),
  )
  const pad = (value, index) => String(value).padEnd(widths[index])
  const line = (cells) => cells.map((cell, index) => pad(cell, index)).join('  ')
  return [line(header), line(widths.map((width) => '-'.repeat(width))), ...rows.map((row) => line(row))].join('\n')
}

function usageFailure(message) {
  console.error(message)
  process.exit(2)
}

async function main() {
  const args = stripLeadingSeparators(process.argv.slice(2))
  const { values } = parseArgs({
    args,
    options: {
      'as-of': { type: 'string' },
      json: { type: 'boolean', default: false },
      horizon: { type: 'string', default: '0' },
      check: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
    allowPositionals: false,
  })

  if (values.help) {
    console.log(HELP)
    return
  }

  const asOf = values['as-of'] ?? todayUtcIso()
  if (values['as-of'] !== undefined) {
    try {
      validateAsOf(asOf)
    } catch (error) {
      usageFailure(error instanceof Error ? error.message : String(error))
    }
  }
  const horizonDays = Number(values.horizon)
  if (!Number.isInteger(horizonDays) || horizonDays < 0) {
    usageFailure('--horizon must be a non-negative whole number of days')
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

  const report = buildCoverageReport({
    registry: TAX_RULE_REGISTRY,
    attestations: COVERAGE_ATTESTATIONS,
    baselineUnswept: BASELINE_UNSWEPT,
    testSources: testSourcesInGlobShape(),
    quoteFidelityLedger: null,
    dueOnFor: taxRuleDueOn,
    // The due table never publishes deep-link lines, and a newly ambiguous
    // pin must fail the conformance suite, not a read-only listing an
    // operator is running mid-triage. rules-coverage.mjs, the publisher,
    // resolves for real.
    symbolLineFor: () => 1,
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
        totalRules,
        due,
        upcoming,
      }) + '\n',
    )
  } else {
    if (due.length > 0) {
      console.log(formatTable(due.map((row) => [row.id, row.volatility, row.verifiedOn, row.dueOn, row.daysOverdue]), 'Days overdue'))
      console.log('')
    } else {
      console.log('No rules due for re-verification as of ' + asOf + '.')
      console.log('')
    }
    if (horizonDays > 0 && upcoming.length > 0) {
      console.log('Upcoming')
      console.log(
        formatTable(
          upcoming.map((row) => [row.id, row.volatility, row.verifiedOn, row.dueOn, row.daysUntilDue]),
          'Days until due',
        ),
      )
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
    console.error(error instanceof Error ? error.message : error)
    process.exit(2)
  })
}
