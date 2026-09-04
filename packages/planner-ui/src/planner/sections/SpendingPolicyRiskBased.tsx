/**
 * Risk-based guardrails: the fields the Spending card shows when that policy
 * mode is selected, and the solved-threshold callout below the grid.
 * Extracted from `SpendingSection.tsx` unchanged (one of the four mode
 * branches the card dispatches to).
 *
 * The two sit in different parents (the fields inside the card's
 * `form-grid`, the callout after it), so the solve they share lives in
 * `useThresholdSolve.ts` and the card wires both halves to it.
 */

import { startingInvestableOf } from '@retiregolden/engine/montecarlo/riskBasedGuardrails'

import { usePlan } from '../planContextCore'
import { CheckboxField, PercentField } from '../fields'
import { fmtMoney } from '../format'
import { LEARN } from '../learnLinks'
import type { ThresholdSolve } from './useThresholdSolve'

export function RiskBasedGuardrailFields({
  hasEarlyPullFlexibleGoals,
  onBandEdited,
}: {
  hasEarlyPullFlexibleGoals: boolean
  onBandEdited: () => void
}) {
  const { plan, update } = usePlan()
  const e = plan.expenses
  /**
   * The success band read as a pair, which neither edge's own path can do.
   *
   * The engine accepts either percent on its own (1-99 and 1-100), and refuses
   * the pair: `solveRiskBasedGuardrails` throws "the cut edge must be below the
   * raise edge" before it probes anything. Both edges therefore keep what was
   * typed and say what the solve will do with it, which is the `.field-warning`
   * contract: nothing refused, nothing rewritten, nothing marked invalid.
   * A one-point gap is what the solve needs, so equal edges warn too.
   */
  const bandLower = e.spendingPolicy?.targetSuccessLowerPct ?? 70
  const bandUpper = e.spendingPolicy?.targetSuccessUpperPct ?? 95
  const bandWarning =
    e.spendingPolicy?.mode === 'riskBasedGuardrails' && bandLower >= bandUpper
      ? 'The cut edge is not below the raise edge, so the balance thresholds cannot be solved. Kept as entered.'
      : null
  if (e.spendingPolicy?.mode !== 'riskBasedGuardrails') return null
  return (
    <>
      <PercentField
        label="Cut when success falls below"
        help="The lower edge of your target probability-of-success band. The solver finds the portfolio balance where the plan's Monte Carlo success probability would drop to this level; spending cuts trigger below that dollar threshold."
        hint="Lower edge of the target success band."
        learn={LEARN.riskBasedGuardrails}
        step={5}
        path="expenses.spendingPolicy.targetSuccessLowerPct"
        warning={bandWarning}
        value={e.spendingPolicy.targetSuccessLowerPct ?? 70}
        onCommit={(v) => {
          // The solved thresholds (and any displayed suggestions) belonged to the old band.
          onBandEdited()
          update((d) => {
            const policy = d.expenses.spendingPolicy!
            // The edge is stored as typed. An inverted band is one the
            // engine accepts and the threshold solve refuses, so it is
            // said in a warning under both edges rather than corrected
            // here into a band nobody chose (D5).
            policy.targetSuccessLowerPct = v ?? 70
            delete policy.lowerBalanceThresholdPct
            delete policy.upperBalanceThresholdPct
          })
        }}
      />
      <PercentField
        label="Raise when success rises above"
        help="The upper edge of your target probability-of-success band. Above the balance where success clears this level, discretionary spending can be restored or raised."
        hint="Upper edge of the target success band."
        learn={LEARN.riskBasedGuardrails}
        step={5}
        path="expenses.spendingPolicy.targetSuccessUpperPct"
        warning={bandWarning}
        value={e.spendingPolicy.targetSuccessUpperPct ?? 95}
        onCommit={(v) => {
          onBandEdited()
          update((d) => {
            const policy = d.expenses.spendingPolicy!
            policy.targetSuccessUpperPct = v ?? 95
            delete policy.lowerBalanceThresholdPct
            delete policy.upperBalanceThresholdPct
          })
        }}
      />
      <PercentField
        label="Adjustment size"
        help="How much of the full discretionary layer each cut or raise moves. A common setting is 10%."
        hint="Cut/raise step, as a % of the discretionary layer."
        learn={LEARN.riskBasedGuardrails}
        step={5}
        path="expenses.spendingPolicy.adjustmentPct"
        value={e.spendingPolicy.adjustmentPct ?? 10}
        onCommit={(v) => update((d) => void (d.expenses.spendingPolicy!.adjustmentPct = v ?? 10))}
      />
      <CheckboxField
        label="Allow upside raises"
        help="When enabled, strong paths can restore target spending and then fund ideal/excess annual layers or pull flexible goals earlier within their window. The required floor still stays protected in down markets."
        learn={LEARN.riskBasedGuardrails}
        value={e.spendingPolicy.allowRaisesAboveTarget ?? ((e.idealAnnual ?? 0) + (e.excessAnnual ?? 0) > 0 || hasEarlyPullFlexibleGoals)}
        onCommit={(v) => update((d) => void (d.expenses.spendingPolicy!.allowRaisesAboveTarget = v))}
      />
    </>
  )
}

export function RiskBasedThresholdsCallout({ thresholds }: { thresholds: ThresholdSolve }) {
  const { plan } = usePlan()
  const e = plan.expenses
  const { solving: solvingThresholds, error: thresholdSolveError, solution: thresholdSolution, solve: solveThresholds } = thresholds
  if (e.spendingPolicy?.mode !== 'riskBasedGuardrails') return null
  return (
    <div className="callout callout--info">
      {e.spendingPolicy.lowerBalanceThresholdPct !== undefined ||
      e.spendingPolicy.upperBalanceThresholdPct !== undefined ? (
        <p className="card-hint">
          Solved dollar guardrails for the {e.spendingPolicy.targetSuccessLowerPct ?? 70}–
          {e.spendingPolicy.targetSuccessUpperPct ?? 95}% success band:{' '}
          {e.spendingPolicy.lowerBalanceThresholdPct !== undefined ? (
            <>
              cut spending if the portfolio falls below{' '}
              <strong>{fmtMoney((e.spendingPolicy.lowerBalanceThresholdPct / 100) * startingInvestableOf(plan))}</strong>
            </>
          ) : (
            <>no cut threshold was solved for this band</>
          )}
          {'; '}
          {e.spendingPolicy.upperBalanceThresholdPct !== undefined ? (
            <>
              raise if it rises above{' '}
              <strong>{fmtMoney((e.spendingPolicy.upperBalanceThresholdPct / 100) * startingInvestableOf(plan))}</strong>
            </>
          ) : (
            <>no raise threshold was solved for this band</>
          )}
          . Thresholds are in today's dollars, solved under the standard smooth-randomness market model
          (12% return volatility, 60/40 weighting) with your plan's inflation, custom Monte Carlo page
          model settings are not reflected here. Re-solve after meaningful plan changes.
        </p>
      ) : (
        <p className="card-hint">
          No dollar thresholds solved yet. Until they are computed, this policy holds spending steady (it
          behaves like fixed target). Solving runs a bounded Monte Carlo search in the background under the
          standard smooth-randomness market model.
        </p>
      )}
      {thresholdSolution?.lowerOutcome === 'never-reaches-band' ? (
        <p className="card-hint">
          <strong>Heads up:</strong> the plan's success probability stays below your{' '}
          {thresholdSolution.lowerBandPct}% cut edge even with several times the current portfolio, so no
          cut threshold exists. The plan is underfunded for this band, not safe. Consider lower target
          spending or a lower band.
        </p>
      ) : null}
      {thresholdSolution?.lowerOutcome === 'always-above-band' ? (
        <p className="card-hint">
          The plan stays above the {thresholdSolution.lowerBandPct}% cut edge even at very low balances
          (guaranteed income carries it), so no cut trigger is needed.
        </p>
      ) : null}
      {thresholdSolution?.suggestedCut || thresholdSolution?.suggestedRaise ? (
        <p className="card-hint">
          {thresholdSolution.suggestedCut ? (
            <>
              At the cut threshold, trimming about{' '}
              <strong>{fmtMoney(thresholdSolution.suggestedCut.monthlyDollars)}/mo</strong> restores the middle of
              the band.{' '}
            </>
          ) : null}
          {thresholdSolution.suggestedRaise ? (
            <>
              At the raise threshold, roughly{' '}
              <strong>{fmtMoney(thresholdSolution.suggestedRaise.monthlyDollars)}/mo</strong> of extra spending
              still keeps the plan above the middle of the band.
            </>
          ) : null}
        </p>
      ) : null}
      <button
        type="button"
        className="btn btn-secondary btn-small"
        disabled={solvingThresholds}
        onClick={solveThresholds}
      >
        {solvingThresholds
          ? 'Solving thresholds…'
          : e.spendingPolicy.lowerBalanceThresholdPct !== undefined ||
              e.spendingPolicy.upperBalanceThresholdPct !== undefined
            ? 'Re-solve dollar thresholds'
            : 'Solve dollar thresholds'}
      </button>
      {thresholdSolveError ? <p className="card-hint error-text">{thresholdSolveError}</p> : null}
    </div>
  )
}
