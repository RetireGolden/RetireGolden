## Claim

Kind: formula. `montecarlo/riskBasedGuardrails.ts#startingInvestableOf` sums current balances of taxable, equity-compensation, traditional, Roth, HSA, and cash accounts in dollars, excluding noninvestable assets.

## Justification

The threshold fraction needs the same dollar base that market paths can fund; summing the explicitly listed investable account types is additive and excludes property or other nonportfolio net worth. Domain: finite nonnegative account balances.

## Inputs

| Account | Balance | Unit |
|---|---:|---|
| Taxable | 100,000 | dollars |
| Cash | 20,000 | dollars |
| Home/property | 300,000 | dollars |

## Arithmetic

Taxable and cash are investable: `100,000+20,000=120,000`. Home/property is excluded.

## Expected

Starting investable `$120,000`, exact dollars.

## Wrong readings

- Summing net worth includes the home and gives `$420,000`.
- Excluding cash gives `$100,000` despite cash being in the listed investable set.

## Family

`display-guardrail-balance-thresholds`, `monte-carlo-success-rate`, `swr-rule-result-initial-annual-spend`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: unreviewed.
