## Claim

Kind: composition. `engine/src/projection/optimizePlan.ts#optimizePlanCoOptimizingClaimAge` (record `claim-change-estate-gain`) publishes `ClaimAgeCoOptimization.claimChangeEstateGain`: the joint (claim change plus conversions) optimum's after-tax estate minus the current-claim optimum's, `compareScalars(currentClaimExactEstate, jointExactEstate).delta`, and `ClaimAgeCoOptimization.estateYear`, the plan's last projection year, whose nominal dollars the three estate figures are in. The gain is 0 when no claim change won (the joint estate is then the current-claim estate) and more than the $1,000 switch margin when one did. Settled decision R17: the engine publishes one value and both surfaces (the Optimize page's claim card and the downloadable report) read it. No figure changes; the card and the report row now name the year (P8).

## What the UI computed before B2-P1 slice 3

At RetireGolden `4a80669e`:

```ts
// planner-ui/src/planner/optimizePageClaim.ts:13-17
export function claimEstateGain(claimAge: ClaimAgeCoOptimization | null): number {
  if (!claimAge?.winningClaimPatch) return 0
  return claimAge.jointExactEstate - claimAge.currentClaimExactEstate
}
// planner-ui/src/planner/OptimizePage.tsx:620-625 (rendered only when claimChangeRecommended, i.e. winningClaimPatch != null)
worth <strong>{fmtMoney(claimEstateGain(claimAge))}</strong> more projected after-tax estate than the best result at your current claim ages
({fmtMoneyCompact(claimAge.currentClaimExactEstate)} → {fmtMoneyCompact(claimAge.jointExactEstate)})
// planner-ui/src/report/reportHtml.ts:323-328 (guarded by winningClaimLabel !== null)
['Claim-change estate gain', fmtSignedMoney(claim.jointExactEstate - claim.currentClaimExactEstate)]
```

The census listed only the first copy (`uiSources` `optimizePageClaim.ts#claimEstateGain`); the report copy is the recon check's R17 finding. The two guards are equivalent: the engine assigns the label and the patch together. Inputs: `jointExactEstate` and `currentClaimExactEstate`, both after-tax estates priced on the full projection in nominal dollars at the plan's last year (the same year for both, since a claim patch changes only `incomes`).

## Engine publication

```ts
// engine/src/projection/optimizePlan.ts
export interface ClaimAgeCoOptimization {
  ...
  /**
   * jointExactEstate − currentClaimExactEstate (compareScalars, proposal minus baseline), nominal dollars of
   * estateYear: 0 when no claim change won, and more than DEFAULT_CLAIM_SWITCH_MARGIN_DOLLARS (1,000) when one
   * did. Never negative.
   */
  claimChangeEstateGain: number
  /** The plan's last projection year, whose nominal dollars the three estate figures are in. */
  estateYear: number
}
```

Set once, in the object `optimizePlanCoOptimizingClaimAge` returns, from the two estates it already publishes and the end year of the plan's own projection (the context it already runs for the claim generator); `runOptimize.ts` passes `claimAge` through unchanged (structured-clone safe). The page prints `fmtMoney(claimAge.claimChangeEstateGain)` "…more projected after-tax estate, in {estateYear} dollars, than…"; the report prints "Claim-change estate gain ({estateYear} dollars)" with `fmtSignedMoney(claim.claimChangeEstateGain)`, and its report-model evidence carries both fields. `claimEstateGain` is deleted. Both fields are required, which breaks typed literals of `ClaimAgeCoOptimization` and of the report's `ReportClaimAgeEvidence` (a CHANGELOG breaking change).

## Justification

The claim co-optimizer keeps a candidate only when `estate > baseEstate + 1000 && estate > bestEstate`, with `bestEstate` starting at `baseEstate`; so when a candidate wins, `joint − current > 1000`, and when none does the published joint estate is the current one, whose difference is exactly +0 (no −0 can arise; `compareScalars` would normalise it anyway). Both estates are priced by the same `winnerExactEstate` on plans with the same horizon, so the difference is in one year's nominal dollars, which `estateYear` names. The page's "$X more" phrasing is therefore always a positive amount; the report's signed format prints "+$X".

## Inputs

| Case | currentClaimExactEstate | jointExactEstate | winning patch |
|---|---:|---:|---|
| R | 1,000,000 | 1,118,000 | yes (the report's example-couple model) |
| S | a plan with nothing to convert, claiming at 70 in 2026 and ending in 2026 | the same | none |
| T | 2,103,456.78 | 2,109,001.02 | yes |
| W | a 62-year-old claiming at 62, $400,000 cash, $20,000 spending, planning age 95 | a claim change wins | yes |

## Arithmetic

R: 1,118,000 − 1,000,000 = 118,000; page "$118,000", report "+$118,000". S: no candidate can clear the margin with nothing to convert; the two estates are one number and the gain is +0; the card does not render and the report row is omitted (label null); `estateYear` 2026. T: 2,109,001.02 − 2,103,456.78 = 5,544.2400000002235 (bits `40b5a83d70a3d800`), page "$5,544". W (a property case on a real run): the published gain equals the joint minus the current estate exactly and exceeds $1,000, and `estateYear` is 2059 (born 1964, planning age 95), the plan's own projection end year.

## Expected

| Case | claimChangeEstateGain | estateYear | page | report |
|---|---:|---:|---|---|
| R | 118,000 | — | "$118,000" | "+$118,000" |
| S | 0 | 2026 | not rendered | row omitted |
| T | 5,544.2400000002235 | — | "$5,544" | "+$5,544" |
| W | joint − current, > 1,000 | 2059 | — | — |

Tolerance exact (`{ abs: 0 }`).

Example library (scratch run at `4a80669e`: every example with Social Security income, as the page runs it with "co-optimize claim age" ticked, objective max-after-tax-estate, start 2026): 25 of 29 examples have Social Security (early-retiree-aca, inherited-ira-beneficiary, ltc-shock and moving-state-tax do not, and the page does not offer the option). Five recommend a claim change; the page, report and engine values are bit-identical:

| Example | Winning claim change | current → joint | gain printed |
|---|---|---|---|
| example-couple | Sam claims Social Security at 70 | 3,929,681.51 → 4,033,699.48 | $104,018 |
| early-career-match | Alex claims Social Security at 70 | 15,445,677.21 → 15,553,850.81 | $108,174 |
| aggressive-saver | Taylor claims Social Security at 62 | 134,924,368.80 → 135,117,452.67 | $193,084 |
| no-head-start-grad | Nova claims Social Security at 70 | 15,795,758.50 → 15,955,482.13 | $159,724 |
| trump-account-head-start | Nova claims Social Security at 70 | 23,037,332.75 → 23,167,072.78 | $129,740 |

The other 20 publish 0 (the card reads "none beat your current claim ages by a meaningful margin"). rmd-irmaa's solver hit its 10-second limit in every run on the deriver's machine; its claim result is still the current claim.

Since B2-P1 slice 5 (`claim-age-co-optimization`, the refusals decided 2026-09-25) none of the five wins: each has Marketplace years whose premium tax credit the ledger cannot price, so the search refuses there and publishes 0, and no example's claim change wins. The winning case is carried by the constructed plan above, and the planner's parity test runs on a constructed plan too.

## Wrong readings

- Current minus joint: R reads −$118,000 on a card that says "more".
- Reading a stale pair after an edit: the page holds the previous result for up to its 300 ms debounce after a plan edit (P9), a window the engine field does not change (see the follow-up in staging `b2p1-s3/addendum.md`).
- Gain in today's dollars: the published figure is nominal at the plan's last year (see Limits).

## Limits

- The gain is in nominal dollars of the plan's last year, like both estates beside it: for aggressive-saver (last year 2091, published factor 4.977958256801299) $193,083.87 is $38,787.76 in 2026 dollars. The card and the report row name the year (P8).
- The gain compares optima on after-tax estate whatever objective the tournament ranked by; the card says "after-tax estate".

## Parity test for the switch-over

`planner-ui/src/planner/optimizePageClaim.parity.test.ts`: `claimAge.claimChangeEstateGain` equals the retired `claimEstateGain(claimAge)` under `Object.is` on a winning and a non-winning co-optimization (example-couple, which wins with "Sam claims Social Security at 70", and bracket-fill-roth, which keeps its claim ages), each through `runOptimizeRequest`; `reportHtml` renders "Claim-change estate gain (2059 dollars)" beside the retired subtraction's figure for the example-couple report model. Engine evidence: `projection/optimizePlan.claimGain.evidence.test.ts` (cases R, S, T and W). Acceptance grep: no `jointExactEstate -` in planner-ui.

## Calculation record

`claim-change-estate-gain` (`rules/calculations/optimizerAndComparisons.ts`), kind `composition`, outputs `['claim-age-co-optimization-estate-gain']`, pins `optimizePlan.ts#optimizePlanCoOptimizingClaimAge` and `scalarComparison.ts#compareScalars`; limits the two above. The derivation proposed extending the existing `claim-age-co-optimization` record instead; that record's worksheet already has its own mutation receipt (for the claim generator), and a record names one worksheet and one receipt, so the gain has its own record, worksheet and receipt, and `claim-age-co-optimization` is unchanged.

## Census bookkeeping

- `relocation: { status: 'done', target: 'engine/src/projection/optimizePlan.ts#ClaimAgeCoOptimization.claimChangeEstateGain' }`; `uiSources` `[OptimizePage.tsx#OptimizePage, report/reportHtml.ts#recommendationSection]` (the readers); notes "Computed in planner-ui/src/planner/optimizePageClaim.ts#claimEstateGain (jointExactEstate − currentClaimExactEstate when a claim patch won) and again in planner-ui/src/report/reportHtml.ts#recommendationSection (R17) until B2-P1 slice 3; now engine ClaimAgeCoOptimization.claimChangeEstateGain, which both read."
- New surface on the family: `report`, selector "Downloadable report modeled findings: Claim-change estate gain (year dollars)".
- Field coverage: rows `ClaimAgeCoOptimization.claimChangeEstateGain` (family), `.estateYear` (excluded, coordinate), `ReportClaimAgeEvidence.claimChangeEstateGain` (family) and `.estateYear` (excluded); the planner-ui row `claimEstateGain.return` goes with the code.

## Family

outputs: `claim-age-co-optimization-estate-gain`.

feeds: none. Reads `claim-age-co-optimization-joint-exact-estate` and `claim-age-co-optimization-current-claim-exact-estate`.

## Provenance

Derived by: claude (opus 5.5), 2026-09-27; cases R to T by hand and `scripts/independent.mjs`; the example rows from the scratch run. Checked by: a separate Claude (Opus 5.5) instance that did not derive it (RetireGolden-Docs `calculations/bidirectional-validation-plan-2026-09-13/evidence/b2p1-slice3-check.md`): R to T reproduce, the five winners are bit-identical on the page, the report and the engine, and its correction 15 (a required field and a changed report model) is applied. Reviewed by: pending at the time; the catalog asks for a reviewer of a different agent family, so the record was `unreviewed` until the review below.

Reviewed by: Codex (GPT-6-Sol), 2026-09-29, `DOCS/calculations/reviews/REVIEW-2026-09-29-codex-4-monte-carlo-optimizer.md`.

## Implementation (B2-P1 slice 3, 2026-09-27)

- **`estateYear`** is added so both surfaces can name the year (P8) without the page recomputing the plan's horizon; the report model gains it with the gain.
- **Case W** replaces the derivation's "plan pinned to win" with a cash-only plan (nothing to convert, so no conversion schedule can be withheld for account identity and the claim change can win on its own).
- **The separate record** is described under "Calculation record".
