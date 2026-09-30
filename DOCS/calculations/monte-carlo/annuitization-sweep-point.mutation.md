# Mutation receipt: annuitization-sweep-point

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-thirteen` at base `1452ae11`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730), and re-executed 2026-09-28 against RetireGolden base `da378d9b` (branch `claude/people-order-and-scenarios`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `1c7341f5` (branch `claude/people-order-and-scenarios`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/decisions/annuitization.ts`

```diff
diff --git a/packages/engine/src/decisions/annuitization.ts b/packages/engine/src/decisions/annuitization.ts
index 87687de9..bca4623e 100644
--- a/packages/engine/src/decisions/annuitization.ts
+++ b/packages/engine/src/decisions/annuitization.ts
@@ -187,7 +187,7 @@ export function buildAnnuitizationSweep(
   const pointMeta: Array<{ pct: number; premium: number; annualIncome: number; controlId?: string }> = []
 
   for (const pct of pcts) {
-    const premium = Math.min((pct / 100) * total, fundingCap)
+    const premium = (pct / 100) * total
     if (premium < 5_000) continue
     const annualIncome = premium * payoutRate
     const spia: Account = {
```

Drop the funding-account cap and buy the requested grid share outright — the worksheet's first wrong reading. The 60% point prices a $120,000 premium against a $100,000 cash account instead of the $95,000 that account can actually fund, and the annual income and effective allocation follow it to $10,992 and 60%.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/decisions/annuitization.evidence.test.ts
```

## Captured failing output

Re-executed because decision D-PEOPLE-ORDER's canonical-person changes moved the production lines or the evidence test lines this receipt quotes; the mutation is unchanged. The baseline is green (annuitization.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/decisions/annuitization.evidence.test.ts (3 tests | 2 failed) 57ms
   ❯ annuitization-sweep-point — Annuitization sweep point: premium, annual income and effective allocation (3)
     × caps the 60% point at the funding account and prices it at the interpolated rate 37ms
     × for a couple, prices every point on the older person, whoever is listed first, and names them 14ms

 Test Files  1 failed (1)
      Tests  2 failed | 1 passed (3)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/decisions/annuitization.evidence.test.ts > annuitization-sweep-point — Annuitization sweep point: premium, annual income and effective allocation > caps the 60% point at the funding account and prices it at the interpolated rate
AssertionError: premium 120000 is not within {"abs":0.005} of 95000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/decisions/annuitization.evidence.test.ts:58:9
     56|         withinTolerance(actual, target, example.tolerance),
     57|         `${label} ${actual} is not within ${JSON.stringify(example.tol…
     58|       ).toBe(true)
       |         ^
     59|     }
     60|
 ❯ src/decisions/annuitization.evidence.test.ts:96:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/decisions/annuitization.evidence.test.ts > annuitization-sweep-point — Annuitization sweep point: premium, annual income and effective allocation > for a couple, prices every point on the older person, whoever is listed first, and names them
AssertionError: annualIncome 10992 is not within {"abs":0.005} of 8702: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/decisions/annuitization.evidence.test.ts:58:9
     56|         withinTolerance(actual, target, example.tolerance),
     57|         `${label} ${actual} is not within ${JSON.stringify(example.tol…
     58|       ).toBe(true)
       |         ^
     59|     }
     60|
 ❯ src/decisions/annuitization.evidence.test.ts:151:9

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/decisions/annuitization.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/decisions/annuitization.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
