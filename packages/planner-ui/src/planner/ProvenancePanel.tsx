/**
 * Shows where the engine's tax/limit/benefit defaults come from — one row per
 * assumption group with its key figures and a link to a citable source.
 * Rendered on the Disclaimer page and pointed to from Assumptions.
 */

import {
  LATEST_PACK_YEAR,
  PARAMETER_COMPONENTS,
  PARAMETER_COMPONENT_KEYS,
  PARAMETER_DATA_AS_OF,
  PARAMETER_PROVENANCE,
} from '@retiregolden/engine/params'

/**
 * Which years of each publisher's figures RetireGolden has loaded, and when
 * the agency usually publishes the next year's (decision D-2027-ROLLOVER,
 * review M2): until a year is loaded it is projected from the latest loaded
 * figures. Statutes and tables that no one republishes yearly are left out.
 */
function PublicationYears() {
  const rows = PARAMETER_COMPONENT_KEYS.map((key) => PARAMETER_COMPONENTS[key]).filter(
    (component) => component.publishes !== null,
  )
  return (
    <table className="provenance-table provenance-years">
      <caption className="sr-only">Years loaded by source</caption>
      <thead>
        <tr>
          <th scope="col">Figures</th>
          <th scope="col">Loaded for</th>
          <th scope="col">Next year&apos;s usually out</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((component) => (
          <tr key={component.key}>
            <th scope="row">
              <span className="provenance-label">{component.label}</span>
              <span className="provenance-figures muted small">{component.publisher}</span>
            </th>
            <td>{component.years.map((entry) => entry.year).join(', ')}</td>
            <td>{component.publishes}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function ProvenancePanel() {
  return (
    <div className="provenance">
      <p className="muted small">
        The figures below are the ones RetireGolden has loaded, compiled {PARAMETER_DATA_AS_OF}: the first
        table&apos;s Loaded for column gives the years loaded for each agency&apos;s figures, and a row in the second
        that is not for {LATEST_PACK_YEAR} names its years. A later year uses an agency&apos;s figures once
        RetireGolden has loaded them. Until then
        federal figures grow from the latest loaded year at the plan&apos;s inflation assumption, and Medicare premiums
        at its healthcare inflation. State income tax uses each state&apos;s enacted schedules where they are loaded
        (their rows are below); otherwise a state&apos;s latest loaded brackets and rates are held without growth, so
        scheduled state changes not yet loaded are not modeled. A state standard deduction that follows the federal
        one moves with it, and one the state&apos;s own statute indexes grows at the plan&apos;s inflation assumption.
        Verify any number that matters against the official source.
      </p>
      <PublicationYears />
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
