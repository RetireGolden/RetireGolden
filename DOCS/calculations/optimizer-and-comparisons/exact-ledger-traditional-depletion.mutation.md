# Mutation receipt: exact-ledger-traditional-depletion

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-twelve` at base `2c07f0d7`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730) in `packages/engine`.

## Mutation applied to `packages/engine/src/decisions/evaluateCandidate.ts`

```diff
diff --git a/packages/engine/src/decisions/evaluateCandidate.ts b/packages/engine/src/decisions/evaluateCandidate.ts
index f18d4c86..07afe6db 100644
--- a/packages/engine/src/decisions/evaluateCandidate.ts
+++ b/packages/engine/src/decisions/evaluateCandidate.ts
@@ -683,7 +683,7 @@ export function findTraditionalDepletionYear(
   toleranceDollars: number,
 ): number | null {
   const ownTraditionalIds = new Set(
-    plan.accounts.filter((account) => account.type === 'traditional' && !account.inherited).map((account) => account.id),
+    plan.accounts.filter((account) => account.type === 'traditional').map((account) => account.id),
   )
   if (ownTraditionalIds.size === 0) return null
   for (const year of result.years) {
```

Include inherited traditional balances in the owned sum — the worksheet's first wrong reading, which gives 2031 a sum of `$24,000.90` and postpones the answer to `null` for these rows.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/optimizePlan.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #730: the branch was renamed for the pull request, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (optimizePlan.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/projection/optimizePlan.evidence.test.ts (17 tests | 1 failed) 289ms
   ❯ exact-ledger-traditional-depletion — Exact ledger traditional depletion (2)
     × names 2031, where the owned balances sum to 0.90 and the inherited 24000 is excluded 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 16 passed (17)

  Transform  transforming modules took 2.52s · 42% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/optimizePlan.evidence.test.ts > exact-ledger-traditional-depletion — Exact ledger traditional depletion > names 2031, where the owned balances sum to 0.90 and the inherited 24000 is excluded
AssertionError: expected null to be 2031 // Object.is equality

- Expected:
2031

+ Received:
null

 ❯ src/projection/optimizePlan.evidence.test.ts:415:51
    413|         candidateOf(inputs.rows as Row[]),
    414|       )
    415|       expect(validation.traditionalDepletionYear).toBe(example.expecte…
       |                                                   ^
    416|       // The wrong readings the worksheet names: including the inherit…
    417|       // balance finds no year at all, and requiring a zero balance po…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/decisions/evaluateCandidate.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/decisions/evaluateCandidate.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
