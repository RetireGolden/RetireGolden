/**
 * `@retiregolden/engine/schema/current` — the current Plan JSON Schema without
 * the historical generated modules in its static import graph.
 *
 * Use this entry point for the common case. The compatibility barrel at
 * `@retiregolden/engine/schema` retains every historical named export and
 * therefore necessarily evaluates every generated schema version.
 */
export {
  PLAN_SCHEMA_ID,
  PLAN_SCHEMA_VERSION,
  PLAN_SCHEMA_UNREPRESENTABLE_CONSTRAINTS,
  type JsonSchemaDocument,
} from './planSchemaMeta.js'

export { planJsonSchema } from './plan.v5.generated.js'
