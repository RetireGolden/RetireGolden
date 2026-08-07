/**
 * Shared user-facing copy for the optimizer's retirement-action precondition
 * (`optimizerUnsupportedRetirementActions`). The Optimize page checks the
 * predicate before dispatching a run, so this is the only place the condition
 * is explained — no raw engine error string reaches the user. Same idiom as
 * `retirementActionReadinessVetoCopy.ts` and `acaVetoCopy.ts`: exported
 * strings and builders, no component, so every surface tells the same story.
 *
 * WHAT THIS COPY MAY NOT SAY ANY MORE. It told the user the optimizer
 * "searches conversion schedules against aggregate account balances, which do
 * not account for the money those actions move". That claim is dead. PR #229
 * nets a committed action's balance movement into the LP's own buckets, and
 * PR #236 books the other side of every committed fact the solve sees: a
 * recorded conversion's income as a floor its own conversions stack on
 * (`OptimizerYear.committedOrdinaryIncome`, joined to the `ordinaryBase`
 * constant that is the right-hand side of `tifloor`), a gift's charitable
 * exclusion (`forcedDistributionOrdinaryIncomeExclusion`), and the balance a
 * plan strategy already moved (`exogenousStrategyAccountMovement`). The engine
 * admits an action-bearing plan and prices its committed facts.
 *
 * WHAT HOLDS THE PRECONDITION UP is stated in full at the predicate in
 * `OptimizePage.tsx`, and it is this page's own decision, not an engine limit:
 *   1. The telling is unwritten. The post-processor drops a named-conversion
 *      year from the emitted schedule, so a recommendation for an
 *      action-bearing plan would be silent about exactly the years the user
 *      recorded, and nothing here explains an answer sitting on top of a plan's
 *      own named requests.
 *   2. One cash-side booking is still one-sided, for a NAMED gift routed out of
 *      an RMD.
 * The strings below carry the first, which is true of every plan this
 * predicate ever sees. The second is true of a subset, and copy that stated it
 * for all of them would describe most households' plans wrongly.
 *
 * Finding-framed per the decision-support boundary (guarded by
 * app/src/boundaryLanguage.test.ts): it reports what this page presents, what
 * the search already accounts for, and what a plan edit changes. It never says
 * what to do with money, never predicts a tax outcome, and never promises a
 * surface that does not exist.
 */

import type { ActionReason } from '@retiregolden/engine/actions'

/** Heading for the Optimize page's non-actionable state. */
export const OPTIMIZER_RETIREMENT_ACTION_HEADING =
  'No optimizer recommendation while this plan records retirement actions'

/**
 * What this page does and does not present, in the user's terms. Retrying
 * cannot clear this condition, so the copy says so in place of a retry
 * affordance.
 *
 * Deliberately says nothing about a person, a source account, or a date. The
 * precondition fires on any recorded action, and a plan migrated from an older
 * schema can carry `legacyAggregate*` kinds that hold only an amount and a
 * year (`actions/contract.ts` `legacyAggregateActionRequestBaseShape`). Copy
 * naming details those actions do not have would describe the user's plan
 * wrongly. The amount and the year are what every kind has in common.
 */
export function optimizerRetirementActionExplanation(
  reasons: readonly ActionReason[],
): string {
  const count = reasons.length
  const subject =
    count === 1
      ? 'This plan records 1 retirement action (a withdrawal, a Roth conversion, or a QCD)'
      : `This plan records ${count} retirement actions (withdrawals, Roth conversions, or QCDs)`
  return (
    `${subject} set for a specific amount and year. The optimizer's search does account for them: the ` +
    'balances it searches against already carry the money those actions move, and the income a recorded ' +
    'conversion adds is a floor that any schedule it prices stacks on top of. This page still presents ' +
    'no schedule for a plan that records actions. A schedule shown here would sit on top of your own ' +
    'recorded requests without saying which years it priced, which years your entries already own, or ' +
    'what applying it would install alongside them. Re-running reports the same thing.'
  )
}

/** What the user can rely on, and what a plan edit changes. */
export const OPTIMIZER_RETIREMENT_ACTION_NEXT_STEP =
  'Your Results and Monte Carlo projections still run with these actions in place, at the amounts and ' +
  'years you recorded. Removing the recorded actions under Strategy lets this page run, on the plan that ' +
  'remains once those actions are gone.'
