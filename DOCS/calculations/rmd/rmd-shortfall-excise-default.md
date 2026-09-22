## Claim

Kind: formula. `rmd/rmdShortfallExcise.ts#computeRmdShortfallExcise` prices a post-SECURE-2 annual RMD shortfall as the nonnegative required amount less timely distributions, times the default 25% excise rate, without changing income or account balances.

## Justification

For requirement \(R\ge0\), timely distribution \(D\ge0\), and default rate \(q=0.25\), shortfall is \(S=\max(0,R-D)\) and tax is \(Sq\). This example elects no correction or waiver.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Required amount | 10,000 | dollars |
| Distributed by deadline | 4,000 | dollars |
| Relief election | none | election |
| Default rate | 0.25 | fraction |

The rate is `RMD_SHORTFALL_DEFAULT_RATE` from the extract.

## Arithmetic

Shortfall: `max(0, $10,000 - $4,000) = $6,000`.

Excise: `$6,000 × 25/100 = $1,500`.

## Expected

Exact derived and published shortfall `$6,000`, rate `0.25`, tax `$1,500`, reason `default25Percent`; fixture tolerance: exact.

## Wrong readings

- Applying the corrected 10% rate without qualifying correction produces `$600`.
- Applying 25% to the full requirement produces `$2,500`.

## Family

outputs: none.

feeds: `tax-penalties-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-three.md in this directory.
