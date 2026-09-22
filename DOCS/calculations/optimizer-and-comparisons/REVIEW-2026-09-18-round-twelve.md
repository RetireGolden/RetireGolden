# Review, 2026-09-18 (round twelve: the optimizer's own figures as models with a limit)

Reviewer: cursor (composer-2.5), by independent recomputation without executing the engine, from the worksheets and the extract b1-p4-signatures-r12.md (projection/optimizePlan.ts with the 2026-09-18 field statements on the schedule adjustment, decisions/generators.ts, decisions/evaluateCandidate.ts, socialSecurity/nra.ts, projection/compare.ts and the fixture plans' comments; bodies elided). Scope: exact-ledger-tournament-margin, exact-ledger-cleaned-schedule, claim-age-co-optimization. Verbatim output follows.

---

# Independent Worksheet Review Report

Review scope: three optimizer/comparison worksheets on branch `codex/b1-p4-worksheets-r3`, recomputed from Inputs and Justification only, with constants checked against `b1-p4-signatures-r12.md`. No engine bodies under `packages/engine/src` were read; no commands were run.

---

## 1. `exact-ledger-tournament-margin`

### Recomputed values (derived cases)

**None fixture**

| Step | Result |
|------|--------|
| No traditional balance, no applied conversions | No convertible balance |
| Every conversion candidate executes | `$0` |
| Nothing converts | No schedule to recommend |
| No MILP result supplied | No MILP comparison |
| `winnerSource` | `none` |
| `winnerConversions` | `[]` |
| `marginOverMilpDollars` | `$0` |

**Incumbent fixture**

| Step | Result |
|------|--------|
| Owned traditional ≥ `$20,000` | Balance available |
| Applied conversion Y1 | `$20,000` requested |
| Ledger execution Y1 | `min($20,000, balance ≥ $20,000) = $20,000` |
| Nothing evaluated beats installed plan | Incumbent holds |
| `winnerSource` | `incumbent` |
| `winnerConversions` | `[{ year: Y1, amount: 20000 }]` (executed amounts) |
| No MILP result supplied | No MILP comparison |
| `marginOverMilpDollars` | `$0` |

**Solver-run limit**

| Step | Result |
|------|--------|
| Replacement rule | `candidate estate − MILP estate > $1,000` required |
| Published margin (when branch applies) | That exact difference |
| Extract omits estate inputs | **No number derivable — run-pinned correctly** |

### Match

**Yes.** All derived enum/list/dollar values match Expected exactly.

### Rule applied vs comments

**Yes.**

- Extract: `marginOverMilpDollars` is the candidate’s exact estate delta over the displaced MILP schedule and is **`0` when no MILP comparison was made** (optimizePlan.ts lines 602–603).
- Both no-MILP fixtures correctly publish `$0`, not a candidate-vs-incumbent delta.
- Extract: a candidate replaces the MILP schedule only when it wins by **more than** `DEFAULT_TOURNAMENT_SWITCH_MARGIN_DOLLARS = 1_000` (lines 652–653, 784–785). Exclusive threshold is stated correctly in Wrong readings.

### Constants vs extract

| Quoted | Extract | Match |
|--------|---------|-------|
| `DEFAULT_TOURNAMENT_SWITCH_MARGIN_DOLLARS = $1,000` | `1_000` (line 653) | Yes |
| Margin convention (delta over MILP; 0 without MILP) | Lines 602–603 | Yes |
| `winnerSource` / `winnerConversions` semantics for `none` / `incumbent` | Lines 591–598 | Yes |

No mismatches.

### Tolerance justification

**Yes.**

- `$0` margin: absolute `$0.005` — appropriate for a dollar figure.
- `winnerSource`, `winnerConversions`: exact — appropriate for enum and lists.
- Solver-run branch: run-pinned, no number — correct.

### Wrong readings (≤3 each — all recomputed)

| Wrong reading | Stated wrong value | Recomputed wrong value | Correct value | Produces stated wrong? |
|---------------|-------------------|------------------------|---------------|------------------------|
| Publish margin on incumbent path | Nonzero candidate-vs-incumbent delta | Any nonzero delta | `$0` | **Yes** |
| Treat no-traditional plan as incumbent | Nonempty `winnerConversions` | e.g. `[{Y1, amount}]` | `[]`, source `none` | **Yes** |
| Inclusive `$1,000` switch threshold | Candidate exactly `$1,000` ahead replaces MILP | Does not replace (needs **>** `$1,000`) | No replacement at equality | **Yes** (wrong reading misstates eligibility, not a numeric fixture) |

### Family section

**Yes.**

- **outputs:** `exact-ledger-tournament-margin-over-milp-dollars` only.
- **feeds:** none only.
- This family appears on this worksheet only (round partition).

### Verdict

**Approve**

---

## 2. `exact-ledger-cleaned-schedule`

### Recomputed values

**Given:** traditional `$20,000`; raw `$15,000` Y1 + `$15,000` Y2; executed `$15,000` Y1 + `$5,000` Y2. Neutral tolerance = `$1` (`DECISION_NEUTRAL_TOLERANCE_DOLLARS`).

| Year | Executed > $1? | cleaned = min(requested, executed) or 0 | cleaned | Adjustment |
|------|----------------|----------------------------------------|---------|------------|
| Y1 | `$15,000 > $1` → yes | `min(15000, 15000)` | `$15,000` | None (cleaned = requested within tolerance) |
| After Y1 | — | `$20,000 − $15,000` | `$5,000` remaining | — |
| Y2 | `$5,000 > $1` → yes | `min(15000, 5000)` | `$5,000` | `{ requested: 15000, executed: 5000, cleaned: 5000, reason: ledger-capped }` |

**Totals**

| Metric | Recomputed |
|--------|------------|
| Cleaned schedule | `[{ Y1, 15000 }, { Y2, 5000 }]` |
| Cleaned requested total | `$15,000 + $5,000 = $20,000` |
| Cleaned executed total | `$15,000 + $5,000 = $20,000` |
| Cleaned executed ratio | `$20,000 / $20,000 = 1` |

**Reason set:** live reasons `ledger-capped`, `dropped-zero`, `estate-pruned`; `rounding` declared but never assigned (`D-ADJUSTMENT-ROUNDING-REASON`).

### Match

**Yes.** All schedule rows, totals, ratio, Y2 adjustment row, and reason inventory match Expected.

### Rule applied vs comments

**Yes.**

- Extract (lines 992–998): `cleaned = min(requested, executed)` when executed exceeds neutral tolerance; else `0`.
- Y1/Y2 both have executed well above `$1`; both use the min branch.
- Y2: requested ≠ cleaned → **`ledger-capped`**, not `dropped-zero` (which applies when cleaned is within neutral tolerance of zero) and not `rounding` (never assigned).
- Incumbent `winnerConversions` = executed amounts, not raw requests (Expected note; tournament lines 595–597).

### Constants vs extract

| Quoted / implied | Extract | Match |
|------------------|---------|-------|
| `cleaned = min(requested, executed)` when executed > neutral tolerance else `0` | Lines 992–993 | Yes |
| Reasons: `ledger-capped`, `dropped-zero`, `estate-pruned`; `rounding` never assigned | Lines 994–998 | Yes |
| `D-ADJUSTMENT-ROUNDING-REASON` | Named in comment | Yes |
| Neutral tolerance `$1` (implied by “exceeds neutral tolerance”) | `DECISION_NEUTRAL_TOLERANCE_DOLLARS = 1` (line 1645) | Yes |

No mismatches.

### Tolerance justification

**Yes.**

- Schedule list, adjustment row, reason enum, ratio `1`: exact — correct.
- Dollar totals `$20,000`: absolute `$0.005` — correct.
- MILP-sourced winning schedule: run-pinned with no number in this worksheet — correct.

### Wrong readings (3 — all recomputed)

| Wrong reading | Stated wrong value | Recomputed | Correct | Produces stated wrong? |
|---------------|-------------------|------------|---------|------------------------|
| cleaned = requested | Y2 = `$15,000` | `$15,000` | `$5,000` | **Yes** |
| Sum raw requests | Total = `$30,000` | `$30,000` | `$20,000` | **Yes** |
| Y2 reason = `rounding` | `rounding` | Declared-only, never assigned | `ledger-capped` | **Yes** (wrong label, not a different cleaned amount) |

### Family section

**Yes.**

- **outputs:** `optimizer-recommended-conversion-annual` only.
- **feeds:** `exact-ledger-tournament-margin-over-milp-dollars` via executed incumbent `winnerConversions` only.
- This output family appears on this worksheet only.

### Verdict

**Approve**

---

## 3. `claim-age-co-optimization`

### Recomputed values

**Grid rule (extract lines 1386–1390, 1398–1402):** canonical ages `{62y0m, 67y0m (FRA), 70y0m}`; emit ages **different from current claim**; count includes current claim (`combinationsEvaluated = 1 + generated`).

**One-stream fixture (current claim `70y0m`)**

| Step | Result |
|------|--------|
| Canonical grid | `{62y0m, 67y0m (FRA), 70y0m}` |
| Remove current `70y0m` | Generated candidates = `3 − 1 = 2` |
| Include current claim | `combinationsEvaluated = 1 + 2 = 3` |

**No-stream fixture**

| Step | Result |
|------|--------|
| No SS streams | Generated candidates = `0` |
| Include current claim | `combinationsEvaluated = 1 + 0 = 1` |

**Current-claim-wins fixture**

| Step | Result |
|------|--------|
| No traditional balance | All conversion schedules empty |
| Planning age `70y1m`, current claim `70y0m` | No later canonical age (`70y0m` is max grid point) |
| No candidate beats by > `$1,000` | Current claim wins |
| `winningClaimLabel` | `null` |
| `winningClaimPatch` | `null` |
| **Stated estate identity** | `jointExactEstate = currentClaimExactEstate` |
| Dollar magnitudes | **Run-pinned** (extract lacks full optimizer inputs / exact ledger result) |

**Switch margin:** replacement requires `jointExactEstate − currentClaimExactEstate > $1,000` (more than, not inclusive).

### Match

**Yes** for all derived counts, null structured outputs, estate identity (qualitative), and run-pinned omissions.

### Rule applied vs comments

**Yes.**

- `combinationsEvaluated` includes current claim (line 1243).
- Generator visits up to two streams and three canonical ages differing from current (lines 1398–1402).
- `67y0m (FRA)` is a **grid label** (`D-CLAIM-AGE-FRA-LABEL`), not `fraForBirthYear` output — correctly distinguished from `socialSecurity/nra.ts`.
- Joint estate equals current-claim estate when no switch wins — consistent with `winningClaimLabel = null` / current claim retained (lines 1245–1256, 1273).
- Switch margin is **more than** `$1,000` (line 1235–1236).

### Constants vs extract

| Quoted | Extract | Match |
|--------|---------|-------|
| `DEFAULT_CLAIM_SWITCH_MARGIN_DOLLARS = $1,000` | `1_000` (line 1236) | Yes |
| Grid ages `62y0m`, `67y0m (FRA)`, `70y0m` | `SS_CLAIM_AGES` (lines 1386–1390) | Yes |
| `D-CLAIM-AGE-FRA-LABEL` | Worksheet + nra.ts FRA schedule note | Yes |
| `combinationsEvaluated = 1 + generated` | Lines 1243–1244 | Yes |

No mismatches.

### Tolerance justification

**Yes.**

- Counts `3` and `1`: exact — correct.
- `winningClaimLabel`, `winningClaimPatch`: exact null — correct.
- Run-pinned dollar fields (`currentClaimExactEstate`, `jointExactEstate`): no numbers assigned; `$0.005` tolerance noted for when values exist — correct.

### Wrong readings (4 — recomputed where numeric)

| Wrong reading | Stated wrong value | Recomputed | Correct | Produces stated wrong? |
|---------------|-------------------|------------|---------|------------------------|
| Count current `70y0m` as generated | `1 + 3 = 4` | `4` | `3` | **Yes** |
| Omit current claim from count | `2` (one-stream); `0` (no-stream) | `2`; `0` | `3`; `1` | **Yes** |
| Personal FRA label vs grid | Middle point ≠ `67y0m (FRA)` for some birth years | Label mismatch possible | Grid always `67y0m (FRA)` | **Yes** (conceptual; no numeric fixture) |
| Inclusive `$1,000` switch | Switches at exactly `$1,000` | Does not switch | Needs **>** `$1,000` | **Yes** (threshold misread, not a pinned dollar case) |

### Family section

**Yes.**

- **outputs:** all three claim-age families listed — nothing extra.
- **feeds:** `optimizer-recommended-conversion-annual` only.
- Combined with worksheets 1–2, the five round families each appear on **exactly one** worksheet:

| Family | Worksheet |
|--------|-----------|
| `exact-ledger-tournament-margin-over-milp-dollars` | tournament-margin |
| `optimizer-recommended-conversion-annual` | cleaned-schedule |
| `claim-age-co-optimization-combinations-evaluated` | claim-age |
| `claim-age-co-optimization-current-claim-exact-estate` | claim-age |
| `claim-age-co-optimization-joint-exact-estate` | claim-age |

Feed chain is consistent: claim-age → conversion schedule → tournament incumbent executions → margin field.

### Verdict

**Approve**

---

## Summary Table

| id | match | verdict |
|----|-------|---------|
| `exact-ledger-tournament-margin` | yes | approve |
| `exact-ledger-cleaned-schedule` | yes | approve |
| `claim-age-co-optimization` | yes | approve |

Reviewed by: cursor (composer), 2026-09-18, by independent recomputation without executing the engine.

---

## Re-check 2026-09-22: claim-age-co-optimization current-claim-wins case

Scope: the Revision 2026-09-22 note in `claim-age-co-optimization.md` Provenance — re-derived current-claim-wins fixture only. Recomputed from that worksheet's Claim, Justification, Inputs, and Arithmetic sections only; no engine execution; no implementation read.

### Contract applied

| Rule | Source in worksheet |
|------|---------------------|
| Canonical grid | `{62y0m, 67y0m (FRA), 70y0m}` |
| Generated candidates | Grid ages **different from** the stream's current claim |
| `combinationsEvaluated` | `1 + generated` (current claim always counted) |
| Co-optimization | Each generated candidate uses the same options as the current plan; with no traditional balance, conversion schedules are empty |
| Switch threshold | Replace only when `jointExactEstate − currentClaimExactEstate > $1,000` (exclusive; equality does not switch) |
| No switch | `winningClaimLabel = null`, `winningClaimPatch = null`, and `jointExactEstate = currentClaimExactEstate` |

### Current-claim-wins fixture (re-derived inputs)

**Given:** planning age `70` (whole years, as the plan schema requires); one Social Security stream currently claiming at `70y0m`; no traditional balance; same options for every candidate and the current plan.

| Step | Result |
|------|--------|
| Canonical grid | `{62y0m, 67y0m (FRA), 70y0m}` |
| Remove current `70y0m` | Generated candidates = `62y0m`, `67y0m (FRA)` → count `2` |
| Include current claim in total | `combinationsEvaluated = 1 + 2 = 3` |
| No traditional balance | Empty conversion schedules for current claim and both candidates |
| Neither candidate estate exceeds current-claim estate by **more than** `$1,000` | No claim switch |
| `winningClaimLabel` | `null` |
| `winningClaimPatch` | `null` |
| Estate identity | `jointExactEstate = currentClaimExactEstate` (retained current claim is the best non-switching outcome) |
| Dollar magnitudes | **Run-pinned** (worksheet does not state full optimizer inputs or exact ledger result) |

**Candidate set confirmed:** the two generated claim ages are `62y0m` and `67y0m (FRA)` only; the stream's own `70y0m` is excluded from generation but included once in the evaluated total via the current-claim slot. **`combinationsEvaluated = 3`** matches the one-stream `70y0m` count fixture arithmetic (`3 − 1 = 2` generated, plus current).

### Null winner and estate identity

The null winner does **not** follow from an empty candidate set. Two candidates are evaluated with empty schedules and identical options; neither clears the exclusive `$1,000` margin over `currentClaimExactEstate`. Under the stated switch rule, no replacement occurs, so the published winner fields are null and the joint exact estate equals the current-claim exact estate. That matches Arithmetic and Expected (null structured outputs exact; dollar fields run-pinned but required equal in this fixture).

### Wrong reading: planning age past the claim

| Reading | Planning age | Reasoning | `combinationsEvaluated` |
|---------|--------------|-----------|---------------------------|
| **Wrong** | `70y1m` (past claim at `70y0m`) | Treat claim as already past → conclude no candidate is evaluated | `1` (current claim only, zero generated) |
| **Correct (re-derived)** | `70` with stream at `70y0m` | Two grid ages differ from current claim → both evaluated; null winner from margin | `3` |

Recomputing the wrong reading: if no generated candidate is evaluated, `generated = 0` and `combinationsEvaluated = 1 + 0 = 1`. That is exactly the erroneous count named in Wrong readings; the correct fixture still evaluates two candidates and reports `3`, with null winner fields driven by the margin rule.

### Match to revised worksheet

**Yes.** Candidate set (`62y0m`, `67y0m (FRA)`), `combinationsEvaluated = 3`, null winner fields, `jointExactEstate = currentClaimExactEstate`, and the planning-age-past-claim wrong reading (`1` vs `3`) all match the re-derived Inputs, Arithmetic, Expected, and Wrong readings sections.

### Verdict

**Approve** — the 2026-09-22 re-derivation is consistent with the worksheet contract; the prior round-twelve review's `70y1m` planning-age row for this fixture is superseded by the schema-correct `70` / margin-based reasoning.

Reviewed by: cursor (composer-2.5), 2026-09-22 (re-check), by independent recomputation without executing the engine.
