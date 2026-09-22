# Review, 2026-09-18 (the ABW annuity-due payment)

Reviewer: cursor (composer-2.5), by independent recomputation without executing the engine, from the worksheet and the extract b1-p4-signatures-abw.md (spending/abw.ts at 20072b86, bodies elided). Scope: abw-annuity-due-payment, the last catalog worksheet without an independent recomputation (derived by the orchestrator, implemented by Grok in the first slices). Verbatim output follows.

---

# Independent recomputation review: `abw-annuity-due-payment`

**Worksheet:** `DOCS/calculations/spending-and-withdrawals/abw-annuity-due-payment.md`  
**Signature extract:** `abwAnnualPayment` comment and `ABW_DEFAULTS` from `spending/abw.ts` at 20072b86  
**Cases in worksheet:** one (single input row)

---

## 1. Recomputed values and intermediate steps

**Inputs (from worksheet):** B = 210 USD, r = 0.10 (10% as `realReturnPct: 10`), g = 0 (`tiltPct: 0`), n = 2 (current year inclusive).

**Growth-adjusted ratio x**

\[
x = \frac{1+g}{1+r} = \frac{1+0}{1+0.10} = \frac{1}{1.1} = \frac{10}{11} = 0.9090909091\ldots
\]

(exact rational; ≥10 significant digits)

**Power x^n (n = 2)**

\[
x^2 = \left(\frac{10}{11}\right)^2 = \frac{100}{121} = 0.8264462810\ldots
\]

**Annuity-due factor**

\[
\frac{1-x}{1-x^n} = \frac{1-\frac{10}{11}}{1-\frac{100}{121}} = \frac{\frac{1}{11}}{\frac{21}{121}} = \frac{121}{11 \times 21} = \frac{11}{21} = 0.5238095238\ldots
\]

**Payment P**

\[
P = B \cdot \frac{11}{21} = 210 \times \frac{11}{21} = 10 \times 11 = 110
\]

(exact)

**Cross-check (geometric sum, annuity due):**

\[
B = P\sum_{k=0}^{n-1} x^k = P\left(1 + \frac{10}{11}\right) = P \cdot \frac{21}{11}
\quad\Rightarrow\quad
P = 210 \cdot \frac{11}{21} = 110
\]

**Cross-check (two-period cash-flow balance):**

- t = 0 start: 210; withdraw P → remainder 210 − P  
- t = 1 after 10% growth: 1.1(210 − P); withdraw P → 1.1(210 − P) − P = 0  
- 231 − 2.1P = 0 → P = 110  

Matches the worksheet’s cash-flow table.

---

## 2. Match against Expected

| Figure | Expected | Recomputed | Match |
| --- | ---: | ---: | --- |
| Payment P | 110 (exact) | 110 (exact) | **yes** |

---

## 3. Rule alignment with `abwAnnualPayment` comment

| Element | Stated in comment/extract | Applied in worksheet | Aligns |
| --- | --- | --- | --- |
| Timing | Annuity due (start-of-year withdrawal; growth on remainder) | Claim, cash-flow table, geometric sum from k = 0 | **yes** |
| Growth in rate | x = (1+g)/(1+r); extract uses (1+g/100)/(1+r/100) | x = (1+0)/(1+0.10); Inputs bridge percent API | **yes** |
| Horizon | n = remaining years **including current year** | n = 2, two withdrawals at t = 0 and t = 1 | **yes** |
| Closed form | P = B(1−x)/(1−x^n), or B/n when x = 1 | Used; x ≠ 1 here | **yes** |
| Rate units | `realReturnPct`, `tiltPct` in **percent per year** | 10% → `realReturnPct: 10`, g = 0 → `tiltPct: 0`; arithmetic in decimals | **yes** |

This case does not exercise the guards noted in Revision (`floor(remainingYears)`, `|x−1| < 1e-9`, non-finite/non-positive x); that is acknowledged in the worksheet and does not affect this fixture.

---

## 4. Constants and defaults vs extract

The worksheet does **not** quote `ABW_DEFAULTS` entries (`fixedRealReturnPct: 3.8`, `startingCape: 25`, `equitySharePct: 60`, `bondRealYieldPct: 2.0`, `tiltPct: 0`, `horizon: 'planningAge'`). It uses explicit fixture values only.

| Quoted in worksheet | Extract | Match |
| --- | --- | --- |
| `realReturnPct: 10` (10%) | `abwAnnualPayment(..., realReturnPct, ...)` percent/yr | **yes** |
| `tiltPct: 0` | Default `tiltPct: 0` in `ABW_DEFAULTS` | **yes** |
| Guard tolerance `1e-9` (Revision) | Registry statement `|x − 1| < 1e-9` | **yes** |
| `n = floor(remainingYears)` (Revision) | Registry / comment convention | **yes** |

No quoted constant conflicts with the extract.

---

## 5. Tolerance justification

Stated tolerance: absolute `1e-9` (binary float via `Math.pow`).

For these inputs, exact rational arithmetic gives P = 110 exactly. Even with IEEE-754 evaluation of x = 10/11, error should be far below 1e-9. The tolerance is conservative and **justified**; integer-cent `exact` would also be defensible here, but `1e-9` correctly reflects float evaluation without being loose.

---

## 6. Plausible wrong readings (both recomputed)

**1. End-of-period (ordinary) annuity**

\[
P_{\text{ord}} = B \cdot \frac{r}{1-(1+r)^{-n}} = 210 \cdot \frac{0.10}{1 - 1.1^{-2}} = \frac{21}{(1.21-1)/1.21} = \frac{21 \times 1.21}{0.21} = 121
\]

Worksheet states **121**. **Match: yes.**  
Due × (1+r) = 110 × 1.1 = 121, as the worksheet notes.

**2. Flat split (ignore growth)**

\[
P = B/n = 210/2 = 105
\]

Worksheet states **105**. **Match: yes.**

---

## 7. Family section

The worksheet has **no `## Family` section** (unlike peer worksheets in the same directory, e.g. `spending-base-annual.md`, `sepp-amortization-method.md`).

From `DOCS/operations/calculation-coverage/spendingAndWithdrawals.json` and `DOCS/calculations/INDEX.md`, this record publishes one output family:

- **`spending-base-annual`**
- feeds: none (empty in registry)

Because the Family section is absent, it does **not** name the published family and cannot be checked for extraneous entries. **Fail on catalog completeness**; arithmetic is unaffected.

---

## 8. Verdict

**Approve with a note.**

All figures recomputed independently match Expected. The rule, rate units, timing convention, and both wrong readings are correct and consistent with the signature extract. Tolerance is justified. No quoted constant disagrees with the extract.

**Note (non-arithmetic):** Add a `## Family` section naming `outputs: spending-base-annual` (and `feeds: none` per registry), and align structure with peer worksheets (`Justification`, `Provenance`) before marking provenance reviewed. The worksheet also has no named `## Justification` section (derivation lives under Arithmetic); that does not affect the math.

Reviewed by: cursor (composer), 2026-09-18, by independent recomputation without executing the engine.
