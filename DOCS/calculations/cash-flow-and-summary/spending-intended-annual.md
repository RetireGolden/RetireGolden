## Claim

Kind: composition. `projection/internal/types/result.ts#YearResult.expenses.intendedSpending` is full no-cut intended spending: target spending plus incremental ideal and excess spending. The `YearExpenses` comments in `projection/internal/types/yearLedger.ts` state that the layer summaries include funded goals and add back skipped goals in their classification.

## Justification

Required and target are cumulative summaries; ideal and excess are incremental. Adding all four summary fields would double-count required spending.

## Inputs

| Component | Value | Unit |
|---|---:|---|
| System-required costs | 20,000 | nominal dollars/year |
| Required lifestyle | 30,000 | nominal dollars/year |
| Required goals funded / skipped | 2,000 / 1,000 | nominal dollars/year |
| Target lifestyle | 15,000 | nominal dollars/year |
| Target goals funded / skipped | 3,000 / 2,000 | nominal dollars/year |
| Ideal lifestyle and goals funded / skipped | 6,000 / 1,000 / 500 | nominal dollars/year |
| Excess lifestyle and goals funded / skipped | 4,000 / 500 / 250 | nominal dollars/year |

## Arithmetic

Required `= 20,000 + 30,000 + 2,000 + 1,000 = $53,000`.

Target `= 53,000 + 15,000 + 3,000 + 2,000 = $73,000`.

Ideal increment `= 6,000 + 1,000 + 500 = $7,500`. Excess increment `= 4,000 + 500 + 250 = $4,750`.

Intended `= 73,000 + 7,500 + 4,750 = $85,250`.

## Expected

Exact value: `$85,250`. Fixture tolerance: absolute `$0.005`, because the ledger composes binary-floating-point dollar values.

## Wrong readings

- Omitting all skipped goals produces `$81,500`.
- Adding required and target summaries before ideal and excess double-counts `$53,000` and produces `$138,250`.
- Treating ideal and excess as cumulative rather than incremental understates or double-counts their layers.

## Family

outputs: `spending-intended-annual`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-six.md in this directory.
