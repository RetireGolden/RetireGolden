## Claim

Kind: model. `projection/optimizePlan.ts#ClaimAgeCoOptimization.combinationsEvaluated`, `#ClaimAgeCoOptimization.currentClaimExactEstate`, and `#ClaimAgeCoOptimization.jointExactEstate` are published by `#optimizePlanCoOptimizingClaimAge` as `claim-age-co-optimization-combinations-evaluated`, `claim-age-co-optimization-current-claim-exact-estate`, and `claim-age-co-optimization-joint-exact-estate`. The `combinationsEvaluated` comment says the count includes the current claim, and the co-optimization comment says each candidate is optimized with the current-claim optimum. Thus the convention implies `combinationsEvaluated = 1 + generated claim candidates`; the two estate fields are respectively the current-claim exact after-tax estate and the best evaluated `(claim, schedule)` pair's exact after-tax estate.

The canonical `67y0m` label is `FRA` for every birth year, even though `socialSecurity/nra.ts#fraForBirthYear` describes a birth-year-dependent FRA: this is decision `D-CLAIM-AGE-FRA-LABEL`, a grid label rather than a personal FRA computation.

## Justification

`decisions/generators.ts#socialSecurityClaimGenerator` says it visits up to two Social Security streams and the three canonical claim ages that differ from the current claim. Its kept data give `62y0m`, `67y0m (FRA)`, and `70y0m`. `DEFAULT_CLAIM_SWITCH_MARGIN_DOLLARS = $1,000` says a claim candidate must beat the current-claim optimum by more than that amount to switch.

## Inputs

One-stream fixture: one Social Security stream currently claiming at exactly `70y0m`; no second stream.

No-stream fixture: no Social Security streams.

Current-claim-wins fixture: no traditional balance, therefore no conversions anywhere; one stream currently claiming at `70y0m`; planning age `70y1m`, just past that current claim age. Use the same options for every candidate and current plan.

## Arithmetic

One-stream fixture: canonical ages are `{62y0m, 67y0m (FRA), 70y0m}`. Remove the current `70y0m` age: generated candidates `= 3 − 1 = 2`. Include current claim: `combinationsEvaluated = 1 + 2 = 3`.

No-stream fixture: generated candidates `= 0`; `combinationsEvaluated = 1 + 0 = 1`.

Current-claim-wins fixture: no traditional balance `→` all conversion schedules are empty. Planning age is past the existing `70y0m` claim age and no later claim can improve it `→ winningClaimLabel = null` and `winningClaimPatch = null`. Therefore `jointExactEstate = currentClaimExactEstate`. The shared dollar value is run-pinned: the extract does not state the full optimizer inputs or the exact ledger result.

A claim switch, if any, requires `jointExactEstate − currentClaimExactEstate > $1,000`; equality at `$1,000` does not switch.

## Expected

- `claim-age-co-optimization-combinations-evaluated`: exact value `3` for the one-stream `70y0m` fixture and exact value `1` for the no-stream fixture; fixture tolerance exact because these are counts.
- `claim-age-co-optimization-current-claim-exact-estate`: run-pinned, no number. Fixture tolerance absolute `$0.005`, because it is a dollar figure.
- `claim-age-co-optimization-joint-exact-estate`: run-pinned, no number, and exactly equal to the run-pinned current-claim estate in the current-claim-wins fixture. Fixture tolerance absolute `$0.005` for each dollar figure.
- In the current-claim-wins fixture, `winningClaimLabel` and `winningClaimPatch` are exactly `null`; tolerance exact because they are nullable structured results.

## Wrong readings

- Counting the stream's own current `70y0m` age as a generated candidate yields `1 + 3 = 4`, rather than `3`.
- Omitting the current claim from the count yields `2`, rather than `3`; with no stream it yields `0`, rather than `1`.
- Computing the `FRA` grid label from the person's birth year can label the middle point something other than `67y0m (FRA)`; the declared grid label is always `67y0m (FRA)`.
- Switching at a `$1,000` estate advantage treats the threshold as inclusive; the required comparison is more than `$1,000`.

## Family

outputs: `claim-age-co-optimization-combinations-evaluated`, `claim-age-co-optimization-current-claim-exact-estate`, `claim-age-co-optimization-joint-exact-estate`.

feeds: `optimizer-recommended-conversion-annual` through each claim candidate's co-optimized conversion schedule.

## Provenance

Derived by: codex (gpt-5.6-terra), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-twelve.md in this directory.
