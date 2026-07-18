/**
 * Household map — the Explore-rail topology page. Renders the sanitized map
 * view model as HTML node cards (each a deep link to the planner screen where
 * that item is edited) over an SVG edge layer. Everything shown is a reading
 * of entered plan data: totals are "as entered" (not the projection), missing
 * facts are flagged per node, and relationships the schema cannot express are
 * listed plainly instead of being drawn.
 */

import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { buildHouseholdGraph } from '@retiregolden/engine/household/householdGraph'
import { isPlanIncomplete } from '../planner/planCompleteness'
import { usePlan } from '../planner/planContextCore'
import type { MapColumnId } from './layout'
import { MAP_COLUMN_LABELS } from './layout'
import { buildMapViewModel, EDIT_SURFACE_ROUTES, type MapNodeVM } from './mapViewModel'

const ZOOM_STEPS = [0.75, 1, 1.25, 1.5] as const

const FILTER_COLUMNS: readonly MapColumnId[] = ['income', 'accounts', 'propertyDebt', 'protection']

/**
 * Print rules scoped to this page's lifetime: mounted with the page, gone on
 * navigation, so the Letter-landscape @page rule never leaks into other
 * planner printouts.
 */
const PRINT_CSS = `
@media print {
  @page { size: letter landscape; margin: 0.5in; }
  .household-map-scroll { overflow: visible; border: none; }
  .household-map-stage { width: auto !important; height: auto !important; }
  /* Print at natural layout size, gently shrunk to fit Letter landscape. */
  .household-map-canvas { transform: none !important; zoom: 0.78; }
  .household-map-page details { display: none; }
}
`

function completenessBadge(node: MapNodeVM) {
  if (node.completenessState === 'complete') return null
  const symbol = node.completenessState === 'unknown' ? '?' : '!'
  const srText = node.completenessState === 'unknown' ? 'cannot be estimated' : 'needs attention'
  return (
    <span className="map-node-flag" aria-hidden="true" title={`${srText}: ${node.missing.join('; ')}`}>
      {symbol}
    </span>
  )
  // The state itself is announced via the card's aria-label, so the badge is
  // decorative for assistive tech (aria-hidden) — no color-only meaning.
}

export function HouseholdMapPage() {
  const { plan } = usePlan()
  const [hideAmounts, setHideAmounts] = useState(false)
  const [zoom, setZoom] = useState<number>(1)
  const [focusPersonId, setFocusPersonId] = useState<string>('')
  const [hiddenColumns, setHiddenColumns] = useState<readonly MapColumnId[]>([])
  const stageRef = useRef<HTMLDivElement>(null)

  const graph = useMemo(() => buildHouseholdGraph(plan), [plan])
  const vm = useMemo(
    () =>
      buildMapViewModel(graph, {
        hideAmounts,
        focusPersonId: focusPersonId || null,
        visibleColumns: FILTER_COLUMNS.filter((c) => !hiddenColumns.includes(c)),
      }),
    [graph, hideAmounts, focusPersonId, hiddenColumns],
  )

  const attention = useMemo(() => graph.nodes.filter((n) => n.completeness.missing.length > 0), [graph])

  // Arrow keys move focus between cards (grid-wise); Tab order stays the
  // natural column-by-column DOM order.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return
    const active = document.activeElement as HTMLElement | null
    const currentId = active?.dataset?.nodeId
    if (!currentId) return
    const current = vm.nodes.find((n) => n.id === currentId)
    if (!current) return
    e.preventDefault()
    let next: MapNodeVM | undefined
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const delta = e.key === 'ArrowDown' ? 1 : -1
      next = vm.nodes.find((n) => n.col === current.col && n.row === current.row + delta)
    } else {
      const delta = e.key === 'ArrowRight' ? 1 : -1
      const candidates = vm.nodes.filter((n) => n.col === current.col + delta)
      next = candidates.reduce<MapNodeVM | undefined>(
        (best, n) => (best === undefined || Math.abs(n.row - current.row) < Math.abs(best.row - current.row) ? n : best),
        undefined,
      )
    }
    if (next) {
      // Node ids never contain quotes, so a plain attribute selector is safe.
      stageRef.current?.querySelector<HTMLElement>(`[data-node-id="${next.id}"]`)?.focus()
    }
  }

  return (
    <section className="household-map-page">
      <style>{PRINT_CSS}</style>
      <div className="card">
        <h2>Household map</h2>
        <p className="card-hint">
          One page of everything you've entered — people, income, accounts, property, debts, insurance, and where
          things go — with the gaps made visible. Every box opens the screen where that item is edited. This is a
          picture of your entries, not advice; amounts are as entered, not projected.
        </p>

        <div className="household-map-controls no-print">
          <button
            type="button"
            className="btn btn-secondary btn-small"
            aria-pressed={hideAmounts}
            onClick={() => setHideAmounts((v) => !v)}
          >
            {hideAmounts ? 'Show amounts' : 'Hide amounts'}
          </button>
          <label className="map-control">
            Zoom
            <select value={zoom} onChange={(e) => setZoom(Number(e.target.value))} aria-label="Zoom level">
              {ZOOM_STEPS.map((z) => (
                <option key={z} value={z}>
                  {Math.round(z * 100)}%
                </option>
              ))}
            </select>
          </label>
          {plan.household.people.length > 1 ? (
            <label className="map-control">
              Focus on
              <select value={focusPersonId} onChange={(e) => setFocusPersonId(e.target.value)}>
                <option value="">Whole household</option>
                {plan.household.people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <fieldset className="map-filter-group">
            <legend className="sr-only">Show groups</legend>
            {FILTER_COLUMNS.map((c) => (
              <label key={c} className="map-control map-control--check">
                <input
                  type="checkbox"
                  checked={!hiddenColumns.includes(c)}
                  onChange={(e) =>
                    setHiddenColumns((prev) => (e.target.checked ? prev.filter((x) => x !== c) : [...prev, c]))
                  }
                />
                {MAP_COLUMN_LABELS[c]}
              </label>
            ))}
          </fieldset>
          <button type="button" className="btn btn-secondary btn-small" onClick={() => window.print()}>
            Print map
          </button>
        </div>

        <p className="map-totals" role="status">
          {vm.totals ? (
            <>
              As entered: assets <strong>{vm.totals.assetsText}</strong> · debts{' '}
              <strong>{vm.totals.liabilitiesText}</strong> · net <strong>{vm.totals.netWorthText}</strong>
            </>
          ) : (
            <>Amounts hidden</>
          )}
        </p>

        {isPlanIncomplete(plan) ? (
          <p className="card-hint">
            The map fills in as you enter your household — add accounts and income sources to see the full picture.
          </p>
        ) : null}

        <div className="household-map-scroll">
          {/* onKeyDown provides arrow-key roving between the focusable card
              links inside; the group itself is not interactive. */}
          <div
            className="household-map-stage"
            ref={stageRef}
            role="group"
            aria-label="Household map diagram. Use Tab or arrow keys to move between items."
            onKeyDown={onKeyDown}
            style={{
              width: vm.width * zoom,
              height: vm.height * zoom,
            }}
          >
            <div className="household-map-canvas" style={{ width: vm.width, height: vm.height, transform: `scale(${zoom})` }}>
              <svg className="map-edges" width={vm.width} height={vm.height} aria-hidden="true" focusable="false">
                {vm.edges.map((e) => (
                  <g key={e.id}>
                    <path className={`map-edge map-edge--${e.kind}`} d={e.path} />
                    {e.label && (e.kind === 'beneficiary' || e.kind === 'survivor' || e.kind === 'funds') ? (
                      <text className="map-edge-label" x={e.labelX} y={e.labelY - 4} textAnchor="middle">
                        {e.label}
                      </text>
                    ) : null}
                  </g>
                ))}
              </svg>
              {vm.columns.map((c) => (
                <span key={c.id} className="map-col-label" style={{ left: c.x }}>
                  {c.label}
                </span>
              ))}
              {vm.nodes.map((n) => (
                <Link
                  key={n.id}
                  to={`../${n.to}`}
                  className={`map-node map-node--${n.kind}`}
                  style={{ left: n.x, top: n.y, width: n.w, minHeight: n.h }}
                  data-node-id={n.id}
                  aria-label={n.ariaLabel}
                  title={n.label}
                >
                  <span className="map-node-head">
                    <span className="map-node-label">{n.label}</span>
                    {completenessBadge(n)}
                  </span>
                  <span className="map-node-meta">
                    {n.typeLabel}
                    {n.amountText ? ` · ${n.amountText}` : vm.amountsHidden ? ' · •••' : ''}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <details className="map-details">
          <summary>Text list of this map</summary>
          <table className="report-table">
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Type</th>
                <th scope="col">Amount</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {vm.nodes.map((n) => (
                <tr key={n.id}>
                  <th scope="row">
                    <Link to={`../${n.to}`}>{n.label}</Link>
                  </th>
                  <td>{n.typeLabel}</td>
                  <td>{n.amountText ?? (vm.amountsHidden ? 'hidden' : '—')}</td>
                  <td>{n.missing.length > 0 ? n.missing.join('; ') : 'Complete'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </div>

      {attention.length > 0 ? (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>What needs attention</h3>
          <p className="card-hint">
            Facts the plan could carry but doesn't yet. Filling them in sharpens the projection and the estate picture.
          </p>
          <ul className="map-attention-list">
            {attention.map((n) => (
              <li key={n.id}>
                <Link to={`../${EDIT_SURFACE_ROUTES[n.editSurface]}`}>{n.label}</Link>
                {' — '}
                <span className="muted">{n.completeness.missing.join('; ')}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Not in the model</h3>
        <p className="card-hint">
          Relationships RetireGolden's plan can't express. The map never guesses at them — if one matters to your
          situation, discuss it with a professional.
        </p>
        <ul className="map-unsupported-list">
          {graph.unsupported.map((u) => (
            <li key={u.id}>
              <strong>{u.label}.</strong> <span className="muted">{u.detail}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
