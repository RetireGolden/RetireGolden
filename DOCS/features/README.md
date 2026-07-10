# Feature catalog

What RetireGolden does today, by module — the index to the planner's capabilities. Each module notes
where it lives in code; deeper "how it works and why" docs sit alongside this file in `features/`.
Financial rules and current-year numbers are in
[domain-rules-reference.md](../domain/domain-rules-reference.md).

**Deep dives:** [social-security.md](social-security.md) · [taxes.md](taxes.md) ·
[roth-and-withdrawals.md](roth-and-withdrawals.md) ·
[monte-carlo-and-scenarios.md](monte-carlo-and-scenarios.md) · [insurance.md](insurance.md) ·
[optimizer.md](optimizer.md) · [learning-center.md](learning-center.md) · [longevity.md](longevity.md) ·
[plan-file-format.md](plan-file-format.md) · [imports-and-migration.md](imports-and-migration.md)

**Code:** pure engine in `app/src/engine/` (model/params/tax/rmd/strategies/projection/montecarlo/
scenarios/decisions/spending/ladder/insights); Social Security math in `app/src/socialSecurity/`; planner UI
in `app/src/planner/`; see [code-map.md](../code-map.md).

---

## 1. Household and profiles

1–2 adults; DOB, sex (longevity baseline), planned retirement date/age per person. Filing status
single or married-filing-jointly (MFS/HoH out of scope). State of residence drives state tax and can
change at a future year (mid-plan moves). Longevity per person produces a planning age (overridable);
the plan horizon runs to the later death age, with survivor years modeled after the first death
(filing status flips to single, survivor SS benefit, RMD changes). The planning age can also be set from
a **survival percentile** — "the age I/we have a 25% (or 10%) chance of reaching", single or joint
("either of us" for couples), from the SSA 2022 table
([engine/montecarlo/survival.ts](../../app/src/engine/montecarlo/survival.ts)) with an optional
proportional-hazards adjustment derived from the saved longevity questionnaire. The picked age is written
once with provenance (`longevity.source = 'percentile'`) and never silently recomputed; typing a number
still overrides. Children/dependents appear only as expense line items.

## 2. Accounts

Each account has an owner (a person; 401(k)/IRA/HSA are individual-only), balance, allocation or
expected return, and contribution/withdrawal rules.

Investable accounts (taxable/traditional/Roth/HSA) can opt into a **four-class asset allocation**
(US stocks / international stocks / bonds / cash) instead of a single expected return: growth becomes the
class-blended return, glidepaths (static / linear / staged / custom year targets) compile to per-year
targets, annual rebalancing trades back to target (realizing taxable gains through the basis machinery;
opt-out honored), a brokerage account's taxable yield follows the mix, and Monte Carlo shocks each class
with documented correlations. Class assumptions are an editable Assumptions-level table with sourced
defaults; accounts without an allocation are unchanged. Rules + sources:
[domain-rules-reference.md §15](../domain/domain-rules-reference.md). The decision engine's
`assetLocationGenerator` proposes bounded asset-location swaps (bonds → traditional, stocks →
taxable/Roth) as plan patches priced on the exact ledger. When multiple accounts opt into static allocation,
the Insights `asset-location` card previews the exact-ledger winner.

An account can also carry an optional **estate beneficiary destination** (spouse rollover / non-spouse heir /
charity %) that replaces the flat heir-tax haircut in the after-tax estate metric, and an annuity account can
carry an optional **purchase event** — trading liquid assets for guaranteed income mid-plan (SPIA or a
deferred **QLAC**), with exclusion-ratio taxation and, for a QLAC, its premium excluded from the RMD base.
The decision engine's `annuityPurchaseGenerator` proposes bounded purchase candidates (cover-the-floor SPIA /
QLAC-at-cap / no-purchase) on the same exact ledger. Rules + sources:
[domain-rules-reference.md §17](../domain/domain-rules-reference.md).

**Annuity depth v2 + pension and home-equity decisions** (2026-07-08, all opt-in/no-op-default;
[domain rules §19](../domain/domain-rules-reference.md)): annuities carry a **payout form** — life-only
(default), life with an N-year **period certain**, or **joint & survivor** with a chosen continuation share —
with non-qualified exclusion-ratio taxation extended per form
([engine/projection/annuityForms.ts](../../app/src/engine/projection/annuityForms.ts), planning-grade
Pub 939 approximations); **annuity ladders** (multiple dated purchases) are first-class, and the candidate
generator adds a laddered SPIA option. An **annuitization sweep** ("how much to annuitize?") runs a 0–30%
allocation grid through shared-path Monte Carlo against a sourced SPIA payout-rate table
([engine/decisions/spiaQuotes.ts](../../app/src/engine/decisions/spiaQuotes.ts); user quotes override) and
reports the success-vs-legacy frontier with allocation-matched glidepath controls (Kitces attribution).
Pensions can record a **lump-sum offer**; electing commutes the pension into a tax-free rollover in the
election year, with a decision view comparing the annuity's PV at a curve-anchored discount rate plus a
discount-rate × longevity sensitivity table
([engine/decisions/pensionElection.ts](../../app/src/engine/decisions/pensionElection.ts)). A primary
residence can opt into a **HECM line of credit** (buffer asset, Pfau): line sized from a lender quote or the
published HUD PLF pack, line and loan balance compounding, **coordinated** (draw after a down-market year) or
**last-resort** draw policies, non-recourse honored end to end. Insights detectors: `annuitization-headroom`,
`pension-election-pending`, `hecm-buffer-candidate`.

| Type | Key modeling details |
|------|----------------------|
| Taxable brokerage | Cost basis (single aggregate basis ratio, not per-lot); dividends/interest taxed annually (qualified vs ordinary); withdrawals realize gains via basis ratio; step-up at death |
| Traditional IRA / 401(k) / 403(b) | Pre-tax; RMDs per owner age (§7); early-withdrawal penalty pre-59½ (Rule of 55 / 72(t) modeled as SEPP); source of Roth conversions |
| Roth IRA / Roth 401(k) | Tax-free growth; no RMDs (Roth 401(k) RMD-free since 2024); 5-year/ordering rules surfaced as warnings |
| HSA | Pre-65 qualified-expense withdrawals tax-free; post-65 non-medical taxed as ordinary (no penalty) |
| Cash / savings | Interest taxed as ordinary; spending buffer |
| Pension (DB) | Start age, monthly amount, COLA yes/no/fixed %, survivor %; optional **lump-sum offer + election** (commutes to a tax-free traditional rollover — §19) |
| Annuity (SPIA-style) | Payout, start, COLA, taxable %; **payout forms** (life-only / period certain / joint & survivor — §19); optional mid-plan **purchase** (SPIA/QLAC) funded from another account, taxed by exclusion ratio (non-qualified) or fully (qualified) — §17; ladders of dated purchases |
| Home / real estate | Net-worth line; optional planned sale year (§121 exclusion); rental as income stream; optional **HECM line of credit** buffer on a primary residence (§19, non-recourse) |
| Debts / mortgage | Amortizing payment to payoff year; affects expenses, not investable assets |
| Equity comp (RSU/ESPP) | Brokerage-like holding (value + basis) with a vesting/availability date so locked funds aren't counted until vested |

## 3. Income streams

Wages/self-employment until each person's retirement date (drives FICA, contributions). **Social
Security** is the ported, deepened engine — PIA from earnings history (AIME → bend points) or quick PIA
entry, mySSA XML import, monthly claiming, spousal/survivor plus divorced-spousal and survivor records,
earnings test, and an optional trust-fund haircut toggle (~17% from 2034, user-adjustable). WEP/GPO are
**not modeled** — repealed January 2025. Pensions/annuities per §2; rental; one-time events
(inheritance, sale proceeds). Full detail: [social-security.md](social-security.md).

**TIPS income floor** (`plan.incomeFloor`, `engine/ladder/`, Income floor page): TIPS ladders as plan
artifacts delivering a level real income over a calendar window — an essential-spending floor or a
**Social Security bridge** (the SS Optimizer sizes one from the forgone age-62 benefit × gap years,
adds it in one click, and prices bridge + delayed claim vs claim-at-62 on the same ledger and seeded MC
paths; `bridgeLadderGenerator` proposes it to the decision engine). Rungs are solved back-to-front and
priced on an embedded Treasury real-yield curve (provenance `real-yield-curve`, annual refresh, "curve
as of" shown); purchase funding transfers out of cash/taxable (gains realized pro-rata) and cash flows
run through the ledger with real TIPS taxation — coupons + inflation accretion are federal ordinary
income (NIIT included) but **state-exempt** (`TaxYearInput.usGovernmentInterest`, 31 U.S.C. §3124);
maturing principal is a tax-free return; unmatured face rides in net worth. A **funded-ratio card**
(Results + Income floor) discounts required-floor spending and guaranteed income from the same ledger
years on the TIPS curve — Pfau's pension-accounting lens; `ss-bridge-gap` / `income-floor-funded`
Insights detectors surface the levers. Opt-in FedInvest CUSIP prices (the app's only network request;
cache-first; zero-network CSV import fallback) sanity-check quotes. Simplifications documented in
`engine/ladder/ladderMath.ts` (annual coupons, par rungs, planning-grade OID).

## 4. Spending model

Baseline annual spending (today's dollars), inflation-adjusted, with optional go-go / slow-go / no-go
retirement-phase multipliers at user-set ages. **Spending-shape presets** (constant-real / retirement
smile / retirement **smirk** (Blanchett-median −1%/yr real) / front-loaded travel / a custom annual real
delta) compile to ordinary phase rows the user can edit afterwards
([engine/spending/shapePresets.ts](../../app/src/engine/spending/shapePresets.ts)); the "How much can I
spend?" page can re-solve the plan **per shape** to show the initial-spending uplift each shape supports,
and also prices the published **SWR rules** (Bengen 4.7% / Morningstar 3.9% / ERN CAPE) on the user's own
ledger ([engine/decisions/swrComparator.ts](../../app/src/engine/decisions/swrComparator.ts)). An
opt-in **amortized spending policy** (`expenses.spendingPolicy.mode = 'abw'`; the ABW/VPW/TPAW family)
replaces the fixed baseline: each year's lifestyle target is the actual start-of-year portfolio amortized
over the remaining horizon at an expected real return (fixed / CAPE earnings yield / TIPS real yield) with
an optional spending tilt, funded through the normal tax cascade
([engine/spending/abw.ts](../../app/src/engine/spending/abw.ts)). **Spending guardrails** ration the
discretionary spending layer year by year — classic **Guyton-Klinger** withdrawal-rate bands, or
**risk-based guardrails** where cuts/raises trigger on real dollar-balance thresholds solved from a target
probability-of-success band on shared Monte Carlo paths
([engine/spending/guardrails.ts](../../app/src/engine/spending/guardrails.ts),
[engine/montecarlo/riskBasedGuardrails.ts](../../app/src/engine/montecarlo/riskBasedGuardrails.ts)); the
required floor is never cut, and the Monte Carlo page reports the **adjustment outlook** (P(any cut),
median/p90 deepest cut, cut years, longest spell, P(raise)) for any guardrail plan. An optional **survivor
spending percentage** scales base + phase spending in years when only one member of a couple is alive
(one-time goals and separately-modeled healthcare/debt/property costs are unaffected). An optional
**bequest target** (today's dollars) sets the after-tax-estate floor used by the **"How much can I
spend?"** solver page and the estate-floor optimizer objective — see [optimizer.md](optimizer.md).
Results offers an honest **bucket reporting lens** ([planner/bucketLens.ts](../../app/src/planner/bucketLens.ts)):
the projected balances re-read as "next N years of net spending" buckets, reconciling to the ledger totals
every year, with the Estrada/Kitces evidence note — the plan is always simulated total-return.
One-time goals (amount + year). Healthcare:

- **Pre-65:** ACA marketplace premium estimate; plan MAGI feeds the premium tax credit including the
  restored **400% FPL cliff** — a first-class Roth-conversion constraint for early retirees.
- **65+:** Medicare Part B/D premiums from parameter tables **plus IRMAA** from MAGI two years prior (§6).
  Opt-in **SSA-44 redetermination** (`expenses.healthcare.ssa44`) models Form SSA-44 relief after a
  qualifying life-changing event (a couple's first death; optionally each retirement year): affected premium
  years use min(lookback, prior-year) MAGI, priced in-solve by the Roth optimizer and never raising a premium
  ([domain rules §7](../domain/domain-rules-reference.md)).
- Optional long-term-care shock (deterministic episode + Monte-Carlo shock) — see [insurance.md](insurance.md).

## 5. Contributions and accumulation (pre-retirement)

Per-year contributions by account with annual-limit enforcement (401(k), IRA, HSA — data-driven),
age-50 catch-ups, the age 60–63 super catch-up, and the Roth catch-up mandate for prior-year wages
> $150k. Employer match (simple % formulas). Contributions support **time-aware phases**
(`contributionPhaseSchema`: per-phase amount with optional `fromAge`/`toAge` window and annual `escalationPct`
for salary-growth ramps), so an early-career accumulator's rising savings are modeled honestly.

For accumulators and the FIRE movement the projection also derives **financial-independence metrics** on the
Results and Report pages (`ProjectionSummary` in
[engine/projection/compare.ts](../../app/src/engine/projection/compare.ts)): per-year and average
pre-retirement **savings rate**, the **FI number** (today's-dollars spending ÷ the assumed safe withdrawal
rate, `assumptions.safeWithdrawalRatePct`, default 4%), the **FI year/age** the deflated investable balance
first crosses it, and the **Coast-FIRE number** (the FI number discounted by real growth to today). See the
`buildCoastFire` / `buildBaristaFire` examples and the FIRE Learning Center category.

## 6. Tax engine (federal + state)

Annual computation inside the projection loop ([tax/federalTax.ts](../../app/src/engine/tax/federalTax.ts),
[tax/stateTax.ts](../../app/src/engine/tax/stateTax.ts)); full detail in [taxes.md](taxes.md):

- Ordinary income stack: wages, interest, non-qualified dividends, traditional withdrawals/conversions,
  pension/annuity taxable parts, taxable SS (provisional-income 0/50/85% tiers, unindexed).
- **LTCG + qualified dividends** stack at 0/15/20% on top of ordinary income; the 0% bracket surfaces a
  gain-harvesting opportunity.
- Deductions: standard + age-65 additions + **$6,000/person senior deduction (2025–2028, MAGI phase-out)**;
  itemized as a simple user total. NIIT 3.8% over $200k/$250k MAGI (unindexed).
- **Capital-loss carryforward**: a starting net loss nets against realized gains, then up to $3,000/yr of
  ordinary income, lowering AGI (and the SS/IRMAA/ACA cascade); shown depleting per year.
- Early-withdrawal penalty (10% pre-59½), with Rule-of-55 / 72(t) SEPP exceptions.
- **IRMAA** from MAGI(year−2) applied to Medicare premiums, with cliff-edge warnings. **ACA PTC** pre-65
  from MAGI vs FPL with the 400% cliff.
- **State income tax**: per-state brackets and retirement-income exclusions for all 50 states + DC, plus
  mid-plan state moves ([domain/state-tax-research/](../domain/state-tax-research/) holds the per-state research).
- Output: full year-by-year tax detail (AGI, MAGI variants, taxable income, marginal + effective rates,
  IRMAA tier) as table + chart.

## 7. RMDs and QCDs

SECURE 2.0 start ages 73 (born 1951–1959) / **75 (born 1960+)**; Uniform Lifetime Table (Joint Life when
a spouse is >10 yrs younger). RMDs forced into the ledger as taxable income whether or not spending needs
them (excess reinvested into taxable). QCDs route a user-set charitable amount from the RMD, excluded
from income (2026 limit $111k, data-driven). A **QLAC** annuity purchase (§2,
[domain rules §17](../domain/domain-rules-reference.md)) removes its premium from the RMD base until the
deferred payouts begin. The inherited-account **10-year rule** is modeled (forced
distributions to the post-death deadline — [strategies/inheritedIra.ts](../../app/src/engine/strategies/inheritedIra.ts)).
Code: [rmd/rmd.ts](../../app/src/engine/rmd/rmd.ts).

## 8. Roth conversions

A marquee feature — two modes (full detail in [roth-and-withdrawals.md](roth-and-withdrawals.md)):

1. **Manual:** per-year conversion amounts, instantly reflected in tax/IRMAA/ACA outputs.
2. **Strategy ("fill to target"):** convert each year up to a chosen ceiling — top of a tax bracket, an
   IRMAA tier edge, the ACA 400% FPL cliff, or a fixed MAGI ([strategies/](../../app/src/engine/strategies/)).

Conversions are taxable ordinary income with no early-withdrawal penalty; interactions surfaced
explicitly (SS taxation, IRMAA +2yr, ACA PTC, NIIT, senior-deduction phase-out, widow's penalty, future
RMD reduction). A convert-vs-don't view compares lifetime taxes and ending after-tax wealth. Beyond the
strategies, a true MILP **optimizer** co-optimizes conversions and withdrawals — wrapped in an exact-ledger
convergence loop with in-solve taxable-gain, state-bracket, taxable-SS phase-in, and IRMAA-lookback fidelity,
plus an opt-in **co-optimized Social Security claim age**; the strict Owl parity gate (§13) proves the result
meets or beats Owl on every parity fixture — see [optimizer.md](optimizer.md).

## 9. Withdrawal strategy

When spending exceeds income, the engine drains accounts per strategy: **sequential** (cash → taxable →
traditional → Roth; HSA for medical), **proportional**, or **bracket-targeted** (traditional up to a
bracket ceiling, remainder from taxable/Roth — pairs with conversion strategies). Always overlaid with
RMDs first and pre-59½ penalty avoidance where possible. See [roth-and-withdrawals.md](roth-and-withdrawals.md).

## 10. Projection engine (deterministic)

Annual ledger from the current year to end of plan ([projection/simulate.ts](../../app/src/engine/projection/simulate.ts)).
Each year: income → contributions → spending need → RMDs → withdrawals/conversions → taxes (fixed-point
iteration over the circular tax-on-withdrawal dependency) → growth → end-of-year balances. Computed in
nominal dollars, displayed in today's or nominal dollars (toggle). Survivor transition handles filing
status, SS step-up, pension survivor %, and the expense adjustment. Outputs: net worth by account type,
income vs. spending, tax detail, ending estate (pre/post-tax), and a full per-year drill-down.

## 11. Monte Carlo

The **same** annual engine driven by stochastic returns/inflation in a Web Worker pool
([app/src/mc/](../../app/src/mc/), [engine/montecarlo/](../../app/src/engine/montecarlo/)); seedable RNG
for reproducibility. **15 pluggable return models** behind one `MarketModelConfig` interface — lognormal IID
per asset class with correlation and historical bootstrap (Shiller annual data), plus Student-t,
regime-switching, CAPE-conditioned, stationary/empirical bootstrap, GARCH, inflation-regime,
reversed-history, and user-shock variants — selectable on the Monte Carlo page (default unchanged).
1,000 paths default / 10,000 on demand. Outputs: success probability,
percentile fan chart, after-tax ending-estate distribution, depletion probability by year, expected
shortfall, spending-shortfall metrics, same-path frontiers (including the **annuitization sweep** frontier,
§2), the guardrail **adjustment outlook** (§4), and historical stress windows. Mortality-weighting
via the longevity module feeds the LTC shock. See [monte-carlo-and-scenarios.md](monte-carlo-and-scenarios.md).

## 12. Scenarios and comparison

A plan holds named **scenarios** (base + clones with overrides: retire at 62 vs 65, convert vs not, 17%
SS cut, LTC shock). Side-by-side compare of success %, lifetime taxes, ending estate, key-year table, and
a diff of changed assumptions ([engine/scenarios/](../../app/src/engine/scenarios/),
[planner/ScenariosPage.tsx](../../app/src/planner/ScenariosPage.tsx)). Whole separate **plans** can also be
duplicated and compared ([planner/ComparePlansPage.tsx](../../app/src/planner/ComparePlansPage.tsx)).

Two dedicated what-if views on the Explore rail run the user's **actual plan** through the same exact ledger:

- **Relocation Compare** (`/plan/:id/relocation`, 2026-07-09): "where should I retire?" — up to 5 candidate
  states (optional split-year move, flat local rate, cost-of-living spending delta) each run in a Web Worker
  ([engine/projection/relocation.ts](../../app/src/engine/projection/relocation.ts),
  [src/relocation/](../../app/src/relocation/)), ranked by lifetime state+local tax, total taxes & penalties,
  ending after-tax estate, and Monte Carlo success on **shared market paths**. A per-state driver drill-down
  attributes lifetime state tax to SS treatment, retirement-income exclusions, and capital-gain treatment
  through the production calculator. Candidates are ordinary scenario patches (proven byte-identical to
  editing the plan's state) and "Add as scenario" round-trips exactly. Income-tax-only scope is stated
  prominently; no "best state" is recommended. The `state-relocation` detector runs the same sweep over a
  zero-income-tax shortlist.
- **Survivor transition view** (`/plan/:id/survivor`, couples-only, 2026-07-09): sweeps earlier first-death
  timings (ages 70–90, either spouse first) via `deathAgeByPersonId` overrides
  ([planner/survivorAnalysis.ts](../../app/src/planner/survivorAnalysis.ts)) — filing-status timeline,
  survivor SS step, tax on similar MAGI across the transition, IRMAA with/without SSA-44, survivor spending
  coverage, and the convert-while-joint lever priced as an ordinary scenario. Educational framing throughout:
  timings are chosen scenarios, never predictions. The `widows-penalty-roth` detector quantifies the survivor
  bracket jump and points at SSA-44 when relief is unmodeled.

## 13. Reports and export

Print-styled report route (browser print-to-PDF: plan summary, assumptions, charts, year-by-year
appendix) — [planner/ReportPage.tsx](../../app/src/planner/ReportPage.tsx). Results, Report, and Optimize
can also download a self-contained HTML report generated by
[`report/reportHtml.ts`](../../app/src/report/reportHtml.ts): assumptions, parameter provenance, warnings,
annual ledger data, and optimizer recommendation evidence when available. Plus JSON backup/restore
(versioned envelope) + clear-all-data ([data/v2Backup.ts](../../app/src/data/v2Backup.ts)) and CSV export
of the annual ledger. Local regression review lives in [`cases/`](../../app/src/cases/): `npm run cases`
emits stable exact-ledger manifests over the example library or imported plans/scenario sets, and
`npm run cases:diff` flags unexpected changes; `npm run owl-parity` re-prices the optimizer against a pinned
[Owl](https://github.com/mdlacasse/Owl) oracle on a shared fixture matrix — the proof run is
`npm run owl-parity -- --install-owl --strict-owl`; without a working Owl/Python install the gate reports
**skipped** and exits 0 (see [optimizer.md](optimizer.md)).
(The old jsPDF/html2canvas export was removed during the v2 cutover.)

## 14. Data management and trust

IndexedDB persistence, schema-versioned with migrations, autosave
([data/planStore.ts](../../app/src/data/planStore.ts), [engine/model/](../../app/src/engine/model/)). Annual
**parameter packs** (tax brackets, limits, SSA tables, Medicare/FPL numbers) are versioned data files with
source URLs — refreshing each fall is a data PR, not a code change
([engine/params/](../../app/src/engine/params/), [maintenance-schedule.md](../maintenance-schedule.md)).
Assumption provenance shows each default's source and date in the UI
([planner/ProvenancePanel.tsx](../../app/src/planner/ProvenancePanel.tsx)). Educational tool — not
tax/legal/investment advice; rules change.

The **trust & transparency layer** ("show your work", 2026-07-08) sits on top: a per-plan **assumptions
card** at `/plan/:id/assumptions-card` tags every live assumption user-set / app default / published source
with copy-as-text/JSON exports ([planner/assumptionsExport.ts](../../app/src/planner/assumptionsExport.ts));
**"Why this number?"** explainer panels unpack the Monte Carlo success % (model/seed/precision,
depletion-year trace, sequence sensitivity), the optimizer recommendation (objective, winner, dollar margins
over every beaten alternative from the exact-ledger tournament), and the spending-solver answer; field ⓘ
bubbles can cite the parameter's provenance entry (IRS/CMS/SSA) directly; and an in-app **"How RetireGolden is
tested"** page at `/how-tested` (linked from Results and the Disclaimer) presents the one-auditable-ledger
story, external-oracle suites with build-time counts, the optimizer parity harness, and the deliberate
simplifications stated as prominently as the strengths.

## 15. Planner home

The planner home at `/` ([`PlanPickerPage.tsx`](../../app/src/planner/PlanPickerPage.tsx)) is **adaptive**:

- **First-time visitors** (no saved user plans) see a welcome hero with trust cues, three getting-started path
  cards (*Learn the basics* → Learning Center, *Try an example* → `/examples`, *Build your own* → new plan),
  and a curated **Start here** article row.
- **Returning users** (≥1 saved plan) see **Your plans** first with New plan / Compare actions; getting-started
guidance is collapsed behind a slim *New here? Getting started* disclosure (state in
`retiregolden.home.welcomeDismissed`, reset by Clear all data).

Section components live in [`planner/home/`](../../app/src/planner/home/). Inside a plan,
[`PlanWorkspace.tsx`](../../app/src/planner/PlanWorkspace.tsx) adds **Your plans / {name}** breadcrumb and a
**← Your plans** rail link back to `/`.

## 16. Example library

The **Example library** lives at `/examples` ([`ExamplesPage.tsx`](../../app/src/planner/examples/ExamplesPage.tsx))
— **24 curated teaching households** (the original eight, eight early-investing/FIRE accumulators, and eight
July-2026 depth-wave plans — four feature demos each paired with a matched control for side-by-side Compare)
that users can open in the full planner without cluttering **Your plans**. The dedicated route keeps the
planner home focused on the user's own plans as the library grows. Examples are built from the same scenario
shapes as the golden/characterization test fixtures but use realistic inflation and returns; each has a
golden test pinning headline KPIs.

- **Registry:** [planner/examples/](../../app/src/planner/examples/) (`registry.ts`, per-example `build*`
  factories). The legacy `createSamplePlan()` entry point now delegates to the **Example couple** registry
  builder.
- **Demo storage:** lazy — nothing is written until first **Open**. Each example uses a reserved id
  `example:<id>` with `origin: 'example'`. Edits autosave to that demo record but demos are filtered out of
  **Your plans**, backup export, and Compare (`listUserPlanSummaries()`).
- **Save to My Plans:** atomic convert — delete the demo record and put a fresh-id user plan in one
  transaction; `PlanContext.discardPendingSave()` prevents the unmount flush from resurrecting the demo.
  **Duplicate** on a demo also yields a user plan (`origin: 'user'`).
- **Learning Center:** new **Example Plans** category — one `ready` article per example, bidirectionally
  linked (library card / preview banner → article; article → **Open this example in the planner**). See
  [learning-center.md](learning-center.md).