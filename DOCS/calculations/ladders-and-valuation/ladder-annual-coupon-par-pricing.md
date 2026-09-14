## Claim

Kind: formula. `ladder/ladderMath.ts#priceRung` prices a real face amount with end-of-year annual coupons, discounting every coupon and maturity principal at the interpolated par real yield for that cash-flow maturity treated as a spot rate; the synthetic coupon is the rung-maturity yield floored at `0.125%`, with no rounding stated.

## Justification

For face `F`, annual coupon rate `c`, maturity `n`, and spot-approximation rates `y_t`, `P=sum(t=1..n-1) Fc/(1+y_t)^t + F(1+c)/(1+y_n)^n`. On a flat curve with `c=y`, the finite annuity identity reduces price to `F`. Domain: `F>=0`, integer `n>=1`, and all `y_t>-1`; percent inputs are divided by 100.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Face `F` | 1,000 | real today's dollars |
| Coupon/yield | 2 | percent/year |
| Maturity | 3 | years |

## Arithmetic

Coupon is `$20`. `P=20/1.02 + 20/1.02^2 + 1,020/1.02^3 = 1000` by the par identity (direct sum: `19.6078431373 + 19.2233756248 + 961.1687812379`).

## Expected

Rung cost `$1,000`, absolute tolerance `1e-9` dollars from floating-point exponentiation; coupon rate `2%` because the floor does not bind.

## Wrong readings

- Omitting coupons prices only principal at `$942.3223345470`.
- Applying the 2 as a decimal rate (`200%`) makes the first coupon `$2,000`, not `$20`, and destroys the par result.

## Family

`ladder-rung-cost`, `ladder-rung-coupon-rate-pct`, `ladder-build-total-cost`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: unreviewed.
