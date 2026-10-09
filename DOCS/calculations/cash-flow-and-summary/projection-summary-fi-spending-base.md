## Claim

Kind: composition. `projection/compare.ts#summarizeProjection` prices the FI number on one calendar year: `max(startYear, retirementYear)`, where `retirementYear` is the household's later retirement (`household-later-retirement`: a retirement age gives birth year plus that age; a person with no retirement age retires in the first year without their wages, else in the start year; a person who never retires in the plan, such as one whose wages run through their last year alive, is left out and listed in `fiBasis.notRetiring`; a tie in year goes to the older person, then to the smaller id by ordinal comparison), so list order never decides it (decision D-PEOPLE-ORDER, rule R4). `fiBasis.personId` names that person, whose age `fiAge` reports; `fiBasis.retirementYear` is theirs, `fiBasis.retirementRule` says which rule gave it, and `fiBasis.personLastYearAlive` is their last year alive. When nobody retires in the plan no FI figure is priced: `fiNumber`, `fiYear`, `fiAge` and `coastFireNumber` are null and `fiBasis.spendingSource` is `noRetirementInPlan` (the independent review's N3). The priced outflows are that year's published `expenses.total + tax + penalties`, except when the plan converts to Roth in any year (a year with `rothConversion > 0`, or a named conversion request executed or refused in it): then they are the same year's figures from the plan run with its Roth conversions removed (`withoutRothConversions`), because a conversion's tax is paid once, and so are the costs it causes in later years (the IRMAA surcharge its MAGI sets two years on, a taxable account it drained), and dividing any of them by the withdrawal rate would price them as spending every year (decision D-FI-CONVERSION-TAX; the independent review's M1 widened it from "the priced year converts" to "the plan converts"). A conversion after the priced year cannot reach it, so reading the free run then changes nothing; converting more can never lower the figure. `fiBasis.spendingSource` says which: `projection`, `conversionFreeProjection`, `conversionTaxIncluded` (the plan converts and the caller passed no conversion-free run) or `baseAnnual` (empty ledger).

## Justification

The FI number is the portfolio that funds spending at the chosen withdrawal rate: one year's outflows, in start-year dollars, over that rate. Two things decided which year and which outflows without a reason.

- The year was the first-listed person's retirement year. The FI figures are household figures, and no primary source gives list position a meaning (a joint return is taxed on combined income, IRC 6013(d)(3)). The household is financially independent when the last earner stops, so the later retirement is the year that carries the household's full retirement outflows; the tie-break only has to be fixed and order-free.
- A voluntary Roth conversion moves money between the household's own accounts and prepays tax on it once. Counting that year's tax as spending multiplied it by 1 / 0.04 = 25 at the default rate. Measured on the library examples at a 2026 start, it inflated example-couple's FI number by $854,261 and bracket-fill-roth's by $898,300. The year's outflows had the household not converted are the same year of the run with its conversions removed; that is one extra projection, run only when the plan converts. A conversion's costs do not stay in its own year: its MAGI sets the Medicare IRMAA surcharge two years later, and the tax it prepays can drain the taxable account a later year would have drawn on. The independent review measured annuity-purchases-estate with Taylor retiring at 65 (priced year 2028) and one conversion in 2026: reading 2028 from the projection gave $3,059,085, the conversion-free 2028 gives $2,792,288, the same as never converting, and converting in 2026 to 2028 gave $2,792,288 under the old rule, so converting more lowered the published figure. Reading the free run whenever the plan converts removes both.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Projection start year | 2026 | calendar year |
| Pat (listed first): date of birth, retirement age | 1980-12-31, 50 | ISO date, years |
| Robin (listed second): date of birth, retirement age | 1983-05-01, 49 | ISO date, years |
| General inflation, safe withdrawal rate | 3, 4 | percent/year |
| The ledger's 2032 row: `expenses.total`, `tax`, `penalties`, `rothConversion` | 80,000; 30,000; 0; 100,000 | nominal dollars |
| The conversion-free run's 2032 row: `expenses.total`, `tax`, `penalties` | 80,000; 8,000; 0 | nominal dollars |
| Default return | 7 | percent/year |

## Arithmetic

Retirement years: Pat 1980 + 50 = 2030; Robin 1983 + 49 = 2032. The later is 2032, Robin's, so the priced year is max(2026, 2032) = 2032 and Robin's is the age FI is reported at.

The 2032 row converts (100,000 > 0), so its outflows are read from the conversion-free run: 80,000 + 8,000 + 0 = 88,000 nominal. The deflator is 1.03^(2032 - 2026) = 1.03^6 = 1.194052296529. Start-year outflows: 88,000 / 1.194052296529 = 73,698.614588161583. FI number: 73,698.614588161583 / 0.04 = **1,842,465.364704040**.

Coast-FIRE on the same year: the horizon is max(0, 2032 - 2026) = 6 years at the simple real return 0.07 - 0.03 = 0.04; 1.04^6 = 1.265319018496, so 1,842,465.364704040 / 1.265319018496 = **1,456,127.140880293**.

## Expected

| Quantity | Value |
|---|---:|
| Priced year | 2032 |
| FI number | 1,842,465.364704040 |
| Coast-FIRE number | 1,456,127.140880293 |
| Spending source | conversionFreeProjection |
| Person (whose age FI is reported at) | p2 |
| Retirement year | 2032 |
| Retirement rule | retirementAge |
| That person's last year alive | 2078 |

Dollar figures to an absolute tolerance of 0.000001: well above the binary floating-point error of one integer power and two divisions, far below a cent.

## Wrong readings

- Keeping the conversion's tax in the base: (80,000 + 30,000) / 1.194052296529 / 0.04 = 2,303,081.705880049, too high by 460,616.34.
- Pricing the first-listed person's retirement year, 2030: the deflator is 1.03^4 = 1.12550881, and the 2032 row is not the year read at all.
- Discounting Coast-FIRE over the first person's horizon, 4 years: 1,842,465.364704040 / 1.04^4 = 1,574,947.115576125.
- Reading the projection's own row when the plan converted in an earlier year, the rule before the review: the priced year then carries the earlier conversion's IRMAA lookback and the tax it drained from taxable savings, priced 1 / 0.04 = 25 times over, and converting more years can lower the figure (the review's annuity-purchases-estate case: $3,059,085 for one conversion, $2,792,288 for three).

## Family

outputs: none (the FI number, FI year, FI age and Coast-FIRE are published by their own records).

feeds: `projection-summary-fi-number`, `projection-summary-fi-age`, `projection-summary-coast-fire-number`, `projection-summary-fi-year`, `projection-summary-average-pre-retirement-savings-rate-pct`.

## Provenance

Derived by: claude (Opus 5.5), 2026-09-28, from decisions D-FI-CONVERSION-TAX and D-PEOPLE-ORDER (decisions-2026-09-25.md) and the independent check's rule R4 (evidence/people-order-check.md), the arithmetic in exact decimals by a separate script that imports nothing from the engine (`DOCS/calculations/cash-flow-and-summary/scripts/fi_spending_base.py`, run from the repository root). Implemented by the same session. Reviewed by: unreviewed at the time; see the review below.

Revision 2026-09-28 (independent review M1): the conversion-free run is read whenever the plan converts in any year, not only when the priced year converts; the claim, the justification and the last wrong reading are restated.

Reviewed by: Codex (GPT-6-Sol), 2026-09-29, `DOCS/calculations/reviews/REVIEW-2026-09-29-codex-2-cash-flow.md`.

Restated 2026-10-09 by claude (Opus 5.5): the record's limit said RetireGolden-MCP must choose when it adopts this engine. It chose in 0.11.0, and 0.12.0 (`b2c7f717`) keeps the choice: `src/adapter.ts#publishedSummary` passes `conversionFreeRun(plan, simulateOptions)` for every summary a response carries (`run_projection`'s summary and `compare_scenarios`' `a` and `b`), so their FI figures are the app's, and `#summaryWithoutFiBasis` passes null for the summaries `batch_evaluate` and `solve_max_spending` only read (lifetime tax, ending balances, the after-tax estate), none of which reaches a response whole. The claim, the arithmetic and the evidence are unchanged. The record's text changed after the review above, so its `reviewedBy` is `unreviewed` again until an independent review of the restated text.

Reviewed by: Codex (GPT-6-Sol), 2026-10-09, the 2026-10-09 restatement against RetireGolden-MCP b2c7f717 (0.12.0), `DOCS/calculations/reviews/REVIEW-2026-10-09-mcp-012-records-codex.md`.
