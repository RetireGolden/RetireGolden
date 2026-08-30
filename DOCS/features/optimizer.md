# Withdrawal / Roth optimizer (+ tax depth)

A true mathematical withdrawal/Roth co-optimizer: a mixed-integer linear program (MILP) solved
**entirely client-side**, with no external services. It is the most ambitious capability in the app — a
real solver in the browser — and it builds on the mature engine (mortality/longevity, the SS benefit
menu) the rest of the planner provides. Several tax-depth refinements that sharpen the same
withdrawal/conversion engine ride alongside it.

**Code:** pure solver in [engine/strategies/optimizer.ts](../../packages/engine/src/strategies/optimizer.ts) and
[engine/projection/optimizePlan.ts](../../packages/engine/src/projection/optimizePlan.ts); Web Worker in
[packages/planner-ui/src/optimize/](../../packages/planner-ui/src/optimize/); UI in [planner/OptimizePage.tsx](../../packages/planner-ui/src/planner/OptimizePage.tsx).

## Design decisions (and why)

- **Everything runs in-app — no external services.** The solver is **HiGHS compiled to WASM** (the `highs`
  npm package), executed in a Web Worker; the ~3 MB wasm loads lazily only when Optimize is invoked, never
  in the main bundle. No network calls, no server-side solve. Correctness is validated by **in-repo tests**
  — hand-computed cases and cross-checks against the deterministic engine. (Any Owl/PolicyEngine comparison
  is an optional, offline, dev-time fixture generator, never a runtime dependency.)
- **The optimizer is "just another strategy provider."** Strategies are pure functions
  ([standards.md](../standards.md)); the optimizer emits a per-year conversion + withdrawal schedule that
  feeds the *same* `simulate` ledger as the hand-written strategies — not a parallel engine. `simulate`
  stays the source of truth: the LP proposes a raw schedule, then the real ledger runs it, trims it to the
  conversions the plan can actually execute, and re-runs the cleaned schedule before the UI can apply it.
  When a fully executable schedule still lowers the exact after-tax estate, a bounded **estate-preserving
  prune pass** drops trailing conversion years one at a time (each candidate is one exact-ledger run,
  default budget 24) and adopts the best candidate only if the exact ledger prices it beneficial; pruned
  years are reported as `estate-pruned` adjustments. Schedules that stay estate-negative under every pruned
  subset remain rejected. Any gap vs the LP's linearized objective is surfaced, not hidden.
- **Objective = ending after-tax wealth in real (today's) dollars.** Leftover traditional balances are
  haircut by the plan's Heir tax rate assumption (user-configurable under Enter -> Assumptions, default 25%)
  so pre-tax dollars aren't overvalued — which keeps the program linear. No time-discounting (time value
  enters via portfolio growth in the ledger). Lifetime tax is a secondary readout. Single objective; no
  multi-objective Pareto.
- **Scope:** residence and planned moves are *given* (users A/B relocation via Scenarios); permanent-life
  cash value is held out as a drawdown source (see [insurance.md](insurance.md)). Both can expand later
  behind the provider seam.

## Why a multi-year model

The hand-written sizers (`sizeRothConversion` — per-year bisection against the federal engine for
`topOfBracket` / `irmaaTier` / `acaCliff` / `fixedMagi`) are **greedy per-year**. True optimization is
**multi-year** — converting more now to lower later RMDs is the whole point — so the optimizer spans all
plan years at once rather than looping the per-year bisection.

Decision variables per plan year *t*: `convert[t]`; withdrawals `wTrad/wRoth/wTaxable/wCash[t]`; carried
balance state. Constraints: spending met each year; balance recursions with growth (linearized at assumed
returns) plus scheduled contribution / employer-match inflows probed from the baseline ledger (so a
late-career accumulator whose solvency depends on future deposits is not misread as infeasible); RMD
floors once age-eligible; non-negativity; balances ≥ 0.

**The kink problem:** federal tax, taxable-SS phase-in, IRMAA tiers, and the ACA cliff are
piecewise-linear / step, not linear. The MILP handles federal tax with convex segments and IRMAA with
binary thresholds. For each actionable ACA probe year it also applies a conservative absolute conversion
bound equal to the incumbent conversion plus remaining exact-ledger MAGI room to the cliff. Withdrawals
and premium reconciliation remain nonlinear and are refined by the exact ledger. This is the bulk of the engineering and why the optimizer was spiked
before commit. If the MILP had proven impractical, the strategy-provider seam allowed a multi-year
heuristic fallback (forward search / local improvement over the bisection sizers).

## UI

A top-level **Optimize** tab, run asynchronously in the worker with progress. It shows the raw optimizer
request, the cleaned exact-ledger schedule when the two differ, lifetime-tax and ending-estate deltas vs
the current strategy, a modeled-vs-exact note, and an **auto-run Monte Carlo** success percentage for the
recommended schedule. Rejected or materially unexecutable schedules are diagnostic-only. **Accept-as-manual**
writes the recommended schedule as an editable manual strategy; **Apply optimized schedule** writes the same
amounts with optimizer provenance. A default-off **"Also optimize Social Security claim age"** checkbox (shown
when the plan has an SS stream) runs the Step 5 joint grid — one full optimize per claim combination, a small
multiple of a normal run; the exact count is reported on the result card and the cost is called out in the
running state — and, when a claim change wins, renders it as a prominent card and makes Apply install the claim
change and the schedule atomically.

**Exact-ledger candidate tournament:** after post-processing, six simple fill-to-target strategies
(10/12/22/24% bracket fills, ACA-cliff cap, first-IRMAA-tier cap) are each run through the exact ledger
(`runExactLedgerTournament` in [optimizePlan.ts](../../packages/engine/src/projection/optimizePlan.ts)) and the
recommendation goes to whichever schedule wins on exact after-tax estate — a candidate must beat the cleaned
MILP by a $1k margin to displace it, must never shorten money-lasts, and its schedule is exact-executed
amounts by construction. This exists because the LP's linearisation can over-convert past its own
break-even: on the trad-heavy test fixture a plain 10%-bracket fill beats the cleaned MILP schedule
**+$77.3k vs +$38.1k** of exact estate gain, while on the Coast-FIRE fixture every blanket fill is
estate-negative and the trimmed MILP wins — so both paths earn their keep. The tournament also runs when
the MILP is infeasible or empty, so those households can still get a simple beneficial recommendation.
Cost: six extra deterministic `simulatePlan` runs per optimize. When the tournament falls back to
`'incumbent'`/`'none'` because the **ACA actionability veto** blocked schedules (non-actionable ACA years —
e.g. `tax-year-parameters-unsupported` past the sourced-pack horizon — make every candidate's exact
evaluation non-executable even when its raw estate delta is positive, since that delta is ACA-blind in the
unpriced years), the result carries a structured `acaActionabilityVeto` diagnostic: the non-actionable
baseline/schedule years, the ACA support codes, and the improving schedules the veto blocked — candidate
rows judged by the active objective's primary metric, plus the post-processed solver schedule when it alone
went non-actionable. Candidate-only evidence is reported only when it covers every improving row, so the
diagnostic never claims "nothing was actionable" while an actionable improving candidate lost for another
reason.
The Optimize page, the "why this recommendation" panel, and the report's candidate loss reasons all render
it, so a "no change" verdict next to a positive candidate row always explains itself.

**Exact-ledger convergence loop (surpass-Owl Track 1, Step 1):** the MILP is a *linearization*, so its
exogenous inputs (the taxable Social-Security portion, IRMAA/ACA-priced spending) are only exact at the
schedule they were captured from. Rather than solve once against a conversion-free baseline, the worker
wraps the solve in a bounded sequential-linear-programming loop (`convergeSchedule` in
[optimizePlan.ts](../../packages/engine/src/projection/optimizePlan.ts)): solve → run the exact ledger with the
emitted schedule → recapture the exogenous inputs from *that* run (so `ordinaryIncomeBase` now reflects the
taxable SS the conversions actually push into the 85% tier) → re-solve, iterating to a fixed point. Each
step is damped by a trust-region per-year step limit and adopted only when the exact ledger prices it **no
worse** than the incumbent, so the loop is deterministic, bounded (default 6 outer iterations), and can only
sharpen the recommendation — a converged schedule that lands worse is never adopted, and whatever the loop
produces is still priced and gated by the tournament above. The loop is **gated to the after-tax-estate
objective** (the MILP's own objective): under a non-default objective mode — where the tournament re-ranks by
lifetime tax, durability, etc. — the loop stays off, since climbing estate could displace the schedule that
policy would prefer; co-optimizing the loop against non-estate policies is Step 5 work. The result is a
schedule that is *optimal on the exact ledger to tolerance* rather than "best found within a single
linearization": on the SS-torpedo fixture
the converged schedule beats the single-solve schedule by ~$19k of exact after-tax estate. Every adopted
step is snapped to exact-ledger **executed** amounts (the ledger caps unexecutable requests, so raw requests
could otherwise inflate for free), and after the loop the pipeline post-processes *both* the converged and
first-solve schedules and keeps whichever cleaned schedule the exact ledger prices higher — so enabling
convergence can never do worse than a single solve, by construction. Convergence
diagnostics (iterations, whether it settled, estate gained over the first solve, which schedule was kept)
ride along on the result.
The loop's recapture and the in-LP fidelity work below close the documented linearization gaps together.

**In-LP fidelity (surpass-Owl Track 1, Steps 2–5).** On top of the convergence loop, the MILP itself now
models what it used to approximate away:

- **Taxable-gain realization (Step 2).** The lumped "other" bucket splits into a taxable brokerage bucket and
  the tax-free Roth/cash/HSA bucket. Taxable withdrawals realize LTCG on the opening gain fraction at a single
  preferential rate (15% — the exact ledger refines the 0/15/20% stack) and lift IRMAA MAGI, so the solver no
  longer treats taxable draws as free and prefers the tax-free bucket where it can. Plans with no taxable
  account emit the identical LP.
- **Bracketed state tax + taxable-SS phase-in (Step 3).** Progressive (non-flat-override) states are priced
  with a convex state bracket PWL over the same taxable-ordinary base as the federal PWL, instead of the old
  flat rate (which was zero for bracket states); a flat `stateEffectiveTaxPct` override keeps the single flat
  term, and state retirement-income exclusions are left to the exact ledger. The 0/50/85% provisional-income
  taxable-SS phase-in is modeled in-solve as a convex PWL, so the solver sees the *marginal* tax torpedo (each
  conversion dollar dragging 50–85¢ of SS into taxability) instead of the incumbent's average — the missing
  piece the convergence loop alone could not supply, worth ~$19k of exact estate on the SS-torpedo test
  fixture in a single solve. The concave 0.85×benefit cap is intentionally not modeled (a binary per SS year
  measured intractably slow); omitting it only overstates the tax on cap-blowing mega-conversions, and those
  shapes still reach the recommendation through the tournament candidates and local search.
- **IRMAA two-year lookback (Step 4).** Each premium year's IRMAA surcharge binaries are driven by year
  (t−2)'s MAGI, matching the exact ledger's causality — so a conversion at 63 anticipates the age-65 premium
  in-solve rather than mispricing it.
- **OBBBA senior deduction (the `ground-truth-2026-law-sync` plan, Step 2).** Eligible years (people 65+, pack rule present, year ≤ 2028) add the per-person deduction to the
  LP's deduction constant plus a convex 6%-of-MAGI phase-out floor, so the solver sees both the extra
  cheap-bracket conversion headroom below the $75k/$150k MAGI thresholds *and* the phase-out band's
  marginal-rate spike (bracket rate × 1.06) above them — previously the deduction was invisible in-solve, so
  the optimizer left ~$6k/person of 12%-bracket headroom unused in 2025–2028 and undercharged conversions in
  the band. Years already past full phase-out at baseline — counting the year's forced RMD/inherited
  distributions, which the LP re-decides as variables but the ledger's MAGI includes — skip it exactly; the
  concave full-phase-out cap is
  omitted (conservative overstatement for mega-conversions, same direction as the taxable-SS cap).
- **Co-optimized SS claim age (Step 5).** `optimizePlanCoOptimizingClaimAge` alternate-minimizes the claim age
  with the conversion optimum: it runs the full convergence-loop + tournament optimize at the current claim and
  at each bounded claim candidate (≤2 streams × 3 canonical ages), then keeps the (claim, schedule) pair with
  the best absolute exact-ledger estate. Opt-in end to end: the worker flag (`coOptimizeClaimAge`) is set by a
  default-off **"Also optimize Social Security claim age"** toggle on the Optimize tab, which surfaces the
  winning claim change (label + exact-estate gain over the current-claim optimum) and applies the claim change
  and the conversion schedule *together* — the schedule is computed against the claim-patched plan, so applying
  it alone would be wrong. The claim evidence also lands in the downloadable recommendation report. On a bridge
  fixture delaying to 70 can beat the current-claim optimum by six figures of exact estate.

Every one of these is priced and gated by the exact-ledger tournament. The richer candidate set matters too:
**windowed bracket fills** stop converting at income boundaries (liquid-reserve depletion, SS claim, RMD
start — the "convert hard during the bridge, then stop" shape a sequential withdrawal order makes optimal),
and local search refines the **top two** candidates (a runner-up in a different basin — e.g. a lower bracket
fill whose refined taper beats the raw winner — is unreachable from the winner alone) plus a winning MILP
schedule. See the
`optimizer-exact-ledger-convergence` plan (private planning docs).

**Proof ≥ Owl (Step 6 / Track 3).** With all of the above, the strict parity gate
(`pnpm owl-parity --install-owl --strict-owl`; without Owl/Python the plain command reports a
skipped gate and exits 0) **passes**: RetireGolden meets
or beats [Owl](https://github.com/mdlacasse/Owl) (pinned to tag `v2026.07.04`, re-pinned 2026-07-08; both
engines' schedules priced on
RetireGolden's own exact ledger, $1k tolerance) on **every fixture** of the parity matrix — margins from
+$98 (high-tax state, narrowed from +$3.0k by Owl's newer release) to +$141.4k (balanced low-basis couple),
including +$22.1k on the SS-torpedo fixture
and +$18.2k on the traditional-heavy bridge. The recommendation is honestly describable as *optimal on the
real projection to tolerance* — a stronger claim than an optimum on a simplified model.

**Shared decision engine:** the tournament's candidates, exact evaluation, and validation now live in the
reusable [engine/decisions/](../../packages/engine/src/decisions/) module
(the `ledger-native-decision-engine` plan): candidate
generators propose bounded plan patches or conversion schedules, `evaluateCandidate` prices every one
through the exact ledger against a shared baseline, and named objective policies (maximize after-tax
estate, spending durability, minimize lifetime tax with an estate floor, survivor liquidity, bridge
durability, sustainable spending, and opt-in downside resilience) rank them with explainable hard
constraints. Other plan-patch generators — bounded asset-location swaps (`assetLocationGenerator`, surfaced on
the **Insights** `asset-location` card when a plan opts into static allocation on multiple accounts; not part of
the Roth conversion tournament) and annuity purchases (`annuityPurchaseGenerator` — cover-the-floor SPIA /
QLAC-at-cap / no-purchase, see [domain rules §17](../domain/domain-rules-reference/17-guaranteed-income-annuity-purchases.md)) — plug into the same
`evaluateCandidate` path. The survivor-liquidity policy honors an optional user-set **survivor reserve
target** (`strategies.survivorReserveTarget`, today's dollars) as a hard floor, disqualifying any candidate
whose deflated survivor-year investable balance falls below it. Insights previews use the same evaluator, so an
Insights card and this page always agree on a change's exact numbers and recommendation state.

## Promoting an aggregate conversion schedule

A tournament winner is a household amount per year and nothing else, so it is vetoed `identityIncomplete`
before publication: nobody has said whose dollars move, out of which account, into which. The promotion loop
answers that question and lets the veto lift when — and only when — the answer earns a recommendation on its
own terms.

The loop runs once per vetoed winner, inside `runExactLedgerTournament`:

1. **Choose.** `chooseAggregateConversionPromotionIntents`
   ([projection/optimizerAggregateConversionPromotion.ts](../../packages/engine/src/projection/optimizerAggregateConversionPromotion.ts))
   names the owners, source accounts, destinations, and exact cents by calling the *same*
   [actions/aggregateRothConversionOwnerAllocation.ts](../../packages/engine/src/actions/aggregateRothConversionOwnerAllocation.ts)
   policy the ledger executes, so a promoted schedule allocates by the rule the projection ran rather than by a
   second rule that happens to agree. The policy weights each owner by their gross convertible balance as it
   stood after that year's forced distributions and before any conversion drain, splits by largest remainders,
   and sends each owner's slice to their first Roth IRA in plan order; an owner with no Roth IRA is trimmed,
   exactly as the ledger trims them, and the household converts less than the winner's figure as a result.
   The chooser re-solves nothing — the amount promoted for each year is the ledger's own published
   `aggregateRothConversionAllocationDesired`, the pre-trim figure the policy was asked for, because handing
   back the post-trim executed figure would trim the absent owner's phantom share a second time. The one place
   the chooser is stricter than the policy is an account the plan records no owner for: the policy attributes
   it to the primary person, and the chooser refuses to name it.
2. **Mint and price.** The named intents become a candidate through the fill-target adapter, and
   `evaluateCandidate` runs the exact ledger on it — its own projection, with readiness and execution
   diagnostics on.
3. **Compare.** The verdict comes from the equality core (`compareOptimizerExactLedgerResults`): every
   evaluated account, every year, taxes and penalties and investable total and net worth, equal to the cent,
   with no epsilon. The richer comparator is then called only to attach binding evidence, never to decide,
   because its `null` answers several different questions at once.

The tournament publishes on five outcomes (`RetirementActionPromotion` in
[projection/optimizePlan.ts](../../packages/engine/src/projection/optimizePlan.ts)):

| Outcome | What it means | Published |
|---|---|---|
| `equivalent` | Naming the identities changed nothing: the two projections match to the cent | Yes — the promoted candidate, with the equality evidence |
| `repriced` | A genuinely different projection that earned a recommendation on its own evaluation | Yes — ranked on its own metrics, never on the aggregate's |
| `repricedNotRecommended` | Different, and not beneficial, or not clear of the schedule it would displace by the switch margin | No |
| `notComparable` | Minted and priced, then the ledger declined to execute it, or a projection fell outside the equality core's domain | No |
| `notPromoted` | Nothing lawful could be minted | No |

When a promotion is published the veto is lifted and the promoted candidate *is* the recommendation; otherwise
the veto stands and the reason is surfaced. A **MILP winner always lands in `notPromoted`**: the comparator's
solver arm wants provenance whose source ID is the allocated candidate's own ID, which no adapter-minted
request can carry, so only a fill-to-target generator winner is promotable at all.

The gating predicate is the candidate's own `retirementActionReadiness.state === 'identityComplete'` — not a
test on the plan's facts. Recorded IRA classification facts are necessary but not sufficient: without them the
promoted candidate's requests do not execute, the evaluation comes back diagnostic, and the run reports
`notComparable`; with them, a promotion can still be withheld by any of the three no-publish outcomes.

**The UI.** [planner/retirementActionPromotionPanels.tsx](../../packages/planner-ui/src/planner/retirementActionPromotionPanels.tsx)
renders one surface per outcome, with every string in
[planner/retirementActionPromotionCopy.ts](../../packages/planner-ui/src/planner/retirementActionPromotionCopy.ts).
A published promotion shows the year / person / from / to / amount table read back out of the plan the patch
installs, plus the owners it trimmed; a `repriced` one also shows the exploratory schedule it came from. A
withheld promotion shows the frame for its outcome, the engine's own diagnostics or issue details verbatim, and
— when the plan has unclassified IRA sources — a link to record them, worded so it never promises that
recording them would produce a recommendation.

**Apply is a fail-closed read-back**, not a re-aggregation. `readPromotedSchedule`
([planner/optimizePagePromotion.ts](../../packages/planner-ui/src/planner/optimizePagePromotion.ts)) applies the
promotion's plan patch and then re-reads the result: the aggregate conversion strategy must be off
(`strategies.rothConversion.mode === 'none'`), the installed action IDs must equal the promised IDs as an
ordered sequence, and every installed action must be a `rothConversion`. Anything else reads back `unreadable`
and Apply is blocked. The same read-back memo feeds the table, the Monte Carlo run, the report, and the button,
so Apply cannot install a plan different from the one on screen.

**Local search refinement:** when a simple candidate wins the tournament, the worker path runs a bounded
**coordinate-descent search** (`refineConversionSchedule` in
[engine/decisions/search.ts](../../packages/engine/src/decisions/search.ts)) over the winning schedule's
per-year amounts — coarse $10k steps then $2.5k refinement, deterministic under a fixed simulation budget
(default 48). A refined schedule is adopted only when the exact ledger prices it beneficial, it improves
the winner's exact estate delta, and the money-lasts guardrail still holds; it is snapped to exact-executed
amounts so it stays executable by construction.

**Sustainable-spending solver:** `solveMaxSustainableSpending` in
[engine/decisions/spendingSolver.ts](../../packages/engine/src/decisions/spendingSolver.ts) answers "how much
can this plan spend every year?" by exact-ledger bisection over the plan's annual base spending: a level is
feasible only when the full `simulatePlan` run never depletes and the ending after-tax estate stays at or
above an optional floor (the bequest target from the Spending screen, entered in today's dollars and
inflated to nominal end-of-plan dollars before the comparison). Deterministic under a hard simulation cap
(default 24), it reports the max feasible spending, the slack vs. current spending, the binding constraint
(depletion vs. estate floor), and the exact-ledger evidence; the paired `max-sustainable-spending`
objective policy lets tournaments rank spending-level candidates under the same constraints. Three
surfaces consume it, all under the shared `SPENDING_SOLVER_UI_BUDGET` (25 simulations) so their answers
agree exactly:

- **"How much can I spend?"** page on the Optimize rail
  ([planner/SpendingSolverPage.tsx](../../packages/planner-ui/src/planner/SpendingSolverPage.tsx)) — runs the solver in a
  dedicated Web Worker ([optimize/spendingSolve.worker.ts](../../packages/planner-ui/src/optimize/spendingSolve.worker.ts)),
  shows the answer + evidence, and can add a scenario at the solved level.
- **Insights `spending-headroom` detector**
  ([engine/insights/detectors/spendingHeadroom.ts](../../packages/engine/src/insights/detectors/spendingHeadroom.ts))
  — screens cheaply (no depletion + large excess estate over the bequest target), solves exactly on
  preview, and offers the solved level as a scenario.
- The paired objective policy, selectable on the Optimize page (below).

**Objective modes:** the Roth & Tax Optimizer's tournament ranks by a user-selectable objective policy
from the shared `objectivePolicies` registry (default unchanged: `max-after-tax-estate`). A non-default
policy re-ranks the same exact-ledger evaluations (simple candidates + the post-processed MILP schedule
synthesized as one more evaluation) through the shared `rankEvaluations` under that policy's primary
metric and hard constraints — never a separate ranking implementation
(`runPolicyRankedTournament` in [projection/optimizePlan.ts](../../packages/engine/src/projection/optimizePlan.ts)).
Floor-style policies (`min-lifetime-tax-estate-floor`, `max-sustainable-spending`) pick up the plan's
bequest target via `objectivePolicyForPlan`. `max-sustainable-spending` is excluded from the Roth
optimizer's selector (conversion candidates never change base spending); Phase 4 search refinement runs
only under the default estate objective.

**Opt-in stochastic ranking:** `max-downside-resilience` is the only stochastic optimizer objective. It
first attaches 200-path same-seed Monte Carlo metrics to the already exact-ledger-priced candidates, then
ranks by 10th-percentile after-tax estate improvement subject to an 85% success-rate floor. The default
optimizer objective remains deterministic; stochastic metrics are not computed unless the user explicitly
selects this robust lens.

**The MILP's role (decision engine Phase 7):** the MILP is deliberately kept as **one candidate generator
among several** (Option A of the enhancement plan) — it remains the only source of genuinely multi-year
schedule shapes, while the exact-ledger tournament, not the solver, decides what is recommended. User-facing
copy should say the app *compared candidate strategies on the exact projection ledger and selected the best
exact-ledger result found within the search limits*, not that the solver's schedule is "optimal."

## Tax-depth refinements (shipped alongside)

Each sharpens the same withdrawal/conversion engine:

- **72(t) / Rule of 55** — penalty-free early traditional access (SEPP schedules; separation-year 401(k)
  access) — [strategies/sepp.ts](../../packages/engine/src/strategies/sepp.ts).
- **Inherited-IRA 10-year rule** — beneficiary accounts with the 10-year drain + RMD-during-window —
  [strategies/inheritedIra.ts](../../packages/engine/src/strategies/inheritedIra.ts).
- **Gain-harvesting** — surfaces 0% LTCG-bracket headroom per year (combined with any capital-loss
  carryforward) as an advisory; see [taxes.md](taxes.md).
- **Itemized-deduction detail** — an itemized path (SALT cap, mortgage interest, charitable) where it beats
  the standard deduction.

## Documented simplifications

- The MILP linearizes returns at assumed deterministic rates and optimizes the *expected* path, then
  Monte Carlo stress-tests the chosen schedule. The opt-in downside-resilience objective is a bounded
  post-ledger re-rank of candidate schedules, not stochastic programming.
- The MILP objective is still ending after-tax wealth; stochastic and non-estate objective modes are
  tournament ranking policies over exact-ledger evaluations, not a multi-objective solver.
- Piecewise tax is modeled to the engine's existing "big levers" depth. Federal ordinary brackets, the
  taxable-SS phase-in, IRMAA tiers (on the two-year MAGI lookback, Step 4), taxable capital-gain realization
  (Step 2), progressive state brackets (Step 3), and the OBBBA senior deduction with its 6% MAGI phase-out
  (ground-truth 2026 law sync) are all modeled in-solve. Actionable ACA years add a bounded conversion
  ceiling, but the compressed solve does not reproduce the full premium/withdrawal fixed point. A single LTCG rate and a single
  opening basis ratio linearize the taxable stack, and the taxable-SS and senior-deduction PWLs omit their
  concave caps (conservative for cap-blowing conversions); the exact ledger, convergence loop, and tournament
  refine all of these. State retirement-income exclusions are left to the exact ledger.
- Inherited traditional accounts are not owner-convertible and are excluded from optimizer conversion
  supply; the exact ledger also refuses to convert them.
- Permanent-life cash value is not an optimizer drawdown source.
- The LP models the **balance and cash** consequences of a committed retirement action exactly —
  `committedActionMovement` carries four signed balance scalars plus the withdrawal's proceeds, and an account
  in no bucket throws rather than being dropped — and **none** of the income consequences.
  `ordinaryIncomeBase` excludes every conversion because the LP re-decides conversions as its own variable, and
  no exogenous term supplies a committed conversion's ordinary income, so a named-conversion year understates
  the solve's tax by the tax on the converted amount. `strategies.qcdAnnual` has no LP term either: its income
  offset reaches the solver only as a constant inside the probe's ordinary-income base, and nothing in the LP
  represents that a QCD satisfies the RMD floor without generating income. The exact-ledger tournament prices
  every candidate regardless, which is what keeps both gaps out of the recommendation.
- A plan carrying retirement actions is admitted by `buildOptimizerInput`, but the Optimize page still declines
  to run for one via the typed `optimizerUnsupportedRetirementActions` predicate.

## Spike findings (historical)

Before the real optimizer landed, a throwaway PR 0 spike (a toy Roth/withdrawment MILP over N plan years)
answered the two architecture questions: **can HiGHS-WASM solve a multi-year MILP in a Web Worker within
UX budget, and what's the bundle cost?** The spike was deleted once the shipped optimizer
([engine/strategies/optimizer.ts](../../packages/engine/src/strategies/optimizer.ts)) proved it out; the
measurements that justified the MILP path are recorded here so the decision stays legible.

**Solve time** (toy model: convex piecewise-linear tax + a non-convex IRMAA binary step):

| Model | Vars | Binaries | Status | Solve time |
|-------|------|----------|--------|------------|
| 5-year horizon | 42 | 5 | Optimal | ~47 ms* |
| 40-year horizon | 322 | 40 | Optimal | ~13 ms |

\* The 5-year number includes first-solve warmup; the warm 40-year solve is faster despite being 8× larger.
Both are negligible against UX budget — the solve itself is not the cost. Behaviour was correct: the solver
converted in the low bracket, spread conversions across years, and never tripped the IRMAA threshold.

**Bundle cost:** `highs.wasm` is **3.0 MB** (3,078,627 bytes) plus 67 KB of `highs.js` glue. The wasm dominates
and is lazy-loaded only when Optimize is invoked (the worker imports it via `highs/build/highs.wasm?url` so Vite
emits it as a separate asset that never enters the main/app chunk).

**Decision:** MILP via HiGHS-WASM is viable — proceed with the MILP path, no heuristic fallback needed. The
only cost to manage is the one-time 3 MB wasm load, handled by lazy-loading the worker.
