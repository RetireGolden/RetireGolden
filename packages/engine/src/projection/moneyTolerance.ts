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
