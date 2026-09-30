# Review, 2026-09-29 (grok-2: the second half of the Codex-derived records)

Reviewer: Grok (grok-4.7, xAI), headless and read-only, by independent recomputation without executing the engine, its tests or its scripts, on a snapshot of RetireGolden main at commit `6f668e06`. Scope: the 12 records below, derived by codex, so the reviewer is of a different agent family from the deriver (catalog gate 7): `aca-allowable-premium-tax-credit`, `aca-economic-net-premium`, `irmaa-lookback-selection`, `medicare-base-part-b-premium`, `allocation-cholesky-factor`, `rng-derived-path-seed`, `exact-ledger-conversion-execution`, `scenario-nullable-scalar-comparison`, `scenario-scalar-comparison`, `simple-candidate-evaluation-comparison`, `qcd-limit-and-age-proxy`, `balance-risk-guardrail-step`. Verdicts: 12 approve, 0 reject. The reviewer's scripts are in `DOCS/calculations/reviews/scripts/grok-2/` (recompute.py), and each runs from the repository root. The only edits to the report below replace the reviewer's own scratch-folder paths with those repository paths. Left out of that folder: cms2026.html, irb25-49.html, irb25-49.pdf, usc1395r.html, usc36b.html and usc408.html (2.1 MB), because they are the reviewer's downloads of the public pages the report cites by URL (the CMS 2026 premium fact sheet, IRB 2025-49 with Notice 2025-67, and 42 U.S.C. 1395r, 26 U.S.C. 36B and 26 U.S.C. 408 from uscode.house.gov), not arithmetic. Verbatim output follows.

---

# Independent review of calculation records

Reviewer: Grok (grok-4.7, xAI), headless, read-only.
Date: 2026-09-29.
Repository commit: `6f668e06`.
Scope: twelve records — `aca-allowable-premium-tax-credit`, `aca-economic-net-premium`, `irmaa-lookback-selection`, `medicare-base-part-b-premium`, `allocation-cholesky-factor`, `rng-derived-path-seed`, `exact-ledger-conversion-execution`, `scenario-nullable-scalar-comparison`, `scenario-scalar-comparison`, `simple-candidate-evaluation-comparison`, `qcd-limit-and-age-proxy`, `balance-risk-guardrail-step`.

Method: each worksheet was recomputed from its stated inputs and method. Arithmetic is in `DOCS/calculations/reviews/scripts/grok-2/recompute.py` (exact `Decimal` for money and the square root; a 32-bit `imul` for the path seed; IEEE 754 doubles for the near-singular Cholesky factor and the ratio). No file under `packages/` was imported, and no engine test or script was run. Function bodies were not used as the derivation. Primary-source sentences below are quoted only from pages fetched for this review (OLRC uscode.house.gov for the statutes; cms.gov for the 2026 premium; irs.gov IRB 2025-49 for Notice 2025-67).

---

## aca-allowable-premium-tax-credit

### Recomputed

Inputs: applicable SLCSP \(S = 12{,}000\), expected contribution \(C = 2{,}791.80\), enrollment premium \(E = 10{,}000\).

Preliminary credit: \(\max(0, 12{,}000 - 2{,}791.80) = 9{,}208.20\).

Enrollment cap: \(\min(10{,}000, 9{,}208.20) = 9{,}208.20\).

The contribution is the companion worksheet's figure, and it checks: two-person contiguous 2026 poverty line \(15{,}650 + 5{,}500 = 21{,}150\); \(42{,}300 / 21{,}150 = 2\) exactly, so 200% of the poverty line; the 2026 block's 200% breakpoint is 6.60%; \(42{,}300 \times 0.0660 = 2{,}791.80\). At an exact breakpoint neither the whole-number truncation nor the hundredth-of-a-percent rounding moves the rate.

### Match

Yes. \(9{,}208.20 = 9{,}208.20\).

### Tolerance

Absolute \(\$0.005\). The operands are exact cent amounts (2,791.80 is \(279{,}180/100\)) and the operations are one subtraction and a minimum, so the result is exact in cents. The half-cent band is wider than the binary representation of these particular cents (202.90-class values that are not dyadic, and 2,791.80 is \(27918/10\), which is not a binary fraction) and is the right order for a cent computed in binary floating point. Justified.

### Wrong readings checked

- Subtracting the enrollment premium rather than the SLCSP: \(10{,}000 - 2{,}791.80 = 7{,}208.20\), not \(9{,}208.20\).
- Omitting the zero floor: a contribution above the SLCSP, for example \(4{,}000\) against a \(3{,}000\) benchmark, gives \(-1{,}000\) instead of \(0\). Different number.

### Sources

26 U.S.C. 36B(b)(2), OLRC preliminary text fetched 2026-09-29: "The premium assistance amount determined under this subsection with respect to any coverage month is the amount equal to the lesser of— (A) the monthly premiums for such month for 1 or more qualified health plans … which were enrolled in through an Exchange …, or (B) the excess (if any) of— (i) the adjusted monthly premium for such month for the applicable second lowest cost silver plan …, over (ii) an amount equal to 1/12 of the product of the applicable percentage and the taxpayer's household income for the taxable year."

The record's formula is that sentence summed over twelve months: \(\sum_m \min(E_m, \max(0, S_m - C/12))\). The statute floors the excess at zero ("if any") and caps it at the enrollment premium ("the lesser of"). No departure in the worked case. The record's stated departure is elsewhere and named: Form 8962 rounds line 8b to a whole dollar and the engine does not. At exactly 200% that rounding changes this case by nothing, which the worksheet says.

### Record consistency

The statement, formula and limits describe the monthly sum the worksheet derives. The formula is the monthly form; the worksheet works the equal-month annual collapse of it, which is the same number when every month is enrolled at one twelfth. The limits name the unrounded contribution (at most about \(\$0.50\) a year on the annual path and about \(\$6\) on the monthly path) and the planning-math boundary. No overclaim.

### Evidence binding

`packages/engine/src/tax/aca.evidence.test.ts` asserts `modeledAllowablePtc` of `9_208.2` at absolute `0.005`, plus the enrollment cap at `2_000` and the zero floor. Headline value bound.

### Verdict

**Approve.**

---

## aca-economic-net-premium

### Recomputed

Gross enrollment \(E = 10{,}000\), modeled allowable credit \(P = 9{,}208.20\).

\(\max(0, 10{,}000 - 9{,}208.20) = 791.80\).

### Match

Yes. \(791.80 = 791.80\).

### Tolerance

Absolute \(\$0.005\). One subtraction of exact cent amounts. The half-cent band covers binary representation of a non-dyadic cent and is not hiding a rounding rule. Justified.

### Wrong readings checked

- Subtracting the credit from the SLCSP: \(12{,}000 - 9{,}208.20 = 2{,}791.80\), not \(791.80\).
- Reversing the subtraction and flooring: \(\max(0, 9{,}208.20 - 10{,}000) = 0\), not \(791.80\).

### Sources

The difference is the household's own premium after the credit defined by 26 U.S.C. 36B(b)(2), quoted above. Because that paragraph caps each month's credit at that month's enrollment premium, \(P \le E\) month by month and the annual difference cannot be negative. The worksheet's \(\max(0, E - P)\) is that consequence, not a second statutory clamp. The record says so in its limits: "The zero floor the worksheet states is enforced by the per-month enrollment cap inside the credit, not by a second clamp on the difference." No departure.

### Record consistency

Statement, formula (\(N = E - P\), each month's \(P\) capped at that month's \(E\)) and limits match the worksheet. Rounding is stated as none of its own, inherited from the credit. No overclaim.

### Evidence binding

`aca.evidence.test.ts` asserts `economicNetPremium` of `791.8` at absolute `0.005`, and a separate case that the net premium is `0` when the enrollment premium is \(1{,}200\) against the same benchmark. Headline value bound.

### Verdict

**Approve.**

---

## irmaa-lookback-selection

### Recomputed

Selection rule as stated: primary is year minus two; an active SSA-44 event replaces it only when year minus one's MAGI is strictly lower.

| Case | Comparison | Selected |
|---|---|---|
| Ordinary, 2028, no SSA-44 | no comparison | 2026, \(120{,}000\), projected |
| SSA-44 lower | \(90{,}000 < 120{,}000\) | 2027, \(90{,}000\), projected |
| SSA-44 tie | \(100{,}000 < 100{,}000\) is false | 2026, \(100{,}000\), projected |
| Premium year 2026, before the ledger | 2024 has a historical entry | 2024, \(125{,}000\), historicalInput |
| Premium year 2027, no 2025 historical entry | fall through to the coarse stand-in | 2025, \(80{,}000\), planFallback |

### Match

Yes, on all five selections. Year, dollars and source enum.

### Tolerance

Exact for the year and the source enum, and exact to the cent for MAGI. The selection compares and copies the supplied figures; it performs no arithmetic that could drift. The evidence file uses absolute \(\$0.005\) on the dollar, which is a looser band than the worksheet's "exact to the cent" and still contains the exact value. Justified.

### Wrong readings checked

- SSA-44 always selecting year minus one: the tie case returns 2027, \(100{,}000\), not 2026.
- Taking the lower value with no SSA-44 event: the ordinary case returns \(90{,}000\), not \(120{,}000\).
- Using the premium year's own MAGI: 2028, not 2026.
- Calling `recentAnnualMagi` historical evidence: the source enum is `planFallback`, not `historicalInput`.

### Sources

42 U.S.C. 1395r(i)(4)(B)(i), OLRC preliminary text fetched 2026-09-29: "In applying this subsection for an individual's premiums in a month in a year, subject to clause (ii) and paragraph (C), the individual's modified adjusted gross income shall be such income determined for the individual's last taxable year beginning in the second calendar year preceding the year involved."

42 U.S.C. 1395r(i)(4)(C)(i)–(ii): the Commissioner "shall establish a procedures under which an individual's modified adjusted gross income shall, at the request of such individual, be determined … for a more recent taxable year," and such a request "may be granted only if … the individual's modified adjusted gross income for such year is significantly less than such income for the taxable year determined under subparagraph (B) by reason of" a listed life-changing event.

Year minus two is the statute. Selecting a more recent year only when it is lower is the direction of "significantly less," and the strict comparison is why a tie keeps year minus two. Two planning approximations are not the statute and are not hidden: the alternate year is year minus one rather than the premium year's own estimated MAGI (the domain note says the current year is circular with withdrawals), and "significantly less" in the regulation is a drop that changes the charge band, not every dollar of difference. The record's kind is `model`, and its limits name the strict comparison and the coarse stand-in. The SSA-44 PDF itself returned HTTP 403, so the form's own wording was not quoted; the statutory sentence above is the operative one.

### Record consistency

Statement and formula (`primary = resolveMagiFor(y - 2)`; select year minus one only when `ssa44(y)` and its MAGI is strictly lower) are what the five cases derive. The limits name the tie, the `planFallback` arm, and that the fallback resolver is a closure inside `simulatePlan`. No overclaim.

### Evidence binding

`annualHealthcareExpenses.evidence.test.ts` asserts all five expected triples: ordinary `(2026, 120000, projected)`, SSA-44 lower `(2027, 90000, projected)`, tie `(2026, 100000, projected)`, first-year fallback `(2024, 125000, historicalInput)`, second-year fallback `(2025, 80000, planFallback)`. Headline values bound.

### Verdict

**Approve.**

---

## medicare-base-part-b-premium

### Recomputed

Standard monthly premium \(202.90\), tier 0, twelve months.

Part B annual: \(202.90 \times 12 = 2{,}434.80\).

Part D surcharge annual: \(0 \times 12 = 0\).

IRMAA surcharge annual: \(0\).

The record's formula writes `base × (applicablePct / 25) × premiumScale × 12` with `applicablePct = 25` and `premiumScale = 1` in a year CMS has published, which collapses to the same product.

### Match

Yes. \(2{,}434.80\), \(0\), \(0\).

### Tolerance

Absolute \(\$0.005\) on the Part B product, exact on the zeros. \(202.90 = 2029/10\) is not a binary fraction, so the product in IEEE 754 is not the exact decimal; the half-cent band is the right tolerance for publishing it as cents, and \(2{,}434.80\) is the exact decimal. Justified.

### Wrong readings checked

- Treating \(202.90\) as already annual: \(202.90\), not \(2{,}434.80\).
- Adding the pack's \(\$2{,}100\) Part D out-of-pocket threshold: \(2{,}434.80 + 2{,}100 = 4{,}534.80\), not \(2{,}434.80\).

### Sources

CMS, "2026 Medicare Parts A & B Premiums and Deductibles," cms.gov newsroom fact sheet fetched 2026-09-29: "The standard monthly premium for Medicare Part B enrollees will be $202.90 for 2026, an increase of $17.90 from $185.00 in 2025."

Annualizing twelve monthly charges is the worksheet's own step, not a second published figure. The fact sheet's IRMAA table confirms the standard row carries no income-related adjustment at or below the first threshold, so tier 0 has a zero surcharge. No departure.

### Record consistency

The statement says the 2026 standard premium times twelve, with no Part D surcharge and no IRMAA surcharge at tier 0. The formula adds the applicable-percentage ratio and the premium scale, both 1 in this case, so the number does not move. The D-2027-ROLLOVER limit says the scale runs from CMS's own publication year and that, until CMS publishes 2027, the scale from 2026 is the one used before. The worksheet's restatement says the same and says no figure moves. "Rounding: none stated" matches a product that is not further rounded. No overclaim.

### Evidence binding

`medicare.evidence.test.ts` asserts `partBAnnual` of `2_434.8`, `partDSurchargeAnnual` of `0` and `irmaaSurchargeAnnual` of `0` at absolute `0.005`, and a second block asserts that a 2028 view still reads CMS's 2026 premium of `202.9`. Headline values bound.

### Verdict

**Approve.**

---

## allocation-cholesky-factor

### Recomputed

Matrix \(A = \begin{bmatrix} 1 & 0.5 \\ 0.5 & 1 \end{bmatrix}\).

\(L_{11} = \sqrt{1} = 1\).

\(L_{21} = 0.5 / 1 = 0.5\).

\(L_{22} = \sqrt{1 - 0.5^2} = \sqrt{3}/2\).

At 80 decimal places, \(\sqrt{3}/2 = 0.86602540378443864676\ldots\). The worksheet prints \(0.866025403784439\), which is that value rounded to 15 digits after the decimal. Absolute difference \(3.53 \times 10^{-16}\).

Reconstruction: off-diagonal \(1 \times 0.5 + 0 \times L_{22} = 0.5\); second diagonal \(0.25 + 0.75 = 1\).

The record's near-singular limit, recomputed in IEEE 754 doubles rather than exact rationals (the pivot is a floating-point cancellation): for \(r = 1 - 10^{-13}\), the pivot \(1 - r^2\) is exactly the double `2.000621890374532e-13`, and its square root is exactly the double `4.4728311955343587e-7`. Both equal the record's stated values. (In exact arithmetic the pivot is \(1.9999999999999 \times 10^{-13}\) and the square root is about \(4.47213595 \times 10^{-7}\); the record is stating the floating-point factor, which is what the function computes.)

### Match

Yes. Every entry is within \(1 \times 10^{-12}\).

### Tolerance

Absolute \(1 \times 10^{-12}\). The only inexact entry is a square root printed to 15 decimals; the error is about \(3.5 \times 10^{-16}\), four orders inside the band. Justified.

### Wrong readings checked

- \(\sqrt{1 - r} = \sqrt{0.5} \approx 0.707106781186548\), against the worksheet's \(0.7071067812\). Different from \(0.866025403784439\) by about \(0.159\).
- A symmetric factor leaves the upper-right entry at \(0.5\), not \(0\).

### Sources

This record cites no statute. The method is the Cholesky factorization: for a positive-definite matrix, \(L_{ii} = \sqrt{A_{ii} - \sum_{k<i} L_{ik}^2}\) and \(L_{ij} = (A_{ij} - \sum_{k<j} L_{ik} L_{jk}) / L_{jj}\) for \(i > j\). The 2×2 closed form \([[1, 0], [r, \sqrt{1-r^2}]]\) follows from that definition, and \(LL^\top = A\) was checked by multiplication. A pivot of 0 (the perfectly correlated pair \(r = 1\)) or a negative pivot (an indefinite matrix) has no factor with a positive diagonal, which is the refusal the claim states. No departure.

### Record consistency

Statement and formula are the factorization the worksheet derives, including the refusal when a pivot is not positive. The limits name the refusal, the one input whose factor changed (the positive pivot below \(10^{-12}\), with the floating-point value I recomputed), that symmetry is not checked, and that a 2×2 is the worksheet case rather than a live allocation. No overclaim.

### Evidence binding

`assetClasses.evidence.test.ts` asserts \(L = [[1, 0], [0.5, 0.866025403784439]]\) at absolute \(1 \times 10^{-12}\), the reconstruction of the off-diagonal \(0.5\) and the unit diagonal, and a `RangeError` for \(r = 1\) (pivot 0) and \(r = 2\) (pivot \(-3\)). Headline value bound. The near-singular factor is stated in the record's limits and is not a separate expected row in this test; the number itself was recomputed above.

### Verdict

**Approve.**

---

## rng-derived-path-seed

### Recomputed

Script: `DOCS/calculations/reviews/scripts/grok-2/recompute.py`, a 32-bit wrapping multiply matching `Math.imul`, with `>>> 0` as the unsigned reinterpretation. The recurrence is the one the worksheet prints.

| Case | h0 | h1 | h2 | result |
|---|---:|---:|---:|---:|
| (42, 7) | 4055616994 (`0xf1bbcde2`) | 3188384293 (`0xbe0ae225`) | 1351138896 (`0x5088be50`) | **1351098177** (`0x50881f41`) |
| (42, 8) | 2415085483 (`0x8ff347ab`) | 1430836088 (`0x5548d378`) | 2451037551 (`0x9217dd6f`) | **2450979136** (`0x9216f940`) |
| (1, 0) | 2654435768 (`0x9e3779b8`) | 2426171811 (`0x909c71a3`) | 3950234221 (`0xeb73ca6d`) | **3950124170** (`0xeb721c8a`) |

Every intermediate word matches the worksheet's table, not only the results. \(1351098177 \ne 2450979136\).

### Match

Yes. All three seeds, exactly.

### Tolerance

Exact. The arithmetic is 32-bit integer wrapping; there is no rounding to tolerate. Justified.

### Wrong readings checked

- Using `pathIndex` instead of `pathIndex + 1` for (42, 7): `640652096` (`0x262f9340`), not `1351098177`.
- Omitting the final `h2 XOR (h2 >>> 15)` fold for (42, 7): `1351138896` (`0x5088be50`), not `1351098177`.
- Signed reinterpretation without the final unsigned conversion: (42, 8) is \(-1843988160\) (since \(2450979136 - 2^{32} = -1843988160\)); (1, 0) is \(-344843126\) (since \(3950124170 - 2^{32} = -344843126\)). Same bits, different published numbers.

### Sources

No statute. The method is the recurrence the worksheet states in full, and the recomputation follows that recurrence rather than a remembered implementation of SplitMix or lowbias32. The golden-ratio constant \(0x9e3779b9\) and the two lowbias32 multipliers \(0x21f0aaad\), \(0x735a2d97\) appear in the stated steps. No departure from the stated method.

### Record consistency

The statement quotes the four-step recurrence and the three unsigned words. The formula is the same recurrence. The limits say the construction is not cryptographic and that adjacent indices are mixed by `pathIndex + 1` rather than used as `seed + index`, which is what the first wrong reading shows. No overclaim.

### Evidence binding

`rng.evidence.test.ts` asserts the three seeds `1351098177`, `2450979136`, `3950124170` at tolerance `'exact'`, and that the first two differ. Headline values bound.

### Verdict

**Approve.**

---

## exact-ledger-conversion-execution

### Recomputed

Requested: \(40{,}000 + 20{,}000 + 10{,}000 = 70{,}000\).

Executed: \(30{,}000 + 19{,}000 + 10{,}000 = 59{,}000\).

Ratio: \(\min(1, 59{,}000 / 70{,}000) = 59/70 = 0.842857142857142857\ldots\). The printed `0.8428571428571429` is that quotient to 16 significant digits, and it is the IEEE 754 value of the division.

2030: shortfall \(10{,}000\); margin \(\max(1{,}000, 40{,}000 \times 0.05) = \max(1{,}000, 2{,}000) = 2{,}000\); \(10{,}000 > 2{,}000\), so 2030 qualifies and is first.

2031: shortfall \(1{,}000\); margin \(\max(1{,}000, 1{,}000) = 1{,}000\); \(1{,}000 > 1{,}000\) is false.

2032: shortfall \(0\), margin \(1{,}000\); does not qualify.

Null-margin branch: 2040 shortfall \(1{,}000\), margin \(\max(1{,}000, 1{,}000) = 1{,}000\); strict comparison false, so null.

Zero-request branch: the stated special case is exactly 1, with no division.

The restated whole-schedule flag, checked against the cases the worksheet added: ten years of \(10{,}000\) requesting \(100{,}000\). Each executing \(9{,}100\) is \(900\) short, inside \(\max(1{,}000, 500)\), so no year qualifies, while the schedule is \(9{,}000\) short of a \(\max(1{,}000, 5{,}000) = 5{,}000\) margin, so the flag is false. Each executing \(9{,}500\) is \(5{,}000\) short, equal to the margin; "more than" fails, so the flag is true. One year \(2{,}000\) short of \(10{,}000\) clears \(\max(1{,}000, 500)\), so the flag is false.

### Match

Yes, on the total, the ratio, year 2030, the null branch and the zero-request ratio.

### Tolerance

Absolute \(\$0.005\) on the dollar sum: the summands are whole dollars, exactly representable, so the band is slack but contains the exact value. Absolute \(1 \times 10^{-9}\) on the ratio: \(59/70\) is not a short binary fraction, and the printed 16-digit value is the double; \(10^{-9}\) is far wider than a double's error on this quotient and far tighter than a wrong digit in the printed expansion. Exact on the year and on the null. Justified.

### Wrong readings checked

- Uncapped ratio on \(12{,}000\) executed against \(10{,}000\) requested: \(1.2\), against the capped \(1\).
- One margin from the \(70{,}000\) total: \(\max(1{,}000, 3{,}500) = 3{,}500\) for every year, not 2030's \(2{,}000\) and 2031's \(1{,}000\).
- Inclusive comparison: the 2040 shortfall of exactly \(1{,}000\) would qualify and return 2040 instead of null.
- Dividing in the zero-request branch: \(0/0\) is `NaN`, not \(1\).

### Sources

No statute. The method is the field convention the worksheet states: sum the requested schedule, sum the executed rows, cap the ratio at 1, and take the first ascending year whose shortfall is strictly more than the per-year margin. The constants \(1{,}000\) and \(0.05\) are the worksheet's inputs. The 2026-09-27 restatement names the left-to-right sum from zero; addition of these three whole dollars is associative, so the order does not move the figure. No departure.

### Record consistency

The statement and formula now also publish `executedWithoutMaterialShortfall`: no year short by more than its margin, and the whole schedule not short by more than \(\max(1{,}000, 5\%\) of the requested total) with at least the minimum requested. That is what the restated section derives, and the three band cases there recompute as stated. The limits name the per-year margin, the strict comparison, the cap at 1, and the zero-request branch. No overclaim.

### Evidence binding

`optimizePlan.evidence.test.ts` asserts `requestedConversionTotal` of `70_000` at absolute `0.005`, the ratio `0.8428571428571429` at absolute `1e-9`, `firstMateriallyUnexecutedYear` of `2030`, the inside-margin year of `null`, the zero-request ratio of `1`, and the over-executed ratio of `1`. `optimizePlan.materialShortfall.test.ts` asserts the restated flag: false for ten years executing \(9{,}100\), true for \(9{,}500\), false when one year executes \(8{,}000\). Headline values bound.

### Verdict

**Approve.**

---

## scenario-nullable-scalar-comparison

### Recomputed

Both present: \(2044 - 2041 = 3\).

Baseline absent: one operand is null, so no subtraction is defined and the delta is null.

### Match

Yes. Delta `3`, and `null`.

### Tolerance

Exact. Both operands are integers and the only operation is a subtraction of integers, or a refusal to subtract. Justified.

### Wrong readings checked

- Reversing the subtraction: \(2041 - 2044 = -3\), not \(3\).
- Coercing null to zero: \(2044 - 0 = 2044\), a number where the method requires null.

### Sources

No statute. The method is the comparison convention the worksheet states: publish the difference only when both values exist. Absence is not zero. No departure.

### Record consistency

Statement and formula (`delta = proposal - baseline` when both are non-null, else null) are what the two cases derive. The restatement adds a negative-zero normalization and a `RangeError` on a non-finite present value; neither changes the worksheet's two cases, and the limits still say absence is not zero. No overclaim.

### Evidence binding

`comparisonCells.evidence.test.ts` asserts a present delta of `3` and an absent delta of `null`, both through `compareScenarioPlans` and directly on `compareNullableScalars`, and refuses a non-finite present value with a `RangeError`. Headline values bound.

### Verdict

**Approve.**

---

## scenario-scalar-comparison

### Recomputed

Baseline \(120{,}000.00\), proposal \(95{,}000.00\).

Delta: \(95{,}000.00 - 120{,}000.00 = -25{,}000.00\).

### Match

Yes. Baseline, proposal and delta all match.

### Tolerance

Exact to the cent. Both operands are whole dollars, exactly representable, and the operation is one subtraction. The evidence band of absolute \(\$0.005\) contains the exact cent. Justified.

### Wrong readings checked

- Baseline minus proposal: \(+25{,}000.00\), not \(-25{,}000.00\).
- Dividing by the baseline: \(-25{,}000 / 120{,}000 = -0.2083333\ldots = -20.8333333333\%\), a relative change, not the same-unit delta.

### Sources

No statute. The method is the signed identity the worksheet states, proposal minus baseline, in the metric's own unit. No departure.

### Record consistency

Statement and formula are that identity. The restatement adds the negative-zero normalization and the `RangeError` on a non-finite operand or difference, and it says which callers use the helper and which still subtract directly. Neither addition changes the worked case. No overclaim.

### Evidence binding

`comparisonCells.evidence.test.ts` asserts baseline `120000.00`, proposal `95000.00` and delta `-25000.00` at absolute `0.005`, both through `compareScenarioPlans` and directly on `compareScalars`, and asserts that a negative zero is published as `0` and that a non-finite operand throws a `RangeError`. Headline values bound.

### Verdict

**Approve.**

---

## simple-candidate-evaluation-comparison

### Recomputed

Executed conversions: \(12{,}500.25 + 7{,}500.50 = 20{,}000.75\).

After-tax estate delta: \(525{,}250.25 - 500{,}000.00 = 25{,}250.25\).

Lifetime-tax delta: \(127{,}500.75 - 120{,}000.00 = 7{,}500.75\).

Money lasts: baseline depletes in 2034, so the last funded year is \(2034 - 1 = 2033\); the candidate never depletes, so its last funded year is its end year, 2035. Delta: \(2035 - 2033 = 2\). The retired count, \(2036 - 2034\), is the same 2.

Incomplete years: baseline \(\{2031\}\), candidate \(\{2030, 2031\}\). Union, sorted: \([2030, 2031]\). The all-complete branch unions to the empty set, and the worksheet says the published object then omits the key.

### Match

Yes, on all five outputs.

### Tolerance

Absolute \(\$0.005\) on the three dollar figures. The summands and the subtrahends are exact cents; the operations are one addition and two subtractions. The half-cent band covers binary representation of non-dyadic cents (`.25` and `.50` and `.75` are in fact dyadic, so these particular values are exact in binary too). Exact on the year count and on the list. Justified.

### Wrong readings checked

- Reversing candidate minus baseline: estate \(-25{,}250.25\), lifetime tax \(-7{,}500.75\), money-lasts \(-2\).
- Counting the depleting baseline through its depletion year while the other side is funded through its end year: \(2035 - 2034 = 1\), not \(2\).
- Concatenating without a set union: \([2031, 2030, 2031]\), not \([2030, 2031]\).
- Publishing an empty list where the convention omits the key: a different published object, which the worksheet rules out.

### Sources

No statute. The method is the field convention the worksheet states, including owner decision R15: the last fully funded year is `depletionYear − 1`, or `endYear` when the result never depletes. Both conventions shift each result by the same year, so the delta is unchanged, which the arithmetic confirms. No departure.

### Record consistency

Statement and formula are the sum, the three candidate-minus-baseline differences, and the sorted union published only when non-empty. The limits name the direction of the subtraction, the R15 year shift, the omitted key, and that `recommendationState` is not published by this record. No overclaim.

### Evidence binding

`optimizePlan.evidence.test.ts` asserts `executedConversionTotal` of `20_000.75`, `afterTaxEstateDelta` of `25_250.25`, `lifetimeTaxDelta` of `7_500.75` at absolute `0.005`, `moneyLastsYearsDelta` of `2`, `incompleteComputationYears` of `[2030, 2031]`, and that the no-incomplete branch omits the key while the empty union it stands for is `[]`. Headline values bound.

### Verdict

**Approve.**

---

## qcd-limit-and-age-proxy

### Recomputed

2026 per-donor cap: \(111{,}000 \times 1 = 111{,}000\).

Age 71, December, requesting \(111{,}000\): eligible regardless of birth month, and the request equals the cap, so \(111{,}000\).

Age 70, June, requesting \(1{,}000\): June is "June or earlier," and \(1{,}000\) is inside the cap, so \(1{,}000\).

Age 70, July, requesting \(1{,}000\): July is after June, so \(0\).

The growth factor the restatement states, at 2.5% inflation from a 2026 publication: \(1.025^2 = 1.050625\) in 2028. No worksheet figure moves, because the worked cases are the published year, where the factor is 1.

### Match

Yes. \(111{,}000\), \(1{,}000\), \(0\).

### Tolerance

Exact to the cent, and an exact boolean on the age gate. The pack value is a whole dollar, the growth factor in the worked cases is 1, and the gate is a comparison of integers. The evidence band of absolute \(\$0.005\) contains the exact cent. Justified.

### Wrong readings checked

- Treating every attained-70 donor as eligible: the July case would give \(1{,}000\), not \(0\).
- Requiring attained age 71: the June case would give \(0\), not \(1{,}000\).
- Capping per household rather than per donor: two eligible donors would share \(111{,}000\) instead of holding \(222{,}000\).
- Applying the growth factor twice: \(111{,}000 \times 1 \times 1\) does not move this year; in a later year it would square the factor (\(1.050625^2\) instead of \(1.050625\)).

### Sources

IRS, Internal Revenue Bulletin 2025-49, Notice 2025-67, fetched from irs.gov on 2026-09-29: "The aggregate amount of qualified charitable distributions that are not includible in gross income under section 408(d)(8)(A) is increased from $108,000 to $111,000." The per-donor reading follows from "with respect to a taxpayer" in section 408(d)(8)(A). The \(\$111{,}000\) cap matches.

26 U.S.C. 408(d)(8)(B)(ii), OLRC preliminary text fetched 2026-09-29: a qualified charitable distribution is one "which is made on or after the date that the individual for whose benefit the plan is maintained has attained age 70½." (The HTML extractor dropped the fraction glyph; the sentence is the age-70½ attainment sentence.)

The annual proxy — eligible at attained 71, or at attained 70 when the birth month is June or earlier — is not that dated test. A July-born donor attaining 70 is refused for the whole year even though the statute would admit the second half, and a January-born donor is admitted for the months before the half-birthday. The record's first limit says exactly that. The departure is named, not silent.

### Record consistency

Statement, formula and limits describe the cap and the proxy the worksheet derives. The D-2027-ROLLOVER limit says the growth factor reads the QCD limit's own notice, that the worked year is unchanged, and that the named arm executes only in a year whose limit is published. No overclaim.

### Evidence binding

`annualLegacyQcdGiftPlan.evidence.test.ts` asserts the per-donor cap of `111_000`, the at-cap gift of `111_000`, the June gift of `1_000`, the July gift of `0`, and a two-donor plan at `222_000`. A second block asserts the growth factor is `1` in 2026 and the inflation path from 2026 in 2028. Headline values bound.

### Verdict

**Approve.**

---

## balance-risk-guardrail-step

### Recomputed

Previous multiplier \(0.8\), current real balance \(70\), starting balance \(100\), lower threshold \(80\) percent, adjustment \(10\) percentage points.

Lower dollar trigger: \(100 \times 0.80 = 80\).

\(70 < 80\), so the multiplier moves one step down: \(0.8 - 0.10 = 0.7\), action `cut`.

The step of \(0.10\) is more than \(10^{-9}\), so the action is `cut` rather than a held clamp.

### Match

Yes. \(\{multiplier: 0.7, action: cut\}\).

### Tolerance

Absolute \(1 \times 10^{-12}\). The operands are dyadic rationals (\(0.8 = 4/5\) is not dyadic, but \(0.8 - 0.1 = 0.7\) is the exact decimal the worksheet prints, and the error of representing \(0.8\) and \(0.1\) in binary is about \(10^{-17}\), five orders inside the band). Justified.

### Wrong readings checked

- Using 80 as a fraction of the starting balance rather than a percent: the threshold would be \(80 \times 100 = 8{,}000\), and a \(70\) balance would still be below it, so this particular case does not discriminate. The worksheet's point is the threshold itself (\(8{,}000\) against \(80\)), which is a different number, and on any balance between \(80\) and \(8{,}000\) it would cut where the percent reading holds. The reading is different; the worked case happens not to show it in the action.
- Comparing a nominal current balance with a real starting balance: not a number the worksheet computes, and it can suppress or create the trigger depending on the inflation factor. No numeric contradiction.

### Sources

No statute. The method is the decision rule the worksheet states: compare the deflated balance with a percent of the starting real balance, and move one adjustment step when the balance is outside the band. The record's formula also holds when a threshold is unset, when the pair is inverted, or when the starting balance is not positive; the worksheet's justification states the hold, and the evidence asserts the unset and inverted holds. No departure.

### Record consistency

Statement and formula are the comparison the worksheet derives, including the holds the worked case does not exercise. The 2026-09-27 restatement changes where the dollar thresholds are published (`guardrailThresholdDollars` rather than a page re-deriving them) and adds `display-guardrail-balance-thresholds` to the feeds. That does not change the worked example, and the limits say the pages now read the published thresholds. No overclaim.

### Evidence binding

`guardrails.evidence.test.ts` asserts multiplier `0.7` at absolute `1e-12` and action `'cut'`, plus a hold when no threshold is set and a hold when the lower threshold is not below the upper. Headline value bound.

### Verdict

**Approve.**

---

## Counts

Approve: 12. Reject: 0.
