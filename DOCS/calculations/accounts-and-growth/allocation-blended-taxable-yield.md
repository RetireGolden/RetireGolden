## Claim

Kind: formula. `allocation/assetClasses.ts#blendedTaxableYield` weight-blends interest and dividend yields in percent and computes the qualified share as dividend-dollar-weighted; when total dividends are zero it uses the `0.85` fallback.

## Justification

Portfolio income yield is additive across allocated dollars. Qualified ratio must divide qualified dividend yield by total dividend yield, not by portfolio weight. Domain: normalized nonnegative weights and nonnegative yields.

## Inputs

| Class | Weight | Interest yield | Dividend yield | Qualified share |
|---|---:|---:|---:|---:|
| US stocks | 0.6 | 0% | 1.5% | 95% |
| Bonds | 0.4 | 4% | 0% | 0% |

## Arithmetic

Interest `=0.6(0)+0.4(4)=1.6%`. Dividends `=0.6(1.5)=0.9%`. Qualified dividend yield `=0.6(1.5)(0.95)=0.855%`; ratio `=0.855/0.9=0.95`.

## Expected

Interest `1.6%`, dividends `0.9%`, qualified ratio `0.95`; absolute tolerance `1e-12`.

## Wrong readings

- Weighting qualified ratios by all assets gives `0.6(0.95)=0.57`.
- Adding yields without weights gives `4%` interest and `1.5%` dividends.

## Family

`income-taxable-yield-annual`, `income-taxable-interest-annual`, `income-qualified-dividends-annual`, `income-ordinary-dividends-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: unreviewed.
