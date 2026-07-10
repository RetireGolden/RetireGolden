# Domain rules reference (2026 law)

The financial rules the RetireGolden engine encodes, with current (tax year 2026) figures and sources. **All dollar figures live in versioned parameter-data files (`app/src/engine/params/`), not code** — see [standards.md](../standards.md). Verified June 2026; re-verify each fall when the IRS/SSA/CMS publish next-year numbers — cadence and the legislative watch-list are in [maintenance-schedule.md](../maintenance-schedule.md).

Legal baseline: the **One Big Beautiful Bill Act (OBBBA, July 2025)** made the TCJA rate structure permanent and added the senior deduction, so 2026 brackets are stable current law rather than a sunset cliff.

---

## 1. Federal income tax (2026)

Seven rates: 10/12/22/24/32/35/37%. 2026 thresholds (taxable income):

| Rate | Single | Married filing jointly |
|------|--------|------------------------|
| 10% | $0 | $0 |
| 12% | $12,400 | $24,800 |
| 22% | $50,400 | $100,800 |
| 24% | $105,700 | $211,400 |
| 32% | $201,775 | $403,550 |
| 35% | $256,225 | $512,450 |
| 37% | $640,600 | $768,700 |

- **Standard deduction 2026:** $16,100 single / $32,200 MFJ; additional age-65+ amounts $2,050 (single) / $1,650 (each spouse, MFJ).
- **Senior deduction (OBBBA, tax years 2025–2028):** $6,000 per person 65+, available whether itemizing or not; phases out at 6% of MAGI above $75,000 single / $150,000 MFJ. A major Roth-conversion interaction for 65+ planners.
- **Filing status after a spouse dies:** married couples can use MFJ treatment for the year of death when the survivor does not remarry. Qualifying-surviving-spouse treatment can preserve MFJ brackets/deduction for the next two years when a dependent qualifies; RetireGolden models this as an opt-in dependent flag because dependents are otherwise out of scope.
- **Alternative minimum tax (AMT) 2026:** exemption $90,100 single / $140,200 MFJ; exemption phase-out starts at $500,000 single / $1,000,000 MFJ and phases out at 50%; the 28% AMT ordinary-income rate begins above $244,500 of AMT taxable excess. RetireGolden uses these figures as a planning-grade AMT screen with modeled add-backs/preference items and preferential-rate-aware LTCG/QDI treatment, not a full Form 6251 worksheet.
- Sources: [Tax Foundation 2026 brackets](https://taxfoundation.org/data/all/federal/2026-tax-brackets/), [IRS 2026 inflation adjustments](https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill), [IRS Rev. Proc. 2025-32](https://www.irs.gov/pub/irs-drop/rp-25-32.pdf), [IRS final return / qualifying surviving spouse](https://www.irs.gov/newsroom/filing-a-final-federal-tax-return-for-someone-who-has-died), [Bipartisan Policy Center 2026 explainer](https://bipartisanpolicy.org/explainer/2026-federal-income-tax-brackets-and-interactive-calculator/).

## 2. Long-term capital gains and NIIT (2026)

LTCG + qualified dividends stack **on top of** ordinary taxable income:

| Rate | Single (taxable income) | MFJ |
|------|------------------------|-----|
| 0% | ≤ $49,450 | ≤ $98,900 |
| 15% | ≤ $545,500 | ≤ $613,700 |
| 20% | above | above |

- **NIIT:** 3.8% on net investment income above MAGI $200,000 single / $250,000 MFJ — **never indexed**, so it bites more each year.
- Engine note: implement the stacking computation (ordinary fills brackets first; gains taxed by where they land), plus 0%-bracket gain-harvesting surfacing.
- Sources: [Kiplinger 2026 capital-gains thresholds](https://www.kiplinger.com/taxes/irs-updates-capital-gains-tax-thresholds), [USTax Tools 2026 LTCG](https://ustax.tools/tax-insights/2026-capital-gains-tax-rate-thresholds/).

## 3. Social Security benefit taxation

Provisional income = AGI (excl. SS) + tax-exempt interest + 50% of SS benefits.

| Filing | 50% tier begins | 85% tier begins |
|--------|-----------------|-----------------|
| Single | $25,000 | $34,000 |
| MFJ | $32,000 | $44,000 |

Maximum 85% of benefits taxable; thresholds are **statutorily unindexed** (more benefits become taxable over time — model this, don't index it). The OBBBA senior deduction does **not** change SS taxation itself, despite popular framing.

## 4. Social Security program parameters (2026)

- **COLA 2026:** 2.8%.
- **Taxable wage base:** $184,500.
- **Earnings test:** $24,480/yr below FRA ($1 withheld per $2 over); $65,160 in the year FRA is reached ($1 per $3); none from FRA. Withheld months are **credited back at FRA** — the relevant retirement, spousal, or survivor factor is recomputed as if claimed that many months later (SSA's "adjustment of the reduction factor," ARF), which reduces the early-claim reduction up to FRA. The engine models both sides (withholding + ARF) on an **annual approximation**: whole withheld months per calendar year rather than monthly accounting, so the first claim year is prorated by its payable months.
- Claiming 62–70 with **monthly** granularity; early reduction 5/9%/mo (first 36) + 5/12%/mo; delayed credits 2/3%/mo to 70 (already in v1 engine).
- **Family maximum:** retirement/survivor family maximum is PIA-based: 150% of the first family-max bend tier, 272% of the next tier, 134% of the next tier, and 175% above the third bend point, rounded down to the next dime. RetireGolden applies this to the current-spouse auxiliary on a worker record (worker benefit unaffected; auxiliary capped to remaining room). Child/dependent and SSDI family-maximum benefits remain out of scope.
- **WEP/GPO repealed** (Social Security Fairness Act, Jan 2025) — no longer model.
- **Trust fund:** combined OASDI depletion projected ~2034 with ~83% of scheduled benefits payable (17% cut) per the **2026 Trustees Report**. Offer a scenario toggle (default off; user-adjustable year/%).
- **Survivor (widow(er)) benefit precision:**
  - **Survivor FRA** is a separate, earlier schedule than retirement FRA: 65y0m for born ≤1945, ramping to 66y0m for 1951–56, then 66y2m→66y8m for 1957–60, topping out at **66y8m** for born 1960+ (it never reaches 67).
  - **Early-claim widow(er) reduction:** claiming survivor between **60** and survivor FRA reduces the benefit by up to **28.5%** at age 60 (linear monthly proration), so the floor payable is **71.5%** of the survivor base. (A *disabled* widow(er) can claim at 50 — out of scope for a retirement planner.)
  - **Survivor base = the deceased's actual (claim-age-adjusted) benefit, not flat PIA.** A surviving spouse at/above survivor FRA receives up to 100% of what the deceased was entitled to, including the deceased's delayed-retirement credits when the deceased delayed past FRA.
  - **RIB-LIM ("widow's limit"):** when the deceased claimed reduced benefits early, the survivor benefit is **capped at the larger of (a) the deceased's actual reduced benefit or (b) 82.5% of the deceased's PIA** — never more than the deceased would receive if alive. Equivalently: survivor base = `max(deceased's actual benefit, 82.5% × PIA)`, which both floors the survivor when the deceased claimed early and passes the deceased's delayed credits through when the deceased delayed.
  - **Documented simplifications:** the 2-years-since-divorce "independently entitled" rule for divorced-spousal on a *living* ex is not modeled (rarely binds in planning; would require a divorce-date input); separate survivor-vs-own claim ages for a current spouse are not modeled (the step-up uses the survivor's own claim age as the survivor claim age); the disabled-widow(erer) age-50 entry is out of scope.
- **Social Security disability (SSDI):**
  - **Benefit = the worker's PIA with *no* early-retirement reduction** — the defining difference from early *retirement* claiming. A disabled worker receives their full PIA regardless of age at onset (which can be well before 62). Modeling input is a **disability-onset age**, not a medical adjudication.
  - **Eligibility (insured status):** generally **20 quarters of coverage in the last 40** (the "20/40" recent-work test) before onset, with the test relaxed for younger workers; plus the SSA disability definition (inability to engage in substantial gainful activity due to a medically determinable impairment expected to last ≥12 months or end in death). Modeled as an input assumption (the planner does not adjudicate disability).
  - **Substantial Gainful Activity (SGA):** earnings above the monthly SGA limit generally stop SSDI. **2026 SGA is $1,620/mo** ($2,700/mo if statutorily blind). The engine applies an annual approximation: wages over SGA × 12 suspend SSDI for that year. The trial-work period, extended Medicare, and expedited reinstatement are **not modeled** (documented simplification).
  - **Auto-conversion at FRA:** SSDI **converts to the retirement benefit at FRA at the same dollar amount** (the PIA — continuous, no jump). This is why SSDI matters to a *retirement* planner: it bridges from onset to FRA, then becomes the ongoing retirement benefit. The SSDI recipient earns **no delayed-retirement credits** (the benefit is already being paid), so the PIA persists from onset through life.
  - **Disability freeze:** months/years of disability are excluded from the AIME average so a zero-earning disability period doesn't drag the PIA down. **Not modeled** as a recomputation — the planner uses the PIA the user entered or derived from earnings (documented simplification).
  - **Taxation & Medicare:** SSDI is taxed under the same provisional-income tiers as retirement benefits (the engine includes it in `incomes.socialSecurity`, so the AGI→SS-tax→IRMAA/ACA cascade works unchanged). SSDI grants Medicare after a 24-month wait — **note-only** for now.
  - **Scope:** the worker's own SSDI + FRA conversion is modeled; **auxiliary/family benefits and the family maximum on SSDI are not** (documented simplification) unless research shows they're a big lever.
- Sources: [SSA 2026 COLA fact sheet](https://www.ssa.gov/news/en/cola/factsheets/2026.html), [SSA Trustees summary](https://www.ssa.gov/oact/trsum/), [AARP 2026 changes](https://www.aarp.org/social-security/biggest-2026-changes/), [SSA — Working while receiving benefits? (earnings test + ARF)](https://www.ssa.gov/benefits/retirement/planner/whileworking.html), [SSA family maximum bend points](https://www.ssa.gov/oact/cola/familymax.html), [SSA — Full Retirement Age for Survivors](https://www.ssa.gov/oact/ProgData/nra.html), [SSA POMS RS 00615.100 (survivor benefits / RIB-LIM)](https://secure.ssa.gov/poms.nsf/lnx/0300615100), [42 USC §402(e)](https://www.law.cornell.edu/uscode/text/42/402), [SSA — Disability Benefits](https://www.ssa.gov/benefits/disability/), [SSA — Substantial Gainful Activity (SGA)](https://www.ssa.gov/oact/cola/sga.html), [SSA POMS RS 00615.700 (disability freeze)](https://secure.ssa.gov/poms.nsf/lnx/0300615700).

## 5. Retirement accounts: contribution limits (2026)

| Item | 2026 |
|------|------|
| 401(k)/403(b)/457 employee deferral | $24,500 |
| Catch-up 50+ | $8,000 |
| **Super catch-up, ages 60–63** (SECURE 2.0) | $11,250 (replaces the 50+ amount) |
| **Roth catch-up mandate** | Prior-year FICA wages > $150,000 ⇒ catch-ups must be Roth |
| IRA | $7,500; catch-up 50+ $1,100 |
| HSA (self/family) | parameter data (≈$4,400/$8,750) + $1,000 55+ catch-up |

Source: [IRS 2026 limits announcement](https://www.irs.gov/newsroom/401k-limit-increases-to-24500-for-2026-ira-limit-increases-to-7500).

## 6. RMDs (SECURE 2.0)

- Start age: **73** for born 1951–1959; **75** for born 1960+ (i.e., from 2033).
- Annual RMD = prior Dec 31 balance ÷ Uniform Lifetime Table divisor (Joint Life Table II when a sole-beneficiary spouse is >10 yrs younger).
- Joint Life Table II is 26 CFR 1.401(a)(9)-9(d), Table 3. It includes spouse-beneficiary ages below 20; do not regenerate it from Pub 590-B displays that only show the age 20+ slice.
- Applies to traditional IRA/401(k)/403(b); **Roth 401(k) exempt since 2024**; Roth IRA exempt.
- Penalty: 25% of shortfall (10% if timely corrected).
- **QCD:** direct IRA-to-charity from age 70½, excluded from income, counts toward RMD; 2026 limit $111,000.
- Sources: [IRS Pub 590-B](https://www.irs.gov/publications/p590b), [IRS RMD FAQs](https://www.irs.gov/retirement-plans/retirement-plan-and-ira-required-minimum-distributions-faqs), [eCFR 26 CFR 1.401(a)(9)-9 Table 3](https://www.ecfr.gov/current/title-26/section-1.401(a)(9)-9).

## 7. Medicare and IRMAA (2026)

- Standard Part B premium: **$202.90/mo**.
- IRMAA based on **MAGI from 2 years prior** (2026 premiums ← 2024 MAGI). Cliff brackets (single / MFJ MAGI): $109k/$218k, then ~$137k, ~$171k, ~$205k single tiers, top tier $500k/$750k. 2026 Part B totals range $284.10–$689.90/mo; Part D surcharges $14.50–$91.00/mo.
- Engine notes: (a) two-year lookback means conversions at 63+ hit Medicare pricing; (b) brackets are cliffs — $1 over costs hundreds; (c) store full bracket tables per year in parameter data; (d) IRMAA's filing categories differ from the income-tax tables — SSA groups **qualifying surviving spouses with single/HOH filers** on the individual threshold table ([POMS HI 01101.020](https://secure.ssa.gov/poms.nsf/lnx/0601101020)), so QSS years price premiums at single thresholds even though their income tax uses the joint tables.
- **SSA-44 redetermination (opt-in, `expenses.healthcare.ssa44`):** after a qualifying life-changing event —
  death of spouse, and optionally each person's work stoppage (retirement year) — the beneficiary can ask SSA
  to price IRMAA on the current year's estimated MAGI instead of the two-year lookback (Form SSA-44; 8
  qualifying events in law, these two modeled). Planning-grade treatment: in the two years after an event
  (the premium years whose lookback still references pre-event income), IRMAA MAGI =
  **min(lookback MAGI, prior-year MAGI)** — the prior year stands in for the current-year estimate
  (current-year MAGI is circular with withdrawals, same convention as the ACA credit), and the min encodes
  that a redetermination is only filed when it helps. The optimizer prices it in-solve by shifting the flagged
  premium year's IRMAA-binary source from year (t−2) to (t−1) — a single-source stand-in for the min that can
  only overstate the surcharge; the exact-ledger tournament refines. Two documented under-modelings follow
  from the stand-in (modeled relief is a floor, never a ceiling): the event year itself stays on the plain
  lookback (a real filing can re-price it, but the prior-year estimate there is pre-event income), and
  first-year relief is understated when income runs high through the event year (the estimate references
  it). Events only register when they happen — a person who dies before their retirement age has no
  work-stoppage event. The form itself is the user's task (model the effect, never the filing).
- Sources: [CMS 2026 Medicare Parts B premiums and deductibles](https://www.cms.gov/newsroom/fact-sheets/2026-medicare-parts-b-premiums-deductibles), [Medicare.gov 2026 costs](https://www.medicare.gov/basics/costs/medicare-costs), [The Finance Buff IRMAA brackets](https://thefinancebuff.com/medicare-irmaa-income-brackets.html), [SSA: request to lower IRMAA](https://www.ssa.gov/medicare/lower-irmaa), [Form SSA-44](https://www.ssa.gov/forms/ssa-44.pdf).

## 8. ACA premium tax credit (pre-65 retirees)

- Enhanced (ARPA/IRA) credits **expired Dec 31, 2025**. As of 2026: credits available only up to **400% FPL — a hard cliff** ($1 over forfeits the entire credit), with pre-ARPA applicable-percentage scale below it.
- Early retirees managing MAGI (via Roth-conversion restraint, taxable-first withdrawals, gain management) is a core planning case; the cliff is severe for ages 60–64 (full premiums can exceed $1,200/mo).
- UI guidance: the Spending screen's pre-65 premium field expects the **full unsubsidized** monthly premium before any ACA credit. As a 2026 reasonableness check, KFF's national average benchmark premium is **$625/mo** for a 40-year-old second-lowest-cost Silver plan; actual retiree quotes vary by age, county, household, and plan. The `applyAcaCredit` switch then applies the modeled credit against MAGI.
- Watch for congressional action; keep as parameter-data + a "credits extended?" toggle.
- Sources: [CRS R48290](https://www.congress.gov/crs-product/R48290), [KFF on the cliff for older enrollees](https://www.kff.org/quick-take/a-steep-subsidy-cliff-looms-for-older-middle-income-enrollees-if-aca-enhanced-tax-credits-expire/), [KFF marketplace benchmark premiums](https://www.kff.org/affordable-care-act/state-indicator/marketplace-average-benchmark-premiums/), [CMS 2026 Marketplace plans and prices](https://www.cms.gov/newsroom/fact-sheets/plan-year-2026-marketplace-plans-prices-fact-sheet), [HealthCare.gov retiree coverage](https://www.healthcare.gov/retirees/).

## 9. State and local income tax

- State tax packs cover all 50 states plus DC using the big planning levers: income-tax presence, brackets,
  standard deduction, Social Security taxation, private/public retirement-income exclusions, and capital-gain
  inclusion. Values are transcribed from the per-state research files in
  [state-tax-research/](state-tax-research/).
- Capital gains default to federal conformity unless a state pack says otherwise. CA, MN, and NJ document
  ordinary state taxation of capital gains. PA uses current-year-only capital-loss conformity: federal
  prior-year carryforward losses do not offset PA-taxable current-year gains in the planning model.
- Mid-year state moves prorate state taxable income, deductions, brackets, and retirement caps by months in
  each state segment. Taxable Social Security is computed once on the full-year federal base and then
  apportioned by months.
- Optional local income tax is a user-entered flat percentage applied to computed state taxable income. This
  is planning support for common local layers, not a locality rule pack.
- Sources: [Tax Foundation state income-tax rates](https://taxfoundation.org/data/all/state/state-income-tax-rates/), per-state research in [state-tax-research/](state-tax-research/), and state revenue sources cited in each file.

## 10. Roth conversion rules

- Any amount, any year; taxed as ordinary income in the conversion year; **no 10% penalty on the conversion itself**; no earned-income or RMD-year ordering subtleties beyond: RMD must be satisfied **before** converting in an RMD year.
- **5-year rules** (surface as warnings v1): each conversion has its own 5-year clock for penalty-free withdrawal of converted principal before 59½ (the "conversion ladder" for early retirees); separately, earnings require 59½ + 5-year account age.
- **Pro-rata rule** for conversions and withdrawals from IRAs with nondeductible basis (Form 8606) — **implemented** (opt-in `nondeductibleBasis` per traditional IRA; see §16). Absent the field, plans behave as before (all pre-tax).
- Conversion taxes best paid from taxable funds; paying from the conversion before 59½ incurs the 10% penalty on the tax portion.
- Strategy interactions the engine must reflect: bracket fill, IRMAA tiers (+2yr lag), ACA cliff, SS provisional income, NIIT, senior-deduction phase-out, widow's-penalty (survivor files single), reduced future RMDs.

## 11. Withdrawal sequencing (modeling conventions)

- Default: cash buffer → taxable (basis-ratio gains) → traditional → Roth; HSA reserved for medical. RMDs always first.
- HSA withdrawals are qualified (tax- and penalty-free) only up to modeled medical costs when the account opts into the cap treatment (§16); otherwise the legacy simplification (tax-free, 20% penalty pre-65) or the explicit "assume all qualified" mode applies.
- Pre-59½ access ordering: taxable → Roth contributions/seasoned conversions → 72(t)/Rule of 55 (**implemented**) → penalized deferred as last resort. Account-movement eligibility (withdraw/convert/RMD/penalty) is centralized in `engine/strategies/accountEligibility.ts` (§16).
- Research consensus: naive "taxable-then-deferred-then-Roth" is beaten by bracket-aware blends (fill low brackets from traditional every year); this motivates the bracket-targeted strategy and the LP optimizer (see [features/optimizer.md](../features/optimizer.md) and the Owl oracle).
- The optimizer recommendation is **optimal on the exact ledger to tolerance** (2026-07-08): the MILP models the taxable-SS phase-in, IRMAA 2-year lookback, taxable-gain realization, and state brackets in-solve; an exact-ledger convergence loop re-linearizes around the incumbent; and the exact-ledger tournament (windowed bracket fills, top-two + MILP-winner local search) arbitrates and gates everything. The dev-only Owl parity harness (`npm run owl-parity`) measures RetireGolden at-or-above Owl on every fixture.

## 12. Monte Carlo methodology notes

- Drive the same annual ledger with stochastic real returns + inflation; never a separate simplified model (avoids divergence).
- Return models (15+): lognormal (correlated), historical (iid/block/sequence + more bootstrap flavors), Student-t fat-tailed, Markov regime-switch, CAPE-conditioned, stationary bootstrap, empirical (non-centered), GARCH(1,1), inflation-regime, reversed-history, user-shock, additive Gaussian (normal), AR(1) mean-reverting. See enhancements/stochastic-market-model-library.md. All mean-preserving except explicitly non-centered/forced-shock variants; class shocks supported; seed-deterministic; default unchanged. Exceeds Owl's advertised stochastic breadth while powering the exact tax/ledger (unique advantage).
- Report success probability **and** magnitude (median/percentile ending estate, depletion-age distribution, cumulative depletion probability by year, and spending shortfall dollars); success % alone overweights tail behavior.
- Expected shortfall is a user-facing plain-English metric: average total unfunded spending across failing paths. It is not finance CVaR.
- Scenario/candidate stochastic comparisons must reuse the same seeded market paths for every row; do not compare candidates from independently sampled Monte Carlo runs.
- Frontier views are bounded same-path sweeps (for example, spending level or retirement age vs. success probability), not optimizer searches.
- Historical stress reports replay every rolling window and reversed window through the same ledger, then identify the worst windows by ending estate and shortfall.
- Use seedable PRNG (e.g., PCG/xoshiro) so runs are reproducible and scenario diffs aren't noise; antithetic variates cheap variance reduction.
- 1,000 paths default / 10,000 on demand; Web Worker pool keeps UI responsive.

## 13. Default assumptions (user-overridable)

These are the **forward-looking** defaults a planner can override on the Assumptions screen (and the
longevity module), as distinct from the dated **rule packs** in §1–§12. Defaults live in
`createEmptyPlan` (`engine/model/plan.ts`) and the UI; the values below are what the code ships today, each
with the reputable source behind it. The deep dive into these — one Learning Center article per assumption —
is planned in
the `assumptions-deep-dive-and-learning-center` plan (private planning docs),
which is also where the full per-source notes and any recommended default changes are tracked. Verified June
2026; re-validate on the cadence in [maintenance-schedule.md](../maintenance-schedule.md).

| Assumption | Default (shipped) | Sourced basis |
|------------|-------------------|---------------|
| General inflation | 2.5% | SSA 2025 Trustees ultimate **CPI-W 2.4%**; Fed long-run goal **2.0%** (PCE); CBO long-run **~2.2% CPI**; Philly Fed SPF 10-yr **~2.4%**. 2.5% is mildly conservative. |
| Healthcare extra inflation | +3% over CPI | Sourced to HealthView 2026 long-term retiree healthcare inflation **5.8% ≈ 2× CPI**, Medicare Part B **~7%/yr**. +3% is a defensible, slightly-conservative default. |
| Default return (blended, plan-wide) | 5.5% nominal | Between forward-looking CMAs (Vanguard 2026 US equity **4–5%**, bonds ~4%; J.P. Morgan 2026 60/40 **6.4%**, US large cap 6.7%) and long-run historical (~8–9% balanced). |
| US stocks nominal return | 7–8% (μ), σ ≈ 16% | Long-run historical ~10% nominal/~7% real; forward CMAs lower (4–7%). UI estimator uses **7%** (`ASSET_RETURN`, illustrative, pre-fee). |
| Bonds nominal | 4–4.5%, σ ≈ 6% | Vanguard/JPM 2026 forward ~4.0–4.6%; UI estimator **4%**. |
| Cash | 2.5–3% | UI estimator **2.5%**. |
| SS COLA | = inflation | Statutorily **CPI-W**-linked (SSA); 2026 COLA 2.8%, ultimate 2.4%. |
| SS trust-fund haircut | off; 2034 / −17% when on | **2026 Trustees:** combined OASDI depletes **2034** (Q3), **83% payable** (−17%); OASI alone **2032** (Q4), 78% (−22%). |
| Plan end age | longevity module planning age, floor 95 | per person; aligns with Academy/SOA **Actuaries Longevity Illustrator** guidance to plan to the 75th–90th survival percentile (joint for couples). |
| State effective tax override | 0 (use modeled per-state brackets) | Override mechanism; per-state research in [state-tax-research/](state-tax-research/). |
| Local income tax | 0% | Optional flat user-entered local layer on state taxable income; default off because local taxes vary by county/city/municipality. |
| Recent annual MAGI | 0 | Input seed for IRMAA's 2-year lookback in early projection years (not a forecast). |
| Heir tax rate (after-tax estate) | 25% | SECURE Act 10-year rule typically drains inherited pre-tax IRAs in heirs' peak-earning years ⇒ mid-bracket (22–24%) + possible state. |
| Survivor spending percentage | 100% (no change) | Optional; scales base + phase spending in years when one member of a couple survives. Studies of retired couples typically land at **60–80%** of couple spending (housing/utilities barely drop; food, travel, and one person's healthcare do). |
| Bequest target | 0 / off | `expenses.bequestTargetDollars` (today's dollars); an after-tax-estate floor consumed by the "How much can I spend?" solver and the estate-floor / max-sustainable-spending objective policies (`objectivePolicyForPlan`). Absent = no floor. See [features/optimizer.md](../features/optimizer.md). |
| Safe withdrawal rate (FI number) | 4% | `assumptions.safeWithdrawalRatePct`; the Bengen/Trinity 4% rule as the lens for the derived FI number and Coast-FIRE metrics (accumulation planning), not a spending rule the ledger enforces. |
| Retirement smile profile | −10% at 75, −20% at 85 (preset writes ordinary phases) | Blanchett, ["Exploring the Retirement Consumption Puzzle"](https://www.financialplanningassociation.org/article/journal/MAY14-exploring-retirement-consumption-puzzle) (JFP 2014): real retiree spending declines ~1%/yr through the mid-80s — the "retirement spending smile." |

Sources: [SSA 2025 Long-Range Economic Assumptions](https://www.ssa.gov/oact/TR/2025/2025_Long-Range_Economic_Assumptions.pdf),
[CBO 2026–2036 Outlook](https://www.cbo.gov/publication/62105),
[HealthView 2026 Retirement Healthcare Costs Data Report](https://hvsfinancial.com/wp-content/uploads/2026/02/2026-Data-Report.pdf),
[Vanguard 2026 Economic & Market Outlook](https://corporate.vanguard.com/content/corporatesite/us/en/corp/vemo/2026-outlook-economic-upside-stock-market-downside.html),
[J.P. Morgan 2026 Long-Term Capital Market Assumptions](https://am.jpmorgan.com/us/en/asset-management/adv/insights/portfolio-insights/ltcma/),
[SSA 2025 Trustees Report summary](https://www.ssa.gov/oact/TRSUM/tr25summary.pdf),
[Actuaries Longevity Illustrator (Academy of Actuaries / SOA)](https://www.longevityillustrator.org/).

## 14. Spending layers and guardrails (opt-in)

Baseline spending can be split into a **required floor** (`expenses.requiredAnnual`, today's $), the
**target** lifestyle (`expenses.baseAnnual`), and optional annual upside layers (`expenses.idealAnnual`,
`expenses.excessAnnual`). Absent optional fields preserve old behavior: the whole baseline budget is required
unless the user enters a lower floor, and annual ideal/excess default to zero. System-computed costs
(healthcare, debt service, property carrying costs, insurance premiums, net long-term-care) are always treated
as **required**; a plan can never report "floor success" after silently cutting essentials.

- **Withdrawal-rate guardrails** (`expenses.spendingPolicy.mode = 'withdrawalRateGuardrails'`, Guyton-Klinger
  style): each projection year the ledger compares this year's withdrawal-rate signal (recurring target
  spending / start-of-year portfolio) to the plan's **starting** rate. Above the upper band (default **120%**
  of the starting rate) the target-flexible layer is cut by the **adjustment** step (default **10%**); below the
  lower band (default **80%**) it is restored. When `allowRaisesAboveTarget` is enabled, strong paths can
  continue above target into annual ideal/excess layers and eligible early goals; cuts never reach the required
  floor. The signal uses gross recurring target spending (a documented simplification that keeps it well defined
  before the tax/withdrawal fixed point and free of one-time-goal spikes). Sources: Guyton & Klinger (2006),
  Bengen (1994), Kitces guardrails.
- **Risk-based guardrails** (`expenses.spendingPolicy.mode = 'riskBasedGuardrails'`): the same discretionary
  rationing machinery, but triggered by the **real (deflated) portfolio balance** against dollar thresholds
  instead of the withdrawal-rate ratio. The user picks a target probability-of-success band
  (`targetSuccessLowerPct`/`targetSuccessUpperPct`, defaults **70/95**); a shared-path solver
  ([engine/montecarlo/riskBasedGuardrails.ts](../../app/src/engine/montecarlo/riskBasedGuardrails.ts))
  bisects the starting-balance scale on identical seeded Monte Carlo paths to find the balances where the
  *fixed-target* plan's success probability crosses each band edge, and sizes the $/mo spending change that
  restores the band midpoint. The solved thresholds persist on the policy
  (`lowerBalanceThresholdPct`/`upperBalanceThresholdPct`, % of the starting portfolio, today's dollars);
  **until they are solved the mode adjusts nothing** (inert — it never acts on made-up numbers). In-path the
  thresholds stay fixed in real terms across the horizon (documented simplification; no nested per-year
  re-solve). Sources: Kitces probability-of-success-driven guardrails (2024–25), Guyton–Klinger critiques
  (Pfau 2015, Jeske 2017).
- **Probability-and-magnitude-of-adjustment reporting** (`MonteCarloSummary.adjustments`): per-path cut
  years, longest cut spell, and deepest cut (from the per-year `guardrailFactor`) aggregate to P(any cut),
  P(any raise), median/p90 deepest cut, average/p90 cut years, average longest spell, P(ending surplus),
  and — when `expenses.bequestTargetDollars` is set — P(estate ≥ the target inflated to path end). Rendered
  as the Monte Carlo "Adjustment outlook" card for any guardrail plan; all zeros/null for plans without a
  guardrail policy. Source: Kitces "probability of adjustment" reframing (2025).
- **Flexible one-time goals** (`classification`, `flexibility`, `earliestYear`, `latestYear`, `priority`,
  `allowPartialFunding`, `minFundingPct`): under a guardrail policy, a **movable** goal can fund as early as
  `earliestYear` in a strong path, normally targets `year`, and may defer until `latestYear` under cuts. If it
  is still unaffordable at `latestYear` while discretionary spending is rationed, the unfunded amount is
  reported as a layer shortfall rather than forcing spend beyond the guardrail budget. A **skippable** goal can
  be dropped if the hard flexible-goal budget cannot fund it by the end of its window.
  Partial funding records the funded and unfunded dollars once the available budget clears `minFundingPct`.
  Goal ordering is required, target, ideal, excess; within a layer, lower `priority` funds first. **Fixed** goals,
  the migration default, always fund in their target year, so existing plans are unchanged.
- **Reporting.** Each year records `requiredShortfall` (essentials the portfolio could not fund),
  `targetShortfall` (miss below target lifestyle), `idealShortfall`, and `excessShortfall`. Legacy `shortfall`
  and `depletionYear` are unchanged. Results and CSV export include required/target/upside spending, layer
  misses, guardrail action, and flexible-goal counts. Monte Carlo adds `requiredFloorSuccessRate`,
  `targetLifestyleSuccessRate`, target attainment percentiles, average target shortfall, ideal/excess funding
  rates, flexible-goal outcomes, and guardrail action counts alongside the classic `successRate`.
- **Probability-band safe-spend candidate.** The shared decision-engine generator
  `probabilityBandSpendingGuardrailGenerator` emits a bounded scenario-style guardrail patch with lower/upper
  success-band metadata. Surfaces evaluate that patch through the normal exact ledger and Monte Carlo paths,
  not through a private spending approximation.

**Code:** [engine/spending/](../../app/src/engine/spending/) (`layers.ts`, `guardrails.ts`,
`flexibleGoals.ts`), applied in [engine/projection/simulate.ts](../../app/src/engine/projection/simulate.ts),
aggregated in [engine/montecarlo/run.ts](../../app/src/engine/montecarlo/run.ts), surfaced in Results/Monte
Carlo/Spending, and exposed as a previewable Insights scenario.

The Insights R3 "Dynamic spending guardrails" card calls
`probabilityBandSpendingGuardrailGenerator` to build the preview patch, then the shared Insights decision
adapter and Monte Carlo preview compare it against the baseline.

### Sustainable spending and objective policies

- **Survivor spending** (`expenses.survivorSpendingPct`): optional percent scaling of base + phase spending in
  years when one member of a couple survives. Default 100% preserves couple spending; typical planning inputs
  are 60–80%.
- **Bequest target** (`expenses.bequestTargetDollars`): optional after-tax-estate floor in today's dollars.
  Consumed by the "How much can I spend?" solver and by estate-floor / max-sustainable-spending objective
  policies via `objectivePolicyForPlan`.
- **Spending-shape presets** (Spending screen; compiler in
  [engine/spending/shapePresets.ts](../../app/src/engine/spending/shapePresets.ts)): named shapes compile to
  ordinary `expenses.phases` rows — constant-real (no phases), retirement **smile** (−10% at 75, −20% at 85:
  Blanchett's *average* retiree, JFP 2014 with 2025–26 updates; the two-step calibration approximates the
  smile's decline-then-late-healthcare-rise at its overall level, without an explicit late step-up — the
  generated rows are editable), retirement **smirk** (−1%/yr real, compiled as compounded 5-year steps to
  age 100: Blanchett's *median* retiree — a steady real decline with **no** late rise; the average's late
  rise is driven by the high-morbidity tail), front-loaded travel (+10% until 75), and a **custom annual
  real delta** compiled the same way. Presets generate rows once at creation time
  (the anti-drift rule) and never live-couple saved plans to research constants. The "How much can I spend?"
  page can re-solve the plan per shape to quantify the shape-aware uplift on the user's own ledger
  (Blanchett: shape-aware plans support materially higher initial withdrawals than constant-real).
- **Objective policy resolution** (`objectivePolicyForPlan` in
  [engine/decisions/objectives.ts](../../app/src/engine/decisions/objectives.ts)): picks up plan-level floors
  automatically — `bequestTargetDollars` feeds `min-lifetime-tax-estate-floor` and
  `max-sustainable-spending`; `strategies.survivorReserveTarget` feeds `protect-survivor-liquidity`. The
  `max-sustainable-spending` policy ranks candidates by base annual spending and disqualifies any exact-ledger
  run that depletes or ends below the inflated estate floor.

**Code:** [engine/decisions/spendingSolver.ts](../../app/src/engine/decisions/spendingSolver.ts),
[engine/decisions/objectives.ts](../../app/src/engine/decisions/objectives.ts). Product mechanics:
[features/optimizer.md](../features/optimizer.md), [features/README.md](../features/README.md) §4.

### Spending paths & SWR lenses (opt-in)

Five research-backed lenses over the same ledger (spending-paths-and-swr-lenses plan; all opt-in,
feature-off plans byte-identical, guarded by `cases:diff` and the golden suites):

- **Amortized spending / ABW** (`expenses.spendingPolicy.mode = 'abw'`, params in `spendingPolicy.abw`;
  pure math in [engine/spending/abw.ts](../../app/src/engine/spending/abw.ts), applied in
  `simulate.ts`): the amortization-based withdrawal family the Bogleheads wiki formalized — VPW, TPAW, and
  CAPE rules are members. Each year the recurring lifestyle target is the **actual start-of-year investable
  balance** re-amortized over the remaining horizon (annuity-due, matching the ledger's spend-then-grow
  timing; the payment ratio is inflation-invariant so it computes directly on nominal balances). Parameters:
  expected-return source (**fixed** real %/yr — the VPW preset uses 3.8%, the VPW wiki's global 5.0%/1.9%
  stock/bond IRRs weighted 60/40; **CAPE** — equity real return = 100/CAPE blended with a bond real yield at
  the equity share, the ERN/TPAW conditioning; **TIPS** — the whole portfolio at a real bond yield, most
  conservative) × horizon (**planning age** or the **25%/10% survival-percentile age**, joint for couples) ×
  **spending tilt** (planned real growth of payments; negative front-loads, consistent with observed
  declines). ABW replaces baseAnnual/phases/layers; healthcare, debt, property, insurance, and one-time
  goals stay separately modeled on top, and the payment funds through the normal tax cascade. Under realized
  = expected returns the identity recomputes to exact depletion at the horizon (fixture-tested). Guardrail
  machinery is unused under ABW — re-amortization *is* the adjustment rule.
- **Survival-percentile planning ages** (Household screen "Percentile";
  [engine/montecarlo/survival.ts](../../app/src/engine/montecarlo/survival.ts)): planning age expressed as
  "the age I/we have a 25% (10%) chance of reaching", single or joint ("either of us", independent
  lifetimes: 1 − (1−S_a)(1−S_b)), from the same SSA 2022 q(x) derivation as the stochastic-longevity
  engine. Optional health adjustment: the longevity questionnaire's remaining-years multiplier converts to
  a proportional-hazards power (q′ = 1 − (1−q)^h, h solved by bisection so the adjusted expectancy matches),
  the Actuaries Longevity Illustrator's smoker/health-adjustment pattern without a second factor set. The
  picked age is written once with provenance (`longevity.source = 'percentile'`, spec kept for restating) —
  never silently recomputed; fixed-age plans unchanged.
- **SWR comparator** ("How much can I spend?" page;
  [engine/decisions/swrComparator.ts](../../app/src/engine/decisions/swrComparator.ts)): the live
  "whose 4% rule?" argument priced on the user's own plan — **Bengen 4.7%** (*A Richer Retirement*, 2025:
  SAFEMAX ≈ 4.7% with seven asset classes), **Morningstar 3.9%** (*State of Retirement Income* 2025, for
  2026 retirees), and the **ERN CAPE rule** (SWR = 1.75% + 0.5 × 100/CAPE, SWR series part 18). Each rule
  spends its rate × starting investable, constant-real (the rules' own definition), through one
  deterministic exact-ledger run — same-path deltas by construction — shown against the plan's solver
  answer with citations. Presented as rules of thumb vs. the plan-specific answer; no rule is endorsed.
- **Solver-per-shape** (same page): re-solves `solveMaxSustainableSpending` under constant-real / smile /
  smirk phase sets to show the shape-aware initial-spending uplift on the user's plan (~25 sims per shape,
  on demand).
- **Bucket reporting lens** (Results; [planner/bucketLens.ts](../../app/src/planner/bucketLens.ts)):
  buckets are popular but the evidence (Estrada's bucket studies; Kitces) finds no systematic benefit over
  total-return rebalancing, so RetireGolden *reports* buckets without *managing* them — each year's investable
  total is partitioned into "next N years of net spending" segments (net need = spending + taxes −
  income, floored at 0; presets 2yr/8yr/growth and 3yr/growth), reconciling to the ledger total every year
  by construction. Presentation only; no engine feedback.

**Code:** [engine/spending/abw.ts](../../app/src/engine/spending/abw.ts),
[engine/spending/shapePresets.ts](../../app/src/engine/spending/shapePresets.ts),
[engine/montecarlo/survival.ts](../../app/src/engine/montecarlo/survival.ts),
[engine/decisions/swrComparator.ts](../../app/src/engine/decisions/swrComparator.ts),
[planner/bucketLens.ts](../../app/src/planner/bucketLens.ts). Sources: Bogleheads wiki
"Amortization based withdrawal formulas" and "Variable percentage withdrawal"; Blanchett, *Exploring the
Retirement Consumption Puzzle* (JFP 2014) and 2025–26 median-spending ("smirk") updates; Bengen, *A Richer
Retirement* (2025); Morningstar, *State of Retirement Income* (2025); Early Retirement Now SWR series part
18 (CAPE rule); Academy of Actuaries / SOA Actuaries Longevity Illustrator; Estrada, *The Bucket Approach
for Retirement* ; Kitces on bucket strategies and probability-of-adjustment.

## 15. Asset classes, allocation, and rebalancing (opt-in)

Accounts can opt into a four-class allocation (`allocation` on taxable/traditional/Roth/HSA accounts):
**US stocks, international stocks, bonds, cash**. An account without an allocation keeps the single
expected-return model unchanged. When present, the allocation supersedes the account's `annualReturnPct`:
growth is the class-blended return, glidepaths compile to per-year target weights (static / linear from→to /
staged steps / custom interpolated year targets), and Monte Carlo shocks each class with correlated draws
sharing the same schema.

**Class defaults** (Assumptions-level, user-editable via `assumptions.assetClassParams`; code in
[engine/allocation/assetClasses.ts](../../app/src/engine/allocation/assetClasses.ts)):

| Class | Return (nominal) | Volatility | Yield | Qualified share |
|-------|------------------|------------|-------|-----------------|
| US stocks | 7.0% | 19.6% | 1.5% dividends | 95% |
| International stocks | 7.0% | 21.0% | 3.0% dividends | 70% |
| Bonds | 4.0% | 7.7% | 4.0% interest | — |
| Cash | 2.5% | 0.5% | 2.5% interest | — |

Returns match the in-app return estimator's long-run nominal conventions (§13: stocks 7%, bonds 4%, cash
2.5% — between forward CMAs and long-run history; intentionally consistent so opting into classes does not
silently change a 60/40 account's expected growth). Volatilities are long-horizon historical standard
deviations from the [Damodaran (NYU Stern) annual dataset](https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/histretSP.html)
(S&P 500, 10-yr Treasury, 3-mo T-bill), the same source as the embedded Monte Carlo history; international
volatility proxies long-run MSCI EAFE (USD) history. Dividend/interest yields are current-era broad-index
figures (S&P 500 ≈ 1.2–1.6%, MSCI EAFE ≈ 3%, yield-to-maturity-driven bond funds ≈ coupon); the qualified
shares reflect that most US index dividends are qualified while a meaningful slice of foreign dividends is
not. Review annually with the parameter-pack workstream ([maintenance-schedule.md](../maintenance-schedule.md)).

**Default correlation matrix** (long-horizon historical, documented here; editable defaults can ship later):
US/intl stocks **0.75**, stocks/bonds **0.10**, bonds/cash **0.20**, stocks/cash **0.00**. Stock-bond
correlation has swung between roughly −0.3 and +0.35 by decade in the Damodaran data; 0.10 is the
long-horizon average, deliberately not the post-2000 negative regime.

**Modeling conventions:**

- **Rebalancing** (`allocation.rebalancing`, default `annual`): each January the account trades drifted
  weights back to the year's glidepath target. Taxable sales realize gains pro-rata through the same
  aggregate basis-ratio machinery as withdrawals (basis rises by the realized gain); traditional/Roth/HSA
  rebalances are tax-free. `none` opts out — weights drift with returns and glidepath targets are ignored
  after the start.
- **Weights, not lots.** Withdrawals and deposits are assumed pro-rata across classes, so the engine tracks
  each account's weight vector; only differential class growth moves it. This is exact under the pro-rata
  assumption and keeps the ledger O(accounts) per year.
- **Taxable drag by class.** An allocated brokerage account derives its interest/dividend yield and
  qualified share from the blend (explicit account-level yield fields still override), so a bond-heavy
  taxable account drags more than a stock-heavy one through the §2 annual-yield machinery.
- **Monte Carlo.** With any allocated account, the lognormal model draws per-class correlated,
  mean-preserving shocks (Cholesky over the matrix above, the single market factor doubling as the first
  Gaussian so allocated and unallocated accounts co-move); the historical models key class shocks off the
  same sampled year (stocks → S&P series, bonds → Treasury series, each centered on its own mean;
  international proxies the US series; cash unshocked). Plans without allocations consume identical RNG
  draws as before, reproducing current distributions exactly.
- **Asset location.** The decision-engine generator `assetLocationGenerator` proposes bounded location swaps
  (bonds → traditional, stocks → taxable/Roth) that preserve the household's total dollars per class, as
  plan patches priced by the exact ledger — never recommended from generation-time heuristics. When a plan
  opts into static allocation on multiple eligible accounts, the Insights `asset-location` detector surfaces
  the generator's candidates as previewable scenarios (the Roth conversion optimizer tournament does not
  include them).

**Code:** [engine/allocation/assetClasses.ts](../../app/src/engine/allocation/assetClasses.ts) (params,
glidepath compilation, blends), applied in
[engine/projection/simulate.ts](../../app/src/engine/projection/simulate.ts) (rebalance pass, yield blend,
growth), [engine/montecarlo/marketModels.ts](../../app/src/engine/montecarlo/marketModels.ts) (class
shocks), [engine/decisions/generators.ts](../../app/src/engine/decisions/generators.ts) (location
candidates), [engine/insights/detectors/assetLocation.ts](../../app/src/engine/insights/detectors/assetLocation.ts);
account editor + Assumptions class table in
[planner/sections.tsx](../../app/src/planner/sections.tsx).

## 16. Account eligibility, HSA, nondeductible basis, and fixed-asset disposition (opt-in)

Depth added by the `account-hsa-and-fixed-asset-depth` plan (private planning docs). Every field is
additive with a no-op default, so plans saved before it stay byte-identical.

- **Account eligibility service.** `engine/strategies/accountEligibility.ts` is the single source of truth for
  per-account movement rules: can it accept contributions, be converted to Roth, follow the owner's RMDs, be
  spent this year (equity-comp vesting), and what early-withdrawal penalty applies. The ledger, the optimizer
  input builder, and the decision generators all consume it, so the inherited-IRA convertibility rule (and the
  Rule-of-55 / pre-59½ penalty logic) lives in exactly one place.
- **HSA medical-expense subledger.** Per HSA account, `withdrawalTreatment`:
  `assumeAllQualified` (every withdrawal tax- and penalty-free), `capByMedicalExpenses` (qualified only up to
  the household's modeled healthcare premiums + net care costs this year; the excess is ordinary income,
  penalized 20% before 65 — IRS Pub 969), or omitted (legacy: tax-free but conservatively penalized before 65).
  With `reimburseLater`, modeled medical costs paid out of pocket accumulate a carryover that later withdrawals
  draw against tax-free (the "pay now, reimburse later" strategy).
- **HSA beneficiary treatment.** `beneficiary: 'nonSpouse'` makes the ending HSA fully taxable to the heir
  (IRC §223(f)(8)(B)), so the after-tax estate metric taxes it at the heir tax rate; `spouse` (or omitted)
  passes untaxed like a Roth.
- **Nondeductible IRA basis (Form 8606 pro-rata).** `nondeductibleBasis` on a traditional IRA aggregates
  across an owner's own IRAs; every withdrawal and conversion is part tax-free basis and part taxable in the
  ratio of basis to the aggregated pre-distribution balance (IRC §408(d)(2)). Employer plans and inherited
  IRAs are excluded from the aggregation. Basis is historical cost (never indexed).
- **Fixed-asset disposition.** Setting `costBasis` on a property switches its planned sale from the legacy
  tax-free `expectedNetProceeds` estimate to exact treatment: gain = sale price − selling costs
  (`sellingCostPct`) − basis; depreciation (`depreciationRecapture`) is ordinary income and never excludable;
  a `primaryResidence` gets the §121 exclusion ($250k single / $500k joint, statutory since 1997, never
  indexed — parameter pack). Remaining gain flows through the capital-gains stack; net proceeds fund the
  sale-year cash flow so the sale can pay its own tax. Ownership/use tests are a user assertion.
- **Taxable safety-net floor.** `strategies.taxableSafetyNetFloor` (today's dollars) is a minimum
  cash + taxable + vested-equity reserve. Need-based withdrawals fund from other account types first to keep it
  intact, and fill-to-target Roth conversions are trimmed so their tax bill stays payable above the floor; it is
  breached only as a last resort, with a warning. Manual/optimized conversion schedules are executed as typed.

**Code:** [engine/strategies/accountEligibility.ts](../../app/src/engine/strategies/accountEligibility.ts),
[engine/strategies/iraBasis.ts](../../app/src/engine/strategies/iraBasis.ts),
[engine/tax/propertySale.ts](../../app/src/engine/tax/propertySale.ts), threaded through
[engine/projection/simulate.ts](../../app/src/engine/projection/simulate.ts) and the after-tax estate metric in
[engine/projection/compare.ts](../../app/src/engine/projection/compare.ts).

## 17. Guaranteed income (annuity purchases) and estate & beneficiary depth (opt-in)

Depth added by the
`guaranteed-income-and-estate-depth` plan (private planning docs). Every
field is additive with a no-op default, so a plan that sets none of them keeps a byte-identical projection
and after-tax estate.

- **Annuity purchase events.** An `annuity` account can carry an optional `purchase`
  (`annuityPurchaseSchema`): a `year`, `premium` (nominal quoted dollars), `fundingAccountId`, and
  `taxQualification`. In the purchase year the premium leaves the funding account — cash/traditional at book
  value, a taxable or equity-comp source liquidating and realizing gains pro-rata like any sale — and the
  account's income stream starts at `startAge`.
  - **Non-qualified** (cash/taxable-funded): payouts are taxed by the **IRS Pub 939 exclusion ratio** — the
    premium is the investment in the contract, recovered tax-free over the expected-return period (Pub 939
    Table V multiples). The account's `taxablePct` is derived from the ratio; the stored value is a display
    fallback only.
  - **Qualified** (traditional-funded): payouts are fully ordinary income, and because the premium leaves the
    traditional balance, future RMDs shrink automatically.
- **QLAC support.** `purchase.qlac` marks a deferred-start qualified longevity annuity. Its premium is
  **excluded from the RMD base** until payouts begin, capped at the SECURE 2.0 statutory limit (**$210,000
  for 2026**, sourced in `year2026.ts`); a warning fires if the entered premium exceeds the cap, and `qlac`
  requires `taxQualification: 'qualified'`.
- **Estate beneficiary destinations.** `estateBeneficiary` on any account (`estateBeneficiarySchema`) sets
  where its ending balance passes in the after-tax estate metric: `spouse` (spousal rollover, untaxed),
  `nonSpouse` (pre-tax classes — traditional and non-spouse HSA — taxed at the class's heir rate; Roth,
  taxable stepped-up at death, and cash pass untaxed), or `charity` (`charityPct` passes to charity fully
  untaxed, the remainder following the non-spouse rules). Absent the field, the legacy flat treatment applies.
  The HSA's older `beneficiary` field remains a spouse/non-spouse shorthand; when both are present,
  `estateBeneficiary` wins.
- **Heir tax by account class.** `assumptions.heirTaxByClass` optionally overrides the flat `heirTaxRatePct`
  (§13) per pre-tax class (`traditional`, `hsa`), so a large inherited traditional balance can be priced at a
  higher heir bracket than a modest HSA. An omitted class falls back to `heirTaxRatePct`.
- **Survivor reserve target.** `strategies.survivorReserveTarget` (today's dollars) is a hard constraint on
  the `protect-survivor-liquidity` objective: a candidate whose survivor-year investable balance (deflated to
  today's dollars) falls below the target is disqualified with a readable violation. Absent = no floor.
- **Annuity purchase candidates.** The decision engine's `annuityPurchaseGenerator` proposes up to three
  bounded candidates — a cover-the-floor SPIA (cash/taxable-funded, 25% of the largest liquid balance, capped
  at $250k), a QLAC at the statutory cap (traditional-funded, deferred start at 80–85), and a no-purchase
  alternative — each priced on the exact ledger so the liquidity ↓ / durability ↑ / estate Δ trade-off is
  visible.

**Documented simplifications:** users enter annuity quotes (no pricing/rate tables); no variable/indexed
annuity products; estate/inheritance tax, probate, trusts, and legal-planning precision are out of scope.

**Code:** schema in [engine/model/plan.ts](../../app/src/engine/model/plan.ts) (`annuityPurchaseSchema`,
`estateBeneficiarySchema`, `heirTaxByClass`, `survivorReserveTarget`); purchase execution, QLAC RMD-base
exclusion, and exclusion-ratio taxation in
[engine/projection/simulate.ts](../../app/src/engine/projection/simulate.ts) and
[engine/rmd/](../../app/src/engine/rmd/); after-tax estate depth in
[engine/projection/compare.ts](../../app/src/engine/projection/compare.ts); candidates in
[engine/decisions/generators.ts](../../app/src/engine/decisions/generators.ts).

## 18. TIPS income floor: ladders, the SS bridge, and the funded ratio (opt-in)

Shipped 2026-07-08 (social-security-bridge-and-tips-ladder). All additive: `plan.incomeFloor` is optional
and absent means no behavior change (feature-off byte-identical, `cases:diff` clean).

- **Ladder construction.** A ladder (`tipsLadderSchema`) is a target level real income over a calendar
  window. Rungs are solved back-to-front — the last payout year is funded by its maturing principal alone,
  earlier years by principal plus the coupons of every still-outstanding rung (the standard
  tipsladder.com/Bogleheads construction). Each rung is a par TIPS whose coupon is the interpolated par real
  yield at its maturity, floored at the statutory 0.125% minimum; rungs are priced by discounting real cash
  flows on the same curve (par-yields-as-spot, planning grade). On a flat curve the total cost equals the
  level-annuity PV exactly (golden-tested).
- **Real-yield curve.** Embedded snapshot of the U.S. Treasury Daily Par Real Yield Curve Rates
  (`params/data/realYieldCurve2026.ts`; 5y 1.85 / 7y 2.05 / 10y 2.25 / 20y 2.55 / 30y 2.70 as of
  2026-06-30), linear interpolation, flat endpoints. Provenance id `real-yield-curve`; annual refresh per the
  maintenance schedule; the "curve as of" date is shown beside every quote.
- **Taxation (federal).** Coupons and the year's inflation accretion on outstanding face (phantom OID) are
  ordinary income and count as investment income for NIIT; maturing principal is a tax-free return of
  already-taxed dollars. Planning-grade OID: accretion is taxed as it accrues against the plan's inflation
  path, not a Form 1099-OID reproduction.
- **Taxation (state).** Interest on U.S. government obligations is exempt from state income tax in every
  state (31 U.S.C. §3124). New `TaxYearInput.usGovernmentInterest` carries the ladder's taxable interest and
  is subtracted from state taxable income by the modeled packs, prorated across split-year residency, and
  honored by the flat effective-rate override. Federal tax ignores the field.
- **Purchase & balance sheet.** An optional purchase event withdraws the quoted (inflation-scaled) cost from
  a cash/taxable/equity-comp account in the purchase year — a transfer, not spending; taxable sources realize
  gains pro-rata. A short funding account scales every rung down with a warning. Unmatured face (inflation-
  indexed book value) is reported as `YearResult.ladderValue` and counts in net worth (and thus the estate,
  passing untaxed like stepped-up taxable) but never in `investableTotal` — the withdrawal engine cannot raid
  the floor. Ladders held in IRAs are out of scope (model those as the account's own balance).
- **SS bridge.** `engine/ladder/bridge.ts` sizes the Bipartisan Policy Center bridge: pay yourself the
  forgone age-62 benefit (PIA × age-62 claim factor) from max(retirement year, age-62 year, next year)
  through the year before the chosen claim age. Surfaced as a one-click panel on the SS Optimizer with a
  same-path comparison (identical ledger + seeded MC paths) of claim-at-62 vs delay vs delay-plus-bridge,
  and as `bridgeLadderGenerator` decision candidates.
- **Funded ratio.** PV(guaranteed real income: SS + pensions + annuities + ladder flows) ÷ PV(required-floor
  spending), both read from the same deterministic ledger years, deflated to today's dollars, and discounted
  on the TIPS curve (Pfau's household funded-ratio lens). Shown on Results and the Income floor page;
  `income-floor-funded` fires below ~90%, `ss-bridge-gap` previews a sized bridge as a scenario.
- **FedInvest (opt-in only).** `engine/ladder/fedInvest.ts` fetches end-of-day TIPS prices
  (`securityPriceDetail`, CSV) on an explicit click — the app's only network request, carrying only a date,
  cached per day. FedInvest sends no CORS headers, so the browser may block it; the UI then offers a
  zero-network import of the user-downloaded `securityprice.csv`. Prices are a per-$100-face reference
  (FedInvest omits the inflation index ratio) — the embedded curve remains the planning source of truth.

**Documented simplifications:** annual coupons (real TIPS pay semiannually); no CUSIP lot rounding in core
mode; par-rung pricing on the par curve; planning-grade OID; taxable-side ladders only.

**Code:** math in [engine/ladder/](../../app/src/engine/ladder/); schema in
[engine/model/plan.ts](../../app/src/engine/model/plan.ts) (`tipsLadderSchema`, `incomeFloorSchema`); ledger
integration in [engine/projection/simulate.ts](../../app/src/engine/projection/simulate.ts); state exemption
in [engine/tax/stateTax.ts](../../app/src/engine/tax/stateTax.ts); UI in
[planner/sections/IncomeFloorSection.tsx](../../app/src/planner/sections/IncomeFloorSection.tsx) and the
bridge panel in [planner/SsAnalysisPage.tsx](../../app/src/planner/SsAnalysisPage.tsx).

## 19. Annuity payout forms, the annuitization sweep, pension lump-sum elections, and the HECM buffer (opt-in)

Shipped 2026-07-08 (the `annuity-pension-and-home-equity-decisions` plan).
All additive: every new field is optional with a no-op default, so plans that set none of them keep a
byte-identical projection.

- **Annuity payout forms.** `payoutForm` on an annuity account (absent = `lifeOnly`, the legacy behavior):
  - **Period certain** (`certainYears`): a life annuity with an N-year guarantee measured from the start
    age. If the owner dies inside the window, the remaining guaranteed payments continue to the household;
    after the window the annuity is life-contingent as usual.
  - **Joint & survivor** (`survivorPct`): payments continue to the other household member at that share for
    their lifetime (requires a two-person household).
  - **Exclusion-ratio taxation per form** (IRS Pub 939 General Rule, non-qualified purchases): life-only
    uses the Table V multiple (§17); period certain floors the multiple at the guaranteed years (the
    payment-side equivalent of Pub 939's refund-feature adjustment — documented approximation); joint &
    survivor decomposes by expectation — the full payment for the owner's Table V years plus the survivor
    share for the expected years the joint annuitant outlives them (joint last-survivor expectancy from the
    SSA-derived mortality model, per-sex where Pub 939's Tables VI/VIA are unisex — documented
    approximation). In every form the ratio is fixed at the starting date and a survivor/beneficiary
    continues the same excludable share until the investment is recovered (Pub 575/939 treatment).
- **Annuity ladders.** Multiple dated purchases are first-class: each annuity account funds and prices its
  own tranche at its own start age. The `annuityPurchaseGenerator` adds a laddered candidate (three tranches
  at now/+3y/+6y splitting the SPIA premium) beside the single purchase.
- **SPIA payout-rate defaults.** `engine/decisions/spiaQuotes.ts` carries the sourced planning table
  (public quote aggregators — Blueprint-Income-style marketplaces — mid-2026; 5.5% at 60 rising to 11% at
  85, life-only) used to size candidates and the sweep. A user-entered quote always wins; refresh with the
  annual packs.
- **Annuitization sweep.** `buildAnnuitizationSweep` (engine/decisions/annuitization.ts) sweeps a bounded
  grid of allocation percentages (default 0–30%) through the shared-path Monte Carlo primitive: each point
  adds a life-only SPIA purchase funded from the largest liquid account and reports success-rate/estate
  metrics on identical market paths — the success-vs-legacy frontier on the Monte Carlo page. **Kitces
  attribution:** when the funding account carries a static allocation, each point also evaluates an
  allocation-matched control that shifts the premium from bonds to US stocks *without* buying the annuity;
  control − baseline isolates the implicit rising-equity-glidepath share of the benefit, point − control is
  what annuitization adds beyond it (mortality credits, payout floor) net of lost liquidity.
- **Pension lump-sum offer & election.** `lumpSumOffer` (amount + election year) on a pension records the
  decision inputs without ledger effect; `lumpSumElection` commutes the pension — the offer rolls over
  **tax-free** into the named traditional account in the election year (direct rollover; no withholding or
  income) and the annuity never pays. The decision view (Accounts section) shows the annuity's PV at a
  curve-anchored discount rate (TIPS real yield at the horizon + assumed inflation), the survivor option's
  PV value, and a discount-rate × longevity sensitivity table — tradeoffs, never advice. The
  `pensionLumpSumGenerator` scenario pair and the `pension-election-pending` insight price the same
  mechanics on the exact ledger. Survivor rule matches the ledger: no survivor benefit if the owner dies
  before the start age.
- **HECM line of credit (buffer asset).** `hecm` on a primary-residence property models Pfau's strategy:
  - **Line size:** the user's lender-quoted `principalLimitPct`, else the pack's published principal-limit
    factors (HUD PLF tables at a 5.875% expected rate, 2026: 35.1% of value at 62 → 61.4% at 90, youngest
    borrower's age, provenance id `hecm-plf`). A warning fires if modeled before 62.
  - **Growth:** the principal limit and the loan balance both compound at `growthRatePct` (note rate +
    0.5% MIP; default 7.5%) — the unused line grows regardless of home value. `upfrontCostPct` finances
    origination/closing/initial-MIP into the loan at open.
  - **Draw policies:** `coordinated` draws for spending in the year after a negative market return
    (Monte Carlo / market-series behavior — deterministic runs have no down years); `lastResort` draws only
    when the portfolio cannot cover spending. Either way an open line backstops a true shortfall. Draws are
    loan proceeds: tax-free cash, never income or MAGI.
  - **Non-recourse:** at sale the payoff never exceeds what the sale nets and the line closes; in net worth
    (and thus the estate) each loan is capped at its home's value, so heirs are never charged for a loan
    that outgrew the house. Reported per year as `hecmDraw` / `hecmLoanBalance`.
- **Insights.** `annuitization-headroom` (planning age 95+ with liquid savings and no lifetime income beyond
  SS), `pension-election-pending` (undecided offer, quotes the PV comparison), and `hecm-buffer-candidate`
  (62+, primary home rivaling the portfolio, no HECM, no planned sale) — all preview scenario patches the
  exact ledger prices.

**Documented simplifications:** no live annuity or HECM quotes/lender data (user-entered terms + sourced
planning defaults); SPIA/DIA/QLAC family only (no variable/indexed annuities); no Medicaid or
estate-recovery modeling for the HECM; HECM servicing set-asides and T&I default triggers not modeled;
period-certain and joint exclusion multiples are planning-grade approximations of Pub 939 Tables III/VI/VIA
(method-checked, not table-reproduced); if the whole household dies inside a period-certain guarantee window,
the remaining certain payments a real contract would pay a beneficiary/estate are not modeled (no
post-household cash-flow path); the per-account estate breakdown covers investable classes only — property
net of the (non-recourse-capped) HECM loan rides through net worth without a breakdown row.

**Code:** schema in [engine/model/plan.ts](../../app/src/engine/model/plan.ts) (`annuityPayoutFormSchema`,
`pensionLumpSumOfferSchema`, `hecmLineOfCreditSchema`); form payout/taxation in
[engine/projection/annuityForms.ts](../../app/src/engine/projection/annuityForms.ts) and
[engine/projection/simulate.ts](../../app/src/engine/projection/simulate.ts) (HECM open/draw/payoff, pension
rollover); PV math + scenario pair in
[engine/decisions/pensionElection.ts](../../app/src/engine/decisions/pensionElection.ts); sweep in
[engine/decisions/annuitization.ts](../../app/src/engine/decisions/annuitization.ts); PLF table + provenance
in [engine/params](../../app/src/engine/params/data/year2026.ts); detectors in
[engine/insights/detectors/](../../app/src/engine/insights/detectors/); UI in
[planner/sections/AccountFields.tsx](../../app/src/planner/sections/AccountFields.tsx) and the sweep chart
in [planner/MonteCarloPage.tsx](../../app/src/planner/MonteCarloPage.tsx).
