/**
 * Withdrawal-rate guardrails: the fields the Spending card shows when that
 * policy mode is selected. Extracted from `SpendingSection.tsx` unchanged (one
 * of the four mode branches the card dispatches to); the card owns the mode
 * select and the grid these fields sit in.
 */

import { usePlan } from '../planContextCore'
import { CheckboxField, PercentField } from '../fields'
import { LEARN } from '../learnLinks'

export function WithdrawalRateGuardrailFields({ hasEarlyPullFlexibleGoals }: { hasEarlyPullFlexibleGoals: boolean }) {
  const { plan, update } = usePlan()
  const e = plan.expenses
  /**
   * The withdrawal-rate pair, read as a pair: neither edge's own path carries
   * what the other holds, and `spendingPolicySchema` accepts each percent on
   * its own with no cross-field refine (engine/model/plan.ts). With the pair
   * inverted, `nextGuardrailMultiplier` (engine/spending/guardrails.ts) cuts
   * whenever the rate clears the upper edge and raises otherwise - there is no
   * rate left that holds - so this is the `.field-warning` contract: nothing
   * refused, nothing rewritten, nothing marked invalid, just said.
   */
  const guardrailLower = e.spendingPolicy?.lowerGuardrailPct ?? 80
  const guardrailUpper = e.spendingPolicy?.upperGuardrailPct ?? 120
  const guardrailWarning =
    e.spendingPolicy?.mode === 'withdrawalRateGuardrails' && guardrailLower >= guardrailUpper
      ? 'The lower guardrail is not below the upper guardrail, so every withdrawal rate would cut or raise spending, never hold. Kept as entered.'
      : null
  if (e.spendingPolicy?.mode !== 'withdrawalRateGuardrails') return null
  return (
    <>
      <PercentField
        label="Upper guardrail"
        help="Cut discretionary spending when the current withdrawal rate exceeds this percent of the starting rate. A common setting is 120%."
        hint="% of the starting withdrawal rate that triggers a cut."
        learn={LEARN.spendingBudget}
        step={5}
        path="expenses.spendingPolicy.upperGuardrailPct"
        warning={guardrailWarning}
        value={e.spendingPolicy.upperGuardrailPct ?? 120}
        onCommit={(v) => update((d) => void (d.expenses.spendingPolicy!.upperGuardrailPct = v ?? 120))}
      />
      <PercentField
        label="Lower guardrail"
        help="Restore discretionary spending when the current withdrawal rate falls below this percent of the starting rate. A common setting is 80%."
        hint="% of the starting withdrawal rate that allows a raise."
        learn={LEARN.spendingBudget}
        step={5}
        path="expenses.spendingPolicy.lowerGuardrailPct"
        warning={guardrailWarning}
        value={e.spendingPolicy.lowerGuardrailPct ?? 80}
        onCommit={(v) => update((d) => void (d.expenses.spendingPolicy!.lowerGuardrailPct = v ?? 80))}
      />
      <PercentField
        label="Adjustment size"
        help="How much of the full discretionary layer each cut or raise moves. A common setting is 10%."
        hint="Cut/raise step, as a % of the discretionary layer."
        learn={LEARN.spendingBudget}
        step={5}
        path="expenses.spendingPolicy.adjustmentPct"
        value={e.spendingPolicy.adjustmentPct ?? 10}
        onCommit={(v) => update((d) => void (d.expenses.spendingPolicy!.adjustmentPct = v ?? 10))}
      />
      <CheckboxField
        label="Allow upside raises"
        help="When enabled, strong paths can restore target spending and then fund ideal/excess annual layers or pull flexible goals earlier within their window. The required floor still stays protected in down markets."
        learn={LEARN.spendingBudget}
        value={e.spendingPolicy.allowRaisesAboveTarget ?? ((e.idealAnnual ?? 0) + (e.excessAnnual ?? 0) > 0 || hasEarlyPullFlexibleGoals)}
        onCommit={(v) => update((d) => void (d.expenses.spendingPolicy!.allowRaisesAboveTarget = v))}
      />
    </>
  )
}
