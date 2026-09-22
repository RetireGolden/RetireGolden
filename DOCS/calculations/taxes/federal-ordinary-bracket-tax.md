## Claim

Kind: formula. `tax/federalTax.ts#bracketTax; #computeFederalTax` computes 2026 federal ordinary income tax in dollars by applying each single-filer marginal rate to the part of annual ordinary taxable income in that bracket, without rounding stated in the extract.

## Justification

For bracket lower bounds \(L_i\), next bounds \(L_{i+1}\), rates \(r_i\), and taxable income \(T\ge0\), tax is \(\sum_i r_i\max(0,\min(T,L_{i+1})-L_i)\); this partitions taxable income into nonoverlapping layers rather than applying the top marginal rate to every dollar.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Filing status | single | status |
| Ordinary taxable income | 60,000 | 2026 dollars/year |
| 2026 bracket starts | 0; 12,400; 50,400; 105,700; 201,775; 256,225; 640,600 | dollars/year |
| 2026 rates | 10; 12; 22; 24; 32; 35; 37 | percent |

The thresholds and rates are `year2026.federalTax.brackets.single`.

## Arithmetic

First layer: `12,400 × 10/100 = 1,240`.

Second layer: `(50,400 - 12,400) × 12/100 = 38,000 × 12/100 = 4,560`.

Third layer: `(60,000 - 50,400) × 22/100 = 9,600 × 22/100 = 2,112`.

Total: `1,240 + 4,560 + 2,112 = 7,912`.

## Expected

Exact derived and published figure: `$7,912`; fixture tolerance: exact, because every input and intermediate product is a whole dollar.

## Wrong readings

- Applying 22% to all `$60,000` produces `$13,200`.
- Ending the 12% bracket at `$50,000` produces `$7,952` (`$1,240 + $4,512 + $2,200`).

## Family

outputs: none.

feeds: `tax-total-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-three.md in this directory.
