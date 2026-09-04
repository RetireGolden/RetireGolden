/**
 * The Spending card's dynamic-spending-policy block: the mode select, and the
 * fields and callouts of whichever of the four modes is selected. Each mode
 * lives in its own sibling module and renders nothing when it is not the one
 * chosen ('fixedTarget' has no fields at all, which is why there are three of
 * them).
 *
 * Extracted from `SpendingSection.tsx` unchanged. A mode's fields sit inside
 * this block's `form-grid` and its callout after that grid, so the risk-based
 * solve state is held here and handed to both halves.
 */

import { usePlan } from '../planContextCore'
import { SelectField } from '../fields'
import { LearnLink } from '../../learn/LearnLink'
import { LEARN } from '../learnLinks'
import { AbwPolicyCallout, AbwPolicyFields } from './SpendingPolicyAbw'
import { RiskBasedGuardrailFields, RiskBasedThresholdsCallout } from './SpendingPolicyRiskBased'
import { useThresholdSolve } from './useThresholdSolve'
import { WithdrawalRateGuardrailFields } from './SpendingPolicyWithdrawalRate'

export function SpendingPolicyCard() {
  const { plan, update } = usePlan()
  const e = plan.expenses
  const thresholds = useThresholdSolve()
  const hasEarlyPullFlexibleGoals = e.oneTimeGoals.some((g) => {
    const flexibility = g.flexibility ?? 'fixed'
    const earliestYear = Math.min(g.earliestYear ?? g.year, g.year)
    return flexibility !== 'fixed' && earliestYear < g.year
  })
  return (
    <>
      <h3>Dynamic spending policy</h3>
      <p className="card-hint">
        Let spending flex with the market instead of holding a fixed budget. Guardrails trim and restore the
        discretionary layer (baseline minus the required floor). The floor is never cut. Amortized spending
        (ABW, the rule behind VPW and TPAW) goes further: it replaces the baseline entirely, re-computing each
        year&apos;s spending from the actual portfolio and remaining horizon. Applies in Results and Monte Carlo.{' '}
        <LearnLink {...LEARN.spendingBudget} />
      </p>
      <div className="form-grid">
        {/* Full-width: the option labels ("Fixed target (no guardrails)",
            "Risk-based guardrails (success band)") clip to an ellipsis in a
            one-column cell at the default workspace width (#423). */}
        <div className="field-span-full">
          <SelectField
            label="Spending policy"
            help="Fixed target funds the whole budget every year (today's behavior). Withdrawal-rate guardrails ration the discretionary layer path by path based on how the current withdrawal rate compares to the starting rate. Risk-based guardrails trigger on dollar portfolio thresholds solved from your target probability-of-success band, cut only when the plan's odds actually leave the band, not on the withdrawal rate alone. Amortized spending (ABW) ignores the baseline and phases and spends each year's amortized payment: the actual start-of-year portfolio spread over the remaining horizon at an expected real return, so spending self-corrects after good or bad markets and the portfolio is designed to be spent down by the horizon."
            learn={LEARN.dynamicSpendingGuardrails}
            value={e.spendingPolicy?.mode ?? 'fixedTarget'}
            options={[
              { value: 'fixedTarget', label: 'Fixed target (no guardrails)' },
              { value: 'withdrawalRateGuardrails', label: 'Withdrawal-rate guardrails' },
              { value: 'riskBasedGuardrails', label: 'Risk-based guardrails (success band)' },
              { value: 'abw', label: 'Amortized spending (ABW / VPW)' },
            ]}
            onCommit={(mode) =>
              update((d) => {
                if (mode === 'fixedTarget') delete d.expenses.spendingPolicy
                else d.expenses.spendingPolicy = { ...d.expenses.spendingPolicy, mode }
              })
            }
          />
        </div>
        <WithdrawalRateGuardrailFields hasEarlyPullFlexibleGoals={hasEarlyPullFlexibleGoals} />
        <RiskBasedGuardrailFields hasEarlyPullFlexibleGoals={hasEarlyPullFlexibleGoals} onBandEdited={thresholds.clear} />
        <AbwPolicyFields />
      </div>
      <AbwPolicyCallout />
      <RiskBasedThresholdsCallout thresholds={thresholds} />
    </>
  )
}
