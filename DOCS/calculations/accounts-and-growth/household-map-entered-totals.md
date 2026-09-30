## Claim

Kind: formula. `engine/src/model/enteredBalanceSheet.ts#enteredBalanceSheet` publishes the balance sheet of a list of accounts as the plan stores them today: investable = the sum of the entered `balance` of every cash, taxable, equityComp, traditional, Roth and HSA account; property = the sum of the entered `value` of every property; liabilities = the sum of the entered `balance` of every debt; assets = investable + property; netWorth = assets − liabilities. Each sum adds its accounts in the order given, from 0. Pensions and annuities carry a monthly amount, not a balance, and are not lines of the sheet. The household map prints "As entered: assets $X · debts $Y · net $Z" from it and computes nothing.

## What the UI computed

`planner-ui/src/householdMap/householdGraph.ts` at `f97cf418`:

```ts
export function sumEnteredTotals(nodes: readonly Pick<HouseholdNode, 'kind' | 'amount' | 'amountKind'>[]): HouseholdGraphTotals {
  const totals: HouseholdGraphTotals = { investable: 0, property: 0, assets: 0, liabilities: 0, netWorth: 0 }
  for (const n of nodes) {
    if (n.amount === null) continue
    if (n.kind === 'account' && n.amountKind === 'balance') totals.investable += n.amount
    else if (n.kind === 'property' && n.amountKind === 'value') totals.property += n.amount
    else if (n.kind === 'debt' && n.amountKind === 'owed') totals.liabilities += n.amount
  }
  totals.assets = totals.investable + totals.property
  totals.netWorth = totals.assets - totals.liabilities
  return totals
}
```

`buildHouseholdGraph` summed every node (`totals: sumEnteredTotals(nodes)`), and `mapViewModel.ts#buildMapViewModel` summed the nodes a person focus or group filter left on screen. The account nodes are the plan's accounts in plan order, one each (`accountKind`: the six balance types are `account` nodes with amountKind `balance`, a property a `property` node with `value`, a debt a `debt` node with `owed`, a pension or annuity a `guaranteedIncome` node with `monthlyBenefit`), and `accountAmount` copies the stored figure verbatim. So the node sums are sums of the plan's stored figures over the accounts shown, in plan order.

## Engine publication

```ts
// engine/src/model/enteredBalanceSheet.ts
export interface EnteredBalanceSheet { investable; property; assets; liabilities; netWorth }  // all number
export function enteredBalanceSheet(accounts: Iterable<Account>): EnteredBalanceSheet
```

- Classification by account type, the same six investable types as `montecarlo/riskBasedGuardrails.ts#startingInvestableOf` (the ledger's first-year portfolio), so the map's investable subtotal and that figure are one number on the same accounts.
- Domain: any list of plan accounts, including none (every line 0). A figure that is not finite is refused with a RangeError; the plan schema never admits one.
- Units: dollars as entered, today; no growth, no year, no deflation. Rounding: none; the map prints `fmtMoney` whole dollars.
- A leaf module (its one import is a type), so the map does not load the ledger.
- After the move: `buildHouseholdGraph` publishes `totals: enteredBalanceSheet(plan.accounts)` and `accountNodes` (each account with the id of its node, in plan order); the map's scoped totals are `enteredTotalsOfNodes(graph, shownNodeIds)`, the engine's sheet of the accounts whose nodes are shown. `HouseholdGraphTotals` and `sumEnteredTotals` are gone from planner-ui.

## Justification

A balance sheet lists what is owned and what is owed and nets them: assets less liabilities. The map says "as entered", so each line is the stored figure itself; a pension or annuity is a stream of income with no stored balance, so it is not a line (the map shows it as a monthly benefit on its own node). The projected net worth is a different quantity (the same accounts at the end of a projected year) and keeps its own family, `accounts-net-worth-annual`.

## Inputs

| Case | Accounts |
|---|---|
| A | cash 40,000; taxable 300,000; traditional 500,000; Roth 120,000; HSA 25,000; equityComp 15,000; property 650,000; debt 210,000; a pension paying 2,000 a month; an annuity paying 1,500 a month |
| B | cash 10,000; property 200,000; debt 350,000 |
| C | none |
| D | case A without the traditional account and the debt (a view showing only some accounts) |
| E | cash 0.1; taxable 0.2; Roth 0.3 |

## Arithmetic

A. investable = 40,000 + 300,000 + 500,000 + 120,000 + 25,000 + 15,000 = 1,000,000; property 650,000; assets 1,650,000; liabilities 210,000; net 1,650,000 − 210,000 = 1,440,000. The pension and annuity add nothing.

B. investable 10,000; property 200,000; assets 210,000; liabilities 350,000; net −140,000.

C. every line 0.

D. investable 1,000,000 − 500,000 = 500,000; property 650,000; assets 1,150,000; liabilities 0; net 1,150,000.

E. (0 + 0.1) + 0.2 = 0.30000000000000004; + 0.3 = 0.6000000000000001 (the other association, 0.1 + (0.2 + 0.3), gives 0.6).

## Expected

| Case | investable | property | assets | liabilities | netWorth |
|---|---:|---:|---:|---:|---:|
| A | 1,000,000 | 650,000 | 1,650,000 | 210,000 | 1,440,000 |
| B | 10,000 | 200,000 | 210,000 | 350,000 | −140,000 |
| C | 0 | 0 | 0 | 0 | 0 |
| D | 500,000 | 650,000 | 1,150,000 | 0 | 1,150,000 |

E: investable 0.6000000000000001. Tolerance exact. Case A's investable equals `startingInvestableOf` of a plan with case A's accounts.

Example library, as the app opens each example (measured on this branch with the parity test's retired function): on all 29 the engine's five figures equal the retired node sums bit for bit, for the household, for each person's focus and with each group hidden, and the printed text is unchanged. Three examples carry property or debt: example-couple (investable 2,105,000, property 420,000, assets $2,525,000, debts $180,000, net $2,345,000; Alex's focus $2,215,000 / $180,000 / $2,035,000, Sam's $1,440,000 / $180,000 / $1,260,000), hsa-property-depth (assets $825,000, of which property 385,000) and brokerage-no-hsa (assets $805,000, of which property 385,000). Three hold a pension or annuity that the sheet leaves off (survivor-years, annuity-purchases-estate, no-annuity-brokerage).

## Wrong readings

- A pension's or annuity's monthly amount read as a balance: case A's investable 1,003,500 (or 1,042,000 at twelve months).
- Net worth without property (investable − liabilities): case A 790,000.
- The debt added to assets: case A 1,860,000.
- The projected net worth of the first year (`YearResult.netWorth`) printed as "as entered": it includes a year's growth, contributions and withdrawals.
- The whole household's totals printed while a focus or filter hides accounts (the map's copy then says "for NAME" or "for the items shown").

## Parity test for the switch-over

`planner-ui/src/planner/freezeAdditions.parity.test.ts`, "household map": on the 29 examples as the app opens them, the graph's totals and the map's scoped totals (each person's focus, each group hidden) are `Object.is` the retired `sumEnteredTotals` over the same nodes, and the totals text is the retired text. `HouseholdMapPage.focusScope.test.tsx` checks the sheet against balances summed straight off the plan, and `integration/householdGraphReconciliation.test.ts` against the report model's accounts block, on every example. Acceptance grep: no `totals.investable +=` or `sumEnteredTotals` in `planner-ui/src/householdMap`.

## Calculation record

- id `entered-balance-sheet`, group accounts-and-growth, kind `formula`, outputs `['household-map-entered-totals']`; implementedByFunctions `packages/engine/src/model/enteredBalanceSheet.ts#enteredBalanceSheet`.
- Limits: the figures are as entered, not projected; a pension, annuity, TIPS ladder or insurance policy is not a line; the investable total is the ledger's first-year portfolio.

## Census bookkeeping

- `household-map-entered-totals`: `relocation: { status: 'done', target: 'engine/src/model/enteredBalanceSheet.ts#enteredBalanceSheet' }`; `uiSources` the symbols that now read it (`householdGraph.ts#buildHouseholdGraph`, `householdGraph.ts#enteredTotalsOfNodes`, `mapViewModel.ts#buildMapViewModel`); the retired `sumEnteredTotals` moves to notes.
- Field coverage: the five `HouseholdGraphTotals` rows (planner-ui) become `EnteredBalanceSheet` rows (engine/src/model/enteredBalanceSheet.ts) on the same family, with the same notes.

## Family

outputs: `household-map-entered-totals`.

feeds: none.

## Provenance

Derived by: claude (opus 5.5), 2026-09-30; cases by hand, the library figures from the parity test's measurement run. Implemented by: claude (opus 5.5), same day. Reviewed by: unreviewed; the catalog asks for a reviewer of a different agent family.

Reviewed by: Codex (GPT-6-Sol), 2026-09-30, `DOCS/calculations/reviews/REVIEW-2026-09-30-round3-codex.md`.
