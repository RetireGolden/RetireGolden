# Insurance modeling (LTC + permanent life)

RetireGolden models two insurance instruments that materially alter a household plan: **long-term-care
(LTC)** and **permanent life** (whole / CompLife / universal). They share a shape — a premium expense
stream plus a conditional payout that lands somewhere in the ledger — so they live in one model. Both
are common real-household instruments whose effects a planner that ignored them would misstate.

Code: schema in [engine/model/plan.ts](../../app/src/engine/model/plan.ts) (`plan.insurance`); deterministic
behavior in [engine/projection/](../../app/src/engine/projection/) (see `insurance.test.ts`); the
Monte-Carlo LTC shock and mortality model in
[engine/montecarlo/ltcShock.ts](../../app/src/engine/montecarlo/ltcShock.ts) and
[mortality.ts](../../app/src/engine/montecarlo/mortality.ts).

## How it attaches to the engine

Insurance reuses hooks the engine already had: the **survivor transition** in `simulate.ts` (filing-status
switch, SS survivor step-up, longevity horizon) is where a death benefit pays out; the **expense model**
(phased/one-time spending) carries premiums and a care-cost spike; and **Monte Carlo** wraps the same
ledger, so an LTC shock is one more per-path event alongside the return draws.

## Data model

`plan.insurance` is a top-level list (Zod default `[]`, no migration — `CURRENT_PLAN_SCHEMA_VERSION` stays
1, following the `stateMoves` pattern), discriminated by `kind`. Premiums share a shape across kinds:
`premiumMode` is `lifetime` (charge `annualPremium` every year), `paidUp` (charge nothing), or `untilAge`
(charge through `premiumEndAge`).

- **`kind: 'ltc'`** — owner, premium, `benefitMonthly`, `benefitPeriodYears` (or `'lifetime'`),
  `eliminationPeriodDays`, optional compound `inflationRiderPct` on the benefit cap.
- **`kind: 'permanentLife'`** — insured, beneficiary (`PersonId | 'estate'`), premium, `deathBenefit`
  (face amount), and cash value in **simple or advanced** mode: `flatRate` compounds a
  `cashValueGrowthPct`, while `schedule` accepts a pasted year-by-year illustration table (whole-life cash
  value is front-loaded-poor / back-loaded-rich, not linear). Same simple/advanced toggle as the SS
  quick-PIA vs earnings-history split.

## Engine behavior

- **Premiums** become an expense stream per policy, driven by `premiumMode`, feeding the existing
  spending/withdrawal flow.
- **Permanent-life cash value** is an asset that grows tax-deferred (`flatRate` compounds; `schedule`
  interpolates by age) and shows on the balance sheet / net worth. It is **held out of the optimizer as a
  drawdown source** — the optimizer won't surrender or borrow against it (see [optimizer.md](optimizer.md)).
- **Death benefit** pays out **income-tax-free** to the beneficiary on the insured's death (an existing
  survivor transition). It interacts with the **SS survivor analysis** — the benefit replaces part of the
  income lost when the smaller SS check disappears at first death — so it surfaces in survivor-scenario
  results, not just the estate total.
- **LTC benefit** is framed as a **de-risking lever**, not a precise actuarial product:
  - *Deterministic care episode* — user-defined start age, duration, annual cost, **additive to baseline
    spending** (housing etc. continue); the policy offsets cost up to its monthly cap after the elimination
    period, the inflation rider compounding the cap.
  - *Monte-Carlo shock* — a probabilistic care event (incidence + duration) per path, so the policy's risk
    reduction shows up in success-% and ending-balance dispersion — the real "what does my policy do for
    me" answer.

## Stochastic longevity / mortality-weighting

Shipped alongside insurance because the LTC Monte-Carlo shock needs per-path lifespans: the fixed plan-end
age can be replaced with mortality-table-weighted outcomes, and a joint-life RMD table covers couples with
a >10-yr age gap. Deterministic plans keep the fixed-horizon mode; mortality-weighting is an added lens
that also feeds the survivor analysis and the optimizer objective.

## UI

An **Insurance** plan-entry section (list-edit like accounts/goals) with the simple/advanced cash-value
toggle. Results show premiums in the expense breakdown, the death-benefit payout in the survivor scenario,
and — for LTC — an **"LTC stress" comparison** (plan with vs without a care episode, and with vs without
the policy offsetting it) so the de-risking value is the headline.

The Insurance screen also carries contextual Learning Center help: the screen intro links to
`insurance-in-your-retirement-plan`, permanent-life fields link to
`permanent-life-insurance-in-a-plan`, LTC policy fields link to
`long-term-care-insurance-as-risk-transfer`, and care events link to
`long-term-care-costs-and-insurance`. A screen-level "Learn about this screen" cluster surfaces the same
ready articles for users who prefer browsing before editing fields.

## Documented simplifications

- LTC is a de-risking lever, not an actuarial product: care cost is a user/MC-driven spending spike the
  policy caps; no benefit-trigger ADL detail, partial benefits, or shared-care riders.
- Cash value appears as an asset; surrender/policy-loan liquidity, loan-vs-withdrawal tax nuance, and MEC
  rules are not modeled.
- Death benefit is income-tax-free; estate-tax treatment of large benefits is out of scope at current
  estate sizes.
- Permanent-life dividends are treated as baked into the cash-value schedule; the `dividendOption` enum is
  advisory. The LTC MC shock uses an in-repo, cited incidence/duration table (no external service).
