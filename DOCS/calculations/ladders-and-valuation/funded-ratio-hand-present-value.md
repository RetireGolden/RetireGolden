## Claim

Kind: composition. `ladder/fundedRatio.ts#computeFundedRatio` deflates each in-window calendar-year essential-spending and guaranteed-income cash flow to today's real dollars, discounts it at that maturity's annual TIPS par yield treated as a spot rate with flat curve endpoints, and returns both PVs, `100G/E`, and `max(0,E-G)` without stated rounding.

## Justification

For a real cash flow `C_t` at year offset `t`, the stated convention implies `PV_t=C_t/(1+y_t)^t`, including an undiscounted `t=0` flow. Summing separately preserves the pension-accounting numerator and denominator. This is a planning convention: Treasury par yields generally are not spot rates. Domain: nonnegative cash flows, yields greater than `-100%`, and positive essential PV.

## Inputs

| Year offset | Nominal essential | Deflator to today's dollars | Real essential | Nominal guaranteed | Real guaranteed | Discount rate/year |
|---:|---:|---:|---:|---:|---:|---:|
| 0 | 100 | 1 | 100 | 50 | 50 | 5% |
| 1 | 115.50 | 1/1.05 | 110 | 57.75 | 55 | 5% |
| 2 | 133.4025 | 1/1.05^2 | 121 | 66.70125 | 60.5 | 5% |

## Arithmetic

The 5% curve is flat (including its endpoints). `E=100+110/1.05+121/1.05^2 = 100+2200/21+48400/441 = 138,700/441 = 314.5124716553`. `G=50+55/1.05+60.5/1.05^2 = 69,350/441 = 157.2562358277`. Ratio `=100G/E=50%`. Unfunded `=E-G=69,350/441`.

## Expected

Essential PV `$314.5124716553`, guaranteed PV `$157.2562358277`, funded ratio `50%`, unfunded PV `$157.2562358277`; absolute tolerance `1e-9` for PV dollars and `1e-12` percentage points for the exact one-half ratio.

## Wrong readings

- Discounting the current-year flow as one year late gives essential PV `$299.5356872908` and guaranteed PV `$149.7678436454`.
- Skipping deflation and discounting the nominal rows gives essential PV `$331.0000000000` and guaranteed PV `$165.5000000000`.

## Family

`funded-ratio-result-essential-spending-pv`, `funded-ratio-result-guaranteed-income-pv`, `funded-ratio-result-funded-ratio-pct`, `funded-ratio-result-unfunded-pv`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: unreviewed.
