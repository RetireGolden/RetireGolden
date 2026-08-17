/**
 * IRC §408(d)(8)(A) second sentence: the QCD exclusion is reduced, but not
 * below zero, by the excess of deductible §219 contributions for all taxable
 * years ending on or after age 70½ over reductions already taken.
 *
 * One reading, used by both the named QCD arm and the aggregate `qcdAnnual`
 * arm. Units are the caller's: cents or plan dollars. The arithmetic is the
 * same either way.
 */

export interface Irc408d8AContributionOffsetInput {
  /** Qualified charitable amount before this sentence, not below zero. */
  readonly candidateExclusion: number
  /**
   * Aggregate deductions allowed under §219 for years ending on or after the
   * donor attained age 70½, through the current taxable year.
   */
  readonly deductibleSection219Total: number
  /** Aggregate reductions under this sentence in earlier taxable years. */
  readonly reductionsAlreadyTaken: number
}

export interface Irc408d8AContributionOffsetResult {
  /** Remaining exclusion after the reduction, not below zero. */
  readonly excludableAmount: number
  /** Reduction applied this year. */
  readonly offsetApplied: number
  /** Running total of reductions after this year, for the next year to read. */
  readonly reductionsAfter: number
}

/**
 * Apply the lifetime post-70½ deductible-contribution offset.
 *
 * Roth contributions, employer deferrals, and nondeductible IRA deposits are
 * not §219 deductions and must not be included in `deductibleSection219Total`.
 */
export function applyIrc408d8AContributionOffset(
  input: Readonly<Irc408d8AContributionOffsetInput>,
): Irc408d8AContributionOffsetResult {
  const candidate = Math.max(0, input.candidateExclusion)
  const total = Math.max(0, input.deductibleSection219Total)
  const already = Math.max(0, input.reductionsAlreadyTaken)
  const excess = Math.max(0, total - already)
  const offsetApplied = Math.min(candidate, excess)
  return {
    excludableAmount: candidate - offsetApplied,
    offsetApplied,
    reductionsAfter: already + offsetApplied,
  }
}
