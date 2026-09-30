# Mutation receipt: hsa-contribution-limit-years

Executed 2026-09-28 against RetireGolden base `1d1cbbb9` (branch `claude/2027-published-figures`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `e68144d7` (branch `claude/2027-published-figures`, pull request #762) in `packages/engine`.

## Mutation applied to `packages/engine/src/params/hsaLimitYears.ts`

```diff
diff --git a/packages/engine/src/params/hsaLimitYears.ts b/packages/engine/src/params/hsaLimitYears.ts
index cd0d5065..85c7155a 100644
--- a/packages/engine/src/params/hsaLimitYears.ts
+++ b/packages/engine/src/params/hsaLimitYears.ts
@@ -62,5 +62,5 @@
 
 // Keep sorted ascending by year as each May's revenue procedure is added.
-const limitYears: readonly HsaLimitYearParameters[] = [hsaLimitYear2026, hsaLimitYear2027]
+const limitYears: readonly HsaLimitYearParameters[] = [hsaLimitYear2026]
 
 /** Every year with published HSA limits, ascending. */
```

This drops the 2027 limits, so 2027 stands in on the 2026 limits and grows them at the plan inflation, which is what the ledger did before Rev. Proc. 2026-24 was loaded: 4,400 × 1.025 = 4,510 self-only at 2.5%, the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/params/hsaLimitYears.evidence.test.ts
```

## Captured failing output

The module doc of hsaLimitYears.ts gained a paragraph on the years before the earliest published one (review round one of #762, issue 9), moving the mutated lines down five. The baseline is green (hsaLimitYears.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/params/hsaLimitYears.evidence.test.ts (3 tests | 3 failed) 42ms
   ❯ hsa-contribution-limit-years — HSA contribution limits by year (3)
     × publishes 2027 and stands 2028 in on 2027 5ms
     × credits the published 2027 limits through the ledger, whatever the plan inflation 28ms
     × grows 2028 one year from the 2027 limits, and adds the catch-up unscaled 8ms

 Test Files  1 failed (1)
      Tests  3 failed (3)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/params/hsaLimitYears.evidence.test.ts > hsa-contribution-limit-years — HSA contribution limits by year > publishes 2027 and stands 2028 in on 2027
AssertionError: expected { params: { year: 2026, …(3) }, …(1) } to deeply equal { params: { year: 2027, …(3) }, …(1) }

- Expected
+ Received

  {
-   "isStandIn": false,
+   "isStandIn": true,
    "params": {
-     "family": 9000,
-     "selfOnly": 4500,
-     "source": "Rev. Proc. 2026-24",
-     "year": 2027,
+     "family": 8750,
+     "selfOnly": 4400,
+     "source": "Rev. Proc. 2025-19",
+     "year": 2026,
    },
  }

 ❯ src/params/hsaLimitYears.evidence.test.ts:73:54
     71|
     72|     it('publishes 2027 and stands 2028 in on 2027', () => {
     73|       expect(hsaLimitsForYear(inputs.publishedYear)).toEqual({
       |                                                      ^
     74|         params: { year: 2027, source: 'Rev. Proc. 2026-24', selfOnly: …
     75|         isStandIn: false,

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

 FAIL  src/params/hsaLimitYears.evidence.test.ts > hsa-contribution-limit-years — HSA contribution limits by year > credits the published 2027 limits through the ledger, whatever the plan inflation
AssertionError: self-only 2027 at 2.5% 4510 is not within {"abs":0.005} of the worksheet's 4500: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/params/hsaLimitYears.evidence.test.ts:17:5
     15|     withinTolerance(actual, expected, tolerance),
     16|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     17|   ).toBe(true)
       |     ^
     18| }
     19|
 ❯ src/params/hsaLimitYears.evidence.test.ts:85:9

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

 FAIL  src/params/hsaLimitYears.evidence.test.ts > hsa-contribution-limit-years — HSA contribution limits by year > grows 2028 one year from the 2027 limits, and adds the catch-up unscaled
AssertionError: self-only 2028 4622.75 is not within {"abs":0.005} of the worksheet's 4612.5: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/params/hsaLimitYears.evidence.test.ts:17:5
     15|     withinTolerance(actual, expected, tolerance),
     16|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     17|   ).toBe(true)
       |     ^
     18| }
     19|
 ❯ src/params/hsaLimitYears.evidence.test.ts:94:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯
```

## Revert

The original bytes of `packages/engine/src/params/hsaLimitYears.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/params/hsaLimitYears.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
