## Claim

Kind: formula. `projection/compare.ts#summarizeProjection` publishes `ProjectionSummary.estateBreakdown`: one row for each logical balance account of the plan (cash, taxable, equity compensation, traditional, Roth and HSA, one row per account id) whose balance in the last ledger row is positive, in the order the plan first lists them. Pensions, annuities, property, debts and insurance have no row. An equity-compensation account is reported in the `taxable` category. For each row:

- `grossBalance` `G` is the account's balance in the last ledger row.
- The destination is the account's `estateBeneficiary.destination` when one is set (with its `charityPct`, 0 when absent); otherwise an HSA goes to `nonSpouse` when its `beneficiary` field is `nonSpouse` and to `spouse` otherwise, a traditional account goes to `nonSpouse`, and every other account to `spouse`.
- `taxablePretaxBase` `B` is, for a traditional account, `projection/estateTraditionalBasis.ts#estateTraditionalTaxableBase(G, T, N) = max(0, G − min(N, T) × G / T)`, where `T` is the last row's traditional balances summed by category and `N` the projection's `endingNondeductibleIraBasis` (no basis is allocated when `T` is not positive); for an HSA, `projection/estateHsaIncome.ts#estateHsaIncomeBase` is 0 for a `spouse` destination and `G` otherwise; for every other category it is 0.
- The heir rate `r` is the plan's `assumptions.heirTaxByClass.traditional` for a traditional account, or `.hsa` for an HSA, when that override is set, else `assumptions.heirTaxRatePct`, divided by 100. The row carries `heirTaxRatePct = 100 × r`.
- The charity fraction `f` is `min(1, charityPct / 100)` for a `charity` destination and 0 otherwise; `charityAmount = G × f`.
- `heirTax` is 0 for a `spouse` destination and `B × (1 − f) × r` otherwise.
- `netToHeirs = G − charityAmount − heirTax`.

Units: nominal dollars of the projection's end year. Rounding: none. `endingEstateHeirTax` and `endingEstateToCharity` are the sums of the rows' `heirTax` and `charityAmount`.

## Justification

This is the engine's own valuation convention, read from the code above, not a statute's formula. The rules it rests on are registered: the household's remaining nondeductible IRA basis spread over every traditional account by gross (`irc-408-d-2-estate-household-basis-allocation`), the HSA's terminal inclusion without the predeath-expense reduction (`irc-223-f-8-B-estate-predeath-expense-reduction`), and taxable, equity-compensation, cash and Roth balances passing untaxed under the step-up convention (`irc-1014-a-1-basis-at-death-fair-market-value`). A charity share leaves both the amount heirs receive and the base they are taxed on, so the tax applies to `B × (1 − f)`, not to `B − G × f`. A spouse destination keeps its base on the row, because the base is a property of the account, while its heir tax is 0.

## Inputs

The library example `annuity-purchases-estate` ("Annuity ladder with estate planning", `packages/planner-ui/src/planner/examples/buildAnnuityEstate.ts`): Jordan and Taylor, heir rate 28%, and these accounts, in plan order.

| Account | Type | Estate setting | Last-row balance, case 1 | Last-row balance, case 2 |
|---|---|---|---:|---:|
| Emergency cash | cash | none | 315,000 | 315,000 |
| Jordan traditional IRA | traditional | spouse | 915,000 | 915,000 |
| SPIA (non-qualified) | annuity | charity, 100% | no balance account | no balance account |
| QLAC (qualified deferred) | annuity | none | no balance account | no balance account |
| Jordan 401k | traditional | nonSpouse; case 2: charity, 25% | 310,000 | 310,000 |
| Roth IRA | roth | none | 50,000 | 0 |
| Pension (Jordan) | pension | none | no balance account | no balance account |
| Jordan HSA (case 2 only) | hsa | beneficiary nonSpouse | | 40,000 |
| Jordan RSUs (case 2 only) | equityComp | none | | 20,000 |

Case 1 is the example as built, with a one-row ledger whose balances are the example's opening balances: the breakdown reads only the last row's balances, the plan's accounts and the plan's heir rates, so how a projection reaches those balances does not enter it. `endingNondeductibleIraBasis` is 0, and there is no `heirTaxByClass`.

Case 2 is the same example varied to reach the branches the example does not (a spouse-designated HSA and an HSA left partly to charity are not exercised; they follow the same formulas): `endingNondeductibleIraBasis` 49,000; `heirTaxByClass` traditional 32 and HSA 24; the 401k left 25% to charity; the Roth IRA at 0 in the last row; and an HSA left to a non-spouse and an equity-compensation account added.

## Arithmetic

Case 1. `T = 915,000 + 310,000 = 1,225,000`, `N = 0`, so each traditional base is its gross. Every rate is the flat 28%.

- Emergency cash: spouse; `B = 0`; `f = 0`; heir tax 0; net `315,000`.
- Jordan traditional IRA: spouse; `B = 915,000 − 0 = 915,000`; heir tax 0 (spouse); net `915,000`.
- Jordan 401k: nonSpouse; `B = 310,000`; `f = 0`; heir tax `310,000 × 1 × 0.28 = 86,800`; net `310,000 − 0 − 86,800 = 223,200`.
- Roth IRA: spouse; `B = 0`; heir tax 0; net `50,000`.
- The two annuities and the pension are not balance accounts and have no row, so the SPIA's charity designation changes nothing here.

Sums: gross `1,590,000`, base `1,225,000`, charity 0, heir tax `86,800`, net `1,503,200`.

Case 2. `T = 1,225,000` again, `N = 49,000`, `min(N, T) = 49,000`, a share of `49,000 / 1,225,000 = 0.04` of each traditional gross. Traditional rate `0.32`, HSA rate `0.24`, every other row `0.28`.

- Emergency cash: as in case 1, net `315,000`.
- Jordan traditional IRA: spouse; `B = 915,000 − 0.04 × 915,000 = 915,000 − 36,600 = 878,400`; heir tax 0 (spouse); net `915,000`; rate 32.
- Jordan 401k: charity 25%, so `f = 0.25`; `B = 310,000 − 0.04 × 310,000 = 310,000 − 12,400 = 297,600`; charity `310,000 × 0.25 = 77,500`; heir tax `297,600 × 0.75 × 0.32 = 223,200 × 0.32 = 71,424`; net `310,000 − 77,500 − 71,424 = 161,076`.
- Roth IRA: last-row balance 0, so no row.
- Jordan HSA: nonSpouse by its `beneficiary` field; `B = 40,000`; heir tax `40,000 × 0.24 = 9,600`; net `30,400`; rate 24.
- Jordan RSUs: equity compensation, reported as taxable; spouse by default; `B = 0`; heir tax 0; net `20,000`; rate 28.

Sums: gross `1,600,000`, base `1,216,000`, charity `77,500`, heir tax `71,424 + 9,600 = 81,024`, net `1,441,476` (`= 1,600,000 − 77,500 − 81,024`).

## Expected

| Row | Category | Destination | grossBalance | taxablePretaxBase | heirTaxRatePct | charityAmount | heirTax | netToHeirs |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Case 1, Emergency cash | cash | spouse | 315,000 | 0 | 28 | 0 | 0 | 315,000 |
| Case 1, Jordan traditional IRA | traditional | spouse | 915,000 | 915,000 | 28 | 0 | 0 | 915,000 |
| Case 1, Jordan 401k | traditional | nonSpouse | 310,000 | 310,000 | 28 | 0 | 86,800 | 223,200 |
| Case 1, Roth IRA | roth | spouse | 50,000 | 0 | 28 | 0 | 0 | 50,000 |
| Case 2, Emergency cash | cash | spouse | 315,000 | 0 | 28 | 0 | 0 | 315,000 |
| Case 2, Jordan traditional IRA | traditional | spouse | 915,000 | 878,400 | 32 | 0 | 0 | 915,000 |
| Case 2, Jordan 401k | traditional | charity | 310,000 | 297,600 | 32 | 77,500 | 71,424 | 161,076 |
| Case 2, Jordan HSA | hsa | nonSpouse | 40,000 | 40,000 | 24 | 0 | 9,600 | 30,400 |
| Case 2, Jordan RSUs | taxable | spouse | 20,000 | 0 | 28 | 0 | 0 | 20,000 |
| Case 1, sum of the rows | | | 1,590,000 | 1,225,000 | | 0 | 86,800 | 1,503,200 |
| Case 2, sum of the rows | | | 1,600,000 | 1,216,000 | | 77,500 | 81,024 | 1,441,476 |

The rows appear in this order and no others: case 1 has four, case 2 five. Dollar figures to an absolute tolerance of 0.005, because the basis share and the rates are binary floating-point products; the rates to the same tolerance (the row carries `100 × (28 / 100)`, which is 28.000000000000004 in binary floating point).

## Wrong readings

- Taxing a spouse-designated traditional account gives the case 1 IRA an heir tax of `915,000 × 0.28 = 256,200`; giving a spouse row a base of 0 gives it `taxablePretaxBase` 0 instead of `915,000`.
- Letting the SPIA's charity designation enter adds a row in case 1.
- Ignoring the basis gives the case 2 401k a base of `310,000` and a heir tax of `310,000 × 0.75 × 0.32 = 74,400`; charging all the basis to the first traditional account gives the IRA `866,000` and the 401k `310,000`.
- Taking the charity share off the base instead of the gross gives a charity amount of `297,600 × 0.25 = 74,400`.
- Taxing the whole base, not its non-charity slice, gives `297,600 × 0.32 = 95,232`.
- Using the flat 28% instead of the class rates gives the 401k `297,600 × 0.75 × 0.28 = 62,496` and the HSA `40,000 × 0.28 = 11,200`.
- Treating a non-spouse HSA as untaxed gives it a heir tax of 0 and a net of `40,000`.
- Leaving charity in what passes on gives the 401k a net of `310,000 − 71,424 = 238,576`.
- Listing the Roth IRA at a zero balance gives case 2 six rows; leaving out the equity-compensation account gives it four.

## Family

outputs: `estate-taxable-pretax-base-by-account`, `estate-heir-income-tax-by-account`, `estate-to-charity-by-account`, `estate-net-to-heirs-by-account`.

feeds: `estate-heir-income-tax`, `estate-to-charity` (each the sum of one column).

`grossBalance` is the last projection year's balance of the account, a surface of `accounts-balance-per-account-annual`; `heirTaxRatePct` is an echoed input and `accountId`, `name`, `category` and `destination` are labels, all census exclusions.

## Provenance

Derived by: claude (Opus 5.5), 2026-10-10, for D-MCP-CENSUS-PIN, from `projection/compare.ts#summarizeProjection`, `projection/estateTraditionalBasis.ts#estateTraditionalTaxableBase`, `projection/estateHsaIncome.ts#estateHsaIncomeBase` and `model/plan.ts#selectedLogicalBalanceAccounts` at RetireGolden main `43876e8d`. The arithmetic above was done by hand, without running the engine, and the evidence reads these figures from the table above. Implemented by the same session. Reviewed by: unreviewed when written; the independent review is recorded below.

Reviewed by: Codex (GPT-6-Sol), 2026-10-10, by independent recomputation of both cases, `DOCS/calculations/reviews/REVIEW-2026-10-10-census-completion-codex.md` (rejected on two wording points, fixed), and the re-check `DOCS/calculations/reviews/REVIEW-2026-10-10-census-completion-recheck-codex.md` (approved).
