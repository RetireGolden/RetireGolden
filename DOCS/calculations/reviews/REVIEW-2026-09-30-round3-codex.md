# Review, 2026-09-30 (round3-codex)

Reviewer: Codex (GPT-6-Sol, high reasoning), headless and read-only, by independent recomputation without executing the engine, on a snapshot of branch `claude/evidence-completeness` at `45efae57`. Scope: the nine calculation records derived by Claude that the evidence-completeness branch added or restated (the MCP families, the five freeze families, and state-enacted-tax-year-figures). Verdicts: 9 approve, 0 reject. The only edits to the report below replace local paths with repository paths. Its one wording note (optimizer-candidate-trailing-estate-gap: list case B's wrong-reading gaps in candidate order) was applied to that worksheet as a one-line correction. Verbatim output follows.

---

# Independent calculation-record review

Reviewer: Codex (GPT-6-Sol, high reasoning), headless, read-only  
Date: 2026-09-30 (America/New_York)  
Repository commit: `45efae57` (supplied snapshot; no `.git` metadata)  
Scope: the nine specified calculation records, in the requested order. I read records, worksheets, cited authority, and evidence tests. I did not run the engine, its tests or scripts, import `packages/`, or read the bodies of functions named by `implementedByFunctions`. Arithmetic below was recomputed from the stated inputs with hand arithmetic and independent Python `decimal`/binary-float calculations.

## entered-balance-sheet

### Recomputed

A: investable = 40,000 + 300,000 + 500,000 + 120,000 + 25,000 + 15,000 = 1,000,000; assets = 1,000,000 + 650,000 = 1,650,000; debt = 210,000; net = 1,440,000. Pension and annuity contribute no stored balance. B: 10,000 + 200,000 = 210,000 assets, less 350,000 = −140,000 net. C is five zeros. D: investable 500,000, property 650,000, assets/net 1,150,000, debt zero. E: left-to-right binary floating point gives `(0 + 0.1) + 0.2 + 0.3 = 0.6000000000000001`. The separately quoted example-library totals cannot be independently regenerated from this worksheet alone without the examples and forbidden engine execution; they are parity observations, not oracle inputs.

### Match

All explicit A–E expected fields match.

### Tolerance

Exact is justified for integer-dollar cases and for E's specified operation order in binary floating point. It is operation-order exactness, not decimal exactness. The whole-dollar UI formatting is separate.

### Wrong readings checked

Counting the two monthly payments as balances gives A investable 1,003,500 (annualizing them gives 1,042,000); omitting property gives net 790,000; adding debt to assets gives 1,860,000; ignoring D's filter gives 1,650,000 assets rather than 1,150,000. The worksheet gives no projection growth or cash-flow input for its projected-first-year alternative, so that alternative cannot be assigned a numerical value from this case.

### Sources

The balance-sheet identity and choice to use entered account figures are disclosed definitions; no statute or external table is cited or needed. The worksheet's account classification is its operative source for the arithmetic.

### Record consistency

Statement, formula, outputs, empty feeds, and limits match the derived entered amounts and distinguish them from projections. The pension/annuity and non-account exclusions are disclosed.

### Evidence binding

`enteredBalanceSheet.evidence.test.ts` directly asserts A–E, three numerical wrong readings, nonfinite refusal, and the investable-portfolio equality. The planner parity test compares household and scoped views with the retired node sum, without independently establishing the worksheet's example-library totals.

### Verdict

**approve**. The unspecified projected-first-year alternative is a nonnumeric note, not a conflicting expected value.

## mcp-batch-ending-traditional-objective

### Recomputed

The last row's two traditional balances are 240,500.25 + 310,250.50 = 550,750.75.

### Match

The sole expected objective matches.

### Tolerance

$0.005 is conservative for two cent-valued binary doubles; these two operands and their sum are exactly representable in binary.

### Wrong readings checked

Penultimate row 570,000; add HSA 572,750.75; add Roth 700,750.75; first traditional only 240,500.25; after 25% heir tax 413,063.0625, displayed 413,063.06; every investable balance 819,750.75. Each differs from 550,750.75.

### Sources

This is a named ledger summary, with no external law or table cited. The worksheet's quoted account types and final-row definition support the selection; the 25% heir rate is only a counterexample input.

### Record consistency

The statement, sum formula, nominal gross units, outputs, empty feeds, and limits agree. The record discloses adapter/engine addition-order differences and gross-versus-after-tax meaning.

### Evidence binding

`compareSummary.mcpObjectives.evidence.test.ts` asserts 550,750.75, rejects all six listed numerical alternatives, and checks the prior adapter's selection within half a cent.

### Verdict

**approve**.

## monte-carlo-lasting-path-count

### Recomputed

A: 5 failing + 5 lasting = 10, success share 5/10 = 0.5, histogram sum 5. C: 8 lasting, 0 failing. E: 850 + 150 = 1,000. G: 3 meeting-floor lasting + 2 below-floor lasting = 5 lasting, with 1 failing, so 6 total and meeting-floor share 3/6 = 0.5. An empty sample gives zero of each type.

### Match

All A, C, E, G and empty-sample expected counts match.

### Tolerance

Path counts and histogram counts are integers, so exact tolerance is appropriate.

### Wrong readings checked

Meeting the required floor gives 3 rather than G's 5 lasting. Counting the seven histogram years in E gives 7 rather than 150 failing. Counting histogram rows in A happens to give 5, and `pathCount × successRate` happens to give the same count in these cases; those two subexamples do not discriminate, as the worksheet acknowledges for the latter.

### Sources

The meaning of a lasting path is the worksheet's disclosed simulation definition, not a statutory or published-table claim. Counting null versus populated first-depletion years supports the formula.

### Record consistency

The statement, partition formula, counts, outputs, empty feeds, and required-spending limit agree with the cases.

### Evidence binding

`run.lastingPaths.evidence.test.ts` asserts A, C, E, G, the empty sample, histogram sum, and floor counterexample. The planner parity test compares page fields with the retired arithmetic on examples.

### Verdict

**approve**. The row-count alternative is discriminating in E, though not A.

## monte-carlo-median-depletion-year

### Recomputed

A: the 3rd of 5 failures is 2042. B: the lower middle (2nd of 4) is 2040. C has no failures, hence null. D: the 3rd of 5 is 2040. E: cumulative counts 40 then 100 cross half of 150 (75) in 2050. An empty sample also gives null.

### Match

All A–E and empty-sample results match.

### Tolerance

The selected year is an integer from the input histogram; exact comparison is justified.

### Wrong readings checked

Treating A's five lasting paths as later than every failure makes the lower median of ten 2060. B's upper middle is 2045 and arithmetic midpoint is 2042.5. The median of D's three distinct year labels is 2050 rather than the weighted 2040.

### Sources

The lower-median convention is explicitly defined by the worksheet's cumulative-count rule. There is no cited external legal or tabular authority.

### Record consistency

The statement and formula specify failing paths only, the lower even-count median and null for zero failures; limits and output match.

### Evidence binding

`run.depletionMedian.evidence.test.ts` asserts A–E and empty, including the all-paths, upper-middle and distinct-year alternatives. The planner parity test checks the retired walk on examples.

### Verdict

**approve**.

## mcp-compare-ending-after-tax-estate-delta

### Recomputed

A: 1,500,000 cash + 400,000 IRA − 100,000 heir tax = 1,800,000. B: 1,400,000 + 800,000 − 200,000 = 2,000,000. B − A = +200,000 nominal. Independently using exact decimal powers: 1,800,000 / 1.025^24 = 995,175.6375339201; 2,000,000 / 1.025^28 = 1,001,755.5672365133; their 2026-dollar difference is 6,579.9297025932.

### Match

Both ending estates, the nominal delta, and the separate real-dollar comparator match.

### Tolerance

The nominal values are exact on these zero-return, whole-dollar inputs. $0.005 is adequate for the decimal inflation-power comparator rounded to cents.

### Wrong readings checked

A − B = −200,000; ignoring heir tax gives 2,200,000 − 1,900,000 = 300,000; deflating each to 2026 gives +6,579.93. All differ from the nominal +200,000.

### Sources

This is a disclosed product field convention, not a claim of tax-law computation. The worksheet's 25% heir tax is an assumed input, and its zero-tax calculator deliberately leaves tax law outside this fixture. No external primary source is cited.

### Record consistency

Statement, formula, output, empty feeds, sign, negative-zero rule, and limits match. It explicitly warns that subtracting nominal estates from 2050 and 2054 mixes year-dollar bases.

### Evidence binding

`comparison.mcpDelta.evidence.test.ts` asserts both estates, +200,000, all three wrong readings, distinct end years, and parity with the prior adapter subtraction.

### Verdict

**approve**.

## optimizer-candidate-trailing-estate-gap

### Recomputed

A benchmark 48,000 yields gaps null, 5,500, 38,000. B benchmark 30,000 yields 5,000, 18,000. C benchmark max(0, 900, 600, −200) = 900 yields null, 300, 1,100. D benchmark zero yields 200, 50. E's binary-float subtraction 0.3 − 0.1 is 0.19999999999999998.

### Match

All A–E benchmark and gap values match.

### Tolerance

Exact comparison is appropriate for these integer inputs and for the explicitly specified IEEE-754 subtraction in E.

### Wrong readings checked

Using the best candidate in A gives 48,700 − 42,500 = 6,200, not 5,500. Ignoring B's withheld winner makes the benchmark 25,000 and gives gaps **null, 13,000** in candidate order (25,000 then 12,000). The worksheet says “13,000 and none” in reverse order; the evidence test has the correct order. Candidate minus benchmark produces negative amounts (for example −5,500 in A). No alternate objective data is supplied for a numerical non-estate-metric counterexample.

### Sources

This is the report's disclosed comparison convention. The worksheet cites no statute or external table; the common-baseline estate-delta identity supports subtracting the two deltas.

### Record consistency

Statement, formula, output, empty feeds, and limits match the computed helper. The limit correctly discloses that a no-validation fallback may still be labelled “selected recommendation” in report prose even though the benchmark candidate was not selected.

### Evidence binding

`candidateTrailingEstate.evidence.test.ts` asserts all A–E benchmark and gap values and rejects the best-candidate and withheld-winner mistakes. The planner parity test checks report sentences against the retired rule.

### Verdict

**approve**, with a wording note: put B's wrong-reading gaps in candidate order as “none and 13,000.”

## ss-bridge-ladders-total-cost

### Recomputed

A: 85,000 + 55,216.54 = 140,216.54. B: 40,814.65. C: 0. D: left-to-right binary-float sum 0.1 + 0.2 + 0.3 = 0.6000000000000001.

### Match

All A–D expected values match.

### Tolerance

Exact is justified for these specified left-to-right double operations: their results compare to the same binary-float literals, including the correctly rounded cent literal in A. It is not a general guarantee of exact decimal arithmetic.

### Wrong readings checked

First bridge only is 85,000; mean of A's two quotes is 70,108.27, both different from 140,216.54. The worksheet supplies no annual payout amounts or covered-bridge quote with which to compute its other conceptual alternatives.

### Sources

The amount is the sum of quoted bridge prices, not a statutory price or a new SSA benefit formula. No primary legal or published-table sentence is cited for the addition itself; yield-curve construction is outside this record.

### Record consistency

Statement, formula, output, empty feeds, and limits agree. The limits disclose the duplicate-id case where the button's displayed sum can include a bridge its add action skips, and the Insights card's different claimant scope.

### Evidence binding

`bridge.totalCost.evidence.test.ts` directly asserts A–D, first-only and average counterexamples, operation order, and nonfinite refusal. The planner parity test checks the offered-list sum and formatting on examples.

### Verdict

**approve**. The disclosed duplicate-id button discrepancy is a product issue, not an incorrect sum of the offered quotes.

## mcp-batch-cumulative-tax-objective

### Recomputed

Tax = 18,250.40 + 21,030.15 + 0 + 24,410.62 = 63,691.17; penalties = 0 + 2,500 + 0 + 1,000.35 = 3,500.35; total = 67,191.52. Row sums are 18,250.40, 23,530.15, 0, and 25,410.97; they also sum to 67,191.52.

### Match

The expected objective and all row/column totals match.

### Tolerance

$0.005 covers binary-float error far above the actual few operations on these cent-valued inputs while still discriminating the listed dollar-scale alternatives.

### Wrong readings checked

Tax only 63,691.17; adding the already included AMT 68,391.52; adding IRMAA 68,296.72; final row only 25,410.97; tax plus only final-year penalty 64,691.52. Each differs.

### Sources

The worksheet cites the result-field contracts for `tax`, `penalties`, `amt`, and `irmaaSurcharge`, rather than claiming a statutory tax calculation. IRC §4974 is named only as a penalty category; no §4974 rate is derived here. The annual tax field is an input to this sum.

### Record consistency

Statement, formula, output, empty feeds, nominal undiscounted units, and limits match. The adapter/engine order difference is disclosed.

### Evidence binding

`compareSummary.mcpObjectives.evidence.test.ts` asserts 67,191.52, all five numerical wrong readings, and the old adapter reduction within half a cent.

### Verdict

**approve**.

## state-enacted-tax-year-figures

### Recomputed

This is a restatement of the limit only. The 24 published worksheet tax cases and formulas are unchanged from the earlier independent Codex review and its approval on recheck (`DOCS/calculations/reviews/REVIEW-2026-09-29-codex-3-longevity-ladders-taxes.md` and `REVIEW-2026-09-30-recheck-codex.md`). For spot confirmation, the unchanged Nebraska example remains 8,250×0.0246 + 41,280×0.0351 + 50,470×0.0399 = 3,665.631; the Rhode Island base remains 116,667.52 and its 2027 million-dollar 1% surtax makes 126,667.52. The new military-pension limit adds no arithmetic to those households, which contain no military pension. A Wisconsin under-67 filer with a federally included qualifying military pension of $P would have an allowed military subtraction up to $P under the cited instruction; the record discloses that the engine currently treats it by general retirement rules instead. No $P is specified, so no tax-dollar correction can be computed here.

### Match

No worksheet expected value changed. The previously recomputed 24 amounts remain unchanged by the new wording; the new Wisconsin counterexample has no worksheet amount to match.

### Tolerance

The unchanged worksheet uses $0.005 on decimal rate results and is adequately discriminating. The new limit is categorical, with no numeric tolerance.

### Wrong readings checked

The prior review recomputed the worksheet's rate and year alternatives, including Indiana 2026 holdover 2,950 versus 2027 2,900 and Washington old-law zero versus 2028 49,500. The new wrong reading would apply Wisconsin's age-67 general retirement subtraction as though it were its separate military subtraction; for a qualifying under-67 filer, the latter can subtract the federally included military pay while the former cannot. The worksheet does not give a military-pension fixture.

### Sources

I read the operative [Wisconsin 2025 Schedule SB instructions, line 12](https://www.revenue.wi.gov/TaxForms2025/2025-ScheduleSB-Inst.pdf): they allow subtraction of U.S. military retirement-system payments, expressly including Survivor Benefit Plan payments, capped at the amount included in federal income. This supports the record's Wisconsin example. The unchanged enacted-year authorities and the D.C. emergency-act duration were checked in the earlier independent review; the [D.C. Act 26-416](https://code.dccouncil.gov/us/dc/council/acts/26-416) contingency is now expressly disclosed as provisional rather than unconditional.

### Record consistency

The newly added limit lists 15 modeled state military rules; that list and the Wisconsin gap match the `stateTax.ts` module documentation. It qualifies the record's otherwise broad state-tax coverage claim. The worksheet does not itself include this new military-pension limit or a Wisconsin case, so its limitations section should be synchronized for reader transparency; this omission does not change any derived tax figure or cause the record to overclaim. The existing statement and limits continue to flag D.C.'s provisional future deduction, indexed figures held nominally, conditional cuts, and Washington's omitted gains add-back.

### Evidence binding

`enacted2027.evidence.test.ts` binds all 24 unchanged worksheet results to annual state-tax calculations. It has no Wisconsin military-pension case, consistent with the fact that this revision only discloses a limitation. The new limit is supported by the stateTax module comment and the Wisconsin primary instruction, not by that test.

### Verdict

**approve**, with a documentation note to add the military-pension limitation to the worksheet as well.
