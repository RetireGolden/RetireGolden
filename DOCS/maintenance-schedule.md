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
2. Update [domain/domain-rules-reference.md](domain/domain-rules-reference.md) with the new numbers and
   refresh the source links; bump the provenance dates (`engine/params/provenance.ts`).
3. Re-run the engine tests and any offline oracle fixtures (Owl / PolicyEngine / Open Social Security).
4. Review Learning Center articles flagged `currentYearSensitive` (see the last row) and bump their
   `lastReviewed`.

## Calendar refresh

Typical publication windows; verify the actual release each year. "Updates" points at where the value lives.

| Topic | Source | Publishes | Updates |
|-------|--------|-----------|---------|
| Federal tax brackets, standard + senior deduction | IRS Rev. Proc. (inflation adjustments) | Oct–Nov (next year) | `params/data/`, domain rules §1 |
| LTCG / qualified-dividend thresholds, NIIT (unindexed — confirm) | IRS | Oct–Nov | `params/data/`, domain rules §2 |
| Retirement contribution limits (401(k)/IRA/HSA, catch-ups, super catch-up) | IRS | Oct–Nov | `params/data/`, domain rules §5 |
| RMD ages/tables, QCD limit | IRS (SECURE 2.0) | Annual | `engine/rmd/`, `params/data/`, domain rules §6 |
| SS COLA, taxable wage base, earnings-test limits, SSDI SGA | SSA | October (COLA/wage base); January (SGA) | `params/data/`, `socialSecurity/ssaWageData.ts`, domain rules §4 |
| SS bend points & Average Wage Index | SSA | Annual (AWI lags ~2 yrs) | `socialSecurity/ssaWageData.ts`, domain rules §4 |
| SSA period life table | SSA / Trustees Report | Annual | `longevity/ssaPeriod2022.ts` (+ rename/citation) |
| Medicare Part B/D premiums + IRMAA brackets | CMS | Fall | `engine/tax/medicare.ts` params, domain rules §7 |
| Federal Poverty Level (drives ACA) | HHS | January | `engine/tax/aca.ts` params, domain rules §8 |
| ACA applicable-percentage table (premium tax credit) | IRS Rev. Proc. (§36B indexing) | ~July (prior year) | `params/data/` `aca` block, domain rules §8 — 2026 table confirmed against Rev. Proc. 2025-25 on 2026-07-08 |
| Marketplace premium benchmarks and LTC cost examples used in Learning Center guidance | KFF, CMS/HealthCare.gov, Fidelity, CareScout/Genworth | Annual / on new cost report | `learn/content/what-retirement-healthcare-really-costs.ts`, `learn/content/insurance-in-your-retirement-plan.ts`, domain rules §8 |
| Per-state income tax (brackets, deductions, exclusions, SS treatment) | State revenue depts; PolicyEngine-US; Tax Foundation cross-check | Annual | `params/state/`, [domain/state-tax-research/](domain/state-tax-research/) |
| Forward-looking plan assumptions (inflation, returns, healthcare-cost inflation) | SSA Trustees long-range assumptions; Fed/CBO/SPF inflation; Vanguard & J.P. Morgan capital-market assumptions; HealthView/CMS healthcare-cost projections | Annual (CMAs publish Q4; Trustees mid-year; HealthView early-year) | `engine/model/plan.ts` (`buildDefaultPlan`), domain rules §13, the **Assumptions** Learning Center articles |
| Asset-class defaults (returns, volatilities, yields, correlations) + embedded market history + stochastic model params | Damodaran (NYU Stern) annual returns dataset; MSCI EAFE history; index dividend/SEC yields; CMAs as a cross-check; model params (df, GARCH coeffs, regime probs, CAPE sens) from literature (re-validate annually) | Damodaran updates each January; model reval per plan | `engine/allocation/assetClasses.ts`, `engine/montecarlo/historicalReturns.ts`, `engine/montecarlo/marketModels.ts`, domain rules §12/§15 |
| TIPS real-yield curve (income-floor ladder quotes + funded-ratio discounting) | U.S. Treasury Daily Par Real Yield Curve Rates | Published daily; snapshot refreshed annually with the packs (or when real yields move materially) | `params/data/realYieldCurve2026.ts` (rename per year), provenance id `real-yield-curve`; the "curve as of" date shows next to every quote |
| SPIA payout-rate planning table (annuitization sweep + purchase candidates) | Public quote aggregators (annuity.org life-only sheets, marketplace/insurer calculators) | Rates move with yields; refresh annually with the packs. Last re-anchored 2026-07-15. **Hard items for the next refresh:** replace the extrapolated age-85 anchor and the placeholder QLAC deferred rate with quoted rates | `engine/decisions/spiaQuotes.ts`, domain rules §19 |
| HECM principal-limit factors + line/loan growth default | HUD HECM PLF tables (as summarized by reverse-mortgage references) | HUD revises factor tables occasionally; expected rates move with rates | `params/data/` `hecm` block, provenance id `hecm-plf`, domain rules §19 |
| Actuarial longevity guidance | SSA period life table; Academy of Actuaries / SOA Longevity Illustrator | ~Annual / on table refresh | `longevity/`, domain rules §13, `assumption-longevity-planning-age` |
| Learning Center rule-heavy articles | The article's own `sourceUrls` | Match each article's `reviewCadence` (`annual` for `currentYearSensitive`) | `learn/content/`, bump `lastReviewed` |
| Competitive landscape (pricing, tiers, features) | Vendor sites | ~Annual or on change | `competitive-analysis` (private planning docs) |
| Open-source oracle landscape | Project repos/releases | ~Annual | `open-source-landscape` (private planning docs) |

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
| **Third-party notices** | Every MIT/ISC/0BSD package bundled in the shipped app must be attributed. New or upgraded production dependencies change the set. | Re-run `npm run licenses` (`app/scripts/generate-third-party-notices.mjs`) and re-ship the regenerated `app/public/THIRD-PARTY-NOTICES.txt`; confirm no copyleft entered the tree |

## Quick check: "is the app still current?"

If today is past **December** and no new-year parameter pack exists, the calendar refresh is overdue. Spot
checks: the latest `params/data/yearXXXX.ts` should match the upcoming tax year; the SS COLA and Part B
premium in domain rules §4/§7 should match the most recent SSA/CMS announcement; and no `currentYearSensitive`
Learning Center article should have a `lastReviewed` more than ~12 months old.
