#!/usr/bin/env node
import { createServer } from 'vite'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function usage() {
  return `Usage:
  npm run owl-parity -- [--out-dir dir] [--start-year 2026] [--tolerance 1000] [--skip-owl] [--install-owl] [--strict-owl]

Defaults:
  Generates Owl TOML cases, runs RetireGolden's optimizer, and tries to invoke an existing owlcli.
  If Owl/Python is unavailable, the run exits 0 with a skipped gate unless --strict-owl is set.
  --install-owl creates an isolated pinned Owl virtualenv under app/.cache/owl-parity.`
}

function takeValue(argv, i, name) {
  const value = argv[i + 1]
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`)
  return value
}

function parseArgs(argv) {
  const opts = {
    outDir: 'artifacts/owl-parity',
    startYear: undefined,
    tolerance: undefined,
    skipOwl: false,
    installOwl: false,
    strictOwl: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--out-dir') opts.outDir = takeValue(argv, i++, arg)
    else if (arg === '--start-year') opts.startYear = Number(takeValue(argv, i++, arg))
    else if (arg === '--tolerance') opts.tolerance = Number(takeValue(argv, i++, arg))
    else if (arg === '--skip-owl') opts.skipOwl = true
    else if (arg === '--install-owl') opts.installOwl = true
    else if (arg === '--strict-owl') opts.strictOwl = true
    else if (arg === '--help' || arg === '-h') {
      console.log(usage())
      process.exit(0)
    } else {
      throw new Error(`Unknown option: ${arg}`)
    }
  }
  if (opts.startYear !== undefined && (!Number.isInteger(opts.startYear) || opts.startYear < 1900 || opts.startYear > 2200)) {
    throw new Error('--start-year must be an integer calendar year')
  }
  if (opts.tolerance !== undefined && (!Number.isFinite(opts.tolerance) || opts.tolerance < 0)) {
    throw new Error('--tolerance must be a non-negative number')
  }
  return opts
}

async function loadParityModule() {
  const server = await createServer({
    root: appDir,
    configFile: join(appDir, 'vite.config.ts'),
    appType: 'custom',
    logLevel: 'error',
    server: { middlewareMode: true, hmr: { port: 30_000 + (process.pid % 20_000) } },
  })
  try {
    const parity = await server.ssrLoadModule('/src/cases/owlParity.ts')
    return { server, parity }
  } catch (error) {
    await server.close()
    throw error
  }
}

function run(command, args, options = {}) {
  return new Promise((resolvePromise) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? appDir,
      env: options.env ?? process.env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
      process.stderr.write(chunk)
    })
    child.on('error', (error) => {
      resolvePromise({ code: null, stdout, stderr: `${stderr}${error.message}` })
    })
    child.on('close', (code) => resolvePromise({ code, stdout, stderr }))
  })
}

async function findPython() {
  const candidates = process.platform === 'win32' ? [['py', ['-3']], ['python', []], ['python3', []]] : [['python3', []], ['python', []]]
  for (const [command, prefix] of candidates) {
    const result = await run(command, [...prefix, '--version'], { cwd: appDir })
    if (result.code === 0) return { command, prefix }
  }
  return null
}

function skippedSummary(parity, reason) {
  return {
    status: 'skipped',
    reason,
    owl: {
      repository: parity.OWL_PARITY_OWL_REPOSITORY,
      pinnedCommit: null,
      verifiedPinnedCommit: false,
      invocation: 'none',
      unverifiedReason: 'Owl was not invoked.',
    },
    artifacts: parity.OWL_PARITY_FIXTURES.map((fixture) => ({
      fixtureId: fixture.id,
      status: 'skipped',
      conversions: [],
      withdrawals: [],
      selfReportedEndingWealth: null,
      selfReportedLifetimeTax: null,
      warnings: [reason],
    })),
  }
}

async function runOwlRunner(parity, opts, paths) {
  if (opts.skipOwl) return skippedSummary(parity, 'Owl invocation skipped by --skip-owl.')
  const python = await findPython()
  if (!python) return skippedSummary(parity, 'Python was not found; install Python or rerun with --skip-owl.')

  const summaryPath = join(paths.owlResultsDir, 'summary.json')
  const env = {
    ...process.env,
    OWL_PARITY_AUTO_INSTALL: opts.installOwl ? '1' : process.env.OWL_PARITY_AUTO_INSTALL ?? '',
  }
  const args = [
    ...python.prefix,
    join(appDir, 'scripts', 'owl_runner.py'),
    '--cases-dir',
    paths.casesDir,
    '--out-dir',
    paths.owlResultsDir,
    '--summary',
    summaryPath,
  ]
  const result = await run(python.command, args, { cwd: appDir, env })
  if (result.code !== 0) {
    return skippedSummary(parity, `Owl runner exited with code ${result.code ?? 'unknown'}; see stderr for details.`)
  }
  try {
    return JSON.parse(await readFile(summaryPath, 'utf8'))
  } catch (error) {
    return skippedSummary(parity, `Owl runner did not write a readable summary: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const { server, parity } = await loadParityModule()
  try {
    const outDir = resolve(appDir, opts.outDir)
    const paths = {
      outDir,
      casesDir: join(outDir, 'owl-cases'),
      owlResultsDir: join(outDir, 'owl-results'),
    }
    await mkdir(paths.casesDir, { recursive: true })
    await mkdir(paths.owlResultsDir, { recursive: true })

    const caseFiles = parity.owlCaseFiles(undefined, { startYear: opts.startYear })
    for (const file of caseFiles) {
      await writeFile(join(paths.casesDir, file.filename), file.toml, 'utf8')
    }

    const owlRunner = await runOwlRunner(parity, opts, paths)
    const manifest = await parity.buildOwlParityManifest({
      owlRunner,
      caseFiles,
      startYear: opts.startYear,
      toleranceDollars: opts.tolerance,
      strictOwl: opts.strictOwl,
    })
    const report = parity.buildOwlParityMarkdownReport(manifest)
    await writeFile(join(outDir, 'manifest.json'), parity.stableOwlParityManifestJson(manifest), 'utf8')
    await writeFile(join(outDir, 'report.md'), report, 'utf8')

    console.log(`Owl parity gate: ${manifest.gate.status} - ${manifest.gate.message}`)
    console.log(`Manifest: ${join(outDir, 'manifest.json')}`)
    console.log(`Report:   ${join(outDir, 'report.md')}`)
    if (manifest.gate.status === 'failed') process.exitCode = 1
  } finally {
    await server.close()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
