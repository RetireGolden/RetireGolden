/**
 * Scenarios: curated what-if overrides on top of the base plan, compared
 * side by side (deterministic metrics + Monte Carlo success on a shared
 * seed, so every scenario faces the same markets).
 */

import { useEffect, useMemo, useState } from 'react'

import type { Plan } from '@retiregolden/engine/model/plan'
import { TRUSTEES_DEFAULT_SS_HAIRCUT } from '@retiregolden/engine/params'
import { compareScenarios, type ScenarioComparison } from '@retiregolden/engine/scenarios/scenarios'
import { usePlan } from './planContextCore'
import { MoneyField, NumberField, PercentField, SelectField } from './fields'
import { LearnAboutScreen } from '../learn/LearnAboutScreen'
import { fmtMoneyCompact } from './format'
import { currentStartYear, seedFromPlanId, taxCalculatorFor } from './useProjection'

const newId = () => crypto.randomUUID()

type TemplateKind = 'retireEarlier' | 'spendMore' | 'ssCut' | 'noConversions' | 'lowerReturns' | 'ltcShock' | 'coastCheck'

const TEMPLATES: Array<{ kind: TemplateKind; label: string }> = [
  { kind: 'retireEarlier', label: 'Retire earlier/later' },
  { kind: 'spendMore', label: 'Spend more/less' },
  { kind: 'ssCut', label: 'Social Security cut' },
  { kind: 'noConversions', label: 'Skip Roth conversions' },
  { kind: 'lowerReturns', label: 'Different returns' },
  { kind: 'ltcShock', label: 'Long-term-care shock' },
  { kind: 'coastCheck', label: 'Coast check: stop contributing' },
]

interface TemplateParams {
  retireAgeDelta: number
  spendPct: number
  ssCutPct: number
  returnPct: number | null
  ltcYears: number
  ltcAnnual: number
  ltcStartAge: number
}

const DEFAULT_PARAMS: TemplateParams = {
  retireAgeDelta: -2,
  spendPct: 15,
  ssCutPct: TRUSTEES_DEFAULT_SS_HAIRCUT.cutPct,
  returnPct: 4,
  ltcYears: 3,
  ltcAnnual: 110_000,
  ltcStartAge: 84,
}

function zeroAccountContributions(account: Plan['accounts'][number]): Plan['accounts'][number] {
  if (!('annualContribution' in account)) return account
  const next: Record<string, unknown> = { ...account, annualContribution: 0 }
  delete next.contributionSchedule
  return next as Plan['accounts'][number]
}

/** Builds a schema-safe patch for a template. Arrays are replaced wholesale by design. */
function buildPatch(kind: TemplateKind, p: TemplateParams, plan: Plan): { name: string; patch: Record<string, unknown> } {
  switch (kind) {
    case 'retireEarlier': {
      const people = plan.household.people.map((person) => ({
        ...person,
        retirementAge:
          person.retirementAge === null ? null : Math.min(80, Math.max(30, person.retirementAge + p.retireAgeDelta)),
      }))
      const verb = p.retireAgeDelta < 0 ? 'earlier' : 'later'
      return { name: `Retire ${Math.abs(p.retireAgeDelta)}y ${verb}`, patch: { household: { people } } }
    }
    case 'spendMore': {
      const factor = 1 + p.spendPct / 100
      return {
        name: `Spend ${p.spendPct >= 0 ? '+' : ''}${p.spendPct}%`,
        patch: { expenses: { baseAnnual: Math.max(0, Math.round(plan.expenses.baseAnnual * factor)) } },
      }
    }
    case 'ssCut':
      return {
        name: `${p.ssCutPct}% SS cut from ${TRUSTEES_DEFAULT_SS_HAIRCUT.fromYear}`,
        patch: { assumptions: { ssHaircut: { fromYear: TRUSTEES_DEFAULT_SS_HAIRCUT.fromYear, cutPct: p.ssCutPct } } },
      }
    case 'noConversions':
      return { name: 'No Roth conversions', patch: { strategies: { rothConversion: { mode: 'none' } } } }
    case 'lowerReturns':
      return {
        name: `${p.returnPct ?? 0}% default return`,
        patch: { assumptions: { defaultReturnPct: p.returnPct ?? 0 } },
      }
    case 'ltcShock': {
      const startYear =
        Number(plan.household.people[0]!.dob.slice(0, 4)) + p.ltcStartAge
      const goals = [
        ...plan.expenses.oneTimeGoals,
        ...Array.from({ length: p.ltcYears }, (_, i) => ({
          id: newId(),
          label: `LTC year ${i + 1}`,
          year: startYear + i,
          amount: p.ltcAnnual,
        })),
      ]
      return {
        name: `LTC: ${p.ltcYears}y × ${fmtMoneyCompact(p.ltcAnnual)} at ${p.ltcStartAge}`,
        patch: { expenses: { oneTimeGoals: goals } },
      }
    }
    case 'coastCheck':
      return {
        name: 'Coast check: stop contributing',
        patch: { accounts: plan.accounts.map(zeroAccountContributions) },
      }
  }
}

function AddScenario() {
  const { update } = usePlan()
  const [kind, setKind] = useState<TemplateKind>('retireEarlier')
  const [params, setParams] = useState<TemplateParams>(DEFAULT_PARAMS)
  const set = <K extends keyof TemplateParams>(k: K, v: TemplateParams[K]) => setParams((p) => ({ ...p, [k]: v }))
  return (
    <div className="card">
      <h2>Add a scenario</h2>
      <p className="card-hint">Each scenario overrides just a few assumptions on top of the base plan; everything else stays in sync as you keep editing.</p>
      <div className="form-grid">
        <SelectField
          label="What if…"
          value={kind}
          options={TEMPLATES.map((t) => ({ value: t.kind, label: t.label }))}
          onCommit={(v) => setKind(v)}
        />
        {kind === 'retireEarlier' ? (
          <NumberField label="Years earlier (−) / later (+)" value={params.retireAgeDelta} min={-15} max={15} onCommit={(v) => set('retireAgeDelta', Math.round(v ?? -2))} />
        ) : null}
        {kind === 'spendMore' ? <PercentField label="Spending change" value={params.spendPct} min={-50} max={100} onCommit={(v) => set('spendPct', v ?? 15)} /> : null}
        {kind === 'ssCut' ? <PercentField label="Benefit cut" value={params.ssCutPct} min={0} max={100} onCommit={(v) => set('ssCutPct', v ?? TRUSTEES_DEFAULT_SS_HAIRCUT.cutPct)} /> : null}
        {kind === 'lowerReturns' ? <PercentField label="Default return" value={params.returnPct} onCommit={(v) => set('returnPct', v)} /> : null}
        {kind === 'ltcShock' ? (
          <>
            <NumberField label="Years of care" value={params.ltcYears} min={1} max={10} onCommit={(v) => set('ltcYears', Math.round(v ?? 3))} />
            <MoneyField label="Annual cost (today's $)" value={params.ltcAnnual} onCommit={(v) => set('ltcAnnual', v ?? 110_000)} />
            <NumberField label="Starting age" value={params.ltcStartAge} min={60} max={105} onCommit={(v) => set('ltcStartAge', Math.round(v ?? 84))} />
          </>
        ) : null}
      </div>
      <div className="add-row">
        <button
          type="button"
          className="btn btn-primary btn-small"
          onClick={() =>
            update((d) => {
              const built = buildPatch(kind, params, d)
              d.scenarios.push({ id: newId(), name: built.name, patch: built.patch })
            })
          }
        >
          + Add scenario
        </button>
      </div>
    </div>
  )
}

export function ScenariosPage() {
  const { plan, update } = usePlan()
  const [withMc, setWithMc] = useState(true)
  const [comparison, setComparison] = useState<ScenarioComparison | null>(null)
  const seed = useMemo(() => seedFromPlanId(plan.id), [plan.id])

  // compareScenarios with MC is CPU-bound but fast (≈100 ms/scenario at 200
  // paths); run it debounced off the main interaction.
  useEffect(() => {
    const t = window.setTimeout(() => {
      setComparison(
        compareScenarios(plan, {
          startYear: currentStartYear(),
          taxCalculator: taxCalculatorFor(plan),
          // Per-row stacks so patches that change tax assumptions (e.g. a
          // relocation scenario clearing the flat override) price correctly.
          taxCalculatorForPlan: taxCalculatorFor,
          monteCarlo: withMc ? { model: { type: 'lognormal', inflationMeanPct: plan.assumptions.inflationPct }, pathCount: 200, seed } : undefined,
        }),
      )
    }, 200)
    return () => window.clearTimeout(t)
  }, [plan, withMc, seed])

  const base = comparison?.rows[0]

  return (
    <section>
      <AddScenario />

      <div className="card">
        <div className="item-row-head">
          <h2 style={{ margin: 0 }}>Side-by-side</h2>
          <label className="radio-option" style={{ padding: 0 }}>
            <input type="checkbox" checked={withMc} onChange={(e) => setWithMc(e.target.checked)} />
            <span className="small">Monte Carlo success % (200 paths, shared markets)</span>
          </label>
        </div>
        {plan.scenarios.length === 0 ? (
          <div className="empty-state">
            <p>No scenarios yet. Add one above — “{TRUSTEES_DEFAULT_SS_HAIRCUT.cutPct}% SS cut” and “retire 2 years earlier” are classics.</p>
          </div>
        ) : comparison === null ? (
          <div className="skeleton" style={{ height: '10rem' }} aria-label="Comparing scenarios" />
        ) : (
          <div className="year-table-wrap" style={{ border: 'none' }}>
            <table className="compare-table">
              <thead>
                <tr>
                  <th>Scenario</th>
                  {withMc ? <th>Success</th> : null}
                  <th>Ending estate</th>
                  <th>Lifetime tax</th>
                  <th>Depletes</th>
                  <th>Changed</th>
                  <th aria-label="actions" />
                </tr>
              </thead>
              <tbody>
                {comparison.rows.map((row) => {
                  const estateDelta = base && row.scenarioId !== null ? row.summary.endingNetWorth - base.summary.endingNetWorth : null
                  return (
                    <tr key={row.scenarioId ?? 'base'}>
                      <td>
                        <strong>{row.name}</strong>
                        {row.error ? <div className="small" style={{ color: 'var(--bad)' }}>{row.error}</div> : null}
                      </td>
                      {withMc ? (
                        <td>
                          {row.successRate === null ? '—' : (
                            <span className={row.successRate >= 0.9 ? 'delta-pos' : row.successRate < 0.75 ? 'delta-neg' : undefined}>
                              {Math.round(row.successRate * 100)}%
                            </span>
                          )}
                        </td>
                      ) : null}
                      <td>
                        {row.error ? '—' : fmtMoneyCompact(row.summary.endingNetWorth)}
                        {estateDelta !== null && Math.abs(estateDelta) > 500 ? (
                          <div className={estateDelta > 0 ? 'small delta-pos' : 'small delta-neg'}>
                            {estateDelta > 0 ? '+' : ''}
                            {fmtMoneyCompact(estateDelta)}
                          </div>
                        ) : null}
                      </td>
                      <td>{row.error ? '—' : fmtMoneyCompact(row.summary.lifetimeTaxesAndPenalties)}</td>
                      <td>{row.error ? '—' : (row.summary.depletionYear ?? 'never')}</td>
                      <td style={{ maxWidth: '16rem', textAlign: 'left' }}>
                        {row.diff.slice(0, 4).map((d) => (
                          <span key={d.path} className="diff-chip" title={`${d.path}: ${JSON.stringify(d.baseValue)} → ${JSON.stringify(d.scenarioValue)}`}>
                            {d.path.split('.').slice(-2).join('.')}
                          </span>
                        ))}
                        {row.diff.length > 4 ? <span className="diff-chip">+{row.diff.length - 4} more</span> : null}
                      </td>
                      <td>
                        {row.scenarioId !== null ? (
                          <button
                            type="button"
                            className="btn-ghost btn-ghost-danger"
                            onClick={() =>
                              update((d) => {
                                d.scenarios = d.scenarios.filter((s) => s.id !== row.scenarioId)
                              })
                            }
                          >
                            Remove
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <LearnAboutScreen route="/plan/:planId/scenarios" />
    </section>
  )
}
