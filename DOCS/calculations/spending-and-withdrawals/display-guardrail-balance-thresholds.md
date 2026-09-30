## Claim

Kind: composition. `engine/src/montecarlo/riskBasedGuardrails.ts#guardrailThresholdDollars(plan)` (new) publishes a risk-based guardrail policy's cut and raise thresholds in today's dollars on the base the ledger acts on: `(lowerBalanceThresholdPct / 100) × B` and `(upperBalanceThresholdPct / 100) × B`, with `B` the real start-of-year portfolio of the ledger's first year, which is today's entered investable balances. The rounding of the solved fraction to the persisted percent moves into the engine too: `balanceThresholdPct(balanceFrac) = round(balanceFrac × 10⁴) / 100`, published by the solver as `RiskBasedThreshold.balancePct`. Owner decision R3 (fix).

## What the UI computes today

At `a7f62f1e` (#747 lines in brackets), three surfaces print the same product:

```tsx
fmtMoney((plan.expenses.spendingPolicy.lowerBalanceThresholdPct / 100) * startingInvestableOf(plan))   // ResultsPage.tsx:875 [:949], upper :887 [:961]
`cut below ${fmtMoney((plan.expenses.spendingPolicy.lowerBalanceThresholdPct / 100) * startingInvestableOf(plan))}`  // MonteCarloPage.tsx:673, raise :677
<strong>{fmtMoney((e.spendingPolicy.lowerBalanceThresholdPct / 100) * startingInvestableOf(plan))}</strong>          // sections/SpendingPolicyRiskBased.tsx:127, raise :136
```

and the solve persists the percent (`planner-ui/src/planner/sections/useThresholdSolve.ts:68, 70`):

```ts
if (solved.lower) policy.lowerBalanceThresholdPct = Math.round(solved.lower.balanceFrac * 10_000) / 100
if (solved.upper) policy.upperBalanceThresholdPct = Math.round(solved.upper.balanceFrac * 10_000) / 100
```

Each surface branches on whether each percent is defined. Inputs: the plan's persisted percents (`model/plan.ts:2231-2234`) and `startingInvestableOf(plan)` (`riskBasedGuardrails.ts:126-132`). The solver's own dollars, `RiskBasedThreshold.balanceDollars = balanceFrac × startingInvestable` (`:243`), are read by nothing in planner-ui, RetireGolden-Pro (`ed08803`) or RetireGolden-MCP (`3197d35`).

## What the ledger acts on

`projection/internal/annualGuardrailFunding.ts:79-100`: each year the start-of-year portfolio is the sum of the start-of-year balances of every cash, taxable, equityComp, traditional, Roth and HSA row (`simulate.ts:549-567, 1360`), deflated by the year's inflation factor; the anchor `startingRealPortfolio` is that real value in the first year it is positive; `spending/guardrails.ts:132-145` cuts when the real balance is below `(lowerPct / 100) × anchor` and raises above `(upperPct / 100) × anchor`, holding when the pair is inverted.

In the first projection year the inflation factor is exactly 1 (`factorFrom` returns 1 when `toYear <= fromYear`, `simulate.ts:522-523`), and the balances are the entered ones summed in plan order, which is `startingInvestableOf`'s loop. So whenever today's investable balance is positive, the ledger's anchor is `startingInvestableOf(plan)` to the bit, and the UI's product already equals the dollars that act. Checked in the scratch copy with the anchor recorded by an instrumented copy of the ledger: 29 of 29 examples (switched to risk-based guardrails) anchor in 2026 on exactly `startingInvestableOf(plan)` (Object.is). Behaviourally, without instrumentation: with `upperBalanceThresholdPct` 400, a lower threshold of 100.01% cuts in 2026 and 99.99% holds, on all 29.

That corrects the R3 evidence (see the README): edits to balances after a solve move the display and the acting thresholds together, since the ledger reads the persisted percent and the edited plan's own year-one portfolio. What an edit leaves stale is the solver's in-memory `balanceDollars` and the percent's meaning (it was solved for the old balances). The display differs from what acts in one state only: today's investable balance is zero while percents are persisted (reachable by zeroing the balances after a solve, or by an imported plan; a solve itself cannot persist percents at a zero balance, because scaling zero balances leaves every probe's success the same, so neither edge has a crossing). Then the UI prints "$0" for both thresholds while the ledger anchors on the first year the portfolio is positive.

## Engine publication

```ts
// engine/src/montecarlo/riskBasedGuardrails.ts
/** Two decimals of a percent: the precision the planner persists a solved threshold at. */
export const BALANCE_THRESHOLD_PCT_DECIMALS = 2
/** The persisted percent for a solved fraction: Math.round(balanceFrac × 10_000) / 100. */
export function balanceThresholdPct(balanceFrac: number): number

export interface RiskBasedThreshold {
  balanceFrac: number          // unchanged: the lattice point (census family risk-based-guardrail-solved-balance-thresholds)
  balancePct: number           // NEW: balanceThresholdPct(balanceFrac), what the planner persists
  successAtThreshold: number   // unchanged
  // balanceDollars: DELETED (no reader; its value never acts; see open question)
}

export type GuardrailThresholdDollars =
  | { readonly status: 'unsolved' }                                         // risk-based, no persisted percent
  | { readonly status: 'anchored'; readonly base: number;                    // base = startingInvestableOf(plan) > 0
      readonly lower: number | null; readonly upper: number | null;         // (pct / 100) × base, null where no percent
      readonly acts: boolean }                                              // false when both exist and lower >= upper (the ledger holds)
  | { readonly status: 'no-starting-portfolio';                             // base = 0: the ledger anchors on the first funded year
      readonly lowerPct: number | null; readonly upperPct: number | null }
/** Null unless plan.expenses.spendingPolicy.mode === 'riskBasedGuardrails'. */
export function guardrailThresholdDollars(plan: Plan): GuardrailThresholdDollars | null
```

- Formula: `lower = (p_L / 100) × B`, `upper = (p_U / 100) × B`, in this association (the ledger's and the UI's; bit-identical).
- Domain: `p_L`, `p_U > 0` (schema), `B ≥ 0`. Units: today's (start-year) dollars; the ledger compares real balances. Timing: from the plan; the same in every year of every path, because the anchor is fixed in year one. Rounding: the persisted percents are rounded to 0.01 by `balanceThresholdPct`; the dollars are not rounded (the page prints whole dollars).
- `useThresholdSolve.ts:68, 70` write `solved.lower.balancePct` / `solved.upper.balancePct`; the three surfaces switch on `guardrailThresholdDollars(plan)?.status` and print `lower`/`upper`; in the `no-starting-portfolio` state they print a sentence (suggested: "These thresholds were solved for a portfolio this plan no longer has. They act at X% and Y% of the portfolio in the first year it has a balance; re-solve after adding balances.") instead of "$0".

Old versus corrected, worked (case C below): a plan with persisted 80% / 150% and every investable balance set to zero; the UI prints "cut below $0 · raise above $0"; the ledger (early-career-match with its investable balances zeroed, scratch run) first sees a positive start-of-year portfolio in 2027, $12,584.4941 at an inflation factor of 1.025, so its anchor is $12,277.555219512196 of real 2026 dollars and it acts at $9,822.04 and $18,416.33. The engine publishes `{status: 'no-starting-portfolio', lowerPct: 80, upperPct: 150}` and the page stops printing $0. On every plan with a positive balance the printed dollars are unchanged.

## Justification

The ledger rule (the record `balance-risk-guardrail-step`, `rules/calculations/spendingAndWithdrawals.ts:140-182` at `a7f62f1e`, implemented by `nextBalanceGuardrailMultiplier`) is the definition of when a risk-based guardrail acts; the published dollars must be its threshold term. The 0.01% precision is the planner's product rule; R3 moves it into the engine so the solver publishes the value that is persisted. No law governs either.

## Inputs

| Case | Persisted percents | Investable rows (plan order) | Mode |
|---|---|---|---|
| A | from the solver's worked example (below) | one taxable 500,000 | risk-based |
| B | 63.47 / 148.05 | 812,345.67 and 422,222.22 | risk-based |
| C | 80 / 150 | all zero | risk-based |
| D | lower 63.47 only | as B | risk-based |
| E | none | 500,000 | risk-based |
| F | 60 / 60 | 500,000 | risk-based |
| G | 63.47 / 148.05 | as B | fixed target |

Case A's percents come from the solver record `risk-based-guardrail-threshold-solver` (`monteCarlo.ts:1028` at `a7f62f1e`): success `S(f, m) = min(1, f / (2m))`, band 70/95, base 500,000. Ten bisections on `[0.02, 4]` end at lattice indices 356 and 484, whose binary values by the solver's own halving are `1.4036718749999997` and `1.9011718749999997` (exactly `0.02 + k·3.98/1024 = 1.403671875` and `1.901171875`).

## Arithmetic

A. `balanceThresholdPct(1.4036718749999997)`: `× 10⁴ = 14,036.718749999996`, `round → 14,037`, `/ 100 = 140.37`. Upper: `19,011.718749999996 → 19,012 → 190.12`. Dollars: `(140.37 / 100) × 500,000 = 701,850` (binary exactly 701,850, bits `41256b3400000000`); `(190.12 / 100) × 500,000 = 950,600`. The deleted `balanceDollars` was `701,835.9374999999` and `950,585.9374999999`, each $14.0625 below (`(1.4037 − 1.403671875) × 500,000`; both lattice points share the fractional part because `128 × 3.98/1024 = 0.4975` exactly).

B. `B = 0 + 812,345.67 + 422,222.22 = 1,234,567.8900000001` (binary). `(63.47 / 100) × B = 783,580.2397830001`; `(148.05 / 100) × B = 1,827,777.7611450003`. Printed "$783,580" and "$1,827,778".

C. `B = 0`: status `no-starting-portfolio`, percents 80 and 150, no dollars.

D. lower `783,580.2397830001`, upper `null`, `acts: true`.

E. status `unsolved`. F. `lower = upper = 300,000`, `acts: false` (the ledger holds every year: `lower >= upper`, `guardrails.ts:135-137`). G. `null`.

Lattice ties (for the record's limits). `balanceFrac × 10⁴ = 200 + k × 38.8671875` is exactly a half at 8 of the 1,024 lattice points (`k = 64, 192, …, 960`). The float value the solver reaches decides those: through the real solver and its test seam, `k = 192, 448, 704` land a hair below the half (`0.7662499999999999`, `1.7612499999999998`, `2.7562499999999996`) and persist 76.62, 176.12 and 275.62 where rounding the exact value half-up gives 76.63, 176.13 and 275.63; the other five round up. At $1,000,000 that is $100. The engine keeps the float rule (the persisted values must not move), and the record states it.

## Expected

| Case | Result | Tolerance |
|---|---|---|
| A | `balancePct` 140.37 and 190.12; `{status: 'anchored', base: 500000, lower: 701850, upper: 950600, acts: true}` | exact (Object.is) |
| B | `{anchored, base: 1234567.8900000001, lower: 783580.2397830001, upper: 1827777.7611450003, acts: true}` | exact |
| C | `{status: 'no-starting-portfolio', lowerPct: 80, upperPct: 150}` | exact |
| D | `{anchored, base: 1234567.8900000001, lower: 783580.2397830001, upper: null, acts: true}` | exact |
| E | `{status: 'unsolved'}` | — |
| F | `{anchored, base: 500000, lower: 300000, upper: 300000, acts: false}` | exact |
| G | `null` | — |
| ties | `balanceThresholdPct` of the solver's `k = 192` value is 76.62 and of `k = 64` 26.88 | exact |

Ledger pin (engine evidence, behavioural): for a plan with a positive investable balance and `upperBalanceThresholdPct` 400, `simulatePlan(...).years[0].guardrailAction` is `'cut'` at `lowerBalanceThresholdPct` 100.01 and `'hold'` at 99.99, which places the anchor within 0.01% of `guardrailThresholdDollars(plan).base`; the bit equality holds by construction (same rows, same order, factor 1).

## Wrong readings

- The solver's unrounded fraction times the base: $701,836 printed in case A (`701,835.9374999999`), which is not the threshold that acts once the percent is persisted.
- Percent times base without `/ 100`: 70,185,000.
- The other association `(p × B) / 100`: equal on cases A and B, but not the ledger's expression; the parity test pins `(p / 100) × B`.
- A nominal threshold (`× inflationScale` of a later year) or the first retirement year's portfolio: the ledger anchors in its first year with a positive portfolio and compares real balances.
- Year one's ending `investableTotal` (after a year of flows) instead of its start.
- "$0" in case C (today's UI).

## Parity test for the switch-over

- `planner-ui/src/planner/guardrailThresholds.parity.test.tsx` (jsdom): for each of the 29 examples switched to risk-based guardrails with persisted 80/150 (and case B's constructed plan), the Results callout, the Monte Carlo hint and the Spending card callout print `fmtMoney(lower)` and `fmtMoney(upper)` from `guardrailThresholdDollars(plan)`, identical to the retired `(pct / 100) * startingInvestableOf(plan)` bit for bit; for case C all three print the sentence, not "$0"; for case E the "not solved yet" text as today.
- `planner-ui/src/planner/sections/useThresholdSolve.parity.test.ts`: with the solver's `successProbe` seam (case A), the persisted percents equal `Math.round(balanceFrac * 10_000) / 100` (140.37, 190.12) and equal `solved.lower.balancePct`.
- Acceptance grep: no `BalanceThresholdPct / 100` and no `balanceFrac * 10_000` in planner-ui.

## Proposed calculation record

- New: id `guardrail-threshold-dollars`, group `spending-and-withdrawals`, kind `composition`, outputs `['display-guardrail-balance-thresholds']`. Statement: "montecarlo/riskBasedGuardrails.ts#guardrailThresholdDollars publishes, for a risk-based guardrail policy with persisted percents p_L and p_U, (p_L / 100) × B and (p_U / 100) × B, where B = startingInvestableOf(plan) is the ledger's year-one real portfolio; status 'no-starting-portfolio' with the percents when B = 0, since the ledger then anchors on the first funded year; 'unsolved' with no percent; acts = false when both exist and lower >= upper. Units: today's dollars. Rounding: the percents carry two decimals (balanceThresholdPct); the dollars none." Justification: derivation, `DOCS/calculations/spending-and-withdrawals/display-guardrail-balance-thresholds.md`. Limits: "The anchor equals B only because the ledger's first year has inflation factor 1 and sums the same rows in the same order; an evidence case pins the ledger's first-year action on either side of B. At a zero starting balance the ledger's anchor is known only by simulating; no dollars are published. The percents were solved for the balances at solve time; after a balance edit they still act (as percents of the new balance) until re-solved." implementedByFunctions `packages/engine/src/montecarlo/riskBasedGuardrails.ts#guardrailThresholdDollars`, `#balanceThresholdPct`.
- Restate `risk-based-guardrail-threshold-solver` (`monteCarlo.ts:1028-1064` at `a7f62f1e`): the statement's `balanceDollars = hi · starting investable` and its "$701,835.9375 and $950,585.9375" become `balancePct = round(hi · 10⁴) / 100`, 140.37 and 190.12; the last limit (planner persists two decimals; printed dollars can differ from balanceDollars) becomes the lattice-tie limit above.
- Restate `balance-risk-guardrail-step` (`spendingAndWithdrawals.ts:140-182`): its limit at :171 "the results-page callout re-derives the dollar thresholds ... in planner-ui and never calls this function" is replaced by `display-guardrail-balance-thresholds` in its `feeds`.
- `risk-based-starting-investable` keeps `display-guardrail-balance-thresholds` in `feeds`.
- Doc comments: `SpendingPolicy.lowerBalanceThresholdPct` / `upperBalanceThresholdPct` (`model/plan.ts:2231-2234`) say "the ledger's year-one real portfolio (today's investable balances), two decimals" (recon "contracts missing" item 13); `startingInvestableOf` gains a doc comment (item 14).

## Census bookkeeping

Convention (RetireGolden #747 at `093ae4b6`, Docs `3b5f835`): a relocated family's `uiSources` name the UI symbols that now read the engine value, the retired computing symbol moves to `notes` as history, and a conformance test fails on a `uiSources` entry that names a missing file or symbol.

- `display-guardrail-balance-thresholds`: `relocation: { status: 'done', target: 'engine/src/montecarlo/riskBasedGuardrails.ts#guardrailThresholdDollars' }`; `uiSources` unchanged (`ResultsPage.tsx#ResultsPage`, `MonteCarloPage.tsx#MonteCarloPage` and `sections/SpendingPolicyRiskBased.tsx#RiskBasedThresholdsCallout` are the readers); notes gain "Computed in those three symbols ((pct / 100) × startingInvestableOf(plan)) until B2-P1 slice 2; now engine engine/src/montecarlo/riskBasedGuardrails.ts#guardrailThresholdDollars, which they read."; basis `real` (it is `nominal` in the census today; the figures are start-year dollars, and the callouts say "today's dollars"); transformations "(persisted percent / 100) × startingInvestableOf(plan), the ledger's year-one anchor, in montecarlo/riskBasedGuardrails.ts (R3)."; notes rewritten: the rounding is published by the solver as balancePct; the printed dollars are the thresholds the ledger acts on; after a balance edit they move with the balances until re-solved.
- `risk-based-guardrail-solved-balance-thresholds`: transformations "The solver publishes balancePct = round(balanceFrac × 10⁴) / 100, which useThresholdSolve persists; guardrailThresholdDollars prints it in dollars."
- Field coverage: delete `RiskBasedThreshold.balanceDollars`; add `RiskBasedThreshold.balancePct` (family `risk-based-guardrail-solved-balance-thresholds`) and `GuardrailThresholdDollars.base`, `.lower`, `.upper` (family `display-guardrail-balance-thresholds`), `.lowerPct`, `.upperPct` (same family: printed in the zero-balance sentence), `.acts` and `.status` (`excluded`, `boolean-flag` / `label-or-category`).
- CHANGELOG (engine): `RiskBasedThreshold.balanceDollars` removed in favour of `balancePct` and `guardrailThresholdDollars`.

## Family

outputs: `display-guardrail-balance-thresholds`.

feeds: none. Reads `risk-based-guardrail-solved-balance-thresholds` (through the persisted percent) and the starting investable.

## Provenance

Derived by: claude (opus 5.5), 2026-09-26; cases A to G by hand and `scripts/independent.mjs`, the lattice ties by `scripts/lattice-ties.mjs` (no engine import); the anchor, the zero-balance case and the tie values confirmed afterwards in the scratch copy (`scripts/engine-guardrail-anchor.json`, `engine-anchor-behaviour.json`, `engine-guardrail-solver.json`, `engine-lattice-ties.json`). Checked by: a separate Claude (Opus 5.5) instance that did not derive it, which recomputed every value with its own scripts and ran the engine where a claim was numeric (RetireGolden-Docs `calculations/bidirectional-validation-plan-2026-09-13/evidence/b2p1-slice2-check.md`): every expected value reproduces; its corrections are applied in the implementation section. Reviewed by: pending; the catalog asks for a reviewer of a different agent family, so the record is `unreviewed`.

Reviewed by: Codex (GPT-6-Sol), 2026-09-29, `DOCS/calculations/reviews/REVIEW-2026-09-29-codex-5-medicare-spending.md`.

## Implementation (B2-P1 slice 2, 2026-09-27)

- **Correction 8:** `balanceThresholdPct` computes from `BALANCE_THRESHOLD_PCT_DECIMALS` (`10 ** 2 = 100` exactly, so the product is `balanceFrac × 10000`, bit-identical to the retired expression); the zero-balance sentence the pages print says only what is true of any plan: the percents apply to the portfolio in the first year it has a balance, and there is no dollar figure to show. After the review of #752 each page says where that year is for what it shows: Results, the first year the projection gives the portfolio a balance; Monte Carlo, the first year each simulated path does; and the Spending card, which configures both, names the two.
- **Open question 8:** `acts` is computed from the dollar products, as the ledger compares them.
- The ledger pin runs a cash-only plan (base $500,000, required spending $20,000 under a $40,000 base, raise threshold 400 percent): the first year cuts at 100.01 percent and holds at 99.99.
- The lattice ties are reproduced through the solver's seam with a step curve crossing just below each lattice point (0.76624 for k = 192, 0.2687 for k = 64).
- Re-measured: the 29 examples switched to risk-based guardrails at 80 and 150 percent print the same dollars as before, bit for bit (29 of 29 anchored).
- **Case H, the association** (added after the independent review, whose mutants swapping the order survived): 50.03 and 150.02 percent of $500,000 in binary64 are `(50.03 / 100) × 500,000` = 250,149.99999999997 and `(150.02 / 100) × 500,000` = 750,100.0000000001, where multiplying first gives 250,150 and 750,100 (the implementer's script, in the stated order).
