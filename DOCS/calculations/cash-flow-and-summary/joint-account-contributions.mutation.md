# Mutation receipt: joint-account-contributions

Executed 2026-09-28 on branch `claude/people-order-and-scenarios` at base `da378d9b` (no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `6567821b` (branch `claude/people-order-and-scenarios`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualContributionsAndEmployerMatch.ts`

```diff
diff --git a/packages/engine/src/projection/internal/annualContributionsAndEmployerMatch.ts b/packages/engine/src/projection/internal/annualContributionsAndEmployerMatch.ts
index 61d109ae..555e1eac 100644
--- a/packages/engine/src/projection/internal/annualContributionsAndEmployerMatch.ts
+++ b/packages/engine/src/projection/internal/annualContributionsAndEmployerMatch.ts
@@ -350,3 +350,3 @@
       }
-    } else if (joint ? householdWages <= 0 : (input.wagesByPerson.get(ownerId) ?? 0) <= 0) {
+    } else if ((input.wagesByPerson.get(ownerId) ?? 0) <= 0) {
       desired = 0
```

Test the wages of the person the joint account resolves to (the first-listed person when the account names none), the rule before the decision. Pat, listed first, earns nothing, so the joint account takes nothing and the evidence fails on every year's balance.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/peopleNamed.evidence.test.ts
```

## Captured failing output

Re-executed because merging main (#762, #763) moved the production lines this receipt quotes; the mutation is unchanged. The baseline is green (peopleNamed.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine19/packages/engine

 ❯ src/projection/peopleNamed.evidence.test.ts (7 tests | 2 failed) 192ms
   ❯ joint-account-contributions — When a jointly owned account takes contributions (2)
     × keeps contributing while the household has wages, after Pat, listed first, has stopped earning and died 20ms
     × gives the same contributions with the people listed the other way round 35ms

 Test Files  1 failed (1)
      Tests  2 failed | 5 passed (7)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/peopleNamed.evidence.test.ts > joint-account-contributions — When a jointly owned account takes contributions > keeps contributing while the household has wages, after Pat, listed first, has stopped earning and died
AssertionError: Joint balance, end of 2026: actual 0: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/peopleNamed.evidence.test.ts:193:102


⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/projection/peopleNamed.evidence.test.ts > joint-account-contributions — When a jointly owned account takes contributions > gives the same contributions with the people listed the other way round
AssertionError: expected [ 6000, 12000, 18000, 24000, …(31) ] to deeply equal [ +0, +0, +0, +0, +0, +0, +0, …(28) ]

- Expected
+ Received

  [
-   0,
-   0,
-   0,
-   0,
-   0,
-   0,
-   0,
-   0,
-   0,
-   0,
-   0,
-   0,
-   0,
-   0,
-   0,
-   0,
-   0,
-   0,
-   0,
-   0,
-   0,
-   0,
-   0,
-   0,
-   0,
-   0,
-   0,
-   0,
-   0,
-   0,
-   0,
-   0,
-   0,
-   0,
-   0,
+   6000,
+   12000,
+   18000,
+   24000,
+   30000,
+   36000,
+   42000,
+   48000,
+   48000,
+   48000,
+   48000,
+   48000,
+   48000,
+   48000,
+   48000,
+   48000,
+   48000,
+   48000,
+   48000,
+   48000,
+   48000,
+   48000,
+   48000,
+   48000,
+   48000,
+   48000,
+   48000,
+   48000,
+   48000,
+   48000,
+   48000,
+   48000,
+   48000,
+   48000,
+   48000,
  ]

 ❯ src/projection/peopleNamed.evidence.test.ts:198:67
    196|
    197|     it('gives the same contributions with the people listed the other …
    198|       expect(run(reversed(plan)).map((y) => y.balances['joint'])).toEq…
       |                                                                   ^
    199|     })
    200|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/internal/annualContributionsAndEmployerMatch.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/internal/annualContributionsAndEmployerMatch.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
