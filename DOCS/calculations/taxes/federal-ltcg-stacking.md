## Claim

Kind: formula. `tax/federalTax.ts#capitalGainsTaxStacked; #computeFederalTax` taxes 2026 single-filer annual long-term capital gains and qualified dividends by stacking preferential income above ordinary taxable income across the 0%, 15%, and 20% thresholds, in dollars.

## Justification

Preferential dollars occupy the taxable-income interval immediately above ordinary taxable income. Each rate applies to the intersection of that interval with its rate band, preventing the ordinary base from being taxed again.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Filing status | single | status |
| Ordinary taxable income | 45,000 | dollars/year |
| Preferential income | 10,000 | dollars/year |
| 15% starts above | 49,450 | taxable-income dollars/year |
| 20% starts above | 545,500 | taxable-income dollars/year |

Thresholds are `year2026.capitalGains.rate15StartsAbove.single` and `.rate20StartsAbove.single`.

## Arithmetic

Zero-rate space: `$49,450 - $45,000 = $4,450`.

Preferential income at 15%: `$10,000 - $4,450 = $5,550`.

Tax: `$4,450 × 0 + $5,550 × 15/100 = $832.50`; no income reaches the 20% threshold.

## Expected

Exact derived and published figure: `$832.50`; fixture tolerance: absolute `$0.005` because percentage multiplication is computed in binary floating point and the economic result is cents.

## Wrong readings

- Ignoring stacking and starting gains at zero produces `$0`.
- Taxing all preferential income at 15% produces `$1,500`.

## Family

outputs: none.

feeds: `tax-total-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-three.md in this directory.
