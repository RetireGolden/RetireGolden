## Claim

Kind: model. `montecarlo/marketModels.ts#createReversedHistoryModel` replays one window of `L` consecutive historical rows backwards. `L = windowLengthYears` (default 10) must be a whole number from 5 to the historical row count `n = 96`; any other value (3, 4.999, 5.5, 97, 0, -5, NaN, Infinity) is refused with a RangeError and never clamped. The path draws `start = nextInt(n - L + 1)` once, then path year `i` replays row `start + L - 1 - (i mod L)`. Each return shock is the row's blend at `equityWeightPct` minus the dataset mean at that weight, while inflation is the row value as-is.

## Justification

Reversing a real window preserves its marginal observations while deliberately changing sequence risk. This is a stress transformation, not a historical claim. The minimum of 5 years is the owner's (D-REVERSED-WINDOW-FLOOR, decided 2026-09-25); a window outside 5 to `n` is refused so that the parameter always means what it says. Because `5 <= L <= n`, `n - L >= 0`, so the start draw is always `nextInt(n - L + 1)` and every replayed index lies in `0..n - 1`.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| `windowLengthYears` | 5 | years |
| Equity weight | 60 | percent |
| Integer draw for `start` | 72, from `nextInt(92)` | zero-based row index |
| Requested path length | 3 | years |

## Arithmetic

There are `n = 96` rows, and index 72 is the year 2000 row. The start is drawn with `nextInt(96 - 5 + 1) = nextInt(92)`. With `L = 5`, the selected window is indices 72 through 76, years 2000 through 2004. For path years `i = 0, 1, 2`, replayed indices are `72 + 5 - 1 - i = 76, 75, 74`, hence years `[2004, 2003, 2002]`.

At weight 60, the sum of all 96 row blends in table order is `857.9800000000002`, so the common mean is `857.9800000000002 / 96 = 8.937291666666669%`.

- 2004: blend `= 0.6(10.7) + 0.4(4.5) = 8.219999999999999`; shock `= 8.219999999999999 - 8.937291666666669 = -0.7172916666666698`; inflation `= 3.3%`.
- 2003: blend `= 0.6(28.4) + 0.4(0.4) = 17.2`; shock `= 17.2 - 8.937291666666669 = 8.26270833333333`; inflation `= 1.9%`.
- 2002: blend `= 0.6(-22.0) + 0.4(15.1) = -7.159999999999999`; shock `= -7.159999999999999 - 8.937291666666669 = -16.097291666666667`; inflation `= 2.4%`.

A seven-year path wraps inside the window: `2004, 2003, 2002, 2001, 2000, 2004, 2003`.

At the planner's window of 10 with the same start, the window is 2000 through 2009 and the first three years are `2009, 2008, 2007`: shocks `2.1627083333333292, -22.85729166666667, -1.5572916666666687`, inflation `2.7, 0.1, 4.1`.

## Expected

Replayed years are exactly `[2004, 2003, 2002]`. Return shocks are `[-0.7172916666666698, 8.26270833333333, -16.097291666666667]` percentage points with absolute tolerance `1e-12`. Inflation values are the corresponding row values `[3.3, 1.9, 2.4]` percent.

Windows 3, 4, 4.999, 5.5, 97, 0, -5, NaN and Infinity each throw `RangeError: Reversed-history windowLengthYears must be a whole number of years from 5 to 96 (the length of the historical series); got <value>.` The default (10), 5, 10, 95 and 96 are accepted.

## Wrong readings

- Clamping the window instead of refusing it: a requested 3 would run as 5 and a requested 97 as 96 without a word, and the refusal test for 3 would find nothing thrown.
- Replaying forward from the drawn start gives `[2000, 2001, 2002]` instead of reading backward from the window's end.
- Drawing the start from `nextInt(n)` instead of `nextInt(n - L + 1)` lets the window run past the last row.

## Family

`monte-carlo-success-rate`, `monte-carlo-investable-fan-percentiles`, `monte-carlo-ending-investable-histogram`, `monte-carlo-ending-after-tax-estate-percentiles`, `monte-carlo-depletion-probability-by-year`.

## Provenance

Derived by: claude, 2026-09-25, a Claude Opus instance working from the engine source at origin/main `aeb2861a` and the formulas (the Monte Carlo derivation for the decisions of 2026-09-25, section 3). The window's years, shocks and inflation were first derived by codex (gpt-5.6-sol) on 2026-09-18 and are unchanged; the same numbers are now reached by honoring a requested 5 rather than by raising a requested 3 to 5. For every valid window (5 to 96), several seeds and class shocks on and off, the new model's paths equal the earlier model's to the bit. Checked by: a second Claude Opus instance, which recomputed every figure without the deriver's scripts. The implementation was reviewed 2026-09-26 by a third Claude Opus instance, which ran 45 mutants across two rounds. Reviewed by: unreviewed. The catalog requires the reviewer to be a different agent family from the deriver, and all three instances are Claude, so the record stays unreviewed until a Codex or Cursor review. Implemented 2026-09-26.

Revision (D-REVERSED-WINDOW-FLOOR, decided 2026-09-25): the earlier model clamped the window to [5, 96] without a word (3 and 4 ran as 5, 97 as 96), and a fractional or NaN window crashed on an index past the end of the series. Both are now refused.
