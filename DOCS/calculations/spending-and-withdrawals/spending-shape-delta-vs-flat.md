## Claim

Kind: composition. `engine/src/decisions/spendingShapes.ts` (new) builds the spending-shape comparison the solver page shows: `planWithSpendingShape(plan, shape)` is the plan variant each shape is solved on, and `spendingShapeRows(solved)` publishes, per shape, the solver's published (rounded) amount and its difference from the flat shape's published amount. Owner decision R5: the "vs constant-real" delta is computed from the two rounded amounts the table shows, so it always equals their difference.

## What the UI computes today

`planner-ui/src/planner/SpendingSolverPage.tsx` at `a7f62f1e` (#747 lines in brackets):

```tsx
const SHAPE_DEFS = [ { id: 'flat', ... }, { id: 'smile', ... }, { id: 'smirk', ... } ]          // :66-70
...
const retirementAge = plan.household.people[0]?.retirementAge ?? 65                             // :106
const variant: Plan = { ...forPlan, expenses: { ...forPlan.expenses,
  phases: spendingShapePhases(def.id, retirementAge),                                             // :115
  ...(forPlan.expenses.spendingPolicy?.mode === 'abw' ? { spendingPolicy: undefined } : {}) } }  // :119
const solved = await runSpendingSolve({ plan: variant, startYear })                               // :122, one worker solve per shape
...
const flat = shapeRows.find((r) => r.id === 'flat')?.maxBaseAnnual ?? null                       // :431 [:469]
const delta = row.maxBaseAnnual !== null && flat !== null ? row.maxBaseAnnual - flat : null       // :432 [:470]
{row.maxBaseAnnual !== null ? `${fmtMoney(Math.floor(row.maxBaseAnnual / 100) * 100)}/yr` : '—'}  // :437 [:475]
{delta === null || row.id === 'flat' ? '—' : `${delta >= 0 ? '+' : ''}${fmtMoney(delta)}/yr`}    // :440
```

The amount column floors each exact probe to $100; the delta column subtracts the exact probes. Inputs: one `SustainableSpendingResult.maxBaseAnnual` per shape.

## Engine publication

```ts
// engine/src/decisions/spendingShapes.ts
export const SPENDING_SHAPE_COMPARISON: readonly SpendingShapeId[] = ['flat', 'smile', 'smirk']

/** The plan solved for one shape: the plan's own phases replaced by the shape's rows (on the first person's
 *  retirement age, 65 when unset); amortized spending (ABW) removed, since the solver has no fixed base to move
 *  under it; every other field, including a guardrail policy, unchanged. */
export function planWithSpendingShape(plan: Plan, shape: SpendingShapeId): Plan

export interface SpendingShapeRow {
  shape: SpendingShapeId
  /** The shape solve's published maxBaseAnnual (rounded down to $100), or null. */
  maxBaseAnnual: number | null
  /** maxBaseAnnual − the flat row's maxBaseAnnual; null on the flat row and when either is null. */
  deltaVsFlatDollars: number | null
}
/** Refuses input without exactly one 'flat' row, and any amount that is not a whole multiple of
 *  SOLVED_SPENDING_STEP_DOLLARS (the published floor is the only accepted input). */
export function spendingShapeRows(solved: readonly { shape: SpendingShapeId; maxBaseAnnual: number | null }[]): SpendingShapeRow[]
```

- Formula: `delta_s = M_s − M_flat`, with `M` the published $100 floor of each shape's feasible probe (`solved-spending-rounded-to-hundred`).
- Domain: `M_s`, `M_flat` whole multiples of 100, `≥ 0`, so `delta_s` is a whole multiple of 100 (exact in binary). Units: today's dollars per year (initial spend; later years follow the shape). Timing: once per comparison. Rounding: none beyond the inputs' floor.
- The page keeps running one worker solve per shape (no new worker channel): `for shape of SPENDING_SHAPE_COMPARISON: runSpendingSolve({ plan: planWithSpendingShape(plan, shape), startYear })`, then `spendingShapeRows(...)`. The labels stay in the UI.
- `planWithSpendingShape` is the UI's construction moved verbatim, including the `?? 65` fallback and the ABW removal; it is also the out-of-census plan construction the recon listed (`SpendingSolverPage.tsx:106-121`).

Decision R5 (fix). Old reading: `delta = exact_s − exact_flat`, beside amounts `floor100(exact)`. Corrected: `delta = floor100(exact_s) − floor100(exact_flat)`. Worked case A below: flat 50,050 shows $50,000, smile 50,149 shows $50,100; the table printed "+$99/yr" beside a visible $100 gap and now prints "+$100/yr".

## Justification

The column is labelled "vs constant-real" next to two displayed amounts; a reader subtracts what is shown. Both amounts are floors of whole-dollar probes, so the old and new deltas differ by at most $99: with `a = 100p + r`, `b = 100q + s` (`0 ≤ r, s ≤ 99`), `(b − a) − (100q − 100p) = s − r ∈ [−99, 99]`. The solver's probes are always whole dollars (seed `round(current)`, doubling from whole numbers, midpoints `round((lo + hi)/2)`), so the bound is $99 and not "just under $100" (the recon check's claim that bisection gives fractional amounts such as 60,468.75 does not hold for this solver; see the README). An exhaustive check over the 10,000 residue pairs gives a largest gap of exactly 99.

## Inputs

| Case | flat exact probe | shape exact probe |
|---|---:|---:|
| A | 50,050 | 50,149 |
| B | 50,099 | 50,100 |
| C | 50,000 | 50,099 |
| D | 50,100 | 50,001 |
| E | 62,813 | 67,109 |
| F | none feasible | 55,000 |
| G | 48,000 | 48,000 |

Variant construction (case H): a plan whose first person retires at 65, with its own phases `[{fromAge: 70, multiplier: 1.2}]` and `spendingPolicy: {mode: 'abw'}`.

## Arithmetic

Published amounts (`floor100`): A 50,000 / 50,100; B 50,000 / 50,100; C 50,000 / 50,000; D 50,100 / 50,000; E 62,800 / 67,100; F null / 55,000; G 48,000 / 48,000.

Deltas, old (exact) → new (published): A `99 → 100`; B `1 → 100`; C `99 → 0`; D `−99 → −100`; E `4,296 → 4,300`; F null → null; G `0 → 0`.

Case H: `planWithSpendingShape(plan, 'flat')` has `phases: []`; `'smile'` has `[{75, 0.9}, {85, 0.8}]`; `'smirk'` has the −1%/yr compiled steps from 65: `(0.99)^5 = 0.95099…` → 0.95 at 70, `0.99^10 = 0.90438…` → 0.90 at 75, `0.99^15 = 0.86006…` → 0.86 at 80, `0.99^20 = 0.81790…` → 0.82 at 85, `0.99^25 = 0.77782…` → 0.78 at 90, `0.99^30 = 0.73970…` → 0.74 at 95, `0.99^35 = 0.70344…` → 0.70 at 100. Each variant has no `spendingPolicy` (ABW removed); with a guardrail policy instead of ABW the policy stays.

## Expected

| Case | row `maxBaseAnnual` | `deltaVsFlatDollars` | printed |
|---|---:|---:|---|
| A | 50,100 | 100 | "+$100/yr" |
| B | 50,100 | 100 | "+$100/yr" |
| C | 50,000 | 0 | "+$0/yr" |
| D | 50,000 | −100 | "-$100/yr" |
| E | 67,100 | 4,300 | "+$4,300/yr" |
| F | 55,000 | null | "—" |
| G | 48,000 | 0 | "+$0/yr" |
| flat row, every case | the flat amount | null | "—" |

Tolerance `exact`. `spendingShapeRows` throws on `[{shape: 'smile', maxBaseAnnual: 50_149}, ...]` (not a multiple of 100) and on input with no flat row or two flat rows. Case H: the three variants deep-equal the retired construction.

Example library (engine run in the scratch copy; the 7 examples that produce a solver answer, 14 non-flat rows). Every one of the 14 printed deltas changes; the largest change is $64:

| Example | flat shown | smile old → new | smirk old → new |
|---|---:|---|---|
| under-saved-single | 65,200 | +5,063 → +5,100 | +8,157 → +8,200 |
| bracket-fill-roth | 91,700 | +14,062 → +14,100 | +16,172 → +16,200 |
| rmd-irmaa | 131,400 | +19,336 → +19,400 | +22,344 → +22,400 |
| inherited-ira-beneficiary | 26,400 | +5,344 → +5,300 | +5,906 → +5,900 |
| survivor-years | 55,900 | +6,469 → +6,500 | +7,594 → +7,600 |
| annuity-purchases-estate | 106,000 | +10,055 → +10,000 | +12,187 → +12,200 |
| no-annuity-brokerage | 108,400 | +9,750 → +9,800 | +11,884 → +11,900 |

The amount column does not change (it was already floored). The other 22 examples have no shape answers either (the same ACA diagnostic as the base solve).

## Wrong readings

- Exact minus exact (today): "+$99" beside a visible $100 gap (A), "+$1" beside $100 (B), "+$99" beside no gap (C).
- Flooring the exact delta: `floor100(99) = 0` in A, where the shown gap is $100.
- Measuring against the plan's own solve instead of the flat shape: the flat variant clears the plan's phases, so on bracket-fill-roth the plan's own answer is 101,602 while flat is 91,759; deltas against the former would all be about $9,800 too small.
- Keeping ABW on the ABW plan's variants: the solver refuses ABW and every row would be null.

## Parity test for the switch-over

`planner-ui/src/planner/SpendingSolverPage.shapes.parity.test.tsx` (jsdom, synchronous worker fallback): for the 7 answering examples and a constructed ABW plan, `planWithSpendingShape(plan, s)` deep-equals the retired variant for each shape; the table's amount cells equal `fmtMoney(row.maxBaseAnnual)` (identical to the retired floor) and the delta cells equal `${delta >= 0 ? '+' : ''}${fmtMoney(row.deltaVsFlatDollars)}/yr`; for under-saved-single the smile delta reads "+$5,100/yr" where the retired expression gave "+$5,063/yr" (the R5 change, asserted, not tolerated). Acceptance grep: no `Math.floor(` and no `- flat` in `SpendingSolverPage.tsx`.

## Proposed calculation record

- id `spending-shape-comparison`, group `spending-and-withdrawals`, kind `composition`, outputs `['spending-shape-delta-vs-flat']`. Statement: "decisions/spendingShapes.ts#spendingShapeRows publishes, for each shape solved on planWithSpendingShape(plan, shape), the solver's published maxBaseAnnual (rounded down to $100) and deltaVsFlatDollars = that amount minus the flat shape's; null on the flat row and when either amount is null. Units: today's dollars per year. Rounding: none beyond the inputs' $100 floor, so the delta is the difference of the displayed amounts (R5)." Justification: derivation, `DOCS/calculations/spending-and-withdrawals/spending-shape-delta-vs-flat.md`. Limits: "Each shape is a separate bisection to about $500, so a delta smaller than the solver's resolution is not meaningful; shapes use the first person's retirement age (65 when unset); an ABW plan is compared as fixed-target variants." implementedByFunctions `packages/engine/src/decisions/spendingShapes.ts#spendingShapeRows`, `#planWithSpendingShape`.
- The shape-preset records (`spendingAndWithdrawals.ts:194-196, 216, 235, 253` at `a7f62f1e`) already feed this family; unchanged.

## Census bookkeeping

Convention (RetireGolden #747 at `093ae4b6`, Docs `3b5f835`): a relocated family's `uiSources` name the UI symbols that now read the engine value, the retired computing symbol moves to `notes` as history, and a conformance test fails on a `uiSources` entry that names a missing file or symbol.

- `relocation: { status: 'done', target: 'engine/src/decisions/spendingShapes.ts#spendingShapeRows' }`; `uiSources` `[SpendingSolverPage.tsx#SpendingSolverPage]`; notes "Computed in planner-ui/src/planner/SpendingSolverPage.tsx#SpendingSolverPage (exact probe minus the flat shape's exact probe, beside $100 floors) until B2-P1 slice 2; now engine engine/src/decisions/spendingShapes.ts#spendingShapeRows on the rounded amounts (R5), which SpendingSolverPage reads."; transformations "Each shape's published maxBaseAnnual minus the flat shape's (both rounded down to $100), in decisions/spendingShapes.ts (R5)."; meaning unchanged.
- Field coverage: new rows `SpendingShapeRow.maxBaseAnnual` (family `sustainable-spending-result-max-base-annual`), `SpendingShapeRow.deltaVsFlatDollars` (family `spending-shape-delta-vs-flat`); the planner-ui rows `ShapeRow.maxBaseAnnual` and `SpendingSolverPage.delta` go with the deleted code.

## Family

outputs: `spending-shape-delta-vs-flat`.

feeds: none. Reads `solved-spending-rounded-to-hundred` per shape.

## Provenance

Derived by: claude (opus 5.5), 2026-09-26; cases A to G and H by hand and `scripts/independent.mjs`; example figures from the scratch-copy engine run (`scripts/engine-solver.json`). Checked by: a separate Claude (Opus 5.5) instance that did not derive it, which recomputed every value with its own scripts and ran the engine where a claim was numeric (RetireGolden-Docs `calculations/bidirectional-validation-plan-2026-09-13/evidence/b2p1-slice2-check.md`): every expected value reproduces; its corrections are applied in the implementation section. Reviewed by: pending; the catalog asks for a reviewer of a different agent family, so the record is `unreviewed`.

## Implementation (B2-P1 slice 2, 2026-09-27)

- **R4 under guardrail spending** changes one refusal: a guardrail plan's shape row can publish the exact amount that passed (`maxBaseAnnualRounding` `'none'`), so `spendingShapeRows` takes each row's rounding and refuses only an amount marked as rounded down that is not a whole multiple of $100 (and an amount without its rounding). Case I: flat 50,000 (rounded) and smile 50,149 (exact) differ by +149, the gap between the two amounts shown.
- **Case H without a retirement age** (added after the independent review, whose mutant changing the default to 67 survived): the shapes step from 65, so the smirk rows are case H's.
- **Correction 9:** `planWithSpendingShape` leaves the removed ABW policy out of the returned expenses rather than setting it to undefined; the parity test compares with `toEqual`, which treats the two alike.
- Re-measured after #748 (27 examples answer, 54 non-flat rows): 48 of the 54 printed differences change, by −84 to +88 (for example under-saved-single smile +5,063 to +5,100, rmd-irmaa smile +19,336 to +19,400); no amount cell changes. Table: staging `b2p1-s2/addendum.md`.
