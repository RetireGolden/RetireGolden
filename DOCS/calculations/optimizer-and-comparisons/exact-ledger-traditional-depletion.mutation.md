# Mutation receipt: exact-ledger-traditional-depletion

Executed 2026-09-18 against RetireGolden base `2c07f0d7` (branch `claude/b1-p4-cards-slice-twelve`) in `packages/engine`.

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

Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-s12/packages/engine

 ❯ src/projection/optimizePlan.evidence.test.ts (10 tests | 1 failed) 29ms
   ❯ exact-ledger-traditional-depletion — Exact ledger traditional depletion (2)
     × names 2031, where the owned balances sum to 0.90 and the inherited 24000 is excluded 4ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/optimizePlan.evidence.test.ts > exact-ledger-traditional-depletion — Exact ledger traditional depletion > names 2031, where the owned balances sum to 0.90 and the inherited 24000 is excluded
AssertionError: expected null to be 2031 // Object.is equality

- Expected:
2031

+ Received:
null

 ❯ src/projection/optimizePlan.evidence.test.ts:403:51
    401|         candidateOf(inputs.rows as Row[]),
    402|       )
    403|       expect(validation.traditionalDepletionYear).toBe(example.expecte…
       |                                                   ^
    404|       // The wrong readings the worksheet names: including the inherit…
    405|       // balance finds no year at all, and requiring a zero balance po…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯


 Test Files  1 failed (1)
      Tests  1 failed | 9 passed (10)
```

## Revert

`git checkout -- packages/engine/src/decisions/evaluateCandidate.ts` restored the file, and `git diff --quiet -- packages/engine/src/decisions/evaluateCandidate.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the named file passed again (10 passed, exit 0).
