/**
 * Half-cent tolerance used by the annual funding fixed point.
 *
 * Projection amounts remain unrounded JavaScript numbers, but the funding
 * ledger deliberately accepts its total annual residual at or below half a
 * cent. This is one budget for the solved annual identity, not an allowance
 * that accumulates for every branch using the constant as a numerical guard.
 * Keep reporting consumers on this shared constant so they do not reject a
 * result that the ledger itself accepted.
 */
export const ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS = 0.005

/**
 * One cent: the aggregate Roth conversion phase's "not worth acting on" floor.
 *
 * Deliberately its own constant, twice as loose as the funding tolerance above
 * and belonging to a different budget. It is not a residual the ledger
 * accepts; it is the size below which a conversion, a basis layer, or a
 * shortfall against an owner's slice is a rounding artifact rather than a
 * planning fact — nothing sub-cent is worth executing, recording a basis layer
 * for, or warning anyone about. Named so an edit to either number cannot be
 * mistaken for a change to the other.
 */
export const AGGREGATE_ROTH_CONVERSION_EPSILON_PLAN_DOLLARS = 0.01
