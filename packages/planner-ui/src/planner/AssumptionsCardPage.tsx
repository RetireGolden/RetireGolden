/**
 * "Your assumptions" card (trust-and-transparency-layer, step 1): one screen
 * enumerating every live assumption behind this plan's numbers — economy,
 * account returns, longevity, law toggles, and the parameter pack — each
 * tagged user-set / app default / published source, with a copy-export so the
 * run can be replicated in another tool. This is the direct answer to "why do
 * different planners give different answers?": they differ here.
 */

import { useMemo } from 'react'
import { Link } from 'react-router-dom'

import { PARAMETER_PROVENANCE } from '@retiregolden/engine/params'
import { CopyButton } from './CopyButton'
import { usePlan } from './planContextCore'
import { currentStartYear } from './useProjection'
import {
  assumptionsExportJson,
  assumptionsExportText,
  buildAssumptionsSnapshot,
  type AssumptionProvenance,
} from './assumptionsExport'

const PROVENANCE_CHIP: Record<AssumptionProvenance, { label: string; title: string }> = {
  'user-set': { label: 'You set this', title: 'Entered or changed by you — other tools need this value to match your run.' },
  'app-default': { label: 'App default', title: "RetireGolden's shipped default — you have not changed it." },
  'published-source': { label: 'Published source', title: 'Comes from a cited publication (statute, agency figure, or documented dataset).' },
}

export function AssumptionsCardPage() {
  const { plan } = usePlan()
  const startYear = currentStartYear()
  const snapshot = useMemo(() => buildAssumptionsSnapshot(plan, startYear), [plan, startYear])
  const sourceById = useMemo(() => new Map(PARAMETER_PROVENANCE.map((s) => [s.id, s])), [])

  return (
    <section>
      <div className="card">
        <h2>Your assumptions, on one card</h2>
        <p className="card-hint">
          Every number RetireGolden shows follows from the assumptions below — the same plan run through tools with
          different assumptions (or hidden ones) will disagree. Each value is tagged with where it comes from, and the
          copy buttons export the whole card so you can hand your exact assumptions to another tool or a professional
          and see where the inputs differ. (The rest of the plan — incomes, expenses, goals — travels in a plan backup
          from the planner home.)
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <CopyButton
            label="Copy as text"
            copiedLabel="Copied ✓"
            fallbackLabel="Your assumptions, as text"
            text={() => assumptionsExportText(snapshot)}
          />
          <CopyButton
            label="Copy as JSON"
            copiedLabel="Copied ✓"
            fallbackLabel="Your assumptions, as JSON"
            text={() => assumptionsExportJson(snapshot)}
          />
        </div>
        <p className="field-hint" style={{ marginTop: '0.5rem' }}>
          Applies to the {snapshot.packYear} tax year · parameter figures compiled {snapshot.dataAsOf} ·{' '}
          <Link to="/disclaimer">full source list</Link> · <Link to="/how-tested">how RetireGolden is tested</Link>
        </p>
      </div>

      {snapshot.groups.map((group) => (
        <div className="card" key={group.id}>
          <h3 style={{ marginTop: 0 }}>{group.label}</h3>
          <table className="provenance-table">
            <thead>
              <tr>
                <th scope="col">Assumption</th>
                <th scope="col">Where it comes from</th>
              </tr>
            </thead>
            <tbody>
              {group.rows.map((row) => {
                const source = row.sourceId ? sourceById.get(row.sourceId) : undefined
                const chip = PROVENANCE_CHIP[row.provenance]
                return (
                  <tr key={row.id}>
                    <th scope="row">
                      <span className="provenance-label">{row.label}</span>
                      <span className="provenance-figures muted small">{row.value}</span>
                    </th>
                    <td>
                      <span className="muted small" title={chip.title}>
                        {chip.label}
                      </span>
                      {source ? (
                        <>
                          {' · '}
                          <a href={source.url} target="_blank" rel="noopener noreferrer">
                            {source.publisher} ↗
                          </a>
                        </>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}

      <div className="card">
        <p className="field-hint" style={{ margin: 0 }}>
          Monte Carlo results also depend on the market model, path count, and seed chosen on the{' '}
          <Link to={`/plan/${plan.id}/monte-carlo`}>Monte Carlo page</Link> — your expected returns and inflation above
          stay the center of every model's distribution. To change anything on this card, use{' '}
          <Link to={`/plan/${plan.id}/assumptions`}>Assumptions</Link>, <Link to={`/plan/${plan.id}/accounts`}>Accounts</Link>,
          or <Link to={`/plan/${plan.id}/household`}>Household</Link>.
        </p>
      </div>
    </section>
  )
}
