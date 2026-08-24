/**
 * Half-cent tolerance used by the annual funding fixed point.
 *
 * Projection amounts remain unrounded JavaScript numbers, but the funding
 * ledger deliberately accepts a residual at or below half a cent. Keep
 * reporting consumers on this shared constant so they do not reject a result
 * that the ledger itself accepted.
 */
export const ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS = 0.005
