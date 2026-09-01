/**
 * Persisted start-age bounds used by planner inputs.
 *
 * planner-ui 0.9 still supports the published engine 0.2.0 minimum, whose
 * package surface predates the named pension/minimum constants now used by the
 * workspace engine schema. Keep these compatibility values local until the
 * planner can raise its engine minimum. AccountFields tests assert that every
 * endpoint is accepted, and every adjacent out-of-range value is refused, by
 * the current engine parser so either side cannot drift silently.
 */
export const ANNUITY_MIN_START_AGE = 40
export const PENSION_MIN_START_AGE = 40
export const PENSION_MAX_START_AGE = 80
