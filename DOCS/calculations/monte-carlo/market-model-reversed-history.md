## Claim

Kind: model. `montecarlo/marketModels.ts#createReversedHistoryModel` clamps requested `windowLengthYears` to at least 5 and at most the historical row count. It draws `start = nextInt(n - L + 1)` once, then path year `i` replays row `start + L - 1 - (i mod L)`. Each return shock is the row's blend at `equityWeightPct` minus the dataset mean at that weight, while inflation is the row value as-is.

## Justification

Reversing a real window preserves its marginal observations while deliberately changing sequence risk. The configured value 3 exercises the documented floor: effective `L = 5`. This is a stress transformation, not a historical claim.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Requested `windowLengthYears` | 3 | years |
| Effective `L` after clamp | 5 | years |
| Equity weight | 60 | percent |
| Integer draw for `start` | 72 | zero-based row index |
| Requested path length | 3 | years |

## Arithmetic

There are `n = 96` rows, and index 72 is the year 2000 row. With effective `L = 5`, the selected window is indices 72 through 76, years 2000 through 2004. For path years `i = 0, 1, 2`, replayed indices are `72 + 5 - 1 - i = 76, 75, 74`, hence years `[2004, 2003, 2002]`.

At weight 60, the sum of all 96 row blends in table order is `857.9800000000002`, so the common mean is `857.9800000000002 / 96 = 8.937291666666669%`.

- 2004: blend `= 0.6(10.7) + 0.4(4.5) = 8.219999999999999`; shock `= 8.219999999999999 - 8.937291666666669 = -0.7172916666666698`; inflation `= 3.3%`.
- 2003: blend `= 0.6(28.4) + 0.4(0.4) = 17.2`; shock `= 17.2 - 8.937291666666669 = 8.26270833333333`; inflation `= 1.9%`.
- 2002: blend `= 0.6(-22.0) + 0.4(15.1) = -7.159999999999999`; shock `= -7.159999999999999 - 8.937291666666669 = -16.097291666666667`; inflation `= 2.4%`.

## Expected

Replayed years are exactly `[2004, 2003, 2002]`. Return shocks are `[-0.7172916666666698, 8.26270833333333, -16.097291666666667]` percentage points with absolute tolerance `1e-12`. Inflation values are the corresponding row values `[3.3, 1.9, 2.4]` percent.

## Wrong readings

- Applying no five-year floor selects only 2000-2002 and replays `[2002, 2001, 2000]`.
- Replaying forward from the drawn start gives `[2000, 2001, 2002]` instead of reading backward from the five-row window's end.
- Treating the requested length 3 as an honored three-row subwindow inside the effective five-row window defeats the floor and again starts the replay at 2002 rather than 2004.

## Family

`monte-carlo-success-rate`, `monte-carlo-investable-fan-percentiles`, `monte-carlo-ending-investable-histogram`, `monte-carlo-ending-after-tax-estate-percentiles`, `monte-carlo-depletion-probability-by-year`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract (with the 2026-09-18 doc-comment corrections) and the orchestrator's contract statements, without executing the engine or reading any implementation body. Reviewed by: unreviewed.

Revision: the first derivation honored an unreachable three-year window instead of applying the five-year minimum and deriving observable centered shocks and inflation.
