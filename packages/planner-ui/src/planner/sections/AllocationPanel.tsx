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
  const bondsPct = params.bonds.returnPct
  const cashPct = params.cash.returnPct
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
        Describe roughly how this account is invested; we blend your long-run nominal return assumptions (stocks {stocksPct}%,
        bonds {bondsPct}%, cash {cashPct}%; illustrative, before fees, not a forecast). More stocks
        means higher expected growth and bigger swings; Monte Carlo is where that risk shows up.
      </p>
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
      {/* Each weight is committed whatever the row adds up to, so a mismatch is
          the `.field-warning` case rather than `.field-error`'s danger token:
          the warn treatment, `role="status"`, and nothing marked invalid. */}
      <p className={sums100 ? 'muted small' : 'field-warning'} role="status">
        Total {sum.toFixed(0)}%{sums100 ? '' : ' (weights must sum to 100%)'}
      </p>
    </div>
  )
}

/**
 * Allocation policy editor: mode (static / glidepaths), rebalancing, and the
 * weight grid(s) for the selected mode. All money math (blends, per-year
 * targets) comes from engine/allocation.
 */
export function AllocationPanel({ account, plan, onCommit }: { account: AllocatableAccount; plan: Plan; onCommit: (a: AssetAllocationPolicy) => void }) {
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
            <NumberField label="From year" value={policy.startYear} min={1900} max={2200} onCommit={(v) => onCommit({ ...policy, startYear: Math.round(v ?? year) })} />
            <NumberField label="To year" value={policy.endYear} min={1900} max={2200} onCommit={(v) => onCommit({ ...policy, endYear: Math.round(v ?? year + 20) })} />
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
            return (
              <div key={i} className="nested-phase-row">
                <div className="form-grid">
                  <NumberField
                    label={policy.mode === 'staged' ? 'From year' : 'Target year'}
                    value={rowYear}
                    min={1900}
                    max={2200}
                    onCommit={(v) => {
                      const y = Math.round(v ?? rowYear)
                      setRows(rows.map((r, idx) => (idx === i ? ('fromYear' in r ? { ...r, fromYear: y } : { ...r, year: y }) : r)) as typeof rows)
                    }}
                  />
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

