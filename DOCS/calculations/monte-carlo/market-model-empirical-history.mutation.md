# Mutation receipt: market-model-empirical-history

Re-executed 2026-09-18 after the second #719 review against RetireGolden base `33e7d546` (branch grok/b1-p4-cards-monte-carlo), and re-executed 2026-09-26 against RetireGolden base `fe6233de` (branch `claude/monte-carlo-models`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/marketModels.ts`

```diff
--- a/packages/engine/src/montecarlo/marketModels.ts
+++ b/packages/engine/src/montecarlo/marketModels.ts
@@ mutation @@
-const mean = centered ? meanPortfolioReturnPct(equityWeightPct) : 0
+const mean = centered ? 8 : 0
```

Subtracts a round 8 instead of the dataset mean, so the 1928 centered shock is 18.599999999999998 rather than 17.662708333333327 (the worksheet's second wrong reading).

## Command

```
NO_COLOR=1 FORCE_COLOR=0 npx.cmd vitest run src/montecarlo/marketModels.evidence.test.ts
```

## Captured failing output

Re-executed because this branch added tests to the evidence file, so the test counts and quoted line numbers recorded earlier no longer matched it. The baseline is green (marketModels.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine3/packages/engine

 ❯ src/montecarlo/marketModels.evidence.test.ts (30 tests | 1 failed) 58ms
   ❯ market-model-empirical-history — Empirical historical shock, centered or raw (2)
     × 1928 at 60% equity: centered shock 17.662708333333327, raw 26.599999999999998, inflation −1.2% 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 29 passed (30)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/marketModels.evidence.test.ts > market-model-empirical-history — Empirical historical shock, centered or raw > 1928 at 60% equity: centered shock 17.662708333333327, raw 26.599999999999998, inflation −1.2%
AssertionError: centeredShockPct 18.599999999999998 is not within {"abs":1e-12} of the worksheet's 17.662708333333327: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/montecarlo/marketModels.evidence.test.ts:198:9
    196|         withinTolerance(centered.returnShockPct[0]!, expectedCentered,…
    197|         `centeredShockPct ${centered.returnShockPct[0]} is not within …
    198|       ).toBe(true)
       |         ^
    199|       expect(
    200|         withinTolerance(raw.returnShockPct[0]!, expectedRaw, example.t…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/montecarlo/marketModels.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/montecarlo/marketModels.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
