## Claim

Kind: formula. `spending/layers.ts#splitLifestyle` splits nominal annual lifestyle spending `B` into required `R = min(max(required,0),max(B,0))` and discretionary `D = max(B,0)-R`, preserving dollars and clamping the floor to the target; no rounding is stated.

## Justification

The comment requires a nonnegative partition that sums to the migrated target and prevents a required floor above that target. Projection onto `[0,B]` is the unique clamp satisfying those conditions for nonnegative `B`. Domain: finite nominal dollar amounts with `B >= 0`.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Base annual lifestyle target `B` | 60,000 | nominal dollars/year |
| Requested required floor | 70,000 | nominal dollars/year |

## Arithmetic

`R = min(70,000, 60,000) = 60,000`. `D = 60,000 - 60,000 = 0`. Check: `R + D = 60,000`.

## Expected

`requiredLifestyle = $60,000` and `discretionaryLifestyle = $0`, exact dollars for integer inputs.

## Wrong readings

- Failing to clamp gives required `$70,000` and discretionary `-$10,000`.
- Treating the required input as the discretionary amount gives required `$0` and discretionary `$60,000` after clamping the remainder.

## Family

`spending-required-requested-annual`, `spending-target-requested-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18.md in this directory.
