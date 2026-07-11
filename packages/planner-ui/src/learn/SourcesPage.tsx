/**
 * Sources & review methodology (/learn/sources).
 *
 * Explains where rule statements come from, how current-year values are
 * date-stamped, and how often content is reviewed. Each article also carries
 * its own source list and last-reviewed date.
 */

import { Link } from 'react-router-dom'

type PrimarySource = { name: string; scope: string; href: string }

const PRIMARY_SOURCES: PrimarySource[] = [
  {
    name: 'IRS (irs.gov)',
    scope: 'Tax brackets, deductions, retirement-account limits, RMD and QCD rules.',
    href: 'https://www.irs.gov/',
  },
  {
    name: 'Social Security Administration (ssa.gov)',
    scope: 'Benefit formulas, claiming rules, and actuarial assumptions.',
    href: 'https://www.ssa.gov/',
  },
  {
    name: 'Medicare / CMS (medicare.gov)',
    scope: 'Medicare premiums and IRMAA income brackets.',
    href: 'https://www.medicare.gov/',
  },
  {
    name: 'HealthCare.gov / CMS',
    scope: 'ACA premium tax credit rules and marketplace eligibility.',
    href: 'https://www.healthcare.gov/',
  },
]

export function SourcesPage() {
  return (
    <article className="page learn-sources-page">
      <Link to="/learn" className="learn-back">
        ← Learning Center
      </Link>
      <h1>Sources &amp; review methodology</h1>
      <p className="lede">How Learning Center articles stay accurate, and where their rule statements come from.</p>

      <h2>Primary sources first</h2>
      <p>
        For anything involving tax, Medicare, Social Security, contribution limits, or ACA subsidies, articles cite
        primary sources rather than secondary commentary. Secondary sources are used only for framing or examples,
        never as the sole basis for a rule.
      </p>
      <table className="data-table">
        <thead>
          <tr>
            <th>Source</th>
            <th>What it covers</th>
          </tr>
        </thead>
        <tbody>
          {PRIMARY_SOURCES.map((s) => (
            <tr key={s.href}>
              <td>
                <a href={s.href} target="_blank" rel="noreferrer">
                  {s.name}
                </a>
              </td>
              <td>{s.scope}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Date-stamped, current-year values</h2>
      <p>
        Rules and dollar figures change — sometimes retroactively. Articles that depend on current-year numbers are
        marked for annual review, carry a “last reviewed” date, and either pull live values from the app’s parameter
        data or clearly stamp the year a figure applies to.
      </p>

      <h2>Simplifications are called out</h2>
      <p>
        RetireGolden models rules at planning precision, not return-filing precision. When an article describes something
        the engine simplifies or omits, it says so, so you know where to verify a number that matters against the
        official source.
      </p>

      <h2>Reviews</h2>
      <p>
        Each article declares a review cadence: <strong>annual</strong> for current-year-sensitive topics,{' '}
        <strong>rule-change</strong> for topics that move only when a law changes, and <strong>stable</strong> for
        evergreen concepts. The last-reviewed date on each article reflects its most recent check.
      </p>

      <p className="muted small">
        See the full <Link to="/disclaimer">disclaimer</Link> for the authoritative legal terms.
      </p>
    </article>
  )
}
