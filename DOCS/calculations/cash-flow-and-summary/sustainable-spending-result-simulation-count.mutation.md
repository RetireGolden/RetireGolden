# Mutation receipt: sustainable-spending-result-simulation-count

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-thirteen` at base `1452ae11`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730), and re-executed 2026-09-26 against RetireGolden base `6f58be5f` (branch `claude/solver-answers-unpriced-aca`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/decisions/spendingSolver.ts`

```diff
diff --git a/packages/engine/src/decisions/spendingSolver.ts b/packages/engine/src/decisions/spendingSolver.ts
index 405aaba1..034893aa 100644
--- a/packages/engine/src/decisions/spendingSolver.ts
+++ b/packages/engine/src/decisions/spendingSolver.ts
@@ -206,7 +206,7 @@ export function solveMaxSustainableSpending(
   if (seed.feasible) {
     lower = seedAmount
     upper = null
-    let next = Math.max(seedAmount * 2, MINIMUM_BRACKET_PROBE_DOLLARS)
+    let next = Math.max(seedAmount * 3, MINIMUM_BRACKET_PROBE_DOLLARS)
     while (simulationCount < maxSimulations) {
       if (next > UNBOUNDED_SPENDING_DOLLARS) {
         diagnostics.push(
```

Open the bracket at three times the seed instead of two. The answer does not move — the frontier is still bracketed and maxBaseAnnual is still $22,500 — but the probe SEQUENCE does: one doubling probe at $30,000 replaces the two at $20,000 and $40,000, and three halvings follow, so the count is 5. That is the worksheet's first wrong reading ("not counting the seed gives 5") arrived at from the other side, and it is the sharpest available mutation here because it changes ONLY the number this record publishes.

A note on a mutation that is less sharp. Relaxing the bisection's stopping test from `upper - lower > resolutionDollars` to `>=` was applied first. It does produce the worksheet's third wrong reading (7 probes), but it also moves maxBaseAnnual to $23,750, so the fixture fails on the answer before it ever reaches the count. The executed mutation above is the one the count assertion itself catches.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/decisions/spendingSolver.simulationCount.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-26 on branch claude/solver-answers-unpriced-aca after the unpriced-ACA and required-floor change to the spending solver and the evaluator moved lines of the production file, so the capture, blob hashes and revert note are refreshed against this head. The baseline is green (spendingSolver.simulationCount.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine5/packages/engine

 ❯ src/decisions/spendingSolver.simulationCount.evidence.test.ts (2 tests | 1 failed) 60ms
   ❯ sustainable-spending-result-simulation-count — Sustainable-spending simulation count: the probe sequence, counted (2)
     × counts six probes: the seed, two doublings and three halvings 55ms

 Test Files  1 failed (1)
      Tests  1 failed | 1 passed (2)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/decisions/spendingSolver.simulationCount.evidence.test.ts > sustainable-spending-result-simulation-count — Sustainable-spending simulation count: the probe sequence, counted > counts six probes: the seed, two doublings and three halvings
AssertionError: expected 5 to be 6 // Object.is equality

- Expected
+ Received

- 6
+ 5

 ❯ src/decisions/spendingSolver.simulationCount.evidence.test.ts:75:38
     73|       expect(result.maxBaseAnnual).toBe(expected.maxBaseAnnual)
     74|       expect(result.converged).toBe(true)
     75|       expect(result.simulationCount).toBe(expected.feasibleSeedSimulat…
       |                                      ^
     76|       expect(result.simulationCount).toBeLessThan(budget)
     77|       // The worksheet's three wrong readings.

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/decisions/spendingSolver.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/decisions/spendingSolver.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
