## Claim

Kind: formula. `engine/src/decisions/spendingSolver.ts#initialWithdrawalRatePct(annualSpend, startingInvestable)` (new) is the solved spending as a percent of today's investable balances: `(annualSpend / startingInvestable) × 100`, null when `startingInvestable ≤ 0`. The solver publishes it for its own answer as `SustainableSpendingResult.initialWithdrawalRatePct = initialWithdrawalRatePct(maxBaseAnnual, startingInvestableOf(effectivePlan))`, where `maxBaseAnnual` is the $100 floor (see `solved-spending-rounded-to-hundred`). The SWR table's "This plan's solver" row prints it.

## What the UI computes today

`planner-ui/src/planner/SpendingSolverPage.tsx` at `a7f62f1e` (#747 lines in brackets):

```tsx
const startingInvestable = useMemo(() => startingInvestableOf(plan), [plan])          // :141 [:164]
...
{solvedRounded !== null && startingInvestable > 0 ? (                                    // :504 [:545]
  ...
  <td style={{ textAlign: 'right' }}>{((solvedRounded / startingInvestable) * 100).toFixed(2)}%</td>   // :510 [:551]
  <td style={{ textAlign: 'right' }}>{fmtMoney(solvedRounded)}</td>                       // :511
```

Inputs: `solvedRounded` (the page's own $100 floor of `maxBaseAnnual`, :173) and `startingInvestableOf(plan)` (`engine/src/montecarlo/riskBasedGuardrails.ts:126-132`: the sum of the entered balances of cash, taxable, equityComp, traditional, Roth and HSA rows, in plan order), computed from the page's current plan, not the plan the solve ran on. The published rules in the rows above use the same base in the other direction (`decisions/swrComparator.ts:93, 96`: `initialAnnualSpend = (ratePct / 100) × startingInvestable`).

## Engine publication

```ts
// engine/src/decisions/spendingSolver.ts
/** annualSpend as a percent of the starting investable balance; null when that balance is not positive. */
export function initialWithdrawalRatePct(annualSpend: number, startingInvestable: number): number | null
// = startingInvestable > 0 ? (annualSpend / startingInvestable) * 100 : null   (this association; see Wrong readings)

SustainableSpendingResult.initialWithdrawalRatePct: number | null
// = maxBaseAnnual === null ? null : initialWithdrawalRatePct(maxBaseAnnual, startingInvestableOf(effectivePlan))
```

- Domain: `annualSpend ≥ 0` (the published floor), `startingInvestable ≥ 0`; refuse a non-finite argument with a `RangeError`.
- Units: percent (a start-year spend over a start-year balance; both today's dollars). Timing: once per solve. Rounding: none; the page keeps `.toFixed(2)` (formatting).
- `effectivePlan` is the plan the solve priced (the basePatch applied), so the rate never mixes one plan's answer with another plan's balances. Today the page can do that for the length of its debounce and solve: `result` survives a plan edit (`:78`, cleared only on error) while `startingInvestable` is recomputed at once.
- The worker (`planner-ui/src/optimize/runSpendingSolve.ts`) passes the field through; the page gates the row on `initialWithdrawalRatePct !== null` and prints `rate.toFixed(2)%`.

No owner decision applies. The rate was already taken on the rounded amount, so nothing displayed changes in a settled state.

## Justification

The comparison row exists to sit "in the same table" as the published rules (help text at `:508`), which define their rate as initial annual spend over the starting investable portfolio (`swrComparator.ts:66-67`). The solver row is that ratio for the solved amount. It inherits the table's stated simplification: the solver's amount is base spending with the plan's own phases, taxes and horizon, while the rules spend constant-real (page copy at `:462-465`).

## Inputs

| Case | `maxBaseAnnual` (published floor) | `startingInvestable` |
|---|---:|---:|
| A | 62,800 | 1,500,000 |
| B | 40,000 | 1,000,000 |
| C | 41,200 | 800,000 |
| D | 62,800 | 0 |
| E | 0 | 750,000 |
| F | 33,300 | 612,345.67 |

## Arithmetic

A. `62,800 / 1,500,000 = 0.041866…`; `× 100 = 4.1866…` (binary float `4.186666666666667`, bits `4010bf258bf258c0`); `.toFixed(2)` = "4.19". B. `0.04 × 100 = 4` exactly; "4.00". C. `41,200 / 800,000 = 0.0515`, `× 100` = `5.1499999999999995` in binary (bits `4014999999999999`); "5.15". D. `startingInvestable = 0`: null, the row is not rendered (today's gate `startingInvestable > 0`). E. `0`; "0.00". F. `33,300 / 612,345.67 × 100 = 5.438104918746302`; "5.44".

## Expected

A `4.186666666666667`, B `4`, C `5.1499999999999995`, D `null`, E `0`, F `5.438104918746302`, each bit for bit with the retired expression `(solvedRounded / startingInvestable) * 100` (tolerance `exact`; the printed strings "4.19%", "4.00%", "5.15%", no row, "0.00%", "5.44%").

Example library (engine run in the scratch copy; the 7 examples that produce a solver answer): under-saved-single 10.43%, bracket-fill-roth 8.26%, rmd-irmaa 5.71%, inherited-ira-beneficiary 4.98%, survivor-years 59.00% (its investable is $100,000 against $59,000 of solved base spending, most of it carried by guaranteed income), annuity-purchases-estate 7.18%, no-annuity-brokerage 7.31%. Identical to what the page prints today. (Since decision D-BRACKET-FILL-ROTH-EXAMPLE, 2026-09-27, Riley holds her own Roth IRA in the bracket-fill example, and its rate is 8.20%: 100,800 over 1,230,000.)

## Wrong readings

- Rate on the exact probe instead of the floor: rmd-irmaa `131,485 / 2,300,000` prints "5.72%", not "5.71%"; under-saved-single 10.44, inherited-ira-beneficiary 4.99, survivor-years 59.06, annuity-purchases-estate 7.19, no-annuity-brokerage 7.32.
- The other association, `(annualSpend × 100) / startingInvestable`: case A gives `4.1866666666666665`, one unit in the last place below; case C gives `5.15`. The printed two decimals agree here, but the value is not the engine's bit pattern; the parity test pins the association.
- The year-one ending investable (`years[0].investableTotal`) instead of today's entered balances: that is after a year of flows, not the starting portfolio the rules' rates apply to.
- Including property, annuities or other non-investable rows (`startingInvestableOf` excludes them by type).
- A current plan's balances beside a previous solve's answer (the stale window above).

## Parity test for the switch-over

`planner-ui/src/planner/SpendingSolverPage.parity.test.tsx` (with the solver family's test): for the 7 answering examples, the solved row's rate cell reads `${result.initialWithdrawalRatePct.toFixed(2)}%` and `result.initialWithdrawalRatePct === (Math.floor(result.feasibleBaseAnnual / 100) * 100 / startingInvestableOf(plan)) * 100` (Object.is: the retired expression on the same plan); for a plan whose investable balances are all zero the row is absent in both versions. Acceptance grep: no `/ startingInvestable` and no `startingInvestableOf` import left in `SpendingSolverPage.tsx`.

## Proposed calculation record

- id `solved-initial-withdrawal-rate`, group `spending-and-withdrawals`, kind `formula`, outputs `['solved-initial-withdrawal-rate-pct']`, feeds none. Statement: "decisions/spendingSolver.ts#initialWithdrawalRatePct returns (annualSpend / startingInvestable) × 100, or null when startingInvestable is not positive; the solver publishes it for its $100-floored answer over startingInvestableOf of the plan it solved. Units: percent. Rounding: none." Formula `rate = (M / B) · 100` with `M` the published maxBaseAnnual (today's dollars, whole multiples of 100) and `B` the starting investable (today's dollars, `B > 0`). Justification: derivation, `DOCS/calculations/spending-and-withdrawals/solved-initial-withdrawal-rate-pct.md`. Limits: "The solved amount is base spending under the plan's own phases, taxes and horizon; the published rules' rates are constant-real spending over the same base, so the row compares a plan-specific answer with rules of thumb, as the page says." implementedByFunctions `packages/engine/src/decisions/spendingSolver.ts#initialWithdrawalRatePct`.
- `risk-based-starting-investable` (`rules/calculations/monteCarlo.ts`) adds `solved-initial-withdrawal-rate-pct` to its `feeds`.

## Census bookkeeping

Convention (RetireGolden #747 at `093ae4b6`, Docs `3b5f835`): a relocated family's `uiSources` name the UI symbols that now read the engine value, the retired computing symbol moves to `notes` as history, and a conformance test fails on a `uiSources` entry that names a missing file or symbol.

- `relocation: { status: 'done', target: 'engine/src/decisions/spendingSolver.ts#initialWithdrawalRatePct' }`; `uiSources` `[SpendingSolverPage.tsx#SpendingSolverPage]` (the reader, the same entry as today); notes "Computed in planner-ui/src/planner/SpendingSolverPage.tsx#SpendingSolverPage ((solvedRounded / startingInvestableOf(plan)) × 100) until B2-P1 slice 2; now engine SustainableSpendingResult.initialWithdrawalRatePct, which SpendingSolverPage reads."; transformations "(maxBaseAnnual / startingInvestableOf(solved plan)) × 100 in decisions/spendingSolver.ts; the page prints toFixed(2).".
- Field coverage: new row `SustainableSpendingResult.initialWithdrawalRatePct` → family `solved-initial-withdrawal-rate-pct`; the planner-ui row `SpendingSolverPage.solvedWithdrawalRatePct` stays as the record of where it was computed until the line is deleted, then goes.

## Family

outputs: `solved-initial-withdrawal-rate-pct`.

feeds: none. Reads `solved-spending-rounded-to-hundred` (through `maxBaseAnnual`) and the starting investable.

## Provenance

Derived by: claude (opus 5.5), 2026-09-26; expected values by hand and `scripts/independent.mjs` (no engine import); example rates from the scratch-copy engine run (`scripts/engine-solver.json`). Checked by: a separate Claude (Opus 5.5) instance that did not derive it, which recomputed every value with its own scripts and ran the engine where a claim was numeric (RetireGolden-Docs `calculations/bidirectional-validation-plan-2026-09-13/evidence/b2p1-slice2-check.md`): every expected value reproduces; its corrections are applied in the implementation section. Reviewed by: pending; the catalog asks for a reviewer of a different agent family, so the record is `unreviewed`.

## Implementation (B2-P1 slice 2, 2026-09-27)

Implemented as derived, on the published amount (which is exact under guardrails when the rounded amount fails; see `solved-spending-rounded-to-hundred`). `initialWithdrawalRatePct` also refuses a negative spend. The rate is taken over `startingInvestableOf` of the plan the solve priced, so the stale window the check confirmed (the page's current balances beside a previous answer) is gone. Re-measured on the 27 examples that answer after #748: every printed rate is unchanged (for example rmd-irmaa 5.71, early-retiree-aca 5.92); the evidence case pins the bit patterns of cases A and C.
