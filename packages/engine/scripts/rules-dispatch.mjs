import { readdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { testSourcesInGlobShape } from './rules-coverage.mjs'
import { engineDir, loadModule, stripLeadingSeparators, todayUtcIso, validateAsOf } from './rule-tooling-shared.mjs'

const REGISTRY_FACADE_PATH = 'packages/engine/src/rules/taxRuleRegistry.ts'
const RECORDS_DIR_PATH = 'packages/engine/src/rules/records'

/**
 * Generated files a dispatch always rewrites, whatever rules it carries.
 * `pnpm rules:coverage` republishes the markdown summary from `verifiedOn` (its
 * due-date table is cross-cutting by construction), so it collides even between
 * dispatches whose record modules never touch. The JSON ledger no longer does:
 * its per-rule payloads live in per-module shards, and the index it names them
 * from carries only counts, which a re-verification does not move.
 */
const COVERAGE_LEDGER_PATHS = [
  'DOCS/operations/rule-coverage.md',
]

/** Shard file for a record module path, mirroring coverageReport's layout. */
function coverageShardOf(recordModulePath) {
  const base = recordModulePath.slice(recordModulePath.lastIndexOf('/') + 1).replace(/\.ts$/u, '')
  return 'DOCS/operations/rule-coverage/' + base + '.json'
}

/**
 * Repo-relative record module path per rule id, read from the modules
 * themselves rather than from a hand-kept list, so a new module in
 * `records/` is mapped the moment it is spread into the registry.
 */
async function loadRecordModuleOf() {
  const recordsDir = join(engineDir, 'src', 'rules', 'records')
  const byRuleId = new Map()
  for (const name of readdirSync(recordsDir).sort()) {
    if (!name.endsWith('.ts') || name.endsWith('.test.ts')) continue
    const module = await loadModule(join('records', name))
    for (const exported of Object.values(module)) {
      if (exported === null || typeof exported !== 'object') continue
      for (const ruleId of Object.keys(exported)) byRuleId.set(ruleId, RECORDS_DIR_PATH + '/' + name)
    }
  }
  return byRuleId
}

const HELP = `Usage: pnpm rules:dispatch [-- --rule <id>[,<id>...]] [--due] [--as-of YYYY-MM-DD] [--out <path>] [--chunk-size N]

  --rule <id>      Rule id to dispatch (repeatable; comma-separated lists union)
  --due            Include every rule due as of --as-of
  --as-of <date>   As-of calendar date (default: today UTC)
  --out <path>     Write handoff markdown to this path (numbered when chunked)
  --chunk-size <n> Rules per handoff file when --out is set (default: 8)
  --help           Show this message and exit 0
`

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

function isStaleNumberedSibling(name, fileBase, ext) {
  const prefix = fileBase + '-'
  if (!name.startsWith(prefix)) return false
  if (ext !== '' && !name.endsWith(ext)) return false
  const middle = ext !== '' ? name.slice(prefix.length, name.length - ext.length) : name.slice(prefix.length)
  return /^\d+$/u.test(middle)
}

/**
 * Every --out invocation clears ALL prior outputs for that path — the
 * unnumbered file and every numbered sibling — before writing, so a rerun
 * that changes shape (fewer chunks, chunked to single, or nothing due at
 * all) can never leave a stale handoff for an operator to pick up.
 */
function clearPriorOutputs(outPath) {
  const { base, ext } = splitOutPath(outPath)
  const dir = dirname(resolve(outPath))
  const fileBase = basename(base)
  const unnumbered = basename(resolve(outPath))
  for (const name of readdirSync(dir)) {
    if (isStaleNumberedSibling(name, fileBase, ext) || name === unnumbered) {
      const full = join(dir, name)
      unlinkSync(full)
      console.log('Deleted stale ' + full)
    }
  }
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
export function buildDispatchPrompt({ asOf, ruleIds, registry, manifestRules, recordModuleOf = new Map() }) {
  const manifestById = new Map(manifestRules.map((rule) => [rule.id, rule]))
  const ids = [...ruleIds].sort()

  // The files this dispatch will actually edit, which is what another open PR
  // has to overlap for the two to collide. A rule whose module is unknown
  // (a caller that passed no map) falls back to the whole records directory
  // and the whole shard directory, so the check can only ever be too broad,
  // never too narrow.
  const recordModulePaths = ids.map((id) => recordModuleOf.get(id) ?? null)
  const contendedPaths = [...new Set([
    ...recordModulePaths.map((path) => path ?? RECORDS_DIR_PATH + '/'),
    // Only the shards for the modules this dispatch edits: a re-verification of
    // a western state rewrites rule-coverage/statesWest.json and leaves the
    // other eighteen byte-identical, which is the whole point of the split.
    ...recordModulePaths.map((path) =>
      path === null ? 'DOCS/operations/rule-coverage/' : coverageShardOf(path)),
    REGISTRY_FACADE_PATH,
    ...COVERAGE_LEDGER_PATHS,
  ])].sort()

  const lines = [
    '# Re-verification dispatch: ' + ids.join(', ') + ' (generated ' + asOf + ')',
    '',
    '## Setup',
    '',
    '- Repository: https://github.com/RetireGolden/RetireGolden',
    '- Create a worktree/branch from `origin/main`.',
    '- Enable Corepack and use pnpm (`corepack enable`).',
    '- Read `AGENTS.md` first.',
    '- The rule registry is composed in `' + REGISTRY_FACADE_PATH + '` from the per-domain modules in `' + RECORDS_DIR_PATH + '/`; each rule below is one record keyed by its id, in exactly one of those modules, and each rule section names the module it lives in.',
    '',
    '## The binding edit order',
    '',
    'Follow this order imperatively for every rule below:',
    '',
    '1. Re-read each cited authority at its URL.',
    '2. Update the **registry record first** (`quotedText`, `authority`, `verifiedOn`, `effectiveFrom`/`effectiveThrough`, `classification` as facts require — `verifiedOn` must be bumped even when nothing changed) — including ADDING authority entries when a statement makes a claim the current quotes do not cover (sufficiency, not just fidelity: see `DOCS/operations/authority-sufficiency.md`). Set `verifiedOn` to the UTC date (YYYY-MM-DD) you finished re-reading the authorities.',
    '3. Rewrite or confirm the discriminating fixture **from the authority** (never from code; fixtures name two candidate readings with different values). `fixtureFiles` below lists the files whose `describeRule(<id>)` blocks are this rule\'s discriminating fixtures — those blocks are the contract; other tests in the same files are ordinary coverage.',
    '4. Only then change implementation until the fixture passes.',
    '5. When the reading or behavior changed, update the DOCS/domain ground truth in the same PR (the section file under `DOCS/domain/domain-rules-reference/` — `domain-rules-reference.md` is only the index — and any feature doc that states the rule), citing the record id per repo convention — the generated coverage artifacts do not repair prose.',
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
    '- `pnpm rules:coverage` and commit the refreshed `DOCS/operations/rule-coverage.md` plus the per-module shard(s) under `DOCS/operations/rule-coverage/` that changed (`verifiedOn` moves them). The index `DOCS/operations/rule-coverage.json` holds only counts and normally does not move; commit it when it does.',
    '- Confirm no other open PR edits the files this dispatch touches: for each PR in `gh pr list --state open --limit 200 --json number -q .[].number`, run `gh pr diff <n> --name-only` and require zero hits for any of ' + contendedPaths.map((path) => '`' + path + '`').join(', ') + ' before pushing, excluding this branch\'s own PR. Only these paths — a rules PR editing a DIFFERENT record module merges cleanly alongside this one, and the tooling and conformance files under `packages/engine/src/rules/` hold no records at all.',
    '- One PR; review-bot findings fixed on the same branch',
    '',
  ]

  for (const id of ids) {
    const rule = registry[id]
    const manifest = manifestById.get(id)
    if (!rule) throw new Error('Unknown rule id in registry: ' + id)
    if (!manifest) throw new Error('Unknown rule id in manifest: ' + id)

    lines.push('## ' + id, '')
    lines.push(
      '**Record module:** ' +
        (recordModuleOf.get(id) ??
          'unknown — `git grep -n "\'' + id + '\': {" ' + RECORDS_DIR_PATH + '` finds it'),
      '',
    )
    lines.push('**Title:** ' + rule.title, '')
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
  const args = stripLeadingSeparators(process.argv.slice(2))
  const { values } = parseArgs({
    args,
    options: {
      rule: { type: 'string', multiple: true },
      due: { type: 'boolean', default: false },
      'as-of': { type: 'string' },
      out: { type: 'string' },
      'chunk-size': { type: 'string', default: '8' },
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
      console.error(error instanceof Error ? error.message : error)
      process.exit(2)
    }
  }
  const ruleArgs = values.rule ?? []
  const useDue = values.due
  const chunkSize = Number(values['chunk-size'])
  if (!Number.isInteger(chunkSize) || chunkSize < 1) {
    console.error('Invalid --chunk-size: ' + values['chunk-size'] + ' (must be a positive integer)')
    process.exit(2)
  }

  if (ruleArgs.length === 0 && !useDue) {
    throw new Error('Specify --rule <id>[,<id>...] and/or --due')
  }

  const [
    {
      TAX_RULE_REGISTRY,
      TAX_RULE_RECORD_MODULES,
      DEFAULT_REVERIFICATION_INTERVAL_DAYS,
      taxRuleDueOn,
      taxRulesDueForVerification,
    },
    { COVERAGE_ATTESTATIONS, BASELINE_UNSWEPT },
    { buildCoverageReport },
  ] = await Promise.all([
    loadModule('taxRuleRegistry.ts'),
    loadModule('coverageAttestations.ts'),
    loadModule('coverageReport.ts'),
  ])

  let ruleIds = []
  for (const ruleArg of ruleArgs) {
    const parsedRuleIds = ruleArg.split(',').map((id) => id.trim()).filter(Boolean)
    if (parsedRuleIds.length === 0) {
      console.error('No valid rule ids in --rule: ' + ruleArg)
      process.exit(2)
    }
    ruleIds.push(...parsedRuleIds)
  }
  if (useDue) {
    const dueIds = taxRulesDueForVerification(asOf, DEFAULT_REVERIFICATION_INTERVAL_DAYS)
    if (dueIds.length === 0 && ruleArgs.length === 0) {
      if (values.out) clearPriorOutputs(values.out)
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

  const report = buildCoverageReport({
    registry: TAX_RULE_REGISTRY,
    attestations: COVERAGE_ATTESTATIONS,
    baselineUnswept: BASELINE_UNSWEPT,
    testSources: testSourcesInGlobShape(),
    quoteFidelityLedger: null,
    dueOnFor: taxRuleDueOn,
    // Dispatch prompts print paths, never deep-link lines; a newly ambiguous
    // pin must fail the conformance suite, not abort a handoff. The real
    // resolver lives in rules-coverage.mjs, the only publisher.
    symbolLineFor: () => 1,
    recordModules: TAX_RULE_RECORD_MODULES,
  })

  const recordModuleOf = await loadRecordModuleOf()
  const chunks = chunkRuleIds(ruleIds, chunkSize)

  if (chunks.length > 1 && !values.out) {
    console.error(
      'Selected ' + ruleIds.length + ' rules exceeds chunk size ' + chunkSize +
        '; re-run with --out <path> to write numbered handoff files (e.g. handoff-1.md, handoff-2.md).',
    )
    process.exit(2)
  }

  const normalize = (markdown) => markdown.replace(/\r\n/g, '\n')

  if (chunks.length === 1) {
    const markdown = buildDispatchPrompt({
      asOf,
      ruleIds: chunks[0],
      registry: TAX_RULE_REGISTRY,
      manifestRules: report.rules,
      recordModuleOf,
    })
    if (values.out) {
      clearPriorOutputs(values.out)
      writeFileSync(values.out, normalize(markdown), 'utf8')
    } else {
      process.stdout.write(markdown)
    }
    return
  }

  clearPriorOutputs(values.out)
  const written = []
  for (let i = 0; i < chunks.length; i++) {
    const outPath = numberedOutPath(values.out, i + 1)
    const markdown = buildDispatchPrompt({
      asOf,
      ruleIds: chunks[i],
      registry: TAX_RULE_REGISTRY,
      manifestRules: report.rules,
      recordModuleOf,
    })
    writeFileSync(outPath, normalize(markdown), 'utf8')
    written.push(outPath)
  }
  for (const path of written) console.log(path)
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(2)
  })
}
