## Claim

Kind: composition. `montecarlo/historicalSuites.ts#HistoricalStressWindow.totalShortfall` is the sum of every replayed projection year's `shortfall` after any HECM backstop draw. The identity is stated directly by the field comment; the underlying annual shortfalls remain outputs of the full shared ledger.

## Justification

A three-year, one-account, no-tax, no-income example with zero returns makes each annual shortfall hand-derivable while still representing a stated historical replay window.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Historical window | 2000–2002 | labels |
| Replayed annual returns | 0, 0, 0 | percent |
| Opening account balance | 100,000 | dollars |
| Annual spending | 60,000 | dollars/year |
| Income / tax / penalties / HECM | 0 / 0 / 0 / 0 | dollars/year |

## Arithmetic

Year 1: the account funds `$60,000`, closes at `$40,000`, and shortfall is `$0`. Year 2: only `$40,000` is available against `$60,000`, so shortfall is `$20,000` and the account closes at `$0`. Year 3: no balance remains, so shortfall is `$60,000`. `totalShortfall = $0 + $20,000 + $60,000 = $80,000`.

In the general case, returns, taxes, income, withdrawals, HECM draws, and spending interactions must be read from the full replayed ledger; this worksheet does not replace that ledger with a side model.

## Expected

Exact value: `$80,000`. Fixture tolerance: absolute `$0.005`, because annual dollar shortfalls and their sum are computed in binary floating point.

## Wrong readings

- Summing unmet cumulative spending (`$0 + $20,000 + $80,000`) double-counts prior misses and gives `$100,000`.
- Stopping after the account first empties omits Year 3 and gives `$20,000`.
- Treating opening assets as income each year gives no shortfall and `$0` total.

## Family

outputs: `historical-stress-window-total-shortfall`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-eleven.md in this directory.
