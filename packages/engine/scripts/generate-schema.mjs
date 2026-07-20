#!/usr/bin/env node
/**
 * Build-time writer for the Plan JSON Schema artifact.
 *
 * Regenerates, from the engine's `planSchema` (the single source of truth), the
 * two checked-in outputs this package ships:
 *
 *   - schema/plan.v1.json            the diffable static artifact, shipped in the
 *                                    npm tarball (package.json `files`) so the MCP
 *                                    can read the schema OFFLINE, no import needed.
 *   - src/schema/plan.v1.generated.ts  the same object as a typed constant, compiled
 *                                    into dist and re-exported as `planJsonSchema`
 *                                    (a plain literal — importing it pulls no zod).
 *
 * Both come from one call to `generatePlanJsonSchema()`, so they cannot diverge;
 * a sync test (src/schema/planJsonSchema.test.ts) fails CI if either drifts from a
 * fresh generation — i.e. if `planSchema` changed and nobody reran this script.
 *
 * Requires a prior `npm run build` (imports the compiled generator from dist/).
 * Run:  npm run generate:schema   (from packages/engine, or -w @retiregolden/engine)
 */
import { writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const pkgDir = resolve(scriptDir, '..')

const generatorUrl = pathToFileURL(join(pkgDir, 'dist', 'schema', 'planJsonSchema.js')).href
let generatePlanJsonSchema
try {
  ;({ generatePlanJsonSchema } = await import(generatorUrl))
} catch (err) {
  console.error(
    'Could not import the compiled generator from dist/. Run `npm run build` first.\n' + String(err),
  )
  process.exitCode = 1
  throw err
}

const schema = generatePlanJsonSchema()

const jsonPath = join(pkgDir, 'schema', 'plan.v1.json')
const jsonText = JSON.stringify(schema, null, 2) + '\n'
writeFileSync(jsonPath, jsonText)

const tsPath = join(pkgDir, 'src', 'schema', 'plan.v1.generated.ts')
const tsText = `/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * The checked-in Plan JSON Schema, emitted from the engine's \`planSchema\`.
 * Regenerate with \`npm run generate:schema\` (rewrites this file and
 * schema/plan.v1.json). A sync test guards against hand-edits and drift.
 */
import type { JsonSchemaDocument } from './planJsonSchema.js'

export const planJsonSchema: JsonSchemaDocument = ${JSON.stringify(schema, null, 2)}
`
writeFileSync(tsPath, tsText)

console.log(`Wrote ${jsonText.length} bytes to schema/plan.v1.json`)
console.log(`Wrote src/schema/plan.v1.generated.ts`)
