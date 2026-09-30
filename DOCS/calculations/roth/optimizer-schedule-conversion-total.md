## Claim

Kind: formula. `engine/src/strategies/conversionScheduleTotal.ts#conversionScheduleTotal(conversions)` (a leaf module, re-exported by `strategies/optimizer.ts`) (record `conversion-schedule-total`) is the one sum of a conversion schedule: the left-to-right total of its `amount`s from 0, in the schedule's nominal dollars. The engine publishes it where each schedule is made (`OptimizedSchedule.conversionTotal` on the raw and the cleaned schedule, `ExactLedgerTournament.winnerConversionTotal`), reads it in its own cleaned-schedule gates, and uses it for its own requested total (`decisions/evaluateCandidate.ts#buildConversionExecution`); every planner surface that prints a schedule total reads one of these. The move is verbatim except in one state, where the page labelled an empty list as the cleaned schedule (P2, below).

## What the UI computed before B2-P1 slice 3

Seven copies at RetireGolden `4a80669e` (the census named the first two; the recon check found the next two; the derivation found the last):

| Where | Expression | Printed as |
|---|---|---|
| `planner/OptimizePage.tsx:111-113` `totalScheduleConversions` | `schedule?.conversions.reduce((a, c) => a + c.amount, 0) ?? 0` over the raw solver schedule (`:374`) | "Raw optimizer request: $X." (`:781`); gate `rawConversions < 1` for "No beneficial conversions found" (`:717`) |
| `planner/OptimizePage.tsx:373` | `displayedConversions.reduce(...)` over `displayedCleanedConversions(tournament, postProcessed)` | "$X of conversions across N year(s)." (`:745`); "Cleaned executable schedule: $X." (`:782`) |
| `planner/OptimizePage.tsx:677` | `tournament.winnerConversions.reduce(...)` | incumbent card "Your current schedule ($X of conversions across N years)" |
| `planner/optimizePageChart.ts:34-37` | `postProcessed.cleanedSchedule.conversions.reduce(...)` | gate: an identity-withheld cleaned schedule is displayed only when its total ≥ `minimumRequestedConversionDollars` |
| `planner/optimizePagePromotion.ts:168-172` `scheduleConversionTotal` | the same reduce | `retirementActionPromotionPanels.tsx:169-170`: the repriced-promotion note's named and aggregate totals |
| `planner/sections/StrategySection.tsx:169` | `rc.conversions.reduce(...)` over the plan's installed optimized schedule | "This N-year schedule ($X total) was produced by the Optimize tab" |
| `planner/assumptionsExport.ts:282` | `rc.conversions.reduce((s, c) => s + c.amount, 0)` | assumptions export "optimized schedule (N years, $X total)" |

The engine computed the same reduce for the requested total (`decisions/evaluateCandidate.ts:658`), published as `ExactLedgerValidation.requestedConversionTotal`, and three more times for the cleaned schedule in its own gates (`projection/optimizePlan.ts:982-985`, `:1021-1024` and `:2553`, the identity-withheld and minimum-request gates the page's chart gate duplicates; check correction 5). Inputs: `OptimizedSchedule.conversions` (amounts rounded to cents, only years above $0.50), `ExactLedgerTournament.winnerConversions`, the cleaned schedule (`scheduleWithConversions`), a promotion's `aggregateConversions` and the plan's `strategies.rothConversion.conversions`. All nominal dollars of their years; the total is an undiscounted sum across years.

## Engine publication

```ts
// engine/src/strategies/conversionScheduleTotal.ts (a leaf module, so a page that prints a total does not load the optimizer)
/** Σ amount, left to right from 0 (the order every existing copy used). Refuses a non-finite amount (RangeError). Nominal dollars. */
export function conversionScheduleTotal(conversions: readonly { readonly amount: number }[]): number
// engine/src/strategies/optimizer.ts
export interface OptimizedSchedule {
  ...
  /** conversionScheduleTotal(conversions): set by optimizeSchedule and recomputed by projection/optimizePlan.ts#scheduleWithConversions, never carried over from another schedule. */
  conversionTotal: number
}
// engine/src/projection/optimizePlan.ts
export interface ExactLedgerTournament { ...; /** conversionScheduleTotal(winnerConversions) */ winnerConversionTotal: number }
// finalizedTournament(draft) attaches it; every tournament the module builds passes through it
// the cleaned-schedule gates (calculatedPostProcessedSchedule, policyRankablePostProcessedSchedule, postProcessExactLedgerSchedule) read cleanedSchedule.conversionTotal
// decisions/evaluateCandidate.ts#buildConversionExecution: requestedTotal = conversionScheduleTotal(requested)
```

- `optimizeSchedule` sets `conversionTotal` from the array it builds whatever the solve status, so the raw total exists on an infeasible or timed-out solve too (the recon check's concern that `postProcessed` is null there: the page reads `schedule.conversionTotal`, not `rawValidation`).
- `scheduleWithConversions` spreads the raw schedule (`...schedule`) and replaces `conversions`; it recomputes `conversionTotal`, or the cleaned schedule would carry the raw total silently. The same spread still carries the raw solve's `endingAfterTax` and `lifetimeTax`, which describe the raw schedule; nothing reads them from a cleaned schedule, and the field comments and the record say so.
- `winnerConversionTotal` is set by one finalizer, `finalizedTournament`, through which all seven tournament literals of the module pass (the check counted nine places that write `winnerConversions`; two of them pass a list on to the search and the readiness check rather than build a tournament). A test asserts `winnerConversionTotal === conversionScheduleTotal(winnerConversions)`.
- The page reads: raw `schedule.conversionTotal`; cleaned `postProcessed.cleanedSchedule.conversionTotal`; incumbent `tournament.winnerConversionTotal`; for the displayed list it calls `conversionScheduleTotal(displayedConversions)` (the choice of list stays a UI selection); the promotion note, the Strategy callout, the chart gate and the assumptions export call `conversionScheduleTotal` or read the published field. `totalScheduleConversions` and `scheduleConversionTotal` are deleted.

## Justification

A schedule total is a plain sum; there is nothing to derive but the convention, which must be one: the same operands in the same order give the same double (IEEE 754 addition is not associative: case V). Every copy reduced left to right from 0, so one engine helper with that order reproduces all of them bit for bit, including the engine's requested total, which already equalled the page's raw total whenever both existed (15 of 15 examples with a post-processed schedule). The published fields are for RetireGolden-MCP and RetireGolden-Pro, which pass `schedule` and `tournament` through and would otherwise have to add the amounts themselves.

## Inputs

| Case | Conversions (nominal $) |
|---|---|
| U | 10,000.25, 20,000.50, 30,000.75 |
| V | 0.1, 0.2, 0.3 |
| W | none |
| X | 48,123.46, 51,234.57, 0.51 (a solve whose columns are 48,123.456, 51,234.567 and 0.51) |
| Y | an infeasible solve whose schedule has no conversion above $0.50 |
| Z | a raw request of 15,000 and 15,000 that a $20,000 traditional balance executes as 15,000 and 5,000 |

## Arithmetic

U: 10,000.25 + 20,000.5 = 30,000.75; + 30,000.75 = 60,001.5 (every partial sum exact in binary). V: (0.1 + 0.2) + 0.3 = 0.6000000000000001 (bits `3fe3333333333334`); the other association 0.1 + (0.2 + 0.3) = 0.6: the helper fixes left to right. W: 0. X: 99,358.54, printed "$99,359"; the solve rounds each column to cents and keeps years above $0.50. Y: 0, so the page's `< 1` gate holds. Z: raw total 30,000; cleaned total 15,000 + 5,000 = 20,000 (the spread would have carried 30,000); the cleaned validation's requested total is the same 20,000.

## Expected

| Case | conversionScheduleTotal | printed |
|---|---:|---|
| U | 60,001.5 | "$60,002" |
| V | 0.6000000000000001 | "$1" |
| W | 0 | "$0" |
| X | 99,358.54 | "$99,359" |
| Y | 0 | "No beneficial conversions found" card, unless the status says the solve did not finish (P3) |
| Z | raw 30,000; cleaned 20,000 | "Cleaned executable schedule: $20,000" |

Tolerance exact (`{ abs: 0 }`); a non-finite amount throws a `RangeError`.

Example library (scratch run at `4a80669e`, every example as the app opens it, objective max-after-tax-estate, claim co-optimization off, start 2026; re-measured at `cb72713e`, after main's #753 gave the bracket-fill household's second spouse a Roth IRA, which moved only bracket-fill-roth's row, shown here at `cb72713e`). Raw total (entries), cleaned total, displayed total and the tournament winner's total; every one equals the retired reduce bit for bit, the raw total equals `rawValidation.requestedConversionTotal` on all 15 examples that post-process (and the cleaned total `cleanedValidation.requestedConversionTotal`), no schedule has a zero-amount entry, and no infeasible or timed-out solve has a raw conversion:

| Example | Status | Winner | Raw | Cleaned | Displayed | Winner |
|---|---|---|---|---|---|---|
| example-couple | optimal | incumbent | $748,825 (20) | $243,337 | $0 | $1,017,094 (8) |
| bracket-fill-roth | optimal | incumbent | $666,168 (14) | $666,168 | $711,833 (9, withheld) | $808,048 (5) |
| early-retiree-aca | optimal | incumbent | $183,708 (13) | $183,708 | $0 | $59,662 (5) |
| rmd-irmaa | timeout | none | $0 | — | $0 | $0 |
| early-career-match | optimal | none | $1,654,144 (31) | $1,654,144 | $0 | $0 |
| aggressive-saver | optimal | none | $4,565,229 (51) | $4,565,229 | $0 | $0 |
| coast-fire | optimal | none | $1,040,093 (7) | $1,040,093 | $0 | $0 |
| barista-fire | optimal | none | $3,310,883 (44) | $1,025,820 | $401,417 (9, withheld) | $0 |
| bridge-early-retirement | optimal | none | $1,184,611 (34) | $1,135,975 | $0 | $0 |
| lean-fat-fire | optimal | none | $3,113,031 (51) | $3,113,031 | $0 | $0 |
| annuity-purchases-estate | optimal | incumbent | $1,010,771 (15) | $1,010,771 | $1,067,436 (3, withheld) | $857,968 (2) |
| glidepath-allocation | optimal | incumbent | $1,149,555 (28) | $684,051 | $156,698 (7, withheld) | $765,933 (7) |
| hsa-property-depth | infeasible | incumbent | $0 | — | $0 | $184,163 (1) |
| no-annuity-brokerage | optimal | incumbent | $1,430,974 (24) | $1,430,974 | $1,094,846 (13, withheld) | $1,230,831 (3) |
| static-allocation-control | optimal | incumbent | $1,258,410 (28) | $680,159 | $176,940 (6, withheld) | $759,850 (6) |
| no-head-start-grad | optimal | none | $1,516,996 (33) | $1,516,996 | $0 | $0 |
| trump-account-head-start | optimal | none | $4,127,103 (41) | $4,053,361 | $0 | $0 |

The other twelve examples (under-saved-single, inherited-ira-beneficiary, survivor-years, ltc-shock, guardrails-flex-goals, fixed-target-spending, brokerage-no-hsa, all-401k-no-bridge and brokerage-bridge-401k infeasible; moving-state-tax, hsa-stealth-retirement and salary-growth-escalation optimal with no conversion) have every total $0.

## Problem found: "Cleaned executable schedule: $0" (P2, fixed)

When the tournament recommends nothing (`winnerSource: 'none'`, no readiness veto), `displayedCleanedConversions` returns an empty list, but the execution-mismatch sentence printed its total under the label "Cleaned executable schedule", beside an executed total of the actual cleaned schedule:

- bridge-early-retirement: "Raw optimizer request: $1,184,611. Cleaned executable schedule: $0. Executed after cleaning: $1,135,975 (100%). First raw shortfall: 2055."
- trump-account-head-start: "Raw optimizer request: $4,127,103. Cleaned executable schedule: $0. Executed after cleaning: $4,053,361 (100%). First raw shortfall: 2027."

Rule 2 (a label must be right for its reader): the sentence prints `postProcessed.cleanedSchedule.conversionTotal` ($1,135,975 and $4,053,361). In every other state where the sentence shows, the displayed list is the cleaned schedule, so the two readings agree.

The hero above that sentence told the same two readers, and five others (early-career-match, aggressive-saver, coast-fire, lean-fat-fire, no-head-start-grad), "The optimizer proposed converting $X, but only $X could actually be converted. The traditional balance it counted on is not available in the plan years shown", with equal amounts: requested equals executed and no year is materially unexecuted; the schedule is held back because the marketplace (ACA) credit is not priced in some years (check correction 8). The hero now names the cause the result carries: a schedule with no materially unexecuted year reads "This conversion schedule is shown as a diagnostic." and "Your full projection converts all $X requested, but the marketplace (ACA) premium tax credit isn't priced in some of the plan's years, and conversion income changes that credit, so the schedule is shown as a diagnostic, not a recommendation. The ACA note below names the years." (or, for incomplete tax years, names those years; otherwise says the schedule cannot be applied as it stands). A real shortfall keeps the old sentence.

## Problem found: a timed-out solve read as "no beneficial conversions" (P3, fixed)

The `rawConversions < 1` gate showed "No beneficial conversions found … often because there is little pre-tax balance to convert, or the current strategy already captures the opportunity" whenever the raw schedule was empty, including when HiGHS stopped at its 10-second limit (`status: 'timeout'`). rmd-irmaa timed out in every run on the deriver's and the checker's machines; the page told its reader the plan had nothing to gain, which the solver did not establish. The time limit is machine-dependent, so the count is not a property of the plan. Rule 4 (nothing silent): whenever `schedule.status === 'timeout'` the page says so (check correction 7, since a timed-out solve can still carry an incumbent schedule): with an empty schedule the card is headed "The optimizer ran out of time" and says only the simple strategies were compared on the full projection, so the result does not show that no conversion helps; with a schedule, the hero and the incumbent card say the solver's schedule is the best it had found by then, not a proven best.

## Wrong readings

- Summing the displayed list for the cleaned-schedule label (before): $0 on the two examples above.
- Taking the cleaned schedule's `rawValidation.requestedConversionTotal` for the raw total: absent when `postProcessed` is null (infeasible, timed out or empty solves), where the page needs 0.
- Copying `conversionTotal` through `scheduleWithConversions`' spread: the cleaned schedule would publish the raw total (bridge-early-retirement: $1,184,611 for a $1,135,975 schedule; case Z: 30,000 for 20,000).
- Right-to-left or pairwise summation: case V's last bit.

## Limits

- The total adds nominal dollars of different years; the Optimize page's schedule chart says "nominal dollars", the hero and the Strategy callout do not.
- A total says nothing about which years carry it; the page prints the count of entries beside it (every raw entry is above $0.50 by construction).
- A cleaned schedule carries the raw solve's `endingAfterTax` and `lifetimeTax`, which describe the raw schedule; nothing reads them from a cleaned schedule.

## Parity test for the switch-over

`planner-ui/src/planner/OptimizePage.conversionTotals.parity.test.ts`: on the examples (optimizer through `runOptimizeRequest`), the raw, cleaned, displayed and winner totals equal the retired reduces under `Object.is`; the mismatch sentence on bridge-early-retirement and trump-account-head-start reads the cleaned total; the seven held-back heroes no longer claim a shortfall; the Strategy callout, the assumptions export and the promotion note read the helper. Engine evidence: `strategies/optimizer.conversionTotal.evidence.test.ts` (cases U to Z and the tournament total). Acceptance grep: no `conversions.reduce` or `amount, 0)` in planner-ui.

## Calculation record

`conversion-schedule-total` (`rules/calculations/roth.ts`), kind `formula`, outputs `['optimizer-schedule-conversion-total']`, feeds `['exact-ledger-validation-requested-conversion-total']`, pins `conversionScheduleTotal.ts#conversionScheduleTotal`, `optimizer.ts#optimizeSchedule`, `optimizePlan.ts#scheduleWithConversions`, `#finalizedTournament` and `evaluateCandidate.ts#buildConversionExecution`; limits the three above. `exact-ledger-conversion-execution` is restated to name the helper for its requested sum.

## Census bookkeeping

- `relocation: { status: 'done', target: 'engine/src/strategies/conversionScheduleTotal.ts#conversionScheduleTotal' }`; `uiSources` `[OptimizePage.tsx#OptimizePage, sections/StrategySection.tsx#StrategySection, retirementActionPromotionPanels.tsx#PromotedSchedulePanel, assumptionsExport.ts#strategyGroup, optimizePageChart.ts#isCalculatedIdentityWithheldPostProcessing]` (the readers); notes name the retired copies.
- Surfaces added (a D-CENSUS-FREEZE addition: the check's two further copies plus the assumptions export): the incumbent card, the repriced-promotion note, the Strategy callout and the assumptions card's strategy group.
- Field coverage: rows `OptimizedSchedule.conversionTotal` and `ExactLedgerTournament.winnerConversionTotal` (family); the planner-ui rows `OptimizePage.totalConversions` and `.rawConversions` stay (they now read the engine value) with their notes restated.

## Family

outputs: `optimizer-schedule-conversion-total`.

feeds: none. Reads `optimizer-recommended-conversion-annual`.

## Provenance

Derived by: claude (opus 5.5), 2026-09-27; cases U to Y by hand and `scripts/independent.mjs`; the example rows and the two sentences from the scratch run, with the page's branch conditions replicated. Checked by: a separate Claude (Opus 5.5) instance that did not derive it (RetireGolden-Docs `calculations/bidirectional-validation-plan-2026-09-13/evidence/b2p1-slice3-check.md`): every case and table figure reproduces; its corrections 5 to 8 are applied above. Reviewed by: pending; the catalog asks for a reviewer of a different agent family, so the record is `unreviewed`.

Reviewed by: Codex (GPT-6-Sol), 2026-09-29, `DOCS/calculations/reviews/REVIEW-2026-09-29-codex-2-cash-flow.md`.

## Implementation (B2-P1 slice 3, 2026-09-27)

- **Correction 5**: the engine's three cleaned-total copies read `cleanedSchedule.conversionTotal`.
- **Correction 6**: one finalizer; tsc found seven tournament literals, all wrapped.
- **Correction 7**: the timeout note shows whenever the status is timeout.
- **Correction 8**: the held-back hero names its cause.
- **Case Z** (added) evidences the recompute in `scheduleWithConversions`; its receipt mutates exactly that line.

## Review fixes (independent review of B2-P1 slice 3, 2026-09-27)

- `conversionScheduleTotal` moved to the leaf module `strategies/conversionScheduleTotal.ts`, re-exported by `strategies/optimizer.ts` (F9). The planner imports the leaf, so the plan routes, the Assumptions card and the decisions chunk no longer load the optimizer's LP builder (an 8.8 kB chunk) for a six-line sum; the app emits a 196-byte chunk for it.
- The engine evidence pins `ExactLedgerTournament.winnerConversionTotal` on a winner with conversions (F6): the plan already converting the raw request ($15,000 and $15,000 against $20,000 of traditional balance) executes $15,000 and $5,000 and holds as the incumbent, and the winner total is 20,000, the worksheet's cleaned total. A finalizer that published 0 fails it.
- The held-back hero (correction 8) reads the engine's aggregate shortfall as well as the per-year one (F3): the engine marks a schedule unexecutable when requested minus executed exceeds max($1,000, 5% of requested) in total, even with no year short by more than its own margin, and such a schedule keeps the shortfall sentence ("only $91,000 could actually be converted" of $100,000 over ten years each executing $9,100 of $10,000, in `OptimizePage.test.tsx`); only a schedule within both margins is "shown as a diagnostic" for another cause.
- The incumbent card no longer says a fresh solver schedule was compared when the solve timed out with none (F8), matching the time-limit note under it (`OptimizePage.conversionTotals.parity.test.tsx`).

- Follow-up review (on 97b9880c): the optimizer runs in the planner's worker, where an engine refusal loses its class, so the failure well printed the engine's message ("Optimizer error: …"). The worker posts a typed refusal as plain data (`workers/refusal.ts`), the runner rebuilds it, and the well says it in plain words with a next step (`planner/engineRefusalCopy.ts#optimizeErrorSentence`: "The optimizer couldn't finish this run: one of the figures it compares could not be computed. Check your plan's inputs and its Results page, then run the optimizer again."); anything else reads "The optimizer couldn't finish this run. Run it again." with the error's own text kept as a labelled detail. `OptimizePage.failureFocus.test.tsx` pins both.
