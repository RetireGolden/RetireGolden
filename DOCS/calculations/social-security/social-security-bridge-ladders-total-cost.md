## Claim

Kind: formula. `engine/src/ladder/bridge.ts#bridgeLaddersTotalCost` adds the quoted `ladderCost` of each bridge it is given, in the order given, from 0, and refuses a cost that is not finite with a RangeError. The Social Security page's bridge panel gives it the bridges its table lists and prints the total on its button, "Add bridge ladder(s) to plan ($X)", through `fmtMoneyCompact`; it computes nothing.

## What the UI computed

`planner-ui/src/planner/SsAnalysisPage.tsx#BridgePanel` at `f97cf418` (line 361):

```tsx
const totalCost = sized.reduce((sum, s) => sum + s.bridge.ladderCost, 0)
```

`sized` is the panel's list: for each claimant from `claimingPeople(plan, startYear)` (the ledger's PIA, entered or from an earnings record), `sizeBridge` on the embedded real yield curve with the plan's start year as the purchase year; a claimant with no bridge (a claim at or before 62, or an empty window) and a bridge whose whole window a plan ladder already covers are left out. The table prints each bridge's `ladderCost` and the button their sum.

## Engine publication

```ts
// engine/src/ladder/bridge.ts
export function bridgeLaddersTotalCost(bridges: readonly Pick<BridgeSizing, 'ladderCost'>[]): number
```

- The reduce as it was: left to right from 0, so the same bridges in the same order give the same double.
- Domain: any list of sized bridges, including none (0; the panel does not render without a bridge). A non-finite cost is refused; `sizeBridge` never quotes one.
- Units: the start year's real dollars, the unit of every quote on the page (one curve, one purchase year). Timing: once per rendering of the panel. Rounding: none; the button prints compactly.
- After the move: `const totalCost = bridgeLaddersTotalCost(sized.map((s) => s.bridge))`.

## Justification

Adding every offered ladder to the plan buys every one of them in the start year, so what the button's action costs is the sum of their quotes, all in the same dollars. The sum is the engine's so the page prints no arithmetic of its own (D-UI-SS), and the order is fixed because floating-point addition is not associative.

## Inputs

| Case | Quoted ladder costs |
|---|---|
| A | 85,000 and 55,216.54 |
| B | 40,814.65 |
| C | none |
| D | 0.1, 0.2 and 0.3 |

## Arithmetic

A. 0 + 85,000 = 85,000; + 55,216.54 = 140,216.54.

B. 40,814.65.

C. 0.

D. (0 + 0.1) + 0.2 = 0.30000000000000004; + 0.3 = 0.6000000000000001 (0.1 + (0.2 + 0.3) = 0.6).

## Expected

| Case | Total |
|---|---:|
| A | 140,216.54 |
| B | 40,814.65 |
| C | 0 |

D: 0.6000000000000001. Tolerance exact.

Example library, each example as the app opens it (2026 start, measured on this branch with the parity test's retired reduce): 23 of the 29 examples offer a bridge, 5 of them two (example-couple $140k, annuity-purchases-estate and no-annuity-brokerage $127k, all-401k-no-bridge and brokerage-bridge-401k $177k); on every one the engine's total is the retired reduce bit for bit and the button prints the same. No example holds a bridge ladder already.

## Wrong readings

- The first bridge only: case A 85,000.
- The average of the bridges: case A 70,108.27.
- The bridges' annual payouts (`annualRealAmount`) added instead of their costs: a year's income, not a price.
- A total that also counts a bridge the plan's own ladder already covers (the panel leaves it out of the table and the total).

## Parity test for the switch-over

`planner-ui/src/planner/freezeAdditions.parity.test.ts`, "Social Security bridge": on the 29 examples, the bridges the panel offers (sized as the panel sizes them) total the retired reduce `Object.is`, and `fmtMoneyCompact` of both is the same. Acceptance grep: no `ladderCost, 0)` reduce in `SsAnalysisPage.tsx`.

## Findings, not changed here

- A bridge whose deterministic ladder id (`bridge-<person>-<startYear>`) is already in the plan, but whose window that ladder no longer covers (a user shortened it), is listed and counted in the total, while the add action skips it so as not to add the id twice; the button then states a cost it does not add. No example reaches it. Recorded as a limit of the record.
- The Insights card that suggests a bridge (`insights/detectors/ssBridgeGap.ts`) prints its own total (`insight-ss-bridge-gap-total`) over the claimants with an entered monthly PIA only, so for a claimant whose PIA comes from an earnings record the two totals differ. Recorded as a limit.

## Calculation record

- id `ss-bridge-ladders-total-cost`, group social-security, kind `formula`, outputs `['social-security-bridge-ladders-total-cost']`; implementedByFunctions `packages/engine/src/ladder/bridge.ts#bridgeLaddersTotalCost`.

## Census bookkeeping

- `social-security-bridge-ladders-total-cost`: `relocation: { status: 'done', target: 'engine/src/ladder/bridge.ts#bridgeLaddersTotalCost' }`; `uiSources` unchanged (`SsAnalysisPage.tsx#BridgePanel`, which now reads it); the retired reduce moves to notes.
- Field coverage: the planner-ui row `BridgePanel.totalCost` stays on the family (the panel's name for the value it now reads).

## Family

outputs: `social-security-bridge-ladders-total-cost`.

feeds: none. Reads `social-security-bridge-sizing`.

## Provenance

Derived by: claude (opus 5.5), 2026-09-30; cases by hand, the library figures from the parity test's measurement run. Implemented by: claude (opus 5.5), same day. Reviewed by: unreviewed; the catalog asks for a reviewer of a different agent family.

Reviewed by: Codex (GPT-6-Sol), 2026-09-30, `DOCS/calculations/reviews/REVIEW-2026-09-30-round3-codex.md`.
