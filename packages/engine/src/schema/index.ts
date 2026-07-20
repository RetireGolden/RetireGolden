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
 * `planJsonSchema` is the checked-in, build-time-generated artifact (a plain
 * object literal — importing it pulls in no zod), kept byte-identical to a fresh
 * `generatePlanJsonSchema()` by a sync test. Read it as a constant here, or read
 * the same bytes offline from the shipped `schema/plan.v1.json` file in the
 * package root. Reach for `generatePlanJsonSchema()` only in tooling/tests that
 * deliberately want a freshly derived schema.
 */
export {
  PLAN_SCHEMA_ID,
  PLAN_SCHEMA_VERSION,
  PLAN_SCHEMA_UNREPRESENTABLE_CONSTRAINTS,
  generatePlanJsonSchema,
  type JsonSchemaDocument,
} from './planJsonSchema.js'

export { planJsonSchema } from './plan.v1.generated.js'
