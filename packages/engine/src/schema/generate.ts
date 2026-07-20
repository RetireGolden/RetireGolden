/**
 * JSON Schema generator for the engine `Plan` document.
 *
 * `planSchema` (engine/model/plan.ts) is the single source of truth. This module
 * *derives* a versioned JSON Schema from it with zod 4's native `z.toJSONSchema`
 * so a downstream, non-TypeScript consumer (an AI client authoring a plan from a
 * user's account statements via the MCP `describe_plan_schema` tool) can learn
 * the plan format field-by-field. planSchema is never edited to serve the schema;
 * if the two ever disagree, planSchema wins and the artifact is regenerated.
 *
 * This module imports zod + the plan model, so it is intentionally kept OFF the
 * `@retiregolden/engine/schema` barrel (which stays zod-free). Tooling reaches it
 * directly — the build script via dist, and at `@retiregolden/engine/schema/generate`.
 *
 * WHAT SURVIVES THE ROUND-TRIP, AND WHAT DOES NOT
 * -----------------------------------------------
 * JSON Schema (draft 2020-12) can express the plan's *structure*: object shapes,
 * required vs. optional fields, primitive types, numeric ranges (`gt`/`min`/…),
 * string patterns (the `YYYY-MM-DD` regex), enums, literals (`schemaVersion`),
 * discriminated unions (emitted as `oneOf`), and arrays. All of that is faithful.
 *
 * What it CANNOT express — and what `z.toJSONSchema` therefore silently drops —
 * are the cross-field and value refinements enforced by planSchema's `.refine`
 * and `.superRefine` blocks: referential integrity of ids, discriminated funding
 * rules, allocation weights summing to 100%, year-window ordering, and the rest
 * (see {@link PLAN_SCHEMA_UNREPRESENTABLE_CONSTRAINTS}). We DO NOT let these
 * vanish quietly: they are summarized in the schema's top-level `description` AND
 * embedded as a machine-readable `x-retiregolden-unrepresentableConstraints`
 * array, so a consumer (including one reading only the offline JSON) knows the
 * structural schema is *necessary but not sufficient* — `parsePlan` remains the
 * full validator, and a schema-valid document can still be rejected by it.
 *
 * Note on `unrepresentable: 'throw'` (the zod default, kept here): refinements are
 * *dropped*, not *unrepresentable*. The `throw` mode fires only for constructs
 * with no JSON-Schema analogue at all (bigint, Date, symbol, custom transforms).
 * The plan model has none today, so generation succeeds. Keeping `throw` means a
 * future edit that introduces one FAILS generation loudly instead of emitting an
 * empty `{}` in its place — a deliberate guardrail.
 *
 * @see ./planSchemaMeta.ts for the zod-free constants + type.
 * @see ./index.ts for the shipped static artifact (`planJsonSchema`).
 * @see scripts/generate-schema.mjs for the build-time writer.
 */

import { z } from 'zod'
import { CURRENT_PLAN_SCHEMA_VERSION, planSchema } from '../model/plan.js'
import {
  PLAN_SCHEMA_ID,
  PLAN_SCHEMA_VERSION,
  PLAN_SCHEMA_UNREPRESENTABLE_CONSTRAINTS,
  UNREPRESENTABLE_CONSTRAINTS_KEY,
  type JsonSchemaDocument,
} from './planSchemaMeta.js'

// Re-export the metadata so `@retiregolden/engine/schema/generate` is a complete
// self-contained surface for tooling; the zero-dependency data path is the
// barrel (./index.ts), which pulls these from ./planSchemaMeta.js instead.
export {
  PLAN_SCHEMA_ID,
  PLAN_SCHEMA_VERSION,
  PLAN_SCHEMA_UNREPRESENTABLE_CONSTRAINTS,
  type JsonSchemaDocument,
} from './planSchemaMeta.js'

function buildDescription(): string {
  return [
    `The RetireGolden engine Plan document, schemaVersion ${PLAN_SCHEMA_VERSION}.`,
    'This schema is DERIVED from the engine’s zod `planSchema` and describes the document’s',
    'structure (shapes, required/optional fields, types, ranges, enums, and the account/income',
    'discriminated unions as `oneOf`). It is NECESSARY BUT NOT SUFFICIENT: `parsePlan` additionally',
    'enforces cross-field constraints that JSON Schema cannot express (referential integrity of ids,',
    'discriminated funding rules, allocation weights summing to 100%, year-window ordering, and more;',
    `see the ${UNREPRESENTABLE_CONSTRAINTS_KEY} annotation on this schema for the full list).`,
    'A document valid against this schema may still be rejected by `parsePlan`; validate through',
    '`parsePlan` (or the MCP `validate_plan` tool) before trusting a plan.',
  ].join(' ')
}

/**
 * Generate the Plan JSON Schema from `planSchema`. Pure and deterministic — the
 * build script and the sync test both call this; the shipped `planJsonSchema`
 * constant is its checked-in output. `io: 'input'` makes the schema describe what
 * `parsePlan` ACCEPTS (fields with zod defaults are optional; a consumer need not
 * supply them), not the defaults-applied output type.
 */
export function generatePlanJsonSchema(): JsonSchemaDocument {
  // Guard the zod-free version copy against drift from the plan model. Cheap, and
  // it fails loudly here (at generation) rather than shipping a mislabeled schema.
  if (PLAN_SCHEMA_VERSION !== CURRENT_PLAN_SCHEMA_VERSION) {
    throw new Error(
      `PLAN_SCHEMA_VERSION (${PLAN_SCHEMA_VERSION}) is out of sync with the plan model's ` +
        `CURRENT_PLAN_SCHEMA_VERSION (${CURRENT_PLAN_SCHEMA_VERSION}); update planSchemaMeta.ts.`,
    )
  }

  // Cast to a precise shape so the derived structural fields (type, properties,
  // any $defs) keep their types when spread below. Keeping the default
  // `unrepresentable: 'throw'` means a future genuinely-unrepresentable construct
  // fails here instead of vanishing.
  const derived = z.toJSONSchema(planSchema, {
    io: 'input',
    target: 'draft-2020-12',
  }) as unknown as {
    $schema?: string
    type: string
    properties: Record<string, unknown>
    required?: string[]
    [key: string]: unknown
  }

  // Spread the derived schema first, then stamp identity/annotations on top so a
  // versioned `$id`, human title, the "necessary but not sufficient" caveat, and
  // the machine-readable constraint catalog ride at the document root. Any extra
  // top-level keys zod emits are preserved.
  return {
    ...derived,
    $schema: derived.$schema ?? 'https://json-schema.org/draft/2020-12/schema',
    $id: PLAN_SCHEMA_ID,
    title: `RetireGolden Plan (schemaVersion ${PLAN_SCHEMA_VERSION})`,
    description: buildDescription(),
    [UNREPRESENTABLE_CONSTRAINTS_KEY]: [...PLAN_SCHEMA_UNREPRESENTABLE_CONSTRAINTS],
  }
}
