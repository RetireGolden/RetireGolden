/**
 * IRC 414(v)(7) high-earner designated Roth catch-up (SECURE 2.0 §603).
 *
 * Contribution years 2026+ only. The wage test is preceding-calendar-year
 * section 3121(a) FICA wages from the sponsoring employer, compared with
 * `exceed` (not ≥) against the pack threshold. The figure the engine
 * compares is a user-entered proxy on the employer account; omitted/zero
 * is not subject. See `irc-414-v-7-A-high-earner-roth-catch-up-mandate`
 * and `irc-414-v-7-A-prior-year-fica-wage-proxy`.
 */

/** First year after Notice 2023-62's administrative transition expired. */
export const ROTH_CATCH_UP_MANDATE_FIRST_YEAR = 2026

/** IRC 414(v)(7)(E) rounding step for the wage threshold. */
export const ROTH_CATCH_UP_WAGE_THRESHOLD_ROUNDING_STEP = 5_000

const STEP_BOUNDARY_TOLERANCE = 1e-9

export function indexRothCatchUpWageThreshold(
  packThreshold: number,
  limitGrowth: number,
): number {
  const increase = packThreshold * (limitGrowth - 1)
  if (increase <= 0) return packThreshold
  const steps = Math.floor(
    increase / ROTH_CATCH_UP_WAGE_THRESHOLD_ROUNDING_STEP + STEP_BOUNDARY_TOLERANCE,
  )
  return packThreshold + steps * ROTH_CATCH_UP_WAGE_THRESHOLD_ROUNDING_STEP
}

/**
 * Whether prior-year FICA wages exceed the 414(v)(7)(A) threshold.
 * Missing or zero wages do not exceed — new hire / SE-only / omitted field.
 */
export function priorYearFicaExceedsRothCatchUpThreshold(
  priorCalendarYearFicaWages: number | null | undefined,
  wageThreshold: number,
): boolean {
  return (priorCalendarYearFicaWages ?? 0) > wageThreshold
}

export function highEarnerRothCatchUpMandated(opts: {
  contributionYear: number
  priorCalendarYearFicaWages: number | null | undefined
  wageThreshold: number
}): boolean {
  if (opts.contributionYear < ROTH_CATCH_UP_MANDATE_FIRST_YEAR) return false
  return priorYearFicaExceedsRothCatchUpThreshold(
    opts.priorCalendarYearFicaWages,
    opts.wageThreshold,
  )
}

export interface EmployerElectiveRequest {
  readonly accountId: string
  readonly type: 'traditional' | 'roth'
  readonly desired: number
  readonly priorCalendarYearFicaWages: number
}

export interface EmployerElectiveLimits {
  readonly contributionYear: number
  readonly baseLimit: number
  readonly catchUpLimit: number
  readonly wageThreshold: number
}

export interface EmployerElectiveAllocation {
  readonly allowed: ReadonlyMap<string, number>
  /** Catch-up dollars that landed in a Roth employer account. */
  readonly designatedRothCatchUp: number
  /** Catch-up dollars refused because the plan has no Roth feature. */
  readonly refusedCatchUp: number
  /**
   * Catch-up dollars moved from a traditional account onto the same-owner Roth
   * sibling. The Roth account is the plan's qualified Roth feature, so these
   * dollars remain elective deferrals of the source plan for employer match.
   */
  readonly redirectedCatchUpBySource: ReadonlyMap<string, number>
  /** Destination of redirected catch-up, if the owner has a Roth employer account. */
  readonly catchUpRothAccountId: string | undefined
}

/**
 * Split an owner's employer-plan elective deferrals into the §402(g) base
 * and the §414(v) catch-up, and force the catch-up slice into designated
 * Roth when the wage test is met.
 *
 * Regular (non-catch-up) deferrals keep the account type already stated.
 * A high earner with no Roth employer account loses the catch-up slice
 * (T.D. 10033 §1.414(v)-2(b)(2): maximum catch-up is $0).
 */
export function allocateEmployerElectiveDeferrals(
  requests: readonly EmployerElectiveRequest[],
  limits: EmployerElectiveLimits,
): EmployerElectiveAllocation {
  const allowed = new Map<string, number>()
  for (const request of requests) allowed.set(request.accountId, 0)

  let usedBase = 0
  let usedCatchUp = 0
  let designatedRothCatchUp = 0
  let refusedCatchUp = 0
  const redirectedCatchUpBySource = new Map<string, number>()
  const hasRothFeature = requests.some((request) => request.type === 'roth')
  const firstRothId = requests.find((request) => request.type === 'roth')?.accountId

  const consume = (amount: number): { fromBase: number; fromCatchUp: number } => {
    const fromBase = Math.min(amount, Math.max(0, limits.baseLimit - usedBase))
    const fromCatchUp = Math.min(
      amount - fromBase,
      Math.max(0, limits.catchUpLimit - usedCatchUp),
    )
    usedBase += fromBase
    usedCatchUp += fromCatchUp
    return { fromBase, fromCatchUp }
  }

  const add = (accountId: string, amount: number): void => {
    allowed.set(accountId, (allowed.get(accountId) ?? 0) + amount)
  }

  for (const request of requests) {
    if (request.desired <= 0) continue
    const mandated = highEarnerRothCatchUpMandated({
      contributionYear: limits.contributionYear,
      priorCalendarYearFicaWages: request.priorCalendarYearFicaWages,
      wageThreshold: limits.wageThreshold,
    })

    if (!mandated || request.type === 'roth') {
      const remaining =
        Math.max(0, limits.baseLimit - usedBase) +
        Math.max(0, limits.catchUpLimit - usedCatchUp)
      const take = Math.min(request.desired, remaining)
      const { fromCatchUp } = consume(take)
      add(request.accountId, take)
      if (mandated && request.type === 'roth') designatedRothCatchUp += fromCatchUp
      continue
    }

    // Traditional + wage test met: only the §402(g) base may stay pre-tax.
    const remainingBase = Math.max(0, limits.baseLimit - usedBase)
    const baseTake = Math.min(request.desired, remainingBase)
    consume(baseTake)
    add(request.accountId, baseTake)

    const leftover = request.desired - baseTake
    if (leftover <= 0) continue
    const remainingCatchUp = Math.max(0, limits.catchUpLimit - usedCatchUp)
    const catchUpTake = Math.min(leftover, remainingCatchUp)
    if (catchUpTake <= 0) continue

    if (hasRothFeature && firstRothId !== undefined) {
      consume(catchUpTake)
      add(firstRothId, catchUpTake)
      designatedRothCatchUp += catchUpTake
      redirectedCatchUpBySource.set(
        request.accountId,
        (redirectedCatchUpBySource.get(request.accountId) ?? 0) + catchUpTake,
      )
    } else {
      refusedCatchUp += catchUpTake
    }
  }

  return {
    allowed,
    designatedRothCatchUp,
    refusedCatchUp,
    redirectedCatchUpBySource,
    catchUpRothAccountId: firstRothId,
  }
}

/**
 * Employee elective dollars that a given employer account's match formula
 * should see. Redirected catch-up stays elective deferral of the source plan
 * (the Roth sibling is that plan's qualified Roth feature), so it is added to
 * the source account and subtracted from the destination. §415(c) cuts on the
 * destination scale the redirected slice in proportion to what actually landed.
 */
export function employerMatchElectiveBase(opts: {
  readonly accountId: string
  readonly employeeLandedByAccountId: ReadonlyMap<string, number>
  readonly allocatedByAccountId: ReadonlyMap<string, number>
  readonly redirectedCatchUpBySource: ReadonlyMap<string, number>
  readonly catchUpRothAccountId: string | undefined
}): number {
  const landedHere = opts.employeeLandedByAccountId.get(opts.accountId) ?? 0
  const destId = opts.catchUpRothAccountId
  const destAllocated = destId === undefined ? 0 : (opts.allocatedByAccountId.get(destId) ?? 0)
  const destLanded = destId === undefined ? 0 : (opts.employeeLandedByAccountId.get(destId) ?? 0)
  const landedSlice = (slice: number): number =>
    destAllocated <= 0 || slice <= 0 ? 0 : destLanded * (slice / destAllocated)

  const redirectedFromHere = opts.redirectedCatchUpBySource.get(opts.accountId) ?? 0
  let redirectedOntoHere = 0
  if (destId === opts.accountId) {
    for (const amount of opts.redirectedCatchUpBySource.values()) redirectedOntoHere += amount
  }
  return Math.max(0, landedHere + landedSlice(redirectedFromHere) - landedSlice(redirectedOntoHere))
}
