## Claim

Kind: composition. `projection/internal/types/cashFlow.ts#YearCashFlowCashIdentityTotals`, `#YearCashFlowUseIdentityTotals`, and `#YearCashFlowTransferIdentityTotals` state three annual identities: cash sources equal cash destinations within `$0.005`; requested uses equal funded plus unfunded uses within `$0.000001`; and transfer debits equal transfer credits within `$0.000001`. Each published `differencePlanDollars` is the left total minus the right total.

## Justification

The cash type comments give every subtotal formula. `projection/annualCashFlowCapture.ts` assigns cash conservation the annual funding tolerance and use/transfer reconciliation the strict structural tolerance; comparisons fail only when absolute difference is strictly greater than the tolerance.

## Inputs

| Published reconciliation component | Value | Unit |
|---|---:|---|
| Spendable sources | 65,000.000 | nominal Plan dollars/year |
| Portfolio funding | 25,000.004 | nominal Plan dollars/year |
| Loan proceeds | 10,000.000 | nominal Plan dollars/year |
| Funded household uses | 70,000.000 | nominal Plan dollars/year |
| Settled tax | 12,000.000 | nominal Plan dollars/year |
| Penalties | 1,000.000 | nominal Plan dollars/year |
| Contributions | 7,000.000 | nominal Plan dollars/year |
| Surplus investment | 10,000.000 | nominal Plan dollars/year |
| Requested uses | 93,000.000000 | nominal Plan dollars/year |
| Funded uses | 90,000.000000 | nominal Plan dollars/year |
| Unfunded uses | 3,000.000000 | nominal Plan dollars/year |
| Transfer debits | 22,500.000000 | nominal Plan dollars/year |
| Transfer credits | 22,500.000000 | nominal Plan dollars/year |

## Arithmetic

Cash source total: `$65,000 + $25,000.004 + $10,000 = $100,000.004`.

Cash destination total: `$70,000 + $12,000 + $1,000 + $7,000 + $10,000 = $100,000`; difference `= $0.004`.

Use disposition total: `$90,000 + $3,000 = $93,000`; difference `= $0`.

Transfer difference: `$22,500 - $22,500 = $0`.

## Expected

Exact totals: cash `{source: $100,000.004, destination: $100,000, difference: $0.004}`; uses `{requested: $93,000, disposition: $93,000, difference: $0}`; transfers `{debits: $22,500, credits: $22,500, difference: $0}`. The cash identity is accepted at absolute difference `<= $0.005`; use and transfer identities are accepted at absolute difference `<= $0.000001`, because the checker rejects only a strictly greater difference.

## Wrong readings

- Applying the `$0.000001` structural tolerance to cash rejects the valid `$0.004` residual.
- Omitting surplus investment makes the cash destination total `$90,000` and difference `$10,000.004`.
- Subtracting unfunded uses from funded uses makes disposition `$87,000` and use difference `$6,000`.
- Adding transfer debits and credits produces `$45,000`, but they are paired sides whose difference must be zero.

## Family

outputs: `cash-flow-reconciliation-totals`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-five.md in this directory.
