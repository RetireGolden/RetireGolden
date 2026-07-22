#!/usr/bin/env node
/**
 * Build-time writer for the engine's own version constant.
 *
 * Regenerates `src/version.generated.ts` from this package's `package.json`,
 * so `ENGINE_VERSION` can be read by consumers that ship to the BROWSER. The
 * MCP resolves the same fact at runtime with `createRequire` — unavailable
 * here, because dist/ is bundled into a browser app where there is no module
 * resolver, no filesystem, and no package.json to read. Baking the string in
 * at generation time is the only way the web planner can stamp which engine
 * produced a document.
 *
 * Unlike `generate-schema.mjs` this needs no prior `npm run build`: the input
 * is package.json, not the compiled generator.
 *
 * A unit test (src/version.test.ts) re-reads package.json independently and
 * fails if this was not rerun after a version bump — the only thing keeping
 * the constant honest, since no CI job regenerates it.
 *
 * Run:  npm run generate:version   (from packages/engine, or -w @retiregolden/engine)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const pkgDir = resolve(scriptDir, '..')

const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'))
const version = pkg.version
if (typeof version !== 'string' || version.length === 0) {
  throw new Error('packages/engine/package.json has no `version` to generate from.')
}

const tsPath = join(pkgDir, 'src', 'version.generated.ts')
const tsText = `/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * The engine's published package version, baked in at generation time so it is
 * readable in a browser bundle. Regenerate with \`npm run generate:version\`
 * after every version bump; src/version.test.ts fails if you forget.
 */

export const ENGINE_VERSION = '${version}'
`
writeFileSync(tsPath, tsText)

console.log(`Wrote src/version.generated.ts (ENGINE_VERSION = ${version})`)
