## Claim

Kind: formula. `projection/internal/types/result.ts#YearResult.contributions`, planned by `projection/internal/annualContributionsAndEmployerMatch.ts#annualContributionsAndEmployerMatch`, sums contributions actually credited after each desired amount is trimmed to its applicable group limit. For 2026, `params/data/year2026.ts#year2026.contributionLimits.ira` is `$7,500`; that limit is shared per owner across traditional and Roth IRAs, with a separate age-50 catch-up only when applicable.

## Justification

This fixture uses two under-50 owners, one IRA each, adequate compensation, zero inflation, and no other contributions, isolating the stated 2026 base IRA limit.

## Inputs

| Plan input | Owner A IRA | Owner B IRA | Unit |
|---|---:|---:|---|
| Year / owner age | 2026 / 40 | 2026 / 45 | year / attained years |
| Desired annual contribution | 6,000 | 9,000 | nominal dollars/year |
| Owner wages | 50,000 | 50,000 | nominal dollars/year |
| General inflation | 0 | 0 | percent/year |
| 2026 IRA limit | 7,500 | 7,500 | dollars/owner |

## Arithmetic

Owner A credits `min($6,000, $7,500, $50,000) = $6,000`. Owner B credits `min($9,000, $7,500, $50,000) = $7,500`. Total contributions `= $6,000 + $7,500 = $13,500`.

## Expected

Exact value: `contributions = $13,500`. Fixture tolerance: absolute `$0.005`, because desired amounts and limit trims are represented as binary-floating-point dollars.

## Wrong readings

- Crediting both desired amounts produces `$15,000`.
- Applying one household-wide `$7,500` IRA limit across different owners produces `$7,500`.
- Giving an under-50 owner the 2026 `$1,100` catch-up produces `$14,600`.

## Family

outputs: `year-result-contributions`.

feeds: `surplus-invested-annual`; `cash-flow-reconciliation-totals`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-eight.md in this directory.
