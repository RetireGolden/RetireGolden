# Mutation receipt: inherited-distribution-forced-annual

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eleven` at base `60e47fd8`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualInheritedIraDistributions.ts`

```diff
@@ -257,8 +257,10 @@
             ...(characterized.reason === undefined ? {} : { reason: characterized.reason }),
           })
         }
-      } else ordinaryIncome += executed
-      inherited += executed
+      } else {
+        ordinaryIncome += executed
+        inherited += executed
+      }
     }
     rows.push({
       balanceIndex,
```

This excludes Roth forced dollars from the gross forced total, publishing $8,000 instead of $11,000 — the worksheet's second wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualInheritedIraDistributions.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #730: the branch was renamed for the pull request, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (annualInheritedIraDistributions.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/projection/internal/annualInheritedIraDistributions.evidence.test.ts (4 tests | 1 failed) 8ms
   ❯ inherited-distribution-forced-annual — Annual forced inherited distribution (1)
     × sums 11000 of forced cash and carries the 600 Roth slice into the traditional share 3ms

 Test Files  1 failed (1)
      Tests  1 failed | 3 passed (4)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/annualInheritedIraDistributions.evidence.test.ts > inherited-distribution-forced-annual — Annual forced inherited distribution > sums 11000 of forced cash and carries the 600 Roth slice into the traditional share
AssertionError: expected 8000 to be 11000 // Object.is equality

- Expected
+ Received

- 11000
+ 8000

 ❯ src/projection/internal/annualInheritedIraDistributions.evidence.test.ts:335:39
    333|
    334|       // The gross forced total, which is what YearResult.inheritedDis…
    335|       expect(result.totals.inherited).toBe(expected.inheritedDistribut…
       |                                       ^
    336|       // The current-code traditional/ordinary-income share, D-INHERIT…
    337|       expect(result.totals.ordinaryIncome).toBe(expected.inheritedTrad…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/internal/annualInheritedIraDistributions.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/internal/annualInheritedIraDistributions.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
