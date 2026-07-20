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

// Bump this in lockstep with a Plan schema-version bump AFTER retargeting every
// place that hardcodes `v1`:
//   - package.json `exports` key (`./schema/plan.v1.json`) and `files` entry
//   - src/schema/index.ts barrel import (`./plan.v1.generated.js`)
//   - src/schema/planSchemaMeta.ts (`PLAN_SCHEMA_VERSION`)
//   - scripts/pack-smoke.mjs (the `@retiregolden/engine/schema/plan.v<N>.json` read)
//   - README.md usage examples / subpath table
// This guard fails generation loudly if the model's version moves ahead of those
// static paths, so a future v2 can't silently overwrite the v1 artifact (the sync
// test would otherwise compare the overwritten file against the new object and pass).
const EXPECTED_VERSION = 1

const generatorUrl = pathToFileURL(join(pkgDir, 'dist', 'schema', 'generate.js')).href
let generatePlanJsonSchema
let PLAN_SCHEMA_VERSION
try {
  ;({ generatePlanJsonSchema, PLAN_SCHEMA_VERSION } = await import(generatorUrl))
} catch (err) {
  console.error(
    'Could not import the compiled generator from dist/. Run `npm run build` first.\n' + String(err),
  )
  process.exitCode = 1
  throw err
}

if (PLAN_SCHEMA_VERSION !== EXPECTED_VERSION) {
  throw new Error(
    `Plan schema version is ${PLAN_SCHEMA_VERSION} but the versioned artifact paths still target v${EXPECTED_VERSION}. ` +
      'Update package.json exports/files and src/schema/index.ts to the new plan.v<N>.* paths, then set EXPECTED_VERSION to match.',
  )
}

const schema = generatePlanJsonSchema()

// Derived from the version so the basenames track a bump automatically once the
// guard above and the static paths are updated.
const jsonPath = join(pkgDir, 'schema', `plan.v${PLAN_SCHEMA_VERSION}.json`)
const jsonText = JSON.stringify(schema, null, 2) + '\n'
writeFileSync(jsonPath, jsonText)

const tsPath = join(pkgDir, 'src', 'schema', `plan.v${PLAN_SCHEMA_VERSION}.generated.ts`)
const tsText = `/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * The checked-in Plan JSON Schema, emitted from the engine's \`planSchema\`.
 * Regenerate with \`npm run generate:schema\` (rewrites this file and
 * schema/plan.v${PLAN_SCHEMA_VERSION}.json). A sync test guards against hand-edits and drift.
 */
import type { JsonSchemaDocument } from './planSchemaMeta.js'

export const planJsonSchema: JsonSchemaDocument = ${JSON.stringify(schema, null, 2)}
`
writeFileSync(tsPath, tsText)

console.log(`Wrote ${jsonText.length} bytes to schema/plan.v${PLAN_SCHEMA_VERSION}.json`)
console.log(`Wrote src/schema/plan.v${PLAN_SCHEMA_VERSION}.generated.ts`)
