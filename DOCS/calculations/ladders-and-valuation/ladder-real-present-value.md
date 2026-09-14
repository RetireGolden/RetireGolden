## Claim

Kind: formula. `ladder/ladderMath.ts#realPresentValue` sums real future cash flows in today's dollars as `C_t/(1+y(t)/100)^t`, using linear maturity interpolation and flat endpoints on the annual TIPS par curve treated as spot rates, with no rounding stated.

## Justification

One dollar invested at effective annual real rate `y` grows to `(1+y)^t`; therefore the amount today equivalent to `C_t` is its reciprocal discount. Additivity gives the stream PV. The par-as-spot use is an explicit planning approximation, not a bootstrapped zero curve. Domain: finite flows, `t>=0`, and yields above `-100%`.

## Inputs

| Flow | Years from now | Real amount | Applicable yield |
|---|---:|---:|---:|
| A | 2 | 100 | 2% (interpolated between 1% at 1y and 3% at 3y) |
| B | 4 | 100 | 3% (flat high endpoint) |

## Arithmetic

`PV_A=100/1.02^2=250000/2601=96.1168781238`. `PV_B=100/1.03^4=10,000,000,000/112,550,881=88.8487047916`. Total `=184.9655829154`.

## Expected

Real PV `$184.9655829154`, absolute tolerance `1e-9` dollars, covering interpolation and exponentiation error only.

## Wrong readings

- Using 3% for both flows gives `$183.1073531090 (100/1.03^2 + 100/1.03^4; corrected 2026-09-14 after independent review)`.
- Treating rates as simple interest gives `100/1.04 + 100/1.12 = $185.4395604396`.

## Family

`funded-ratio-result-essential-spending-pv`, `funded-ratio-result-guaranteed-income-pv`, `funded-ratio-result-funded-ratio-pct`, `funded-ratio-result-unfunded-pv`, `ladder-rung-cost`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: unreviewed.
