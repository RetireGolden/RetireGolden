## Claim

Kind: composition. `engine/src/scenarios/planHeadlines.ts#comparePlanHeadlines` (record `plan-headline-money-comparison`) publishes the Compare page's four money rows for two already-projected plans that share a start year: ending net worth, ending investable, ending after-tax estate and lifetime tax plus penalties, each as `{ baseline, proposal, delta }` with `delta = proposal − baseline` (the one convention, `scenarios/scalarComparison.ts#compareScalars`), in one stated basis for the whole table. Owner decision R13 (fix): when the two plans end in different years every money row is in today's (start-year) dollars, and the page says so on the rows and in a sentence; when they end in the same year the rows stay nominal, as before.

## What the UI computed before B2-P1 slice 3

`planner-ui/src/planner/ComparePlansPage.tsx` at RetireGolden `4a80669e`:

```tsx
const l = left.view.summary; const r = right.view.summary                                   // :153-154
{ label: 'Ending net worth',  a: fmtMoneyCompact(l.endingNetWorth),  b: ..., delta: r.endingNetWorth - l.endingNetWorth }                 // :170-175
{ label: 'Ending investable', a: ..., delta: r.endingInvestable - l.endingInvestable }                                                      // :176-181
{ label: 'After-tax estate',  a: ..., delta: r.endingAfterTaxEstate - l.endingAfterTaxEstate }                                              // :182-187
{ label: 'Lifetime tax + penalties', a: ..., delta: r.lifetimeTaxesAndPenalties - l.lifetimeTaxesAndPenalties, higherIsGood: false }      // :202-208
```

Each side was `projectPlan(plan)` at its own clock read (`:136`, inside two separate asynchronous loads), so both usually shared the start year, but each ended in its own last planning year. The cell printed `formatDelta(delta, 'money')` = `${delta > 0 ? '+' : ''}${fmtMoneyCompact(delta)}` (`compareDeltas.ts:66`); the colour was `deltaClass` (`ComparePlansPage.tsx:46-49`: none below 0.5 in magnitude, else green for better, red for worse, lifetime tax inverted at `:75`). The page stated no basis anywhere. Inputs: `ProjectionSummary.endingNetWorth`, `.endingInvestable`, `.endingAfterTaxEstate` (all nominal at each plan's own `endYear`) and `.lifetimeTaxesAndPenalties` (an undiscounted sum of each year's nominal `tax + penalties`).

## Engine publication

```ts
// engine/src/scenarios/scalarComparison.ts (new leaf module; comparison.ts re-exports the types)
export interface ScalarComparison { baseline: number; proposal: number; /** proposal − baseline */ delta: number }
export interface NullableScalarComparison { baseline: number | null; proposal: number | null; delta: number | null }
/** Moved from comparison.ts#scalar: −0 becomes 0 on every member; a non-finite operand or delta throws a RangeError. */
export function compareScalars(baseline: number, proposal: number): ScalarComparison
export function compareNullableScalars(baseline: number | null, proposal: number | null): NullableScalarComparison

// engine/src/scenarios/planHeadlines.ts (new)
export interface ComparedProjection {
  plan: Pick<Plan, 'household'>
  result: Pick<ProjectionResult, 'startYear' | 'endYear' | 'depletionYear' | 'years'>
  summary: Pick<ProjectionSummary, 'endingNetWorth' | 'endingInvestable' | 'endingAfterTaxEstate' | 'lifetimeTaxesAndPenalties'>
}
export type HeadlineMoneyBasis = 'nominal' | 'today'
export interface PlanHeadlineComparison {
  startYear: number
  /** 'today' exactly when the two plans end in different years (R13). */
  moneyBasis: HeadlineMoneyBasis
  endYear: ScalarComparison
  endingNetWorth: ScalarComparison
  endingInvestable: ScalarComparison
  endingAfterTaxEstate: ScalarComparison
  lifetimeTaxesAndPenalties: ScalarComparison
  moneyLasts: MoneyLastsComparison              // compare-plan-deltas
  deterministicSuccessPct: ScalarComparison     // compare-plan-deltas
  depletionAge: NullableScalarComparison // compare-plan-deltas (depletionAgePrimary until 2026-09-28)
  depletionAgePersonId: { baseline: string | null; proposal: string | null } // whose age, on each side
}
/** Refuses two results with different start years (a RangeError naming both). */
export function comparePlanHeadlines(baseline: ComparedProjection, proposal: ComparedProjection): PlanHeadlineComparison
```

Formula, with `f_s(y)` the side's own published `inflationScale` read through `projectionDollarBasis(result)` (slice 1), `E_s` its `endYear`:

- `nominal` (E_b = E_p): each ending value is the summary figure; lifetime tax is `summary.lifetimeTaxesAndPenalties`.
- `today` (E_b ≠ E_p): each ending value is `toTodayDollars(basis_s, E_s, x) = x / f_s(E_s)`; lifetime tax is `Σ_y toTodayDollars(basis_s, y, tax_y + penalties_y)` over the side's years in ledger order, from 0.
- Every row: `compareScalars(baselineValue, proposalValue)`.

Domain: finite values, whole start and end years, equal start years. Refusals: two different start years and a non-finite operand or difference (from `compareScalars`, whose message says which operand, and never names "scenario comparison"), each a `RangeError`; in `today` mode a projection whose rows give no dollar basis, refused by `projectionDollarBasis` with a plain `Error` (rows missing, out of order or without a usable `inflationScale`) or a `RangeError` (start or end year not a whole year, or the end before the start with rows present). Units: USD, nominal or start-year dollars as `moneyBasis` says. Timing: once per pair. Rounding: none (the page formats).

The page (`ComparePlansPage.tsx`) keeps formatting, labels and colour. It projects both plans at one start year read once per load (correction 1 of the check), catches a refusal into a stated message in plain words with a next step ("These two plans can't be compared: …", see the PR #754 review fixes below) instead of throwing inside a React memo, states the basis where the numbers are and under the table (correction 3):

- Row labels: in `today` mode every money row ends "(2026 $)"; in `nominal` mode the three ending rows end "(E $)" and the lifetime row "(nominal)".
- Sentence, `today` mode: "Plan A ends in E_A and Plan B in E_B, so every dollar row is in S dollars: each plan's figures are divided by that plan's own inflation to the year they fall in. The lifetime rows still cover each plan's own years."
- Sentence, `nominal` mode: "Both plans end in E, so the dollar rows are nominal: the ending rows are in E dollars and lifetime tax adds each year's own dollars. Each plan's dollars follow its own inflation assumption." (correction 2's limit).

`compareScenarioPlans` builds its own `headline` through the same `compareScalars`, unchanged in basis (the Scenarios page labels it nominal and prints the projection end year), and gains `headline.moneyLasts` (optional in the type, since RetireGolden-Pro stores comparisons) from `projection/moneyLasts.ts#compareMoneyLasts` (re-exported by `planHeadlines.ts`).

Decision R13 (fix). Old reading: `delta = x_B(E_B) − x_A(E_A)` in nominal dollars of two different years. Corrected: `x_B(E_B)/f_B(E_B) − x_A(E_A)/f_A(E_A)`. Worked case I below: +$200,000 becomes −$131,364.95.

## Justification

A nominal dollar at the end of one plan and a nominal dollar at the end of the other are different units when the years differ: at the examples' 2.5 percent, 2076 dollars are worth 2.2589 / 3.4371 of 2059 dollars. Subtracting them reports inflation as a difference between plans. The engine's own scenario comparison publishes `projectionEndYear` beside the same subtraction (`comparison.ts`) precisely because the horizon is not a plan outcome, but the Compare page never showed the end years beside the money rows. Dividing each side by its own published factor puts both in the start year's dollars, a unit both plans share (the page projects both from one start year). Each side uses its own inflation assumption because that assumption is part of the plan being compared, and it is the factor that plan's own "today's dollars" views already use (Results, KPI, relocation). The lifetime sum is restated year by year, not by the end-year factor, because each year's tax is in that year's dollars. When the end years match, nominal dollars of that year are one unit already and the numbers do not change, so a duplicated plan (the page's main use) is untouched. Rule 2 of the 2026-09-25 decision record: the code follows what it says, and the page now says which basis it shows.

## Inputs

| Case | Baseline | Proposal | Start |
|---|---|---|---|
| H | ends 2050, 2.5%, estate 1,000,000 | ends 2050, 2.5%, estate 1,250,000 | 2026 |
| I | ends 2050, 2.5%, estate 1,800,000 | ends 2060, 2.5%, estate 2,000,000 | 2026 |
| J | ends 2027, 2%, tax + penalties per year 4,500 + 500, 5,100 | ends 2028, 2%, 3,000, 3,060, 3,121.2 | 2026 |
| K | ends 2056, 2.5%, estate 1,000,000, lifetime tax 100 | ends 2056, 2.0%, estate 1,100,000, lifetime tax 90 | 2026 |
| L | start 2026 | start 2027 | — |
| M | estate NaN | estate 1 | 2026 |

## Arithmetic

Factors by the ledger recurrence `f(start) = 1`, `f(y+1) = f(y) × (1 + r)`, left to right:

- 2.5%: `f(2050) = 1.8087259495825871` (bits `3ffcf08a9f0e23de`; `Math.pow(1.025, 24)` gives the same double), `f(2060) = 2.315322132747548` (bits `400285c79c3ed874`).
- 2%: `f(2026) = 1`, `f(2027) = 1.02`, `f(2028) = 1.0404`.

H: same end year, `nominal`: delta = 1,250,000 − 1,000,000 = 250,000.

I: different end years, `today`: 1,800,000 / 1.8087259495825871 = 995,175.6375339222; 2,000,000 / 2.315322132747548 = 863,810.6860865355; delta = −131,364.95144738676 (bits `c10009279c907290`). The nominal delta was +200,000: the sign flips.

J: `today`: baseline (4,500 + 500)/1 + 5,100/1.02 = 5,000 + 5,000 = 10,000; proposal 3,000 + 3,060/1.02 + 3,121.2/1.0404 = 3,000 + 3,000 + 3,000 = 9,000; delta = −1,000. Nominal: 10,100 against 9,181.2, delta −918.8. The penalty in the baseline's first year is part of that year's figure.

K: same end year with different inflation: `nominal`, estate delta 100,000, lifetime tax delta −10 (no deflation: 2056 dollars are one year's dollars whatever each plan assumes about prices; the limit below says what that leaves).

L: refused (`RangeError`: the start years 2026 and 2027 differ). M: refused (`RangeError` from `compareScalars`, the baseline operand is not finite), where the page before printed "—" for the level and for the delta.

## Expected

| Case | moneyBasis | estate {baseline, proposal, delta} | lifetime tax {baseline, proposal, delta} |
|---|---|---|---|
| H | nominal | 1,000,000 / 1,250,000 / 250,000 | — |
| I | today | 995,175.6375339222 / 863,810.6860865355 / −131,364.95144738676 | — |
| J | today | 0 / 0 / 0 | 10,000 / 9,000 / −1,000 |
| K | nominal | 1,000,000 / 1,100,000 / 100,000 | 100 / 90 / −10 |
| L | throws `RangeError` | | |
| M | throws `RangeError` | | |

Tolerance: exact (`{ abs: 0 }` in the evidence, since case I's figures are not whole numbers; the check confirmed case I's bits). Printed (I): "$995k", "$864k", "−$131k" in red; before, "$1.80M", "$2.00M", "+$200k" in green.

Example library (scratch run at `4a80669e`, both plans stamped as the app opens them, start 2026; staging `b2p1-s3/measure/compare-pairs.json`, table `measure/compare-changes.md`; re-measured at `cb72713e`, staging `b2p1-s3/addendum-measure/compare-pairs.json`, after main's #753 gave the bracket-fill household's second spouse a Roth IRA, which moved only bracket-fill-roth's figures; the counts are at `cb72713e`): of the 812 ordered pairs of the 29 examples, 50 end in the same year and change nothing (bit-identical deltas; they include every designed A/B pair: annuity-purchases-estate / no-annuity-brokerage, glidepath-allocation / static-allocation-control, hsa-property-depth / brokerage-no-hsa, all-401k-no-bridge / brokerage-bridge-401k, no-head-start-grad / trump-account-head-start, guardrails-flex-goals / fixed-target-spending). The other 762 switch to today's dollars: 678 cells change in each ending row (the 84 others are $0 against $0) and 762 in lifetime tax; the delta's sign, and so its colour, flips in 30 estate cells, 24 net-worth, 18 investable and 6 lifetime-tax cells (8 at `4a80669e`, where under-saved-single against bracket-fill-roth flipped both ways; it now reads $184k, $219k, +$35k before and $129k, $210k, +$81k after, both red). For instance:

| A (end) | B (end) | Row | before (A, B, delta) | after |
|---|---|---|---|---|
| example-couple (2059) | hsa-stealth-retirement (2076) | After-tax estate | $3.70M, $4.03M, +$329k green | $1.64M, $1.17M, −$466k red |
| example-couple (2059) | hsa-stealth-retirement (2076) | Ending net worth | $3.70M, $4.49M, +$792k green | $1.64M, $1.31M, −$332k red |
| example-couple (2059) | annuity-purchases-estate (2056) | After-tax estate | $3.70M, $3.25M, −$448k red | $1.64M, $1.65M, +$6,225 green |
| rmd-irmaa (2048) | glidepath-allocation (2053) | After-tax estate | $1.21M, $1.27M, +$64k green | $702k, $653k, −$49k red |
| moving-state-tax (2056) | coast-fire (2086) | After-tax estate | $3.88M, $7.77M, +$3.89M green | $1.85M, $1.77M, −$85k red |
| moving-state-tax (2056) | hsa-stealth-retirement (2076) | Lifetime tax + penalties | $733k, $808k, +$75k red | $491k, $439k, −$52k green |
| annuity-purchases-estate (2056) | no-annuity-brokerage (2056) | After-tax estate | $3.25M, $3.68M, +$430k | unchanged (nominal) |

The example-couple / hsa-stealth-retirement pair's retired estate delta (+$329k) and ending net worth delta (−$332k) are the current figures, after the 2027 HSA limit (Revision, 2026-09-28, below); at `cb72713e` they read +$330k and −$331k. The other cells are as measured at `cb72713e`.

## Wrong readings

- Nominal subtraction across end years (before): case I reports +$200,000 where the proposal is worth $131,365 less in start-year dollars.
- Deflating both sides by the baseline's factor at its own end year: case I gives +110,575.07; still a mix of two years.
- Deflating the lifetime sum by the end-year factor: case J gives 9,901.96 against 8,824.68 (delta −1,077.28) instead of −1,000; it treats every year's tax as if paid in the last year.
- Converting only when the inflation assumptions differ: case K would deflate two figures that are already in one year's dollars, and case I (same inflation, different years) would stay wrong.
- Always converting: the 50 same-end pairs, including every designed A/B pair, would change their printed figures for no new fact.

## Limits

- Each side is deflated by its own inflation assumption; two plans with different assumptions are compared in "each plan's own view" of start-year dollars. When they end in the same year the rows stay nominal, and that year's dollars then buy different amounts under each assumption: 20 of the 50 same-end pairs of the example library assume different inflation (at 2056, annuity-purchases-estate and no-annuity-brokerage assume 2.3 percent against 2.5 for early-retiree-aca, moving-state-tax and ltc-shock; at 2053, hsa-property-depth and brokerage-no-hsa assume 2.6 against 2.5 for glidepath-allocation and static-allocation-control). The nominal sentence says each plan's dollars follow its own inflation assumption (check correction 2).
- Lifetime rows still cover each plan's own years: a plan that runs ten years longer pays ten more years of tax; the page names both end years.
- A plan's own level cells depend on its partner: the same plan reads in nominal dollars beside a plan that ends in its year and in start-year dollars beside one that does not, which is why the basis is on every money row (check correction 3).
- The delta is the difference of the unrounded values; beside compact levels ("$1.23M") it can differ from the difference of the two printed levels by up to half a display unit on each side. The page shows compact levels by design, so the exact difference stays (a reader wants the true gap, not the gap between two abbreviations).

## Parity test for the switch-over

`planner-ui/src/planner/ComparePlansPage.parity.test.tsx` (jsdom, a stub plan store holding three examples): for a same-end pair (annuity-purchases-estate / no-annuity-brokerage) the four money cells equal the retired expressions bit for bit and the page shows the nominal sentence naming 2056; for a different-end pair (example-couple / hsa-stealth-retirement) the estate cell reads "−$466k" in red where the retired expression gave "+$330k" (asserted, not tolerated), and the page shows the today's-dollar sentence naming 2059, 2076 and 2026 and the "(2026 $)" row labels. `planner-ui/src/planner/comparePlanHeadlines.parity.test.ts` reproduces the retired money deltas on the same-end example pairs and the today's-dollar figures on the others. Engine evidence: `scenarios/planHeadlines.evidence.test.ts` carries cases H to M. Acceptance grep: no `r.ending` / `- l.` arithmetic left in `ComparePlansPage.tsx`.

## Calculation record

`plan-headline-money-comparison` (`rules/calculations/optimizerAndComparisons.ts`), kind `composition`, outputs `['compare-plan-money-deltas']`. The derivation proposed one record, `plan-headline-comparison`, for both Compare families; a record names one worksheet and one mutation receipt, so the implementation splits it into this record and `plan-headline-longevity-comparison` (compare-plan-deltas.md), both implemented by `comparePlanHeadlines`. The two restated records `scenario-scalar-comparison` and `scenario-nullable-scalar-comparison` pin the leaf module; their evidence now asserts the exported helpers directly as well as through `compareScenarioPlans`.

## Census bookkeeping

- `relocation: { status: 'done', target: 'engine/src/scenarios/planHeadlines.ts#comparePlanHeadlines' }`; `uiSources` `[ComparePlansPage.tsx#ComparePlansPage]` (it now reads the engine value); notes "Computed in planner-ui/src/planner/ComparePlansPage.tsx#ComparePlansPage (proposal minus baseline of nominal summary figures, across plans that can end in different years) until B2-P1 slice 3; now engine engine/src/scenarios/planHeadlines.ts#comparePlanHeadlines, nominal when the plans end in the same year and today's dollars otherwise (R13), which ComparePlansPage reads."
- `basis`: `nominal` becomes `either`; `meaning` and `transformations` restated to the engine formula.
- Surfaces on the four engine summary families on the compare page gain the basis note.
- Field coverage: rows for `PlanHeadlineComparison.endingNetWorth/.endingInvestable/.endingAfterTaxEstate/.lifetimeTaxesAndPenalties` (family), `.moneyBasis` (excluded, label), `.startYear`, `.endYear` (excluded, coordinate); the planner-ui row `ComparePlansPage.tsx module.delta` goes with the code; `ScalarComparison.*` rows move their source to `engine/src/scenarios/scalarComparison.ts`.

## Family

outputs: `compare-plan-money-deltas`.

feeds: none. Reads `projection-summary-ending-net-worth`, `projection-summary-ending-investable`, `projection-summary-ending-after-tax-estate`, `projection-summary-lifetime-taxes-and-penalties` and `display-dollar-basis-conversion`.

## Provenance

Derived by: claude (opus 5.5), 2026-09-27; cases H to M by hand and `scripts/independent.mjs` (no engine import); the example-library figures from the scratch run, with "after" computed by a scratch implementation of this worksheet's formula over existing engine primitives; a second engine-free pass recomputed all 762 today's-dollar estate deltas from the per-example summaries with the ledger recurrence alone and matched every one bit for bit. Checked by: a separate Claude (Opus 5.5) instance that did not derive it, which recomputed every case with its own script and every example cell with its own implementation (all 3,248 money cells bit-identical; RetireGolden-Docs `calculations/bidirectional-validation-plan-2026-09-13/evidence/b2p1-slice3-check.md`); its corrections 1 to 4 are applied above. Reviewed by: pending; the catalog asks for a reviewer of a different agent family, so the record is `unreviewed`.

Revision 2026-09-29 (Codex review, `DOCS/calculations/reviews/REVIEW-2026-09-29-codex-4-monte-carlo-optimizer.md`): the example-pair table kept +$330k and −$331k for the example-couple / hsa-stealth-retirement pair after the 2027 HSA limit moved them; the table now reads +$329k and −$332k, as the 2026-09-28 revision and the planner-ui parity tests already did. No other figure changes. Revised by claude (opus 5.5); unreviewed until the reviewer checks the revision.

## Implementation (B2-P1 slice 3, 2026-09-27)

- **Correction 1 (refusals).** Both plans are projected at one start year read once per load, and the page catches a refusal into a stated message. The comparison's own refusals are `RangeError`s, and `compareScalars`' message names the operand and not "scenario comparison"; the dollar-basis refusal in `today` mode is `projectionDollarBasis`'s, a plain `Error` for a missing, out-of-order or unscaled row. The page catches any `Error`, so the reader sees each stated the same way (review F5).
- **Correction 2 (mixed inflation).** A stated limit and a clause in the nominal sentence; R13 itself is unchanged, as decided.
- **Correction 3 (where the basis appears).** Every money row's label carries its basis, and the today's-dollar sentence says the lifetime rows cover each plan's own years.
- **Case J** gives the baseline's first year a $500 penalty (4,500 + 500) where the derivation had 5,000 of tax, so the evidence also shows the lifetime figure is tax plus penalties; the arithmetic is unchanged.
- **The record split** (one record per worksheet) is described under "Calculation record".
- Displayed changes at the final head are measured in staging `b2p1-s3/addendum.md`.

## Review fixes (independent review of B2-P1 slice 3, 2026-09-27)

- Refusal classes (F5): the comparison's own refusals are `RangeError`s, and the dollar-basis refusal is `projectionDollarBasis`'s plain `Error`; the Domain paragraph and correction 1 above say so, and so does `comparePlanHeadlines`' doc comment.
- `planner-ui/src/planner/ComparePlansPage.refusal.test.tsx` pins the page's two guards (F6). A comparison the engine refuses is stated in an alert, with no table (in the engine's wording until the PR #754 review; in plain words since, below); a page that rethrew it fails the test. Both plans are projected from the one start year read before they load: with the clock moved into 2027 while the second plan loads, both sides still start in 2026 and the rows are in 2026 dollars; projected from the clock at load time, the sides would start in different years and the engine would refuse the pair.

## PR #754 review fixes (2026-09-27)

- Finding 9: `comparePlanHeadlines` builds each side's dollar basis once per comparison, and only when the plans end in different years; the three ending rows and the lifetime sum read that one basis (`scenarios/planHeadlines.basisOnce.test.ts`: two builds in `today` mode, none in `nominal` mode). The figures are unchanged.
- Finding 11: the refusal alert said the engine's own words ("the proposal is NaN", "no birth date in YYYY-MM-DD form"). The engine's refusals now carry their kind: `NonFiniteComparisonError` (`scenarios/scalarComparison.ts`, a RangeError naming the operand, baseline, proposal or difference) and `PlanHeadlineRefusal` (`scenarios/planHeadlines.ts`, a RangeError with the reason, different start years or a missing date of birth, and the side); their messages are unchanged. The page says each in plain words with what to do: a figure of Plan A or Plan B that could not be computed ("Open Plan B's Results page to check its projection, then compare again."), a difference that could not be computed, a plan that runs out of money whose first person has no valid date of birth ("Add the date of birth on Plan A's Household page, then compare again."), two different start years ("Reload this page so both are projected from this year."), and any other refusal, such as a projection with no dollar basis. `ComparePlansPage.refusal.test.tsx` pins each sentence and that none carries "NaN", "Infinity", "YYYY-MM-DD", "baseline", "proposal", "finite number" or "inflationScale".

## Revision, 2026-09-28 (the 2027 published figures)

The example-library table above was measured at `cb72713e`. With the 2027 HSA limit read as published ($4,500 self-only, Rev. Proc. 2026-24, where 2027 had been $4,400 grown at plan inflation), hsa-stealth-retirement's HSA takes a little less each working year, and its nominal ending net worth falls $240 (4,493,650.52 to 4,493,410.11). Two printed cells of the example-couple / hsa-stealth-retirement pair move by one rounding step: the retired nominal estate delta reads +$329k (was +$330k), and the ending net worth delta in 2026 dollars reads −$332k (was −$331k). The after-tax estate cell still reads −$466k in red. `ComparePlansPage.parity.test.tsx` and `comparePlanHeadlines.parity.test.ts` assert the new figures. The comparison convention, the formula and the engine evidence are unchanged.

Reviewed by: Codex (GPT-6-Sol), 2026-09-30, targeted re-check after the fix, `DOCS/calculations/reviews/REVIEW-2026-09-30-recheck-codex.md`.
