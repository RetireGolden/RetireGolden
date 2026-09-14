## Claim

Kind: composition. `allocation/assetClasses.ts#expectedAccountReturnPct` returns this year's annual nominal percent return from the account's allocation blend when opted in; otherwise it selects the account-specific rate, then the plan default, in that precedence order.

## Justification

An explicit allocation determines a weighted expected return and supersedes a scalar account rate by contract. Without allocation, the most specific supplied scalar assumption precedes the plan fallback. This is assumption selection, not a forecast.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Allocation | 60% US stocks, 40% bonds | fraction |
| Account scalar return | 9 | percent/year nominal |
| Plan default | 5 | percent/year nominal |
| Class returns | 7%, 4% | percent/year nominal |

## Arithmetic

Allocation is present, so blend `=0.6(7)+0.4(4)=5.8%`; the 9% account scalar and 5% plan default are not used.

## Expected

`5.8%` nominal/year, absolute tolerance `1e-12` percentage points.

## Wrong readings

- Letting the account scalar override allocation gives `9%`.
- Averaging the two class returns unweighted gives `5.5%`.

## Family

`accounts-balance-per-account-annual`, `accounts-investable-total-annual`, `accounts-net-worth-annual` upstream.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: unreviewed.
