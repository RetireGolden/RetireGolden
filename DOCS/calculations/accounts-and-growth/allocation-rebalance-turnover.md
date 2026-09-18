## Claim

Kind: formula. `allocation/assetClasses.ts#rebalanceTurnoverFraction` returns the fraction of account value sold to move current weights to target weights, equal to the sum of positive overweight differences.

## Justification

For conserved portfolio value, every dollar removed from overweight classes funds an equal dollar added to underweights; summing only positive `current_i-target_i` avoids double counting. Domain: current and target vectors each sum to one.

## Inputs

| Vector | Stocks | Bonds | Unit |
|---|---:|---:|---|
| Current | 0.7 | 0.3 | fraction |
| Target | 0.6 | 0.4 | fraction |

## Arithmetic

Overweights are `max(0,0.7-0.6)=0.1` and `max(0,0.3-0.4)=0`; turnover sold `=0.1`.

## Expected

Turnover fraction `0.1`, absolute tolerance `1e-12`.

## Wrong readings

- Summing absolute differences gives `0.2`, double counting buys and sells.
- Reporting the underweight sign gives `-0.1`.

## Family

none yet — the census does not expose rebalance turnover directly.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18.md in this directory.
