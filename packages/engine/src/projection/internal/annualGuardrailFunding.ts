/** Pure annual guardrail decision and discretionary-layer funding plan. */
import type { Account, Plan } from '../../model/plan.js'
import {
  nextBalanceGuardrailMultiplier,
  nextGuardrailMultiplier,
  type GuardrailAction,
  type GuardrailPolicy,
} from '../../spending/guardrails.js'

export interface AnnualGuardrailFundingPlan {
  readonly discretionaryMultiplier: number
  readonly startingWithdrawalRate: number | null
  readonly startingRealPortfolio: number | null
  readonly guardrailAction: GuardrailAction
  readonly targetLifestyleFunded: number
  readonly idealLifestyleFunded: number
  readonly excessLifestyleFunded: number
  readonly cutting: boolean
  readonly canPullForwardGoals: boolean
  readonly remainingUpsideBudget: number
}

export function annualGuardrailFundingPlan(input: {
  readonly guardrailsActive: boolean
  readonly riskBasedGuardrails: boolean
  readonly allowRaisesAboveTarget: boolean | undefined
  readonly guardrailPolicy: GuardrailPolicy
  readonly oneTimeGoals: Plan['expenses']['oneTimeGoals']
  readonly isGoalResolved: (goalId: string) => boolean
  readonly year: number
  readonly inflFactor: number
  readonly anyAlive: boolean
  readonly balances: readonly { readonly account: Account }[]
  readonly startOfYearBalance: ReadonlyMap<string, number>
  readonly requiredLifestyle: number
  readonly targetLifestyle: number
  readonly idealLifestyle: number
  readonly excessLifestyle: number
  readonly systemRequired: number
  readonly discretionaryMultiplier: number
  readonly startingWithdrawalRate: number | null
  readonly startingRealPortfolio: number | null
}): AnnualGuardrailFundingPlan {
  let discretionaryMultiplier = input.discretionaryMultiplier
  let startingWithdrawalRate = input.startingWithdrawalRate
  let startingRealPortfolio = input.startingRealPortfolio
  let guardrailAction: GuardrailAction = 'hold'
  const earlyPullGoalBudget = input.guardrailsActive
    ? input.oneTimeGoals.reduce((sum, goal) => {
        if (input.isGoalResolved(goal.id)) return sum
        const flexibility = goal.flexibility ?? 'fixed'
        if (flexibility === 'fixed') return sum
        const earliestYear = Math.min(goal.earliestYear ?? goal.year, goal.year)
        if (input.year >= earliestYear && input.year < goal.year) {
          return sum + goal.amount * input.inflFactor
        }
        return sum
      }, 0)
    : 0
  const annualUpsideLifestyle = input.idealLifestyle + input.excessLifestyle
  const guardrailStepBasis = Math.max(
    input.targetLifestyle,
    annualUpsideLifestyle,
    1,
  )
  const allowRaisesAboveTarget =
    input.allowRaisesAboveTarget ??
    annualUpsideLifestyle + earlyPullGoalBudget > 0
  const maxGuardrailMultiplier =
    input.guardrailsActive && allowRaisesAboveTarget
      ? 1 +
        (annualUpsideLifestyle + earlyPullGoalBudget) / guardrailStepBasis
      : 1

  if (input.guardrailsActive && input.anyAlive) {
    let startPortfolio = 0
    for (const balance of input.balances) {
      startPortfolio += input.startOfYearBalance.get(balance.account.id) ?? 0
    }
    if (input.riskBasedGuardrails) {
      // Risk-based guardrails compare the real start balance with the stable
      // first solvent year's real portfolio anchor.
      const realBalance = startPortfolio / input.inflFactor
      if (startingRealPortfolio === null && startPortfolio > 0) {
        startingRealPortfolio = realBalance
      }
      if (startingRealPortfolio !== null) {
        const decision = nextBalanceGuardrailMultiplier(
          discretionaryMultiplier,
          realBalance,
          startingRealPortfolio,
          input.guardrailPolicy,
          maxGuardrailMultiplier,
        )
        discretionaryMultiplier = decision.multiplier
        guardrailAction = decision.action
      }
    } else {
      // Withdrawal-rate guardrails use recurring target spending before the
      // funding fixed point, avoiding a circular signal.
      const targetRecurring =
        input.systemRequired + input.requiredLifestyle + input.targetLifestyle
      const currentRate =
        startPortfolio > 0 ? targetRecurring / startPortfolio : NaN
      if (
        startingWithdrawalRate === null &&
        Number.isFinite(currentRate)
      ) {
        startingWithdrawalRate = currentRate
      }
      if (startingWithdrawalRate !== null) {
        const decision = nextGuardrailMultiplier(
          discretionaryMultiplier,
          currentRate,
          startingWithdrawalRate,
          input.guardrailPolicy,
          maxGuardrailMultiplier,
        )
        discretionaryMultiplier = decision.multiplier
        guardrailAction = decision.action
      }
    }
  }

  const targetLifestyleFunded = input.guardrailsActive
    ? input.targetLifestyle * Math.min(1, discretionaryMultiplier)
    : input.targetLifestyle
  const upsideBudget = input.guardrailsActive
    ? Math.max(0, discretionaryMultiplier - 1) * guardrailStepBasis
    : annualUpsideLifestyle
  const idealLifestyleFunded = Math.min(input.idealLifestyle, upsideBudget)
  const excessLifestyleFunded = Math.min(
    input.excessLifestyle,
    Math.max(0, upsideBudget - idealLifestyleFunded),
  )
  const remainingUpsideBudget = Math.max(
    0,
    upsideBudget - idealLifestyleFunded - excessLifestyleFunded,
  )
  const cutting =
    input.guardrailsActive && discretionaryMultiplier < 1 - 1e-9
  const canPullForwardGoals =
    input.guardrailsActive &&
    !cutting &&
    (guardrailAction === 'raise' || discretionaryMultiplier > 1 + 1e-9)

  return {
    discretionaryMultiplier,
    startingWithdrawalRate,
    startingRealPortfolio,
    guardrailAction,
    targetLifestyleFunded,
    idealLifestyleFunded,
    excessLifestyleFunded,
    cutting,
    canPullForwardGoals,
    remainingUpsideBudget,
  }
}
