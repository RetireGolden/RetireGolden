# Mutation receipt: state-enacted-tax-year-figures

Executed 2026-09-28 against RetireGolden base `1d1cbbb9` (branch `claude/2027-published-figures`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `10512d53` (branch `claude/2027-published-figures`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `77d80a89` (branch `claude/2027-published-figures`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/params/state/index.ts`

```diff
diff --git a/packages/engine/src/params/state/index.ts b/packages/engine/src/params/state/index.ts
index e904a6c6..0911f7b1 100644
--- a/packages/engine/src/params/state/index.ts
+++ b/packages/engine/src/params/state/index.ts
@@ -52,11 +52,3 @@
  */
-export const STATE_ENACTED_YEARS: readonly StateEnactedYear[] = [
-  stateEnacted2027,
-  stateEnacted2028,
-  stateEnacted2029,
-  stateEnacted2030,
-  stateEnacted2031,
-  stateEnacted2032,
-  stateEnacted2033,
-]
+export const STATE_ENACTED_YEARS: readonly StateEnactedYear[] = []
 
```

This removes every enacted year, so each state prices 2027 and later at its 2026 figures, which is what the engine did before they were loaded: North Carolina at 3.99% instead of 3.49% for 2027, the worksheet's first wrong reading, and 3.99% instead of 3.24% and 2.99% for 2030 and 2033; Hawaii, New York, Rhode Island, Virginia, Maine, Georgia, California and Washington likewise lose the figures the evidence test prices for them. (Revised 2026-09-28: the list gained the later unconditional steps, so the mutated line became the list's seven lines, and then 2031 and 2032, nine lines.)

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/params/state/enacted2027.evidence.test.ts
```

## Captured failing output

Re-executed because the enacted-year list now also holds 2031 and 2032, so the mutation empties its nine lines, and the evidence test prices the widened set of states and the 2026 corrections. The baseline is green (enacted2027.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine18/packages/engine

 ❯ src/params/state/enacted2027.evidence.test.ts (3 tests | 3 failed) 31ms
   ❯ state-enacted-tax-year-figures — State income tax figures already enacted for 2027 and later (3)
     × reads each household from the enacted year the worksheet names, and South Carolina from 2026 3ms
     × prices each worksheet household through the annual state resolver 2ms
     × publishes the same 2027 state tax through the ledger 25ms

 Test Files  1 failed (1)
      Tests  3 failed (3)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/params/state/enacted2027.evidence.test.ts > state-enacted-tax-year-figures — State income tax figures already enacted for 2027 and later > reads each household from the enacted year the worksheet names, and South Carolina from 2026
AssertionError: IN: expected null to be 2027 // Object.is equality

- Expected:
2027

+ Received:
null

 ❯ src/params/state/enacted2027.evidence.test.ts:123:72
    121|       for (const key of Object.keys(expected)) {
    122|         const household = inputs.households[key]!
    123|         expect(stateEnactedYearFor(stateOf(key), household.year), key)…
       |                                                                        ^
    124|       }
    125|       expect(stateEnactedYearFor('SC', 2027)).toBeNull()

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

 FAIL  src/params/state/enacted2027.evidence.test.ts > state-enacted-tax-year-figures — State income tax figures already enacted for 2027 and later > prices each worksheet household through the annual state resolver
AssertionError: IN state tax 2950 is not within {"abs":0.005} of the worksheet's 2900: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/params/state/enacted2027.evidence.test.ts:18:5
     16|     withinTolerance(actual, expected, tolerance),
     17|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     18|   ).toBe(true)
       |     ^
     19| }
     20|
 ❯ src/params/state/enacted2027.evidence.test.ts:130:9

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

 FAIL  src/params/state/enacted2027.evidence.test.ts > state-enacted-tax-year-figures — State income tax figures already enacted for 2027 and later > publishes the same 2027 state tax through the ledger
AssertionError: IN published 2027 tax 2950 is not within {"abs":0.005} of the worksheet's 2900: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/params/state/enacted2027.evidence.test.ts:18:5
     16|     withinTolerance(actual, expected, tolerance),
     17|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     18|   ).toBe(true)
       |     ^
     19| }
     20|
 ❯ src/params/state/enacted2027.evidence.test.ts:147:9

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯
```

## Revert

The original bytes of `packages/engine/src/params/state/index.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/params/state/index.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
