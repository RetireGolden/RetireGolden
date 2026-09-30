## Claim

Kind: composition. `engine/src/decisions/stochastic.ts#compareMonteCarloSuccessRates(baseline, proposal)` (record `monte-carlo-success-rate-comparison`) publishes the change in Monte Carlo success rate between a plan and a changed plan simulated on the same market paths: `compareScalars(baseline.successRate, proposal.successRate)`, a fraction, proposal minus baseline, refusing two summaries with different path counts. Owner decision R11 (fix), in two parts: the Insight card's preview simulates both plans with the headline's own Monte Carlo configuration (model, path count and seed), so its "before" rate is the rate the KPI bar shows; and the engine's shared-path helper prices each plan with that plan's own tax stack. The displayed change moves on every example where it shows. The spending-guardrails card no longer publishes a constant 12 as a "change in success rate" (P6), and its preview keeps its refusal on a year whose premium tax credit is unpriced, in plain words (decision of 2026-09-26).

## What the UI computed before B2-P1 slice 3

`planner-ui/src/planner/insights/InsightCardView.tsx` at RetireGolden `4a80669e`, inside Preview, after the exact evaluation succeeded (a `diagnostic` evaluation showed its message instead and ran no Monte Carlo, `:94-95`):

```ts
if (card.impact.successRateDeltaPct !== undefined) {                                             // :109
  const seed = seedFromPlanId(plan.id)                                                           // :111
  const model = { type: 'historical' as const, mode: 'iid' as const, equityWeightPct: 60 }       // :112
  const mcOpts = { startYear: projectionView.startYear, pathCount: 250, seed, model }            // :113-118
  const [baseMc, patchMc] = await Promise.all([runMonteCarlo(plan, mcOpts), runMonteCarlo(applied.plan, mcOpts)])  // :119-122
  setMcDelta((patchMc.successRate - baseMc.successRate) * 100)                                   // :123
}
```

`mcDeltaFormat.ts:15-18` printed "no change" below 0.05 points in magnitude, else "±N.N pts" coloured by sign. The headline (KPI bar, Results verdict, Monte Carlo page on arrival) runs `buildModel('lognormal', inflationPct, 12, 60, plan)`, which is `buildLognormalModelConfigForPlan(plan, 12)` with the plan's inflation mean (per-class shocks for a plan with allocated accounts; the 60 percent equity weight is not read by that model), 1,000 paths (or a published 10,000-path run), and the plan-id seed (`useMcSuccessRate.ts`). The card's model was a different distribution (historical returns drawn independently), a quarter of the paths, and without the class shocks, so its "before" rate was not the rate the page showed elsewhere. Only the spending-guardrails card set `successRateDeltaPct` (`insights/detectors/spendingGuardrails.ts:81, 103`): a constant 12, used as a flag here and as a ranking weight in `insights/registry.ts`.

The engine's delta helper `decisions/stochastic.ts#attachment` was module-private and `attachStochasticMetrics` passed no per-entry tax calculator, so every entry fell back to `opts.taxCalculator` (`montecarlo/sharedPaths.ts`); the planner's pool builds one per plan (`mc/runRequest.ts`). Latent: the only caller is the optimizer's `max-downside-resilience` policy, whose candidates are conversion schedules that change no tax assumption and whose context has no per-plan builder.

## Engine publication

```ts
// engine/src/decisions/stochastic.ts
/** What two runs must share to be compared (since the PR #754 review): the rate, its path count and the year its paths start in. */
export interface MonteCarloRateRun { successRate: number; pathCount: number; startYear: number }
/** proposal.successRate − baseline.successRate as compareScalars (a fraction); refuses runs with different pathCount or startYear (RangeError). */
export function compareMonteCarloSuccessRates(baseline: MonteCarloRateRun, proposal: MonteCarloRateRun): ScalarComparison
/** The private `attachment` deltas, exported, each via compareScalars. */
export function stochasticDeltas(baseline: StochasticDecisionMetrics, candidate: StochasticDecisionMetrics): StochasticDecisionAttachment['deltas']
// attachStochasticMetrics: each SharedPathPlan entry carries taxCalculator: ctx.taxCalculatorForPlan(entry.plan) (the baseline too) when the context has a per-plan builder; otherwise opts.taxCalculator, as before.

// engine/src/insights/types.ts
Detector.previewsMonteCarlo?: true        // the preview flag, on the detector, never on the card
// InsightImpact.successRateDeltaPct: deleted (no producer is left; rule 4)
// engine/src/insights/registry.ts
export const EDITORIAL_RANKING_WEIGHT_DOLLARS = { 'spending-guardrails': 120_000 }   // replaces SUCCESS_RATE_POINT_DOLLAR_EQUIVALENT
```

- The planner keeps its worker pool and the headline configuration, which is product configuration and already lives in one place (`HEADLINE_MC_MODEL`, `DEFAULT_PATH_COUNT`, and until decision D-MC-DEFAULT-SEED of 2026-09-28 `seedFromPlanId`; since then the engine publishes the seed, path count and model as `headlineMonteCarloOptions`, record `monte-carlo-default-seed`). `useMcSuccessRate.ts` exports `headlineMcRun(plan)` (the published run, else the one in flight, else a new default run shared with the KPI bar; check correction 10), which carries the start year its paths begin in, and `headlineMcRunOptions(plan, pathCount, startYear)` (the headline model built from this plan, the engine's default seed, which was the plan-id seed until D-MC-DEFAULT-SEED, the given start year, the clock's by default). The card reuses the headline run for the base side, runs the previewed plan with `headlineMcRunOptions(basePlan, base.pathCount, base.startYear)` (the model built once, from the base plan, and the base run's path count, 10,000 included, and start year; check corrections 9 and 11, and the PR #754 review below), and prints `formatMcDelta(compareMonteCarloSuccessRates(base, previewed).delta)`; the formatter takes the fraction and prints points.
- The card reads whether to run the pair from its detector (`previewsMonteCarlo`), not from a figure on the card. RetireGolden-Pro's card parser accepts a fixed set of `impact` keys and top-level keys, so a new key on the card would have made Pro reject the guardrails card (check correction 13).
- Ranking: `computeCardScore` credits a card with the named editorial weight where it credited the retired success figure (after a measured estate delta, before a lifetime-tax delta), so the spending-guardrails card scores 120,000 × 0.7 = 84,000 exactly as before and the Insights order does not change.
- Timing: per Preview. Units: a fraction of paths (printed in percentage points). Rounding: none (the formatter prints one decimal; with 1,000 paths the delta is a multiple of 0.1 points).

## The guardrail preview's refusal, in plain words

The exact evaluation refuses a guardrail preview when the base plan or the previewed plan has a Marketplace year whose premium tax credit is unpriced (20 of the 26 examples that offer the card). Decided 2026-09-26: the refusal stays, because guardrail spending changes withdrawals, withdrawals change the credit, and a credit can move a guardrail result either way, so a preview priced without it is not a conservative figure; it must name the years and the reason in plain words instead of the engine's sentence ("ACA evidence from the full projection is non-actionable in the baseline for 2028, …"). The card now prints, on example-couple (whose base plan's credit is unpriced in 2028 and 2029 for want of figures, and whose previewed guardrail plan's credit is also unpriced in 2026 and 2027 because the credit is not modeled together with guardrail spending): "No preview is shown for this plan. The premium tax credit isn't counted in 2026 to 2029. In each of those years, at least one of these applies: RetireGolden doesn't have the credit's figures for those years yet; the credit isn't modeled together with guardrail spending. Guardrail spending changes how much you withdraw each year, and your withdrawals change the credit, so a preview that leaves the credit out could come out too high or too low." (`acaVetoCopy.ts#guardrailPreviewUnpricedCreditRefusal`, from the unpriced years of both runs and the engine's blocking codes in the same plain words the solver page uses). Other refusals, and other cards' refusals, keep the engine's diagnostics.

## Justification

Paths are seeded by `(seed, global path index)` (`montecarlo/run.ts`), so two runs with the same model, seed and count see the same market on path N whichever plan is simulated, and a difference of success shares is the plan change's effect on those markets. The difference is then only meaningful as a change from the rate the reader has been shown: the card's text is "Monte Carlo success: +N pts", and the page's success rate everywhere else is the headline configuration's. A preview on another model and a quarter of the paths reported a change from a rate the user never saw (example-couple: from 63.2%, while the KPI says 70%). R11 fixes the model; the path count and seed go with it, since a 250-path run of the same model still starts from a different "before" rate, and a published 10,000-path headline run is the rate the KPI shows. For the tax stack, a plan change that moves a flat state rate or a local rate is priced wrong by a calculator built for the other plan; rule 4 closes it before any caller depends on it. The constant 12 was published as `InsightImpact.successRateDeltaPct`, documented as "Change in Monte Carlo success rate, percentage points", on every plan (26 of 26 offering examples), and RetireGolden-Pro's review queue printed "Change in success rate: +12 percentage points" under "Evaluated impact"; rule 3 (a field named as a change must not carry a constant) removes it.

## Inputs

| Case | Baseline successes / paths | Proposal successes / paths |
|---|---|---|
| Y | 912 / 1,000 | 948 / 1,000 |
| Z | 700 / 1,000 | 700 / 1,000 |
| AA | 228 / 250 | 229 / 250 |
| AB | 501 / 1,000 | 500 / 1,000 |
| AC | 0 / 1,000 | 0 / 1,000 |
| AD | 912 / 1,000 | 229 / 250 (different path counts) |
| AF | 912 / 1,000, paths from 2026 | 948 / 1,000, paths from 2027 (different start years) |
| AE | a retiree born 1960 spending $50,000 a year from a $2.5M traditional IRA; the candidate sets a 5 percent flat state income tax; 100 lognormal paths | the context builds each plan's own tax stack |

## Arithmetic

Y: 0.948 − 0.912 = 0.03599999999999992 in binary (bits `3fa26e978d4fdf30`); ×100 = 3.599999999999992, printed "+3.6 pts". Z: 0, "no change". AA: 0.916 − 0.912 = 0.0040000000000000036, 0.40000000000000036 points, "+0.4 pts" (one path at 250 paths is 0.4 points; at 1,000, 0.1). AB: −0.0010000000000000009, "−0.1 pts" (red). AC: 0, "no change". AD: refused (`RangeError`). AF: refused (`RangeError`: "Success rates are compared only from one start year; the baseline starts in 2026 and the proposal in 2027"); the same two rates from one start year give case Y's 0.03599999999999992. AE: the candidate's attached metrics equal an independent run of the candidate plan with its own stack (success rate and median estate), and differ from a run with the base plan's stack, whose median estate is higher (no state tax).

## Expected

| Case | delta (fraction) | printed |
|---|---:|---|
| Y | 0.03599999999999992 | "+3.6 pts" (green) |
| Z | 0 | "no change" |
| AA | 0.0040000000000000036 | "+0.4 pts" (green) |
| AB | −0.0010000000000000009 | "−0.1 pts" (red) |
| AC | 0 | "no change" |
| AD | throws `RangeError` | — |
| AF | throws `RangeError` (different start years) | — |

Tolerance exact (`{ abs: 0 }`; one subtraction of two exact binary quotients).

Example library (scratch run at `4a80669e`, re-measured at `cb72713e` after main's #753 gave the bracket-fill household's second spouse a Roth IRA, which moved only bracket-fill-roth's row; each example as the app opens it, start 2026, the preview exactly as `InsightCardView` runs it; before = historical iid, 60% equity, 250 paths; after = the headline configuration, 1,000 paths; seed `seedFromPlanId('example:<id>')`). 26 of 29 examples offer the spending-guardrails card (not early-career-match, guardrails-flex-goals or no-head-start-grad). On 20 of the 26 the exact evaluation refuses for unpriced credit years, so Preview shows the refusal and no Monte Carlo line; the six that show the line:

| Example | before (base → patched, printed) | after |
|---|---|---|
| bracket-fill-roth | 55.2% → 86.0%, "+30.8 pts" | 66.8% → 91.9%, "+25.1 pts" |
| rmd-irmaa | 63.6% → 83.6%, "+20.0 pts" | 73.5% → 91.0%, "+17.5 pts" |
| inherited-ira-beneficiary | 0% → 0%, "no change" | 0% → 0%, "no change" |
| survivor-years | 0% → 0%, "no change" | 0% → 0%, "no change" |
| annuity-purchases-estate | 99.2% → 100%, "+0.8 pts" | 100% → 100%, "no change" |
| no-annuity-brokerage | 97.6% → 100%, "+2.4 pts" | 99.9% → 100%, "+0.1 pts" |

On the 20 refusing examples the line would read, were it shown: example-couple "+14.8" → "+16.5"; under-saved-single "+34.8" → "+38.5"; early-retiree-aca "+21.2" → "+19.4"; moving-state-tax, ltc-shock, salary-growth-escalation, fixed-target-spending and brokerage-no-hsa "no change" both ways; aggressive-saver "+0.8" → "+0.5"; coast-fire "+0.4" → "+0.8"; barista-fire "+2.4" → "+1.3"; bridge-early-retirement "+13.2" → "+10.5"; lean-fat-fire "+2.4" → "+4.0"; hsa-stealth-retirement "+5.6" → "+3.9"; glidepath-allocation "+18.8" → "+13.9"; hsa-property-depth "no change" → "+0.1"; static-allocation-control "+24.4" → "+21.2"; all-401k-no-bridge "+0.4" → "+0.3"; brokerage-bridge-401k "no change" → "+0.5"; trump-account-head-start "+0.4" → "no change". In every case the "after" base rate is the headline rate the KPI bar shows. Only glidepath-allocation uses class shocks; the model built from the patched plan equals the base plan's on all 26 (check correction 11).

**Re-measured on the default seed (decision D-MC-DEFAULT-SEED, 2026-09-28).** The table above was measured on the plan-id seed. Every plan now draws from the engine's default seed, 0x5eeded, so every figure moves once by sampling noise; the set of examples that show the line does not change. Measured by the implementation's measurement run: each of the 29 examples as the app opens it, a 2026 start, 1,000 paths on the default seed 0x5eeded with the headline model, on the branch's engine at commit `5223cb68` of `claude/mc-provenance-and-seed` (before the squash; no later commit of this change moves a figure, re-measured after the merges of origin/main at 4d2d9d67 and 5224c5d0). The diagnosis, its independent check and the implementation's review, whose figures this run reproduces, are recorded with their scripts in RetireGolden-Docs `calculations/bidirectional-validation-plan-2026-09-13/evidence/mc-example-source-{diagnosis,check,review}.md`; the preview is run as `InsightCardView` runs it: bracket-fill-roth 68.0% → 90.5%, "+22.5 pts" (the retired historical preview on the same seed: 62.0% → 87.2%, "+25.2 pts"); rmd-irmaa 74.1% → 89.3%, "+15.2 pts"; inherited-ira-beneficiary and survivor-years 0% → 0%, "no change"; annuity-purchases-estate 100% → 100%, "no change"; no-annuity-brokerage 99.6% → 100%, "+0.4 pts". bracket-fill-roth's two figures are the ones the independent check of the diagnosis measured (RetireGolden-Docs `calculations/bidirectional-validation-plan-2026-09-13/evidence/mc-example-source-check.md`, section 4.4).

## Wrong readings

- A preview model different from the headline's (before): bracket-fill-roth reported +30.8 points from 55.2% while the KPI read 66.8%; the change the user can act on is +25.1.
- The same model at 250 paths: the base rate is paths 0 to 249 of the headline run, not the headline rate; a change of one path is 0.4 points.
- A 1,000-path preview against a published 10,000-path headline: the "before" is not the KPI's rate, and the engine refuses the pair (case AD).
- Baseline minus proposal: every green line turns red.
- Pricing a relocation or flat-rate patch with the base plan's calculator (the latent engine helper): the patched plan's state tax is computed at the base plan's flat override or local rate (case AE).
- Reading the constant 12 the spending-guardrails card published as the change (RetireGolden-Pro did).

## Limits

- A success share on N paths moves in steps of 1/N; a change smaller than a few steps is sampling noise even on shared paths.
- The comparison says nothing about the paths that fail in both plans (depth of shortfall).

## Parity test for the switch-over

`planner-ui/src/planner/insights/InsightCardView.mcDelta.parity.test.tsx`: with the synchronous pool on bracket-fill-roth, the base run is the KPI's (same rate and path count), the printed line is "+22.5 pts" where the retired configuration gave "+25.2 pts" on the default seed ("+25.1 pts" and "+30.8 pts" on the plan-id seed before D-MC-DEFAULT-SEED; asserted, not tolerated), a published 10,000-path base makes the previewed run 10,000 paths, and a split run's delta equals the single-run subtraction bit for bit; the guardrail refusal names the years and reason on a refusing example. Engine evidence: `decisions/stochastic.evidence.test.ts` (cases Y to AE); the detector's own test asserts that neither `screen` nor `evaluate` publishes a success figure and that the flag is on the detector. Acceptance grep: no `successRate -` and no `* 100` in `InsightCardView.tsx`.

## Calculation record

`monte-carlo-success-rate-comparison` (`rules/calculations/insights.ts`), kind `composition`, outputs `['insight-monte-carlo-success-delta']`, pins `stochastic.ts#compareMonteCarloSuccessRates`, `#attachStochasticMetrics` and `scalarComparison.ts#compareScalars`; limits the two above. The record states the headline model as the check corrected it (the plan's inflation mean, 12 percent volatility, per-class shocks for allocated plans; no equity weight).

## Census bookkeeping

- `relocation: { status: 'done', target: 'engine/src/decisions/stochastic.ts#compareMonteCarloSuccessRates' }`; `uiSources` `[InsightCardView.tsx#InsightCardView]` (the reader); notes "Computed in planner-ui/src/planner/insights/InsightCardView.tsx#InsightCardView ((patch − base) × 100 on a historical iid model at 250 paths) until B2-P1 slice 3; now engine engine/src/decisions/stochastic.ts#compareMonteCarloSuccessRates on the headline configuration (R11), which InsightCardView reads."
- `meaning` and `transformations` restated; `monte-carlo-success-rate`'s insights surface is restated from "base and patched 250-path runs" to the headline run and the previewed plan's run at its path count (check correction 12).
- Field coverage: `InsightImpact.successRateDeltaPct` and its exclusion are removed with the field (its reason, "never this value", was false: Pro rendered it); `InsightCardView.mcDelta` stays (it now holds the engine's fraction), with its note restated.

## Family

outputs: `insight-monte-carlo-success-delta`.

feeds: none. Reads `monte-carlo-success-rate`.

## Provenance

Derived by: claude (opus 5.5), 2026-09-27; cases Y to AD by hand and `scripts/independent.mjs`; the example lines from the scratch run. Checked by: a separate Claude (Opus 5.5) instance that did not derive it (RetireGolden-Docs `calculations/bidirectional-validation-plan-2026-09-13/evidence/b2p1-slice3-check.md`): Y to AB reproduce, the four example changes reproduce, P6 is confirmed in the engine and RetireGolden-Pro; its corrections 9 to 14 are applied above. Reviewed by: pending; the catalog asks for a reviewer of a different agent family, so the record is `unreviewed`.

Reviewed by: Codex (GPT-6-Sol), 2026-09-29, `DOCS/calculations/reviews/REVIEW-2026-09-29-codex-2-cash-flow.md`.

## Implementation (B2-P1 slice 3, 2026-09-27)

- **Correction 9**: the previewed run uses the reused base run's path count.
- **Correction 10**: `headlineMcRun` and `headlineMcRunOptions` are the exported helpers; the in-flight map stays private.
- **Correction 11**: one model, built from the base plan, for both runs.
- **Correction 13**: the flag is `Detector.previewsMonteCarlo`; `InsightImpact.successRateDeltaPct` is deleted; the card keeps its rank through `EDITORIAL_RANKING_WEIGHT_DOLLARS` (decided 2026-09-27), and `SUCCESS_RATE_POINT_DOLLAR_EQUIVALENT`, which only converted that field, is deleted with it.
- **Correction 14**: the guardrail preview's plain-words refusal.
- **Case AE** is added for the per-plan tax stack.

## Review fixes (independent review of B2-P1 slice 3, 2026-09-27)

- `planner-ui/src/planner/insights/InsightCardView.mcCallSite.test.tsx` pins the preview's own call (F6; corrections 9 and 11): with a published 200-path base run for the plan, the previewed plan runs once, at 200 paths, on options built from the base plan object (`headlineMcRunOptions(plan, 200)`), and the card prints the pair's difference. A call at the default path count, or options built from the previewed plan, fails it.

## PR #754 review fixes (2026-09-27)

- Findings 1 and 2: a published headline run is kept per plan object, and a plan object that is not edited outlives a New Year, so the preview could subtract a rate simulated from last year's start year from a previewed run simulated from this year's. The headline store now records the start year with every published and in-flight run (`publishMcHeadline(plan, summary, startYear)`, `registerMcHeadlineRun(plan, run, pathCount, startYear)`; the Monte Carlo page reads the year once and passes it to the run and to both), `headlineMcRun` returns it, and the preview runs the changed plan from that same year, so the pair stays on one market. `compareMonteCarloSuccessRates` takes `MonteCarloRateRun` (rate, path count and start year) and refuses runs from different start years as it refuses different path counts (case AF). A later run from a new start year replaces a finer run from the old one, since it is a different simulation. Tests: `InsightCardView.mcCallSite.test.tsx` publishes a 200-path run from 2026, moves the clock to 2 January 2027, and asserts the previewed run starts in 2026 and the line prints (a preview run from the clock's year fails it: the engine refuses the pair); `useMcSuccessRate.headline.test.tsx` keeps a published and an in-flight run's start year across the New Year.

- Follow-up review (on 97b9880c): the card's preview printed a caught error's own message, so a refused figure, or a refused pair of runs, read in the engine's words. `compareMonteCarloSuccessRates` now throws `MonteCarloComparisonRefusal` (a RangeError with the reason, different path counts or different start years; messages unchanged), and a detector that finds nothing to preview throws `InsightPreviewUnavailable` with a reason written for the reader (asset location, spending headroom). The card maps each to plain words with a next step (`planner/engineRefusalCopy.ts#insightPreviewErrorSentence`): "The Monte Carlo line isn't shown: your plan's success rate and the preview's came from different numbers of simulated markets. Preview again to run both on the same markets.", the same for different start years, a figure of the plan or of the preview that could not be computed, the detector's own reason, and a plain sentence for anything else. `InsightCardView.previewError.test.tsx` pins each and that none carries "NaN", "Infinity", "YYYY-MM-DD", "baseline", "proposal", "finite number" or "inflationScale".
