# Mutation receipt: inherited-distribution-forced-annual

Executed 2026-09-18 against RetireGolden base `60e47fd8` (branch claude/b1-p4-cards-slice-eleven) in `packages/engine`.

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

```
 FAIL  src/projection/internal/annualInheritedIraDistributions.evidence.test.ts > inherited-distribution-forced-annual — Annual forced inherited distribution > sums 11000 of forced cash and carries the 600 Roth slice into the traditional share
AssertionError: expected 8000 to be 11000 // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/projection/internal/annualInheritedIraDistributions.ts`, then `git diff --quiet -- packages/engine/src/projection/internal/annualInheritedIraDistributions.ts` exited 0, confirming no change to production code after the run.
