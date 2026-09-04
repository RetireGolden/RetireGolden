/**
 * Persisted start-age bounds used by planner inputs.
 *
 * These restate the pension/annuity start-age endpoints the engine schema
 * enforces. They stayed local because the engine minimum planner-ui declared
 * resolved to a published package whose surface predates the named constants
 * (`ANNUITY_MIN_START_AGE`, `PENSION_MIN_START_AGE`, `PENSION_MAX_START_AGE`
 * in `model/plan.ts`). The declared minimum is now `^0.3.0`, which does export
 * them, so this shim is removable once that version is on npm — a separate
 * change, gated on the publish. AccountFields tests assert that every endpoint
 * is accepted, and every adjacent out-of-range value is refused, by the
 * current engine parser so either side cannot drift silently.
 */
export const ANNUITY_MIN_START_AGE = 40
export const PENSION_MIN_START_AGE = 40
export const PENSION_MAX_START_AGE = 80
