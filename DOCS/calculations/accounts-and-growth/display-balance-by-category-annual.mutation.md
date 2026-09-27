# Mutation receipt: display-balance-by-category-annual

Executed 2026-09-26 against RetireGolden base `6b01db8d` (branch `claude/b2p1-slice1-ledger-figures`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/yearFigures.ts`

```diff
diff --git a/packages/engine/src/projection/yearFigures.ts b/packages/engine/src/projection/yearFigures.ts
index 8c3ca959..f9c2b4fd 100644
--- a/packages/engine/src/projection/yearFigures.ts
+++ b/packages/engine/src/projection/yearFigures.ts
@@ -255,3 +255,3 @@
   const out: Record<BalanceCategory, number> = { cash: 0, taxable: 0, equityComp: 0, traditional: 0, roth: 0, hsa: 0 }
-  for (const account of selectedLogicalBalanceAccounts(plan.accounts)) {
+  for (const account of plan.accounts as ReturnType<typeof selectedLogicalBalanceAccounts>) {
     out[account.type] += year.balances[account.id] ?? 0
```

Iterates the plan rows instead of the logical accounts, the retired page loop and the worksheet's first wrong reading: case A then shows 200,000 of traditional money instead of 100,000.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/yearFigures.evidence.test.ts
```

## Captured failing output

Re-executed for D-RECEIPT-DRIFT because its hunk header named a line its production code has since moved from; the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (yearFigures.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine9/packages/engine

 ❯ src/projection/yearFigures.evidence.test.ts (13 tests | 2 failed) 48ms
   ❯ display-balance-by-category-annual — Balances by account type, one value per logical account (4)
     × counts an account split across two rows once (R1) 7ms
     × sums all six categories from a published row and leaves property, debt and policy values out 1ms

 Test Files  1 failed (1)
      Tests  2 failed | 11 passed (13)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/yearFigures.evidence.test.ts > display-balance-by-category-annual — Balances by account type, one value per logical account > counts an account split across two rows once (R1)
AssertionError: expected { cash: 1000, taxable: +0, …(4) } to deeply equal { cash: 1000, taxable: +0, …(4) }

- Expected
+ Received

@@ -2,7 +2,7 @@
    "cash": 1000,
    "equityComp": 0,
    "hsa": 0,
    "roth": 0,
    "taxable": 0,
-   "traditional": 100000,
+   "traditional": 200000,
  }

 ❯ src/projection/yearFigures.evidence.test.ts:341:26
    339|       const plan = { accounts }
    340|       const categories = balancesByCategory(plan, year)
    341|       expect(categories).toEqual(expected.caseA)
       |                          ^
    342|       expect(Object.keys(categories)).toEqual([...BALANCE_CATEGORIES])
    343|       const sum = BALANCE_CATEGORIES.reduce((total, category) => total…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/projection/yearFigures.evidence.test.ts > display-balance-by-category-annual — Balances by account type, one value per logical account > sums all six categories from a published row and leaves property, debt and policy values out
AssertionError: expected { cash: 10000, taxable: 50000, …(6) } to deeply equal { cash: 10000, taxable: 25000, …(4) }

- Expected
+ Received

  {
    "cash": 10000,
+   "debt": NaN,
    "equityComp": 7500,
    "hsa": 6000,
+   "property": NaN,
    "roth": 40000,
-   "taxable": 25000,
+   "taxable": 50000,
    "traditional": 30000,
  }

 ❯ src/projection/yearFigures.evidence.test.ts:361:26
    359|       const plan = { accounts, insurance: [{ kind: 'permanentLife', id…
    360|       const categories = balancesByCategory(plan, { balances: { ...b }…
    361|       expect(categories).toEqual(expected.caseB)
       |                          ^
    362|       expect(categories.taxable).not.toBe(expected.caseBWrongPerRowTax…
    363|     })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/yearFigures.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/yearFigures.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
