/**
 * Relocation Compare (Explore rail): "where should I retire?" priced on the
 * user's actual plan. Picks up to MAX_RELOCATION_CANDIDATES candidate states
 * (each optionally with a move year, a local-rate knob, and a flat spending
 * delta), runs the real plan once per candidate in a Web Worker — shared
 * market paths for the success rate — and ranks the rows with a per-state
 * driver drill-down. Income tax only; the page names what's out of scope.
 */

import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import type { StateRetirementExclusion } from '@retiregolden/engine/params/state'
import {
  MAX_RELOCATION_CANDIDATES,
  relocationScenarioPatch,
  type RelocationCandidate,
  type RelocationCandidateRow,
  type RelocationComparison,
} from '@retiregolden/engine/projection/relocation'
import type { Plan } from '@retiregolden/engine/model/plan'
import { runRelocationCompare } from '../relocation/runner'
import { LearnAboutScreen } from '../learn/LearnAboutScreen'
import { LearnLink } from '../learn/LearnLink'
import { HelpTip, NumberField, PercentField, SelectField } from './fields'
import { fmtMoney, fmtPct } from './format'
import { LEARN } from './learnLinks'
import { buildModel } from './marketModelPicker'
import { usePlan } from './planContextCore'
import { currentStartYear, seedFromPlanId } from './useProjection'
import { US_STATES } from './usStates'

const RELOCATION_MC_PATHS = 500

type RankMetric = 'lifetimeTax' | 'estate' | 'success'

function makeScenarioId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? `scenario-${crypto.randomUUID()}`
    : `scenario-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function exclusionLabel(rule: StateRetirementExclusion): string {
  if (rule.kind === 'full') return rule.minAge !== undefined ? `fully excluded from age ${rule.minAge}` : 'fully excluded'
  if (rule.kind === 'capped') {
    const cap = fmtMoney(rule.capPerPerson ?? 0)
    return rule.minAge !== undefined ? `up to ${cap}/person from age ${rule.minAge}` : `up to ${cap}/person`
  }
  return 'taxed like other income'
}

function DriverRow({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <tr>
      <td>{label}</td>
      <td style={{ textAlign: 'right' }}>{value}</td>
      <td className="muted">{note ?? ''}</td>
    </tr>
  )
}

function DriverDetails({ row }: { row: RelocationCandidateRow }) {
  const d = row.drivers
  if (!d) return null
  if (!d.facts) {
    return (
      <p className="field-hint">
        {row.modeled
          ? 'Driver attribution is unavailable for this row.'
          : 'This row was priced without a modeled state pack (flat override or unmodeled state), so per-driver attribution is unavailable.'}
      </p>
    )
  }
  const f = d.facts
  if (!f.hasIncomeTax) {
    // A structural $0 only holds when the whole residency path was untaxed;
    // a move-year candidate still pays the origin state before the move.
    return row.lifetimeStateLocalTax === 0 ? (
      <p className="field-hint">
        {f.stateName} levies no broad income tax — the whole state+local line is $0 by construction. Property, sales,
        and other taxes are outside this model.
      </p>
    ) : (
      <p className="field-hint">
        {f.stateName} levies no broad income tax, so the years lived there contribute $0 — the{' '}
        {fmtMoney(row.lifetimeStateLocalTax)} lifetime state+local line comes from the years before the move (or other
        residences on this row&apos;s path). Property, sales, and other taxes are outside this model.
      </p>
    )
  }
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Driver ({f.stateName})</th>
            <th style={{ textAlign: 'right' }}>Lifetime state tax it saves</th>
            <th style={{ textAlign: 'left' }}>Rule</th>
          </tr>
        </thead>
        <tbody>
          <DriverRow
            label="Social Security treatment"
            value={f.taxesSocialSecurity ? '—' : fmtMoney(d.ssTreatmentSavings)}
            note={
              f.taxesSocialSecurity
                ? 'Taxes the federally taxable part of Social Security'
                : 'Leaves Social Security out of the state base'
            }
          />
          <DriverRow
            label={f.retirementRuleShared ? 'Retirement-income exclusion (one shared rule)' : 'Retirement-income exclusions (both buckets)'}
            value={fmtMoney(d.retirementExclusionSavings)}
            note={
              f.retirementRuleShared
                ? `All retirement income: ${exclusionLabel(f.retirementPrivate)}`
                : `Private: ${exclusionLabel(f.retirementPrivate)}; public: ${exclusionLabel(f.retirementPublic)}`
            }
          />
          {!f.retirementRuleShared ? (
            <DriverRow
              label="— of which the separate public-pension rule"
              value={fmtMoney(d.publicPensionExclusionSavings)}
              note={exclusionLabel(f.retirementPublic)}
            />
          ) : null}
          <DriverRow
            label="Capital-gain treatment"
            value={fmtMoney(d.capitalGainsTreatmentSavings)}
            note={
              f.capitalGainsTaxablePct >= 100
                ? f.capitalLossCarryforwardConformity === 'currentYearOnly'
                  ? 'Gains fully taxed; prior-year loss carryforwards not honored'
                  : 'Net gains taxed as ordinary income'
                : `${f.capitalGainsTaxablePct}% of net gains in the state base`
            }
          />
        </tbody>
      </table>
      <p className="field-hint" style={{ marginTop: '0.5rem' }}>
        Each figure re-prices every ledger year with that one rule neutralized, so the figures explain — but need not
        sum to — the {fmtMoney(d.totalStateLocalTax)} lifetime state+local tax this row actually paid (top marginal
        rate {f.topRatePct}%). A negative figure means the rule costs more than the benchmark.
      </p>
    </div>
  )
}

interface CandidateDraft {
  state: string
  moveYear: number | null
  localRatePct: number
  spendingDeltaPct: number
}

function draftToCandidate(draft: CandidateDraft): RelocationCandidate {
  return {
    state: draft.state,
    moveYear: draft.moveYear ?? undefined,
    localRatePct: draft.localRatePct > 0 ? draft.localRatePct : 0,
    spendingDeltaPct: draft.spendingDeltaPct !== 0 ? draft.spendingDeltaPct : undefined,
  }
}

export function RelocationComparePage() {
  const { plan, update } = usePlan()
  const navigate = useNavigate()
  const startYear = currentStartYear()

  const [drafts, setDrafts] = useState<CandidateDraft[]>([
    { state: 'FL', moveYear: null, localRatePct: 0, spendingDeltaPct: 0 },
  ])
  const [includeMc, setIncludeMc] = useState(true)
  const [rankBy, setRankBy] = useState<RankMetric>('lifetimeTax')
  const [running, setRunning] = useState(false)
  const runToken = useRef(0)
  const [compareState, setCompareState] = useState<{
    forPlan: Plan
    forDrafts: CandidateDraft[]
    result: RelocationComparison | null
    error: string | null
  } | null>(null)

  // Results are keyed to the plan object AND the candidate drafts they ran
  // on: any plan or candidate edit makes them disappear instead of showing
  // rows that no longer match the form.
  const fresh = compareState !== null && compareState.forPlan === plan && compareState.forDrafts === drafts
  const result = fresh ? compareState.result : null
  const error = fresh ? compareState.error : null

  const overrideActive = plan.assumptions.stateEffectiveTaxPct > 0

  const run = () => {
    // Only the latest run may commit results, so a slow worker completion can
    // never present rows for a form the user has since edited.
    const token = ++runToken.current
    const forPlan = plan
    const forDrafts = drafts
    setRunning(true)
    setCompareState(null)
    const monteCarlo = includeMc
      ? {
          model: buildModel('lognormal', plan.assumptions.inflationPct, 12, 60, plan),
          pathCount: RELOCATION_MC_PATHS,
          seed: seedFromPlanId(plan.id),
        }
      : null
    runRelocationCompare({ plan: forPlan, candidates: drafts.map(draftToCandidate), startYear, monteCarlo })
      .then((r) => {
        if (token === runToken.current) setCompareState({ forPlan, forDrafts, result: r, error: null })
      })
      .catch((e: unknown) => {
        if (token === runToken.current) {
          setCompareState({ forPlan, forDrafts, result: null, error: e instanceof Error ? e.message : String(e) })
        }
      })
      .finally(() => {
        if (token === runToken.current) setRunning(false)
      })
  }

  const addScenario = (row: RelocationCandidateRow) => {
    if (!row.candidate) return
    const candidate = row.candidate
    const baseName = candidate.moveYear !== undefined
      ? `Relocate to ${candidate.state} in ${candidate.moveYear}`
      : `Relocate to ${candidate.state}`
    const names = new Set(plan.scenarios.map((s) => s.name))
    let name = baseName
    let suffix = 2
    while (names.has(name)) name = `${baseName} (${suffix++})`
    const patch = relocationScenarioPatch(plan, candidate, startYear)
    update((d) => {
      d.scenarios.push({ id: makeScenarioId(), name, patch })
    })
    navigate(`/plan/${plan.id}/scenarios`)
  }

  const baseline = result?.rows.find((r) => r.id === 'baseline') ?? null
  // "Success rate" is only a real ordering when the last run priced one.
  const effectiveRankBy: RankMetric = rankBy === 'success' && !result?.monteCarlo ? 'lifetimeTax' : rankBy
  const rankedCandidates = useMemo(() => {
    if (!result) return []
    const rows = result.rows.filter((r) => r.id !== 'baseline')
    const key = (r: RelocationCandidateRow): number => {
      if (r.error) return Number.POSITIVE_INFINITY
      if (effectiveRankBy === 'estate') return -r.endingAfterTaxEstate
      if (effectiveRankBy === 'success') return -(r.successRate ?? -1)
      return r.lifetimeTaxesAndPenalties
    }
    return [...rows].sort((a, b) => key(a) - key(b) || a.destinationState.localeCompare(b.destinationState))
  }, [result, effectiveRankBy])

  const deflateEnd = (row: RelocationCandidateRow, amount: number) =>
    amount / Math.pow(1 + plan.assumptions.inflationPct / 100, row.endYear - startYear)

  return (
    <section>
      <div className="card">
        <h2>Relocation Compare</h2>
        <p className="card-hint">
          &quot;Which state should I retire in?&quot; — priced on <em>your</em> plan, not a generic ranking. Each
          candidate state re-runs your full year-by-year projection (federal + modeled state tax, retirement-income
          exclusions, Social Security treatment, capital-gain rules, split-year moves), so the rows differ only by
          where you live. <LearnLink {...LEARN.stateRelocation} />
        </p>
        <div className="callout callout--info">
          <p className="card-hint">
            <strong>Income tax is one relocation factor, not the decision.</strong> Property and sales taxes, housing
            and living costs, healthcare access, and being near people you love are all outside this model. The
            optional local-rate and spending-adjustment knobs are blunt approximations you control — nothing here
            recommends a &quot;best state.&quot; <LearnLink {...LEARN.stateRelocation} />
          </p>
        </div>
        {overrideActive ? (
          <div className="callout callout--warn">
            <p className="card-hint">
              Your plan sets a flat state-tax override ({plan.assumptions.stateEffectiveTaxPct}% under Assumptions),
              which replaces the modeled per-state rules. The baseline row keeps it; candidate rows clear it so the
              destination&apos;s modeled rules can apply — so part of any difference below comes from dropping the
              override itself.
            </p>
          </div>
        ) : null}
      </div>

      <div className="card">
        <h2>Candidate states</h2>
        <p className="card-hint">
          Up to {MAX_RELOCATION_CANDIDATES} states. Leave &quot;Move year&quot; blank to price the whole plan as a
          resident there; set a year to model a split-year move (July, like the Household screen). Nothing here
          changes your plan — use &quot;Add as scenario&quot; on a result row to keep one.
        </p>
        {drafts.map((draft, i) => (
          <div className="item-row" key={i} style={{ marginTop: i === 0 ? 0 : '0.75rem' }}>
            <div className="item-row-head">
              <span className="item-row-title">
                <span className="type-chip">Candidate</span>
                {US_STATES.find((s) => s.value === draft.state)?.label ?? draft.state}
              </span>
              <button
                type="button"
                className="btn-ghost btn-ghost-danger"
                onClick={() => setDrafts((ds) => ds.filter((_, j) => j !== i))}
              >
                Remove
              </button>
            </div>
            <div className="form-grid">
              <SelectField
                label="State"
                value={draft.state}
                options={US_STATES}
                onCommit={(v) => setDrafts((ds) => ds.map((d, j) => (j === i ? { ...d, state: v } : d)))}
              />
              <NumberField
                label="Move year (optional)"
                help="Blank prices the whole plan as a resident of the candidate state (your planned moves are replaced). A year models staying put until a split-year July move — the move-year is taxed part-year in each state."
                value={draft.moveYear}
                allowNull
                min={startYear}
                max={startYear + 60}
                onCommit={(v) =>
                  setDrafts((ds) => ds.map((d, j) => (j === i ? { ...d, moveYear: v === null ? null : Math.round(v) } : d)))
                }
              />
              <PercentField
                label="Local income tax (optional)"
                help="Flat local/city rate on state taxable income in the destination (e.g. ~3.9% in NYC). Replaces the plan's local rate for this candidate, across the whole plan — exact for a from-the-start candidate, an approximation across a mid-plan move."
                value={draft.localRatePct}
                min={0}
                max={10}
                onCommit={(v) => setDrafts((ds) => ds.map((d, j) => (j === i ? { ...d, localRatePct: v ?? 0 } : d)))}
              />
              <PercentField
                label="Spending adjustment (optional)"
                help="Blunt cost-of-living knob: changes baseline lifestyle spending by this percent for the candidate (e.g. -10 for a cheaper metro, +15 for a pricier one). Applies to the whole plan, not just after the move."
                value={draft.spendingDeltaPct}
                min={-50}
                max={50}
                onCommit={(v) => setDrafts((ds) => ds.map((d, j) => (j === i ? { ...d, spendingDeltaPct: v ?? 0 } : d)))}
              />
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.75rem' }}>
          <button
            type="button"
            className="btn btn-secondary btn-small"
            disabled={drafts.length >= MAX_RELOCATION_CANDIDATES}
            onClick={() => setDrafts((ds) => [...ds, { state: 'TX', moveYear: null, localRatePct: 0, spendingDeltaPct: 0 }])}
          >
            Add state
          </button>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <input type="checkbox" checked={includeMc} onChange={(e) => setIncludeMc(e.target.checked)} />
            <span className="field-label" style={{ margin: 0 }}>
              Success rate ({RELOCATION_MC_PATHS} shared market paths per state)
            </span>
            <HelpTip text="Runs a Monte Carlo per row with the same seed and market paths, so path N is the identical market history for every state — differences are the state's doing, not luck. Uses the smooth-randomness model; the Monte Carlo page has the full model catalog." />
          </label>
          <button type="button" className="btn btn-primary btn-small" disabled={running || drafts.length === 0} onClick={run}>
            {running ? 'Comparing…' : 'Run compare'}
          </button>
        </div>
        {running ? <div className="skeleton" style={{ height: '2rem', marginTop: '0.75rem' }} aria-label="Comparing states" /> : null}
        {error ? <p style={{ color: 'var(--bad)' }}>Compare error: {error}</p> : null}
      </div>

      {result && baseline && !running ? (
        <div className="card">
          <h2>Ranked results</h2>
          <p className="card-hint">
            Every row is your full plan, identical except for residence (and any knobs you set on the candidate).
            Deltas are vs. staying in {baseline.destinationState}. Dollar columns are nominal lifetime sums; the
            estate column is deflated to today&apos;s dollars.
          </p>
          <div className="form-grid">
            <SelectField
              label="Rank by"
              value={effectiveRankBy}
              options={[
                { value: 'lifetimeTax', label: 'Lifetime taxes & penalties (low to high)' },
                { value: 'estate', label: 'Ending after-tax estate (high to low)' },
                // Only a real ordering when this run priced a success rate.
                ...(result.monteCarlo ? [{ value: 'success' as const, label: 'Success rate (high to low)' }] : []),
              ]}
              onCommit={setRankBy}
            />
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Residence</th>
                  <th style={{ textAlign: 'right' }}>
                    Lifetime state+local tax <HelpTip text="Sum of the ledger's per-year state and local income-tax lines over the whole projection (nominal). The drill-down explains which state rules drive it." />
                  </th>
                  <th style={{ textAlign: 'right' }}>
                    Lifetime taxes & penalties <HelpTip text="Federal + state + local + penalties over the whole projection (nominal) — the ranking default, since a state change also moves federal interactions like deduction and bracket timing." />
                  </th>
                  <th style={{ textAlign: 'right' }}>Δ vs staying</th>
                  <th style={{ textAlign: 'right' }}>Ending after-tax estate (today&apos;s $)</th>
                  {result.monteCarlo ? <th style={{ textAlign: 'right' }}>Success rate</th> : null}
                </tr>
              </thead>
              <tbody>
                {[baseline, ...rankedCandidates].map((row) => {
                  const delta = row.error ? null : row.lifetimeTaxesAndPenalties - baseline.lifetimeTaxesAndPenalties
                  return (
                    <tr key={row.id}>
                      <td>
                        {row.id === 'baseline' ? <strong>{row.label}</strong> : row.label}
                        {!row.error && !row.modeled ? (
                          <>
                            {' '}
                            <HelpTip text="Part of this row was priced without a modeled state pack (unmodeled state, or the flat override) — treat its state-tax line as approximate." />
                          </>
                        ) : null}
                      </td>
                      {row.error ? (
                        <td colSpan={result.monteCarlo ? 5 : 4} style={{ color: 'var(--bad)' }}>
                          {row.error}
                        </td>
                      ) : (
                        <>
                          <td style={{ textAlign: 'right' }}>{fmtMoney(row.lifetimeStateLocalTax)}</td>
                          <td style={{ textAlign: 'right' }}>{fmtMoney(row.lifetimeTaxesAndPenalties)}</td>
                          <td style={{ textAlign: 'right', color: delta !== null && delta < 0 ? 'var(--good)' : undefined }}>
                            {row.id === 'baseline' || delta === null ? '—' : `${delta > 0 ? '+' : ''}${fmtMoney(delta)}`}
                          </td>
                          <td style={{ textAlign: 'right' }}>{fmtMoney(deflateEnd(row, row.endingAfterTaxEstate))}</td>
                        </>
                      )}
                      {result.monteCarlo && !row.error ? (
                        <td style={{ textAlign: 'right' }}>{row.successRate !== null ? fmtPct(row.successRate, 1) : '—'}</td>
                      ) : null}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {[baseline, ...rankedCandidates]
            .filter((row) => !row.error)
            .map((row) => (
              <details className="ss-explainer" key={row.id}>
                <summary>What drives &quot;{row.label}&quot;?</summary>
                <DriverDetails row={row} />
                {row.candidate ? (
                  <div style={{ marginTop: '0.5rem' }}>
                    <button type="button" className="btn btn-secondary btn-small" onClick={() => addScenario(row)}>
                      Add as scenario
                    </button>
                    <p className="field-hint" style={{ marginTop: '0.5rem' }}>
                      Creates a side-by-side scenario under Scenarios using the planner&apos;s existing state-move
                      fields — your plan itself is not changed. The scenario reruns to exactly this row.
                    </p>
                  </div>
                ) : null}
                {row.depletionYear !== null ? (
                  <p className="field-hint" style={{ color: 'var(--bad)' }}>
                    This row&apos;s deterministic projection runs short of money in {row.depletionYear}.
                  </p>
                ) : null}
                {row.warnings.map((warning) => (
                  <p className="field-hint" key={warning}>
                    ⚠ {warning}
                  </p>
                ))}
              </details>
            ))}
          <p className="field-hint" style={{ marginTop: '0.75rem' }}>
            Rows use the same start year, market assumptions, and (when enabled) the same {result.monteCarlo?.pathCount}{' '}
            seeded market paths, so differences are attributable to residence, not simulation noise. State rules come
            from the modeled per-state packs (all 50 states + DC); property, sales, and estate/inheritance taxes are
            not modeled.
          </p>
        </div>
      ) : null}

      <LearnAboutScreen route="/plan/:planId/relocation" />
    </section>
  )
}
