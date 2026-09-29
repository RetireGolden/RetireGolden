## Claim

Kind: formula. `engine/src/ladder/ladderMath.ts#ladderIncomeYieldPct(build)` (new) publishes a ladder quote's annual real income as a percent of its real cost: `(build.targetAnnualRealIncome / build.totalCost) × 100`. With it, `ladder/ladderMath.ts#quotePlanLadder(ladder, startYear)` (new) prices a plan's ladder with the ledger's own anchor rule (shared with `simulatePlan`), so the Income floor section stops restating that rule.

## What the UI computes today

`planner-ui/src/planner/sections/IncomeFloorSection.tsx` at `a7f62f1e` (#747 moves the yield line to :193):

```tsx
function quoteLadder(ladder: TipsLadder, startYear: number): LadderBuild | null {          // :43-53, a copy of simulate.ts:703-711
  const anchorYear = ladder.purchase ? ladder.purchase.year : startYear - 1
  const effectiveStartYear = Math.max(ladder.startYear, anchorYear + 1)
  if (ladder.endYear < effectiveStartYear || ladder.annualRealAmount <= 0) return null
  return buildLadder({ annualRealIncome: ladder.annualRealAmount, firstPayoutOffset: effectiveStartYear - anchorYear,
    payoutYears: ladder.endYear - effectiveStartYear + 1, curve: CURVE })
}
...
{((ladder.annualRealAmount / quote.totalCost) * 100).toFixed(2)}% of cost per year, inflation-protected.   // :192
...
<td>{(ladder.purchase ? ladder.purchase.year : startYear - 1) + rung.maturityOffset}</td>              // :209, the buy-list's "Matures" year
```

`startYear` was `currentStartYear()` at `a7f62f1e` (`:464`, passed at `:478`). Since decision D-2027-ROLLOVER it is `projectionStartYear(plan)`, read where the ladder list renders and passed to each `LadderRow`: the clock's year for a user plan, 2026 for a library example. Inputs: the plan's `TipsLadder` and `LadderBuild.totalCost` (`engine/src/ladder/ladderMath.ts:138-143`). `buildLadder` echoes its input as `targetAnnualRealIncome` (`:141`), so `ladder.annualRealAmount` and `quote.targetAnnualRealIncome` are the same number. The census lists only the ratio; the anchor rule (`:43-53`) and the maturity-year label (`:209`, the same anchor again) are the out-of-census copies the recon named.

## Engine publication

```ts
// engine/src/ladder/ladderMath.ts
/** Annual real income as a percent of the quote's real cost: (targetAnnualRealIncome / totalCost) × 100. RangeError unless totalCost > 0. */
export function ladderIncomeYieldPct(build: Pick<LadderBuild, 'targetAnnualRealIncome' | 'totalCost'>): number

/** The ledger's anchor for a plan ladder: the purchase year, or (already owned) the year before the projection; the first payout
 *  is no earlier than the year after the anchor. Null when the window is empty or the amount is not positive. */
export function planLadderWindow(ladder: TipsLadder, startYear: number):
  { anchorYear: number; effectiveStartYear: number; firstPayoutOffset: number; payoutYears: number } | null

export interface PlanLadderQuote {
  build: LadderBuild
  anchorYear: number
  /** anchorYear + rung.maturityOffset for each rung, in rung order (the buy-list's "Matures" column). */
  maturityYears: number[]
  /** ladderIncomeYieldPct(build). */
  incomeYieldPct: number
}
/** buildLadder on planLadderWindow with the embedded curve (or `curve`), exactly as simulatePlan prices the ladder. */
export function quotePlanLadder(ladder: TipsLadder, startYear: number, curve?: RealYieldCurve): PlanLadderQuote | null
```

- `simulate.ts:700-711` calls `planLadderWindow` instead of its inline rule (a refactor: the same four expressions, so every ledger ladder is bit-identical).
- Domain: `totalCost > 0`. Whenever `annualRealAmount > 0` every face is positive (the level-income back-substitution never reaches `laterCoupons ≥ A` at real coupons of a few percent), so every rung cost and the total are positive; `planLadderWindow` returns null for a non-positive amount before any build. Units: percent per year (real income over real cost, both today's dollars). Timing: at quote time, on the curve the quote used. Rounding: none; the page keeps `.toFixed(2)`.
- After the move the page prints `quote.incomeYieldPct.toFixed(2)`, the buy-list reads `quote.maturityYears[i]`, and `quoteLadder` is deleted.

No owner decision applies; nothing displayed changes.

## Justification

The ladder construction is the engine's record set (`ladder-real-yield-interpolation`, `ladder-annual-coupon-par-pricing`, the level-income construction, `treasury-real-yield-curve-2026` in `rules/calculations/laddersAndValuation.ts`). The yield is the plain ratio the copy states ("X% of cost per year"). For a ladder of `n` level payments on a flat real curve at `y` with coupons at par, every rung prices at face and the ratio is the level annuity payment per dollar, `1 / Σ_{k} (1+y)^{−k}` over the payout offsets; case B checks that.

## Inputs

| Case | Curve | `annualRealIncome` | first offset | payout years |
|---|---|---:|---:|---:|
| A | flat 2% (one point: 5y at 2.00%) | 10,200 | 1 | 1 |
| B | flat 2% | 10,200 | 1 | 2 |
| C | flat 0% (coupon floored at 0.125%) | 20,000 | 3 | 2 |
| D | the embedded curve, the official 2026-06-30 row since decision D-TREASURY (1.93, 2.06, 2.20, 2.54, 2.73 at 5, 7, 10, 20, 30y) | 30,000 | 2 | 20 |

Case D is a floor ladder already owned (`purchase` absent), payouts 2027 to 2046, projection start 2026: anchor 2025, first offset 2, 20 years.

## Arithmetic

A. One rung at offset 1, coupon 2%: face `10,200 / 1.02 = 10,000`; price `(200 + 10,000) / 1.02 = 10,000`. Yield `10,200 / 10,000 × 100 = 102` ("102.00"): a one-year "ladder" returns its cost plus a coupon.

B. Last rung (offset 2): face `F₂ = 10,200 / 1.02 = 10,000`, coupon 200. First rung: `F₁ = (10,200 − 200) / 1.02 = 9,803.921568627451`. On a flat par curve each rung prices at face, so cost `= 19,803.92156862745`. Yield `= 10,200 / 19,803.92156862745 × 100 = 1.02² / 2.02 × 100 = 51.504950495049…` (binary `51.504950495049506`), "51.50". Check against the annuity: `1 / (1/1.02 + 1/1.02²) = 1.0404 / 2.02 = 0.5150495…`.

C. Coupon `max(0.125, 0) = 0.125%`, discount rate 0. `F₄ = 20,000 / 1.00125 = 19,975.031210986268`; `F₃ = (20,000 − 19,975.031210986268 × 0.00125) / 1.00125 = 19,950.093593993777`. Prices (undiscounted): rung 3 `F₃ × (1 + 3 × 0.00125) = 20,024.906444971253`, rung 4 `F₄ × (1 + 4 × 0.00125) = 20,074.9063670412`; cost `40,099.81281201245`; yield `49.875544541217224`, "49.88" (the deferral years pay coupons that cost money and do not count as income in the target).

D. By the author's independent construction (`scripts/ladder-independent.mjs`, no engine import: back-substitution, floored coupons, par yields as spot, linear interpolation with flat ends), on the official Treasury row the engine embeds since D-TREASURY (1.93, 2.06, 2.20, 2.54, 2.73): cost `475,626.77709488804`, yield `6.307466577731172`, "6.31". On the row embedded before D-TREASURY (1.85, 2.05, 2.25, 2.55, 2.70 at `a7f62f1e`) the same construction gave cost `474,975.27302773914`, yield `6.316118270486886`, "6.32". The D-TREASURY implementer recomputed both in exact rationals (a separate script, no engine import) and got the same costs and yields to within 3e-10.

## Expected

| Case | `totalCost` | `ladderIncomeYieldPct` | printed | Tolerance |
|---|---:|---:|---|---|
| A | 10,000 | 102 | "102.00" | exact |
| B | 19,803.92156862745 | 51.504950495049506 | "51.50" | exact; `1.0404/2.02 × 100` within 1e-12 relative |
| C | 40,099.81281201245 | 49.875544541217224 | "49.88" | absolute 1e-9 on the yield |
| D | 475,626.77709488804 | 6.307466577731172 | "6.31" | absolute 1e-9 (on the row before D-TREASURY: 474,975.27302773914, 6.316118270486886, "6.32") |

`ladderIncomeYieldPct({targetAnnualRealIncome: 1, totalCost: 0})` throws. `quotePlanLadder` for D: `anchorYear 2025`, `maturityYears [2027, …, 2046]`, `incomeYieldPct` as above; with `endYear 2026` and start 2027 (an empty window) it returns null; with `annualRealAmount 0` null.

Cross-check (engine run in the scratch copy, afterwards): `buildLadder` gives the same `totalCost` for A to D to every printed digit, and the same faces and rung costs for B and C.

## Wrong readings

- Cost over income (`totalCost / annual × 100`): 194.16 in case B, a years-of-income reading.
- Income over total face (`A / ΣF`): equal to the right answer in B only because a flat par curve prices at face; in C it gives `20,000 / 39,925.12… = 50.09`, not 49.88.
- Counting deferral-year coupons as income: C would read higher than the target income.
- Anchoring an owned ladder at the projection start year instead of the year before it: every offset shifts by one and the quote no longer matches the ledger's.

## Parity test for the switch-over

`planner-ui/src/planner/sections/IncomeFloorSection.parity.test.tsx` (jsdom): for a grid of ladders (owned and purchased; start before, at and after the anchor; an empty window; amount 0), `quotePlanLadder(ladder, startYear)` deep-equals the retired `quoteLadder` build (kept in the test) and its `anchorYear`; the rendered sentence contains `${quote.incomeYieldPct.toFixed(2)}%` and the retired `((ladder.annualRealAmount / quote.totalCost) * 100)` is bit-identical to `incomeYieldPct`; the buy-list's "Matures" cells equal `quote.maturityYears`. An engine test asserts that `simulatePlan`'s ladder states use the same window as `planLadderWindow` (a plan with one owned and one purchased ladder). None of the 29 examples has a ladder, so none changes. Acceptance grep: no `/ quote.totalCost` and no `ladder.purchase ? ladder.purchase.year : startYear - 1` left in `IncomeFloorSection.tsx` (the purchase-toggle default at `:149`, `Math.min(startYear, l.startYear - 1)`, is plan construction and stays).

## Proposed calculation record

- id `ladder-income-yield`, group `ladders-and-valuation`, kind `formula`, outputs `['income-floor-ladder-yield-pct']`. Statement: "ladder/ladderMath.ts#ladderIncomeYieldPct returns (targetAnnualRealIncome / totalCost) × 100 for a ladder quote; quotePlanLadder prices a plan ladder on the ledger's window (planLadderWindow). Units: percent per year, real. Rounding: none." Formula `yield = (A / C) · 100`, `A` the level real income (today's dollars per year, `> 0`), `C = Σ rung prices` (today's dollars, `> 0`). Justification: derivation, `DOCS/calculations/ladders-and-valuation/income-floor-ladder-yield-pct.md`. Limits: "The ratio inherits the construction's planning simplifications (annual coupons, par yields as spot, the embedded curve's date); on a deferred ladder the cost includes coupons paid before the first payout year, so the yield is below the level-annuity rate; a one-year ladder's yield exceeds 100%." implementedByFunctions `packages/engine/src/ladder/ladderMath.ts#ladderIncomeYieldPct`, `#quotePlanLadder`, `#planLadderWindow`.
- `ladder-real-yield-interpolation` and `treasury-real-yield-curve-2026` already list `income-floor-ladder-yield-pct` in `feeds`; unchanged.

## Census bookkeeping

Convention (RetireGolden #747 at `093ae4b6`, Docs `3b5f835`): a relocated family's `uiSources` name the UI symbols that now read the engine value, the retired computing symbol moves to `notes` as history, and a conformance test fails on a `uiSources` entry that names a missing file or symbol.

- `relocation: { status: 'done', target: 'engine/src/ladder/ladderMath.ts#ladderIncomeYieldPct' }`; transformations "(targetAnnualRealIncome / totalCost) × 100 in ladder/ladderMath.ts, on the quote quotePlanLadder builds with the ledger's window."; `uiSources` `[planner-ui/src/planner/sections/IncomeFloorSection.tsx#LadderRow]` (the component that prints the yield; `IncomeFloorSection` only renders it); notes "Computed in planner-ui/src/planner/sections/IncomeFloorSection.tsx#LadderRow ((annualRealAmount / quote.totalCost) × 100, on quoteLadder's copy of the ledger's anchor rule) until B2-P1 slice 2; now engine engine/src/ladder/ladderMath.ts#ladderIncomeYieldPct on quotePlanLadder, which LadderRow reads."
- Docs `validate-census.mjs`: the `REQUIRED_UI` pin `['planner-ui/src/planner/sections/IncomeFloorSection.tsx', 'IncomeFloorSection', 'annualRealAmount / totalCost * 100']` follows the reader, `[..., 'LadderRow', 'yield read from the engine (was annualRealAmount / totalCost * 100, until B2-P1 slice 2)']`, as Docs `3b5f835` did for slice 1.
- Field coverage: the planner-ui row `IncomeFloorSection.yieldPct` goes; new rows `PlanLadderQuote.incomeYieldPct` (family `income-floor-ladder-yield-pct`), `PlanLadderQuote.anchorYear` and `.maturityYears` (`excluded`, `dimension-coordinate`), and `planLadderWindow`'s return fields (`dimension-coordinate`).

## Family

outputs: `income-floor-ladder-yield-pct`.

feeds: none. Reads `ladder-build-total-cost` and `ladder-build-target-annual-real-income`.

## Provenance

Derived by: claude (opus 5.5), 2026-09-26; cases A to C by hand, D and the D-TREASURY variant by `scripts/ladder-independent.mjs`; `buildLadder` cross-check in the scratch copy (`scripts/engine-ladder.json`). Checked by: a separate Claude (Opus 5.5) instance that did not derive it, which recomputed every value with its own scripts and ran the engine where a claim was numeric (RetireGolden-Docs `calculations/bidirectional-validation-plan-2026-09-13/evidence/b2p1-slice2-check.md`): every expected value reproduces; its corrections are applied in the implementation section. Reviewed by: pending; the catalog asks for a reviewer of a different agent family, so the record is `unreviewed`.

## Implementation (B2-P1 slice 2, 2026-09-27)

Implemented as derived. **Correction 7:** `simulatePlan` now calls `planLadderWindow`; the three lines it replaced became three lines, so no reach spec under `scripts/equivalence` moved. An evidence case spies on `planLadderWindow` during a projection with one owned and one purchased ladder and checks the first year's ladder income against the quote. D-TREASURY has not landed at this base, so case D keeps the embedded curve's 6.316118270486886. No example plan has a ladder.

D-TREASURY (2026-09-27): the embedded curve is now the official row, so case D's expected values are the D-TREASURY variant this worksheet derived beforehand (cost 475,626.77709488804, yield 6.307466577731172, "6.31"), and the engine reproduces them to every printed digit. The income-floor card prints 6.31% for this ladder where it printed 6.32%.

Added after the independent review, whose mutants survived:

- **The association:** with case C's cost, `(20,000 / 40,099.81281201245) × 100` = 49.875544541217224 in binary64, where `(20,000 × 100) / 40,099.81281201245` = 49.87554454121722; case C's absolute 1e-9 tolerance could not tell them apart, so an exact case pins the stated order.
- **The window's clamp:** a ladder bought in the projection's first year (2026) and starting that year is anchored in 2026 and first pays in 2027 (`firstPayoutOffset` 1, 9 payout years to 2035); an owned ladder whose start (2020) is before the projection is anchored in 2025 and first pays in 2026 (10 payout years to 2035).
