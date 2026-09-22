# Mutation receipt: hecm-draw-annual

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eleven` at base `60e47fd8`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualHecmBackstop.ts`

```diff
@@ -60,10 +60,7 @@
       visitedHecmLineIds.add(account.id)
       const line = input.hecmStates.get(account.id)
       if (!line) continue
-      const amount = Math.min(
-        remaining,
-        Math.max(0, line.principalLimit - line.loanBalance),
-      )
+      const amount = remaining
       if (amount <= 0) continue
       allocations.push({ propertyAccountId: account.id, amount })
       draw += amount
```

This draws the whole shortfall without the available-line cap, publishing $40,000 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualHecmBackstop.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #730: the branch was renamed for the pull request, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (annualHecmBackstop.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/projection/internal/annualHecmBackstop.evidence.test.ts (4 tests | 4 failed) 33ms
   ❯ spending-shortfall-annual — Annual funding shortfall after the HECM backstop (2)
     × publishes the 500 left after 10000 of withdrawals and a 1500 HECM draw 29ms
     × makes 2034 the depletion year only because 500 exceeds the ledger tolerance 2ms
   ❯ hecm-draw-annual — Annual HECM draw, including the last-resort backstop (2)
     × draws the whole 25000 available line against the 40000 shortfall and no more 0ms
     × publishes the same 25000 as hecmDraw on a real last-resort ledger year 2ms

 Test Files  1 failed (1)
      Tests  4 failed (4)

  Transform  transforming modules took 2.44s · 44% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/annualHecmBackstop.evidence.test.ts > spending-shortfall-annual — Annual funding shortfall after the HECM backstop > publishes the 500 left after 10000 of withdrawals and a 1500 HECM draw
AssertionError: hecmDraw: actual 2000, worksheet 1500: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/internal/annualHecmBackstop.evidence.test.ts:91:9
     89|         withinTolerance(row.hecmDraw, inputs.hecmBackstopDraw!, exampl…
     90|         `hecmDraw: actual ${row.hecmDraw}, worksheet ${inputs.hecmBack…
     91|       ).toBe(true)
       |         ^
     92|       // The pre-HECM gap, asserted separately from the published figu…
     93|       expect(

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/4]⎯

 FAIL  src/projection/internal/annualHecmBackstop.evidence.test.ts > spending-shortfall-annual — Annual funding shortfall after the HECM backstop > makes 2034 the depletion year only because 500 exceeds the ledger tolerance
AssertionError: expected 0 to be greater than 0.005
 ❯ src/projection/internal/annualHecmBackstop.evidence.test.ts:117:29
    115|       const result = shortfallRun()
    116|       const row = result.years.find((entry) => entry.year === YEAR)!
    117|       expect(row.shortfall).toBeGreaterThan(ANNUAL_FUNDING_TOLERANCE_P…
       |                             ^
    118|       expect(result.depletionYear).toBe(YEAR)
    119|     })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/4]⎯

 FAIL  src/projection/internal/annualHecmBackstop.evidence.test.ts > hecm-draw-annual — Annual HECM draw, including the last-resort backstop > draws the whole 25000 available line against the 40000 shortfall and no more
AssertionError: backstop draw 40000 is not within {"abs":0.005} of the worksheet's 25000: expected false to be true // Object.is equality

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
 ❯ src/projection/internal/annualHecmBackstop.evidence.test.ts:174:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/4]⎯

 FAIL  src/projection/internal/annualHecmBackstop.evidence.test.ts > hecm-draw-annual — Annual HECM draw, including the last-resort backstop > publishes the same 25000 as hecmDraw on a real last-resort ledger year
AssertionError: hecmDraw 40000 is not within {"abs":0.005} of the worksheet's 25000: expected false to be true // Object.is equality

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
 ❯ src/projection/internal/annualHecmBackstop.evidence.test.ts:204:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/4]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/internal/annualHecmBackstop.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/internal/annualHecmBackstop.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
