# Mutation receipt: market-model-inflation-regime

Re-executed 2026-09-18 after the second #719 review against RetireGolden base `33e7d546` (branch grok/b1-p4-cards-monte-carlo), and re-executed 2026-09-26 against RetireGolden base `fe6233de` (branch `claude/monte-carlo-models`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/marketModels.ts`

```diff
--- a/packages/engine/src/montecarlo/marketModels.ts
+++ b/packages/engine/src/montecarlo/marketModels.ts
@@ mutation @@
-if (rng.next() < (high ? 0.7 : pHigh)) high = !high
+if (rng.next() >= (high ? 0.7 : pHigh)) high = !high
```

Reverses the Bernoulli comparison, so U=0.10 does not enter the high regime and inflation stays 3% rather than 8%.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 npx.cmd vitest run src/montecarlo/marketModels.evidence.test.ts
```

## Captured failing output

Re-executed because this branch added tests to the evidence file, so the test counts and quoted line numbers recorded earlier no longer matched it. The baseline is green (marketModels.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine3/packages/engine

 ❯ src/montecarlo/marketModels.evidence.test.ts (30 tests | 1 failed) 58ms
   ❯ market-model-inflation-regime — Bernoulli high-inflation regime mix (1)
     × U = 0.10 < 0.20 selects the high regime at 8% with zero innovation 6ms

 Test Files  1 failed (1)
      Tests  1 failed | 29 passed (30)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/marketModels.evidence.test.ts > market-model-inflation-regime — Bernoulli high-inflation regime mix > U = 0.10 < 0.20 selects the high regime at 8% with zero innovation
AssertionError: expected 3 to be 8 // Object.is equality

- Expected
+ Received

- 8
+ 3

 ❯ src/montecarlo/marketModels.evidence.test.ts:487:36
    485|         model.generatePath(scriptedRng({ uniforms: [example.inputs.reg…
    486|       )
    487|       expect(path.inflationPct[0]).toBe(example.expected.inflationPct)
       |                                    ^
    488|     })
    489|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/montecarlo/marketModels.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/montecarlo/marketModels.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
