/**
 * Shows where the engine's tax/limit/benefit defaults come from — one row per
 * assumption group with its key figures and a link to a citable source.
 * Rendered on the Disclaimer page and pointed to from Assumptions.
 */

import {
  LATEST_PACK_YEAR,
  PARAMETER_DATA_AS_OF,
  PARAMETER_PROVENANCE,
} from '../engine/params'

export function ProvenancePanel() {
  return (
    <div className="provenance">
      <p className="muted small">
        Applies to the {LATEST_PACK_YEAR} tax year · figures compiled {PARAMETER_DATA_AS_OF}.
        Verify any number that matters against the official source.
      </p>
      <table className="provenance-table">
        <thead>
          <tr>
            <th scope="col">Figures</th>
            <th scope="col">Source</th>
          </tr>
        </thead>
        <tbody>
          {PARAMETER_PROVENANCE.map((s) => (
            <tr key={s.id}>
              <th scope="row">
                <span className="provenance-label">{s.label}</span>
                <span className="provenance-figures muted small">{s.figures}</span>
              </th>
              <td>
                <a href={s.url} target="_blank" rel="noopener noreferrer">
                  {s.publisher} ↗
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
