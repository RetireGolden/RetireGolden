/**
 * Persisted start-age bounds used by planner inputs.
 *
 * These are the pension/annuity start-age endpoints the engine schema
 * enforces, re-exported from `model/plan.ts` so the planner and the parser
 * share one source. They used to be restated here while planner-ui's declared
 * engine minimum resolved to a published package without the named constants;
 * every engine planner-ui can now resolve exports them. AccountFields tests
 * assert that every endpoint is accepted, and every adjacent out-of-range
 * value is refused, by the current engine parser.
 */
export {
  ANNUITY_MIN_START_AGE,
  PENSION_MIN_START_AGE,
  PENSION_MAX_START_AGE,
} from '@retiregolden/engine/model/plan'
