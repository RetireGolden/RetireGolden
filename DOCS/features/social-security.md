# Social Security

RetireGolden's deepest single domain. It began as a standalone claiming/break-even calculator and is now
woven into the whole-plan projection: the real question it answers is *when should each person claim,
given everything else in the plan* (taxes, IRMAA, ACA, RMDs, portfolio growth) — not just the
benefit-only question. The pure SS math carried forward from the original app and was extended; the v1
claiming wizard UI was retired (its `/social-security` route now redirects to the planner).

**Code:** claiming/PIA math in [packages/planner-ui/src/socialSecurity/](../../packages/planner-ui/src/socialSecurity/) (`nra.ts`,
`benefitFactor.ts`, `piaFromEarnings.ts`, `ssaWageData.ts`, `familyMaximum.ts`, `ssaStatementXml.ts`, `breakEven.ts`,
`explain.ts`, `maritalBenefits.ts`, `survivorSwitching.ts`, and — since the 2026-07-08 consolidation —
`claimFactor.ts` and `expectedPv.ts`, formerly `engine/socialsecurity/`); the
analysis UI in [planner/SsAnalysisPage.tsx](../../packages/planner-ui/src/planner/SsAnalysisPage.tsx) +
[planner/ssAnalysis.ts](../../packages/planner-ui/src/planner/ssAnalysis.ts) and entry in
[planner/SocialSecuritySection.tsx](../../packages/planner-ui/src/planner/SocialSecuritySection.tsx).

## The benefit base (PIA)

Each person's Primary Insurance Amount is entered one of two ways (a per-person toggle):

- **Quick PIA** — a benefit-at-FRA figure from a statement, with a disclosure that mySSA estimates
  *assume continued work through a stated age*, so the real PIA is lower if you stop earlier.
- **Earnings history** — paste `year amount` lines or **import mySSA XML** ([ssaStatementXml.ts](../../packages/planner-ui/src/socialSecurity/ssaStatementXml.ts)).
  The engine computes indexed earnings → **AIME** → **PIA** via the 90/32/15% bend-point formula for the
  correct eligibility year ([piaFromEarnings.ts](../../packages/engine/src/socialSecurity/piaFromEarnings.ts)).

Methodology that matters for accuracy:

- **AIME** uses up to **35 years** of indexed covered earnings; fewer than 35 inserts **zeros**, lowering
  the average — the whole point of modeling early retirement honestly.
- **Wage indexing** uses SSA's national Average Wage Index, with the numerator from the year **two years
  before eligibility**; bend points and wage bases are data-driven ([ssaWageData.ts](../../packages/engine/src/socialSecurity/ssaWageData.ts)).
  If a required AWI year isn't in the table the engine returns a `missing_awi` error rather than guessing.
- **Early-retirement projection:** future years between the last earnings year and the declared retirement
  age are projected at an assumed salary (default: most recent year, wage-indexed/capped), then zeroed —
  so a worker retiring at 55 vs 62 vs working-to-FRA gets three visibly different PIAs from the same
  history. (The SSA statement overstates by assuming work to FRA; a naive zero-fill understates.)
- **Eligibility gate:** a 40-quarter / 10-year covered-work check warns when a worker may not qualify.

PIA has a **single source of truth** — it is managed only in the dedicated Social Security section; the
Income tab shows it read-only and links there.

## Claiming factors

Monthly granularity from 62 to 70 ([benefitFactor.ts](../../packages/engine/src/socialSecurity/benefitFactor.ts),
[socialSecurity/claimFactor.ts](../../packages/engine/src/socialSecurity/claimFactor.ts)): early
reduction 5/9%/mo for the first 36 months then 5/12%/mo; delayed credits 2/3%/mo to 70. FRA by birth year
with the Jan-1 rule ([nra.ts](../../packages/engine/src/socialSecurity/nra.ts)).

## The benefit menu

Beyond personal retirement benefits, the household ledger models the full eligibility menu
([maritalBenefits.ts](../../packages/engine/src/socialSecurity/maritalBenefits.ts),
[survivorSwitching.ts](../../packages/planner-ui/src/socialSecurity/survivorSwitching.ts)):

- **Spousal top-up** while both are alive and claiming: the lower earner receives
  `max(own, 0.5 × spousePIA × spousal factor)`. The current-spouse auxiliary is capped to the room left
  under the worker's SSA retirement/survivor family maximum (PIA-based formula with official family-maximum
  bend points in `ssaWageData.ts`); no child/dependent auxiliaries are modeled.
- **Survivor step-up** after the first death: the survivor keeps the larger of their own benefit and the
  deceased's benefit, computed with full precision — the **survivor base is the deceased's actual
  (claim-age-adjusted) benefit** (including delayed credits if the deceased delayed), **RIB-LIM** caps it at
  `max(deceased's actual benefit, 82.5% × deceased's PIA)` when the deceased claimed early, and an
  **early-claim widow(er) reduction** (up to 28.5% at age 60, linear to the survivor's FRA) applies when the
  survivor claims before their **survivor FRA** (a separate, earlier schedule than retirement FRA — 66y8m for
  those born 1960+). Current-spouse survivor benefits are built before the earnings-test pass, so they can be
  withheld for a working survivor and credited back through the same ARF path. The former-spouse survivor path
  takes the deceased ex's claim age as a user input.
- **Divorced-spousal** (10-year marriage, currently unmarried, ex eligible at 62+ — the ex need not have
  filed), **survivor benefits for already-widowed single users**, remarriage-before/after-60 rules, and
  **survivor↔personal switching** strategies (claim one benefit early, switch to the other later).
- Ex/deceased-spouse PIA is a simple user estimate (those earnings records are impractical to reconstruct).

## Program parameters

COLA (data-driven, 2.8% for 2026), the taxable wage base, the **earnings test** for claimants working
before FRA (own, spousal, former-spouse, and survivor benefits withheld over the annual limit) **with the FRA
credit** — withheld months are credited back at FRA by recomputing the relevant retirement/spousal/survivor
factor as if claimed that many months later (SSA's adjustment of the reduction factor), on an annual
approximation — and an optional **trust-fund haircut** toggle (~17%
benefit reduction from ~2034 per the 2026 Trustees Report, user-adjustable year and %). **WEP/GPO are not modeled** — repealed by the
Social Security Fairness Act (January 2025). Benefit taxation (provisional-income 0/50/85% tiers) lives in
the [tax engine](taxes.md).

## Whole-plan claiming analysis

The headline capability. Two complementary views, mirroring the two questions in the literature:

- **"In your plan" (whole-plan sweep)** — the engine sweeps every claim-age combination (9 single, up to
  9×9 couple), clones the plan, sets the claim ages, and runs the full projection for each, ranking by
  the selected shared decision-engine objective. **Ending after-tax estate** (traditional balances haircut by
  an heir-tax-rate assumption) remains the default; the same exact-ledger evaluations can also be re-ranked
  by spending durability, lifetime tax subject to an estate floor, survivor-year liquidity, or bridge-year
  durability, with an optional Monte-Carlo success-% check on the finalists.
  Each runs through the same tax/withdrawal fixed-point engine, so the sweep prices the real trade-offs —
  the **tax torpedo** (an extra IRA dollar dragging benefits into taxable income), the **bridge-years**
  play (delaying to 70 to open low-income years for cheap conversions), and the counter-case (claim early
  so a Roth keeps compounding). No new solver is needed — claim age is a small discrete grid.
- **"Benefits only" (actuarial view)** — the Open-Social-Security-style lens: expected present value per
  claim age, each future month weighted by survival probability (SSA period tables, optionally the
  longevity multiplier) and discounted at a user-set **real** rate (~long TIPS yield)
  ([socialSecurity/expectedPv.ts](../../packages/planner-ui/src/socialSecurity/expectedPv.ts)). It needs no
  accounts and serves as the cross-check against Open Social Security.

When the two views disagree, that gap *is* the insight: how far tax and portfolio effects pull the answer
away from the actuarially fair claim age.

The Roth & Tax Optimizer can also **co-optimize the claim age jointly with a conversion schedule** — a
default-off "Also optimize Social Security claim age" toggle on the Optimize tab runs a full optimize per
bounded claim candidate and applies the winning claim change and schedule together — see
[optimizer.md](optimizer.md).

## Break-even education

A straight cumulative break-even chart plus a growth-adjusted view (0/3/5/7% return), framed as a
pedagogical lens *alongside* the whole-plan sweep ([breakEven.ts](../../packages/planner-ui/src/socialSecurity/breakEven.ts),
[explain.ts](../../packages/planner-ui/src/socialSecurity/explain.ts)). On-page copy is lean; the conceptual narrative
(what break-even is, COLA, common mistakes, why the whole-plan sweep is the better answer) lives in the
[Learning Center](learning-center.md), which deep-links into the chart.

## "What you paid in vs. what you get back"

An education/context readout (not a working-years tax inside the projection — `simulate` never taxes
pre-retirement wages): a pure helper ([socialSecurity/ficaReturn.ts](../../packages/planner-ui/src/socialSecurity/ficaReturn.ts))
sums the **OASDI** payroll tax (employee 6.2% / self-employed 12.4%, capped at each year's taxable wage base,
OASDI-only — not the 1.45% Medicare HI) over the entered earnings history, beside the survival-weighted
expected PV of lifetime benefits at the chosen claim age (reusing the tested `expectedPvSingle` path).
Shown as a collapsible panel on the Social Security analysis page with a self-employed toggle and heavy
caveats (individual illustration, not the program's actuarial return; excludes disability/survivor insurance
value, spousal benefits, and Medicare). The OASDI rate lives in the parameter pack.

## Disability (SSDI)

A disabled worker receives their **full PIA with no early-retirement reduction** — the defining difference
from early *retirement* claiming — starting at a disability-onset age (an input, not a medical adjudication).
SSDI is gated by **Substantial Gainful Activity** (earnings above the SGA limit suspend it; annual
approximation), **converts to the retirement benefit at FRA at the same dollar amount** (continuous — the
PIA persists, with no delayed-retirement credits), and is taxed under the same provisional-income tiers as
retirement benefits. An off-by-default `disability` input on the SS stream drives the pure
`socialSecurity/disability.ts` helper + `simulate` Pass 3 wiring; SGA lives in the parameter pack. Documented
simplifications: the disability freeze (AIME exclusion), trial-work period, the 24-month Medicare wait, and
auxiliary/family benefits are not modeled. Cited in [domain rules §4](../domain/domain-rules-reference.md).

## Documented simplifications / deferred

- **Disability (SSDI)** is modeled (worker's own SSDI + FRA conversion; see above). The disability freeze,
  trial-work period, 24-month Medicare wait, and auxiliary/family-maximum on SSDI are documented
  simplifications.
- Deemed-filing nuances are simplified; the family maximum is modeled for the current-spouse auxiliary only
  because child/dependent auxiliaries are not yet modeled.
- Survivor-benefit **documented simplifications** (the early-claim reduction, RIB-LIM, and the deceased's
  claim-age-adjusted base are all modeled; what remains simplified): the 2-years-since-divorce
  "independently entitled" rule for divorced-spousal on a living ex; separate survivor-vs-own claim ages for a
  current spouse (the step-up uses the survivor's own claim age); the disabled-widow(er) age-50 entry point.

(The original social-security research audit flagged divorced-spousal and survivor-for-widowed-singles
as missing; both have since shipped.)
