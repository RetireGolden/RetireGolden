/** Spending section: baseline, phases, goals, debts, property. */

import { useEffect, useRef, useState } from 'react'

import type { GoalFlexibility, SpendingClassification, SpendingPolicy } from '../../engine/model/plan'
import { annualDeltaPhases, spendingShapePhases, type SpendingShapeId } from '../../engine/spending/shapePresets'
import { startingInvestableOf, type RiskBasedGuardrailSolution } from '../../engine/montecarlo/riskBasedGuardrails'
import { runRiskBasedGuardrailSolve } from '../../mc/pool'
import { usePlan } from '../planContextCore'
import { CheckboxField, MoneyField, NumberField, PercentField, SelectField, TextField } from '../fields'
import { fmtMoney } from '../format'
import { buildModel } from '../marketModelPicker'
import { currentStartYear, seedFromPlanId } from '../useProjection'
import { LearnAboutScreen } from '../../learn/LearnAboutScreen'
import { LearnLink } from '../../learn/LearnLink'
import { LEARN } from '../learnLinks'
import { Issues } from './shared'
import { newId } from './sectionHelpers'

// Named spending shapes compile to ordinary `expenses.phases` rows (visible
// and editable afterwards) — never a parallel model. Calibrations and sources
// live with the compiler in engine/spending/shapePresets.ts.
type SpendingProfileId = SpendingShapeId

/** Solver budget for the on-demand threshold solve (worker; ~40 probes). */
const THRESHOLD_SOLVE_PATH_COUNT = 200

export function SpendingSection() {
  const { plan, update } = usePlan()
  const e = plan.expenses
  const [solvingThresholds, setSolvingThresholds] = useState(false)
  const [thresholdSolveError, setThresholdSolveError] = useState<string | null>(null)
  const [thresholdSolution, setThresholdSolution] = useState<RiskBasedGuardrailSolution | null>(null)
  // Latest committed band, readable from async solve callbacks: a solve result
  // computed against an older band (edited while the worker was busy) is
  // discarded instead of persisted.
  const committedBandRef = useRef({ mode: e.spendingPolicy?.mode, lower: 70, upper: 95 })
  useEffect(() => {
    committedBandRef.current = {
      mode: e.spendingPolicy?.mode,
      lower: e.spendingPolicy?.targetSuccessLowerPct ?? 70,
      upper: e.spendingPolicy?.targetSuccessUpperPct ?? 95,
    }
  })
  const solveThresholds = () => {
    setSolvingThresholds(true)
    setThresholdSolveError(null)
    const solvedBand = { ...committedBandRef.current }
    void runRiskBasedGuardrailSolve(plan, {
      startYear: currentStartYear(),
      pathCount: THRESHOLD_SOLVE_PATH_COUNT,
      seed: seedFromPlanId(plan.id),
      model: buildModel('lognormal', plan.assumptions.inflationPct, 12, 60, plan),
    })
      .then((solution) => {
        const current = committedBandRef.current
        if (current.mode !== 'riskBasedGuardrails' || current.lower !== solvedBand.lower || current.upper !== solvedBand.upper) {
          return // the band (or mode) changed mid-solve; the result no longer applies
        }
        setThresholdSolution(solution)
        update((d) => {
          const policy = d.expenses.spendingPolicy
          if (!policy || policy.mode !== 'riskBasedGuardrails') return
          if (solution.lower) policy.lowerBalanceThresholdPct = Math.round(solution.lower.balanceFrac * 10_000) / 100
          else delete policy.lowerBalanceThresholdPct
          if (solution.upper) policy.upperBalanceThresholdPct = Math.round(solution.upper.balanceFrac * 10_000) / 100
          else delete policy.upperBalanceThresholdPct
        })
      })
      .catch((err: unknown) => setThresholdSolveError(err instanceof Error ? err.message : String(err)))
      .finally(() => setSolvingThresholds(false))
  }
  const hasEarlyPullFlexibleGoals = e.oneTimeGoals.some((g) => {
    const flexibility = g.flexibility ?? 'fixed'
    const earliestYear = Math.min(g.earliestYear ?? g.year, g.year)
    return flexibility !== 'fixed' && earliestYear < g.year
  })
  const applyProfile = (profile: SpendingProfileId) =>
    update((d) => {
      d.expenses.phases = spendingShapePhases(profile, plan.household.people[0]?.retirementAge ?? 65)
    })
  const [customDeltaPct, setCustomDeltaPct] = useState(-1.5)
  const applyCustomDelta = () =>
    update((d) => {
      d.expenses.phases = annualDeltaPhases(customDeltaPct, plan.household.people[0]?.retirementAge ?? 65)
    })
  // Mutate the ABW parameter object, creating it on first edit.
  const setAbw = (mutate: (abw: NonNullable<SpendingPolicy['abw']>) => void) =>
    update((d) => {
      const policy = d.expenses.spendingPolicy
      if (!policy || policy.mode !== 'abw') return
      policy.abw ??= { returnSource: 'fixed' }
      mutate(policy.abw)
    })
  return (
    <section>
      <div className="card">
        <h2>Spending</h2>
        <p className="card-hint">
          Today's dollars; the engine inflates everything. Healthcare is separate: enter full (unsubsidized) premiums pre-65
          and optionally apply the modeled ACA premium credit; Medicare + IRMAA from 65. <LearnLink {...LEARN.retirementHealthcareCosts} />
        </p>
        <div className="form-grid">
          <MoneyField
            label="Baseline annual spending"
            help="Everyday living costs in today's dollars: food, utilities, transportation, clothing, entertainment, routine travel, auto insurance, and out-of-pocket medical (copays, deductibles, dental, vision) — the costs with no separate input. Leave OUT anything modeled elsewhere: mortgage/loan payments (debt accounts); property tax & homeowner's insurance (enter those on the home/property account, where they correctly continue after the mortgage is paid off); health-insurance premiums (Healthcare below); and long-term-care or life-insurance premiums (Insurance). The Results page breaks all of these out in a Spending-by-category chart."
            learn={LEARN.spendingBudget}
            hint="Living costs incl. auto insurance & out-of-pocket medical; exclude mortgage, property tax, premiums."
            value={e.baseAnnual}
            onCommit={(v) =>
              update((d) => {
                d.expenses.baseAnnual = v ?? 0
                if (d.expenses.requiredAnnual !== undefined) {
                  d.expenses.requiredAnnual = Math.min(d.expenses.requiredAnnual, d.expenses.baseAnnual)
                }
              })
            }
          />
          <MoneyField
            label="Required floor (today's $)"
            help="The must-fund slice of baseline spending — the least you could live on in a bad market, before any discretionary lifestyle. Only matters when Spending guardrails (below) are on: the guardrail rations the gap between baseline and this floor but never cuts below it. Leave 0 (or equal to baseline) to treat all spending as required, which is today's behavior."
            learn={LEARN.spendingBudget}
            hint="Guardrails never cut below this. 0 = all spending is required."
            value={e.requiredAnnual ?? 0}
            onCommit={(v) =>
              update((d) => {
                if (!v || v <= 0) delete d.expenses.requiredAnnual
                else d.expenses.requiredAnnual = Math.min(v, d.expenses.baseAnnual)
              })
            }
          />
          <MoneyField
            label="Ideal annual upside"
            help="Flexible annual spending above your target lifestyle: extra travel, upgrades, gifts, or other spending you would fund only when the plan is running ahead. Fixed target mode funds it every year; guardrails fund it only after target spending has been restored."
            learn={LEARN.spendingBudget}
            hint="Above baseline target; funded after required and target."
            value={e.idealAnnual ?? 0}
            onCommit={(v) =>
              update((d) => {
                if (!v || v <= 0) delete d.expenses.idealAnnual
                else d.expenses.idealAnnual = v
              })
            }
          />
          <MoneyField
            label="Excess annual upside"
            help="Opportunistic annual spending funded last in strong paths. Use this for lifestyle upside you are comfortable skipping before touching required or target spending."
            learn={LEARN.spendingBudget}
            hint="Funded after ideal; 0 = none."
            value={e.excessAnnual ?? 0}
            onCommit={(v) =>
              update((d) => {
                if (!v || v <= 0) delete d.expenses.excessAnnual
                else d.expenses.excessAnnual = v
              })
            }
          />
          {plan.household.people.length > 1 ? (
            <PercentField
              label="Survivor spending"
              help="Household spending in years when only one of you is alive, as a percent of the couple's spending. Studies of retired couples typically land between 60% and 80% — housing and utilities barely drop, while food, travel, and healthcare for the second person do. Scales baseline + phase spending only; one-time goals, healthcare premiums, debt payments, and property costs keep their own schedules."
              learn={LEARN.survivorSpending}
              hint="100% = no change in survivor years."
              step={5}
              min={0}
              max={100}
              value={e.survivorSpendingPct ?? 100}
              onCommit={(v) =>
                update((d) => {
                  if (v === null || v >= 100) delete d.expenses.survivorSpendingPct
                  else d.expenses.survivorSpendingPct = Math.max(0, v)
                })
              }
            />
          ) : null}
          <MoneyField
            label="Bequest target (today's $)"
            help="The after-tax estate you want the plan to still leave at the end, in today's dollars. Used as the estate floor by the sustainable-spending solver ('How much can I spend?') and by the estate-floor optimizer objective — it does not change the projection itself. Leave 0 for no target."
            learn={LEARN.sustainableSpending}
            hint="Estate floor for the spending solver and optimizer objectives; 0 = none."
            value={e.bequestTargetDollars ?? 0}
            onCommit={(v) =>
              update((d) => {
                if (!v || v <= 0) delete d.expenses.bequestTargetDollars
                else d.expenses.bequestTargetDollars = v
              })
            }
          />
        </div>

        <h3>Dynamic spending policy</h3>
        <p className="card-hint">
          Let spending flex with the market instead of holding a fixed budget. Guardrails trim and restore the
          discretionary layer (baseline minus the required floor) — the floor is never cut. Amortized spending
          (ABW, the rule behind VPW and TPAW) goes further: it replaces the baseline entirely, re-computing each
          year&apos;s spending from the actual portfolio and remaining horizon. Applies in Results and Monte Carlo.{' '}
          <LearnLink {...LEARN.spendingBudget} />
        </p>
        <div className="form-grid">
          <SelectField
            label="Spending policy"
            help="Fixed target funds the whole budget every year (today's behavior). Withdrawal-rate guardrails ration the discretionary layer path by path based on how the current withdrawal rate compares to the starting rate. Risk-based guardrails trigger on dollar portfolio thresholds solved from your target probability-of-success band — cut only when the plan's odds actually leave the band, not on the withdrawal rate alone. Amortized spending (ABW) ignores the baseline and phases and spends each year's amortized payment: the actual start-of-year portfolio spread over the remaining horizon at an expected real return, so spending self-corrects after good or bad markets and the portfolio is designed to be spent down by the horizon."
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
          {e.spendingPolicy?.mode === 'withdrawalRateGuardrails' ? (
            <>
              <PercentField
                label="Upper guardrail"
                help="Cut discretionary spending when the current withdrawal rate exceeds this percent of the starting rate. A common setting is 120%."
                hint="% of the starting withdrawal rate that triggers a cut."
                learn={LEARN.spendingBudget}
                step={5}
                min={100}
                max={200}
                value={e.spendingPolicy.upperGuardrailPct ?? 120}
                onCommit={(v) => update((d) => void (d.expenses.spendingPolicy!.upperGuardrailPct = v ?? 120))}
              />
              <PercentField
                label="Lower guardrail"
                help="Restore discretionary spending when the current withdrawal rate falls below this percent of the starting rate. A common setting is 80%."
                hint="% of the starting withdrawal rate that allows a raise."
                learn={LEARN.spendingBudget}
                step={5}
                min={0}
                max={100}
                value={e.spendingPolicy.lowerGuardrailPct ?? 80}
                onCommit={(v) => update((d) => void (d.expenses.spendingPolicy!.lowerGuardrailPct = v ?? 80))}
              />
              <PercentField
                label="Adjustment size"
                help="How much of the full discretionary layer each cut or raise moves. A common setting is 10%."
                hint="Cut/raise step, as a % of the discretionary layer."
                learn={LEARN.spendingBudget}
                step={5}
                min={0}
                max={100}
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
          ) : null}
          {e.spendingPolicy?.mode === 'riskBasedGuardrails' ? (
            <>
              <PercentField
                label="Cut when success falls below"
                help="The lower edge of your target probability-of-success band. The solver finds the portfolio balance where the plan's Monte Carlo success probability would drop to this level; spending cuts trigger below that dollar threshold."
                hint="Lower edge of the target success band."
                learn={LEARN.riskBasedGuardrails}
                step={5}
                min={1}
                max={99}
                value={e.spendingPolicy.targetSuccessLowerPct ?? 70}
                onCommit={(v) => {
                  // The solved thresholds (and any displayed suggestions) belonged to the old band.
                  setThresholdSolution(null)
                  update((d) => {
                    const policy = d.expenses.spendingPolicy!
                    // Keep the band ordered: the cut edge must stay below the raise edge.
                    policy.targetSuccessLowerPct = Math.min(v ?? 70, (policy.targetSuccessUpperPct ?? 95) - 1)
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
                min={1}
                max={100}
                value={e.spendingPolicy.targetSuccessUpperPct ?? 95}
                onCommit={(v) => {
                  setThresholdSolution(null)
                  update((d) => {
                    const policy = d.expenses.spendingPolicy!
                    policy.targetSuccessUpperPct = Math.max(v ?? 95, (policy.targetSuccessLowerPct ?? 70) + 1)
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
                min={0}
                max={100}
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
          ) : null}
          {e.spendingPolicy?.mode === 'abw' ? (
            <>
              <SelectField
                label="Expected return source"
                help="Where the amortization's expected real return comes from. Fixed uses the rate you enter (the VPW preset's approach — its published global returns, 60/40 weighted, are about 3.8%/yr real). CAPE conditions on valuations: expected stock return = 100 ÷ CAPE (the cyclically-adjusted earnings yield), blended with the bond yield at your stock share — richer valuations mean lower planned spending. TIPS yield prices the whole portfolio at a real bond yield — the most conservative reading."
                learn={LEARN.spendingBudget}
                value={e.spendingPolicy.abw?.returnSource ?? 'fixed'}
                options={[
                  { value: 'fixed', label: 'Fixed real return (VPW-style)' },
                  { value: 'cape', label: 'CAPE earnings yield (valuation-aware)' },
                  { value: 'tips', label: 'TIPS real yield (most conservative)' },
                ]}
                onCommit={(v) => setAbw((abw) => void (abw.returnSource = v))}
              />
              {(e.spendingPolicy.abw?.returnSource ?? 'fixed') === 'fixed' ? (
                <PercentField
                  label="Expected real return"
                  help="Expected portfolio return per year above inflation, used to amortize the balance over the remaining horizon. The Bogleheads VPW table's global internal rates of return (stocks 5.0%, bonds 1.9% real) weighted 60/40 give about 3.8%. Higher values front-load spending and risk deeper later cuts if markets disappoint."
                  hint="%/yr above inflation. VPW 60/40 ≈ 3.8%."
                  learn={LEARN.spendingBudget}
                  step={0.1}
                  min={-5}
                  max={12}
                  value={e.spendingPolicy.abw?.fixedRealReturnPct ?? 3.8}
                  onCommit={(v) => setAbw((abw) => void (abw.fixedRealReturnPct = v ?? 3.8))}
                />
              ) : null}
              {e.spendingPolicy.abw?.returnSource === 'cape' ? (
                <>
                  <NumberField
                    label="Starting CAPE"
                    help="The cyclically-adjusted price/earnings ratio used for the expected stock return (100 ÷ CAPE). Around 25 matches this app's CAPE-conditioned market model default; check a current published CAPE for today's value."
                    hint="Expected stock return = 100 ÷ CAPE."
                    learn={LEARN.spendingBudget}
                    step={1}
                    min={5}
                    max={60}
                    value={e.spendingPolicy.abw?.startingCape ?? 25}
                    onCommit={(v) => setAbw((abw) => void (abw.startingCape = v ?? 25))}
                  />
                  <PercentField
                    label="Stock share"
                    help="How much of the portfolio is priced at the CAPE earnings yield; the rest is priced at the real bond yield below."
                    hint="Blends the CAPE yield with the bond yield."
                    learn={LEARN.spendingBudget}
                    step={5}
                    min={0}
                    max={100}
                    value={e.spendingPolicy.abw?.equitySharePct ?? 60}
                    onCommit={(v) => setAbw((abw) => void (abw.equitySharePct = v ?? 60))}
                  />
                </>
              ) : null}
              {e.spendingPolicy.abw?.returnSource === 'cape' || e.spendingPolicy.abw?.returnSource === 'tips' ? (
                <PercentField
                  label="Real bond/TIPS yield"
                  help="The real (above-inflation) bond yield: the whole portfolio under the TIPS source, or the non-stock share under CAPE. Long TIPS real yields were near 2% in mid-2026; check the current curve."
                  hint="%/yr above inflation; ~2% in mid-2026."
                  learn={LEARN.spendingBudget}
                  step={0.1}
                  min={-2}
                  max={8}
                  value={e.spendingPolicy.abw?.bondRealYieldPct ?? 2}
                  onCommit={(v) => setAbw((abw) => void (abw.bondRealYieldPct = v ?? 2))}
                />
              ) : null}
              <SelectField
                label="Amortize to"
                help="The horizon the balance is spread over. Planning age uses the household's plan horizon. The survival percentiles amortize to the age you (for couples: either of you) have a 25% or 10% chance of reaching — the unadjusted SSA life table, with no health-questionnaire adjustment even if your planning age used one — a shorter, spendier horizon than a conservative planning age."
                learn={LEARN.longevity}
                value={e.spendingPolicy.abw?.horizon ?? 'planningAge'}
                options={[
                  { value: 'planningAge', label: 'Planning age (plan horizon)' },
                  { value: 'survival25', label: 'Age with 25% chance of reaching' },
                  { value: 'survival10', label: 'Age with 10% chance of reaching' },
                ]}
                onCommit={(v) => setAbw((abw) => void (abw.horizon = v))}
              />
              <PercentField
                label="Spending tilt"
                help="Planned real change in spending per year. Negative front-loads spending into early retirement (consistent with the observed decline in real retiree spending); positive defers it. 0 plans level real spending."
                hint="−1 to −1.5%/yr matches observed spending declines."
                learn={LEARN.spendingProfiles}
                step={0.5}
                min={-5}
                max={5}
                value={e.spendingPolicy.abw?.tiltPct ?? 0}
                onCommit={(v) => setAbw((abw) => void (abw.tiltPct = v ?? 0))}
              />
            </>
          ) : null}
        </div>
        {e.spendingPolicy?.mode === 'abw' ? (
          <div className="callout callout--info">
            <p className="card-hint">
              Amortized spending replaces the baseline, retirement phases, and required/ideal/excess layers: each
              year&apos;s recurring lifestyle spending is the amortized payment from the actual start-of-year
              portfolio. Healthcare, debt payments, property costs, insurance premiums, and one-time goals stay
              separately modeled on top. Because the payment is recomputed every year, spending self-corrects after
              market surprises instead of failing — the trade-off is a variable budget.{' '}
              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={() =>
                  update((d) => {
                    d.expenses.spendingPolicy = {
                      mode: 'abw',
                      abw: { returnSource: 'fixed', fixedRealReturnPct: 3.8, horizon: 'planningAge', tiltPct: 0 },
                    }
                  })
                }
              >
                Apply the VPW preset
              </button>
            </p>
          </div>
        ) : null}
        {e.spendingPolicy?.mode === 'riskBasedGuardrails' ? (
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
                (12% return volatility, 60/40 weighting) with your plan's inflation — custom Monte Carlo page
                model settings are not reflected here. Re-solve after meaningful plan changes.
              </p>
            ) : (
              <p className="card-hint">
                No dollar thresholds solved yet — until they are computed, this policy holds spending steady (it
                behaves like fixed target). Solving runs a bounded Monte Carlo search in the background under the
                standard smooth-randomness market model.
              </p>
            )}
            {thresholdSolution?.lowerOutcome === 'never-reaches-band' ? (
              <p className="card-hint">
                <strong>Heads up:</strong> the plan's success probability stays below your{' '}
                {thresholdSolution.lowerBandPct}% cut edge even with several times the current portfolio, so no
                cut threshold exists — the plan is underfunded for this band, not safe. Consider lower target
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
        ) : null}

        <h3>Retirement phases</h3>
        <p className="card-hint">
          Spending multipliers by the primary person's age (go-go / slow-go / no-go).{' '}
          <LearnLink {...LEARN.spendingProfiles} />
        </p>
        {e.phases.map((p, i) => (
          <div className="item-row" key={i}>
            <div className="item-row-head">
              <span className="item-row-title"><span className="type-chip">Phase</span>from age {p.fromAge}</span>
              <button type="button" className="btn-ghost btn-ghost-danger" onClick={() => update((d) => void d.expenses.phases.splice(i, 1))}>Remove</button>
            </div>
            <div className="form-grid">
              <NumberField
                label="From age"
                help="The first age when this phase applies, using the primary person's age as the clock."
                learn={LEARN.spendingProfiles}
                value={p.fromAge}
                min={40}
                max={110}
                onCommit={(v) => update((d) => void (d.expenses.phases[i]!.fromAge = Math.round(v ?? 65)))}
              />
              <NumberField
                label="Multiplier"
                help="Multiplies baseline spending from this age forward. For example, 0.90 means recurring lifestyle spending is 10% lower before inflation."
                hint="1.00 = no change."
                learn={LEARN.spendingProfiles}
                step={0.05}
                value={p.multiplier}
                min={0}
                max={3}
                onCommit={(v) => update((d) => void (d.expenses.phases[i]!.multiplier = v ?? 1))}
              />
            </div>
          </div>
        ))}
        <div className="add-row">
          <button type="button" className="btn btn-secondary btn-small" onClick={() => update((d) => void d.expenses.phases.push({ fromAge: 75, multiplier: 0.9 }))}>+ Phase</button>
        </div>
        <p className="field-hint" style={{ margin: '0.6rem 0 0.25rem' }}>
          Profiles write ordinary phase rows you can edit afterwards{e.phases.length > 0 ? ' (replacing the phases above)' : ''}:{' '}<LearnLink {...LEARN.spendingProfiles} />
        </p>
        <div className="add-row">
          <button type="button" className="btn btn-secondary btn-small" onClick={() => applyProfile('flat')}>
            Constant-real (no phases)
          </button>
          <button type="button" className="btn btn-secondary btn-small" onClick={() => applyProfile('smile')}>
            Retirement smile (−10% at 75, −20% at 85)
          </button>
          <button type="button" className="btn btn-secondary btn-small" onClick={() => applyProfile('smirk')}>
            Retirement smirk (−1%/yr real)
          </button>
          <button type="button" className="btn btn-secondary btn-small" onClick={() => applyProfile('frontLoaded')}>
            Front-loaded travel (+10% until 75)
          </button>
        </div>
        <p className="field-hint" style={{ margin: '0.6rem 0 0.25rem' }}>
          The smile is the shape of <em>average</em> retiree spending — a decline that late healthcare partly
          reverses (the preset approximates it as two downward steps); the smirk is the <em>median</em> — a steady
          real decline with no late rise, per Blanchett&apos;s spending research. Or pick your own annual real
          drift, compiled to 5-year phase steps:
        </p>
        <div className="add-row" style={{ alignItems: 'end' }}>
          <PercentField
            label="Custom real change per year"
            help="Your own steady real spending drift, applied from retirement and compiled into 5-year phase steps (the compounded multiplier at each step age, to age 100). Research on actual retirees clusters around −1% to −2%/yr; a positive value plans rising real spending."
            hint="Negative = declining real spending."
            learn={LEARN.spendingProfiles}
            step={0.5}
            min={-5}
            max={5}
            value={customDeltaPct}
            onCommit={(v) => setCustomDeltaPct(v ?? -1.5)}
          />
          <button type="button" className="btn btn-secondary btn-small" onClick={applyCustomDelta}>
            Apply custom shape
          </button>
        </div>

        <h3>One-time goals</h3>
        <p className="card-hint">
          Big, named purchases or gifts that should happen once instead of becoming part of everyday spending.{' '}
          <LearnLink {...LEARN.spendingBudget} />
        </p>
        <div className="add-row">
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={() =>
              update((d) => {
                const targetYear = new Date().getFullYear() + 3
                d.expenses.oneTimeGoals.push({
                  id: newId(),
                  label: 'Car replacement',
                  year: targetYear,
                  amount: 35_000,
                  classification: 'target',
                  flexibility: 'movable',
                  earliestYear: targetYear - 2,
                  latestYear: targetYear,
                })
              })
            }
          >
            Car replacement
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={() =>
              update((d) => {
                const targetYear = new Date().getFullYear() + 2
                d.expenses.oneTimeGoals.push({
                  id: newId(),
                  label: 'Home improvement',
                  year: targetYear,
                  amount: 50_000,
                  classification: 'ideal',
                  flexibility: 'movable',
                  earliestYear: targetYear,
                  latestYear: targetYear + 2,
                  allowPartialFunding: true,
                  minFundingPct: 50,
                })
              })
            }
          >
            Home improvement
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={() =>
              update((d) => {
                const targetYear = new Date().getFullYear() + 1
                d.expenses.oneTimeGoals.push({
                  id: newId(),
                  label: 'Big trip',
                  year: targetYear,
                  amount: 12_000,
                  classification: 'excess',
                  flexibility: 'skippable',
                  earliestYear: targetYear,
                  latestYear: targetYear + 1,
                })
              })
            }
          >
            Big trip
          </button>
        </div>
        {e.oneTimeGoals.map((g, i) => (
          <div className="item-row" key={g.id}>
            <div className="item-row-head">
              <span className="item-row-title"><span className="type-chip">Goal</span>{g.label}</span>
              <button type="button" className="btn-ghost btn-ghost-danger" onClick={() => update((d) => void d.expenses.oneTimeGoals.splice(i, 1))}>Remove</button>
            </div>
            <div className="form-grid">
              <TextField
                label="Label"
                help="Name the goal so it is recognizable in Results, such as travel, car replacement, wedding gift, or home project."
                learn={LEARN.spendingBudget}
                value={g.label}
                onCommit={(v) => update((d) => void (d.expenses.oneTimeGoals[i]!.label = v || 'Goal'))}
              />
              <NumberField
                label="Year"
                help="The calendar year the goal is funded. The amount is inflated from today's dollars to that year."
                learn={LEARN.spendingBudget}
                value={g.year}
                min={1900}
                max={2200}
                onCommit={(v) =>
                  update((d) => {
                    const goal = d.expenses.oneTimeGoals[i]!
                    goal.year = Math.round(v ?? g.year)
                    if (goal.earliestYear !== undefined) goal.earliestYear = Math.min(goal.earliestYear, goal.year)
                    if (goal.latestYear !== undefined) goal.latestYear = Math.max(goal.latestYear, goal.year)
                  })
                }
              />
              <MoneyField
                label="Amount (today's $)"
                help="The one-time cost in today's dollars. Keep recurring lifestyle costs in baseline spending instead."
                learn={LEARN.spendingBudget}
                value={g.amount}
                onCommit={(v) => update((d) => void (d.expenses.oneTimeGoals[i]!.amount = v ?? 0))}
              />
              <SelectField<SpendingClassification>
                label="Layer"
                help="Required goals are part of the must-fund floor. Target goals are intended lifestyle. Ideal and excess goals are flexible upside funded after target spending."
                learn={LEARN.spendingBudget}
                value={g.classification ?? 'target'}
                options={[
                  { value: 'required', label: 'Required' },
                  { value: 'target', label: 'Target' },
                  { value: 'ideal', label: 'Ideal' },
                  { value: 'excess', label: 'Excess' },
                ]}
                onCommit={(classification) =>
                  update((d) => {
                    const goal = d.expenses.oneTimeGoals[i]!
                    if (classification === 'target') delete goal.classification
                    else goal.classification = classification
                  })
                }
              />
              <SelectField
                label="Flexibility"
                help="Fixed happens in its year no matter what. Movable funds in its year normally, but is delayed up to the latest year while guardrails are cutting discretionary spending. Skippable is the same but dropped entirely if it is still unaffordable at the latest year. Only matters when Spending guardrails are on."
                learn={LEARN.spendingBudget}
                value={g.flexibility ?? 'fixed'}
                options={[
                  { value: 'fixed', label: 'Fixed (happens in its year)' },
                  { value: 'movable', label: 'Movable (delay under a cut)' },
                  { value: 'skippable', label: 'Skippable (drop if unaffordable)' },
                ]}
                onCommit={(flex: GoalFlexibility) =>
                  update((d) => {
                    const goal = d.expenses.oneTimeGoals[i]!
                    if (flex === 'fixed') {
                      delete goal.flexibility
                      delete goal.earliestYear
                      delete goal.latestYear
                      delete goal.priority
                      delete goal.minFundingPct
                      delete goal.allowPartialFunding
                    } else {
                      goal.flexibility = flex
                      goal.earliestYear ??= goal.year
                      goal.latestYear ??= goal.year
                    }
                  })
                }
              />
              {g.flexibility && g.flexibility !== 'fixed' ? (
                <>
                  <NumberField
                    label="Earliest year"
                    help="The earliest year a strong guardrail path may pull this goal forward. Leave equal to the target year to prevent acceleration."
                    learn={LEARN.spendingBudget}
                    value={g.earliestYear ?? g.year}
                    min={1900}
                    max={2200}
                    onCommit={(v) =>
                      update((d) => void (d.expenses.oneTimeGoals[i]!.earliestYear = Math.min(Math.round(v ?? g.year), g.year)))
                    }
                  />
                  <NumberField
                    label="Latest year"
                    help="The latest year this goal may be delayed to. If it cannot be funded by then, the unfunded amount is reported as a layer shortfall."
                    learn={LEARN.spendingBudget}
                    value={g.latestYear ?? g.year}
                    min={1900}
                    max={2200}
                    onCommit={(v) =>
                      update((d) => void (d.expenses.oneTimeGoals[i]!.latestYear = Math.max(Math.round(v ?? g.year), g.year)))
                    }
                  />
                  <NumberField
                    label="Priority"
                    help="Lower numbers fund first within the same spending layer. Required goals still outrank target, ideal, and excess goals."
                    learn={LEARN.spendingBudget}
                    value={g.priority ?? i}
                    min={0}
                    max={999}
                    onCommit={(v) => update((d) => void (d.expenses.oneTimeGoals[i]!.priority = Math.round(v ?? i)))}
                  />
                  <CheckboxField
                    label="Allow partial funding"
                    help="When enabled, a flexible goal can resolve with less than the full amount if the hard flexible-goal budget clears the minimum funding percent."
                    learn={LEARN.spendingBudget}
                    value={g.allowPartialFunding ?? false}
                    onCommit={(v) =>
                      update((d) => {
                        const goal = d.expenses.oneTimeGoals[i]!
                        if (!v) {
                          delete goal.allowPartialFunding
                          delete goal.minFundingPct
                        } else {
                          goal.allowPartialFunding = true
                          goal.minFundingPct ??= 50
                        }
                      })
                    }
                  />
                  {g.allowPartialFunding ? (
                    <PercentField
                      label="Minimum funding"
                      help="The smallest percent of the goal that must be available before RetireGolden records it as partially funded instead of deferred or skipped."
                      learn={LEARN.spendingBudget}
                      step={5}
                      min={0}
                      max={95}
                      value={g.minFundingPct ?? 50}
                      onCommit={(v) =>
                        update((d) => void (d.expenses.oneTimeGoals[i]!.minFundingPct = Math.min(95, Math.max(0, v ?? 50))))
                      }
                    />
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
        ))}
        <div className="add-row">
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={() => update((d) => void d.expenses.oneTimeGoals.push({ id: newId(), label: 'New goal', year: new Date().getFullYear() + 2, amount: 10_000 }))}
          >
            + Goal
          </button>
        </div>

        <h3>Healthcare</h3>
        <div className="form-grid">
          <MoneyField
            label="Pre-65 premium / person / month"
            help="Enter the full unsubsidized monthly premium before any ACA credit. As a rough 2026 check, KFF's national benchmark Silver premium for a 40-year-old is $625/month, but older retirees and local quotes can differ a lot."
            learn={LEARN.healthcareBefore65}
            hint="Full (unsubsidized) marketplace premium."
            value={e.healthcare.pre65MonthlyPremiumPerPerson}
            onCommit={(v) => update((d) => void (d.expenses.healthcare.pre65MonthlyPremiumPerPerson = v ?? 0))}
          />
          <MoneyField
            label="Medicare extras / person / month"
            help="Enter recurring post-65 coverage costs beyond standard Part B: Part D, Medigap, Medicare Advantage, dental, vision, or similar premiums. RetireGolden adds the 2026 Part B base premium ($202.90/month) and IRMAA separately."
            learn={LEARN.healthcareAfter65}
            hint="Part D, Medigap/Advantage; Part B + IRMAA added automatically."
            value={e.healthcare.medicareExtrasMonthlyPerPerson}
            onCommit={(v) => update((d) => void (d.expenses.healthcare.medicareExtrasMonthlyPerPerson = v ?? 0))}
          />
          <CheckboxField
            label="Apply ACA premium credit"
            help="Applies a simplified ACA premium tax credit before Medicare eligibility, based on household size and MAGI. Use only for Marketplace coverage that can receive the credit."
            learn={LEARN.acaCredit}
            hint="Models the 400% FPL cliff against your MAGI."
            value={e.healthcare.applyAcaCredit}
            onCommit={(v) => update((d) => void (d.expenses.healthcare.applyAcaCredit = v))}
          />
          {plan.household.filingStatus === 'marriedFilingJointly' && plan.household.people.length === 2 ? (
            <CheckboxField
              label="Model SSA-44 IRMAA relief in survivor years"
              help="Form SSA-44 lets a surviving spouse ask Social Security to base Medicare's income surcharge (IRMAA) on the current year's lower income instead of the usual two-year lookback. This models the effect of a granted redetermination in the two years after the first death; filing the form itself is up to you."
              learn={LEARN.ssa44}
              hint="Death of spouse is a qualifying life-changing event."
              value={e.healthcare.ssa44?.survivorYears ?? false}
              onCommit={(v) =>
                update((d) => {
                  const prior = d.expenses.healthcare.ssa44
                  d.expenses.healthcare.ssa44 = { survivorYears: v, retirementYears: prior?.retirementYears ?? false }
                })
              }
            />
          ) : null}
          <CheckboxField
            label="Model SSA-44 IRMAA relief in retirement years"
            help="Stopping work is also an SSA-44 qualifying event. This applies the same redetermination in the two years after each person's retirement year, when the lookback still reflects working income."
            learn={LEARN.ssa44}
            hint="Work stoppage is a qualifying life-changing event."
            value={e.healthcare.ssa44?.retirementYears ?? false}
            onCommit={(v) =>
              update((d) => {
                const prior = d.expenses.healthcare.ssa44
                d.expenses.healthcare.ssa44 = { survivorYears: prior?.survivorYears ?? false, retirementYears: v }
              })
            }
          />
        </div>
        <Issues />
      </div>
      <LearnAboutScreen route="/plan/:planId/spending" />
    </section>
  )
}

// ---------------------------------------------------------------------------
// Strategy
// ---------------------------------------------------------------------------

