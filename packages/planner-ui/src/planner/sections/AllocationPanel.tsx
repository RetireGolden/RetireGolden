/** Asset-allocation panel and return estimator for allocatable accounts. */

import { useState } from 'react'

import type { AllocationWeights, AssetAllocationPolicy, Plan } from '@retiregolden/engine/model/plan'
import { ASSET_CLASS_IDS } from '@retiregolden/engine/model/plan'
import type { AllocatableAccount } from './sectionHelpers'
import {
  blendedReturnPct,
  blendedTaxableYield,
  DEFAULT_ASSET_CLASS_PARAMS,
  resolveAssetClassParams,
  targetWeightsAt,
} from '@retiregolden/engine/allocation/assetClasses'
import { NumberField, PercentField, ReadonlyField, SelectField } from '../fields'
import { Modal } from '../Modal'
import { currentStartYear } from '../useProjection'

function riskLabel(stocksPct: number): string {
  if (stocksPct < 25) return 'Conservative: low volatility, lower growth'
  if (stocksPct < 50) return 'Balanced: moderate ups and downs'
  if (stocksPct < 75) return 'Growth: meaningful swings in bad years'
  return 'Aggressive: expect large drawdowns on the way'
}

/**
 * The estimator's three sliders as a weight vector in ASSET_CLASS_IDS order
 * (usStocks, intlStocks, bonds, cash), so the blend is priced by the engine
 * rather than restated here. The stocks slider is one equity share and rides
 * on US stocks; a plan that wants the domestic/international split priced
 * separately uses the asset-class panel below, which carries all four.
 */
const estimatorWeights = (stocks: number, bonds: number, cash: number): number[] => [
  stocks / 100,
  0,
  bonds / 100,
  cash / 100,
]

/**
 * Allocation → expected-return estimator.
 *
 * The rates are the plan's own resolved asset-class parameters, so a return
 * edited in Assumptions is honored here as well as in the panel below, and
 * the copy quotes the numbers it actually blends (never a literal).
 */
export function ReturnEstimatorModal({ plan, initialPct, onApply, onClose }: { plan: Plan; initialPct: number | null; onApply: (pct: number) => void; onClose: () => void }) {
  const params = resolveAssetClassParams(plan.assumptions.assetClassParams)
  const stocksPct = params.usStocks.returnPct
  const intlStocksPct = params.intlStocks.returnPct
  const bondsPct = params.bonds.returnPct
  const cashPct = params.cash.returnPct
  // The Stocks slider has only ever priced US stocks (estimatorWeights fixes
  // intl weight at 0) — that was true before this PR too, restated with a
  // hardcoded literal instead of the plan's own rate. What changed here: when
  // a household has actually set a different International-stocks rate in
  // Assumptions, the estimate now says so instead of letting "stocks" read as
  // the whole equity picture (#598 round 2).
  const intlDiffersFromUs = Math.abs(intlStocksPct - stocksPct) > 1e-9
  // Invert the all-stocks/all-cash line to place the opening slider on the
  // rate the account already carries. With the two rates equal there is no
  // line to invert, so the estimator opens on its usual 60 % default.
  const span = stocksPct - cashPct
  const guessStocks =
    initialPct === null || span === 0
      ? 60
      : Math.min(100, Math.max(0, Math.round(((initialPct - cashPct) / span) * 100 / 5) * 5))
  const [stocks, setStocks] = useState(guessStocks)
  const [bonds, setBonds] = useState(Math.min(100 - guessStocks, 30))
  const cash = Math.max(0, 100 - stocks - bonds)
  const blended = blendedReturnPct(estimatorWeights(stocks, bonds, cash), params)
  return (
    <Modal title="Estimate expected return" onClose={onClose}>
      <p className="card-hint">
        Describe roughly how this account is invested; we blend your long-run nominal return assumptions (US stocks{' '}
        {stocksPct}%, bonds {bondsPct}%, cash {cashPct}%; illustrative, before fees, not a forecast). More stocks
        means higher expected growth and bigger swings; Monte Carlo is where that risk shows up.
      </p>
      {intlDiffersFromUs ? (
        <p className="card-hint muted small">
          International stocks are assumed at {intlStocksPct}% and are not part of this estimate. Use the allocation
          panel below to price US and international stocks separately.
        </p>
      ) : null}
      <div className="alloc-row">
        <span>Stocks</span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={stocks}
          aria-label="Stocks percent"
          onChange={(e) => {
            const v = Number(e.target.value)
            setStocks(v)
            setBonds((b) => Math.min(b, 100 - v))
          }}
        />
        <span>{stocks}%</span>
      </div>
      <div className="alloc-row">
        <span>Bonds</span>
        <input
          type="range"
          min={0}
          max={100 - stocks}
          step={5}
          value={bonds}
          aria-label="Bonds percent"
          onChange={(e) => setBonds(Number(e.target.value))}
        />
        <span>{bonds}%</span>
      </div>
      <div className="alloc-row">
        <span>Cash</span>
        <span className="muted small">remainder</span>
        <span>{cash}%</span>
      </div>
      <div className="alloc-result">
        <strong>{blended.toFixed(1)}%</strong>
        <span className="muted small">{riskLabel(stocks)}</span>
      </div>
      <div className="add-row" style={{ marginTop: '1rem' }}>
        <button type="button" className="btn btn-primary btn-small" onClick={() => { onApply(Math.round(blended * 10) / 10); onClose() }}>
          Use {blended.toFixed(1)}%
        </button>
        <button type="button" className="btn btn-secondary btn-small" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Asset allocation (opt-in per account)
// ---------------------------------------------------------------------------

function WeightsGrid({ title, weights, onCommit }: { title?: string; weights: AllocationWeights; onCommit: (w: AllocationWeights) => void }) {
  const sum = ASSET_CLASS_IDS.reduce((s, id) => s + weights[id], 0)
  const sums100 = Math.abs(sum - 100) <= 0.5
  return (
    <div className="nested-form-section field-span-full">
      {title ? <h4>{title}</h4> : null}
      <div className="form-grid">
        {ASSET_CLASS_IDS.map((id) => (
          <PercentField
            key={id}
            label={DEFAULT_ASSET_CLASS_PARAMS[id].label}
            value={weights[id]}
            // Intentionally pathless, and not the only plan-editing control in
            // this package that is (goal `priority`, pension lump-sum
            // `electionYear`, and annuity `startAge` are pathless too, for
            // their own reasons). The weights DO have schema paths
            // (`accounts.N.allocation.weights.usStocks`, and the
            // same leaves under `.from`, `.to`, `.stages.M.weights`, and
            // `.targets.M.weights`), but this one grid renders all six of those
            // locations. `testSupport/wiredFieldPaths.ts` reads wired paths out
            // of the source and can only resolve a literal template at the call
            // site, so a path built from a prefix prop here would be invisible
            // to it — and a path neither the bounds-drift guard nor the engine
            // round-trip suite can see is worse than none (that file's own
            // warning). Wiring them means enumerating the four classes per
            // location, six times over; until then the range below is the
            // schema's own 0–100 (allocationWeightsSchema), copied, and the
            // sum refusal is stated by the summary line under this grid.
            min={0}
            max={100}
            step={5}
            // No clamp: the field's own 0–100 range flags an entry outside it
            // while typing and hands back the plan's value on blur (D5), so a
            // weight only reaches here once it is already inside the range.
            onCommit={(v) => onCommit({ ...weights, [id]: v ?? 0 })}
          />
        ))}
      </div>
      {/* allocationWeightsSchema.refine (engine/model/plan.ts) rejects the plan
          at exactly this tolerance (±0.5), so a mismatch here is never a value
          the engine holds — PlanContext.update keeps `saveState: 'invalid'`
          and drops the edit rather than autosaving it. That is `.field-error`'s
          contract (a refused value), not `.field-warning`'s (an accepted one
          that is probably a mistake), so a mismatch reads in the danger token
          with an assertive role. No single input here carries the failing
          path (the four weights are pathless — see the note on the first
          field above), so the summary line itself is the only place to say
          so. */}
      <p className={sums100 ? 'muted small' : 'field-error'} role={sums100 ? 'status' : 'alert'}>
        Total {sum.toFixed(0)}%{sums100 ? '' : ' (weights must sum to 100% — not saved until they do)'}
      </p>
    </div>
  )
}

/**
 * Allocation policy editor: mode (static / glidepaths), rebalancing, and the
 * weight grid(s) for the selected mode. All money math (blends, per-year
 * targets) comes from engine/allocation.
 */
export function AllocationPanel({
  account,
  index,
  plan,
  onCommit,
}: {
  account: AllocatableAccount
  /** Position of the account in `plan.accounts`, so the year fields carry their schema paths. */
  index: number
  plan: Plan
  onCommit: (a: AssetAllocationPolicy) => void
}) {
  const policy = account.allocation!
  const year = currentStartYear()
  const params = resolveAssetClassParams(plan.assumptions.assetClassParams)
  const weightsNow = targetWeightsAt(policy, year)
  const blendedNow = blendedReturnPct(weightsNow, params)
  const yieldNow = blendedTaxableYield(weightsNow, params)

  const currentWeights = (): AllocationWeights => {
    const w = targetWeightsAt(policy, year)
    return {
      usStocks: Math.round(w[0]! * 100),
      intlStocks: Math.round(w[1]! * 100),
      bonds: Math.round(w[2]! * 100),
      cash: Math.round(w[3]! * 100),
    }
  }
  const switchMode = (mode: AssetAllocationPolicy['mode']) => {
    if (mode === policy.mode) return
    const weights = currentWeights()
    const shared = { rebalancing: policy.rebalancing }
    if (mode === 'static') onCommit({ mode, ...shared, weights })
    else if (mode === 'linear') onCommit({ mode, ...shared, from: weights, to: weights, startYear: year, endYear: year + 20 })
    else if (mode === 'staged') onCommit({ mode, ...shared, stages: [{ fromYear: year, weights }] })
    else onCommit({ mode, ...shared, targets: [{ year, weights }] })
  }

  return (
    <div className="nested-form-section field-span-full" data-testid="allocation-panel">
      <div className="form-grid">
        <SelectField
          label="Allocation over time"
          help="Static holds one target mix. A linear glidepath slides from a starting mix to an ending mix between two years. Staged jumps to a new mix in given years; custom targets interpolate between the mixes you set."
          value={policy.mode}
          options={[
            { value: 'static', label: 'Static target mix' },
            { value: 'linear', label: 'Linear glidepath (from → to)' },
            { value: 'staged', label: 'Staged (step changes)' },
            { value: 'custom', label: 'Custom year targets' },
          ]}
          onCommit={switchMode}
        />
        <SelectField
          label="Rebalancing"
          help="Annual rebalancing trades back to the target mix each January. In a brokerage account those sales realize capital gains through your cost basis; retirement-account rebalancing is tax-free. Drift lets winners run. The mix (and risk) then wanders from the target."
          value={policy.rebalancing}
          options={[
            { value: 'annual', label: 'Rebalance annually to target' },
            { value: 'none', label: 'No rebalancing (drift)' },
          ]}
          onCommit={(v) => onCommit({ ...policy, rebalancing: v })}
        />
      </div>
      {policy.mode === 'static' ? (
        <WeightsGrid weights={policy.weights} onCommit={(weights) => onCommit({ ...policy, weights })} />
      ) : null}
      {policy.mode === 'linear' ? (
        <>
          <div className="form-grid">
            <NumberField label="From year" path={`accounts.${index}.allocation.startYear`} value={policy.startYear} onCommit={(v) => onCommit({ ...policy, startYear: Math.round(v ?? year) })} />
            <NumberField label="To year" path={`accounts.${index}.allocation.endYear`} value={policy.endYear} onCommit={(v) => onCommit({ ...policy, endYear: Math.round(v ?? year + 20) })} />
          </div>
          <WeightsGrid title="Starting mix" weights={policy.from} onCommit={(from) => onCommit({ ...policy, from })} />
          <WeightsGrid title="Ending mix" weights={policy.to} onCommit={(to) => onCommit({ ...policy, to })} />
        </>
      ) : null}
      {policy.mode === 'staged' || policy.mode === 'custom' ? (
        <>
          {(policy.mode === 'staged' ? policy.stages : policy.targets).map((row, i) => {
            const rows = policy.mode === 'staged' ? policy.stages : policy.targets
            const setRows = (next: typeof rows) =>
              policy.mode === 'staged'
                ? onCommit({ ...policy, stages: next as { fromYear: number; weights: AllocationWeights }[] })
                : onCommit({ ...policy, targets: next as { year: number; weights: AllocationWeights }[] })
            const rowYear = 'fromYear' in row ? row.fromYear : row.year
            const setRowYear = (v: number | null) => {
              const y = Math.round(v ?? rowYear)
              setRows(rows.map((r, idx) => (idx === i ? ('fromYear' in r ? { ...r, fromYear: y } : { ...r, year: y }) : r)) as typeof rows)
            }
            return (
              <div key={i} className="nested-phase-row">
                {/* One field per mode rather than one field with a computed
                    path: `testSupport/wiredFieldPaths.ts` reads wired paths out
                    of the source and resolves a literal template only, so a
                    path chosen at runtime would be invisible to the bounds
                    drift guard and the engine round-trip suite. */}
                <div className="form-grid">
                  {policy.mode === 'staged' ? (
                    <NumberField
                      label="From year"
                      path={`accounts.${index}.allocation.stages.${i}.fromYear`}
                      value={rowYear}
                      onCommit={setRowYear}
                    />
                  ) : (
                    <NumberField
                      label="Target year"
                      path={`accounts.${index}.allocation.targets.${i}.year`}
                      value={rowYear}
                      onCommit={setRowYear}
                    />
                  )}
                </div>
                <WeightsGrid
                  weights={row.weights}
                  onCommit={(weights) => setRows(rows.map((r, idx) => (idx === i ? { ...r, weights } : r)) as typeof rows)}
                />
                {rows.length > 1 ? (
                  <button type="button" className="btn btn-secondary btn-small" onClick={() => setRows(rows.filter((_, idx) => idx !== i) as typeof rows)}>
                    Remove
                  </button>
                ) : null}
              </div>
            )
          })}
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={() => {
              const weights = currentWeights()
              if (policy.mode === 'staged') {
                const lastYear = policy.stages[policy.stages.length - 1]?.fromYear ?? year
                onCommit({ ...policy, stages: [...policy.stages, { fromYear: lastYear + 5, weights }] })
              } else {
                const lastYear = policy.targets[policy.targets.length - 1]?.year ?? year
                onCommit({ ...policy, targets: [...policy.targets, { year: lastYear + 5, weights }] })
              }
            }}
          >
            + Add {policy.mode === 'staged' ? 'stage' : 'target'}
          </button>
        </>
      ) : null}
      <ReadonlyField
        label="This year's blend"
        help="Expected nominal return of this account's target mix this year, blended from the asset-class assumptions. For a brokerage account, the mix also sets the taxable interest/dividend yield used for annual tax drag."
        value={
          account.type === 'taxable'
            ? `${blendedNow.toFixed(1)}% return · ${yieldNow.interestYieldPct.toFixed(1)}% interest + ${yieldNow.dividendYieldPct.toFixed(1)}% dividends`
            : `${blendedNow.toFixed(1)}% return`
        }
      />
    </div>
  )
}

