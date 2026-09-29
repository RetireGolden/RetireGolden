/**
 * "How RetireGolden is tested" (trust-and-transparency-layer, step 5): the
 * in-app validation story — one auditable ledger, external-oracle golden
 * suites, the independent-optimizer parity harness, the asset-location
 * invariance guarantee, and the simplifications stated as plainly as the
 * strengths. Harness counts are derived from the source tree at build time,
 * so they cannot go stale (./howTestedSuites.ts).
 */

import { Link } from 'react-router'

import { howTestedSummaryFromGlob } from './howTestedGlob'
import { NO_SUITE_DATA, type HowTestedSummary } from './howTestedSuites'

/** Injected by app/vite.config.ts (`define`); absent in any other build. */
declare const __RG_HOW_TESTED__: HowTestedSummary | undefined

// A development build (vitest, the dev server) globs the tree through
// import.meta.glob. A production build reads the summary the app's Vite config
// computed with the same patterns, so the chunk ships three numbers and eight
// names rather than ~960 test-file paths. A production build without the
// injection (another host building the published package) has no counts.
const SUMMARY: HowTestedSummary = import.meta.env.DEV
  ? howTestedSummaryFromGlob()
  : typeof __RG_HOW_TESTED__ === 'undefined'
    ? NO_SUITE_DATA
    : __RG_HOW_TESTED__

// True when built inside the RetireGolden monorepo (retiregolden.app). A
// build from the published tarball has no test files to count, and a trust
// page must not report zeros as if the suites didn't exist — so counts and
// the pinned-suite list degrade to count-free prose plus a pointer at the
// upstream tree where they are derived.
const HAS_SUITE_DATA = SUMMARY.testFileCount > 0

export function HowTestedPage() {
  return (
    <article className="page" style={{ maxWidth: '48rem', margin: '0 auto', textAlign: 'left' }}>
      {/* Reached from the Disclaimer; give it a chrome way back, not only the
          mid-prose provenance link (#419). */}
      <Link to="/disclaimer" className="page-back">
        ← Disclaimer
      </Link>
      <h1>How RetireGolden is tested</h1>
      <p className="lede">
        Retirement tools disagree with each other all the time. The same plan can score 60% in one tool and 90% in
        another, and most tools won't show you why. RetireGolden shows its work instead: what the engine computes,
        what it's checked against, and what it deliberately simplifies.
      </p>

      <h2>One auditable ledger</h2>
      <p>
        Every result comes from a single year-by-year ledger you can open and read on the Results page, or download as
        CSV. That includes the success rate, the conversion result, and the "how much can I spend?" answer. There is no
        separate "estimate" engine: Monte Carlo, the optimizer, and the reports all price against the same projection.
        If two numbers in RetireGolden ever disagree, that's a bug, not a methodology difference.
      </p>

      <h2>Checked against independent implementations</h2>
      <p>
        {HAS_SUITE_DATA ? `${SUMMARY.externalOracleSuites.length} external-oracle` : 'External-oracle'} suites pin
        RetireGolden's calculations to third-party references that share no code with it:
      </p>
      <ul>
        <li>
          <strong>Federal &amp; state taxes:</strong> fixed cases cross-checked against independent open tax engines
          (PolicyEngine-US and PSLmodels Tax-Calculator), covering brackets, Social Security taxability, and
          capital-gains stacking.
        </li>
        <li>
          <strong>Medicare/IRMAA, ACA, and RMDs:</strong> checked against the published CMS premium tables, the IRS
          applicable-percentage schedule, and the Pub 590-B life-expectancy tables.
        </li>
        <li>
          <strong>Social Security:</strong> benefit computation and claiming math validated against the SSA's
          published rules (bend points, actuarial factors, family maximums, survivor limits).
        </li>
      </ul>
      {HAS_SUITE_DATA && (
        <p className="muted small">
          Suites currently pinned: {SUMMARY.externalOracleSuites.join(' · ')}.
        </p>
      )}
      <p>
        The Roth-conversion optimizer additionally runs through a <strong>parity check</strong>: a shared matrix of
        test plans is solved both by RetireGolden and by an independent open-source conversion optimizer (pinned
        version), and both tools' schedules are priced on RetireGolden's own year-by-year projection. As of July 2026
        the check passes on every test plan, with RetireGolden's schedules ahead on projected after-tax estate. It
        re-runs on a maintenance cadence.
      </p>

      <h2>Recommendations are arbitrated, not trusted</h2>
      <p>
        No result reaches you straight from a solver. Candidate schedules, including simple strategies like
        bracket-fill, are re-run through your full projection and ranked in a tournament. The winner has to beat the
        alternatives on the full year-by-year projection, and the "Why this recommendation?" panel on the optimizer
        page shows you the beaten alternatives and their dollar margins.
      </p>

      <h2>Asset-location invariance, proven</h2>
      <p>
        A known six-figure bug class in conversion tools: quietly assuming Roth dollars are invested more aggressively
        than traditional dollars, so "conversion benefit" is really a hidden allocation change. RetireGolden holds
        portfolio-wide asset allocation constant across account types, and a dedicated test suite
        (<code>assetLocationInvariance</code>) proves it: a tax-free conversion between identically-allocated accounts
        leaves every year's totals identical to the dollar, the entire estate benefit of a conversion is the tax term,
        and conversion candidates can never smuggle in an allocation change. If you deliberately allocate accounts
        differently, the engine prices that too, visibly, as your explicit setting.
      </p>

      <h2>Fixed expected values, checked on every change</h2>
      <p>
        {HAS_SUITE_DATA ? (
          <>
            {SUMMARY.goldenSuiteCount} suites hold fixed expected values for the tax engine, RMDs, Social Security,
            and full-plan projections, out of {SUMMARY.testFileCount} automated test files overall.
          </>
        ) : (
          <>
            Test suites hold fixed expected values for the tax engine, RMDs, Social Security, and full-plan
            projections.
          </>
        )}{' '}
        A deterministic case runner replays the whole example-plan library and diffs engine output on every change, so
        unintended result drift is caught before it ships. New engine features ship switched off by default, and a
        test proves that a plan built before the feature existed still produces exactly the same numbers.
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
        <li>The optimizer's in-solve model uses documented simplifications (for example, a single long-term-gains rate inside the solve); recommendations are then re-priced and validated on the full year-by-year projection before you see them.</li>
        <li>Future-year tax parameters beyond published law are stand-ins: current rules carry forward with bracket indexation, but scheduled or speculative future law changes are not modeled.</li>
        <li>AMT is a planning screen, not a filing computation; per-lot basis and many credit phase-outs are simplified by design.</li>
        <li>Monte Carlo success rates are statistics about a simplified model of your plan, not probabilities about your actual life.</li>
      </ul>

      <h2>Where the inputs come from</h2>
      <p>
        Every tax and benefit parameter cites its source. See the{' '}
        <Link to="/disclaimer">full provenance table on the Disclaimer page</Link>. Inside a plan, the assumptions card
        enumerates every live assumption with its provenance and a copy-export, so you can replicate a run in another
        tool and see exactly why the answers differ.
      </p>
    </article>
  )
}
