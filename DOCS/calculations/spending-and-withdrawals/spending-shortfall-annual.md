## Claim

Kind: composition. `projection/internal/types/result.ts#YearResult.shortfall` is the nominal funding gap remaining after every withdrawal and any HECM backstop draw. `ProjectionResult.depletionYear` is the first year this value exceeds `ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS`.

## Justification

The corrected field comment places the HECM draw before publication of shortfall. It is not a pre-HECM need and is distinct from layer-attributed required, target, ideal, and excess misses.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Funding need before portfolio sources | 12,000 | nominal dollars/year |
| Withdrawals produced | 10,000 | nominal dollars/year |
| HECM backstop draw | 1,500 | nominal dollars/year |
| Earlier-year shortfalls | 0 | nominal dollars/year |
| Current year | 2034 | year |

## Arithmetic

Remaining after withdrawals `= 12,000 - 10,000 = $2,000`. Remaining after HECM `= 2,000 - 1,500 = $500`.

For the whole-run result, 2034 is `depletionYear` if `$500` exceeds `ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS` and no earlier row exceeded that same threshold. The extract names but does not numerically state that tolerance, so this worksheet does not invent its value.

## Expected

Exact shortfall: `$500`. Fixture tolerance: absolute `$0.005` for the dollar figure because funding uses binary floating point. A separate depletion-year assertion may expect exact `2034` only when its fixture supplies or imports the named tolerance and confirms `$500` exceeds it.

## Wrong readings

- Publishing the pre-HECM gap produces `$2,000`.
- Adding the HECM draw as another expense produces `$3,500`.
- Treating any positive binary residue as depletion can move `depletionYear`; the threshold requires exceeding the named annual funding tolerance.

## Family

outputs: `spending-shortfall-annual`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-six.md in this directory (approved with a note: the depletion-year relation is asserted by the fixture, which holds the ledger tolerance constant the extract did not carry).
