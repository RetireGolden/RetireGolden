# Mutation receipt: ss-bridge-ladders-total-cost

Executed 2026-09-30 against RetireGolden base `fbc9a9d3` (branch `claude/ui-relocations-six`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/ladder/bridge.ts`

```diff
diff --git a/packages/engine/src/ladder/bridge.ts b/packages/engine/src/ladder/bridge.ts
index cc24d7016..b69b07115 100644
--- a/packages/engine/src/ladder/bridge.ts
+++ b/packages/engine/src/ladder/bridge.ts
@@ -120,7 +120,7 @@ export function bridgeLaddersTotalCost(bridges: readonly Pick<BridgeSizing, 'lad
     if (!Number.isFinite(bridge.ladderCost)) {
       throw new RangeError(`A bridge ladder's quoted cost must be finite; got ${String(bridge.ladderCost)}`)
     }
-    total += bridge.ladderCost
+    total = bridge.ladderCost
   }
   return total
 }
```

One bridge's cost instead of the sum (the last one here; the worksheet's first wrong reading takes the first): case A reads 55,216.54 where two bridges cost 140,216.54 together, and case D reads 0.3.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/ladder/bridge.totalCost.evidence.test.ts
```

## Captured failing output

The baseline is green (bridge.totalCost.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/ladder/bridge.totalCost.evidence.test.ts (5 tests | 2 failed) 6ms
   ❯ ss-bridge-ladders-total-cost — Social Security bridge ladders: total cost (5)
     × case A: two bridges quoted at 85,000 and 55,216.54 cost 140,216.54 together 4ms
     × case D: the quotes are added in the order given, so 0.1, 0.2 and 0.3 give 0.6000000000000001 0ms

 Test Files  1 failed (1)
      Tests  2 failed | 3 passed (5)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/ladder/bridge.totalCost.evidence.test.ts > ss-bridge-ladders-total-cost — Social Security bridge ladders: total cost > case A: two bridges quoted at 85,000 and 55,216.54 cost 140,216.54 together
AssertionError: expected 55216.54 to be 140216.54 // Object.is equality

- Expected
+ Received

- 140216.54
+ 55216.54

 ❯ src/ladder/bridge.totalCost.evidence.test.ts:35:21
     33|     it('case A: two bridges quoted at 85,000 and 55,216.54 cost 140,21…
     34|       const total = totalOf(inputs.caseA!.ladderCosts)
     35|       expect(total).toBe(expected.caseA)
       |                     ^
     36|       expect(total).not.toBe(expected.wrongFirstOnlyA)
     37|       expect(total).not.toBe(expected.wrongAverageA)

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/ladder/bridge.totalCost.evidence.test.ts > ss-bridge-ladders-total-cost — Social Security bridge ladders: total cost > case D: the quotes are added in the order given, so 0.1, 0.2 and 0.3 give 0.6000000000000001
AssertionError: expected 0.3 to be 0.6000000000000001 // Object.is equality

- Expected
+ Received

- 0.6000000000000001
+ 0.3

 ❯ src/ladder/bridge.totalCost.evidence.test.ts:50:21
     48|     it('case D: the quotes are added in the order given, so 0.1, 0.2 a…
     49|       const total = totalOf(inputs.caseD!.ladderCosts)
     50|       expect(total).toBe(0.1 + 0.2 + 0.3)
       |                     ^
     51|       expect(total).not.toBe(0.1 + (0.2 + 0.3))
     52|     })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/ladder/bridge.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/ladder/bridge.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
