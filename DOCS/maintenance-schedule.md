# Maintenance & re-research schedule

RetireGolden models current law with current-year numbers. Those numbers change every year, and some rules
change on legislative timelines. This is the schedule for keeping the parameter packs, the domain rules,
and the Learning Center current so the app doesn't silently drift into being a 2026 time capsule.

**Last full review: June 2026.** Two kinds of upkeep: a **calendar refresh** (most figures publish each
fall for the next tax year) and an **event-driven watch-list** (legislation that flips a rule or a default).

## How a refresh lands

The annual refresh is a **data change, not a code change** (that's the point of params-as-data):

1. Add a new dated parameter pack for the year under `packages/engine/src/params/data/` (federal) and
   `packages/engine/src/params/state/` (states), copying forward and updating the published figures.
2. Update the affected sections under [domain/domain-rules-reference/](domain/domain-rules-reference/)
   with the new numbers and refresh the source links — edit the section files, not the
   [index](domain/domain-rules-reference.md); bump the provenance dates
   (`engine/params/provenance.ts`).
3. Re-run the engine tests and any offline oracle fixtures (Owl / PolicyEngine / Open Social Security).
4. Run `pnpm verify:quotes` and work the ledger. It re-fetches every source the tax rule registry cites
   and checks each `quotedText` against it — the one check that catches a citation whose page moved under
   it, or a quote that drifted into paraphrase. Needs network, so it is manual and never a CI gate:
   [operations/quote-fidelity.md](operations/quote-fidelity.md).
5. Review Learning Center articles flagged `currentYearSensitive` (in
   `packages/planner-ui/src/testSupport/articleEditorial.ts`; see the last row) and bump their
   `lastReviewed`.

## Calendar refresh

Typical publication windows; verify the actual release each year. "Updates" points at where the value lives.

| Topic | Source | Publishes | Updates |
|-------|--------|-----------|---------|
| Federal tax brackets, standard + senior deduction | IRS Rev. Proc. (inflation adjustments) | Oct–Nov (next year) | `params/data/`, domain rules §1 |
| LTCG / qualified-dividend thresholds, NIIT (unindexed — confirm) | IRS | Oct–Nov | `params/data/`, domain rules §2 |
| Retirement contribution limits (401(k)/IRA, catch-ups, super catch-up) | IRS | Oct–Nov | `params/data/`, domain rules §5 |
| HSA contribution limits (self-only, family) | IRS Rev. Proc. | May (next year) | `params/hsaLimitYears.ts`, domain rules §5. Add the next year's block as soon as the May revenue procedure appears (2027: Rev. Proc. 2026-24); the $1,000 catch-up is statutory and stays in the pack |
| State figures already enacted for a later year | State legislatures | Any time | `params/state/data/enacted<year>.ts` (one module per enacted year, 2027 to 2033 today; any state field, and a field named as null ends). Load a change with no condition; load a change whose only condition is a pending vote as current law and name the vote and its date in the record; add a conditional change only once its determination is published (dates in [Dated state tax decisions](#dated-state-tax-decisions)). Retire a year once its full state pack exists |
| RMD ages/tables, QCD limit | IRS (SECURE 2.0) | Annual | `engine/rmd/`, `params/data/`, domain rules §6 |
| SS COLA, taxable wage base, earnings-test limits, SSDI SGA | SSA | October (COLA/wage base); January (SGA) | `params/data/`, `socialSecurity/ssaWageData.ts`, domain rules §4 |
| SS bend points & Average Wage Index | SSA | Annual (AWI lags ~2 yrs) | `socialSecurity/ssaWageData.ts`, domain rules §4 |
| SSA period life table | SSA / Trustees Report | Annual | `longevity/ssaPeriodLifeTable.ts` (the columns and the source record; the file name carries no edition), its worksheet `DOCS/calculations/longevity/ssa-period-life-table.md`; the record `ssa-table-4c6-period-life-table-vintage` comes due yearly (`rules:due`) and its quote stops matching when SSA posts the next edition (`verify:quotes`) |
| Medicare Part B/D premiums + IRMAA brackets | CMS | Fall | `engine/tax/medicare.ts` params, domain rules §7 |
| Federal Poverty Level (drives ACA) | HHS | January | `params/acaCoverageYears.ts`, domain rules §8. The guidelines published in January of year Y are the poverty line for coverage year Y + 1 (26 U.S.C. 36B(d)(3)(B), 26 CFR 1.36B-1(h)): add them to the next coverage year's block, never to the income-tax pack of their own year; used as published, never inflated |
| ACA applicable-percentage table (premium tax credit) | IRS Rev. Proc. (§36B indexing) | ~July (prior year) | `params/acaCoverageYears.ts`, domain rules §8. A coverage year is priced once its table and guidelines are both in its block, before its income-tax pack is published (it then reports `income-tax-parameters-projected`); when that year's full pack lands it must reference the block, which `acaCoverageYears.test.ts` enforces. 2026 table confirmed against Rev. Proc. 2025-25 on 2026-07-08; 2027 table added from Rev. Proc. 2026-26 on 2026-09-26 |
| Marketplace premium benchmarks and LTC cost examples used in Learning Center guidance | KFF, CMS/HealthCare.gov, Fidelity, CareScout/Genworth | Annual / on new cost report | `learn/content/what-retirement-healthcare-really-costs.ts`, `learn/content/insurance-in-your-retirement-plan.ts`, domain rules §8 |
| Per-state income tax (brackets, deductions, exclusions, SS treatment) | **Own-state DOR, statutes and forms — the only authority** ([TEMPLATE.md § Sourcing rules](domain/state-tax-research/TEMPLATE.md)). PolicyEngine-US and Tax Foundation are change-detectors and cross-checks, never the cited source | Annual, **plus a January staleness sweep** against Tax Foundation's "State Tax Changes Taking Effect January 1" — states on legislated ramps (GA, IN, MS, MT, NE, NC, OK, SC as of 2026) go stale mid-cycle and must never be held forward (lesson from the 2026-07 sweep). The sweep says *which states to go and re-read*; the new figure still has to come from the state. The TF Jan-1 article also misses **post-January enactments** (SC H.4216, signed 2026-03-30, rewrote TY2026 retroactively; **WV SB 392 / §11-21-4j**, signed 2026-03-31, effective 2026-06-12, retroactive to 2026-01-01 — rates 2.11%–4.58%), so the sweep must check state DOR news pages for the current tax year regardless. **Rhode Island:** re-read the annual ADV inflation-adjustment release each autumn for TY2026+ deduction and schedule figures (`ri-dot-adv-2025-22-2026-deduction-and-rate-schedule`). **Hawaii:** the §235-2.4(a)(2)(G) to (I) standard-deduction steps (2028, 2030, 2031) and the Act 24 (SLH 2026) rate tables for 2027 and 2029 are loaded as enacted figures (`hi-hrs-235-2-4-a-2-g-to-i-standard-deduction-steps`, `hi-act-24-2026-rate-schedules`); re-read §235-2.4 and §235-51 whenever the legislature amends them again. **Michigan:** re-read the annually indexed ordinary retirement ceiling and current Guide/RAB qualification, election, and return-ceiling language each year (do not bake a future dollar into this schedule). **Maine:** re-read the July MRS Form 1040ES-ME instructions each year for the published pension-income maximum per person before the §5122(2)(M-2) gross SS/RRB offset and M-3 phaseout figures the pack still omits (`me-mrs-36-5122-2-m2-m3-2026-pension-deduction`) | `params/state/`, [domain/state-tax-research/](domain/state-tax-research/) |
| Forward-looking plan assumptions (inflation, returns, healthcare-cost inflation) | SSA Trustees long-range assumptions; Fed/CBO/SPF inflation; Vanguard & J.P. Morgan capital-market assumptions; HealthView/CMS healthcare-cost projections | Annual (CMAs publish Q4; Trustees mid-year; HealthView early-year) | `engine/model/plan.ts` (`buildDefaultPlan`), domain rules §13, the **Assumptions** Learning Center articles |
| Asset-class defaults (returns, volatilities, yields, correlations) + embedded market history + stochastic model params | Damodaran (NYU Stern) annual returns dataset; MSCI EAFE history; index dividend/SEC yields; CMAs as a cross-check; model params (df, GARCH coeffs, regime probs, CAPE sens) from literature (re-validate annually) | Damodaran updates each January; model reval per plan | `engine/allocation/assetClasses.ts`, `engine/montecarlo/historicalReturns.ts`, `engine/montecarlo/marketModels.ts`, domain rules §12/§15 |
| TIPS real-yield curve (income-floor ladder quotes + funded-ratio discounting) | U.S. Treasury Daily Par Real Yield Curve Rates | Published daily; snapshot refreshed annually with the packs (or when real yields move materially) | `params/data/realYieldCurve2026.ts` (rename per year), provenance id `real-yield-curve`; the "curve as of" date shows next to every quote |
| SPIA payout-rate planning table (annuitization sweep + purchase candidates) | Public quote aggregators (annuity.org life-only sheets, marketplace/insurer calculators) | Rates move with yields; refresh annually with the packs. Last re-anchored 2026-07-15. **Hard items for the next refresh:** replace the extrapolated age-85 anchor and the placeholder QLAC deferred rate with quoted rates | `engine/decisions/spiaQuotes.ts`, domain rules §19 |
| HECM principal-limit factors + line/loan growth default; HUD MCA / initial+annual MIP for validated mode | HUD HECM PLF tables; HUD Mortgagee Letter MCA ceiling (e.g. ML 2025-22 for 2026) | HUD revises factor tables and MCA occasionally; expected rates move with rates | `params/data/` `hecm` block (`maximumClaimAmount`, `initialMipPct`, `annualMipPct`), provenance id `hecm-plf`, domain rules §19. The Plan must carry a verified transaction kind; only ordinary originations use the validated path. Do not invent MCA/MIP or transaction form in shared logic. |
| Actuarial longevity guidance | SSA period life table; Academy of Actuaries / SOA Longevity Illustrator | ~Annual / on table refresh | `longevity/`, domain rules §13, `assumption-longevity-planning-age` |
| Learning Center rule-heavy articles | The article's own `sourceUrls` | Match each article's `reviewCadence` (`annual` for `currentYearSensitive`; both in `testSupport/articleEditorial.ts`) | Prose in `learn/content/`; bump `lastReviewed` on the article's entry in `learn/articleIndex.ts` |
| Competitive landscape (pricing, tiers, features) | Vendor sites | ~Annual or on change | `competitive-analysis` (private planning docs) |
| Open-source oracle landscape | Project repos/releases | ~Annual | `open-source-landscape` (private planning docs) |

## Dated state tax decisions

From the survey of all 51 jurisdictions on 2026-09-28 (decision D-2027-PUBLISHED-FIGURES). Each row is a
change the engine does **not** apply yet, or applies with a vote pending, and the date it is decided. On
that date, read the determination or result at the state's own source, then load it in
`params/state/data/` (a later-year step goes in `enacted<year>.ts`) with its rule record, or remove the
loaded entry, and restate `state-enacted-tax-year-figures` in `rules/calculations/taxes.ts`. The survey
tables and sources are recorded state by state under [domain/state-tax-research/](domain/state-tax-research/).

| Date | State | What is decided | Action |
|------|-------|-----------------|--------|
| 2026-10-01 | Colorado | Executive director's TABOR estimate (C.R.S. 39-22-627): whether the temporary rate cut below 4.40% applies to 2026 | If triggered, load the reduced 2026 rate |
| 2026-11-03 | Washington | Initiative 645 would repeal the 9.9% income tax from 2028 (ESSB 6346, chapter 238, Laws of 2026), which is **loaded** | If it passes, remove the Washington entry in `enacted2028.ts` and end `wa-essb-6346-2028-income-tax` |
| 2026-11-03 | California | Proposition 3 would keep the 10.3%, 11.3% and 12.3% bands past 2030, whose end from 2031 is **loaded** (Cal. Const. art. XIII, sec. 36(f)(2)) | If it passes, remove the California entry in `enacted2031.ts` and end `ca-const-art-13-sec-36-f-2-top-bands-end-2031` |
| about 2026-11-11 | District of Columbia | D.C. Act 26-416 (emergency, effective 2026-08-13, no more than 90 days) lapses; its deduction, which the engine loads, stays in force only through a further emergency act or the permanent act | Check for a further emergency act |
| about 2026-11-20 | District of Columbia | Projected law date of D.C. Act 26-418 after congressional review: $15,000 / $22,500 / $30,000 basic deduction plus the 63(c)(3) amount for 2026 to 2029, indexed from 2025, federal from 2030 | If it becomes law, nothing changes, and restate `dc-code-47-1801-04-3a-standard-deduction-2026-2029` on the permanent act; if disapproved and no emergency act follows, return DC to the federal deduction |
| 2027-01 | Maryland | The 2026 Form 502 instructions print the 2026 standard deduction, which the statute leaves to the Comptroller: the withholding guide prints $3,400 single, the April 2026 estimated-tax worksheet $3,350 and $6,700 | Load the printed amounts and settle `md-tg-10-217-2026-indexed-standard-deduction` |
| 2026-12-01, then each December 1 | Georgia | Office of Planning and Budget determination under HB 463: the rate cut, standard deduction and dependent exemption steps | Load the steps the determination triggers; the 2027 rate stays at 2026's until then |
| 2026-12-15 | Minnesota | Commissioner's determination of the one-year first-tier cut (Minn. Stat. 290.036) | Load for the year it names |
| 2026-12 (preliminary), 2027-02 (final) | Oklahoma | State Board of Equalization finding for the quarter-point cuts (68 O.S. 2355), for 2028 at the earliest | Load the cut once the final finding triggers it |
| 2027-01 | Michigan | Revenue conference: the one-year cut below 4.25% (MCL 206.51) | Load for the year it names |
| 2027-02-15 | South Carolina | Board of Economic Advisors forecast in effect: the top-rate cut (S.C. Code 12-6-510(C)(2)) | Load the 2027 rate; it stays at 2026's until then |
| Not yet published | Kansas, Missouri, West Virginia | Kansas's August 15 determination (K.S.A. 79-32,110c), Missouri's top-rate cut (RSMo 143.011.4), West Virginia's August 15, 2026 determination (W. Va. Code 11-21-4h) | Check each month; load when published |
| Final 2027 forms | Nebraska | The 2027 indexed thresholds (draft only on 2026-09-28); the 3.99% rate is loaded | Replace the 2026 thresholds held for 2027 |
| Agency publication, usually October to January | Ohio, Montana, North Dakota, Oregon, Maine, Rhode Island, Arizona, California, Idaho, Maryland, Illinois, and the other states `neb-rev-stat-77-2715-03-3-indexed-brackets-held-nominal` lists | Indexed figures held nominally at the latest published amount: Montana's breaks from 2028, Rhode Island's surtax threshold from 2028 and Social Security limits, Maryland's deduction from 2027, Illinois's exemption for 2027 and 2028, and each other state's indexed brackets and deductions. Washington's deduction is projected on its statute's schedule and needs no load; check the Department of Revenue's October 2029 figure against the projection, which applies it to tax year 2029 (`wa-essb-6346-s316-standard-deduction-indexing`, unsettled; settle the record then) | Load each year's figures as published |
| Later triggers | Indiana, Mississippi, North Carolina | Indiana's 0.05-point cuts from 2030 on a budget agency determination (IC 6-3-2-1(b)(9) to (15)); Mississippi's cuts from 2031 when the reserve fund is full (2025 H.B. 1, section 2); North Carolina's cuts to 2.49% from 2035 on revenue triggers (G.S. 105-153.7(a1)) | Re-read each year before the first trigger year |

## Event-driven watch-list

These don't follow the calendar — watch for the legislative or actuarial trigger, then act.

| Watch | Why it matters | Action when it changes |
|-------|----------------|------------------------|
| **ACA enhanced credits / 400% FPL cliff** | Enhanced credits expired end of 2025; the hard cliff is a major early-retiree constraint. Congress could restore them. | Update `aca.ts` params + the "credits extended?" assumption toggle; revise domain rules §8 |
| **Social Security solvency** | OASDI trust fund projected to deplete ~2034 (~83% of benefits payable per the 2026 Trustees Report). Any reform changes the default. | Update `TRUSTEES_DEFAULT_SS_HAIRCUT` in `engine/params` (single source for the toggle default, scenario chip, and example plans); refresh `learn/content/assumption-social-security-trust-fund.ts` and `learn/content/understanding-your-plan-assumptions.ts`; domain rules §4 |
| **OBBBA senior deduction sunset (2028)** | The $6,000/person senior deduction is legislated for tax years 2025–2028 only. | When 2029 approaches, remove/extend per law; domain rules §1; it's a big Roth-conversion interaction |
| **TCJA rate structure** | Made permanent by OBBBA (July 2025); a future Congress could change rates again. | Re-rate brackets in `params/data/` if amended |
| **SECURE 2.0 phase-ins** | RMD start age rises to 75 for those born 1960+ (from 2033); Roth catch-up mandate for >$150k wages. | Confirm `rmd/` cohort logic and contribution rules each year |
| **WEP/GPO** | Repealed Jan 2025 (Social Security Fairness Act); the app no longer models them. | Only revisit if reinstated (unlikely) |
| **License / open-sourcing** | **Decided: AGPL-3.0** for the public repository (2026-07-08); applied to the root `LICENSE` at the RetireGolden repo cut. The commercial desktop edition is dual-licensed by the LLC (CLA required for contributions). | On any license-posture change: update the root `LICENSE`, [code-map.md](code-map.md), and `CONTRIBUTING.md`/`TRADEMARKS.md` |
| **Third-party notices** | Every MIT/ISC/0BSD package bundled in the shipped app must be attributed. New or upgraded production dependencies change the set. | Re-run `pnpm run licenses` (`app/scripts/generate-third-party-notices.mjs`) and re-ship the regenerated `app/public/THIRD-PARTY-NOTICES.txt`; confirm no copyleft entered the tree |

## Quick check: "is the app still current?"

If today is past **December** and no new-year parameter pack exists, the calendar refresh is overdue. Spot
checks: the latest `params/data/yearXXXX.ts` should match the upcoming tax year; the SS COLA and Part B
premium in domain rules §4/§7 should match the most recent SSA/CMS announcement; and no `currentYearSensitive`
Learning Center article should have a `lastReviewed` more than ~12 months old.
