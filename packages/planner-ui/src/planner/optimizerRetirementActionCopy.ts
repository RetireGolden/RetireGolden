/**
 * Shared user-facing copy for the optimizer's retirement-action precondition
 * (`optimizerUnsupportedRetirementActions`). The Optimize page checks the
 * predicate before dispatching a run, so this is the only place the condition
 * is explained — no raw engine error string reaches the user. Same idiom as
 * `retirementActionReadinessVetoCopy.ts` and `acaVetoCopy.ts`: exported
 * strings and builders, no component, so every surface tells the same story.
 *
 * Finding-framed per the decision-support boundary (guarded by
 * app/src/boundaryLanguage.test.ts): it reports what the optimizer cannot
 * price and which plan edit changes that, never what to do with money.
 */

import type { ActionReason } from '@retiregolden/engine/actions'

/** Heading for the Optimize page's non-actionable state. */
export const OPTIMIZER_RETIREMENT_ACTION_HEADING =
  "Can't optimize a plan that records retirement actions"

/**
 * What is unsupported, in the user's terms. Retrying cannot clear this
 * condition, so the copy says so in place of a retry affordance.
 *
 * Deliberately says nothing about a person, a source account, or a date. The
 * precondition fires on any recorded action, and a plan migrated from an older
 * schema can carry `legacyAggregate*` kinds that hold only an amount and a
 * year (`actions/contract.ts` `legacyAggregateActionRequestBaseShape`). Copy
 * naming details those actions do not have would describe the user's plan
 * wrongly. The amount and the year are what every kind has in common, and they
 * are also the whole of what the optimizer cannot reconcile.
 */
export function optimizerRetirementActionExplanation(
  reasons: readonly ActionReason[],
): string {
  const count = reasons.length
  const subject =
    count === 1
      ? 'This plan records 1 retirement action — a withdrawal, Roth conversion, or QCD'
      : `This plan records ${count} retirement actions — withdrawals, Roth conversions, or QCDs`
  return (
    `${subject} set for a specific amount and year. The optimizer searches conversion schedules against ` +
    'aggregate account balances, which do not account for the money those actions move, so it cannot ' +
    'price a schedule that runs alongside them. Re-running reports the same thing.'
  )
}

/** What the user can change, so the page is not a dead end. */
export const OPTIMIZER_RETIREMENT_ACTION_NEXT_STEP =
  'Your Results and Monte Carlo projections still run with these actions in place. To compare optimizer ' +
  'schedules instead, remove the recorded actions under Strategy.'
