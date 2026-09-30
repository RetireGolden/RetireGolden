# Social Security

RetireGolden's deepest single domain. It began as a standalone claiming/break-even calculator and is now
woven into the whole-plan projection: the real question it answers is *when should each person claim,
given everything else in the plan* (taxes, IRMAA, ACA, RMDs, portfolio growth) — not just the
benefit-only question. The pure SS math carried forward from the original app and was extended; the v1
claiming wizard UI was retired (its `/social-security` route now redirects to the planner).

**Code:** claiming/PIA math in [packages/engine/src/socialSecurity/](../../packages/engine/src/socialSecurity/)
(`nra.ts`, `benefitFactor.ts`, `claimFactor.ts`, `piaFromEarnings.ts`, `ssaWageData.ts`, `maritalBenefits.ts`,
`dualEntitlement.ts`, `survivorBenefit.ts`, `familyMaximum.ts`, `disability.ts`, `colaFactor.ts`,
`oasdiTaxRates.ts`, `cpiU.ts`); the analysis models in
[packages/engine/src/socialSecurity/analysis/](../../packages/engine/src/socialSecurity/analysis/)
(`breakEven.ts`, `expectedValue.ts`, `oasdiReturn.ts`, `survivorSwitching.ts`, `credits.ts`), with the one
survival curve in [montecarlo/survival.ts](../../packages/engine/src/montecarlo/survival.ts) (moved from
planner-ui by B2-P1 slice 4, 2026-09-27); import modules in
[packages/planner-ui/src/socialSecurity/](../../packages/planner-ui/src/socialSecurity/)
(`ssaStatementXml.ts`, `persistedSsGuard.ts`, `ssFormUtils.ts`); the analysis UI in
[planner/SsAnalysisPage.tsx](../../packages/planner-ui/src/planner/SsAnalysisPage.tsx) +
[planner/ssAnalysis.ts](../../packages/planner-ui/src/planner/ssAnalysis.ts) and entry in
[planner/SocialSecuritySection.tsx](../../packages/planner-ui/src/planner/SocialSecuritySection.tsx).

## The benefit base (PIA)

Each person's Primary Insurance Amount is entered one of two ways (a per-person toggle):

- **Quick PIA** — a benefit-at-FRA figure from a statement, with a disclosure that mySSA estimates
  *assume continued work through a stated age*, so the real PIA is lower if you stop earlier.
- **Earnings history** — paste `year amount` lines or **import mySSA XML** ([ssaStatementXml.ts](../../packages/planner-ui/src/socialSecurity/ssaStatementXml.ts)).
  The engine computes indexed earnings → **AIME** → **PIA** via the 90/32/15% bend-point formula for the
  ordinary old-age eligibility year ([piaFromEarnings.ts](../../packages/engine/src/socialSecurity/piaFromEarnings.ts)).

Methodology that matters for accuracy:

- **AIME** for an ordinary initial old-age benefit with no disability period or prior disability
  entitlement selects high years from a window running from 1951 or age 22, whichever is later, through the
  year before 62, drops the five lowest, and averages the remaining years (35 for anyone born after 1928) of
  indexed covered earnings; fewer years with earnings inserts **zeros**, lowering the average — the whole
  point of modeling early retirement honestly. That window is the elapsed-year span, not the statutory
  computation-base years through the year before first entitlement, so age-21 and
  age-62-through-pre-entitlement earnings do not enter
  (`usc-42-415-b-2-b-ii-iii-initial-computation-base-window`); a window starting at 1951 averages the elapsed
  years less five (`usc-42-415-b-2-a-i-computation-years-five-year-dropout`). Each year counts only up to that
  year's contribution and benefit base, SSA's figure for every year from 1937 (42 U.S.C. 415(e)(1);
  `usc-42-415-e-1-earnings-above-the-base-not-counted`); until 2026-09-27 years before 1979 were capped at
  the latest base instead, so a worker born in 1956 who earned $50,000 in 1978 was credited with the whole
  $50,000 rather than the $17,700 base (PIA $2,605.00 rather than $2,551.90).
- **Cost-of-living increases since eligibility**: the formula's PIA is that of the eligibility year, so the
  projection raises a PIA derived from earnings by SSA's published increases from that year through the year
  before the plan's first year, floored to the dime each time (42 U.S.C. 415(i)(2)(A);
  `usc-42-415-i-2-A-pia-cost-of-living-since-eligibility`), and uses the plan's COLA assumption, with a
  warning, for a year SSA has not announced. Until 2026-09-27 a person already past 62 lost every increase
  since eligibility (born 1960, $50,000 a year: $34,156.80 a year rather than $40,372.80). An entered PIA is
  taken as current.
- **Wage indexing** uses SSA's national Average Wage Index, with the numerator from the year **two years
  before eligibility**; bend points and wage bases are data-driven ([ssaWageData.ts](../../packages/engine/src/socialSecurity/ssaWageData.ts)).
  Each indexed year is floored to a whole dollar rather than rounded to the nearer penny
  (`cfr-20-404-211-d-3-indexed-earnings-nearer-penny`). If a required AWI or bend-point year is not in
  the published tables the engine uses the latest published figure as a stand-in and sets
  `usesStandInForFutureTables`. The error union has no `missing_awi` member;
  unpublished AWI years are not refused.
- **Early-retirement projection:** future years between the last earnings year and the declared retirement
  age are projected at an assumed salary (default: most recent year, wage-indexed/capped), then zeroed,
  but only inside the same age-22-through-year-before-62 window. Stopping at 62 and working through FRA
  currently fill the same years; retiring before 62 still zeros the remaining pre-62 years and yields a
  lower PIA. (The SSA statement overstates by assuming work to FRA; a naive zero-fill understates.)
- **Eligibility gate:** a 40-quarter / 10-year covered-work check warns when a worker may not qualify.

PIA has a **single source of truth** — it is managed only in the dedicated Social Security section; the
Income tab shows it read-only and links there.

## Claiming factors

Monthly granularity from 62 to 70 ([benefitFactor.ts](../../packages/engine/src/socialSecurity/benefitFactor.ts),
[socialSecurity/claimFactor.ts](../../packages/engine/src/socialSecurity/claimFactor.ts)): early
reduction 5/9%/mo for the first 36 months then 5/12%/mo; delayed credits 2/3%/mo to 70 (a lower rate by birth date before 1943). FRA by birth year
with the Jan-1 rule ([nra.ts](../../packages/engine/src/socialSecurity/nra.ts)).

## The benefit menu

Beyond personal retirement benefits, the household ledger models the core marital benefit menu; the
Benefits-only analysis separately illustrates survivor switching
([maritalBenefits.ts](../../packages/engine/src/socialSecurity/maritalBenefits.ts),
[analysis/survivorSwitching.ts](../../packages/engine/src/socialSecurity/analysis/survivorSwitching.ts)):

- **Dual entitlement to an own and a spouse benefit**, for a current spouse while both are alive and for a divorced spouse: the claimant is paid the own benefit plus the excess of half the worker's PIA over the own PIA, reduced by the spouse factor for the claimant's age in the first month of the spouse benefit (42 U.S.C. 402(q)(3)(B), 402(k)(3)(A); POMS RS 00615.250, and RS 00615.694 when the own benefit carries delayed credits: `max(own, min(own, ownPIA) + max(0, 0.5 × workerPIA - ownPIA) × spouse factor)`, [dualEntitlement.ts](../../packages/engine/src/socialSecurity/dualEntitlement.ts)). With deemed filing ([42 U.S.C. §402(r)](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section402&num=0&edition=prelim), for people who attain 62 after 2015), the spouse benefit starts in the later of the claimant's own claim and the month the worker's benefit starts, or for a divorced spouse the first month the ex is 62 throughout (POMS RS 00202.005 B.2.a), and the annual ledger pays the spouse benefit for the whole of the year it starts, so for an ex born in December after the 2nd it starts the year after the ex turns 62; the plan offers one claim age rather than a restricted spouse-only claim. The current-spouse excess alone is capped to the room left under the worker's SSA retirement/survivor family maximum. A two-person household and configured claim dates are the product's stand-ins for marriage and the months of application; they do not establish SSA eligibility or an actual entitlement month (`usc-42-402-q-3-B-k-3-A-current-spouse-dual-entitlement`, `usc-42-402-r-1-2-deemed-filing-old-age-and-spousal`). Until 2026-09-27 only simultaneous early claims got this composition; a worker filing later, a claimant with delayed credits and every divorced spouse got the larger of the own benefit and the reduced half. No child/dependent auxiliaries are modeled (`usc-42-402-d-2-child-survivor-benefit`).
- **Survivor step-up** after the first death: the survivor keeps the larger of their own benefit and the
  deceased's benefit, computed with full precision — the **survivor base is the deceased's PIA, or the
  deceased's actual benefit when that is larger** (delayed credits if the deceased delayed); the survivor
  reduction applies to it, and then, when the deceased claimed early, **RIB-LIM** holds an amount above both
  the deceased's actual benefit and 82.5% of the deceased's PIA to the larger of the two (42 U.S.C.
  402(e)(2)(D), POMS RS 00615.320; `poms-rs-00615-320-rib-lim-after-survivor-reduction`). When the
  deceased died **before claiming**, the survivor is paid from the year after the death (or from the survivor's
  own entered claim age, if later), whatever claim age the plan configured for the deceased, on the PIA plus only the delayed credits earned before death, with no early reduction
  and no RIB-LIM, as the statute gives it; the plan states a life age, not a death date, so the annual ledger
  treats December of the last year alive as the death month, and a real death earlier in that year would let
  the survivor be paid up to eleven months sooner
  (`usc-42-402-e-survivor-of-worker-who-died-before-claiming`). An
  **early-claim widow(er) reduction** (up to 28.5% at age 60, linear to the survivor's FRA) applies when the
  widow(er) benefit starts before the **survivor FRA**: it is measured from the first month of widow(er)
  entitlement, the later of the survivor's own claim and the January after the year of death (the first month the
  ledger pays it), not from an own claim made
  before the death (42 U.S.C. 402(q)(6)(A)(iii), (q)(3)(E);
  `usc-42-402-q-6-A-iii-widow-reduction-from-entitlement-month`). The survivor FRA follows the age-60-attainment statute: the retirement
  schedule two birth years later, from 65y2m for 1940 to 67 for 1962 and later
  (`usc-42-416-l-survivor-fra-age-60-attainment-cohorts`). The $255 lump-sum death payment is absent
  (`usc-42-402-i-lump-sum-death-payment`). Current-spouse survivor benefits are built before the earnings test, so they can be
  withheld for a working survivor and credited back through the same ARF path, which counts only the months of the
  widow(er) benefit's reduction period (before the survivor full-retirement-age month) in which that benefit itself was withheld, not months of the survivor's own benefit before the death or of a widow(er) or spouse benefit on another record (402(q)(7)). The widow's limit is on the deceased's benefit with the deceased's own crediting months, as if still living (POMS RS 00615.320 B.2.c, RS 00615.598; `poms-rs-00615-320-b-2-c-deceased-crediting-months`). The
  former-spouse survivor path
  takes the deceased ex's claim age as a user input.
- **Divorced-spousal** (10-year marriage, currently unmarried, ex calendar-year age 62+ — the ex need not
  have filed), priced by the same own-plus-reduced-excess composition as above. A claimant living alone is
  unmarried; a person in a couple is unmarried from the January after the current spouse's death, and the ex's
  record is priced from then (42 U.S.C. 402(b)(1)(C); POMS RS 00202.046;
  `usc-42-402-b-1-C-divorced-spouse-after-widowhood`). Until 2026-09-29 a couple member was never paid on a living
  ex's record. The engine does not carry worker entitlement, fully-insured status, or years since divorce,
  so an already-disability-entitled ex under 62 is refused and a not-yet-entitled age-62 ex divorced only
  one year is admitted (`cfr-20-404-331-living-divorced-spouse-eligibility`). **Former-spouse survivor
  benefits** use two explicit record types. A **`deceased`** record follows the ordinary-widow path: the
  modeled nine-month marriage duration, age-60, and remarriage gates, including after a remarriage at or
  after 60 while still married. A **`surviving-divorced`** record follows the surviving-divorced duration
  gate only: ten years immediately before divorce — no nine-month floor — plus the same historical
  remarriage-before-60 gate as the ordinary survivor path (`cfr-20-404-336-surviving-divorced-spouse-eligibility`).
  Saved plans that still store `relationship: deceased` for a deceased divorced ex keep the ordinary-widow
  nine-month path; choose **`surviving-divorced`** for the ten-year divorce-duration path. Both survivor
  record types share the same remaining modeled limits: the other entitlement requirements (fully insured,
  valid marriage, application — which may already be met under 404.335(b)(1)–(4) or 404.336(b)(1)–(4)
  without a new application — and the own-old-age-benefit restriction) are not adjudicated; the candidate
  menu does not compare own PIA or own benefit. A remarriage before 60 bars the survivor benefit while
  that later marriage lasts, and no longer once it has ended (POMS RS 00207.003): a claimant living alone is taken
  to be unmarried now, and a couple member to be married to the current spouse until the January after that
  spouse's death. Entitlement can begin only in the month that marriage ends, so the widow(er) reduction is
  measured from that January, not from the claimant's earlier own claim (402(q)(6)(A)(iii);
  `maritalBenefits.ts#formerSpouseSurvivorEntitlementAgeMonths`). The plan cannot say when a person living alone
  ended a later marriage, so it is taken to have ended before the claim; the analysis page says so when it
  applies. Until 2026-09-29 it was an unconditional forfeiture even for a claimant now single. A schema-valid coupled household with
  `remarriedAtAge: null` still receives a candidate without establishing a remarriage exception
  (`cfr-20-404-335-ordinary-widow-eligibility`). The nine-month statutory duration exceptions, the
  alternative 404.335(a)(3)/(a)(4) relationship qualifications, and the divorced-spouse
  remarriage-continuation exception are outside the Plan
  (`cfr-20-404-335-a-widow-duration-exceptions`,
  `cfr-20-404-332-b-3-divorced-spouse-remarriage-continuation`). A current spouse's later remarriage after
  the worker dies has no Plan input and is out of scope (`usc-42-402-e-1-a-current-survivor-remarriage-before-60`). A benefits-only
  **survivor↔personal switching** illustration (claim one benefit early, switch to the other
  later), with the earnings test on the widow(er)'s wages charged against the larger claimed benefit and each
  benefit credited from its own full retirement age, the widow(er) benefit also at 62 for the months withheld
  before 62 (20 CFR 404.412(b)). The whole-plan ledger has one stream `claimAge`, so it does not price that separate-date sequence.
  Survivors are exempt from deemed filing, so the switch is legally available; its absence from the Plan is
  registered as out of scope (`usc-42-402-r-survivor-deemed-filing-exemption`).
- Ex/deceased-spouse PIA is a simple user estimate (those earnings records are impractical to reconstruct).

## The earnings test

The year's Social Security is composed by one year function the projection and the Social Security analysis
models share ([socialSecurity/householdYear.ts](../../packages/engine/src/socialSecurity/householdYear.ts),
`social-security-benefit-annual`), month by month where a month can differ: a stream's first paying month, the
months both spouses are paid, and each full-retirement-age month. The earnings test
([socialSecurity/earningsTest.ts](../../packages/engine/src/socialSecurity/earningsTest.ts)) then works as the law
does (42 U.S.C. 403(b) and (f); 20 CFR 404.415 to 404.440), decided under D-SS-ANALYSIS-EARNINGS-TEST
(2026-09-29):

- **Excess earnings.** Before the calendar year of full retirement age, half the wages above the lower exempt
  amount; in that year, a third of the wages of the months before the full-retirement-age month above the higher
  amount; nothing from that month on. The excess is reduced to the next lower dollar (403(f)(3);
  `usc-42-403-f-3-retirement-earnings-test`, `usc-42-403-f-3-fra-year-months-before-fra`). The full-retirement-age
  month comes from the date of birth, so for the 1955 to 1959 cohorts it can fall in the year after the whole-year
  age.
- **Charged month by month from January** (403(f)(1); `usc-42-403-f-1-earnings-test-month-charging`). In a couple the
  worker, the higher PIA, is charged first against all of his benefits and the family benefit on his record: his
  old-age benefit, any benefit he is paid on a former spouse's record, and the spouse benefit on his record
  (403(b)(1); POMS RS 02501.145). A month his excess only partly covers is charged to each record in proportion to
  what that record pays him (RS 02501.145 B.2), and what is left of the family benefit on his own record is
  shared two to one on the benefits before any reduction, each share held to what that person is due (20 CFR
  404.434(b), 404.439, 404.440; `usc-42-403-b-1-worker-excess-charged-to-family`). Each person's own excess is
  then charged against what is left of that person's benefits, the own old-age benefit included in months his
  excess took her spouse benefit (POMS RS 02501.150 A.1). A person paid on two records is charged on both: a
  partial month in proportion to the benefits due on each before any deduction for work, the other record no
  more than what the worker's charge left of it (RS 02501.145 B.2, RS 02501.150 A.2). So both of that person's
  benefits have a deduction, and a crediting month, in any month the person's own excess is charged.
- **Crediting months.** Each month with a full or partial deduction in a benefit's reduction period, from the
  claim's first month to the month before full retirement age (the survivor one for a widow(er) benefit), is a
  crediting month for that benefit (402(q)(7); POMS RS 00615.482; `poms-rs-00615-482-arf-crediting-months`), and
  the adjustment takes effect in the full-retirement-age month, not in January (20 CFR 404.412(b);
  `cfr-20-404-412-b-arf-effective-fra-month`). A month the claim-year convention pays before a benefit's first
  month of entitlement is paid in full and never charged (403(f)(1)(A): no excess is charged to a month "for
  which such individual was not entitled to a benefit"), so every month charged before full retirement age is
  credited, except a widow(er) benefit's months after the survivor full retirement age. A widow(er) benefit
  that starts before 62 is also adjusted at 62 for the months withheld before it (404.412(b)); only the survivor
  switching panel has such a benefit, since a claim age is at least 62.
- **Rounding.** Only the excess is rounded. Benefits and the partial-month shares are not: SSA reduces each
  monthly benefit to the next lower dollar after all deductions (20 CFR 404.304(f)), so a month here can be up to
  a dollar above SSA's.
- **Stated limits.** Wages are the plan's wage rows, whole calendar years spread evenly over their months, so a
  job that ends partway through a year is tested as if it ran all year, and there is no grace year or
  non-service month (`cfr-20-404-435-grace-year-monthly-earnings-test`). Only wage streams are earnings: income
  entered as other income, such as part-time work, names no person and is not tested
  (`usc-42-403-f-5-earnings-counted`). After the latest published year the exempt amounts grow at the plan's
  inflation (`usc-42-403-f-8-earnings-test-exempt-amounts`). A disability beneficiary is tested against
  substantial gainful activity instead.

Until 2026-09-29 the test was one annual amount against the person's own benefit: the worker's wages never
reduced his spouse's benefit, the whole of the full-retirement-age year was tested, the months withheld were a
rounded share of the year, and the adjustment took effect in January.

## Program parameters

COLA (data-driven, 2.8% for 2026), the taxable wage base, the **earnings test** for claimants working
before FRA **with the FRA credit**, and an optional **trust-fund haircut** toggle (~17%
benefit reduction from ~2034 per the 2026 Trustees Report, user-adjustable year and %). **WEP/GPO are not modeled.**
The Social Security Fairness Act repeal makes that absence correct for benefits payable in the planner's
2026+ projection horizon (`pl-118-273-sec-2-3-wep-gpo-repeal`). Benefit taxation (provisional-income 0/50/85% tiers) lives in
the [tax engine](taxes.md).

## Whole-plan claiming analysis

The headline capability. Two complementary views, mirroring the two questions in the literature:

- **"In your plan" (whole-plan sweep)** — the engine sweeps every whole-year claim-age combination of the
  plan's open claims, from 62 (or the age reached this year, if later) to 70 (9 single, up to 9×9 couple), runs the full
  projection for each, and ranks them by the selected shared decision-engine objective
  ([decisions/claimAgeSweep.ts](../../packages/engine/src/decisions/claimAgeSweep.ts),
  `social-security-claim-age-sweep`). **Ending after-tax estate** (traditional balances haircut by an
  heir-tax-rate assumption) remains the default; the same exact-ledger evaluations can also be re-ranked by
  spending durability, lifetime tax subject to an estate floor, survivor-year liquidity (offered only when the
  plan has years with one spouse surviving), or bridge-year durability, with an optional Monte-Carlo success-%
  check on the finalists. The winner's change is signed and measured against the plan as entered, claim months
  included, in dollars of the plan's last year, which the page names. Bridge durability and survivor liquidity
  compare a claim age on the after-tax estate instead when it, or the plan as entered, has no bridge or survivor
  years, and the page says which: "your plan as entered has no bridge years to compare against" (then every claim
  age), or how many claim ages leave none. The robustness check is offered only on a ranking the page stands
  behind, not when it has refused to rank.
  Each runs through the same tax/withdrawal fixed-point engine with the plan's own Roth conversion strategy
  held as it is, so the sweep prices the real trade-offs: the **tax torpedo** (an extra IRA dollar dragging
  benefits into taxable income), the **bridge-years** play (delaying to 70 to open low-income years for cheap
  conversions, which this sweep captures only when the plan's conversions are a bracket fill that resizes to
  each claim age; a fixed schedule stays as entered), and the counter-case (claim early so a Roth keeps
  compounding). No new solver is needed; claim age is a small discrete grid.
  - **Claims already made are not swept.** A claim whose year (birth year plus claim years) is before the plan's
    start year is history: an early claim cannot be paid for months before its application (20 CFR
    404.621(a)(3)), and undoing one takes a withdrawal within 12 months with every benefit repaid (404.640) or a
    suspension from full retirement age (42 U.S.C. 402(z)), neither modeled. Such a claim is held as it is in
    every row, and when every claim is made the page says who claimed and when. The benefits-only ranking, the
    bridge panel's earliest-claim comparison, the Optimize page's co-optimization and the Scenarios page's
    claim-age lever (which also skips a claim age the person has already passed) use the same test
    (`socialSecurity/openClaims.ts`).
  - **No ranking against an unpriced premium credit.** All Social Security counts in the income the premium tax
    credit depends on, in the years it is paid (26 U.S.C. 36B(d)(2)(B)(iii)), so a credit the ledger cannot price
    could change which claim age comes out ahead, in either direction. When the plan has such a Marketplace year,
    no claim age is ranked and the page names each such year with its own reason (figures not yet published for
    the year, guardrail spending, income below the poverty line, a calculation that did not settle); the table
    still shows each claim age without the credit in those years.
  - A disability benefit paid from its onset has no claim age to sweep: the page says so, naming the person, holds
    it as the plan pays it and compares the partner's claim ages. The Benefits-only tab prices a couple's claims as
    pairs of claim ages and cannot place a disability benefit on that grid, so it ranks neither and says so.
  - **Refine to the month** tries every claim month within a year of the whole-year pick, one person at a time,
    ranked on the same objective: a month is taken only when it meets the objective's constraints and ranks
    strictly higher (`social-security-claim-age-monthly-refinement`). When none does, the page says no month
    within a year of the pick ranks higher. The refinement and the robustness table are dropped when the plan or
    the ranking changes.
  - **How it differs from the Optimize page's claim-age option.** This sweep tries every whole year and keeps the
    plan's conversions; the Optimize page re-optimizes conversions but tries only 62, full retirement age and
    70, one person at a time, compares on after-tax estate alone and needs a $1,000 margin
    (`claim-age-co-optimization`). The two can pick different ages, and a gain shown here is measured with the
    plan's own conversions.
- **"Benefits only" (actuarial view)** — the Open-Social-Security-style lens: expected present value per
  claim age, each future **year** weighted by survival probability (the engine's one survival curve on the SSA
  period table) and discounted at a user-set **real** rate (~long TIPS yield)
  ([socialSecurity/analysis/expectedValue.ts](../../packages/engine/src/socialSecurity/analysis/expectedValue.ts),
  `social-security-expected-value`). It needs no accounts and serves as the cross-check against Open Social
  Security. Since B2-P1 slice 4 (owner decision R7) each year's benefits follow the ledger's own Social Security
  rules, and since D-SS-ANALYSIS-EARNINGS-TEST (2026-09-29) each path the value weights, both spouses alive or one
  surviving a death in a given year, is priced year by year by the ledger's own year function
  ([analysis/householdPaths.ts](../../packages/engine/src/socialSecurity/analysis/householdPaths.ts)): the claim
  factor with its months; while both spouses are alive, the lower earner's own benefit plus the spouse excess
  reduced for their age when the spouse benefit starts; after the first death, the larger of the survivor's own
  benefit and the widow(er) benefit on the deceased's actual benefit (or, if the deceased had not claimed, the
  benefit for the month before the death), reduced for the survivor's age in the first month of widow(er)
  entitlement and held to the widow's limit when the deceased claimed early; the former-spouse benefits the ledger
  pays, for a couple member as for a person living alone; and the earnings test on the plan's wages, with its
  crediting months. A COLA below the plan's inflation, or a benefit cut, lowers the later years. Each person keeps
  one claim age, so a survivor cannot take the survivor benefit first and their own later in this view (the
  switching panel covers a widow(er) living alone). A benefit the ledger pays as a disability benefit from its
  onset has no claim age to rank, and the page says so.

The benefits-only view uses the plan's Social Security rules. When the plan's wages hold back part of someone's
benefit at a claim age the ranking prices, the page names that person and the claim ages (each ranking row carries
`withheldBy`); the values count it. The two views differ by taxes, portfolio growth and the plan's fixed planning
ages, which the benefits-only view replaces with survival odds, and by one claim age per person. Two limits the
page states when they apply: income entered as other income is not tested, and a couple member's former-spouse
record with a remarriage before 60 is read as the current marriage (blank, it is priced as no remarriage). On
example-couple the 2% headline moved from 70/62 ($865k) to 70/63 ($860k): Sam's claims at 62 and 63 are withheld
from their first month of entitlement while she works to 64, and the months of each claim year before it are paid.
The five other couple examples' ranking rows differ from before this decision by at most 2e-15 of their value,
because the paths are summed in a different order; no displayed figure moves.

The Roth & Tax Optimizer can also **co-optimize the claim age jointly with a conversion schedule** — a
default-off "Also optimize Social Security claim age" toggle on the Optimize tab runs a full optimize per
bounded claim candidate and applies the winning claim change and schedule together — see
[optimizer.md](optimizer.md). It refuses in the same words as the sweep when every claim is already made or a
premium credit year cannot be priced.

## Break-even education

A straight cumulative break-even chart plus a growth-adjusted view (0/3/5/7% return), framed as a
pedagogical lens *alongside* the whole-plan sweep
([socialSecurity/analysis/breakEven.ts](../../packages/engine/src/socialSecurity/analysis/breakEven.ts),
`social-security-claim-break-even`). Its dollars are the plan's (owner decision R6): each year's benefit is the
start-year PIA times the claim factor times the ledger's own cost-of-living factor and benefit cut for that
year, the same factors the projection multiplies by, and the crossing ages are found on the unrounded totals.
Each year is priced by the ledger's year function for the person's own benefit alone, so the person's wages have
the earnings test hold back part of it before full retirement age and the months held back raise it from then;
the page names the person at those claim ages. Nothing else on the record is charged.
The Social Security step's AIME explainer counts the averaged $0 years from the engine's computation and
recomputes the gain from replacing the latest $0 year exactly through the benefit formula
(`zero-year-replacement-gain`, R9), in the dollars of the PIA the step shows (with the cost-of-living increases
since eligibility); for someone 62 or older that year has passed, and the step says what it would have added had
it been worked. The credit note counts each year's credits at SSA's
quarter-of-coverage amount for that year (`covered-work-credit-estimate`). On-page copy is lean; the conceptual narrative
(what break-even is, COLA, common mistakes, why the whole-plan sweep is the better answer) lives in the
[Learning Center](learning-center.md), which deep-links into the chart.

## "What you paid in vs. what you get back"

An education/context readout (not a working-years tax inside the projection — `simulate` never taxes
pre-retirement wages): the engine ([socialSecurity/analysis/oasdiReturn.ts](../../packages/engine/src/socialSecurity/analysis/oasdiReturn.ts),
owner decision R8) sums the **OASDI** payroll tax over the entered earnings history ("paid in so far") and over the
projected work the PIA counts, the years its earnings projection fills ("what your projected work will pay",
at today's rate and wage cap for a year not yet set), so both sides of the ratio cover the same career, each year
at that year's
effective rate (SSA's table, [oasdiTaxRates.ts](../../packages/engine/src/socialSecurity/oasdiTaxRates.ts):
5.4% for employees in 1984, 4.2% in 2011-2012, and the self-employed rates) on the earnings capped at that
year's wage base from 1937, OASDI-only (not the 1.45% Medicare HI), and restates it in today's dollars by the
BLS CPI-U annual averages ([cpiU.ts](../../packages/engine/src/socialSecurity/cpiU.ts)) with no interest. Beside it
are the benefits the person is paid (on their own record, or a former spouse's when larger): those already
received (at the start-year amount, in full, since the plan does not record what was held back before it
starts) and the survival-weighted expected PV of the rest at the stream's claim age, with the earnings test on
the person's wages and, in a couple, a living ex's record from the January after the spouse's death, and their
ratio to the tax paid. A benefit paid as a disability benefit from its onset has no claim age to price,
and the panel says so instead of showing a ratio. Shown as a
collapsible panel on the Social Security analysis page with a self-employed toggle and caveats (individual
illustration, not the program's actuarial return; excludes disability and survivor insurance value, benefits paid
to others on the record, and Medicare).

## Disability (SSDI)

A disabled worker receives their **full PIA with no early-retirement reduction** — the defining difference
from early *retirement* claiming — starting with the first month after a **five-month waiting period**
(42 U.S.C. 423(a)(1), (c)(2)). The input is the year and month the disability began (`disability.onsetAge`,
the age attained in the onset year, and the optional `disability.onsetMonth`), a planning assumption, not a
medical adjudication. A month counts toward the waiting period only when the disability began on or before
its first day (POMS DI 10105.070), so the engine reads a given month as an onset after the 1st (first payment
for the sixth month after it) and a blank month as January 1 (first payment for June, seven months in the
onset year, the largest amount the statute allows). The editor collects the month and the calendar year.
SSDI is gated by **Substantial Gainful Activity** (earnings above the SGA limit suspend it; annual
approximation), **converts to the retirement benefit at FRA at the same dollar amount** (continuous — the
PIA persists, with no delayed-retirement credits; in the FRA year `ssdiPaid` carries only the months before
the FRA month), and is taxed under the same provisional-income tiers as retirement benefits. When the first
payable month is at or after the month FRA is attained there is no disability benefit: the stream is priced
as a retirement claim at its claim age and the projection says so. An off-by-default `disability` input on
the SS stream drives the pure `socialSecurity/disability.ts` helper (`ssdiSchedule`, `ssdiMonthsInYear`) and
the year function `socialSecurity/householdYear.ts` (called by the `projection/internal/annualSocialSecurity.ts` annual phase); `simulatePlan` still owns the annual
input/effect wiring, and SGA lives in the parameter pack. Documented simplifications / registered gaps: the
onset date changes the SSDI payment path but does not change the earnings helper's ordinary retirement
indexing year, computation-year count, or bend points — it is a planning assumption, not an SSA disability
or insured-status adjudication (`usc-42-415-b-2-b-disability-freeze-aime-exclusion`); the waiting period's
stated limits (an onset on the 1st paid one month late, a timely application assumed, no re-entitlement or
ALS exception; `usc-42-423-c-2-ssdi-five-month-waiting-period`), trial-work / EPE annual approximations
(`cfr-20-404-1592-trial-work-period`, `cfr-20-404-1592a-extended-period-of-eligibility`), the 24-month
Medicare wait (note-only), and living-child auxiliaries (`usc-42-402-d-2-ssdi-child-auxiliary`). The
current-spouse auxiliary and family maximum on an SSDI worker are produced by the generic paths with
registered approximations (`usc-42-402-c-2-ssdi-spouse-auxiliary`, `usc-42-403-a-6-ssdi-family-maximum`).
Cited in [domain rules §4](../domain/domain-rules-reference/04-social-security-program-parameters-2026.md).

## Documented simplifications / deferred

- **Disability (SSDI)** is modeled (worker's own SSDI from the first month after the five-month waiting
  period + FRA conversion; see above). The disability freeze, the waiting period's day-of-month and
  application-timing limits, trial-work / EPE, and 24-month Medicare wait are registered approximations or
  note-only absences; living-child auxiliaries remain out of scope. Spouse auxiliary and family maximum on
  SSDI are produced via the generic retirement/survivor paths with the named approximation records above.
- Deemed-filing nuances are simplified; the family maximum is modeled for the current-spouse auxiliary only
  because child/dependent auxiliaries are not yet modeled.
- Survivor-benefit **documented simplifications** (the early-claim reduction, RIB-LIM after it, and the
  deceased's claim-age-adjusted base are all modeled; what remains simplified): living
  divorced-spouse eligibility uses a calendar-year age-62 blanket and omits worker entitlement, fully-insured status,
  and the two-year independently entitled path (`cfr-20-404-331-living-divorced-spouse-eligibility`); ordinary-widow
  eligibility on `relationship: deceased` treats remarriage before 60 as an unconditional historical forfeiture
  even when the claimant is now single, and a coupled household with `remarriedAtAge: null` still receives a
  candidate without establishing a 404.335(e) exception (`cfr-20-404-335-ordinary-widow-eligibility`); surviving-divorced
  eligibility on `relationship: surviving-divorced` applies only the ten-year divorce-duration gate plus the same
  historical remarriage gate — not full surviving-divorced entitlement, not the ordinary-widow nine-month path, and
  not survivor pricing or remarriage adjudication beyond those modeled gates
  (`cfr-20-404-336-surviving-divorced-spouse-eligibility`); the nine-month statutory duration exceptions, the
  alternative 404.335(a)(3)/(a)(4) relationship qualifications, and the divorced-spouse remarriage-continuation
  exception are outside the Plan
  (`cfr-20-404-335-a-widow-duration-exceptions`,
  `cfr-20-404-332-b-3-divorced-spouse-remarriage-continuation`); separate survivor-vs-own claim ages for a
  current spouse (the step-up is paid from the survivor's own claim age, and reduced from the later of that claim
  and the month of death); the disabled-widow(er) age-50 entry point.

(The original social-security research audit flagged divorced-spousal and former-spouse survivor
benefits as missing; both have since shipped.)
