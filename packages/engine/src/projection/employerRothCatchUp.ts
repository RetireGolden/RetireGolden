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
  /**
   * Incremental desired elective deferral after any verified year-to-date
   * amounts already reflected in `EmployerElectiveLimits.priorContributions`.
   * Desired requests are never treated as historical evidence.
   */
  readonly desired: number
  readonly priorCalendarYearFicaWages: number
}

/**
 * Verified same-year elective deferrals already made to this plan/employer
 * before the incremental `desired` requests. Unknown differs from known zero.
 */
export type EmployerPriorElectiveContributions =
  | { readonly status: 'unknown' }
  | {
      readonly status: 'known'
      readonly designatedRothElectiveDeferrals: number
      readonly totalElectiveDeferrals: number
      readonly asOfDate: string
    }

export interface EmployerElectiveLimits {
  readonly contributionYear: number
  readonly baseLimit: number
  readonly catchUpLimit: number
  readonly wageThreshold: number
  /**
   * IRC 415(c)(3) compensation stand-in for 414(v)(2)(A)(ii). The engine
   * uses current-year wages, the same proxy 415(c) already uses.
   */
  readonly compensation: number
  /**
   * T.D. 10033 §1.414(v)-2(b)(1)/(d)(6): previously made designated Roth
   * deferrals within the year satisfy the Roth catch-up requirement.
   * Omitted / undefined is treated as known-zero only when callers explicitly
   * pass `{ status: 'known', …: 0 }`; prefer `unknown` when history is absent.
   */
  readonly priorContributions?: EmployerPriorElectiveContributions
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
  /**
   * Portion of each account's `allowed` that is §414(v) catch-up. Paragraph
   * (3)(A) keeps that slice out of §415(c) annual additions.
   */
  readonly catchUpByAccount: ReadonlyMap<string, number>
  /** Destination of redirected catch-up, if the owner has a Roth employer account. */
  readonly catchUpRothAccountId: string | undefined
  /**
   * Additional designated Roth still required after counting verified prior
   * designated Roth deferrals toward the §414(v)(7) mandate. Null when prior
   * history is unknown (distinct from known zero).
   */
  readonly additionalRothCatchUpStillRequired: number | null
  readonly priorContributionsStatus: 'omittedAsZero' | 'known' | 'unknown'
}

/**
 * Required additional designated Roth after counting verified prior Roth
 * deferrals toward catch-up actually required by the resulting annual total.
 * `max(0, catchUpRequired − priorEligibleRoth)`.
 */
export function additionalRothCatchUpRequiredAfterPrior(input: {
  readonly annualTotalElectiveDeferrals: number
  readonly baseLimit: number
  readonly catchUpLimit: number
  readonly priorDesignatedRothElectiveDeferrals: number
}): number {
  const catchUpPortionOfAnnual = Math.min(
    Math.max(0, input.annualTotalElectiveDeferrals - input.baseLimit),
    Math.max(0, input.catchUpLimit),
  )
  return Math.max(
    0,
    catchUpPortionOfAnnual - Math.max(0, input.priorDesignatedRothElectiveDeferrals),
  )
}

function catchUpSliceOfTotal(
  annualTotal: number,
  baseLimit: number,
  catchUpLimit: number,
): number {
  return Math.min(Math.max(0, annualTotal - baseLimit), Math.max(0, catchUpLimit))
}

/**
 * Split an owner's employer-plan elective deferrals into the §402(g) base
 * and the §414(v) catch-up, and force the catch-up slice into designated
 * Roth when the wage test is met.
 *
 * Catch-up is the excess of the year's elective-deferral total over the
 * §402(g)/401(a)(30) base — not a chronological first-in assignment of prior
 * dollars. Previously made designated Roth deferrals count toward the
 * §414(v)(7) Roth catch-up requirement (T.D. 10033 §1.414(v)-2(b)(1)/(d)(6)).
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

  const prior = limits.priorContributions
  const priorStatus: EmployerElectiveAllocation['priorContributionsStatus'] =
    prior === undefined ? 'omittedAsZero' : prior.status === 'known' ? 'known' : 'unknown'
  const priorTotal =
    prior !== undefined && prior.status === 'known' ? prior.totalElectiveDeferrals : 0
  const priorRoth =
    prior !== undefined && prior.status === 'known'
      ? prior.designatedRothElectiveDeferrals
      : 0

  if (
    prior !== undefined &&
    prior.status === 'known' &&
    (prior.designatedRothElectiveDeferrals < 0 ||
      prior.totalElectiveDeferrals < 0 ||
      prior.designatedRothElectiveDeferrals > prior.totalElectiveDeferrals ||
      !Number.isFinite(prior.designatedRothElectiveDeferrals) ||
      !Number.isFinite(prior.totalElectiveDeferrals))
  ) {
    throw new Error(
      'employer elective prior contributions are inconsistent (negative, nonfinite, or Roth > total)',
    )
  }

  const maxAnnual = limits.baseLimit + limits.catchUpLimit
  // Seed total usage from verified YTD so incremental desires are not double-counted.
  // Do not clamp actual history to the annual limit: an already-over-limit YTD
  // amount leaves no capacity for a new request, rather than becoming invented
  // room for one.
  let usedTotal = priorTotal
  // Prior designated Roth counts toward the Roth catch-up mandate even when those
  // dollars were deferred before the §402(g) base was exhausted.
  let designatedRothCatchUp =
    priorStatus === 'unknown' ? 0 : Math.min(Math.max(0, priorRoth), limits.catchUpLimit)
  let refusedCatchUp = 0
  const redirectedCatchUpBySource = new Map<string, number>()
  const catchUpByAccount = new Map<string, number>()
  const hasRothFeature = requests.some((request) => request.type === 'roth')
  const firstRothId = requests.find((request) => request.type === 'roth')?.accountId

  const add = (accountId: string, amount: number): void => {
    if (amount <= 0) return
    allowed.set(accountId, (allowed.get(accountId) ?? 0) + amount)
  }
  const addCatchUp = (accountId: string, amount: number): void => {
    if (amount <= 0) return
    catchUpByAccount.set(accountId, (catchUpByAccount.get(accountId) ?? 0) + amount)
  }

  const remainingCapacity = (): number => {
    // 414(v)(2)(A)(ii) limits the annual catch-up slice to compensation less
    // the annual elective-deferral slice determined without subsection (v).
    // Once the §402(g) base is filled, that means total elective deferrals
    // cannot exceed the supplied compensation. `compensation` is the caller's
    // bounded current-year amount; prior designated Roth is actual YTD
    // deferral evidence, not additional compensation.
    const compensationBoundAnnualTotal = Math.min(maxAnnual, limits.compensation)
    return Math.max(0, compensationBoundAnnualTotal - usedTotal)
  }

  const applyIncremental = (
    amount: number,
  ): { fromBase: number; fromCatchUp: number } => {
    const beforeCatchUp = catchUpSliceOfTotal(usedTotal, limits.baseLimit, limits.catchUpLimit)
    usedTotal += amount
    const afterCatchUp = catchUpSliceOfTotal(usedTotal, limits.baseLimit, limits.catchUpLimit)
    const fromCatchUp = afterCatchUp - beforeCatchUp
    const fromBase = amount - fromCatchUp
    return { fromBase, fromCatchUp }
  }

  for (const request of requests) {
    if (request.desired <= 0) continue
    const mandated = highEarnerRothCatchUpMandated({
      contributionYear: limits.contributionYear,
      priorCalendarYearFicaWages: request.priorCalendarYearFicaWages,
      wageThreshold: limits.wageThreshold,
    })

    const capacity = remainingCapacity()
    if (capacity <= 0) continue
    const take = Math.min(request.desired, capacity)
    if (take <= 0) continue

    if (!mandated || request.type === 'roth') {
      const { fromCatchUp } = applyIncremental(take)
      add(request.accountId, take)
      addCatchUp(request.accountId, fromCatchUp)
      if (mandated && request.type === 'roth') {
        // Newly landed Roth catch-up dollars count toward the mandate.
        designatedRothCatchUp += fromCatchUp
      }
      continue
    }

    // Traditional + wage test met: only the unmet Roth catch-up slice must be
    // designated Roth. Prior designated Roth already credits the mandate.
    const projectedAnnual = usedTotal + take
    const catchUpRequired = catchUpSliceOfTotal(
      projectedAnnual,
      limits.baseLimit,
      limits.catchUpLimit,
    )
    const rothStillNeeded = Math.max(0, catchUpRequired - designatedRothCatchUp)
    const rothTake = Math.min(take, rothStillNeeded)
    const tradTake = take - rothTake

    if (tradTake > 0) {
      applyIncremental(tradTake)
      add(request.accountId, tradTake)
      // New traditional dollars that fill remaining base room are not §414(v)
      // catch-up for §415(c); prior Roth already satisfies that slice when
      // rothTake is zero.
    }

    if (rothTake <= 0) continue

    if (hasRothFeature && firstRothId !== undefined) {
      const { fromCatchUp } = applyIncremental(rothTake)
      add(firstRothId, rothTake)
      addCatchUp(firstRothId, fromCatchUp)
      designatedRothCatchUp += rothTake
      redirectedCatchUpBySource.set(
        request.accountId,
        (redirectedCatchUpBySource.get(request.accountId) ?? 0) + rothTake,
      )
    } else {
      // No Roth feature: the unmet catch-up cannot be made (max catch-up $0).
      refusedCatchUp += rothTake
    }
  }

  const catchUpRequiredByAnnual = catchUpSliceOfTotal(
    usedTotal,
    limits.baseLimit,
    limits.catchUpLimit,
  )
  const unmetAfterAllocation =
    priorStatus === 'unknown'
      ? null
      : Math.max(0, catchUpRequiredByAnnual - designatedRothCatchUp)

  return {
    allowed,
    designatedRothCatchUp,
    refusedCatchUp,
    redirectedCatchUpBySource,
    catchUpByAccount,
    catchUpRothAccountId: firstRothId,
    additionalRothCatchUpStillRequired: unmetAfterAllocation,
    priorContributionsStatus: priorStatus,
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
