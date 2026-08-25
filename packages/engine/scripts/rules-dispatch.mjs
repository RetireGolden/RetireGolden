import { existsSync, readFileSync, writeFileSync } from 'node:fs'
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

function splitOutPath(outPath) {
  const lastDot = outPath.lastIndexOf('.')
  const lastSep = Math.max(outPath.lastIndexOf('/'), outPath.lastIndexOf('\\'))
  if (lastDot > lastSep) {
    return { base: outPath.slice(0, lastDot), ext: outPath.slice(lastDot) }
  }
  return { base: outPath, ext: '' }
}

function numberedOutPath(outPath, index) {
  const { base, ext } = splitOutPath(outPath)
  return base + '-' + index + ext
}

function chunkRuleIds(ruleIds, chunkSize) {
  const sorted = [...ruleIds].sort()
  const chunks = []
  for (let i = 0; i < sorted.length; i += chunkSize) {
    chunks.push(sorted.slice(i, i + chunkSize))
  }
  return chunks
}

/**
 * Self-contained markdown handoff prompt for a fresh agent session.
 * Kept pure so a future test can snapshot the template.
 */
export function buildDispatchPrompt({ asOf, ruleIds, registry, manifestRules }) {
  const manifestById = new Map(manifestRules.map((rule) => [rule.id, rule]))
  const ids = [...ruleIds].sort()

  const lines = [
    '# Re-verification dispatch: ' + ids.join(', ') + ' (generated ' + asOf + ')',
    '',
    '## Setup',
    '',
    '- Repository: https://github.com/RetireGolden/RetireGolden',
    '- Create a worktree/branch from `origin/main`.',
    '- Enable Corepack and use pnpm (`corepack enable`).',
    '- Read `AGENTS.md` first.',
    '- The rule registry lives at `packages/engine/src/rules/taxRuleRegistry.ts`; each rule below is one record keyed by its id.',
    '',
    '## The binding edit order',
    '',
    'Follow this order imperatively for every rule below:',
    '',
    '1. Re-read each cited authority at its URL.',
    '2. Update the **registry record first** (`quotedText`, `authority`, `verifiedOn`, `effectiveFrom`/`effectiveThrough`, `classification` as facts require — `verifiedOn` must be bumped even when nothing changed) — including ADDING authority entries when a statement makes a claim the current quotes do not cover (sufficiency, not just fidelity: see `DOCS/operations/authority-sufficiency.md`). Set `verifiedOn` to the UTC date (YYYY-MM-DD) you finished re-reading the authorities.',
    '3. Rewrite or confirm the discriminating fixture **from the authority** (never from code; fixtures name two candidate readings with different values). `fixtureFiles` below lists the files whose `describeRule(<id>)` blocks are this rule\'s discriminating fixtures — those blocks are the contract; other tests in the same files are ordinary coverage.',
    '4. Only then change implementation until the fixture passes.',
    '',
    '## Verification checklist',
    '',
    '- `pnpm --filter @retiregolden/engine test`',
    ...ids.map(
      (id) =>
        '- Quote-fidelity re-check for ' + id + ': `pnpm verify:quotes -- --filter ' + id + ' --refresh`',
    ),
    '- (network, manual; see `DOCS/operations/quote-fidelity.md`)',
    '- If any result moves: run `pnpm cases:diff`, review every delta, and add a `CHANGELOG.md` entry announcing the correction — corrections are announced, never silent.',
    '- `pnpm rules:coverage` and commit the refreshed `DOCS/operations/rule-coverage.md` and `rule-coverage.json` (`verifiedOn` changes them)',
    '- Confirm no other open PR changes the registry file: for each PR in `gh pr list --state open --json number -q .[].number`, run `gh pr diff <n> --name-only` and require zero hits for `taxRuleRegistry.ts` before pushing.',
    '- One PR; review-bot findings fixed on the same branch',
    '',
  ]

  for (const id of ids) {
    const rule = registry[id]
    const manifest = manifestById.get(id)
    if (!rule || !manifest) continue

    lines.push('## ' + id, '')
    lines.push('**Statement:** ' + rule.statement, '')
    lines.push(
      '**Classification:** ' + rule.classification +
        (rule.contraryReading !== null ? ' (contrary reading: ' + rule.contraryReading + ')' : '') +
        (rule.errorDirection !== null ? '; error direction: ' + rule.errorDirection : '') +
        (rule.conventionRationale !== null ? '; convention rationale: ' + rule.conventionRationale : ''),
    )
    lines.push(
      '**Jurisdiction:** ' + rule.jurisdiction +
        ' | **Volatility:** ' + rule.volatility +
        ' | **Verified on:** ' + rule.verifiedOn +
        ' | **Due on:** ' + manifest.dueOn,
    )
    lines.push(
      '**Effective:** ' + rule.effectiveFrom +
        (rule.effectiveThrough !== null ? ' through ' + rule.effectiveThrough : ' (no end)'),
    )
    lines.push('')

    for (const authority of rule.authority) {
      lines.push('### Authority: ' + authority.kind + ' — ' + authority.citation)
      lines.push('')
      lines.push('URL: ' + authority.url)
      lines.push('')
      lines.push('> ' + authority.quotedText.replace(/`/gu, '\\`').replace(/\n/gu, '\n> '))
      lines.push('')
    }

    lines.push('**Implemented by:**')
    for (const path of manifest.implementedBy) lines.push('- ' + path)
    lines.push('')
    lines.push('**Fixture files:**')
    if (manifest.fixtureFiles.length === 0) {
      if (rule.classification === 'outOfScope') {
        lines.push(
          '- No discriminating fixtures: this rule is outOfScope and is enforced as a typed refusal — confirm the refusal behavior and its tests instead of a describeRule fixture.',
        )
      } else {
        lines.push(
          '- WARNING: conformance anomaly — `' + id + '` is not outOfScope but has empty fixtureFiles; investigate before proceeding.',
        )
      }
    } else {
      for (const path of manifest.fixtureFiles) lines.push('- ' + path)
    }
    lines.push('')
  }

  return lines.join('\n')
}

async function main() {
  // pnpm forwards the `--` separator itself, so `pnpm rules:dispatch -- --rule x`
  // reaches node with a literal `--` first; strip leading separators so the
  // documented invocation parses the same as a direct node run.
  // For machine-readable `rules:due --json` output without pnpm lifecycle banners,
  // invoke from the repo root: `pnpm --silent rules:due -- --json`.
  const args = process.argv.slice(2)
  while (args[0] === '--') args.shift()
  const { values } = parseArgs({
    args,
    options: {
      rule: { type: 'string' },
      due: { type: 'boolean', default: false },
      'as-of': { type: 'string' },
      out: { type: 'string' },
      'chunk-size': { type: 'string', default: '8' },
    },
    allowPositionals: false,
  })

  const asOf = values['as-of'] ?? todayUtcIso()
  if (values['as-of'] !== undefined) validateAsOf(asOf)
  const ruleArg = values.rule
  const useDue = values.due
  const chunkSize = Number(values['chunk-size'])
  if (!Number.isInteger(chunkSize) || chunkSize < 1) {
    console.error('Invalid --chunk-size: ' + values['chunk-size'] + ' (must be a positive integer)')
    process.exit(1)
  }

  if (!ruleArg && !useDue) {
    throw new Error('Specify --rule <id>[,<id>...] and/or --due')
  }

  const [
    { TAX_RULE_REGISTRY, DEFAULT_REVERIFICATION_INTERVAL_DAYS, taxRuleDueOn, taxRulesDueForVerification },
    { COVERAGE_ATTESTATIONS, BASELINE_UNSWEPT },
    { buildCoverageReport },
  ] = await Promise.all([
    loadModule('taxRuleRegistry.ts'),
    loadModule('coverageAttestations.ts'),
    loadModule('coverageReport.ts'),
  ])

  let ruleIds = []
  if (ruleArg) {
    const parsedRuleIds = ruleArg.split(',').map((id) => id.trim()).filter(Boolean)
    if (parsedRuleIds.length === 0) {
      console.error('No valid rule ids in --rule: ' + ruleArg)
      process.exit(1)
    }
    ruleIds.push(...parsedRuleIds)
  }
  if (useDue) {
    const dueIds = taxRulesDueForVerification(asOf, DEFAULT_REVERIFICATION_INTERVAL_DAYS)
    if (dueIds.length === 0 && !ruleArg) {
      console.log('No rules due as of ' + asOf + '; nothing to dispatch.')
      return
    }
    ruleIds.push(...dueIds)
  }
  ruleIds = [...new Set(ruleIds)]

  for (const id of ruleIds) {
    if (!TAX_RULE_REGISTRY[id]) {
      console.error('Unknown rule id: ' + id)
      process.exitCode = 1
      return
    }
  }

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

  const chunks = chunkRuleIds(ruleIds, chunkSize)

  if (chunks.length > 1 && !values.out) {
    console.error(
      'Selected ' + ruleIds.length + ' rules exceeds chunk size ' + chunkSize +
        '; re-run with --out <path> to write numbered handoff files (e.g. handoff-1.md, handoff-2.md).',
    )
    process.exit(1)
  }

  const normalize = (markdown) => markdown.replace(/\r\n/g, '\n')

  if (chunks.length === 1) {
    const markdown = buildDispatchPrompt({
      asOf,
      ruleIds: chunks[0],
      registry: TAX_RULE_REGISTRY,
      manifestRules: report.manifest.rules,
    })
    if (values.out) {
      writeFileSync(values.out, normalize(markdown), 'utf8')
    } else {
      process.stdout.write(markdown)
    }
    return
  }

  const written = []
  for (let i = 0; i < chunks.length; i++) {
    const outPath = numberedOutPath(values.out, i + 1)
    const markdown = buildDispatchPrompt({
      asOf,
      ruleIds: chunks[i],
      registry: TAX_RULE_REGISTRY,
      manifestRules: report.manifest.rules,
    })
    writeFileSync(outPath, normalize(markdown), 'utf8')
    written.push(outPath)
  }
  for (const path of written) console.log(path)
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack : error)
    process.exitCode = 1
  })
}
