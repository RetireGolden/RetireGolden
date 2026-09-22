# ABW growing annuity-due payment

## Claim

The amortization-based withdrawal payment for a start-of-year balance, with
beginning-of-period withdrawals and payments planned to grow at rate g, is the
growing annuity-due closed form

\[
P = B\frac{1-x}{1-x^n},\quad x=\frac{1+g}{1+r}
\]

and \(P = B/n\) when \(x = 1\). Derived from the geometric-sum identity; not
from running the engine.

## Inputs

| Symbol | Meaning | Value | Unit |
| --- | --- | --- | --- |
| B | Start-of-year balance | 210 | usd |
| r | Expected return | 10% = 0.10 | 1 |
| g | Planned payment growth | 0 | 1 |
| n | Remaining years, current year inclusive | 2 | count |

The production function `abwAnnualPayment` takes r and g in percent per year,
so the evidence fixture passes this worksheet's 0.10 and 0 as `realReturnPct: 10`
and `tiltPct: 0`; the arithmetic below is in decimal rates.

## Arithmetic

\(x = (1+0)/(1+0.10) = 1/1.1 = 10/11\).

\(x^2 = 100/121\).

\(1-x = 1/11\).

\(1-x^2 = 21/121\).

\[
P = 210 \cdot \frac{1/11}{21/121} = 210 \cdot \frac{1}{11} \cdot \frac{121}{21} = 210 \cdot \frac{11}{21} = 10 \cdot 11 = 110.
\]

Geometric-sum derivation. After the first (due) payment the remainder grows, so
the two cash flows discounted to the start of the first period are

\[
B = P + P\cdot\frac{1+g}{1+r} + \cdots + P\cdot\left(\frac{1+g}{1+r}\right)^{n-1} = P\sum_{k=0}^{n-1} x^k.
\]

The sum is \(n\) when \(x=1\), else \((1-x^n)/(1-x)\). Solving for P recovers
the closed form. With these inputs the sum is \(1 + 10/11 = 21/11\), so
\(P = 210 \cdot 11/21 = 110\).

### Two-period cash-flow table

| Instant | Event | Balance |
| --- | --- | ---: |
| t = 0 | Start | 210 |
| t = 0 | Withdraw P = 110 | 100 |
| t = 1 | Remainder grows at 10% | 110 |
| t = 1 | Withdraw P = 110 | 0 |
| t = 2 | Horizon; depleted | 0 |

## Expected output and tolerance

Expected payment: **110** (exact).

The production function `abwAnnualPayment` returns a binary float (`Math.pow`),
so the evidence fixture uses an absolute tolerance of `1e-9` rather than
integer-cent `exact`.

## Plausible wrong readings

1. **End-of-period (ordinary) annuity.** Payments at year end:
   \(P = B\cdot r/(1-(1+r)^{-n}) = 210\cdot 0.10/(1-1.1^{-2}) = 21/(0.21/1.21) = 121\).
   The same closed form multiplied by \(1+r\). Discriminates timing.
2. **Ignoring growth of the remainder** — divide the opening balance by n:
   \(P = 210/2 = 105\). Discriminates the amortization identity from a flat split.

## Family

outputs: `spending-base-annual` (the ABW policy's base spending before guardrail adjustments; the record's limits say so).

feeds: none.

## Author and reviewer

- Derived by: claude-orchestrator, from the formula alone, without running the engine.
- Implemented by: grok.
- Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-abw.md in this directory.

## Revision

- 2026-09-14: the Claim states the closed-form identity, and this worksheet's
  inputs (n = 2, x = 10/11) exercise neither guard of the production function.
  `abwAnnualPayment` first truncates the horizon to whole years,
  n = floor(remainingYears), and returns B/n not only when x = 1 (tested as
  |x − 1| < 1e-9) but whenever x is not finite or not positive
  (`!Number.isFinite(x) || x <= 0`). The registry record
  `abw-annuity-due-payment` states both guards and names the input truncation
  as its rounding; the identity above is unchanged.
