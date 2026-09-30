# Mutation receipt: spending-shortfall-annual

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-nine` at base `39f8f460`, and re-executed 2026-09-22 against RetireGolden base `4fe87f00` (branch `claude/b1-p4-cards-nine-ten`, pull request #729), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet) in `packages/engine`.

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

Re-executed for D-RECEIPT-DRIFT because the test lines and test counts it quoted no longer matched the current test file; the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (annualHecmBackstop.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/projection/internal/annualHecmBackstop.evidence.test.ts (4 tests | 3 failed) 35ms
   ❯ spending-shortfall-annual — Annual funding shortfall after the HECM backstop (2)
     × publishes the 500 left after 10000 of withdrawals and a 1500 HECM draw 30ms
   ❯ hecm-draw-annual — Annual HECM draw, including the last-resort backstop (2)
     × draws the whole 25000 available line against the 40000 shortfall and no more 1ms
     × publishes the same 25000 as hecmDraw on a real last-resort ledger year 2ms

 Test Files  1 failed (1)
      Tests  3 failed | 1 passed (4)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/annualHecmBackstop.evidence.test.ts > spending-shortfall-annual — Annual funding shortfall after the HECM backstop > publishes the 500 left after 10000 of withdrawals and a 1500 HECM draw
AssertionError: shortfall: actual 2000, worksheet 500: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/internal/annualHecmBackstop.evidence.test.ts:105:9
    103|         withinTolerance(row.shortfall, expected.shortfall!, example.to…
    104|         `shortfall: actual ${row.shortfall}, worksheet ${expected.shor…
    105|       ).toBe(true)
       |         ^
    106|       // The worksheet's first two wrong readings: the pre-HECM gap, a…
    107|       // HECM draw counted as another expense.

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

 FAIL  src/projection/internal/annualHecmBackstop.evidence.test.ts > hecm-draw-annual — Annual HECM draw, including the last-resort backstop > draws the whole 25000 available line against the 40000 shortfall and no more
AssertionError: shortfall after the backstop 40000 is not within {"abs":0.005} of the worksheet's 15000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/internal/annualHecmBackstop.evidence.test.ts:157:9
    155|         withinTolerance(actual, target, example.tolerance),
    156|         `${label} ${actual} is not within ${JSON.stringify(example.tol…
    157|       ).toBe(true)
       |         ^
    158|     }
    159|
 ❯ src/projection/internal/annualHecmBackstop.evidence.test.ts:175:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

 FAIL  src/projection/internal/annualHecmBackstop.evidence.test.ts > hecm-draw-annual — Annual HECM draw, including the last-resort backstop > publishes the same 25000 as hecmDraw on a real last-resort ledger year
AssertionError: residual shortfall 40000 is not within {"abs":0.005} of the worksheet's 15000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/internal/annualHecmBackstop.evidence.test.ts:157:9
    155|         withinTolerance(actual, target, example.tolerance),
    156|         `${label} ${actual} is not within ${JSON.stringify(example.tol…
    157|       ).toBe(true)
       |         ^
    158|     }
    159|
 ❯ src/projection/internal/annualHecmBackstop.evidence.test.ts:205:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/internal/annualHecmBackstop.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/internal/annualHecmBackstop.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
