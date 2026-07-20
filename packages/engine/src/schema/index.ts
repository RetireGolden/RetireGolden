/**
 * `@retiregolden/engine/schema` — the versioned JSON Schema for the Plan
 * document, for consumers that need the plan format as data rather than as
 * TypeScript types.
 *
 * The intended consumer is the RetireGolden MCP's `describe_plan_schema` tool:
 * an AI client fetches this schema to learn how to author a valid plan from a
 * user's account statements. `planJsonSchema` is the full document (the MCP
 * slices subtrees itself); `PLAN_SCHEMA_VERSION` stamps which plan version it
 * describes.
 *
 * This barrel is intentionally ZOD-FREE: every export resolves to either the
 * checked-in generated constant (a plain object literal) or the zod-free
 * `./planSchemaMeta.js` metadata, so importing it pulls in neither zod nor the
 * plan model. The zod-backed generator is deliberately NOT re-exported here — it
 * lives at `@retiregolden/engine/schema/generate` (and dist/schema/generate.js
 * for the build script). Read `planJsonSchema` as a constant here, or read the
 * same bytes offline from the shipped `schema/plan.v1.json` file in the package
 * root.
 */
export {
  PLAN_SCHEMA_ID,
  PLAN_SCHEMA_VERSION,
  PLAN_SCHEMA_UNREPRESENTABLE_CONSTRAINTS,
  type JsonSchemaDocument,
} from './planSchemaMeta.js'

export { planJsonSchema } from './plan.v1.generated.js'
