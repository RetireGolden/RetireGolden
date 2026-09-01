/**
 * `@retiregolden/engine/schema` — the legacy compatibility barrel for the
 * versioned JSON Schemas for the Plan document.
 *
 * The intended consumer is the RetireGolden MCP's `describe_plan_schema` tool:
 * an AI client fetches this schema to learn how to author a valid plan from a
 * user's account statements. `planJsonSchema` is the full document (the MCP
 * slices subtrees itself); `PLAN_SCHEMA_VERSION` stamps which plan version it
 * describes.
 *
 * This barrel remains ZOD-FREE, but preserving its historical named exports
 * means importing it evaluates every generated schema module. New consumers
 * should import the common-case constant and metadata from
 * `@retiregolden/engine/schema/current`, or one historical schema from the
 * explicit `@retiregolden/engine/schema/v1` through `/v5` entry points. The
 * zod-backed generator remains isolated at
 * `@retiregolden/engine/schema/generate`.
 *
 * @deprecated Prefer `@retiregolden/engine/schema/current` or an explicit
 * version entry point. This compatibility barrel will not be removed before a
 * semver-major release.
 */
export {
  PLAN_SCHEMA_ID,
  PLAN_SCHEMA_VERSION,
  PLAN_SCHEMA_UNREPRESENTABLE_CONSTRAINTS,
  type JsonSchemaDocument,
} from './current.js'

export { planJsonSchema as planV1JsonSchema } from './plan.v1.generated.js'
export { planJsonSchema as planV2JsonSchema } from './plan.v2.generated.js'
export { planJsonSchema as planV3JsonSchema } from './plan.v3.generated.js'
export { planJsonSchema as planV4JsonSchema } from './plan.v4.generated.js'
export { planJsonSchema } from './current.js'
