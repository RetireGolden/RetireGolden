## Claim

Kind: formula. `ladder/ladderMath.ts#ladderRealFlowsAtOffset` totals annual real coupons from rungs still outstanding during an integer offset, adds face maturing at that offset, and includes that maturing face in outstanding face; `ladderRemainingFace` totals faces with maturity strictly after the completed offset, with no rounding.

## Justification

A bond pays its coupon while outstanding and returns principal at maturity. Immediately after that year, the matured principal is no longer outstanding. Domain: offsets at least one and rungs with maturity offsets at least one.

## Inputs

| Rung | Face | Coupon | Maturity offset |
|---|---:|---:|---:|
| A | 100 | 2%/year | 1 |
| B | 200 | 3%/year | 3 |
| Probe offset | 1 | year | |

## Arithmetic

Coupon `=100(0.02)+200(0.03)=2+6=8`. Maturing principal `=100`. Outstanding face during year `=100+200=300`. Remaining face after year `=200`.

## Expected

At offset 1: coupons `$8`, maturing principal `$100`, outstanding face `$300`, remaining face `$200`, exact for the stated decimal inputs.

## Wrong readings

- Excluding the maturing rung before its last coupon gives coupons `$6` and outstanding face `$200`.
- Treating maturity as inclusive after year-end gives remaining face `$300` instead of `$200`.

## Family

`ladder-real-flows-coupons`, `ladder-real-flows-maturing-principal`, `ladder-value-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: unreviewed.
