## Claim

Kind: composition. `projection/internal/types/result.ts#YearResult.realizedGains`, assembled by `projection/internal/annualYearResultAssembly.ts#annualYearResultAssembly`, is the signed sum, in stated order, of gain embedded in taxable withdrawals, gain from rebalancing sales, and gain from named retirement-action executions.

## Justification

Each component is signed, so a loss from one source offsets gains from the others rather than being floored separately.

## Inputs

| Gain source | Value | Unit |
|---|---:|---|
| Taxable withdrawals | 2,500 | nominal dollars |
| Rebalancing sales | 750 | nominal dollars |
| Named retirement actions | -200 | nominal dollars |

## Arithmetic

`$2,500 + $750 + (-$200) = $3,050`.

## Expected

Exact value: `realizedGains = $3,050`. Fixture tolerance: absolute `$0.005`, because the ordered gain fold uses binary floating point.

## Wrong readings

- Dropping the signed retirement-action loss produces `$3,250`.
- Taking absolute values produces `$3,450`.
- Reporting only taxable-withdrawal gains produces `$2,500`.

## Family

outputs: `tax-realized-gains-annual`.

feeds: `tax-total-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-eight.md in this directory.
