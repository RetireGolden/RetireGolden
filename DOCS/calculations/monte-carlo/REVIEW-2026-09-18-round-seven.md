# Independent review, 2026-09-18 (derive round seven, six Monte Carlo summary worksheets)

Reviewer: cursor (composer-2.5), by independent recomputation without executing the engine, from the worksheets and the signatures-and-comments extract b1-p4-signatures-r7.md (montecarlo/run.ts with the path and summary types and the percentile and histogram conventions stated in the helpers' doc comments, frontiers.ts and sharedPaths.ts; bodies elided). Every worksheet states a small set of paths and derives the summary statistics aggregateMonteCarlo publishes from them; the reviewer recomputed every published figure, including the interpolated percentiles and the histogram bin assignments. Scope: monte-carlo-success-and-failure-rates, monte-carlo-investable-fan-percentiles, monte-carlo-ending-distributions, monte-carlo-depletion-distribution, monte-carlo-shortfall-statistics, monte-carlo-guardrail-adjustments. Verbatim output follows.

---

# Independent Worksheet Review Report

Review scope: six Monte Carlo calculation worksheets on branch `codex/b1-p4-worksheets-r3`, recomputed from Inputs and Justification using the conventions in the signatures extract (`percentile`, `percentileSet`, `histogramFor` doc comments). Implementation bodies under `packages/engine/src` were not consulted.

---

## 1. `monte-carlo-success-and-failure-rates`

### Recomputed values

| Field | Steps | Value |
|---|---|---|
| `successRate` | Paths with `depletionYear = null`: A, B, C → 3/5 | **0.6** |
| `requiredFloorSuccessRate` | `requiredFloorMet = true`: A, B, D → 3/5 | **0.6** |
| `targetLifestyleSuccessRate` | `targetLifestyleMet = true`: A only → 1/5 | **0.2** |
| `downsideRisk.failureRate` | Failing paths D, E → 2/5 (also 1 − 0.6) | **0.4** |
| `downsideRisk.failingPathCount` | Count of non-null `depletionYear` | **2** |

### Match
**yes** — all five Expected figures match exactly.

### Rule alignment
| Field | Stated rule | Applied correctly |
|---|---|---|
| `successRate` | Never deplete (`depletionYear` null) | yes |
| `requiredFloorSuccessRate` | Fund required floor every year | yes |
| `targetLifestyleSuccessRate` | Fund full target every year | yes |
| `failureRate` / `failingPathCount` | Failing = depleted (`depletionYear` non-null) | yes |

### Tolerance
Justified: rates at 1e-9 (exact rationals 3/5, 1/5, 2/5); count exact.

### Wrong readings (3 listed — all verified)
1. `requiredFloorMet` as success → A,B,D → **0.6** (coincidental; misclassifies C,D) ✓  
2. Any target miss = failure → B,C,D,E → rate **0.8**, count **4** ✓  
3. Deplete AND miss required floor → E only → rate **0.2**, count **1** ✓  

### Family
**outputs:** lists exactly the five published families; nothing extra.  
**feeds:** none — correct.

### Verdict
**approve**

---

## 2. `monte-carlo-investable-fan-percentiles`

### Recomputed values

**Year 2030** — per-path values [0, 100, 300, 1000]; sorted ascending; n = 4, n−1 = 3.

| Percentile | Index | lo, hi, frac | Interpolation | Value |
|---|---|---|---|---|
| p10 | 0.3 | 0, 1, 0.3 | 0×0.7 + 100×0.3 | **$30** |
| p25 | 0.75 | 0, 1, 0.75 | 0×0.25 + 100×0.75 | **$75** |
| p50 | 1.5 | 1, 2, 0.5 | 100×0.5 + 300×0.5 | **$200** |
| p75 | 2.25 | 2, 3, 0.25 | 300×0.75 + 1000×0.25 | **$475** |
| p90 | 2.7 | 2, 3, 0.7 | 300×0.3 + 1000×0.7 | **$790** |

**Year 2031** — sorted [100, 300, 700, 1500]; p50 index 1.5 → 300×0.5 + 700×0.5 = **$500**.

**Year 2032** — sorted [1000, 2000, 4000, 8000]; p50 index 1.5 → 2000×0.5 + 4000×0.5 = **$3,000**.

### Match
**yes** — full 2030 fan and 2031/2032 medians match Expected.

### Rule alignment
Per-year cross-path samples; linear interpolation at `(p/100)(n−1)`; five-point set p10/p25/p50/p75/p90 — all as stated.

### Tolerance
Justified at 1e-9; all interpolations are exact with these integer inputs.

### Wrong readings (3 listed — all verified)
1. Nearest-rank on 2030 → p10 **$0**, p25 **$0**, p50 **$100**, p75 **$300**, p90 **$1,000** ✓  
2. Either middle value as even-sample median → **$100** or **$300**, not **$200** ✓  
3. Rows-as-years sample [0,100,1000] → median **$100** ✓  

### Family
**outputs:** single family `monte-carlo-investable-fan-percentiles` — correct.  
**feeds:** none — correct.

### Verdict
**approve**

---

## 3. `monte-carlo-ending-distributions`

### Recomputed values

**`endingInvestable.histogram`** — sample [0, 20, 40, 80, 100]; min = **$0**; binWidth = (100−0)/4 = **$25**.

| Value | (v−min)/binWidth | floor | clamped bin |
|---|---|---|---|
| 0 | 0 | 0 | **0** |
| 20 | 0.8 | 0 | **0** |
| 40 | 1.6 | 1 | **1** |
| 80 | 3.2 | 3 | **3** |
| 100 | 4.0 | 4 → min(3,4) | **3** |

Counts: **[2, 1, 0, 2]**.

**`endingAfterTaxEstate.percentiles`** — sorted [0, 100, 300, 600, 1000]; n−1 = 4.

| Percentile | Index | Interpolation | Value |
|---|---|---|---|
| p10 | 0.4 | 0×0.6 + 100×0.4 | **$40** |
| p25 | 1.0 | sorted[1] | **$100** |
| p50 | 2.0 | sorted[2] | **$300** |
| p75 | 3.0 | sorted[3] | **$600** |
| p90 | 3.6 | 600×0.4 + 1000×0.6 | **$840** |

### Match
**yes** — histogram and all five estate percentiles match Expected.

### Rule alignment
Histogram: min = smallest; equal-width bins; max clamped to last bin — correct. Percentiles: same linear rule — correct.

### Tolerance
Justified: counts and bin parameters exact; percentiles exact at 1e-9.

### Wrong readings (3 listed — all verified)
1. No clamp on 100 → bin 4 → counts **[2, 1, 0, 1, 1]** ✓  
2. Inclusive-left upper bound excludes $100 — documented clamp rule puts it in bin 3 ✓  
3. Nearest-rank p90 → **$1,000**, not **$840** ✓  

### Family
**outputs:** `monte-carlo-ending-investable-histogram`; `monte-carlo-ending-after-tax-estate-percentiles` — matches published fields only.  
**feeds:** none — correct.

### Verdict
**approve**

---

## 4. `monte-carlo-depletion-distribution`

### Recomputed values

Successful paths (excluded): A (`null`), E (`null`).

Failing paths: B→2031, C→2031, D→2033.

Grouped counts:
- 2031: **2**
- 2033: **1**

**`depletionYearCounts` = [{ year: 2031, count: 2 }, { year: 2033, count: 1 }]**

No `depletionProbabilityByYear` asserted (denominator unstated in extract).

### Match
**yes**

### Rule alignment
Successes excluded; failures grouped by year — matches comment “successes excluded.”

### Tolerance
Exact for years and counts — justified.

### Wrong readings (3 listed — all verified)
1. Include null bucket → **[{year:null,count:2},{year:2031,count:2},{year:2033,count:1}]** ✓  
2. Ungrouped duplicate rows of count 1 each — not grouped count 2 ✓  
3. Cumulative denominators: all-path final **0.6**; failing-path final **1.0** ✓  

### Family
**outputs:** `monte-carlo-depletion-year-histogram` only — correct omission of unstated probability family.  
**feeds:** none — correct.

### Verdict
**approve**

---

## 5. `monte-carlo-shortfall-statistics`

### Recomputed values

**All-path statistics**

| Field | Sample / computation | Value |
|---|---|---|
| `spendingShortfall.averageTotalShortfallDollars` | (0+10+20+50+100)/5 | **$36** |
| `spendingShortfall.p90TotalShortfallDollars` | sorted [0,10,20,50,100]; idx 3.6 → 50×0.4+100×0.6 | **$80** |
| `averageYearsBelowTarget` | (0+1+2+4+8)/5 | **3** |
| `p90AverageAnnualTargetShortfall` | sorted [0,5,10,20,40]; idx 3.6 → 20×0.4+40×0.6 | **$32** |
| `targetAttainmentPct.p50` | sorted [0.20,0.60,0.80,0.90,1.00]; idx 2.0 | **0.80** |

**Conditional on failing paths** (`depletionYear` non-null: C, D)

| Field | Computation | Value |
|---|---|---|
| `downsideRisk.expectedShortfallDollars` | (20+50)/2 | **$35** |

### Match
**yes** — all six Expected figures match.

### Rule alignment
| Field | Stated rule | Applied |
|---|---|---|
| Averages / p90 shortfall & years | All paths | yes |
| `expectedShortfallDollars` | Average over failing paths only | yes (C,D; E excluded despite $100 shortfall) |
| Attainment median | Linear p50, not mean | yes |

### Tolerance
Justified: interpolated values and integer average years at 1e-9; dollar averages are exact rationals (no $0.005 needed).

### Wrong readings (4 listed — all verified)
1. Nearest-rank p90 → total **$100**, annual **$40** ✓  
2. Expected shortfall over all paths → **$36** ✓  
3. Failure = any positive shortfall → B,C,D,E → **$45** ✓  
4. Mean attainment → (1+0.9+0.8+0.6+0.2)/5 = **0.70** ✓  

### Family
Six output families for six published fields; no extras. **feeds:** none — correct.

### Verdict
**approve**

---

## 6. `monte-carlo-guardrail-adjustments`

### Recomputed values

**Path shares (all 5 paths)**

| Field | Identified paths | Value |
|---|---|---|
| `pathsWithCut` | B,C,D (cut years 2,4,8) | **3/5 = 0.6** |
| `pathsWithRaise` | C,D,E (raise counts ≥1) | **3/5 = 0.6** |

**Among cut paths only** (B, C, D)

| Field | Sample | Computation | Value |
|---|---|---|---|
| `averageCutYears` | [2, 4, 8] | 14/3 | **4.666666666666667** |
| `p90CutYears` | n=3, idx 1.8 | 4×0.2 + 8×0.8 | **7.2** |
| `medianMaxCutDepth` | [0.10, 0.30, 0.60], p50 idx 1 | sorted[1] | **0.30** |
| `p90MaxCutDepth` | idx 1.8 | 0.30×0.2 + 0.60×0.8 | **0.54** |
| `averageLongestCutSpellYears` | [1, 3, 5] | 9/3 | **3** |

**Ending probabilities (all paths)**

| Field | Rule | Value |
|---|---|---|
| `probEndingSurplus` | Positive `endingAfterTaxEstate`: B($100), C($200), E($50) | **3/5 = 0.6** |
| `probEndingAboveBequestTarget` | `true` on B, D, E | **3/5 = 0.6** |

Null-bequest case (not exercised by fixture inputs): documented **null** when no target set.

### Match
**yes** — all nine scalar Expected values match; null rule correctly described but not fixture-tested.

### Rule alignment
Cut-conditioned stats exclude zero-cut paths; raise share uses raise action count; surplus requires estate > 0; bequest null when no target — all consistent with extract comments.

### Tolerance
Justified at 1e-9 for shares and interpolations; integer spell average exact; 14/3 and 7.2 exact rationals.

### Wrong readings (4 listed — all verified)
1. Divide cut totals by 5 → avg cut years **2.8**, avg spell **1.8** ✓  
2. Nearest-rank p90 → cut years **8**, depth **0.60** ✓  
3. Zero estate counts as surplus → all five paths → **1.0** ✓  
4. Null bequest as false → **0**, not **null** ✓  

### Family
Seven families cover all published adjustment fields; `guardrailActionCounts` summation correctly excluded. **feeds:** none — correct.

### Verdict
**approve**

---

## Summary Table

| id | match | verdict |
|---|---|---|
| monte-carlo-success-and-failure-rates | yes | approve |
| monte-carlo-investable-fan-percentiles | yes | approve |
| monte-carlo-ending-distributions | yes | approve |
| monte-carlo-depletion-distribution | yes | approve |
| monte-carlo-shortfall-statistics | yes | approve |
| monte-carlo-guardrail-adjustments | yes | approve |

Reviewed by: cursor (composer), 2026-09-18, by independent recomputation without executing the engine.

---

# Follow-up review, 2026-09-18 (four worksheets on the aggregation rules stated after the first pass)

The first pass left six families out because their summary comments stated no aggregation rule; the rules were read from aggregateMonteCarlo and frontiers.ts and stated in doc comments (ratios of totals with 1 for nothing intended; sums across paths; each depletion year over all paths with a running cumulative; the frontier axis as the caller grid value). Codex Sol derived the funding-rates revision and three new worksheets on the extract carrying those comments, and the same reviewer recomputed every figure and approved all four. Verbatim output follows.

---

# Independent Worksheet Review Report

Review scope: four worksheets under `DOCS/calculations/monte-carlo/`, recomputed from **Inputs** and **Justification** only. Aggregation rules taken from the signatures extract (`b1-p4-signatures-r7b.md`). No engine bodies read; no commands run.

---

## 1. `monte-carlo-funding-rates`

### 1. id
`monte-carlo-funding-rates`

### 2. Recomputed values (with steps)

**Four-path case**

| Figure | Steps | Recomputed |
|--------|-------|------------|
| `idealFundingRate` | Σ funded: 100+0+50+0 = **150**; Σ intended: 100+300+100+0 = **500**; 150÷500 | **0.3** |
| `excessFundingRate` | Σ funded: 0+300+50+0 = **350**; Σ intended: 100+300+100+0 = **500**; 350÷500 | **0.7** |
| `flexibleGoals.funded` | 1+0+0+2 | **3** |
| `flexibleGoals.partiallyFunded` | 0+1+0+1 | **2** |
| `flexibleGoals.deferred` | 0+0+1+1 | **2** |
| `flexibleGoals.skipped` | 0+0+1+0 | **1** |
| `flexibleGoals.fundedAmount` | 100+150+50+200 | **500** |
| `flexibleGoals.unfundedAmount` | 0+150+50+100 | **300** |

**All-zero-intended second case**

Both Σ intended = 0 → documented convention → **idealFundingRate = 1**, **excessFundingRate = 1**.

### 3. Match
**yes** — all figures match Expected exactly.

### 4. Rule applied vs comment
**yes** — rates are ratios of totals (not averages of per-path ratios); flexible-goal fields are sums across paths; zero total intended → rate **1**, not **0**.

### 5. Tolerance justified
**yes** — `1e-9` absolute for the two rates (exact rational ratios 3/10 and 7/10); exact for all six integer sums.

### 6. Wrong readings verified

| Wrong reading | Stated wrong value | Recomputed | Confirms? |
|---------------|-------------------|------------|-----------|
| Average per-path rates (D → 1) | ideal 0.625, excess 0.625 | A:1/1=1, B:0/1=0, C:50/100=0.5, D:1 → (1+0+0.5+1)/4 = **0.625**; excess (0+1+0.5+1)/4 = **0.625** | **yes** |
| Average flexible-goal fields | {0.75, 0.5, 0.5, 0.25, 125, 75} | 3/4, 2/4, 2/4, 1/4, 500/4, 300/4 → **{0.75, 0.5, 0.5, 0.25, 125, 75}** | **yes** |
| Zero rate when Σ intended = 0 | 0 vs required 1 | Conceptual; second case has no nonzero numerators either | **yes** (by rule, not arithmetic) |

### 7. Family section
**yes** — `outputs` lists exactly the three claimed families (`monte-carlo-ideal-funding-rate`, `monte-carlo-excess-funding-rate`, `monte-carlo-flexible-goal-outcome-counts`); `feeds: none` is correct.

### 8. Verdict
**approve**

---

## 2. `monte-carlo-guardrail-action-counts`

### 1. id
`monte-carlo-guardrail-action-counts`

### 2. Recomputed values (with steps)

| Field | Steps | Recomputed |
|-------|-------|------------|
| `cut` | 2+0+4+0 | **6** |
| `raise` | 1+2+0+0 | **3** |
| `hold` | 3+1+2+0 | **6** |

### 3. Match
**yes** — `{ cut: 6, raise: 3, hold: 6 }` matches Expected.

### 4. Rule applied vs comment
**yes** — each action count is summed across all four paths (including D with zeros); not averaged, not path-incidence counts.

### 5. Tolerance justified
**yes** — exact integer sums.

### 6. Wrong readings verified

| Wrong reading | Stated wrong value | Recomputed | Confirms? |
|---------------|-------------------|------------|-----------|
| Average over 4 paths | {1.5, 0.75, 1.5} | 6/4, 3/4, 6/4 → **{1.5, 0.75, 1.5}** | **yes** |
| Path incidence (≥1 action) | {2, 2, 3} | cut: A,C; raise: A,B; hold: A,B,C → **{2, 2, 3}** | **yes** |
| Drop D, average remaining 3 | {2, 1, 2} | (2+4)/3, (1+2)/3, (3+1+2)/3 → **{2, 1, 2}** | **yes** |

### 7. Family section
**yes** — `outputs: monte-carlo-guardrail-action-counts` only; `feeds: none`.

### 8. Verdict
**approve**

---

## 3. `monte-carlo-depletion-probability-by-year`

### 1. id
`monte-carlo-depletion-probability-by-year`

### 2. Recomputed values (with steps)

Total paths = **6** (A,E successes; B,C,D,F failures).

Failures by year from inputs: 2031→1 (C), 2033→2 (B,F), 2035→1 (D). Matches stated `depletionYearCounts` order.

| Row | count | probability (count÷6) | cumulative (running Σ prob) |
|-----|------:|----------------------|----------------------------|
| 2031 | 1 | 1/6 ≈ 0.16666666666666666 | 1/6 ≈ 0.16666666666666666 |
| 2033 | 2 | 2/6 = 1/3 ≈ 0.3333333333333333 | 3/6 = 1/2 = 0.5 |
| 2035 | 1 | 1/6 ≈ 0.16666666666666666 | 4/6 = 2/3 ≈ 0.6666666666666666 |

### 3. Match
**yes** — years, counts, probabilities, cumulative probabilities, and row order all match Expected.

### 4. Rule applied vs comment
**yes** — denominator is total path count (successes included); one row per depletion year in count order; cumulative is running sum of row probabilities; successes produce no row.

### 5. Tolerance justified
**yes** — exact for years and integer counts; `1e-9` absolute for probabilities (exact rationals 1/6, 1/3, 1/2, 2/3).

### 6. Wrong readings verified

| Wrong reading | Stated wrong value | Recomputed | Confirms? |
|---------------|-------------------|------------|-----------|
| Denominator = 4 failures only | probs 1/4, 1/2, 1/4; cum 1/4, 3/4, 1 | 1/4, 2/4, 1/4; cum 1/4, 3/4, 4/4 → **{1/4, 1/2, 1/4}** and **{1/4, 3/4, 1}** | **yes** |
| Success row added | extra {null, 2, 1/3} | 2 successes / 6 = 1/3 if mis-modeled as a row | **yes** (conceptual) |
| Row prob = cumulative | 1/6, 1/2, 2/3 vs individual 1/6, 1/3, 1/6 | Cumulative column is **1/6, 1/2, 2/3**; individual probs are **1/6, 1/3, 1/6** | **yes** |

### 7. Family section
**yes** — `outputs: monte-carlo-depletion-probability-by-year` only; `feeds: none`.

### 8. Verdict
**approve**

---

## 4. `monte-carlo-stochastic-frontier-axis`

### 1. id
`monte-carlo-stochastic-frontier-axis`

### 2. Recomputed values (with steps)

**Spending frontier** (baseAnnual = 60,000; multipliers [0.8, 1.0, 1.2]):

| Multiplier | x = 60,000 × multiplier |
|-----------:|------------------------:|
| 0.8 | **48,000** |
| 1.0 | **60,000** |
| 1.2 | **72,000** |

**Retirement-age frontier** (caller deltas [-2, 0, 3]):

x copied from grid → **[-2, 0, 3]** (no computation from stochastic summaries).

### 3. Match
**yes** — spending `[48000, 60000, 72000]` and retirement-age `[-2, 0, 3]` match Expected in caller-grid order.

### 4. Rule applied vs comment
**yes** — spending `x` is variant plan `expenses.baseAnnual` (absolute dollar grid value); retirement `x` is caller-supplied delta in years; neither is inferred from result rows.

### 5. Tolerance justified
**yes** — all axis values are exact integers or exact integer products.

### 6. Wrong readings verified

| Wrong reading | Stated wrong value | Recomputed | Confirms? |
|---------------|-------------------|------------|-----------|
| Publish multipliers as x | [0.8, 1, 1.2] vs [48000, 60000, 72000] | Grid is multipliers, not dollars | **yes** |
| Ordinal indexes | [0, 1, 2] vs [-2, 0, 3] | Positions 0,1,2 ≠ signed deltas | **yes** |
| Spending delta from base | [-12000, 0, 12000] vs absolute baseAnnual | 48000−60000=−12000; 72000−60000=12000 → **[-12000, 0, 12000]** | **yes** |

### 7. Family section
**yes** — `outputs: stochastic-frontier-variant-axis` covers both frontier types’ `x`; `feeds: none`.

### 8. Verdict
**approve**

---

## Summary

| id | match | verdict |
|----|-------|---------|
| `monte-carlo-funding-rates` | yes | approve |
| `monte-carlo-guardrail-action-counts` | yes | approve |
| `monte-carlo-depletion-probability-by-year` | yes | approve |
| `monte-carlo-stochastic-frontier-axis` | yes | approve |

Reviewed by: cursor (composer), 2026-09-18, by independent recomputation without executing the engine.

---

# Re-check, 2026-09-18 (frontier axis after the comment correction)

The slice-ten fixture found that buildRetirementAgeSuccessFrontier publishes the variant's resulting retirement age (the lowest across the people who have one, moved by the delta and clamped to [30, 80]), not the caller's delta that the axis comment written earlier that day claimed and that the first derivation and its approval followed. The comment was corrected, Codex Sol re-derived the worksheet (63, 65, 68 for one person at 65; 65 for two people at 65 and 62 with +3; 30 from the clamp), the fixture and its receipt follow it, and the same reviewer recomputed all eight axis values and approved. Verbatim output follows.

---

# Independent recomputation report: `monte-carlo-stochastic-frontier-axis.md`

**Sources:** worksheet at `DOCS/calculations/monte-carlo/monte-carlo-stochastic-frontier-axis.md`; signatures extract (`montecarlo/frontiers.ts`, `montecarlo/sharedPaths.ts` at 42c60b5e) with corrected `StochasticFrontierPoint.x` comment. No engine bodies read; no commands run.

---

## 1. Recomputation of every `x` value

### Spending frontier

Rule (from Claim / comment): `x = expenses.baseAnnual` of the variant plan = base annual × grid multiplier.

| Grid point | Multiplier | Calculation | Recomputed `x` | Worksheet `x` |
|------------|------------|-------------|----------------|---------------|
| 1 | 0.8 | 60,000 × 0.8 | **48,000** | 48,000 |
| 2 | 1.0 | 60,000 × 1.0 | **60,000** | 60,000 |
| 3 | 1.2 | 60,000 × 1.2 | **72,000** | 72,000 |

Caller-grid order: `[48000, 60000, 72000]`.

### Retirement-age frontier — primary case (one person, age 65, deltas `[-2, 0, 3]`)

Rule: for each person with a retirement age, `age + delta`, then clamp to `[30, 80]`; `x` = minimum of those results (here, the single person).

| Grid point | Delta | Calculation | Clamped | Recomputed `x` | Worksheet `x` |
|------------|-------|-------------|---------|----------------|---------------|
| 1 | −2 | 65 + (−2) = 63 | 63 ∈ [30, 80] → 63 | **63** | 63 |
| 2 | 0 | 65 + 0 = 65 | 65 ∈ [30, 80] → 65 | **65** | 65 |
| 3 | +3 | 65 + 3 = 68 | 68 ∈ [30, 80] → 68 | **68** | 68 |

Caller-grid order: `[63, 65, 68]`.

### Retirement-age frontier — minimum case (ages 65 and 62, delta +3)

| Person | Calculation | Clamped age |
|--------|-------------|-------------|
| A | 65 + 3 | 68 |
| B | 62 + 3 | 65 |

`min(68, 65) = 65` → recomputed **`x = 65`** (worksheet: 65).

### Retirement-age frontier — clamp case (age 31, delta −2)

| Step | Result |
|------|--------|
| 31 + (−2) | 29 |
| clamp(29, 30, 80) | **30** |

Recomputed **`x = 30`** (worksheet: 30).

---

## 2. Match yes/no per figure

| Case | Expected | Recomputed | Match |
|------|----------|------------|-------|
| Spending grid | `[48000, 60000, 72000]` | `[48000, 60000, 72000]` | **yes** |
| Primary age grid | `[63, 65, 68]` | `[63, 65, 68]` | **yes** |
| Two-person minimum | `65` | `65` | **yes** |
| Lower clamp | `30` | `30` | **yes** |

All eight expected axis values match independent recomputation.

---

## 3. Wrong readings — do they produce their stated values?

| Wrong reading | Stated wrong value | Recomputed from that reading | Produces stated value? |
|---------------|-------------------|------------------------------|------------------------|
| Publish retirement-age delta (primary) | `[-2, 0, 3]` | Deltas themselves, not ages | **yes** |
| Maximum instead of minimum (two-person) | `68` | max(68, 65) = 68 | **yes** |
| Ignore clamp (age 31, delta −2) | `29` | 31 + (−2) without clamp | **yes** |
| Publish spending multipliers | `[0.8, 1, 1.2]` | Multipliers, not dollars | **yes** |

All four wrong-reading pairs are arithmetically correct.

---

## 4. Claim and tolerance

**Claim vs corrected comment:** The Claim matches the extract’s corrected `StochasticFrontierPoint.x` comment on both builders:

- **Spending:** `x` = variant plan’s `expenses.baseAnnual` (base annual × multiplier). ✓  
- **Retirement age:** `x` = lowest resulting retirement age among people who have one, after delta and clamp to `[30, 80]`; `0` when none; delta not published. ✓  

**Tolerance:** Worksheet specifies exact comparison for six caller-grid values (`48000`, `60000`, `72000`, `63`, `65`, `68`) plus two additional age-case values (`65`, `30`). All eight are integers; exact integer tolerance is appropriate. ✓  

---

## 5. Verdict

**Approve.** The re-derived worksheet aligns with the corrected comment, every `x` recomputes correctly, wrong readings are valid counterexamples, and the tolerance statement is correct.

Reviewed by: cursor (composer), 2026-09-18, by independent recomputation without executing the engine.
