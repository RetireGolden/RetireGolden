# Mutation receipt: market-model-regime-switch

Re-executed 2026-09-18 after the #719 review against RetireGolden base `33e7d546` (branch grok/b1-p4-cards-monte-carlo) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/marketModels.ts`

```diff
--- a/packages/engine/src/montecarlo/marketModels.ts
+++ b/packages/engine/src/montecarlo/marketModels.ts
@@ mutation @@
-if (rng.next() < pSwitch) bull = !bull
+if (rng.next() > pSwitch) bull = !bull
```

Treats a 0.9 draw as a switch against p=0.05, flipping bull to bear so the shock is -4 rather than +4.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 npx.cmd vitest run src/montecarlo/marketModels.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1 FORCE_COLOR=0`. The `Start at` and `Duration` lines are the only lines removed.

```
 RUN  v5.0.0 C:/TEMP/rg-s3/packages/engine

 ❯ src/montecarlo/marketModels.evidence.test.ts (16 tests | 1 failed) 8ms
   ❯ market-model-regime-switch — Two-state bull/bear Markov return shock (1)
     × bull start, U = 0.9 >= 0.05, zero vol: shock +4 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 15 passed (16)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/marketModels.evidence.test.ts > market-model-regime-switch — Two-state bull/bear Markov return shock > bull start, U = 0.9 >= 0.05, zero vol: shock +4
AssertionError: expected -4 to be 4 // Object.is equality

- Expected
+ Received

- 4
+ -4

 ❯ src/montecarlo/marketModels.evidence.test.ts:431:38
    429|         model.generatePath(scriptedRng({ uniforms: [0.6, example.input…
    430|       )
    431|       expect(path.returnShockPct[0]).toBe(example.expected.returnShock…
       |                                      ^
    432|     })
    433|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

`git checkout -- packages/engine/src/montecarlo/marketModels.ts`, then `git diff --quiet -- packages/engine/src/montecarlo/marketModels.ts` exited 0, confirming no change to production code after the run.
