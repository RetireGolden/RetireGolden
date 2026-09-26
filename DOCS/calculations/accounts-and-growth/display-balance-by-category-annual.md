## Claim

Kind: composition. `projection/yearFigures.ts#balancesByCategory(plan, year)` publishes, for one ledger year, the year-end balances of the plan's investable accounts summed into six categories (cash, taxable, equityComp, traditional, roth, hsa), **one value per logical account id**: it iterates `model/plan.ts#selectedLogicalBalanceAccounts(plan.accounts)` and adds `year.balances[id]` once per id, under that id's account type. It refuses a plan in which an investable account shares its id with a property, a debt or a permanent-life policy. Beside the categories, `projection/yearFigures.ts#unassignedCash(year)` reads `YearResult.unassignedCash`, the surplus the ledger holds outside every account, which is in `investableTotal` and in no category.

Owner decision R1 (fix, 2026-09-25) applies: an account held in several plan rows is counted once, not once per row. Owner answer Q9 (2026-09-26): unassigned cash stays out of the six categories but is published so the chart can draw it.

## Justification

A logical account split across plan rows (an IRA recorded as two holdings under one id) is one account: the ledger grows and withdraws it as one balance and publishes one aggregate under its id (`YearResult.balances`). Adding that aggregate once per row counts it `k` times; iterating logical ids, as the engine's own summary does, counts it once. A property, a debt or a policy published under the same id as an account overwrites the account's entry in the balances record (a cash account and a 300,000 home under id `home` published `home: 300000`, stacked as cash), so such a plan is refused rather than read (decision D-CASH-PROPERTY-ALIAS; the plan checks refuse these plans and stored ones are repaired on load).

Surplus cash that finds no cash or taxable account to land in is tracked by the ledger as unassigned cash (at 0% growth, with a warning) and counted in `investableTotal`, which also sums every physical account row. So when the plan has no split account the six categories plus the unassigned cash make up `investableTotal`.

## Inputs

**Case A (the R1 demonstration, through the ledger).** A single filer born 1963-01-01; accounts: cash `funding` 1,000, traditional `ira` 50,000, traditional `ira` 50,000; no income, no spending, no healthcare premiums, zero returns, a zero tax rate, 2026 only. Nothing flows, so year-end balances equal openings.

**Case B (all six categories, one split account, other channels present; a published row).**

| Plan row | id | type | Published `balances[id]` |
|---|---|---|---:|
| 1 | `c1` | cash | 10,000 |
| 2, 3 | `t1` | taxable (two rows) | 25,000 (one aggregate) |
| 4 | `e1` | equityComp | 7,500 |
| 5 | `ira` | traditional | 30,000 |
| 6 | `r1` | roth | 40,000 |
| 7 | `h1` | hsa | 6,000 |
| 8 | `home` | property | 300,000 |
| 9 | `mort` | debt | 120,000 |
| policy | `wl` | permanent life | 15,000 (cash value) |

**Case C (the shared id).** A plan object that did not go through the plan checks, with a cash account `home` (10,000) and a property `home` (300,000).

**Case D (unassigned cash, through the ledger).** The same person with only a traditional `ira` of 50,000, an uninflated recurring pension of 30,000 and 20,000 of spending, zero tax rate, 2026 only.

## Arithmetic

- A: logical ids `funding` (cash) and `ira` (traditional); `balances = { funding: 1,000, ira: 100,000 }` and `investableTotal = 1,000 + 50,000 + 50,000 = 101,000`. Categories: cash `1,000`, traditional `100,000`, the rest `0`; they sum to `101,000`. The retired per-row loop gave traditional `200,000`, a stack of `201,000`.
- B: cash `10,000`; taxable `25,000` once; equityComp `7,500`; traditional `30,000`; roth `40,000`; hsa `6,000`. Property, debt and policy values enter nothing. The per-row loop gave taxable `50,000`.
- C: the ids collide in the balances record, so the function refuses and names `home`.
- D: surplus `30,000 − 20,000 − 0 = 10,000` with no cash or taxable account: unassigned `10,000`. Categories: traditional `50,000`, the rest `0`; `investableTotal = 10,000 + 50,000 = 60,000`. A plan with a taxable account instead deposits its surplus there and publishes `0` unassigned.

## Expected

- A: `{ cash: 1000, taxable: 0, equityComp: 0, traditional: 100000, roth: 0, hsa: 0 }` exactly, the six keys in that order, summing exactly to `investableTotal` = `101,000`.
- B: `{ cash: 10000, taxable: 25000, equityComp: 7500, traditional: 30000, roth: 40000, hsa: 6000 }` exactly.
- C: throws; the message names `"home"`.
- D: `{ cash: 0, taxable: 0, equityComp: 0, traditional: 50000, roth: 0, hsa: 0 }`, `unassignedCash = 10,000`, `investableTotal = 60,000`; a row without the field reads null, not 0.

## Wrong readings

- One addend per plan row (the retired page loop): A traditional `200,000`, B taxable `50,000`.
- Five categories (the summary's `endingByCategory` set): drops equityComp's `7,500` from B.
- Including property, debt or policy values: B's stack rises by `300,000`, `120,000` or `15,000`.
- One row's balance instead of the logical aggregate: A traditional `50,000`.
- Reading the overwritten record (C) as cash: `300,000` of cash.
- Adding unassigned cash to cash: D would show 10,000 of cash in a plan with no cash account.

## Family

outputs: `display-balance-by-category-annual`.

feeds: none. Reads `accounts-balance-per-account-annual`. `endingByCategory` in the projection summary is this roll-up read for the last row, without equity compensation.

## Provenance

Derived by: claude (opus 5.5), 2026-09-26, from the source at RetireGolden `aeb2861a` and the ledger's publication contract; arithmetic by hand. Case D was added by the implementer for owner answer Q9, by hand from the surplus rule `YearResult.surplusInvested` states. Checked by a second claude agent that did not derive cases A to C, which confirmed them and found that unassigned cash is not small in the example library (`coast-fire` carries it from 2026, up to 45% of investable in 2055). Reviewed by: pending; the catalog asks for a reviewer of a different agent family.
