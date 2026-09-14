## Claim

Kind: formula. `ladder/ladderMath.ts#buildLadder` solves one real face amount per payout year from the last year backward so each end-of-year annual coupon-plus-principal total equals the level real target, then prices those rungs under the stated par-as-spot convention without currency rounding.

## Justification

For target `A`, coupon rates `c_i`, and faces `F_i`, payout-year `k` receives `(1+c_k)F_k + sum(i>k)c_iF_i`. Back substitution uniquely solves this upper-triangular system when `1+c_k` is nonzero. Domain: positive integer payout years, first offset at least one, nonnegative target, and valid curve.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Target `A` | 110 | real dollars/year |
| Payout offsets | 1 and 2 | years |
| Flat yield/coupon | 10 | percent/year |

## Arithmetic

Year 2: `1.1F2=110`, so `F2=100`. Year 1: `1.1F1+0.1(100)=110`, so `F1=100/1.1=1000/11=90.9090909091`. Receipts are `1.1(1000/11)+10=110` and `1.1(100)=110`. Each par-coupon rung costs face, so total cost `=2100/11=190.9090909091`.

## Expected

Faces `[90.9090909091,100]`, annual real income `[110,110]`, total cost `$190.9090909091`; absolute tolerance `1e-9` dollars.

## Wrong readings

- Setting both faces to `$110` ignores coupons and pays `$132` in year 1 and `$121` in year 2.
- Solving forward gives the first face `$100` but fails to subtract the later rung's year-1 coupon, paying `$120` in year 1.

## Family

`ladder-rung-face`, `ladder-build-annual-real-income-by-offset`, `ladder-build-total-cost`, `ladder-build-target-annual-real-income`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: unreviewed.
