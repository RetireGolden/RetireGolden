/**
 * Coordinate the annual tax/withdrawal/ACA funding probes without committing
 * any caller-owned ledger state.
 *
 * WHAT IT TAKES: the pre-tax cash need, the cash/healthcare facts needed to
 * size a coordinated HECM draw, the ACA actionability facts that select the
 * fail-closed basin, and one evaluator for a candidate withdrawal need.
 *
 * WHAT IT PRODUCES: the exact evaluator result selected for commitment, its
 * convergence evidence, the accepted HECM draw/cash inflow, and typed ACA
 * fallback diagnostics. The selected evaluator object is returned by identity.
 *
 * WHAT IT REFUSES: this coordinator does not mutate healthcare, HECM debt,
 * balances, warnings, or any annual ledger. The evaluator may inspect the
 * caller's uncommitted state, but every irreversible write remains after this
 * call in `simulatePlan`.
 */

const DEFAULT_DIRECT_ITERATION_LIMIT = 8
export const ANNUAL_FUNDING_FIXED_POINT_MAX_EVALUATIONS = 160

export interface AnnualFundingFixedPointEvaluation {
  readonly requiredNeed: number
  readonly withdrawalPlan: Readonly<{ shortfall: number }>
  readonly healthcare: number
  readonly acaQuote: Readonly<{ overCliff: boolean }> | null
  readonly acaSupportCodes: readonly unknown[]
}

export interface AnnualFundingFixedPointEvaluationRequest {
  readonly need: number
  readonly forceGrossAca: boolean
  readonly cashInflows: number
}

export interface AnnualFundingFixedPointInput<
  Evaluation extends AnnualFundingFixedPointEvaluation,
> {
  /** Expenses plus contributions, before tax and penalties. */
  readonly spendingUsesBeforeTax: number
  readonly baseCashInflows: number
  readonly currentHealthcare: number
  readonly coordinatedHecmCapacity: number
  readonly acaActive: boolean
  readonly acaGrossEnrollmentPremium: number
  readonly acaInitialSupportCodeCount: number
  readonly tolerancePlanDollars: number
  readonly evaluate: (
    request: Readonly<AnnualFundingFixedPointEvaluationRequest>,
  ) => Evaluation
}

export interface AnnualFundingFixedPointResult<
  Evaluation extends AnnualFundingFixedPointEvaluation,
> {
  /** Exact object returned by the accepted evaluator call. */
  readonly evaluation: Evaluation
  readonly converged: boolean
  readonly closestResidual: number
  readonly evaluationCount: number
  readonly maxEvaluationCount: number
  readonly acceptedCoordinatedHecmDraw: number
  readonly acceptedCashInflows: number
  readonly acaFixedPointFailed: boolean
  readonly acaConflictingCliffBasins: boolean
}

interface FundingRoot<Evaluation extends AnnualFundingFixedPointEvaluation> {
  readonly evaluation: Evaluation
  readonly need: number
  readonly converged: boolean
  readonly closestResidual: number
}

/**
 * Does not mutate the input or evaluator values; evaluator invocation effects
 * remain explicitly caller-owned.
 */
export function annualFundingFixedPoint<
  Evaluation extends AnnualFundingFixedPointEvaluation,
>(
  input: AnnualFundingFixedPointInput<Evaluation>,
): AnnualFundingFixedPointResult<Evaluation> {
  const tolerance = input.tolerancePlanDollars
  let evaluationCount = 0

  const evaluate = (
    need: number,
    forceGrossAca: boolean,
    cashInflows: number,
  ): Evaluation => {
    evaluationCount++
    return input.evaluate({ need, forceGrossAca, cashInflows })
  }

  const solveFundingRoot = (
    initialNeed: number,
    cashInflows: number,
    forceGrossAca = false,
    maxEvaluations = ANNUAL_FUNDING_FIXED_POINT_MAX_EVALUATIONS,
    directIterationLimit = DEFAULT_DIRECT_ITERATION_LIMIT,
  ): FundingRoot<Evaluation> => {
    const evaluationLimit = evaluationCount + maxEvaluations
    let need = initialNeed
    let evaluation = evaluate(need, forceGrossAca, cashInflows)
    let converged = Math.abs(evaluation.requiredNeed - need) <= tolerance
    for (
      let i = 1;
      i < directIterationLimit && !converged && evaluationCount < evaluationLimit;
      i++
    ) {
      need = evaluation.requiredNeed
      evaluation = evaluate(need, forceGrossAca, cashInflows)
      converged = Math.abs(evaluation.requiredNeed - need) <= tolerance
    }
    if (converged) {
      return { evaluation, need, converged, closestResidual: 0 }
    }

    // A finite portfolio brackets the root: once all spendable balances are
    // exhausted, requiredNeed is bounded while the candidate keeps growing.
    let lowerNeed = 0
    let lower = evaluate(lowerNeed, forceGrossAca, cashInflows)
    let upperNeed = Math.max(1, need, evaluation.requiredNeed)
    let upper = evaluate(upperNeed, forceGrossAca, cashInflows)
    let upperResidual = upper.requiredNeed - upperNeed
    for (
      let i = 0;
      i < 64 &&
      upperResidual > tolerance &&
      upper.withdrawalPlan.shortfall <= tolerance &&
      evaluationCount < evaluationLimit;
      i++
    ) {
      upperNeed *= 2
      upper = evaluate(upperNeed, forceGrossAca, cashInflows)
      upperResidual = upper.requiredNeed - upperNeed
    }

    // Once withdrawals are exhausted, jump to the bounded requirement rather
    // than doubling through inputs that cannot change the withdrawal mix.
    if (
      upperResidual > tolerance &&
      upper.withdrawalPlan.shortfall > tolerance &&
      evaluationCount < evaluationLimit
    ) {
      upperNeed = Math.max(upperNeed, upper.requiredNeed)
      upper = evaluate(upperNeed, forceGrossAca, cashInflows)
      upperResidual = upper.requiredNeed - upperNeed
    }

    if (Math.abs(upperResidual) <= tolerance) {
      return { evaluation: upper, need: upperNeed, converged: true, closestResidual: 0 }
    }

    // Tax rules can contain hard steps. Bisection therefore requires a true
    // sign-change bracket and retains the closest endpoint if none is exact.
    for (
      let i = 0;
      i < 64 &&
      upperResidual <= 0 &&
      evaluationCount < evaluationLimit;
      i++
    ) {
      const midpointNeed = (lowerNeed + upperNeed) / 2
      const midpoint = evaluate(midpointNeed, forceGrossAca, cashInflows)
      const residual = midpoint.requiredNeed - midpointNeed
      if (Math.abs(residual) <= tolerance) {
        return {
          evaluation: midpoint,
          need: midpointNeed,
          converged: true,
          closestResidual: 0,
        }
      }
      if (residual > 0) {
        lowerNeed = midpointNeed
        lower = midpoint
      } else {
        upperNeed = midpointNeed
        upper = midpoint
        upperResidual = residual
      }
      if (upperNeed - lowerNeed <= tolerance) break
    }

    const lowerResidual = Math.abs(lower.requiredNeed - lowerNeed)
    const closestResidual = Math.min(lowerResidual, Math.abs(upperResidual))
    return {
      evaluation: lowerResidual <= Math.abs(upperResidual) ? lower : upper,
      need: lowerResidual <= Math.abs(upperResidual) ? lowerNeed : upperNeed,
      converged: false,
      closestResidual,
    }
  }

  let acceptedCoordinatedHecmDraw = 0
  let acceptedCashInflows = input.baseCashInflows
  let spendingNeedBeforeTax = Math.max(
    0,
    input.spendingUsesBeforeTax - input.baseCashInflows,
  )

  // A coordinated HECM draw changes withdrawals, withdrawals change ACA MAGI,
  // and the reconciled premium changes the pre-tax need the draw should cover.
  // The evaluator observes a candidate cash inflow; no line debt is committed.
  if (
    input.coordinatedHecmCapacity > tolerance &&
    spendingNeedBeforeTax > tolerance
  ) {
    let candidateDraw = 0
    let coordinatedDrawConverged = false
    for (let drawPass = 0; drawPass < 16; drawPass++) {
      const candidateCashInflows = input.baseCashInflows + candidateDraw
      const probe = solveFundingRoot(
        Math.max(0, input.spendingUsesBeforeTax - candidateCashInflows),
        candidateCashInflows,
      )
      if (!probe.converged) break

      const postCreditPreTaxNeed = Math.max(
        0,
        input.spendingUsesBeforeTax +
          (probe.evaluation.healthcare - input.currentHealthcare) -
          input.baseCashInflows,
      )
      const nextDraw = Math.min(
        input.coordinatedHecmCapacity,
        postCreditPreTaxNeed,
      )
      if (Math.abs(nextDraw - candidateDraw) <= tolerance) {
        acceptedCoordinatedHecmDraw = nextDraw
        coordinatedDrawConverged = true
        break
      }
      candidateDraw = nextDraw
    }
    if (!coordinatedDrawConverged) acceptedCoordinatedHecmDraw = 0
    acceptedCashInflows =
      input.baseCashInflows + acceptedCoordinatedHecmDraw
    spendingNeedBeforeTax = Math.max(
      0,
      input.spendingUsesBeforeTax - acceptedCashInflows,
    )
    // HECM probes are implementation detail; convergence diagnostics describe
    // only the accepted final funding solve.
    evaluationCount = 0
  }

  const fundingRoot = solveFundingRoot(
    spendingNeedBeforeTax,
    acceptedCashInflows,
  )
  let evaluation = fundingRoot.evaluation
  let converged = fundingRoot.converged
  let acaFixedPointFailed = false

  if (!converged && input.acaActive) {
    // Never retain a cheaper provisional credit when the subsidized fixed
    // point fails: restart from gross premium and mark ACA non-actionable.
    acaFixedPointFailed = true
    const grossRoot = solveFundingRoot(
      Math.max(0, evaluation.requiredNeed),
      acceptedCashInflows,
      true,
    )
    evaluation = grossRoot.evaluation
    converged = grossRoot.converged
  }

  // An ACA cliff can admit both a subsidized and gross-premium fixed point.
  // Probe the opposite basin deterministically and fail closed to gross when
  // both are independently self-consistent.
  let acaConflictingCliffBasins = false
  if (
    input.acaActive &&
    converged &&
    !acaFixedPointFailed &&
    input.acaInitialSupportCodeCount === 0 &&
    evaluation.acaQuote !== null
  ) {
    if (evaluation.acaQuote.overCliff) {
      const lowRoot = solveFundingRoot(
        Math.max(
          0,
          spendingNeedBeforeTax - input.acaGrossEnrollmentPremium,
        ),
        acceptedCashInflows,
        false,
        ANNUAL_FUNDING_FIXED_POINT_MAX_EVALUATIONS,
        ANNUAL_FUNDING_FIXED_POINT_MAX_EVALUATIONS,
      )
      const lowEvaluation = lowRoot.evaluation
      if (
        lowRoot.converged &&
        lowEvaluation.acaSupportCodes.length === 0 &&
        lowEvaluation.acaQuote !== null &&
        !lowEvaluation.acaQuote.overCliff &&
        lowEvaluation.healthcare + tolerance < evaluation.healthcare
      ) {
        acaConflictingCliffBasins = true
      }
    } else {
      const grossRoot = solveFundingRoot(
        spendingNeedBeforeTax,
        acceptedCashInflows,
        true,
        ANNUAL_FUNDING_FIXED_POINT_MAX_EVALUATIONS,
        ANNUAL_FUNDING_FIXED_POINT_MAX_EVALUATIONS,
      )
      if (grossRoot.converged) {
        const grossEvaluation = evaluate(
          grossRoot.need,
          false,
          acceptedCashInflows,
        )
        if (
          Math.abs(grossEvaluation.requiredNeed - grossRoot.need) <= tolerance &&
          grossEvaluation.acaSupportCodes.length === 0 &&
          grossEvaluation.acaQuote?.overCliff &&
          grossEvaluation.healthcare > evaluation.healthcare + tolerance
        ) {
          evaluation = grossEvaluation
          converged = true
          acaConflictingCliffBasins = true
        }
      }
    }
  }

  return {
    evaluation,
    converged,
    closestResidual: fundingRoot.closestResidual,
    evaluationCount,
    maxEvaluationCount: ANNUAL_FUNDING_FIXED_POINT_MAX_EVALUATIONS,
    acceptedCoordinatedHecmDraw,
    acceptedCashInflows,
    acaFixedPointFailed,
    acaConflictingCliffBasins,
  }
}
