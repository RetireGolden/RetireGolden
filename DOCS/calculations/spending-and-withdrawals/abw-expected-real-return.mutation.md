# Mutation receipt: abw-expected-real-return

Executed 2026-09-17 against RetireGolden base `33e7d546` (branch claude/b1-p4-cards-accounts-spending) in `packages/engine`.

## Mutation applied to `packages/engine/src/spending/abw.ts`

```diff
@@ -58,7 +58,7 @@ export function abwExpectedRealReturnPct(abw: AbwPolicy | undefined): number {
     const cape = abw?.startingCape ?? ABW_DEFAULTS.startingCape
     const equityShare = (abw?.equitySharePct ?? ABW_DEFAULTS.equitySharePct) / 100
     const caey = 100 / cape
-    return caey * equityShare + bond * (1 - equityShare)
+    return caey
   }
   return abw?.fixedRealReturnPct ?? ABW_DEFAULTS.fixedRealReturnPct
 }
```

This drops the bond leg from the CAPE blend, the worksheet's first wrong reading: the function returns the 4% earnings yield alone instead of the 3.2% blend, a 0.8 percentage-point miss against the 1e-12 tolerance. The tips and fixed branches are untouched, so their assertions still pass.

## Command

```
npx vitest run src/spending/abw.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1`, stdout and stderr together; stdout precedes stderr, so the run summary appears before the failed-test detail. Blank lines, the `Start at` and `Duration` lines, and Vitest's transform-cache performance hint (when printed) are the only lines removed. The run exited 1.

```
 RUN  v5.0.0 C:/TEMP/rg-s5/packages/engine
 ❯ src/spending/abw.evidence.test.ts (4 tests | 1 failed) 5ms
   ❯ abw-expected-real-return — ABW expected real return: fixed, TIPS yield, or CAPE-blended (3)
     × blends the 4% CAPE earnings yield at 60% with the 2% bond yield to 3.2%/yr real 3ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/spending/abw.evidence.test.ts > abw-expected-real-return — ABW expected real return: fixed, TIPS yield, or CAPE-blended > blends the 4% CAPE earnings yield at 60% with the 2% bond yield to 3.2%/yr real
AssertionError: expectedRealReturnPct 4 is not within {"abs":1e-12} of the worksheet's 3.2: expected false to be true // Object.is equality
- Expected
+ Received
- true
+ false
 ❯ src/spending/abw.evidence.test.ts:63:9
     61|         withinTolerance(rate, expected, example.tolerance),
     62|         `expectedRealReturnPct ${rate} is not within ${JSON.stringify(…
     63|       ).toBe(true)
       |         ^
     64|     })
     65|
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
 Test Files  1 failed (1)
      Tests  1 failed | 3 passed (4)
```

## Revert

`git checkout -- packages/engine/src/spending/abw.ts`, then `git diff --quiet -- packages/engine/src/spending/abw.ts` exited 0, confirming no change to production code after the run.
