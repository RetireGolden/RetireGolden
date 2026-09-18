## Claim

Kind: composition. `insights/detectors/stateRelocation.ts#stateRelocation.evaluate` publishes start-year-dollar lifetime state-and-local tax saved as baseline tax minus the selected candidate's tax over the union of their annual series, with missing years treated as zero and only the final sum floored at zero.

## Justification

The sweep prices FL, TX and WA as moves in `startYear`, using split-year taxation and default July move month when none is supplied. Among non-baseline rows with `error=null`, the best candidate has the lowest nominal `lifetimeTaxesAndPenalties`; strict `<` preserves the earlier shortlist row on a tie. For that row and the `id='baseline'` row, `savings=max(0,-sum_y deflate(y,candidateStateTax_y-baselineStateTax_y))`, over the union of years. Candidate selection uses all taxes and penalties, but the identity itself uses state-plus-local tax only. The relocation series is an input to this published quantity, not a consumer of it. A failed sweep publishes no dollar figure, and the display string rounds the unrounded result to whole dollars.

## Inputs

The current state is Kentucky with modeled income tax, no effective-rate override, and `stateMoves=[]`, so screening is not silent; the current state is not Florida. Projection `startYear=2026`; every candidate patch is `{state,moveYear:2026}` with `moveMonth` omitted, hence July (`7`) and a split origin/destination 2026. Candidate selection inputs are:

| Row | Error | Lifetime taxes and penalties | Selection order |
|---|---|---:|---:|
| baseline | null | 150,000 | n/a |
| FL | null | 120,000 | 1 |
| TX | null | 120,000 | 2 |
| WA | calculation failed | n/a | 3 |

The FL/TX tie selects FL because FL is earlier and replacement requires strict `<`. The annual nominal state-plus-local tax inputs are:

| Year | Baseline tax | Selected FL tax | Presence |
|---|---:|---:|---|
| 2026 | 6,000.00 | 3,000.00 | both; July split-year move |
| 2027 | 6,180.00 | 0.00 | baseline only |
| 2028 | 0.00 | 3,182.70 | candidate only |

For this worksheet, `deflate(year,amount)=amount/(1.03)^(year-2026)`; absent rows contribute nominal zero. No property tax, sales tax, cost of living, healthcare quality, local-rate adjustment or flat spending delta is included.

## Arithmetic

In baseline-minus-candidate form, 2026 contributes `($6,000-$3,000)/1.03^0=$3,000`; 2027 contributes `($6,180-$0)/1.03^1=$6,000`; and 2028 contributes `($0-$3,182.70)/1.03^2=-$3,000`. The cross-year sum is `$3,000+$6,000-$3,000=$6,000`, and `max(0,$6,000)=$6,000`. Whole-dollar display remains `$6,000`.

## Expected

The selected candidate is exactly `FL`; published lifetime state-tax savings is `$6,000.00`, absolute tolerance `$0.000001` because the calculation contains two integer powers and divisions and the chosen decimals cancel algebraically but are represented in binary floating point. The qualitative whole-dollar value is exactly `$6,000`. If candidate tax instead exceeded baseline tax in aggregate, the expected published amount would be exactly `$0`, not negative.

## Wrong readings

- Using candidate minus baseline and flooring that result reverses the savings identity's sign.
- Flooring each year's contribution would discard the 2028 `-$3,000` and incorrectly publish `$9,000`; only the final sum is floored.
- Choosing on state tax alone ignores that the best row is selected by total nominal taxes and penalties.
- Letting TX replace FL on an equal total ignores the strict `<` tie rule and shortlist order.
- Treating the start-year candidate as already resident drops the July split-year origin tax; `moveYear=startYear` and default `moveMonth=7` are intentional.
- Intersecting the annual series drops years present on only one side; the contract uses their union and zero fills.
- Publishing a negative penalty for a costlier candidate, or a dollar result after sweep failure, violates the floor and failure behavior.

## Family

outputs: `insight-state-relocation-lifetime-state-tax-savings`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract with the 2026-09-18 doc-comment contracts, without executing the engine or reading any implementation body. The pull-request review found and prompted correction of the Family direction: this quantity consumes the relocation series and does not feed it. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18.md in this directory (first review and the addendum for the revision).
