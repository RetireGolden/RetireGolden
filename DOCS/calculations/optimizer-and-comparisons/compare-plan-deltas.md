## Claim

Kind: composition. `engine/src/scenarios/planHeadlines.ts#comparePlanHeadlines` (record `plan-headline-longevity-comparison`, shared function with compare-plan-money-deltas) publishes the Compare page's three non-money rows for two projections: the money-lasts comparison on last fully funded years (R15's convention, slice 1's `moneyLasts`), the deterministic success reading (100 when the projection never depletes, else 0) and, on each side, the age in the depletion year of the person the canonical people order puts first (`model/peopleOrder.ts`: the older; decision D-PEOPLE-ORDER), each baseline, proposal and `proposal − baseline`, with no age difference when the two ages are different people's (`depletionAgeDeltaWithheld: 'differentPeople'`), with the bound the page prints when only one plan runs its full horizon. When both plans run their full horizons the published difference is null (decision of 2026-09-27 on the check's open question 6): neither exhaustion year is known. No printed cell changes.

## What the UI computed before B2-P1 slice 3

At RetireGolden `4a80669e`:

```ts
// planner-ui/src/planner/compareDeltas.ts
export function deterministicSuccessPct(depletionYear: number | null): number { return depletionYear === null ? 100 : 0 }   // :21-23
export function moneyLastsDelta(a, b): MoneyLastsDelta {                                                                  // :40-52
  const value = lastFundedYear(b) - lastFundedYear(a)            // engine lastFundedYear (slice 1)
  const aFull = a.depletionYear === null; const bFull = b.depletionYear === null
  if (aFull && bFull) return { value: 0, label: a.endYear === b.endYear ? 'same' : 'both full plan' }
  if (!aFull && !bFull) return { value, label: formatDelta(value, 'years') }
  const bound = bFull ? '≥' : '≤'; const years = formatDelta(value, 'years')
  return { value, label: years === 'same' ? `${bound} same` : `${bound} ${years}` }
}
export function ageDelta(a: number | null, b: number | null): number | null { ... return b - a }                         // :55-58

// planner-ui/src/planner/ComparePlansPage.tsx
function primaryAgeIn(plan, year) { const dobYear = Number(plan.household.people[0]?.dob.slice(0, 4)); return Number.isFinite(dobYear) ? year - dobYear : null }  // :40-44
const lasts = moneyLastsDelta({ depletionYear: l.depletionYear, endYear: left.view.result.endYear }, { ... right ... })    // :157-160
{ label: 'Success % (deterministic)', a: `${deterministicSuccessPct(l.depletionYear)}%`, ..., delta: success(r) - success(l), unit: 'pp' }  // :188-194
{ label: 'Depletion age (primary)', a: String(ageA), ..., delta: ageDelta(ageA, ageB), unit: 'years' }                    // :195-201
```

`formatDelta` (`compareDeltas.ts:65-71`) prints years as "same", "+N yr(s)" or "−N yr(s)" and points as "+N pp", "−N pp" or "0 pp" (N the rounded magnitude, the sign from the unrounded value, so the Success row reads "+100 pp", "−100 pp" or "0 pp"; it never prints "±"); `deltaClass` (`ComparePlansPage.tsx:46-49`) colours by sign, none below 0.5. Surfaces: the compare page's Money lasts, Success % (deterministic) and Depletion age (primary) rows. The census's `uiSources` named `compareDeltas.ts#compareDeltas`, a symbol that has never existed (`git log -S`/`-G` finds no definition in history); the Docs validator's `REQUIRED_UI` pinned it as well.

## Engine publication

```ts
// engine/src/projection/moneyLasts.ts (re-exported by scenarios/planHeadlines.ts)
export type MoneyLastsBound = 'atLeast' | 'atMost' | 'bothFull'
export interface MoneyLastsComparison {
  baseline: MoneyLasts        // projection/moneyLasts.ts#moneyLasts (slice 1)
  proposal: MoneyLasts
  /** proposal.lastFundedYear − baseline.lastFundedYear; null when both plans run their full horizons */
  delta: number | null
  /** 'atLeast': only the proposal runs its full plan; 'atMost': only the baseline; 'bothFull': both; null: neither */
  bound: MoneyLastsBound | null
}
export function compareMoneyLasts(baseline, proposal): MoneyLastsComparison
// engine/src/scenarios/planHeadlines.ts
PlanHeadlineComparison.moneyLasts: MoneyLastsComparison
PlanHeadlineComparison.deterministicSuccessPct: ScalarComparison      // compareScalars(baseline ? 100 : 0, proposal ? 100 : 0), 100 when depletionYear is null
PlanHeadlineComparison.depletionAge: NullableScalarComparison  // compareNullableScalars(age_b, age_p); age = depletionYear − birth year of the side's canonicalFirstPerson (the older), null when the side never depletes
PlanHeadlineComparison.depletionAgePersonId: { baseline: string | null; proposal: string | null }  // whose age, on each side (decision D-PEOPLE-ORDER, 2026-09-28; the field was depletionAgePrimary, read from household.people[0])
PlanHeadlineComparison.endYear: ScalarComparison
```

- The page's labels stay in the UI and are driven by `bound`: `bothFull` prints "same" when `endYear.delta === 0`, else "both full plan", with no colour (the colour is taken from the null delta, never from a horizon difference: 314 of the 812 example pairs are two full plans that end in different years, check correction 4); `atLeast` / `atMost` print "≥ " / "≤ " before `formatDelta(delta, 'years')`; null prints `formatDelta(delta, 'years')`. `compareDeltas.ts` keeps only `formatDelta` and `DeltaUnit`.
- A depleting side on which the person whose age is published (the canonical order's first person) has no birth date in `YYYY-MM-DD` form is refused with a `RangeError`, `PlanHeadlineRefusal` with reason `birth-date-missing` and the side (rule 4; a validated plan always has one, since `people` has at least one entry and `dob` is a required date), where the page before printed "—". The page states the refusal instead of throwing.
- When both sides publish an age and the two people differ (a different name or date of birth), `depletionAge.delta` is null and `depletionAgeDeltaWithheld` is `'differentPeople'`: the difference of two people's ages is not a quantity, so the page shows both ages without one (the independent review's L1, 2026-09-28).
- `compareScenarioPlans` gains `headline.moneyLasts: MoneyLastsComparison` (optional in the type), built by `compareMoneyLasts`, so RetireGolden-Pro's meeting view can adopt R15's convention.

## Justification

R15 (owner decision, 2026-09-25) fixes one money-lasts convention: `L = depletionYear − 1`, or `endYear` when the projection never depletes; slice 1 published it (`moneyLasts.ts`). The difference of two such years is how many more years the proposal is fully funded. When exactly one plan runs its whole horizon its true exhaustion year is unknown and later than its end, so the difference is a lower bound when that plan is the proposal and an upper bound when it is the baseline. When both run their horizons neither exhaustion year is known, and the difference of their last funded years is only the difference of their horizons, which `endYear.delta` already publishes; a number there would invite a consumer to print "+3 yrs" for two plans whose longevity difference is unknown, so the field is null and the type makes a consumer handle the case. The deterministic success reading is the single-path analogue of the Monte Carlo success rate (share of paths that never deplete) and is published as the page prints it. The depletion age uses the engine's calendar convention for age in a year (`year − birth year`, as `decisions/generators.ts`, `insights/detectors/*.ts` and the actions inventory compute it).

## Inputs

| Case | Baseline (first short year D, end E, birth date of the person whose age is published) | Proposal |
|---|---|---|
| A | D 2046, E 2052, 1962-01-01 | never, E 2049, 1953-01-01 |
| B | D 2046, E 2052, 1962-01-01 | D 2043, E 2057, 1962-06-15 |
| C | never, E 2056 | never, E 2056 |
| D | never, E 2056 | never, E 2059 |
| E | never, E 2050 | D 2056, E 2060, 1960-01-01 |
| F | D 2030, E 2050, 1960-01-01 | D 2026 (the start year), E 2050, 1960-01-01 |
| G | D 2040, E 2050, 1960-01-01 | D 2045, E 2050, no birth date |
| H | D 2050, E 2060, 1960-01-01 | never, E 2049 |
| I | D 2046, E 2052; Sam 1964-09-02 listed first, Alex 1962-04-15 | D 2043, E 2057; Alex 1962-04-15 listed first, Sam 1964-09-02 |

All start in 2026.

## Arithmetic

`L = D − 1` or `E`. A: 2045 vs 2049, delta +4, only the proposal full, `atLeast` → "≥ +4 yrs"; success 0 → 100, "+100 pp"; ages 2046 − 1962 = 84 and none → "—". B: 2045 vs 2042, −3, "−3 yrs"; success "0 pp"; ages 84 and 2043 − 1962 = 81, but the baseline's person (born 1962-01-01) and the proposal's (born 1962-06-15) are different people, so no age difference is published (`differentPeople`) and the page shows 84 and 81 with none. C: 2056 vs 2056, `bothFull`, no difference, "same". D: 2056 vs 2059, `bothFull`, no difference (the horizon gap is `endYear.delta` = 3), "both full plan", no colour. E: 2050 vs 2055, +5, only the baseline full, `atMost` → "≤ +5 yrs"; success 100 → 0, "−100 pp". F: 2029 vs 2025 (first year short; the level cell reads "short from 2026"), −4, "−4 yrs"; ages 70 and 66. G: the proposal depletes and the person whose age it would publish has no birth date: refused (`birth-date-missing`, side `proposal`). H: 2049 vs 2049, delta 0, `atLeast` → "≥ same".

## Expected

| Case | lastFunded (b, p) | delta | bound | printed | success delta | age (b, p, delta) |
|---|---|---:|---|---|---:|---|
| A | 2045, 2049 | 4 | atLeast | "≥ +4 yrs" | 100 | 84, null, null |
| B | 2045, 2042 | −3 | null | "−3 yrs" | 0 | 84, 81, null (different people, since 2026-09-28) |
| C | 2056, 2056 | null | bothFull | "same" | 0 | null, null, null |
| D | 2056, 2059 | null | bothFull | "both full plan" | 0 | null, null, null |
| E | 2050, 2055 | 5 | atMost | "≤ +5 yrs" | −100 | null, 96, null |
| F | 2029, 2025 | −4 | null | "−4 yrs" | 0 | 70, 66, −4 |
| G | refused (`RangeError`) | | | | | |
| H | 2049, 2049 | 0 | atLeast | "≥ same" | 100 | 90, null, null |
| I | (as B) | | | | | 84, 81, −3 (Alex both sides) |

Tolerance `exact` (integers). The page's cells for every case except G equal the retired ones; the published delta differs from the retired `MoneyLastsDelta.value` only in C and D (null where the retired value was 0, which the page never printed).

Example library (scratch run at `4a80669e`, staging `b2p1-s3/measure/compare-pairs.json`): on all 812 ordered pairs of the 29 examples the three rows' A, B and delta cells and colours are identical before and after, and the published deltas agree with the retired functions wherever a difference is published; `summary.depletionYear` equals `result.depletionYear` on all 29 examples.

Case I (revision 2026-09-28, decision D-PEOPLE-ORDER): the age is Alex's on both sides, the person the canonical order puts first (born 1962, the older), whichever the plan lists first: `2046 − 1962 = 84` and `2043 − 1962 = 81`, delta `−3`, and `depletionAgePersonId` is `alex` on both sides. The page labels the row "Depletion age (Alex)". Listed the other way round on both sides, the row is the same.

## Wrong readings

- The first-listed person's age, the rule before the decision: case I's baseline would read Sam's `2046 − 1964 = 82` against Alex's `81`, a difference of `−1` between two people, and reversing either plan's list would change the row.
- The engine headline's depletion-year difference (`headline.depletionYear.delta`, what RetireGolden-Pro's meeting view prints): null for A, C, D, E and H, where the page states a bound or "same"; equal to this delta only when both plans deplete (B, F).
- Mixing conventions: the "lasts through" reading R15 retired (`lastsThroughYear`: `D` for a depleting plan, `endYear + 1` for a full one) on the full side against the last funded year `D − 1` on the depleting side gives A "≥ +5 yrs". Either convention used on both sides gives +4.
- Publishing 0 for two full plans on different horizons (the retired value): D's field would say the plans last equally long; it is unknown. Publishing the difference of last funded years (3) would present the horizon gap as a longevity difference.
- Exact age on the birthday instead of `year − birth year`: F's baseline, born 1960-01-01, is 70 at every date in 2030, but a mid-year birth would read one less before the birthday; the ledger counts the calendar age.

## Limits

- The age is the older person's on each side (the canonical order's first), named in the row's label; when the two plans' older people are different people, the label names both ("Depletion age (Alex in A, Jordan in B)") and the row compares two people's ages. Until 2026-09-28 it was `household.people[0]`, labelled "(primary)".
- The age is the calendar age in the first short year, not at the moment money runs out.
- "≥ same" (case H) is a correct bound with a zero difference.
- The deterministic success reading is 100 or 0 on the one deterministic path; it is not a probability.

## Parity test for the switch-over

`planner-ui/src/planner/ComparePlansPage.parity.test.tsx` (the file compare-plan-money-deltas names) renders the page on example pairs in a stub store and asserts that the three rows' cells (A, B, the delta and its colour) equal the retired `moneyLastsDelta`, `deterministicSuccessPct` and `ageDelta`/`primaryAgeIn` outputs, kept in the test, on three pairs: example-couple against under-saved-single (only Plan B depletes: "≤ −14 yrs", "−100 pp", "—"), under-saved-single against ltc-shock (both deplete: "−13 yrs", "0 pp", "−15 yrs") and hsa-property-depth against brokerage-no-hsa (both deplete in 2042: "same", "0 pp", "same"); and that a two-full-plan pair ending in different years (example-couple against hsa-stealth-retirement) reads "both full plan", uncoloured. Until the PR #754 review (finding 3) this paragraph claimed those cell checks while the page test checked only the money rows and that last pair; `planner-ui/src/planner/comparePlanHeadlines.parity.test.ts` checks that `comparePlanHeadlines` reproduces the retired functions on all 812 ordered example pairs, reading a two-full-plan pair as the page reads it. Engine evidence: cases A to H in `scenarios/planHeadlines.evidence.test.ts`. Acceptance grep: `compareDeltas.ts` exports only `formatDelta` and `DeltaUnit`; no `dob.slice` in `ComparePlansPage.tsx`.

## Calculation record

`plan-headline-longevity-comparison` (`rules/calculations/optimizerAndComparisons.ts`), kind `composition`, outputs `['compare-plan-deltas']`, pins `planHeadlines.ts#comparePlanHeadlines`, `moneyLasts.ts#compareMoneyLasts`, `moneyLasts.ts#moneyLasts` and `scalarComparison.ts#compareNullableScalars`; limits the four above. The derivation proposed one record for both Compare families; one worksheet and one receipt per record splits it (see compare-plan-money-deltas.md). The slice 1 record `display-years-before-plan-end` adds `compare-plan-deltas` to its `feeds`.

## Census bookkeeping

- `relocation: { status: 'done', target: 'engine/src/scenarios/planHeadlines.ts#comparePlanHeadlines' }`.
- `uiSources`: `[ComparePlansPage.tsx#ComparePlansPage]` (the reader). The retired entries go to `notes`: "Computed in planner-ui/src/planner/compareDeltas.ts#moneyLastsDelta, #deterministicSuccessPct and #ageDelta and planner-ui/src/planner/ComparePlansPage.tsx#primaryAgeIn until B2-P1 slice 3; now engine engine/src/scenarios/planHeadlines.ts#comparePlanHeadlines, which ComparePlansPage reads. The census named compareDeltas.ts#compareDeltas, a symbol that never existed."
- Docs `validate-census.mjs` `REQUIRED_UI`: the `compareDeltas.ts#compareDeltas` pin becomes `ComparePlansPage.tsx#ComparePlansPage` with the "(was …, until B2-P1 slice 3)" wording.
- `transformations` restated to the engine formula; `longevity-depletion-year`'s composite `uiSources` entry `compareDeltas.ts#moneyLastsDelta / ageDelta` is removed.
- Field coverage: rows for `MoneyLastsComparison.delta` (family), `.bound` (excluded, label), `PlanHeadlineComparison.deterministicSuccessPct.*` and `.depletionAge.*` (family; `.depletionAgePrimary.*` until 2026-09-28); the planner-ui rows `MoneyLastsDelta.value`, `ageDelta.a/.b`, `moneyLastsDelta.depletionYear/.endYear` and their exclusions go with the code.

## Family

outputs: `compare-plan-deltas`.

feeds: none. Reads `longevity-depletion-year` and `longevity-last-funded-year`.

## Provenance

Derived by: claude (opus 5.5), 2026-09-27; cases A to H by hand and `scripts/independent.mjs`; the library parity from the scratch run. Checked by: a separate Claude (Opus 5.5) instance that did not derive it (RetireGolden-Docs `calculations/bidirectional-validation-plan-2026-09-13/evidence/b2p1-slice3-check.md`): cases A to H reproduce; its corrections (the colour for two full plans, case G refused, the wrong reading's null cases C and H) and the decided null delta are applied above. Reviewed by: pending; the catalog asks for a reviewer of a different agent family, so the record is `unreviewed`.

Reviewed by: Codex (GPT-6-Sol), 2026-09-29, `DOCS/calculations/reviews/REVIEW-2026-09-29-codex-4-monte-carlo-optimizer.md`.

## Implementation (B2-P1 slice 3, 2026-09-27)

- **Two full plans.** `delta` is null with `bound: 'bothFull'` (decided 2026-09-27; the derivation had proposed the raw difference); C and D above changed from 0 and 3 to null, and the page's cell and colour are unchanged.
- **Case G** is refused with a `RangeError`, as the check recommended; the derivation's expected row (80, null, null) is replaced.
- **The record split**: see compare-plan-money-deltas.md.

## Review fixes (independent review of B2-P1 slice 3, 2026-09-27)

- `compareMoneyLasts`, `MoneyLastsComparison` and `MoneyLastsBound` moved from `scenarios/planHeadlines.ts` to `projection/moneyLasts.ts`, the R15 module, and `planHeadlines.ts` re-exports them (F2). The arithmetic is unchanged. The move keeps the engine simulation core chunk's name (`useProjection-*.js`), so the bundle budget's row needs no second name; the record pins `moneyLasts.ts#compareMoneyLasts`, and the receipt mutates it there.
- `scenarios/comparison.test.ts` pins `compareScenarioPlans`' `headline.moneyLasts` (F6): a plan that runs out of money against one that runs its full horizon reads bound `atLeast` and a positive difference, and reversed, `atMost` and the negative of it, each equal to `compareMoneyLasts(baselineResult, proposalResult)`; swapping the two sides fails it.

## Revision 2026-09-28 (decision D-PEOPLE-ORDER)

- The age row read `household.people[0]` and the page labelled it "(primary)". It now reads the person `model/peopleOrder.ts#canonicalFirstPerson` puts first on each side (the older; a tie to the sex order, then the id), publishes whose it is (`depletionAgePersonId`), and the page names them in the label. The field is renamed `depletionAge`.
- On the example library it moves one example: survivor-years lists Lee (1962) before Chris (1960) and runs out of money, so every pair it is in now shows Chris's age. The other six couples list the older person first, and every single-person example is unchanged (`planner-ui/src/planner/comparePlanHeadlines.parity.test.ts` pins both).
- Case I added by claude (Opus 5.5). Reviewed by: unreviewed.
- Later the same day (the independent review's L1): when both sides publish an age and the two people differ (a different name or date of birth; ids are not compared, since a duplicated plan may re-key them), the delta is null and `depletionAgeDeltaWithheld` is `differentPeople`; the page shows both ages and "different people" in the delta cell. Case B's two people are born 1962-01-01 and 1962-06-15, so its age delta, `−3` before, is now withheld; case I's is one person's and stays `−3`.

Revision 2026-09-29 (round-one review of #765, issue 11): the claim, the engine-publication bullets, the inputs header and the arithmetic for cases B and G restated for decision D-PEOPLE-ORDER and the review's L1. The age is the canonical order's first person's, case B publishes no difference because its two sides' people differ (the Expected row already said so), and the refusal is about the person whose age is published. No expected value changes.
