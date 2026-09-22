# Review, 2026-09-18 (round nine: the pure exact-ledger and simple-evaluation figures)

Reviewer: cursor (composer-2.5), by independent recomputation without executing the engine, from the worksheets and the extract b1-p4-signatures-r9.md (projection/optimizePlan.ts with the 2026-09-18 field statements on ExactLedgerValidation and SimpleCandidateEvaluation, decisions/evaluateCandidate.ts with its constants, projection/compare.ts and the result types; bodies elided). Scope: exact-ledger-summary-comparison, exact-ledger-conversion-execution, exact-ledger-traditional-depletion, simple-candidate-evaluation-comparison. All four approved, one with a note. Verbatim output follows.

---

# Independent Worksheet Review Report

**Scope:** Four optimizer-and-comparisons worksheets on branch `codex/b1-p4-worksheets-r3`, recomputed from Inputs and Justification only. Signature extract consulted for type comments and constants; Arithmetic sections not trusted.

---

## 1. `exact-ledger-summary-comparison`

### 1. id
`exact-ledger-summary-comparison`

### 2. Recomputed values (all cases)

**Main case**

| Output | Rule | Steps | Recomputed |
|---|---|---|---|
| `optimization-baseline-after-tax-estate` | `summarizeProjection` of shared baseline → `endingAfterTaxEstate` | Given baseline summary | **$500,000.00** |
| `optimization-candidate-after-tax-estate` | `summarizeProjection` of candidate result → `endingAfterTaxEstate` | Given candidate summary | **$535,500.25** |
| `exact-ledger-validation-ending-net-worth-delta` | `candidate.endingNetWorth − baseline.endingNetWorth` | $648,250.75 − $620,000.25 | **$28,250.50** |

No additional branches in this worksheet.

### 3. Match
**yes** — all three values match Expected exactly.

### 4. Rule applied
**yes** — Baseline and candidate estates are taken directly from the two respective `summarizeProjection` summaries (not cross-paired). Delta is candidate minus baseline on **ending net worth**, not after-tax estate. Matches extract comments on `ExactLedgerValidation.baseline`, `.candidate`, and `.endingNetWorthDelta`.

### 5. Constants vs extract
No numeric constants quoted beyond field conventions. **No mismatches.**

### 6. Tolerance justified
**yes** — Dollar outputs use absolute $0.005 (binary floating point); values here are quarter-cent decimals and are exact, but the stated tolerance rule is appropriate.

### 7. Wrong readings (≤3 each; all recomputed)

| Wrong reading | Recomputed wrong value | Stated wrong value | Correct? |
|---|---|---:|---|
| Reverse subtraction (baseline − candidate) | $620,000.25 − $648,250.75 = **−$28,250.50** | −$28,250.50 | yes |
| Subtract after-tax estates instead | $535,500.25 − $500,000.00 = **$35,500.25** | $35,500.25 | yes |
| Treat shared baseline as recomputed from candidate | both estates **$535,500.25**, delta **$0** | same | yes |

### 8. Family section
**outputs:** `optimization-baseline-after-tax-estate`, `optimization-candidate-after-tax-estate`, `exact-ledger-validation-ending-net-worth-delta` — complete, no extras.

**feeds:** none — correct.

### 9. Verdict
**approve**

---

## 2. `exact-ledger-conversion-execution`

### 1. id
`exact-ledger-conversion-execution`

### 2. Recomputed values (all cases)

**Main case (2030–2032)**

| Step | Computation | Result |
|---|---|---|
| Requested total | $40,000 + $20,000 + $10,000 | **$70,000** |
| Executed total | $30,000 + $19,000 + $10,000 | **$59,000** |
| Ratio | min(1, 59,000 ÷ 70,000) = 59/70 | **0.8428571428571429** |

**Per-year materiality (ascending)**

| Year | Shortfall (req − exec) | Margin max($1,000, req × 0.05) | Shortfall > margin? |
|---|---:|---:|---|
| 2030 | $10,000 | max($1,000, $2,000) = $2,000 | **yes** → first qualifying year |
| 2031 | $1,000 | max($1,000, $1,000) = $1,000 | **no** (not strict >) |
| 2032 | $0 | $1,000 | no |

→ `firstMateriallyUnexecutedYear` = **2030**

**Null-margin branch (2040 only)**

| Step | Result |
|---|---|
| Shortfall | $20,000 − $19,000 = $1,000 |
| Margin | max($1,000, $20,000 × 0.05) = max($1,000, $1,000) = $1,000 |
| $1,000 > $1,000? | false → **null** |

**Zero-request branch**

| Step | Result |
|---|---|
| Requested total | $0 (empty schedule) |
| Ratio special case | **exactly 1** (no 0/0 division) |

### 3. Match
**yes** — all main, null-margin, and zero-request values match Expected.

### 4. Rule applied
**yes** — Requested total = sum of schedule amounts; executed total = sum of candidate `rothConversion`; ratio = min(1, executed/requested) with exactly 1 when requested = 0; first materially unexecuted year = first ascending year where shortfall **strictly exceeds** per-year margin. Matches extract comments on `requestedConversionTotal`, `executedConversionRatio`, and `firstMateriallyUnexecutedYear`.

### 5. Constants vs extract

| Worksheet constant | Extract value | Match |
|---|---|---|
| `DECISION_MATERIAL_SHORTFALL_DOLLARS` = $1,000 | `1_000` | yes |
| `DECISION_MATERIAL_SHORTFALL_PCT` = 0.05 (5%) | `0.05` | yes |

**No mismatches.**

### 6. Tolerance justified
**yes** — $70,000: absolute $0.005; ratio 59/70: not a short binary fraction, absolute 1e-9 appropriate; year 2030 and null branch: exact.

### 7. Wrong readings (all four recomputed)

| Wrong reading | Recomputed | Stated | Correct? |
|---|---|---:|---|
| Uncapped ratio (req $10k, exec $12k) | 12,000/10,000 = **1.2** | 1.2 | yes |
| Margin on $70k total | max($1,000, $3,500) = **$3,500** for every year | $3,500 | yes |
| Inclusive “more than” on 2040 $1k shortfall | qualifies → **2040** | 2040 | yes |
| 0/0 in zero-request branch | **NaN** | NaN | yes |

### 8. Family section
**outputs:** `exact-ledger-validation-requested-conversion-total`, `exact-ledger-validation-executed-conversion-ratio`, `exact-ledger-validation-first-materially-unexecuted-year` — complete, no extras.

**feeds:** none — correct.

### 9. Verdict
**approve**

---

## 3. `exact-ledger-traditional-depletion`

### 1. id
`exact-ledger-traditional-depletion`

### 2. Recomputed values (all cases)

**Main case** — own traditional sum only (`own-a` + `own-b`), ascending years, qualify when sum ≤ $1.00:

| Year | Own sum | ≤ $1.00? |
|---|---:|---|
| 2030 | $800.00 + $500.00 = $1,300.00 | no |
| 2031 | $0.40 + $0.50 = **$0.90** | **yes** → first qualifying year |
| 2032 | $0.00 + $0.00 = $0.00 | yes, but 2031 already wins |

Inherited `inherited-c` excluded throughout.

→ **2031**

**Null branch** (owned sums $2.00, $1.01, $5.00 in 2030–2032):

| Year | Sum | ≤ $1.00? |
|---|---:|---|
| 2030 | $2.00 | no |
| 2031 | $1.01 | no ($1.01 > $1.00) |
| 2032 | $5.00 | no |

→ **null**

### 3. Match
**yes** — main case 2031 and null branch null both match Expected.

### 4. Rule applied
**yes** — First ascending year where plan's own (non-inherited) traditional balances sum to **at most** validation tolerance; null if never. Matches extract comment on `traditionalDepletionYear` and `findTraditionalDepletionYear` convention.

### 5. Constants vs extract

| Worksheet | Extract | Match |
|---|---|---|
| Validation tolerance $1.00 (default) | `DECISION_NEUTRAL_TOLERANCE_DOLLARS = 1` | yes |

**No mismatches.**

### 6. Tolerance justified
**yes** — Calendar year and null are exact tolerances.

### 7. Wrong readings (all three recomputed)

| Wrong reading | Recomputed | Stated | Correct? |
|---|---|---:|---|
| Include inherited in 2031 | $0.90 + $24,000.00 = $24,000.90 > $1 → no year qualifies → **null** | null for these rows | yes |
| Require zero balance (strict > $0 only) | 2031 sum $0.90 still > 0, 2032 sum $0 qualifies first at **2032** | 2032 | yes |
| Strict `< $1` at boundary | owned sum exactly $1.00: $1.00 < $1.00 is false (fails); with “at most $1” it qualifies. Main row $0.90 passes both. | as stated | yes |

### 8. Family section
**outputs:** `exact-ledger-validation-traditional-depletion-year` — sole output, nothing else.

**feeds:** none — correct.

### 9. Verdict
**approve with a note** — Null-branch Arithmetic uses `min($2.00, $1.01, $5.00) > $1.00` as shorthand; the operative rule is per-year ascending test, not a global minimum. The conclusion (null) is correct; wording is slightly informal.

---

## 4. `simple-candidate-evaluation-comparison`

### 1. id
`simple-candidate-evaluation-comparison`

### 2. Recomputed values (all cases)

**Main case**

| Output | Rule | Steps | Recomputed |
|---|---|---|---|
| `executed-conversion-total` | Sum candidate `rothConversion` | $12,500.25 + $7,500.50 | **$20,000.75** |
| `after-tax-estate-delta` | candidate − baseline `endingAfterTaxEstate` | $525,250.25 − $500,000.00 | **$25,250.25** |
| `lifetime-tax-delta` | candidate − baseline `lifetimeTaxesAndPenalties` | $127,500.75 − $120,000.00 | **$7,500.75** |
| `money-lasts-years-delta` | lastsThrough(candidate) − lastsThrough(baseline) | Baseline: depletionYear 2034 → **2034**. Candidate: null depletion, endYear 2035 → **2035 + 1 = 2036**. Delta: 2036 − 2034 | **2** |
| `incomplete-computation-years` | Sorted union of incomplete tax/HECM years across both results | baseline {2031} ∪ candidate {2030, 2031} → sort | **[2030, 2031]** |

**Empty-list branch** — all statuses complete or absent → **[]**

### 3. Match
**yes** — all five main outputs and the empty branch match Expected.

### 4. Rule applied
**yes** — Conversion sum from candidate rows only; all three deltas are candidate minus baseline; `lastsThrough` = `depletionYear` when present else `endYear + 1` on both branches; incomplete years = sorted union across both results on either `taxComputation.status` or `hecmComputation.status` = `'incomplete'`. Matches `SimpleCandidateEvaluation` field comments and `lastsThroughYear` extract comment.

### 5. Constants vs extract
No additional numeric constants beyond field conventions. **No mismatches.**

### 6. Tolerance justified
**yes** — Dollar sums/deltas: absolute $0.005; year count 2: exact; list `[2030, 2031]` and `[]`: exact for values, order, and de-duplication.

### 7. Wrong readings (all four recomputed where numeric)

| Wrong reading | Recomputed | Stated | Correct? |
|---|---|---:|---|
| Reverse candidate − baseline | estate **−$25,250.25**, tax **−$7,500.75**, money-lasts **−2** | same | yes |
| Candidate `endYear` instead of `endYear + 1` | 2035 − 2034 = **1** | 1 | yes |
| Sum baseline conversions too | (no single number given; rule violation only) | — | N/A (conceptual, not a numeric fixture) |
| Concatenate without union | **[2031, 2030, 2031]**; union without sort **[2031, 2030]** | same | yes |

### 8. Family section
**outputs:** all five `simple-candidate-evaluation-*` families listed — complete, no extras.

**feeds:** none — correct.

### 9. Verdict
**approve**

---

## Cross-worksheet: twelve-family census

| # | Family | Worksheet |
|---|---|---|
| 1 | `optimization-baseline-after-tax-estate` | exact-ledger-summary-comparison |
| 2 | `optimization-candidate-after-tax-estate` | exact-ledger-summary-comparison |
| 3 | `exact-ledger-validation-ending-net-worth-delta` | exact-ledger-summary-comparison |
| 4 | `exact-ledger-validation-requested-conversion-total` | exact-ledger-conversion-execution |
| 5 | `exact-ledger-validation-executed-conversion-ratio` | exact-ledger-conversion-execution |
| 6 | `exact-ledger-validation-first-materially-unexecuted-year` | exact-ledger-conversion-execution |
| 7 | `exact-ledger-validation-traditional-depletion-year` | exact-ledger-traditional-depletion |
| 8 | `simple-candidate-evaluation-after-tax-estate-delta` | simple-candidate-evaluation-comparison |
| 9 | `simple-candidate-evaluation-executed-conversion-total` | simple-candidate-evaluation-comparison |
| 10 | `simple-candidate-evaluation-incomplete-computation-years` | simple-candidate-evaluation-comparison |
| 11 | `simple-candidate-evaluation-lifetime-tax-delta` | simple-candidate-evaluation-comparison |
| 12 | `simple-candidate-evaluation-money-lasts-years-delta` | simple-candidate-evaluation-comparison |

Each of the twelve round families appears on exactly one worksheet; no worksheet publishes or feeds a family outside its assignment. All four worksheets declare `feeds: none`.

---

## Summary table

| id | match | verdict |
|---|---|---|
| `exact-ledger-summary-comparison` | yes | approve |
| `exact-ledger-conversion-execution` | yes | approve |
| `exact-ledger-traditional-depletion` | yes | approve with a note |
| `simple-candidate-evaluation-comparison` | yes | approve |

Reviewed by: cursor (composer), 2026-09-18, by independent recomputation without executing the engine.

---

# Re-check, 2026-09-18 (the incomplete-years branch after the comment completion)

The slice-twelve fixture found that the first derivation of simple-candidate-evaluation-comparison expected an empty incompleteComputationYears list in the no-incomplete-status branch, where production omits the key entirely. The comments on SimpleCandidateEvaluation and ExactLedgerValidation were completed to state the union rule and the omission, Codex Sol revised that one branch of the worksheet (every number, the other cases, the Inputs and the Family section unchanged), and the same reviewer recomputed every value and re-checked the revised branch. Verbatim output follows.

---

# Independent review: `simple-candidate-evaluation-comparison.md`

**Worksheet:** `DOCS/calculations/optimizer-and-comparisons/simple-candidate-evaluation-comparison.md`  
**Extract consulted:** `b1-p4-signatures-s12-incomplete.md` (`SimpleCandidateEvaluation`, `ExactLedgerValidation`, `lastsThroughYear` at b800048d)  
**Scope:** Recomputation from published Inputs and Arithmetic only; no engine execution; no reads under `packages/engine/src`.

---

## 1. Recomputation (every published value, every case)

### Case A — Main fixture (populated incomplete-years branch)

**Inputs used**

| Quantity | Baseline | Candidate |
|---|---:|---:|
| `endingAfterTaxEstate` | 500,000.00 | 525,250.25 |
| `lifetimeTaxesAndPenalties` | 120,000.00 | 127,500.75 |
| `depletionYear` | 2034 | `null` |
| `endYear` | 2035 | 2035 |
| Candidate `rothConversion` | — | 12,500.25 (2030), 7,500.50 (2031) |
| Incomplete statuses | 2031 `taxComputation` | 2030 `hecmComputation`; 2031 `taxComputation` |

**Step 1 — Executed conversion total** (candidate rows only)

```
12,500.25 + 7,500.50 = 20,000.75
```

**Step 2 — After-tax estate delta** (candidate − baseline)

```
525,250.25 − 500,000.00 = 25,250.25
```

**Step 3 — Lifetime tax delta** (candidate − baseline)

```
127,500.75 − 120,000.00 = 7,500.75
```

**Step 4 — Money-lasts delta**

Per Claim / extract: `lastsThrough = depletionYear` when present, else `endYear + 1`.

```
lastsThrough(baseline)  = depletionYear = 2034
lastsThrough(candidate) = endYear + 1   = 2035 + 1 = 2036
moneyLastsYearsDelta    = 2036 − 2034 = 2
```

**Step 5 — Incomplete computation years** (sorted union across both results)

Collect years where `taxComputation.status` or `hecmComputation.status` is `'incomplete'`:

```
baseline incomplete years:  {2031}
candidate incomplete years: {2030, 2031}
set union:                  {2030, 2031}
ascending sort:             [2030, 2031]
```

Union is non-empty → key is published with that list.

---

### Case B — No-incomplete-status branch (absent key)

**Inputs used:** Both results have only complete or absent `taxComputation` / `hecmComputation` statuses (per Inputs § line 20).

**Step 6 — Incomplete computation years**

```
baseline incomplete years:  {}
candidate incomplete years: {}
set union:                  {}
```

Union is empty. Per revised Claim / extract, the published object **omits** `incompleteComputationYears`; it is not set to `[]`.

All other inputs for this branch are not separately specified; the worksheet treats it as a publication-semantics branch only (empty union → absent key). The four numeric outputs are unchanged from Case A’s formulas but are not re-instantiated with alternate summary numbers in this worksheet.

---

## 2. Match vs Expected

| Output key | Recomputed | Expected | Match |
|---|---|---:|:---:|
| `simple-candidate-evaluation-executed-conversion-total` | 20,000.75 | 20,000.75 (±$0.005) | **yes** |
| `simple-candidate-evaluation-after-tax-estate-delta` | 25,250.25 | 25,250.25 (±$0.005) | **yes** |
| `simple-candidate-evaluation-lifetime-tax-delta` | 7,500.75 | 7,500.75 (±$0.005) | **yes** |
| `simple-candidate-evaluation-money-lasts-years-delta` | 2 | 2 (exact) | **yes** |
| `simple-candidate-evaluation-incomplete-computation-years` (populated) | [2030, 2031] | [2030, 2031] (exact, sorted, de-duped) | **yes** |
| `incompleteComputationYears` (no-incomplete branch) | key absent | key omitted (union empty) | **yes** |

---

## 3. Revised branch vs extract; internal agreement

**Extract (`SimpleCandidateEvaluation` and `ExactLedgerValidation`, identical comment):**

> Present only when non-empty: the ascending, de-duplicated years … The key is omitted, not set to an empty list, when no year qualifies.

**Worksheet alignment**

| Section | States omission when empty? | States populated form? | Agrees with extract? |
|---|---|:---:|:---:|
| **Claim** | yes — “only when non-empty … omitting the key when no year qualifies” | yes — sorted union of incomplete tax/HECM years | **yes** |
| **Justification** | yes — “published key conditional on a non-empty union” | yes — both channels across both projections | **yes** |
| **Expected** | yes — “union … is empty and the published object omits the key” | yes — `[2030, 2031]` | **yes** |

**Claim ↔ Justification ↔ Expected:** All three agree on (a) non-empty → ascending de-duplicated union published, (b) empty union → key omitted, not `[]`. **Arithmetic** says the union is `[]` in the all-complete branch, which is the logical set result before the publication rule; **Expected** correctly adds that the object omits the key. No contradiction.

---

## 4. Wrong readings — each produces its stated value

| Wrong reading | Stated wrong value | Recomputed wrong value | Match |
|---|---|---:|:---:|
| Reverse all deltas (baseline − candidate) | estate −25,250.25; tax −7,500.75; money-lasts −2 | 500,000.00 − 525,250.25 = −25,250.25; 120,000.00 − 127,500.75 = −7,500.75; 2034 − 2036 = −2 | **yes** |
| `endYear` instead of `endYear + 1` for non-depleting candidate | 1 year | 2035 − 2034 = 1 | **yes** |
| Include baseline conversions in the sum | (qualitative — field restricts to candidate) | N/A; misreading is correctly identified | **yes** |
| Concatenate without set union | [2031, 2030, 2031] | baseline 2031 then candidate 2030, 2031 → [2031, 2030, 2031] | **yes** |
| Union without ascending sort | [2031, 2030] | set {2030, 2031} with wrong order | **yes** |
| Publish `incompleteComputationYears: []` when union empty | `[]` present vs key absent | contradicts extract/Claim; correctly flagged | **yes** |

---

## 5. Diff from the derivation approved earlier today

Per **Revision note** and the stated fixture finding, the **only substantive change** is the no-incomplete-status branch: first derivation expected `[]`; revised worksheet expects **key omission**.

**Text touched for that fix (and traceability):**

- **Claim** — added “only when non-empty” and “omitting the key when no year qualifies.”
- **Justification** — added “published key conditional on a non-empty union.”
- **Arithmetic** — added sentence that all-complete/absent branch union is `[]`.
- **Expected** — replaced empty-list expectation with “union empty → published object omits the key.”
- **Wrong readings** — added bullet 5 (`[]` vs omitted key).
- **Provenance** — revision note; still “unreviewed” in file (this report supersedes that for this pass).

**Unchanged from approved derivation:**

- All numeric inputs (summaries, depletion/end years, conversion amounts, incomplete-year placement).
- All four arithmetic results and tolerances.
- Populated incomplete-years list `[2030, 2031]` and union logic.
- Money-lasts convention (`depletionYear` vs `endYear + 1`).
- Prior wrong-reading bullets 1–4.
- **Family** section (same five output keys; `feeds: none`).
- `recommendationState` still excluded (Justification unchanged on that point).

No other numeric or case changes detected.

---

## 6. Verdict

**Approve.** Every recomputed figure matches Expected; the incomplete-years revision now matches the extract’s “present only when non-empty / omitted, not `[]`” rule; Claim, Justification, and Expected are mutually consistent; all wrong readings check; all other worksheet content is unchanged from the earlier approved derivation aside from the omission semantics fix and its supporting prose.

Reviewed by: cursor (composer), 2026-09-18, by independent recomputation without executing the engine.
