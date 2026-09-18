# Mutation receipt: long-term-care-shock-sampling

Re-executed 2026-09-18 after the #719 review against RetireGolden base `33e7d546` (branch grok/b1-p4-cards-monte-carlo) in `packages/engine`.

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
NO_COLOR=1 FORCE_COLOR=0 npx.cmd vitest run src/montecarlo/ltcShock.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1 FORCE_COLOR=0`. The `Start at` and `Duration` lines are the only lines removed.

```
 RUN  v5.0.0 C:/TEMP/rg-s3/packages/engine

 ❯ src/montecarlo/ltcShock.evidence.test.ts (1 test | 1 failed) 4ms
   ❯ long-term-care-shock-sampling — Per-person paid-care episode draw (1)
     × U = 0.75 >= incidence 0.5 emits the empty care-event list 4ms

 Test Files  1 failed (1)
      Tests  1 failed (1)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/ltcShock.evidence.test.ts > long-term-care-shock-sampling — Per-person paid-care episode draw > U = 0.75 >= incidence 0.5 emits the empty care-event list
AssertionError: expected 1 to be +0 // Object.is equality

- Expected
+ Received

- 0
+ 1

 ❯ src/montecarlo/ltcShock.evidence.test.ts:43:29
     41|         { ...DEFAULT_LTC_SHOCK, incidence: example.inputs.incidence as…
     42|       )
     43|       expect(events.length).toBe(example.expected.eventCount as number)
       |                             ^
     44|     })
     45|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

`git checkout -- packages/engine/src/montecarlo/ltcShock.ts`, then `git diff --quiet -- packages/engine/src/montecarlo/ltcShock.ts` exited 0, confirming no change to production code after the run.
