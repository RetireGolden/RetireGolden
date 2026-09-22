# Mutation receipt: relocation-lifetime-state-local-tax

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-seven` at base `74916a7e`, and re-executed 2026-09-22 against RetireGolden base `7ae019a8` (branch `claude/b1-p4-cards-seven`, pull request #727) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/relocation.ts`

```diff
diff --git a/packages/engine/src/projection/relocation.ts b/packages/engine/src/projection/relocation.ts
index 2f70ba31..bb179ce3 100644
--- a/packages/engine/src/projection/relocation.ts
+++ b/packages/engine/src/projection/relocation.ts
@@ -531,7 +531,7 @@ function runRow(
       error: null,
       destinationState,
       modeled: allModeled && !overrideActive && !anyIncompleteTax,
-      lifetimeStateLocalTax: drivers.totalStateLocalTax,
+      lifetimeStateLocalTax: stateTaxByYear.slice(1).reduce((sum, line) => sum + line.tax, 0),
       lifetimeTaxesAndPenalties: summary.lifetimeTaxesAndPenalties,
       endingAfterTaxEstate: summary.endingAfterTaxEstate,
       endingNetWorth: summary.endingNetWorth,
```

Sum the post-move years only, dropping the split/baseline year.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/relocation.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #727: the heir-tax fixture had grown to two cases since the first execution and the branch was renamed for the pull request, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (relocation.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/projection/relocation.evidence.test.ts (2 tests | 1 failed) 41ms
   ❯ relocation-lifetime-state-local-tax — Relocation lifetime state local tax (1)
     × sums the three recorded annual lines to 13250.25 35ms

 Test Files  1 failed (1)
      Tests  1 failed | 1 passed (2)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/relocation.evidence.test.ts > relocation-lifetime-state-local-tax — Relocation lifetime state local tax > sums the three recorded annual lines to 13250.25
AssertionError: lifetimeStateLocalTax: actual 9000.25, worksheet 13250.25: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/relocation.evidence.test.ts:150:11
    148|           withinTolerance(row.lifetimeStateLocalTax, expected, example…
    149|           `lifetimeStateLocalTax: actual ${row.lifetimeStateLocalTax},…
    150|         ).toBe(true)
       |           ^
    151|         // The wrong readings: post-move years only, and a real-dollar…
    152|         expect(row.lifetimeStateLocalTax).not.toBe(lines[1]!.tax + lin…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/relocation.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/relocation.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
