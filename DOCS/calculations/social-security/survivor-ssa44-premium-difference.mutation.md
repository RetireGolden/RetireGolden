# Mutation receipt: survivor-ssa44-premium-difference

Executed 2026-09-28 against RetireGolden base `34544677` (branch `claude/b2p1-slice5-sweeps`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `edf7cdb1` (branch `claude/b2p1-slice5-sweeps`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `aedb78a2` (branch `claude/b2p1-slice5-sweeps`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/survivorTransition.ts`

```diff
diff --git a/packages/engine/src/projection/survivorTransition.ts b/packages/engine/src/projection/survivorTransition.ts
index 7add6a98..5e705ed0 100644
--- a/packages/engine/src/projection/survivorTransition.ts
+++ b/packages/engine/src/projection/survivorTransition.ts
@@ -299,7 +299,7 @@ export function ssa44PremiumDifference(
     const on = withRelief.find((x) => x.year === y.year)
     if (!on) continue
     total += y.medicarePremiums - on.medicarePremiums
-    if (reliefYears.includes(y.year)) relief += y.medicarePremiums - on.medicarePremiums
+    relief += y.medicarePremiums - on.medicarePremiums
   }
   return { total, reliefYears: relief }
 }
```

This counts every year as a relief year, the worksheet's first wrong reading: case M-B's relief-year part becomes the whole-projection 3,890 rather than 3,900, and the later years' knock-on disappears from the page's note.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/survivorTransition.ssa44.evidence.test.ts
```

## Captured failing output

a doc-comment line in survivorTransition.ts moved the lines these receipts quote The baseline is green (survivorTransition.ssa44.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine16/packages/engine

 ❯ src/projection/survivorTransition.ssa44.evidence.test.ts (1 test | 1 failed) 9ms
   ❯ survivor-ssa44-premium-difference — SSA-44 survivor premium difference (1)
     × M-B: the whole-projection difference carries the later knock-on; the relief-year part is the two years after the death 8ms

 Test Files  1 failed (1)
      Tests  1 failed (1)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/survivorTransition.ssa44.evidence.test.ts > survivor-ssa44-premium-difference — SSA-44 survivor premium difference > M-B: the whole-projection difference carries the later knock-on; the relief-year part is the two years after the death
AssertionError: expected 3890 to be 3900 // Object.is equality

- Expected
+ Received

- 3900
+ 3890

 ❯ src/projection/survivorTransition.ssa44.evidence.test.ts:38:38
     36|       const difference = ssa44PremiumDifference(without, withRelief, […
     37|       expect(difference.total).toBe(example.expected.total)
     38|       expect(difference.reliefYears).toBe(example.expected.reliefYears)
       |                                      ^
     39|       // A year the relief run lacks is skipped on both sums.
     40|       expect(ssa44PremiumDifference(without, withRelief.slice(0, 2), […

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/survivorTransition.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/survivorTransition.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
