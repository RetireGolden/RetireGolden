/**
 * Survivor transition view (survivor-widowhood-and-irmaa-relief, step 2).
 *
 * For two-adult plans: each death timing is the user's own plan re-run with a
 * death-age override on the same deterministic ledger as Results, so every
 * number agrees exactly with running the equivalent scenario by hand. The
 * framing is deliberately educational — death timings are scenarios the reader
 * chooses to look at, never predictions.
 */

import { useEffect, useMemo, useState } from 'react'

import { usePlan } from './planContextCore'
import { LearnAboutScreen } from '../learn/LearnAboutScreen'
import { LearnLink } from '../learn/LearnLink'
import { LEARN } from './learnLinks'
import { fmtMoney, fmtMoneyCompact } from './format'
import { currentStartYear, taxCalculatorFor } from './useProjection'
import {
  buildSurvivorAnalysis,
  type SurvivorAnalysis,
  type SurvivorScenarioRow,
} from './survivorAnalysis'

function filingLabel(status: SurvivorScenarioRow['firstSurvivorYear']['filingStatus']): string {
  return status === 'marriedFilingJointly'
    ? 'married filing jointly'
    : status === 'qualifyingSurvivingSpouse'
      ? 'qualifying surviving spouse'
      : 'single'
}

function TimelineCell({ row }: { row: SurvivorScenarioRow }) {
  return (
    <span>
      {row.filingTimeline.map((seg, i) => (
        <span key={seg.fromYear}>
          {i > 0 ? ' → ' : ''}
          {filingLabel(seg.status)}
          <span className="small"> {seg.fromYear === seg.toYear ? `(${seg.fromYear})` : `(${seg.fromYear}–${seg.toYear})`}</span>
        </span>
      ))}
    </span>
  )
}

function ScenarioTable({ rows, personName }: { rows: SurvivorScenarioRow[]; personName: string }) {
  if (rows.length === 0) {
    return (
      <p className="small">
        No earlier-death timings to sweep for {personName} — the standard ages (70–90) all fall outside their current
        age and planning age.
      </p>
    )
  }
  return (
    <div className="year-table-wrap" style={{ border: 'none' }}>
      <table className="compare-table">
        <thead>
          <tr>
            <th>Dies at</th>
            <th>Filing status</th>
            <th>Household Social Security</th>
            <th>Tax around the transition</th>
            <th>IRMAA relief (SSA-44)</th>
            <th>Survivor spending</th>
            <th>Convert-early lever</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.deceasedPersonId}-${row.deathAge}`}>
              <td>
                <strong>{row.deathAge}</strong>
                <div className="small">{row.deathYear}</div>
              </td>
              <td style={{ maxWidth: '14rem', textAlign: 'left' }}>
                <TimelineCell row={row} />
              </td>
              <td>
                {fmtMoneyCompact(row.ssBeforeDeath)} → {fmtMoneyCompact(row.ssAfterDeath)}
                <div className="small">
                  {row.lastJointYear.year} vs {row.firstSurvivorYear.year}
                </div>
              </td>
              <td>
                {fmtMoneyCompact(row.lastJointYear.tax)} → {fmtMoneyCompact(row.firstSurvivorYear.tax)}
                <div className="small">
                  on MAGI {fmtMoneyCompact(row.lastJointYear.magi)} → {fmtMoneyCompact(row.firstSurvivorYear.magi)},{' '}
                  {filingLabel(row.firstSurvivorYear.filingStatus)}
                </div>
              </td>
              <td>
                {row.ssa44PremiumSavings > 0.5 ? (
                  <>
                    <span className="delta-pos">{fmtMoney(Math.round(row.ssa44PremiumSavings))}</span>
                    <div className="small">
                      {row.irmaaYears
                        .filter((y) => y.tierWithoutSsa44 !== y.tierWithSsa44)
                        .map((y) => `${y.year}: tier ${y.tierWithoutSsa44} → ${y.tierWithSsa44}`)
                        .join('; ') || 'premium difference across survivor years'}
                    </div>
                  </>
                ) : (
                  <>
                    —<div className="small">no surcharge to relieve at this timing</div>
                  </>
                )}
              </td>
              <td>
                {row.survivorShortfallYears === 0 ? (
                  <span className="delta-pos">covered</span>
                ) : (
                  <span className="delta-neg">{row.survivorShortfallYears} shortfall yrs</span>
                )}
                <div className="small">low point {fmtMoneyCompact(row.minSurvivorInvestable)}</div>
              </td>
              <td>
                {row.conversionLever ? (
                  <>
                    <span
                      className={
                        row.conversionLever.estateDelta > 500
                          ? 'delta-pos'
                          : row.conversionLever.estateDelta < -500
                            ? 'delta-neg'
                            : undefined
                      }
                    >
                      {row.conversionLever.estateDelta > 0 ? '+' : ''}
                      {fmtMoneyCompact(row.conversionLever.estateDelta)}
                    </span>
                    <div className="small">
                      after-tax estate ({row.conversionLever.lifetimeTaxDelta > 0 ? '+' : ''}
                      {fmtMoneyCompact(row.conversionLever.lifetimeTaxDelta)} lifetime tax), filling the 12% bracket
                      through {row.deathYear}
                    </div>
                  </>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function SurvivorTransitionPage() {
  const { plan, update } = usePlan()
  // The analysis is stored WITH the plan it was computed for and derived to
  // null whenever the current plan differs, so a stale sweep can never render
  // against an edited plan through the debounce window.
  const [snapshot, setSnapshot] = useState<{ plan: typeof plan; analysis: SurvivorAnalysis } | null>(null)
  const eligible = plan.household.filingStatus === 'marriedFilingJointly' && plan.household.people.length === 2

  // Each timing runs a handful of full ledger simulations; debounce off the
  // keystroke path like the Scenarios page does.
  useEffect(() => {
    if (!eligible) return undefined
    const t = window.setTimeout(() => {
      try {
        setSnapshot({
          plan,
          analysis: buildSurvivorAnalysis(plan, { startYear: currentStartYear(), taxCalculator: taxCalculatorFor(plan) }),
        })
      } catch {
        // Per-timing failures are already absorbed inside the sweep; this is
        // the whole-sweep backstop so the page shows an error card, not a
        // stuck skeleton.
        setSnapshot({ plan, analysis: { eligible: true, planUsesSsa44: false, rows: [], failedTimings: 0, error: true } })
      }
    }, 200)
    return () => window.clearTimeout(t)
  }, [plan, eligible])
  const analysis = snapshot !== null && snapshot.plan === plan ? snapshot.analysis : null

  const anySsa44Savings = useMemo(
    () => (analysis?.rows ?? []).some((r) => r.ssa44PremiumSavings > 0.5),
    [analysis],
  )

  if (!eligible) {
    return (
      <section>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Survivor transition</h2>
          <div className="empty-state">
            <p>
              This view is for plans with two adults filing jointly: it shows how taxes, Medicare premiums, and income
              change for the surviving spouse under different death timings. A one-adult plan has no survivor
              transition to model.
            </p>
          </div>
        </div>
        <LearnAboutScreen route="/plan/:planId/survivor" />
      </section>
    )
  }

  return (
    <section>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Survivor transition</h2>
        <p>
          Couples' plans quietly assume both of you reach your planning ages. This view re-runs <em>your own plan</em>{' '}
          with earlier first-death timings so you can see the transition while there is still time to prepare for it:
          the filing-status change, the surviving spouse's Social Security, the tax on similar income, Medicare's
          income surcharge (IRMAA), and the levers available in the joint years. Each timing is a scenario you choose
          to look at — nothing here is a prediction.{' '}
          <LearnLink slug="widows-penalty-and-survivor-brackets" label="Learn about the widow's penalty" />
        </p>
        <ul className="small">
          <li>
            <strong>IRMAA relief (SSA-44):</strong> the death of a spouse is a qualifying life-changing event, so the
            survivor can ask Social Security to price IRMAA on current income instead of the two-year lookback. The
            column shows the premium difference between modeling that relief and not. The model is deliberately
            conservative in the first survivor year — its income estimate still references the death year's joint
            income, where a real filing could use the survivor's own — so year-one relief can be understated.{' '}
            <LearnLink slug={LEARN.ssa44.slug} label={LEARN.ssa44.label} />
          </li>
          <li>
            <strong>Convert-early lever:</strong> the change in ending after-tax estate from filling the 12% bracket
            with Roth conversions while joint brackets last, priced on the same ledger as everything else.
          </li>
        </ul>
        {anySsa44Savings && !plan.expenses.healthcare.ssa44?.survivorYears ? (
          <div className="callout callout--info">
            <p style={{ margin: 0 }}>
              Some timings show IRMAA relief your plan is not currently modeling. You can turn SSA-44 survivor relief
              on under <strong>Spending → Healthcare</strong>, or{' '}
              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={() =>
                  update((d) => {
                    d.expenses.healthcare.ssa44 = {
                      survivorYears: true,
                      retirementYears: d.expenses.healthcare.ssa44?.retirementYears ?? false,
                    }
                  })
                }
              >
                model it in this plan
              </button>{' '}
              (the form itself is filed with Social Security when the time comes).
            </p>
          </div>
        ) : null}
      </div>

      {analysis === null ? (
        <div className="card">
          <div className="skeleton" style={{ height: '10rem' }} aria-label="Running death-timing scenarios" />
        </div>
      ) : analysis.error ? (
        <div className="card">
          <div className="callout callout--warn" role="alert">
            The death-timing sweep could not run on this plan. The rest of the planner is unaffected — if this
            persists, check the plan for validation issues on the Enter screens.
          </div>
        </div>
      ) : (
        <>
          {analysis.failedTimings > 0 ? (
            <div className="callout callout--warn" role="alert">
              {analysis.failedTimings} death timing{analysis.failedTimings === 1 ? '' : 's'} could not be simulated and{' '}
              {analysis.failedTimings === 1 ? 'is' : 'are'} not shown — the rows below are still exact for their own
              timings.
            </div>
          ) : null}
          {plan.household.people.map((person) => (
            <div className="card" key={person.id}>
              <h3 style={{ marginTop: 0 }}>If {person.name} dies first</h3>
              <ScenarioTable rows={analysis.rows.filter((r) => r.deceasedPersonId === person.id)} personName={person.name} />
            </div>
          ))}
        </>
      )}

      <LearnAboutScreen route="/plan/:planId/survivor" />
    </section>
  )
}
