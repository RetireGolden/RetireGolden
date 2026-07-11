/**
 * "How RetireGolden is tested" (trust-and-transparency-layer, step 5): the
 * in-app validation story — one auditable ledger, external-oracle golden
 * suites, the independent-optimizer parity harness, the asset-location
 * invariance guarantee, and the simplifications stated as plainly as the
 * strengths. Harness counts are derived from the source tree at build time
 * (`import.meta.glob` keys), so they cannot go stale.
 */

import { Link } from 'react-router-dom'

// Sibling-workspace globs (engine, app harness tests) resolve when this file
// is built inside the RetireGolden monorepo — retiregolden.app's build. In an
// external consumer of the published package they match nothing (the tarball
// ships without test files), so the counts degrade to zero rather than lie.
/** Suites checked against third-party implementations that share no code with RetireGolden. */
const EXTERNAL_ORACLE_SUITES = Object.keys(
  import.meta.glob(['../**/*.external.golden.test.ts', '../../../engine/src/**/*.external.golden.test.ts']),
)
/** All golden suites (fixed expected-value fixtures), external and internal. */
const GOLDEN_SUITES = Object.keys(
  import.meta.glob(['../**/*.golden.test.ts', '../../../engine/src/**/*.golden.test.ts']),
)
/** Every automated test file in the source tree (planner-ui + engine + app harness). */
const ALL_TEST_FILES = Object.keys(
  import.meta.glob([
    '../**/*.test.{ts,tsx}',
    '../../../engine/src/**/*.test.ts',
    '../../../../app/src/**/*.test.{ts,tsx}',
  ]),
)

/** "federalTaxSocialSecurity.external.golden.test.ts" → "federal tax social security". */
function suiteName(path: string): string {
  const base = path.split('/').pop()!.replace(/\.external\.golden\.test\.ts$/, '')
  return base.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase()
}

// True when built inside the RetireGolden monorepo (retiregolden.app). A
// build from the published tarball has no test files to count, and a trust
// page must not report zeros as if the suites didn't exist — so counts and
// the pinned-suite list degrade to count-free prose plus a pointer at the
// upstream tree where they are derived.
const HAS_SUITE_DATA = ALL_TEST_FILES.length > 0

export function HowTestedPage() {
  return (
    <article className="page" style={{ maxWidth: '46rem', margin: '0 auto', textAlign: 'left' }}>
      <h1>How RetireGolden is tested</h1>
      <p className="lede">
        Retirement tools notoriously disagree — the same plan can score 60% in one tool and 90% in another, and most
        tools won't show you why. RetireGolden's answer is to show its work: what the engine computes, what it's checked
        against, and what it deliberately simplifies.
      </p>

      <h2>One auditable ledger</h2>
      <p>
        Every result — the success rate, the conversion recommendation, the "how much can I spend?" answer — comes from
        a single year-by-year ledger you can open and read on the Results page (or download as CSV). There is no
        separate "estimate" engine: Monte Carlo, the optimizer, and the reports all price against the same exact
        projection. If two numbers in RetireGolden ever disagree, that's a bug, not a methodology difference.
      </p>

      <h2>Checked against independent implementations</h2>
      <p>
        {HAS_SUITE_DATA ? `${EXTERNAL_ORACLE_SUITES.length} external-oracle` : 'External-oracle'} golden suites pin
        RetireGolden's calculations to third-party references that share no code with it:
      </p>
      <ul>
        <li>
          <strong>Federal &amp; state taxes</strong> — golden cases cross-checked against independent open tax engines
          (PolicyEngine-US and PSLmodels Tax-Calculator), covering brackets, Social Security taxability, and
          capital-gains stacking.
        </li>
        <li>
          <strong>Medicare/IRMAA, ACA, and RMDs</strong> — checked against the published CMS premium tables, the IRS
          applicable-percentage schedule, and the Pub 590-B life-expectancy tables.
        </li>
        <li>
          <strong>Social Security</strong> — benefit computation and claiming math validated against the SSA's
          published rules (bend points, actuarial factors, family maximums, survivor limits).
        </li>
      </ul>
      {HAS_SUITE_DATA && (
        <p className="muted small">
          Suites currently pinned: {EXTERNAL_ORACLE_SUITES.map(suiteName).join(' · ')}.
        </p>
      )}
      <p>
        The Roth-conversion optimizer additionally runs through a <strong>parity harness</strong>: a shared fixture
        matrix is solved both by RetireGolden and by an independent open-source conversion optimizer (pinned version),
        and both tools' schedules are priced on RetireGolden's own exact ledger. As of July 2026 the harness passes on
        every fixture, with RetireGolden's schedules ahead on projected after-tax estate. It re-runs on a maintenance
        cadence.
      </p>

      <h2>Recommendations are arbitrated, not trusted</h2>
      <p>
        No recommendation reaches you straight from a solver. Candidate schedules — including simple strategies like
        bracket-fill — are re-run through your full projection and ranked in a tournament; the winner must beat the
        alternatives on the exact ledger, and the "Why this recommendation?" panel on the optimizer page shows you the
        beaten alternatives and their dollar margins.
      </p>

      <h2>Asset-location invariance, proven</h2>
      <p>
        A known six-figure bug class in conversion tools: quietly assuming Roth dollars are invested more aggressively
        than traditional dollars, so "conversion benefit" is really a hidden allocation change. RetireGolden holds
        portfolio-wide asset allocation constant across account types, and a dedicated fixture suite
        (<code>assetLocationInvariance</code>) proves it: a tax-free conversion between identically-allocated accounts
        leaves every year's totals identical to the dollar, the entire estate benefit of a conversion is the tax term,
        and conversion candidates can never smuggle in an allocation change. If you deliberately allocate accounts
        differently, the engine prices that too — visibly, as your explicit setting.
      </p>

      <h2>Golden suites and regression gates</h2>
      <p>
        {HAS_SUITE_DATA ? (
          <>
            {GOLDEN_SUITES.length} golden suites hold fixed expected values for the tax engine, RMDs, Social Security,
            and full-plan projections, out of {ALL_TEST_FILES.length} automated test files overall.
          </>
        ) : (
          <>
            Golden suites hold fixed expected values for the tax engine, RMDs, Social Security, and full-plan
            projections.
          </>
        )}{' '}
        A deterministic case runner replays the whole example-plan library and diffs engine output on every change, so
        unintended result drift is caught before it ships. New engine features land behind no-op defaults, guarded by
        "feature-off is byte-identical" regressions.
      </p>
      {!HAS_SUITE_DATA && (
        <p className="muted small">
          Suite counts and names are derived from the RetireGolden source tree at build time; this build was produced
          outside that tree, so they aren't shown here. The live suites are public at{' '}
          <a href="https://github.com/RetireGolden/RetireGolden">github.com/RetireGolden/RetireGolden</a>.
        </p>
      )}

      <h2>What RetireGolden deliberately simplifies</h2>
      <p>Honest scope beats false precision. RetireGolden is planning-grade, not filing-grade:</p>
      <ul>
        <li>The optimizer's in-solve model uses documented simplifications (for example, a single long-term-gains rate inside the solve); recommendations are then re-priced and validated on the exact ledger before you see them.</li>
        <li>Future-year tax parameters beyond published law are stand-ins: current rules carry forward with bracket indexation, but scheduled or speculative future law changes are not modeled.</li>
        <li>AMT is a planning screen, not a filing computation; per-lot basis and many credit phase-outs are simplified by design.</li>
        <li>Monte Carlo success rates are statistics about a simplified model of your plan — not probabilities about your actual life.</li>
      </ul>

      <h2>Where the inputs come from</h2>
      <p>
        Every tax and benefit parameter cites its source — see the{' '}
        <Link to="/disclaimer">full provenance table on the Disclaimer page</Link>. Inside a plan, the assumptions card
        enumerates every live assumption with its provenance and a copy-export, so you can replicate a run in another
        tool and see exactly why the answers differ.
      </p>
    </article>
  )
}
