/** The full disclaimer, linked from the navigation and the plan picker. */

import { Link } from 'react-router-dom'

import { PARAMETER_DATA_AS_OF, PARAMETER_DATA_BASIS } from '../engine/params'
import { ProvenancePanel } from './ProvenancePanel'

export function DisclaimerPage() {
  return (
    <article className="page" style={{ maxWidth: '46rem', margin: '0 auto', textAlign: 'left' }}>
      <h1>Disclaimer</h1>
      <p className="lede">Please read this before relying on anything RetireGolden shows you.</p>

      <h2>Educational use only</h2>
      <p>
        RetireGolden is an educational modeling tool. It is <strong>not</strong> tax advice, legal advice, investment
        advice, accounting advice, insurance advice, or medical advice, and nothing it produces creates an
        advisor–client relationship of any kind. Decisions about retirement, Social Security claiming, Roth
        conversions, withdrawals, healthcare coverage, or anything else with real-world consequences should be made
        with qualified professionals who know your full situation.
      </p>

      <h2>Models are simplifications</h2>
      <ul>
        <li>Projections depend entirely on your inputs and assumptions. Small changes in returns, inflation, or longevity produce very different outcomes.</li>
        <li>Monte Carlo success rates are statistics about a simplified model, not probabilities about your actual life.</li>
        <li>The tax engine covers common federal rules (brackets, Social Security taxation, capital-gains stacking, RMDs, IRMAA, ACA credits) at planning precision — not return-filing precision. State income tax models each state's brackets, standard deduction, Social Security treatment, and major retirement-income exclusions, with a flat-rate override for corrections; credits, local/city taxes, and income-tested exclusions are simplified or omitted. Many real-world provisions are approximated.</li>
        <li>Life-expectancy estimates are population statistics with coarse lifestyle adjustments — they say nothing certain about any individual.</li>
        <li>Historical market data in the bootstrap models is approximate and the past does not predict the future.</li>
      </ul>

      <h2>Rules change</h2>
      <p>
        Tax law, contribution limits, Medicare premiums, ACA subsidies, and Social Security rules change frequently —
        sometimes retroactively. Parameter tables here are updated on a best-effort basis and may be out of date or
        wrong. Verify any number that matters against official sources (irs.gov, ssa.gov, medicare.gov,
        healthcare.gov).
      </p>
      <p>
        <strong>Tax data as of {PARAMETER_DATA_AS_OF}</strong>, reflecting {PARAMETER_DATA_BASIS}. Figures for later
        years carry these rules forward (so bracket creep is modeled, but scheduled future rate changes are not) until
        the next refresh.
      </p>

      <h2>Where the numbers come from</h2>
      <p>
        These are the defaults the engine applies. They are summaries at planning precision — see each linked source
        for the authoritative figures. For the harnesses that check the engine itself against independent
        implementations, see <Link to="/how-tested">How RetireGolden is tested</Link>.
      </p>
      <ProvenancePanel />

      <h2>Your data stays with you</h2>
      <p>
        RetireGolden has no server-side storage and no accounts. Everything you enter lives only in this browser
        (IndexedDB and localStorage) and is never transmitted anywhere. That also means <strong>we cannot recover it</strong>:
        clearing your browser data, switching devices, or using the "Clear all data" button erases it permanently.
        Download a plan backup from the planner home if you want to keep or move your plans.
      </p>

      <h2>No warranty</h2>
      <p>
        The software is provided "as is", without warranty of any kind, express or implied, including fitness for a
        particular purpose. Calculations may contain errors. You bear all responsibility for decisions made using
        this tool.
      </p>

      <h2>Software license &amp; third-party notices</h2>
      <p>
        RetireGolden is free and open-source software, licensed under the{' '}
        <a href="https://www.gnu.org/licenses/agpl-3.0.html" target="_blank" rel="noopener noreferrer">
          GNU Affero General Public License v3.0 (AGPL-3.0)
        </a>
        . © 2026 RetireGolden, LLC. "RetireGolden" and the RetireGolden logo are trademarks of RetireGolden, LLC.
        The source code is available on{' '}
        <a href="https://github.com/RetireGolden/RetireGolden" target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
        . It bundles third-party packages (React, Recharts, HiGHS-WASM, Zod, and their dependencies) distributed
        under their respective permissive licenses — see the{' '}
        <a href="/THIRD-PARTY-NOTICES.txt" target="_blank" rel="noopener noreferrer">
          full third-party notices
        </a>
        .
      </p>
    </article>
  )
}
