## Claim

Kind: composition. `projection/internal/types/result.ts#YearResult.tax`, produced through `tax/federalTax.ts#combineTaxCalculators`, is the composed calculator amount: the federal total of regular income tax plus AMT plus NIIT, plus the state calculator amount, plus any further composed calculator amounts. Penalties are excluded.

## Justification

This worksheet treats the federal and state amounts as outputs independently evidenced by their own worksheets and checks only the annual composition boundary.

## Inputs

| Calculator output | Value | Unit |
|---|---:|---|
| Federal total from federal worksheet | 12,000 | nominal dollars |
| State amount from state worksheet | 3,000 | nominal dollars |
| Further composed calculators | 0 | nominal dollars |
| Early-withdrawal and RMD penalties | 500 | nominal dollars |

## Arithmetic

Composed tax `= $12,000 + $3,000 + $0 = $15,000`. The `$500` penalties are not part of tax.

## Expected

Exact value: `tax = $15,000`. Fixture tolerance: absolute `$0.005`, because calculator amounts are composed in binary-floating-point dollars.

## Wrong readings

- Adding penalties produces `$15,500`.
- Treating the stated federal total as regular tax and adding AMT or NIIT again double-counts those federal pieces.
- Omitting the state calculator produces `$12,000`.

## Family

outputs: `tax-total-annual`.

feeds: `portfolio-need-annual`; `surplus-invested-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-eight.md in this directory.
