## Claim

Kind: data. `projection/moneyTolerance.ts` declares two distinct plan-dollar thresholds: an annual funding residual tolerance of `$0.005` and an aggregate Roth-conversion action epsilon of `$0.01`, with comparisons performed in unrounded plan dollars.

## Justification

These are product numerical conventions, not externally sourced facts: half a cent is the annual fixed-point acceptance budget, while one cent is the minimum material action/basis/shortfall amount. The extract provides the exact values; source retrieval is not applicable. Rights note: this worksheet restates numeric conventions and copies no expressive third-party material.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Annual residual | 0.0049 | plan dollars/year |
| Conversion candidate | 0.0075 | plan dollars |

## Arithmetic

`0.0049 <= 0.005`, so the annual residual is within tolerance. `0.0075 < 0.01`, so the conversion amount is below the action floor. The thresholds differ by `0.01/0.005=2`.

## Expected

Annual acceptance `true`, conversion materiality `false`, exact Boolean results for the stated decimals.

## Wrong readings

- Reusing the one-cent epsilon for funding accepts a `$0.0075` annual residual that exceeds the half-cent budget.
- Treating `$0.005` as five cents (`$0.05`) loosens the budget tenfold.

## Family

none yet — these thresholds govern upstream acceptance and action materiality, not a displayed quantity.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: unreviewed.
