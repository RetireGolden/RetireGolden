/**
 * Amortized spending (ABW / VPW): the fields the Spending card shows when that
 * policy mode is selected, and the explanatory callout below the grid.
 * Extracted from `SpendingSection.tsx` (one of the four mode branches the card
 * dispatches to); the JSX and behavior are unchanged except that its five
 * numeric controls gained `path` props and dropped their hand-written
 * `min`/`max` in the same PR (#611), the schema-bound-fields pass applied
 * everywhere else in this section.
 */

import type { SpendingPolicy } from '@retiregolden/engine/model/plan'

import { usePlan } from '../planContextCore'
import { NumberField, PercentField, SelectField } from '../fields'
import { LEARN } from '../learnLinks'

export function AbwPolicyFields() {
  const { plan, update } = usePlan()
  const e = plan.expenses
  // Mutate the ABW parameter object, creating it on first edit.
  const setAbw = (mutate: (abw: NonNullable<SpendingPolicy['abw']>) => void) =>
    update((d) => {
      const policy = d.expenses.spendingPolicy
      if (!policy || policy.mode !== 'abw') return
      policy.abw ??= { returnSource: 'fixed' }
      mutate(policy.abw)
    })
  if (e.spendingPolicy?.mode !== 'abw') return null
  return (
    <>
      <SelectField
        label="Expected return source"
        help="Where the amortization's expected real return comes from. Fixed uses the rate you enter (the VPW preset's approach, its published global returns, 60/40 weighted, are about 3.8%/yr real). CAPE conditions on valuations: expected stock return = 100 ÷ CAPE (the cyclically-adjusted earnings yield), blended with the bond yield at your stock share, richer valuations mean lower planned spending. TIPS yield prices the whole portfolio at a real bond yield, the most conservative reading."
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
          path="expenses.spendingPolicy.abw.fixedRealReturnPct"
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
            path="expenses.spendingPolicy.abw.startingCape"
            value={e.spendingPolicy.abw?.startingCape ?? 25}
            onCommit={(v) => setAbw((abw) => void (abw.startingCape = v ?? 25))}
          />
          <PercentField
            label="Stock share"
            help="How much of the portfolio is priced at the CAPE earnings yield; the rest is priced at the real bond yield below."
            hint="Blends the CAPE yield with the bond yield."
            learn={LEARN.spendingBudget}
            step={5}
            path="expenses.spendingPolicy.abw.equitySharePct"
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
          path="expenses.spendingPolicy.abw.bondRealYieldPct"
          value={e.spendingPolicy.abw?.bondRealYieldPct ?? 2}
          onCommit={(v) => setAbw((abw) => void (abw.bondRealYieldPct = v ?? 2))}
        />
      ) : null}
      <SelectField
        label="Amortize to"
        help="The horizon the balance is spread over. Planning age uses the household's plan horizon. The survival percentiles amortize to the age you (for couples: either of you) have a 25% or 10% chance of reaching, the unadjusted SSA life table, with no health-questionnaire adjustment even if your planning age used one, a shorter, spendier horizon than a conservative planning age."
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
        path="expenses.spendingPolicy.abw.tiltPct"
        value={e.spendingPolicy.abw?.tiltPct ?? 0}
        onCommit={(v) => setAbw((abw) => void (abw.tiltPct = v ?? 0))}
      />
    </>
  )
}

export function AbwPolicyCallout() {
  const { plan, update } = usePlan()
  if (plan.expenses.spendingPolicy?.mode !== 'abw') return null
  return (
    <div className="callout callout--info">
      <p className="card-hint">
        Amortized spending replaces the baseline, retirement phases, and required/ideal/excess layers: each
        year&apos;s recurring lifestyle spending is the amortized payment from the actual start-of-year
        portfolio. Healthcare, debt payments, property costs, insurance premiums, and one-time goals stay
        separately modeled on top. Because the payment is recomputed every year, spending self-corrects after
        market surprises instead of failing. The trade-off is a variable budget.{' '}
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
  )
}
