# Mutation receipt: exact-ledger-traditional-depletion

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-twelve` at base `2c07f0d7`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730), and re-executed 2026-09-26 against RetireGolden base `6f58be5f` (branch `claude/solver-answers-unpriced-aca`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/decisions/evaluateCandidate.ts`

```diff
diff --git a/packages/engine/src/decisions/evaluateCandidate.ts b/packages/engine/src/decisions/evaluateCandidate.ts
index 5280543a..db19d082 100644
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

Re-executed 2026-09-26 on branch claude/solver-answers-unpriced-aca after the unpriced-ACA and required-floor change to the spending solver and the evaluator moved lines of the production file, so the capture, blob hashes and revert note are refreshed against this head. The baseline is green (optimizePlan.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine5/packages/engine

 ❯ src/projection/optimizePlan.evidence.test.ts (17 tests | 1 failed) 290ms
   ❯ exact-ledger-traditional-depletion — Exact ledger traditional depletion (2)
     × names 2031, where the owned balances sum to 0.90 and the inherited 24000 is excluded 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 16 passed (17)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/optimizePlan.evidence.test.ts > exact-ledger-traditional-depletion — Exact ledger traditional depletion > names 2031, where the owned balances sum to 0.90 and the inherited 24000 is excluded
AssertionError: expected null to be 2031 // Object.is equality

- Expected:
2031

+ Received:
null

 ❯ src/projection/optimizePlan.evidence.test.ts:416:51
    414|         candidateOf(inputs.rows as Row[]),
    415|       )
    416|       expect(validation.traditionalDepletionYear).toBe(example.expecte…
       |                                                   ^
    417|       // The wrong readings the worksheet names: including the inherit…
    418|       // balance finds no year at all, and requiring a zero balance po…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/decisions/evaluateCandidate.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/decisions/evaluateCandidate.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
