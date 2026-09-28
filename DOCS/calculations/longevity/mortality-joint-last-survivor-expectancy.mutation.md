# Mutation receipt: mortality-joint-last-survivor-expectancy

Executed 2026-09-14 against RetireGolden head `efaeb827` (branch claude/b1-p4-cards-longevity, with the PR #714 round-1 revision of `src/montecarlo/mortality.evidence.test.ts` applied: the planner-ui comparison moved to the planner-ui suite, and B2-P1 slice 4 deleted it with the planner-ui copy of the identity; that run replaced the same-day run against base `2dc2011c`), and re-executed 2026-09-27 against RetireGolden base `b338e430` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/mortality.ts`

```diff
@@ -61,7 +61,7 @@ export function jointLastSurvivorExpectancy(ageA: number, sexA: Sex, ageB: numbe
   for (let t = 1; t <= MAX_AGE + 1; t++) {
     survivalA *= 1 - annualMortality(ageA + t - 1, sexA)
     survivalB *= 1 - annualMortality(ageB + t - 1, sexB)
-    expectancy += 1 - (1 - survivalA) * (1 - survivalB)
+    expectancy += survivalA
   }
   return expectancy
 }
```

This adds the single-life survival instead of the either-alive probability, the worksheet's first wrong reading: 0.5 + 0.04 = 0.54 years instead of 0.5784, a 0.0384 miss against the 1e-12 tolerance. The endpoint case (both at 119) still returns 0.5 under the mutation, so only the worksheet example fails.

## Command

```
npx vitest run src/montecarlo/mortality.evidence.test.ts
```

## Captured failing output

Re-executed for B2-P1 slice 4 because a comment above its hunk or in its test file changed (the planner-ui copy of the survival curve is deleted, and the survivor helper names its two analysis callers); the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (mortality.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine13/packages/engine

 ❯ src/montecarlo/mortality.evidence.test.ts (11 tests | 1 failed) 6ms
   ❯ mortality-joint-last-survivor-expectancy — Joint last-survivor life expectancy of two independent lives (4)
     × two male lives at 118: 0.5 + (1 - 0.96^2) = 0.5784 years 3ms

 Test Files  1 failed (1)
      Tests  1 failed | 10 passed (11)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/mortality.evidence.test.ts > mortality-joint-last-survivor-expectancy — Joint last-survivor life expectancy of two independent lives > two male lives at 118: 0.5 + (1 - 0.96^2) = 0.5784 years
AssertionError: jointExpectancyYears 0.54 is not within {"abs":1e-12} of the worksheet's 0.5784: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/montecarlo/mortality.evidence.test.ts:184:9
    182|         withinTolerance(expectancy, expected, example.tolerance),
    183|         `jointExpectancyYears ${expectancy} is not within ${JSON.strin…
    184|       ).toBe(true)
       |         ^
    185|     })
    186|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/montecarlo/mortality.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/montecarlo/mortality.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
