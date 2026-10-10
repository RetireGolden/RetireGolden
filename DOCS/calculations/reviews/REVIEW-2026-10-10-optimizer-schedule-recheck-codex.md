# Review, 2026-10-10 (optimizer-schedule-recheck-codex)

Reviewer: Codex (GPT-6-Sol), headless and read-only, without executing the engine, on snapshots of RetireGolden branch `claude/census-optimizer-schedule` taken while RetireGolden#792's first automated review was answered, with RetireGolden-MCP at `b2c7f717` (paths under `mcp/` are RetireGolden-MCP's). The work was done by Claude (Opus). Scope: the sentences that answer added to the records `optimizer-schedule-objective-and-lifetime-tax` and `optimizer-schedule-year-solution`, their worksheets and the evidence file, after Codex had approved both records (`REVIEW-2026-10-10-optimizer-schedule-codex.md`). Each snapshot held a file the report names: `ROUND1.diff`, the change since the pull request's first head `079c723a`; `PRIOR-RECHECK.md`, the previous round's report below; and `ITEM4.diff`, the last rewording alone.

Verdicts, in three rounds:
1. Items 1, 2, 3 and 5 approved. Item 4, the solver-coupling sentence, was rejected: it claimed more than the assertions show, and the record stated two library figures the evidence did not pin.
2. Both figures, and the two written weights, were pinned. Item 4 was rejected again: a figure the evidence does not round can move more than half a cent between runs and still pass.
3. The sentence was reworded to the guarantee Codex named: a figure more than half a cent from the stated value fails. Approved.

The commit that carries this file holds the approved wording. The reports below are verbatim.

---

## Round 1

# ROUND1 calculation-record re-check

Read-only review of the added wording in `ROUND1.diff`. No tests were run.

## 1. Time limit with no incumbent — approve

`optimizeSchedule` reads a numeric `ObjectiveValue` or substitutes 0, maps `Time limit reached` and `Iteration limit reached` to `timeout`, and substitutes 0 for a missing column or a column without a numeric `Primal` (`packages/engine/src/strategies/optimizer.ts:1116-1145`). With no column values, every result amount and the tier read as 0, and the tax components on zero income, zero gain and tier 0 sum to 0 (`optimizer.ts:1153-1195,1207-1237`). The returned objective is rounded independently of the status (`optimizer.ts:1192-1204`). A zero-valued readout can therefore also resemble a solved readout; `status` carries the distinction. The code does not separately inspect an incumbent flag; the zero-year statement applies when HiGHS supplies no numeric column primals.

## 2. Qualified charitable distribution — approve

The `rmd-irmaa` example sets `qcdAnnual: 15_000` (`packages/planner-ui/src/planner/examples/buildRmdIrmaa.ts:8-13`), while the hand inputs omit both forced-distribution fields (`packages/engine/src/strategies/optimizer.schedule.evidence.test.ts:31-51,66-77,120-132`). The plan probe calculates the includible-income exclusion and the gross RMD cash diversion, then publishes both (`packages/engine/src/projection/internal/annualOptimizerProbePublication.ts:201-222,362-365`). `buildOptimizerInput` passes them into each year (`packages/engine/src/projection/optimizePlan.ts:629-642`); the model subtracts the exclusion from `ordinaryBase` and adds the diversion to the cash requirement (`optimizer.ts:763-780,922-936`). Those changes affect the one-year model's tax and funding equations, so the stated omission and effect are consistent with the code.

## 3. Lifetime-tax justification — approve

The cash constraint subtracts the federal bracket segments, flat and bracket state tax, and IRMAA surcharge terms (`packages/engine/src/strategies/optimizer.ts:892-911`). A taxable sale enters that constraint at `1 - ltcgRate * gainFraction` per dollar (`optimizer.ts:601-620,909-910`). The published `lifetimeTax` adds federal tax, both state terms, tier surcharges and realized gain times the LTCG rate, using the read-out and rounded year fields (`optimizer.ts:1147-1173,1192-1195`). This supports the new sentence.

## 4. Solver coupling and evidence — reject

The worked cases compare the objective and lifetime tax, all twelve published fields in each year, and conversions against worksheet values with `abs: 0.005` (`packages/engine/src/strategies/optimizer.schedule.evidence.test.ts:135-205,309-358`; `packages/engine/src/rules/describeCalculation.ts:37-41`). The library example newly compares four amounts using that same tolerance (`optimizer.schedule.evidence.test.ts:318-325,416-430`). These checks catch a changed **published cent** in the compared values. They do not prove that *any* change to the optimal solution or to digits HiGHS prints fails: a changed digit can leave rounded output within tolerance, and an alternative solution can leave the compared outputs equal. More materially, the record prints the nominal projection estate of $470,194.82 and the 24-year-deflated estate of $259,959.13 (`packages/engine/src/rules/calculations/optimizerAndComparisons.ts:778`; `DOCS/calculations/optimizer-and-comparisons/optimizer-schedule-objective-and-lifetime-tax.md:73`), but neither is among the four pinned amounts. The categorical upgrade and staleness guarantees in the added wording (`optimizerAndComparisons.ts:778,781,830`) exceed the assertions.

## 5. Other changed statements — approve

I found no further contradiction in `ROUND1.diff`. The revised case labels and QCD qualification match the hand input (`packages/engine/src/strategies/optimizer.schedule.evidence.test.ts:31-51,66-92`), and the added provenance points to the existing independent review (`DOCS/calculations/reviews/REVIEW-2026-10-10-optimizer-schedule-codex.md:1-7`). The solver-coupling overclaim is recorded under item 4.

**Overall verdict: reject**, solely for item 4.

---

## Round 2

# ROUND1 calculation-record re-check

Read-only review of `ROUND1.diff` against this snapshot. No tests were run.

## Item 1 - Time limit with no incumbent: approve

`optimizeSchedule` maps a time limit to `timeout`, substitutes 0 for a missing objective and missing numeric column primals, rounds the objective independently, and builds zero-valued years and tax when there are no column values (`packages/engine/src/strategies/optimizer.ts:1116-1145,1153-1195,1203-1204`). The new qualification about a stopped solve with no incumbent matches that readout; status distinguishes it from an otherwise identical solved readout (`packages/engine/src/rules/calculations/optimizerAndComparisons.ts:782`).

## Item 2 - Qualified charitable distribution: approve

The hand inputs omit the example's QCD, while the plan probe publishes its ordinary-income exclusion and cash diversion (`packages/engine/src/strategies/optimizer.schedule.evidence.test.ts:31-132`; `packages/engine/src/projection/internal/annualOptimizerProbePublication.ts:201-222,362-365`). The model subtracts the former from the ordinary base and adds the latter to required cash (`packages/engine/src/strategies/optimizer.ts:763-780,922-936`). The revised qualification in the record and worksheets is supported.

## Item 3 - Lifetime-tax justification: approve

The cash constraint includes federal and state tax and IRMAA, and nets the gain tax from a taxable sale (`packages/engine/src/strategies/optimizer.ts:895-911`). The published `lifetimeTax` adds federal tax, state tax, IRMAA and realized-gain tax from the published year values (`packages/engine/src/strategies/optimizer.ts:1156-1173,1192-1195`). This supports the added justification.

## Item 4 - Solver coupling and measured library figures: reject

The six stated library dollars now have six corresponding expected values and six `withinTolerance` assertions (`packages/engine/src/strategies/optimizer.schedule.evidence.test.ts:318-329,423-441`). The two written weights are checked exactly (`optimizer.schedule.evidence.test.ts:386-391`). The worksheet's $8,923.62 and $69,843.09 gaps are the differences of the pinned *expected* figures; the code directly checks only that the actual gaps exceed $1,000 (`optimizer.schedule.evidence.test.ts:414-421`). There is no direct cent-level assertion for either actual gap. The statement that the evidence pins all six dollar figures to half a cent is accurate as a comparison with their recorded expected values (`packages/engine/src/rules/describeCalculation.ts:37-41`).

The revised coupling sentence still promises more than the assertions establish where it covers the library comparison. `withinTolerance` accepts any actual value within **inclusive** $0.005 of the recorded expected value, rather than comparing a new value with the previous actual value (`describeCalculation.ts:37-41`). The library's today-dollar estate is calculated by division without rounding, and its solver-deflated estate by multiplication without rounding (`optimizer.schedule.evidence.test.ts:386,411-413,431-440`). For example, with expected $266,458.11, actual values $266,458.106 and $266,458.112 both pass, although the second moved $0.006 from the first. Thus an upgrade can move a compared subcent figure by more than half a cent and still pass. This contradicts the unconditional upgrade claim in the totals record (`packages/engine/src/rules/calculations/optimizerAndComparisons.ts:778,781`) and the objective worksheet's library paragraph (`DOCS/calculations/optimizer-and-comparisons/optimizer-schedule-objective-and-lifetime-tax.md:77`). The corresponding statements about the cent-rounded hand-case totals and year fields are supported by their assertions (`optimizerAndComparisons.ts:830`; `optimizer-schedule-objective-and-lifetime-tax.md:56`; `DOCS/calculations/optimizer-and-comparisons/optimizer-schedule-year-solution.md:87`; `optimizer.schedule.evidence.test.ts:177-205,336-364`).

The defensible guarantee is that an actual figure **more than $0.005 from its fixture expectation** fails. The two gaps can differ from the differences of the six expected values by as much as $0.01 under independent half-cent bounds.

## Item 5 - Other changed statements: approve

I found no separate contradiction in `ROUND1.diff` beyond item 4. The remaining changed wording qualifies the hand-case inputs, time-limit readout and lifetime-tax calculation as described above. The year worksheet compares all twelve published columns for each hand-case year at absolute tolerance $0.005, and checks the conversions list exactly (`optimizer.schedule.evidence.test.ts:135-205`); the totals cases compare status, objective and tax (`optimizer.schedule.evidence.test.ts:309-364`).

**Overall verdict: reject**, for item 4.

---

## Round 3

# Item 4 wording re-check

**Verdict: approve.** The reworded statements measure change against the stated fixture values. `withinTolerance` fails a finite actual value more than $0.005 from its expectation (`packages/engine/src/rules/describeCalculation.ts:37-41`). Both evidence fixtures set `tolerance: { abs: 0.005 }` (`packages/engine/src/strategies/optimizer.schedule.evidence.test.ts:167-171,297-329`).

- The year evidence compares every listed year column with its worksheet value, and compares the conversions list exactly (`packages/engine/src/strategies/optimizer.schedule.evidence.test.ts:177-205`). The totals evidence compares status and both figures for all four hand cases (`packages/engine/src/strategies/optimizer.schedule.evidence.test.ts:336-364`). These assertions support the revised year worksheet, totals worksheet, and record wording (`DOCS/calculations/optimizer-and-comparisons/optimizer-schedule-year-solution.md:87`; `DOCS/calculations/optimizer-and-comparisons/optimizer-schedule-objective-and-lifetime-tax.md:56`; `packages/engine/src/rules/calculations/optimizerAndComparisons.ts:781,830`).
- The library evidence states all six expected dollars and both weights (`packages/engine/src/strategies/optimizer.schedule.evidence.test.ts:318-329`), checks the weights exactly (`:386-391`), and checks each actual dollar against its expected dollar with the $0.005 tolerance (`:431-440`). This supports the revised record, worksheet, evidence header, and changelog statements (`packages/engine/src/rules/calculations/optimizerAndComparisons.ts:778`; `DOCS/calculations/optimizer-and-comparisons/optimizer-schedule-objective-and-lifetime-tax.md:77`; `packages/engine/src/strategies/optimizer.schedule.evidence.test.ts:24-27`; `CHANGELOG.md:26`).
- Each stated gap subtracts two independently checked figures. Their actual differences can therefore depart from the differences of the stated figures by at most $0.01, as the worksheet says (`DOCS/calculations/optimizer-and-comparisons/optimizer-schedule-objective-and-lifetime-tax.md:73-77`; `packages/engine/src/strategies/optimizer.schedule.evidence.test.ts:431-440`). The direct gap assertions establish only that each exceeds $1,000 (`:414-421`); the cent bound comes from the six figure assertions.

Items 1, 2, 3, and 5 from `PRIOR-RECHECK.md` remain approved; `ITEM4.diff` changes none of the code or claims their approvals rest on. No tests were run.
