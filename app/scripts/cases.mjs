#!/usr/bin/env node
import { createServer } from 'vite'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function usage() {
  return `Usage:
  npm run cases -- [run] [--input file-or-dir] [--scenario-set file] [--out manifest.json] [--reports-dir dir] [--prepared-at ISO] [--start-year 2026] [--include-decisions] [--include-plan-scenarios]
  npm run cases -- diff --base old.json --head new.json [--allowlist allow.json]

Defaults:
  run without --input uses the bundled example-plan library.
  JSON output is stable and sorted; no generated timestamp is embedded.`
}

function takeValue(argv, i, name) {
  const value = argv[i + 1]
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`)
  return value
}

function parseRunArgs(argv) {
  const opts = {
    inputs: [],
    scenarioSets: [],
    out: null,
    reportsDir: null,
    startYear: undefined,
    includeDecisions: false,
    includePlanScenarios: false,
    caseSetName: undefined,
    preparedAt: null,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--input') opts.inputs.push(takeValue(argv, i++, arg))
    else if (arg === '--scenario-set') opts.scenarioSets.push(takeValue(argv, i++, arg))
    else if (arg === '--out') opts.out = takeValue(argv, i++, arg)
    else if (arg === '--reports-dir') opts.reportsDir = takeValue(argv, i++, arg)
    else if (arg === '--start-year') opts.startYear = Number(takeValue(argv, i++, arg))
    else if (arg === '--include-decisions') opts.includeDecisions = true
    else if (arg === '--include-plan-scenarios') opts.includePlanScenarios = true
    else if (arg === '--case-set-name') opts.caseSetName = takeValue(argv, i++, arg)
    else if (arg === '--prepared-at') opts.preparedAt = takeValue(argv, i++, arg)
    else if (arg === '--help' || arg === '-h') {
      console.log(usage())
      process.exit(0)
    } else {
      throw new Error(`Unknown run option: ${arg}`)
    }
  }
  if (opts.startYear !== undefined && (!Number.isInteger(opts.startYear) || opts.startYear < 1900 || opts.startYear > 2200)) {
    throw new Error('--start-year must be an integer calendar year')
  }
  if (opts.preparedAt !== null && Number.isNaN(Date.parse(opts.preparedAt))) {
    throw new Error('--prepared-at must be an ISO date-time string')
  }
  return opts
}

function parseDiffArgs(argv) {
  const opts = { base: null, head: null, allowlist: null }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--base') opts.base = takeValue(argv, i++, arg)
    else if (arg === '--head') opts.head = takeValue(argv, i++, arg)
    else if (arg === '--allowlist') opts.allowlist = takeValue(argv, i++, arg)
    else if (arg === '--help' || arg === '-h') {
      console.log(usage())
      process.exit(0)
    } else {
      throw new Error(`Unknown diff option: ${arg}`)
    }
  }
  if (!opts.base || !opts.head) throw new Error('diff requires --base and --head')
  return opts
}

async function jsonFilesFromInput(input) {
  const resolved = resolve(process.cwd(), input)
  const info = await stat(resolved)
  if (!info.isDirectory()) return [resolved]
  const entries = await readdir(resolved)
  return entries
    .filter((name) => name.toLowerCase().endsWith('.json'))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => join(resolved, name))
}

async function loadViteModules() {
  const server = await createServer({
    root: appDir,
    configFile: join(appDir, 'vite.config.ts'),
    appType: 'custom',
    logLevel: 'error',
    server: { middlewareMode: true, hmr: { port: 30_000 + (process.pid % 20_000) } },
  })
  try {
    const caseRunner = await server.ssrLoadModule('/src/cases/caseRunner.ts')
    const caseDiff = await server.ssrLoadModule('/src/cases/caseDiff.ts')
    const reportHtml = await server.ssrLoadModule('@retiregolden/planner-ui/report/reportHtml')
    return { server, caseRunner, caseDiff, reportHtml }
  } catch (error) {
    await server.close()
    throw error
  }
}

async function runCommand(argv) {
  const opts = parseRunArgs(argv)
  const { server, caseRunner, reportHtml } = await loadViteModules()
  try {
    let cases = []
    const warnings = []
    if (opts.inputs.length === 0) {
      cases = caseRunner.defaultExampleCases()
    } else {
      for (const input of opts.inputs) {
        for (const file of await jsonFilesFromInput(input)) {
          const parsed = caseRunner.plansFromJsonInput(await readFile(file, 'utf8'), file)
          warnings.push(...parsed.warnings)
          cases.push(
            ...caseRunner.caseDefinitionsFromPlans(parsed.plans, { type: 'plan-file', label: file }, {
              includePlanScenarios: opts.includePlanScenarios,
            }),
          )
        }
      }
    }

    for (const file of opts.scenarioSets) {
      const scenarioSet = caseRunner.scenarioSetFromJson(await readFile(resolve(process.cwd(), file), 'utf8'), file)
      cases = caseRunner.appendScenarioSetCases(cases, scenarioSet)
    }

    // Ensure ids are globally unique before they key the manifest and report
    // filenames — imported files can share a plan id, which would otherwise
    // collide during diffing and overwrite HTML reports.
    cases = caseRunner.dedupeCaseDefinitionIds(cases)

    const manifest = caseRunner.runCases(cases, {
      caseSetName: opts.caseSetName,
      startYear: opts.startYear,
      includeDecisions: opts.includeDecisions,
    })
    const json = caseRunner.stableCaseManifestJson(manifest)
    if (opts.out) {
      const out = resolve(process.cwd(), opts.out)
      await mkdir(dirname(out), { recursive: true })
      await writeFile(out, json, 'utf8')
    } else {
      process.stdout.write(json)
    }

    if (opts.reportsDir) {
      const dir = resolve(process.cwd(), opts.reportsDir)
      await mkdir(dir, { recursive: true })
      // Reports are inspection artifacts (not diffed like the manifest), so the
      // "prepared" date reflects the actual run time unless pinned via --prepared-at
      // for reproducible output.
      const preparedAtIso = opts.preparedAt ?? new Date().toISOString()
      for (const definition of cases) {
        const projected = caseRunner.projectCase(definition, manifest.options.startYear)
        const html = reportHtml.buildStandaloneReportHtml({
          plan: definition.plan,
          result: projected.result,
          summary: projected.summary,
          startYear: manifest.options.startYear,
          preparedAtIso,
        })
        const safeName = definition.id.replace(/[^a-zA-Z0-9._-]+/g, '-')
        await writeFile(join(dir, `${safeName}.html`), html, 'utf8')
      }
    }

    for (const warning of warnings) console.error(`case warning: ${warning}`)
  } finally {
    await server.close()
  }
}

async function diffCommand(argv) {
  const opts = parseDiffArgs(argv)
  const { server, caseDiff } = await loadViteModules()
  try {
    const base = JSON.parse(await readFile(resolve(process.cwd(), opts.base), 'utf8'))
    const head = JSON.parse(await readFile(resolve(process.cwd(), opts.head), 'utf8'))
    const allowlist = opts.allowlist ? JSON.parse(await readFile(resolve(process.cwd(), opts.allowlist), 'utf8')) : undefined
    const result = caseDiff.diffCaseManifests(base, head, allowlist)
    console.log(caseDiff.formatCaseDiffSummary(result))
    if (result.unexpected.length > 0) process.exitCode = 1
  } finally {
    await server.close()
  }
}

async function main() {
  const argv = process.argv.slice(2)
  const command = argv[0] === 'run' || argv[0] === 'diff' ? argv.shift() : 'run'
  if (argv[0] === '--help' || argv[0] === '-h') {
    console.log(usage())
    return
  }
  if (command === 'diff') await diffCommand(argv)
  else await runCommand(argv)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
