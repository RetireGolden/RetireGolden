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
  ([engine/montecarlo/riskBasedGuardrails.ts](../../../packages/engine/src/montecarlo/riskBasedGuardrails.ts))
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

**Code:** [engine/spending/](../../../packages/engine/src/spending/) (`layers.ts`, `guardrails.ts`,
`flexibleGoals.ts`), applied in [engine/projection/simulate.ts](../../../packages/engine/src/projection/simulate.ts),
aggregated in [engine/montecarlo/run.ts](../../../packages/engine/src/montecarlo/run.ts), surfaced in Results/Monte
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
  [engine/spending/shapePresets.ts](../../../packages/engine/src/spending/shapePresets.ts)): named shapes compile to
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
  [engine/decisions/objectives.ts](../../../packages/engine/src/decisions/objectives.ts)): picks up plan-level floors
  automatically — `bequestTargetDollars` feeds `min-lifetime-tax-estate-floor` and
  `max-sustainable-spending`; `strategies.survivorReserveTarget` feeds `protect-survivor-liquidity`. The
  `max-sustainable-spending` policy ranks candidates by base annual spending and disqualifies any exact-ledger
  run that depletes or ends below the inflated estate floor.

**Code:** [engine/decisions/spendingSolver.ts](../../../packages/engine/src/decisions/spendingSolver.ts),
[engine/decisions/objectives.ts](../../../packages/engine/src/decisions/objectives.ts). Product mechanics:
[features/optimizer.md](../../features/optimizer.md), [features/README.md](../../features/README.md) §4.

### Spending paths & SWR lenses (opt-in)

Five research-backed lenses over the same ledger (spending-paths-and-swr-lenses plan; all opt-in,
feature-off plans byte-identical, guarded by `cases:diff` and the golden suites):

- **Amortized spending / ABW** (`expenses.spendingPolicy.mode = 'abw'`, params in `spendingPolicy.abw`;
  pure math in [engine/spending/abw.ts](../../../packages/engine/src/spending/abw.ts), applied in
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
  [engine/montecarlo/survival.ts](../../../packages/engine/src/montecarlo/survival.ts)): planning age expressed as
  "the age I/we have a 25% (10%) chance of reaching", single or joint ("either of us", independent
  lifetimes: 1 − (1−S_a)(1−S_b)), from the same SSA 2022 q(x) derivation as the stochastic-longevity
  engine. Optional health adjustment: the longevity questionnaire's remaining-years multiplier converts to
  a proportional-hazards power (q′ = 1 − (1−q)^h, h solved by bisection so the adjusted expectancy matches),
  the Actuaries Longevity Illustrator's smoker/health-adjustment pattern without a second factor set. The
  picked age is written once with provenance (`longevity.source = 'percentile'`, spec kept for restating) —
  never silently recomputed; fixed-age plans unchanged.
- **SWR comparator** ("How much can I spend?" page;
  [engine/decisions/swrComparator.ts](../../../packages/engine/src/decisions/swrComparator.ts)): the live
  "whose 4% rule?" argument priced on the user's own plan — **Bengen 4.7%** (*A Richer Retirement*, 2025:
  SAFEMAX ≈ 4.7% with seven asset classes), **Morningstar 3.9%** (*State of Retirement Income* 2025, for
  2026 retirees), and the **ERN CAPE rule** (SWR = 1.75% + 0.5 × 100/CAPE, SWR series part 18). Each rule
  spends its rate × starting investable, constant-real (the rules' own definition), through one
  deterministic exact-ledger run — same-path deltas by construction — shown against the plan's solver
  answer with citations. Presented as rules of thumb vs. the plan-specific answer; no rule is endorsed.
- **Solver-per-shape** (same page): re-solves `solveMaxSustainableSpending` under constant-real / smile /
  smirk phase sets to show the shape-aware initial-spending uplift on the user's plan (~25 sims per shape,
  on demand).
- **Bucket reporting lens** (Results; [planner/bucketLens.ts](../../../packages/planner-ui/src/planner/bucketLens.ts)):
  buckets are popular but the evidence (Estrada's bucket studies; Kitces) finds no systematic benefit over
  total-return rebalancing, so RetireGolden *reports* buckets without *managing* them — each year's investable
  total is partitioned into "next N years of net spending" segments (net need = spending + taxes −
  income, floored at 0; presets 2yr/8yr/growth and 3yr/growth), reconciling to the ledger total every year
  by construction. Presentation only; no engine feedback.

**Code:** [engine/spending/abw.ts](../../../packages/engine/src/spending/abw.ts),
[engine/spending/shapePresets.ts](../../../packages/engine/src/spending/shapePresets.ts),
[engine/montecarlo/survival.ts](../../../packages/engine/src/montecarlo/survival.ts),
[engine/decisions/swrComparator.ts](../../../packages/engine/src/decisions/swrComparator.ts),
[planner/bucketLens.ts](../../../packages/planner-ui/src/planner/bucketLens.ts). Sources: Bogleheads wiki
"Amortization based withdrawal formulas" and "Variable percentage withdrawal"; Blanchett, *Exploring the
Retirement Consumption Puzzle* (JFP 2014) and 2025–26 median-spending ("smirk") updates; Bengen, *A Richer
Retirement* (2025); Morningstar, *State of Retirement Income* (2025); Early Retirement Now SWR series part
18 (CAPE rule); Academy of Actuaries / SOA Actuaries Longevity Illustrator; Estrada, *The Bucket Approach
for Retirement* ; Kitces on bucket strategies and probability-of-adjustment.
