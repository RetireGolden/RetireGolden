# Mutation receipt: monte-carlo-people-draw-order

Executed 2026-09-28 on branch `claude/people-order-and-scenarios` at base `da378d9b` (no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/run.ts`

```diff
diff --git a/packages/engine/src/montecarlo/run.ts b/packages/engine/src/montecarlo/run.ts
index c12606f1..510e6709 100644
--- a/packages/engine/src/montecarlo/run.ts
+++ b/packages/engine/src/montecarlo/run.ts
@@ -129,3 +129,3 @@
     // order, so listing the people the other way round draws the same path.
-    const drawOrder = canonicalPeopleOrder(plan.household.people)
+    const drawOrder = plan.household.people
     if (opts.stochasticLongevity) {
```

Draw deaths and care events in list order, the rule before the decision. Household A listed Lee first then draws Lee's death and care before Ray's, so the reversed household draws different paths and the evidence fails in both modes.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/montecarlo/peopleDrawOrder.evidence.test.ts
```

## Captured failing output

First execution, for decision D-PEOPLE-ORDER (and D-FI-CONVERSION-TAX for the FI base): the mutation restores the rule before the decision, and the evidence fails. The baseline is green (peopleDrawOrder.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/montecarlo/peopleDrawOrder.evidence.test.ts (2 tests | 1 failed) 397ms
   ❯ monte-carlo-people-draw-order — The order a Monte Carlo path draws each person's death and care from (2)
     × draws the same deaths and care events whichever person is listed first 395ms

 Test Files  1 failed (1)
      Tests  1 failed | 1 passed (2)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/peopleDrawOrder.evidence.test.ts > monte-carlo-people-draw-order — The order a Monte Carlo path draws each person's death and care from > draws the same deaths and care events whichever person is listed first
AssertionError: longevity: expected [ [ +0, 2035 ], …(24) ] to deeply equal [ [ +0, 2035 ], [ +0, 2045 ], …(23) ]

- Expected
+ Received

@@ -2,35 +2,35 @@
    [
      0,
      2035,
    ],
    [
-     0,
-     2045,
+     175543.08262236483,
+     null,
    ],
    [
      0,
      2037,
    ],
    [
      0,
-     2043,
+     2042,
    ],
    [
      0,
-     2046,
+     2045,
    ],
    [
      0,
-     2041,
+     2042,
    ],
    [
      0,
      2037,
    ],
    [
-     3529589.480129025,
+     4389638.73005296,
      null,
    ],
    [
      0,
      2045,
@@ -54,20 +54,20 @@
    [
      0,
      2039,
    ],
    [
-     117205903.0929771,
+     107969892.15047082,
      null,
    ],
    [
      21025988.750819825,
      null,
    ],
    [
-     0,
-     2053,
+     2803408.9796431717,
+     null,
    ],
    [
      0,
      2042,
    ],
@@ -79,11 +79,11 @@
      0,
      2041,
    ],
    [
      0,
-     2052,
+     2053,
    ],
    [
      0,
      2050,
    ],

 ❯ src/montecarlo/peopleDrawOrder.evidence.test.ts:75:45
     73|       const reversed = planOf([...HOUSEHOLDS['Household A draw order']…
     74|       for (const mode of ['longevity', 'care'] as const) {
     75|         expect(paths(reversed, mode), mode).toEqual(paths(listed, mode…
       |                                             ^
     76|       }
     77|     })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/montecarlo/run.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/montecarlo/run.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
