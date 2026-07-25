#!/usr/bin/env node
/**
 * Runs the WS5 document-parsing accuracy benchmark and prints the report.
 *
 *   npm run benchmark:documents -w @retiregolden/planner-ui
 *   npm run benchmark:documents -w @retiregolden/planner-ui -- --json
 *
 * The corpus is built in memory (`src/import/documentCorpus.ts`) — no file is
 * read and none is written, because the repo commits no binary fixtures and
 * the plan forbids bundled proprietary samples. The scoring lives in
 * `src/import/documentBenchmark.ts` and is pinned by its test; this script is
 * the human-readable face of the same numbers, for the spike's findings note
 * and for anyone re-running them after a pdfjs bump.
 *
 * TypeScript is loaded through a Vite SSR server, the same way
 * `app/scripts/cases.mjs` and `app/scripts/owl-parity.mjs` load theirs.
 */
import { createServer } from 'vite'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const pkgDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')

async function loadBenchmark() {
  const server = await createServer({
    root: pkgDir,
    configFile: join(pkgDir, 'vite.config.ts'),
    appType: 'custom',
    logLevel: 'error',
    server: { middlewareMode: true, hmr: { port: 30_000 + (process.pid % 20_000) } },
  })
  try {
    const benchmark = await server.ssrLoadModule('/src/import/documentBenchmark.ts')
    return { server, benchmark }
  } catch (error) {
    await server.close()
    throw error
  }
}

async function main() {
  const asJson = process.argv.slice(2).includes('--json')
  const { server, benchmark } = await loadBenchmark()
  try {
    const report = await benchmark.runDocumentBenchmark()
    // Even the machine-readable form carries the per-field breakdown: the plan
    // forbids a claim resting on an aggregate, so no output shape offers one
    // without it.
    process.stdout.write(
      asJson ? `${JSON.stringify(report, null, 2)}\n` : `${benchmark.formatDocumentBenchmarkReport(report)}\n`,
    )
    // A document that stops failing honestly is a real regression, and a
    // script nobody can put in a pipeline is a script nobody re-runs.
    if (report.outcomes.mismatches.length > 0) process.exitCode = 1
  } finally {
    await server.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
