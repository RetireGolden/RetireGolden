## Claim

Kind: model. `projection/optimizePlan.ts#ClaimAgeCoOptimization.combinationsEvaluated`, `#ClaimAgeCoOptimization.currentClaimExactEstate`, and `#ClaimAgeCoOptimization.jointExactEstate` are published by `#optimizePlanCoOptimizingClaimAge` as `claim-age-co-optimization-combinations-evaluated`, `claim-age-co-optimization-current-claim-exact-estate`, and `claim-age-co-optimization-joint-exact-estate`. The `combinationsEvaluated` comment says the count includes the current claim, and the co-optimization comment says each candidate is optimized with the current-claim optimum. Thus the convention implies `combinationsEvaluated = 1 + generated claim candidates`; the two estate fields are respectively the current-claim exact after-tax estate and the best evaluated `(claim, schedule)` pair's exact after-tax estate.

The middle canonical claim age is the person’s own full retirement age from `socialSecurity/nra.ts#fraForBirthYear`, which depends on the birth year (decision `D-CLAIM-AGE-FRA-LABEL`, 2026-09-25).

## Justification

`decisions/generators.ts#socialSecurityClaimGenerator` says it visits up to two Social Security streams and the three canonical claim ages that differ from the current claim. It builds `62y0m`, the person’s FRA, and `70y0m`. `DEFAULT_CLAIM_SWITCH_MARGIN_DOLLARS = $1,000` says a claim candidate must beat the current-claim optimum by more than that amount to switch.

## Inputs

One-stream fixture: one Social Security stream currently claiming at exactly `70y0m`; no second stream.

No-stream fixture: no Social Security streams.

Current-claim-wins fixture: planning age `70`, a whole number of years as the plan schema requires; one stream currently claiming at `70y0m`; no traditional balance, therefore no conversions anywhere. Use the same options for every candidate and current plan.

## Arithmetic

One-stream fixture: the person is born 1956-01-01, so the effective birth year is 1955 and the FRA is `66y2m`; canonical ages are `{62y0m, 66y2m (FRA), 70y0m}`. Remove the current `70y0m` age: generated candidates `= 3 − 1 = 2`. Include current claim: `combinationsEvaluated = 1 + 2 = 3`.

No-stream fixture: generated candidates `= 0`; `combinationsEvaluated = 1 + 0 = 1`.

Current-claim-wins fixture: the co-optimizer evaluates the two generated candidates, `62y0m` and `66y2m (FRA)`, with the same options as the current plan and, because there is no traditional balance, empty conversion schedules. A candidate replaces the current claim only when its `jointExactEstate − currentClaimExactEstate > $1,000`. Neither candidate clears that switch margin over the current-claim estate, so `winningClaimLabel = null` and `winningClaimPatch = null`, and `jointExactEstate = currentClaimExactEstate`. The shared dollar value is run-pinned: the extract does not state the full optimizer inputs or the exact ledger result.

A claim switch, if any, requires `jointExactEstate − currentClaimExactEstate > $1,000`; equality at `$1,000` does not switch.

## Expected

- `claim-age-co-optimization-combinations-evaluated`: exact value `3` for the one-stream `70y0m` fixture and exact value `1` for the no-stream fixture; fixture tolerance exact because these are counts.
- `claim-age-co-optimization-current-claim-exact-estate`: run-pinned, no number. Fixture tolerance absolute `$0.005`, because it is a dollar figure.
- `claim-age-co-optimization-joint-exact-estate`: run-pinned, no number, and exactly equal to the run-pinned current-claim estate in the current-claim-wins fixture. Fixture tolerance absolute `$0.005` for each dollar figure.
- In the current-claim-wins fixture, `winningClaimLabel` and `winningClaimPatch` are exactly `null`; tolerance exact because they are nullable structured results.

## Wrong readings

- Counting the stream's own current `70y0m` age as a generated candidate yields `1 + 3 = 4`, rather than `3`.
- Omitting the current claim from the count yields `2`, rather than `3`; with no stream it yields `0`, rather than `1`.
- Using `67y0m` as the FRA point for every birth year gives a `67y0m (FRA)` candidate for this 1956 birth, whose FRA is `66y2m`; the count is the same, the label and claim age are wrong.
- Switching at a `$1,000` estate advantage treats the threshold as inclusive; the required comparison is more than `$1,000`.
- Treating the planning age as past the current claim age (`70y1m`) and concluding no candidate is evaluated would report `combinationsEvaluated = 1` for that fixture, whereas the count is `3` (the current claim plus two candidates) and the null winner comes from the margin, not from an empty candidate set.

## Family

outputs: `claim-age-co-optimization-combinations-evaluated`, `claim-age-co-optimization-current-claim-exact-estate`, `claim-age-co-optimization-joint-exact-estate`.

feeds: `optimizer-recommended-conversion-annual` through each claim candidate's co-optimized conversion schedule.

## Provenance

Derived by: codex (gpt-5.6-terra), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-twelve.md in this directory. Revision 2026-09-22: the current-claim-wins case was re-derived on the schema fact that planningAge is a whole number of years; the null winner follows from the $1,000 switch margin over two evaluated candidates, not from a planning age past the current claim. Re-derived by codex without executing the engine. Revision 2026-09-25: the middle claim age became the person’s own FRA (decision D-CLAIM-AGE-FRA-LABEL), so the one-stream and current-claim-wins cases name 66y2m for the 1956-01-01 birth; edited by Claude to match the code, with the counts, the null winner and the run-pinned estates unchanged.
