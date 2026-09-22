# Mutation receipt: exact-ledger-cleaned-schedule

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-fourteen` at base `a4a278ef`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/optimizePlan.ts`

```diff
diff --git a/packages/engine/src/projection/optimizePlan.ts b/packages/engine/src/projection/optimizePlan.ts
index 930a11ac..5e2083be 100644
--- a/packages/engine/src/projection/optimizePlan.ts
+++ b/packages/engine/src/projection/optimizePlan.ts
@@ -2401,7 +2401,7 @@ function buildCleanedConversionsFromExecution(
 
   for (const [year, requested] of [...requestedByYear.entries()].sort(([a], [b]) => a - b)) {
     const executed = Math.max(0, executedByYear.get(year) ?? 0)
-    const cleaned = executed > toleranceDollars ? Math.min(requested, executed) : 0
+    const cleaned = executed > toleranceDollars ? requested : 0
     if (cleaned > toleranceDollars) cleanedByYear.set(year, cleaned)
 
     const roundedRequested = roundDollars(requested)
```

Set the cleaned amount equal to the request instead of the per-year minimum — the worksheet's first wrong reading. `Y2` then republishes the `$15,000` the ledger could not fund out of a `$5,000` remaining traditional balance, and because requested and cleaned now agree the year is no longer a material difference at all, so the `ledger-capped` adjustment row disappears with it. Both fixtures see it.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/optimizePlan.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #730: the branch was renamed for the pull request, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (optimizePlan.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/projection/optimizePlan.evidence.test.ts (17 tests | 2 failed) 304ms
   ❯ exact-ledger-cleaned-schedule — Exact ledger cleaned schedule (2)
     × cleans $15,000 and $15,000 to $15,000 and $5,000, totalling $20,000 at a ratio of 1 8ms
     × records Y2 as ledger-capped, never the declared-but-never-assigned rounding 4ms

 Test Files  1 failed (1)
      Tests  2 failed | 15 passed (17)

  Transform  transforming modules took 2.53s · 42% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/optimizePlan.evidence.test.ts > exact-ledger-cleaned-schedule — Exact ledger cleaned schedule > cleans $15,000 and $15,000 to $15,000 and $5,000, totalling $20,000 at a ratio of 1
AssertionError: expected [ { year: 2026, amount: 15000 }, …(1) ] to deeply equal [ { year: 2026, amount: 15000 }, …(1) ]

- Expected
+ Received

@@ -2,9 +2,9 @@
    {
      "amount": 15000,
      "year": 2026,
    },
    {
-     "amount": 5000,
+     "amount": 15000,
      "year": 2027,
    },
  ]

 ❯ src/projection/optimizePlan.evidence.test.ts:841:53
    839|       const { rawSchedule, processed } = postProcess()
    840|
    841|       expect(processed.cleanedSchedule.conversions).toEqual(example.ex…
       |                                                     ^
    842|       // The wrong reading that sets cleaned equal to requested keeps …
    843|       // Y2 — the ledger only had $5,000 of traditional balance left.

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/projection/optimizePlan.evidence.test.ts > exact-ledger-cleaned-schedule — Exact ledger cleaned schedule > records Y2 as ledger-capped, never the declared-but-never-assigned rounding
AssertionError: expected [] to deep equally contain { year: 2027, requested: 15000, …(3) }

- Expected:
{
  "cleaned": 5000,
  "executed": 5000,
  "reason": "ledger-capped",
  "requested": 15000,
  "year": 2027,
}

+ Received:
[]

 ❯ src/projection/optimizePlan.evidence.test.ts:864:37
    862|       const { processed } = postProcess()
    863|
    864|       expect(processed.adjustments).toContainEqual(example.expected.se…
       |                                     ^
    865|       const reasons = processed.adjustments.map((adjustment) => adjust…
    866|       // Every reason this run assigned is one of the three live value…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/optimizePlan.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/optimizePlan.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
