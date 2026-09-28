# Mutation receipt: survivor-shortfall-year-count

Executed 2026-09-28 against RetireGolden base `34544677` (branch `claude/b2p1-slice5-sweeps`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `edf7cdb1` (branch `claude/b2p1-slice5-sweeps`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `aedb78a2` (branch `claude/b2p1-slice5-sweeps`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/survivorTransition.ts`

```diff
diff --git a/packages/engine/src/projection/survivorTransition.ts b/packages/engine/src/projection/survivorTransition.ts
index 7add6a98..1a77c6c1 100644
--- a/packages/engine/src/projection/survivorTransition.ts
+++ b/packages/engine/src/projection/survivorTransition.ts
@@ -313,7 +313,7 @@ export function survivorShortfallYearCount(
   deathYear: number,
 ): number {
   return years.filter(
-    (y) => y.year > deathYear && y.people.some((p) => p.alive) && y.requiredShortfall > ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS,
+    (y) => y.year >= deathYear && y.people.some((p) => p.alive) && y.requiredShortfall > ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS,
   ).length
 }
 
```

This counts the death year, the worksheet's first wrong reading: case C-A's 2040 shortfall of 900, a year both people were alive, raises the count from 2 to 3.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/survivorTransition.shortfall.evidence.test.ts
```

## Captured failing output

a doc-comment line in survivorTransition.ts moved the lines these receipts quote The baseline is green (survivorTransition.shortfall.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine16/packages/engine

 ❯ src/projection/survivorTransition.shortfall.evidence.test.ts (1 test | 1 failed) 7ms
   ❯ survivor-shortfall-year-count — Survivor shortfall years (1)
     × C-A: counts required-spending shortfalls above the funding tolerance after the death year, with someone alive 5ms

 Test Files  1 failed (1)
      Tests  1 failed (1)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/survivorTransition.shortfall.evidence.test.ts > survivor-shortfall-year-count — Survivor shortfall years > C-A: counts required-spending shortfalls above the funding tolerance after the death year, with someone alive
AssertionError: expected 3 to be 2 // Object.is equality

- Expected
+ Received

- 2
+ 3

 ❯ src/projection/survivorTransition.shortfall.evidence.test.ts:35:55
     33|   ({ example }) => {
     34|     it('C-A: counts required-spending shortfalls above the funding tol…
     35|       expect(survivorShortfallYearCount(years, 2040)).toBe(example.exp…
       |                                                       ^
     36|     })
     37|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/survivorTransition.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/survivorTransition.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
