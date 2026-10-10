## Claim

Kind: formula. `projection/compare.ts#summarizeProjection` publishes `ProjectionSummary.savingsRates`, one entry per ledger row, in ledger order: `year` is the row's year, and

`ratePct = min(100, max(0, (contributions + employerMatch + surplusInvested) / incomes.total × 100))` when `incomes.total > 0`, else `0`,

with all four amounts from that row, in that year's nominal dollars. The rate is in percentage points (20 means 20%). No rounding.

## Justification

Savings are everything the year puts into the portfolio: the household's own contributions, the employer's match, and the surplus the ledger invests after spending, contributions, tax and penalties are paid. Gross income is the ledger's cash income for the year, `incomes.total` (wages, Social Security, pensions, annuities, ladder income, recurring and one-time income, taxable yield and tax-exempt interest), not wages alone. The guard comes before the clamp: a year with no gross income publishes 0, not a division by zero. The clamp keeps a year whose savings exceed its income, such as a year whose required distribution is larger than its spending and is reinvested, at 100. The floor at 0 binds only on a negative savings amount, which the ledger does not publish: contributions, the match and the surplus are each at least 0.

## Inputs

The library example `early-career-match` ("Just getting started", `packages/planner-ui/src/planner/examples/buildEarlyCareerMatch.ts`): Alex, born 2001, retiring at 60 (2061) and claiming Social Security at 67 (2068) on a $2,000 monthly PIA; wages $65,000; a 401(k) contribution of $6,000 a year with the employer matching 100% of deferrals up to 4% of pay, and a Roth IRA contribution of $3,000 a year. The evidence enters four of its years as ledger rows, built from those entries and stated surpluses; the rate depends only on the row's four amounts, so how a projection produces them does not enter it.

| Year | What the row is | contributions | employerMatch | surplusInvested | incomes.total |
|---|---|---:|---:|---:|---:|
| 2026 | first working year: $6,000 + $3,000 contributed; match `100% × min(6,000, 4% × 65,000) = 2,600`; a $1,400 surplus | 9,000 | 2,600 | 1,400 | 65,000 |
| 2062 | retired, before Social Security: no gross income, living on withdrawals | 0 | 0 | 0 | 0 |
| 2070 | Social Security entered at the PIA, `12 × 2,000 = 24,000` (the ledger's own nominal benefit would carry cost-of-living increases), with $6,000 left over and reinvested | 0 | 0 | 6,000 | 24,000 |
| 2076 | the same income in a year whose required distribution exceeds spending by $30,000, reinvested | 0 | 0 | 30,000 | 24,000 |

## Arithmetic

- 2026: savings `9,000 + 2,600 + 1,400 = 13,000`; `13,000 / 65,000 × 100 = 20`.
- 2062: gross income 0, so the rate is 0.
- 2070: savings `6,000`; `6,000 / 24,000 × 100 = 25`.
- 2076: savings `30,000`; `30,000 / 24,000 × 100 = 125`, clamped to `100`.

## Expected

| Year | ratePct |
|---|---:|
| 2026 | 20 |
| 2062 | 0 |
| 2070 | 25 |
| 2076 | 100 |

One entry per row, in this order, each with its row's year. Percentage points to an absolute tolerance of 1e-9: each is one binary floating-point division and one multiplication, with no stated rounding.

## Wrong readings

- Leaving out the employer match gives 2026 `10,400 / 65,000 × 100 = 16`.
- Leaving out the invested surplus gives 2026 `11,600 / 65,000 × 100 = 17.846...` and 2070 `0`.
- Dividing by wages instead of gross income gives 2070 no rate at all (no wages) instead of `25`.
- Publishing the share as a fraction gives 2026 `0.2`.
- Not clamping gives 2076 `125`.
- Dividing without the guard gives 2062 `0 / 0`, not a number.

## Family

outputs: `projection-summary-savings-rate-pct-annual`.

feeds: `projection-summary-average-pre-retirement-savings-rate-pct`, the unweighted mean of these rates over the years before the household's later retirement (record `projection-summary-average-pre-retirement-savings-rate`).

## Provenance

Derived by: claude (Opus 5.5), 2026-10-10, for D-MCP-CENSUS-PIN, from `projection/compare.ts#summarizeProjection` and the doc comments of `ProjectionSummary.savingsRates` and of the four `YearResult` fields at RetireGolden main `43876e8d`. The arithmetic above was done by hand, without running the engine, and the evidence reads these figures from the table above. Implemented by the same session. Reviewed by: unreviewed when written; the independent review is recorded below.

Reviewed by: Codex (GPT-6-Sol), 2026-10-10, by independent recomputation of the four rows, `DOCS/calculations/reviews/REVIEW-2026-10-10-census-completion-codex.md` (approved).
