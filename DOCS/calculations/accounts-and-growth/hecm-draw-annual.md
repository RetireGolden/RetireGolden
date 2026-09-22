## Claim

Kind: formula. `projection/internal/types/result.ts#YearResult.hecmDraw` is the accepted coordinated draw plus any backstop draw from an open HECM line against a true portfolio shortfall. The extract states no sizing formula for a coordinated draw, so this worksheet derives only the backstop case: with coordinated draw zero, the backstop is `min(true shortfall, available open line)`.

## Justification

The published field combines both draw channels, while the backstop operates regardless of draw policy and cannot draw more than either the funding gap or available credit.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| HECM line open | true | Boolean |
| Draw policy | lastResort | mode |
| Accepted coordinated draw | 0 | nominal dollars |
| True portfolio shortfall before backstop | 40,000 | nominal dollars |
| Available line | 25,000 | nominal dollars |

## Arithmetic

Backstop draw `= min($40,000, $25,000) = $25,000`. Published HECM draw `= $0 + $25,000 = $25,000`. Remaining shortfall `= $40,000 - $25,000 = $15,000`.

## Expected

Exact value: `hecmDraw = $25,000`. Fixture tolerance: absolute `$0.005`, because line availability and funding amounts are binary-floating-point dollars.

## Wrong readings

- Drawing the full `$40,000` ignores the `$25,000` available-line cap.
- Refusing a backstop because the policy is not coordinated produces `$0`.
- Adding the remaining `$15,000` shortfall to the draw produces `$40,000` and counts an unfunded amount as loan proceeds.

## Family

outputs: `hecm-draw-annual`.

feeds: `spending-shortfall-annual`; `accounts-net-worth-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-eight.md in this directory.
