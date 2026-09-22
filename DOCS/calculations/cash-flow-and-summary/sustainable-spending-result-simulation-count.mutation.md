# Mutation receipt: sustainable-spending-result-simulation-count

Executed 2026-09-18 against RetireGolden base `1452ae11` (branch `claude/b1-p4-cards-slice-thirteen`) in `packages/engine`.

## Mutation applied to `packages/engine/src/decisions/spendingSolver.ts`

```diff
diff --git a/packages/engine/src/decisions/spendingSolver.ts b/packages/engine/src/decisions/spendingSolver.ts
index a4d88840..a169e526 100644
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

Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and cache-hint lines were removed. Exit code: 1.

```

 RUN  v5.0.0 C:/TEMP/rg-s13/packages/engine

 ❯ src/decisions/spendingSolver.simulationCount.evidence.test.ts (2 tests | 1 failed) 80ms
   ❯ sustainable-spending-result-simulation-count — Sustainable-spending simulation count: the probe sequence, counted (2)
     × counts six probes: the seed, two doublings and three halvings 71ms

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


 Test Files  1 failed (1)
      Tests  1 failed | 1 passed (2)
```

## Revert

`git checkout -- packages/engine/src/decisions/spendingSolver.ts` restored the file, and `git diff --quiet -- packages/engine/src/decisions/spendingSolver.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the named file passed again (2 passed, exit 0).
