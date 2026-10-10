# Mutation receipt: estate-account-breakdown

Executed 2026-10-10 against RetireGolden base `43876e8d` (branch `claude/census-completion`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/compare.ts`

```diff
diff --git a/packages/engine/src/projection/compare.ts b/packages/engine/src/projection/compare.ts
index f552286d4..4e2d91422 100644
--- a/packages/engine/src/projection/compare.ts
+++ b/packages/engine/src/projection/compare.ts
@@ -473,5 +473,5 @@ export function summarizeProjection(
         charityAmount,
         heirTax,
-        netToHeirs: grossBalance - charityAmount - heirTax,
+        netToHeirs: grossBalance - heirTax,
       })
     }
```

Leave the charity share in what passes on, the worksheet's wrong reading: the case 2 401k nets 238,576 instead of 161,076. The charity amount and the heir tax are computed before this line and do not move, so the published totals stay right and only the per-account netToHeirs this record outputs is wrong.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/compareSummary.breakdowns.evidence.test.ts
```

## Captured failing output

First execution, 2026-10-10 (D-MCP-CENSUS-PIN). The baseline is green (compareSummary.breakdowns.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/projection/compareSummary.breakdowns.evidence.test.ts (3 tests | 1 failed) 19ms
   ❯ estate-account-breakdown — Estate breakdown by account (2)
     × spreads the basis, takes charity off the gross and taxes the rest by class: the 401k nets 161076 5ms

 Test Files  1 failed (1)
      Tests  1 failed | 2 passed (3)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/compareSummary.breakdowns.evidence.test.ts > estate-account-breakdown — Estate breakdown by account > spreads the basis, takes charity off the gross and taxes the rest by class: the 401k nets 161076
AssertionError: Jordan 401k netToHeirs: actual 238576, worksheet 161076: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectRows src/projection/compareSummary.breakdowns.evidence.test.ts:284:13
    282|             withinTolerance(row[column], worksheet, example.tolerance),
    283|             `${want.name} ${column}: actual ${row[column]}, worksheet …
    284|           ).toBe(true)
       |             ^
    285|         }
    286|       }
 ❯ src/projection/compareSummary.breakdowns.evidence.test.ts:303:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/compare.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/compare.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
