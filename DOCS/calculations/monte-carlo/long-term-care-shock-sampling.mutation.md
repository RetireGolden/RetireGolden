# Mutation receipt: long-term-care-shock-sampling

Executed 2026-09-17 against RetireGolden base `33e7d546` (branch grok/b1-p4-cards-monte-carlo) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/ltcShock.ts`

```diff
--- a/packages/engine/src/montecarlo/ltcShock.ts
+++ b/packages/engine/src/montecarlo/ltcShock.ts
@@ mutation @@
-if (rng.next() >= params.incidence) continue
+if (rng.next() < params.incidence) continue
```

Reverses the incidence comparison so U >= incidence now emits an episode. With U=0.75 and incidence 0.5 the empty-list case becomes a one-event list, the worksheet's first wrong reading.

## Command

```
npx vitest run src/montecarlo/ltcShock.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1`; stdout precedes stderr, so the run summary appears before the failed-test detail. The `Start at` and `Duration` lines are the only lines removed.

```
 RUN  v5.0.0 C:/TEMP/rg-s3/packages/engine

 ❯ src/montecarlo/ltcShock.evidence.test.ts (1 test | 1 failed) 3ms
   ❯ long-term-care-shock-sampling — Per-person paid-care episode draw (1)
     × U = 0.75 >= incidence 0.5 emits the empty care-event list 2ms

 Test Files  1 failed (1)
      Tests  1 failed (1)

(node:28260) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:29968) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/ltcShock.evidence.test.ts > long-term-care-shock-sampling — Per-person paid-care episode draw > U = 0.75 >= incidence 0.5 emits the empty care-event list
RangeError: nextInt is not reached when the incidence draw misses
 ❯ Object.nextInt src/montecarlo/ltcShock.evidence.test.ts:19:13
     17|     },
     18|     nextInt: () => {
     19|       throw new RangeError('nextInt is not reached when the incidence …
       |             ^
     20|     },
     21|   }
 ❯ sampleCareEvents src/montecarlo/ltcShock.ts:68:68
 ❯ src/montecarlo/ltcShock.evidence.test.ts:37:22

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

`git checkout -- packages/engine/src/montecarlo/ltcShock.ts`, then `git diff --quiet -- packages/engine/src/montecarlo/ltcShock.ts` exited 0, confirming no change to production code after the run.
