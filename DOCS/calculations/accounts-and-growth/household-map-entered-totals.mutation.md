# Mutation receipt: entered-balance-sheet

Executed 2026-09-30 against RetireGolden base `fbc9a9d3` (branch `claude/ui-relocations-six`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/model/enteredBalanceSheet.ts`

```diff
diff --git a/packages/engine/src/model/enteredBalanceSheet.ts b/packages/engine/src/model/enteredBalanceSheet.ts
index d9beae013..9ca8673e0 100644
--- a/packages/engine/src/model/enteredBalanceSheet.ts
+++ b/packages/engine/src/model/enteredBalanceSheet.ts
@@ -67,7 +67,7 @@ export function enteredBalanceSheet(accounts: Iterable<Account>): EnteredBalance
     }
   }
   const assets = investable + property
-  return { investable, property, assets, liabilities, netWorth: assets - liabilities }
+  return { investable, property, assets, liabilities, netWorth: investable - liabilities }
 }
 
 function finiteFigure(figure: number, accountId: string): number {
```

Net worth without the property, the worksheet's second wrong reading: case A's net reads 790,000 where the worksheet expects 1,440,000, and case D's 500,000 where it expects 1,150,000.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/model/enteredBalanceSheet.evidence.test.ts
```

## Captured failing output

The baseline is green (enteredBalanceSheet.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/model/enteredBalanceSheet.evidence.test.ts (7 tests | 3 failed) 8ms
   ❯ entered-balance-sheet — Balance sheet as entered (7)
     × case A: investable 1,000,000, property 650,000, assets 1,650,000, debts 210,000, net 1,440,000 5ms
     × case B: debts larger than assets give a negative net of -140,000 1ms
     × case D: the sheet of the accounts a view shows sums only those accounts 0ms

 Test Files  1 failed (1)
      Tests  3 failed | 4 passed (7)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/model/enteredBalanceSheet.evidence.test.ts > entered-balance-sheet — Balance sheet as entered > case A: investable 1,000,000, property 650,000, assets 1,650,000, debts 210,000, net 1,440,000
AssertionError: expected { investable: 1000000, …(4) } to deeply equal { investable: 1000000, …(4) }

- Expected
+ Received

  {
    "assets": 1650000,
    "investable": 1000000,
    "liabilities": 210000,
-   "netWorth": 1440000,
+   "netWorth": 790000,
    "property": 650000,
  }

 ❯ src/model/enteredBalanceSheet.evidence.test.ts:77:21
     75|     it('case A: investable 1,000,000, property 650,000, assets 1,650,0…
     76|       const sheet = enteredBalanceSheet(caseA())
     77|       expect(sheet).toEqual(expected.caseA)
       |                     ^
     78|       expect(sheet.investable).not.toBe(expected.wrongMonthlyAsBalance…
     79|       expect(sheet.netWorth).not.toBe(expected.wrongPropertyDroppedNet…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

 FAIL  src/model/enteredBalanceSheet.evidence.test.ts > entered-balance-sheet — Balance sheet as entered > case B: debts larger than assets give a negative net of -140,000
AssertionError: expected { investable: 10000, …(4) } to deeply equal { investable: 10000, …(4) }

- Expected
+ Received

  {
    "assets": 210000,
    "investable": 10000,
    "liabilities": 350000,
-   "netWorth": -140000,
+   "netWorth": -340000,
    "property": 200000,
  }

 ❯ src/model/enteredBalanceSheet.evidence.test.ts:84:116
     82|
     83|     it('case B: debts larger than assets give a negative net of -140,0…
     84|       expect(enteredBalanceSheet([cashAccount('cash', 10_000), propert…
       |                                                                                                                    ^
     85|     })
     86|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

 FAIL  src/model/enteredBalanceSheet.evidence.test.ts > entered-balance-sheet — Balance sheet as entered > case D: the sheet of the accounts a view shows sums only those accounts
AssertionError: expected { investable: 500000, …(4) } to deeply equal { investable: 500000, …(4) }

- Expected
+ Received

  {
    "assets": 1150000,
    "investable": 500000,
    "liabilities": 0,
-   "netWorth": 1150000,
+   "netWorth": 500000,
    "property": 650000,
  }

 ❯ src/model/enteredBalanceSheet.evidence.test.ts:93:42
     91|     it('case D: the sheet of the accounts a view shows sums only those…
     92|       const shown = caseA().filter((account) => account.id !== 'ira' &…
     93|       expect(enteredBalanceSheet(shown)).toEqual(expected.caseD)
       |                                          ^
     94|     })
     95|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯
```

## Revert

The original bytes of `packages/engine/src/model/enteredBalanceSheet.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/model/enteredBalanceSheet.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
