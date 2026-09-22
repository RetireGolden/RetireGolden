# Mutation receipt: insight-impact-estate-and-lifetime-tax-deltas

Executed 2026-09-18 against RetireGolden base `1452ae11` (branch `claude/b1-p4-cards-slice-thirteen`) in `packages/engine`.

## Mutation applied to `packages/engine/src/decisions/evaluateCandidate.ts`

```diff
diff --git a/packages/engine/src/decisions/evaluateCandidate.ts b/packages/engine/src/decisions/evaluateCandidate.ts
index f18d4c86..90ce0454 100644
--- a/packages/engine/src/decisions/evaluateCandidate.ts
+++ b/packages/engine/src/decisions/evaluateCandidate.ts
@@ -773,7 +773,7 @@ export function evaluateCandidate(
     : null
 
   const deltas = {
-    endingAfterTaxEstate: candidateSummary.endingAfterTaxEstate - ctx.baselineSummary.endingAfterTaxEstate,
+    endingAfterTaxEstate: ctx.baselineSummary.endingAfterTaxEstate - candidateSummary.endingAfterTaxEstate,
     endingNetWorth: candidateSummary.endingNetWorth - ctx.baselineSummary.endingNetWorth,
     lifetimeTax: candidateSummary.lifetimeTaxesAndPenalties - ctx.baselineSummary.lifetimeTaxesAndPenalties,
     moneyLastsYears: lastsThroughYear(candidateResult) - lastsThroughYear(ctx.baselineResult),
```

Reverse the estate subtraction only — the worksheet's first wrong reading, applied to one of the two fields so the inconsistency is visible. The $30,000 improvement is published as -$29,999.999999563443, which would read as an estate the candidate DESTROYS, while the lifetime-tax delta keeps its candidate-minus-baseline sign.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/decisions/evaluateCandidate.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and cache-hint lines were removed. Exit code: 1.

```

 RUN  v5.0.0 C:/TEMP/rg-s13/packages/engine

 ❯ src/decisions/evaluateCandidate.evidence.test.ts (1 test | 1 failed) 33ms
   ❯ insight-impact-estate-and-lifetime-tax-deltas — Insight impact: ending after-tax estate and lifetime tax deltas (1)
     × subtracts baseline from candidate on both summaries 32ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/decisions/evaluateCandidate.evidence.test.ts > insight-impact-estate-and-lifetime-tax-deltas — Insight impact: ending after-tax estate and lifetime tax deltas > subtracts baseline from candidate on both summaries
AssertionError: endingAfterTaxEstateDelta -29999.999999563443 is not within {"abs":0.005} of 30000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/decisions/evaluateCandidate.evidence.test.ts:72:9
     70|         withinTolerance(actual, target, example.tolerance),
     71|         `${label} ${actual} is not within ${JSON.stringify(example.tol…
     72|       ).toBe(true)
       |         ^
     73|     }
     74|
 ❯ src/decisions/evaluateCandidate.evidence.test.ts:119:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯


 Test Files  1 failed (1)
      Tests  1 failed (1)
```

## Revert

`git checkout -- packages/engine/src/decisions/evaluateCandidate.ts` restored the file, and `git diff --quiet -- packages/engine/src/decisions/evaluateCandidate.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the named file passed again (1 passed, exit 0).
