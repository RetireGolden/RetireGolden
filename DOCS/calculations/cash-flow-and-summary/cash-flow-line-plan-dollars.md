## Claim

Kind: composition. `projection/internal/types/cashFlow.ts#YearCashFlowCashSourceLine.amountPlanDollars / YearCashFlowPostSolveDepositLine.amountPlanDollars / YearCashFlowUseLine.requestedPlanDollars, fundedPlanDollars, unfundedPlanDollars / YearCashFlowTransferLine.debitPlanDollars, creditPlanDollars` obey the source-side annual cash identity: spendable sources plus portfolio funding plus loan proceeds equal funded household uses plus settled tax plus penalties plus contributions plus surplus investment. Post-solve deposits and tax-character annotations sit outside this identity.

## Justification

The cash report separates physical sources, uses, and transfers into distinct views so the same dollar is not summed twice.

## Inputs

| Published cash-flow total | Value | Unit |
|---|---:|---|
| Spendable sources | 40,000 | nominal Plan dollars |
| Portfolio funding | 30,000 | nominal Plan dollars |
| Loan proceeds | 10,000 | nominal Plan dollars |
| Funded household uses | 50,000 | nominal Plan dollars |
| Settled tax | 10,000 | nominal Plan dollars |
| Penalties | 2,000 | nominal Plan dollars |
| Contributions | 8,000 | nominal Plan dollars |
| Surplus investment | 10,000 | nominal Plan dollars |
| Post-solve life-insurance deposit | 5,000 | nominal Plan dollars |

## Arithmetic

Source total `= $40,000 + $30,000 + $10,000 = $80,000`. Destination total `= $50,000 + $10,000 + $2,000 + $8,000 + $10,000 = $80,000`. Difference `= $80,000 - $80,000 = $0`. The `$5,000` post-solve deposit is excluded from both sides of this identity.

## Expected

Exact values: `sourceTotalPlanDollars = $80,000`, `destinationTotalPlanDollars = $80,000`, and `differencePlanDollars = $0`. Fixture tolerance: absolute `$0.005`, because line totals are folded in binary-floating-point Plan dollars.

## Wrong readings

- Adding the post-solve deposit to sources produces `$85,000` and a false `$5,000` difference.
- Omitting loan proceeds produces a `$70,000` source total and `-$10,000` difference.
- Summing a contribution use and its same-dollar transfer credit into destinations produces `$88,000` and double-counts the transfer view.

## Family

outputs: `cash-flow-line-plan-dollars`.

feeds: `cash-flow-reconciliation-totals`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-eight.md in this directory.
