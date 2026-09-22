# Mutation receipt: spending-shortfall-annual

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-nine` at base `39f8f460`, and re-executed 2026-09-22 against RetireGolden base `4fe87f00` (branch `claude/b1-p4-cards-nine-ten`, pull request #729) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualHecmBackstop.ts`

```diff
@@ -75,6 +75,6 @@ export function annualHecmBackstopPlan(
   return {
     allocations,
     draw,
-    shortfallAfterHecm: Math.max(0, input.portfolioShortfall - draw),
+    shortfallAfterHecm: Math.max(0, input.portfolioShortfall),
   }
 }
```

This publishes the pre-HECM gap, $2,000, instead of the gap left after the backstop draw — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualHecmBackstop.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #729: the branch was renamed for the pull request and several fixtures changed, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (annualHecmBackstop.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/projection/internal/annualHecmBackstop.evidence.test.ts (2 tests | 1 failed) 44ms
   ❯ spending-shortfall-annual — Annual funding shortfall after the HECM backstop (2)
     × publishes the 500 left after 10000 of withdrawals and a 1500 HECM draw 41ms

 Test Files  1 failed (1)
      Tests  1 failed | 1 passed (2)

  Transform  transforming modules took 2.14s · 44% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/annualHecmBackstop.evidence.test.ts > spending-shortfall-annual — Annual funding shortfall after the HECM backstop > publishes the 500 left after 10000 of withdrawals and a 1500 HECM draw
AssertionError: shortfall: actual 2000, worksheet 500: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/internal/annualHecmBackstop.evidence.test.ts:104:9
    102|         withinTolerance(row.shortfall, expected.shortfall!, example.to…
    103|         `shortfall: actual ${row.shortfall}, worksheet ${expected.shor…
    104|       ).toBe(true)
       |         ^
    105|       // The worksheet's first two wrong readings: the pre-HECM gap, a…
    106|       // HECM draw counted as another expense.

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/internal/annualHecmBackstop.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/internal/annualHecmBackstop.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
