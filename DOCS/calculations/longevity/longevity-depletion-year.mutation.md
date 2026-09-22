# Mutation receipt: longevity-depletion-year

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-thirteen` at base `1452ae11`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualFundingApplicationAndClosePhase.ts`

```diff
diff --git a/packages/engine/src/projection/internal/annualFundingApplicationAndClosePhase.ts b/packages/engine/src/projection/internal/annualFundingApplicationAndClosePhase.ts
index 3a4581ea..7ecac1d8 100644
--- a/packages/engine/src/projection/internal/annualFundingApplicationAndClosePhase.ts
+++ b/packages/engine/src/projection/internal/annualFundingApplicationAndClosePhase.ts
@@ -1914,7 +1914,7 @@ export function annualFundingApplicationAndClosePhase(
     }
     deposit(surplus)
 
-    if (shortfallAfterHecm > ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS && depletionYear === null) depletionYear = year
+    if (shortfallAfterHecm >= 0 && depletionYear === null) depletionYear = year
 
     // --- property events + growth, then permanent-life transitions ---------
     // Both are application loops over a sibling phase rows, they deposit into
```

Test the shortfall against zero instead of the ledger's half-cent residual budget. This is the worksheet's second wrong reading made concrete: every year "qualifies", so the first row wins and the field reports 2026 instead of 2028 — and the two null cases, including the $30,000 opening balance that closes at exactly zero, report 2026 too.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/simulate.depletionYear.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #730: the branch was renamed for the pull request, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (simulate.depletionYear.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/projection/simulate.depletionYear.evidence.test.ts (3 tests | 3 failed) 36ms
   ❯ longevity-depletion-year — Depletion year: the first projection year whose shortfall clears the funding tolerance (3)
     × reports 2028, the first year whose shortfall exceeds the half-cent tolerance 29ms
     × reports null when every year is funded 3ms
     × does not call a year that closes at exactly zero depletion 3ms

 Test Files  1 failed (1)
      Tests  3 failed (3)

  Transform  transforming modules took 2.37s · 44% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/simulate.depletionYear.evidence.test.ts > longevity-depletion-year — Depletion year: the first projection year whose shortfall clears the funding tolerance > reports 2028, the first year whose shortfall exceeds the half-cent tolerance
AssertionError: expected 2026 to be 2028 // Object.is equality

- Expected
+ Received

- 2028
+ 2026

 ❯ src/projection/simulate.depletionYear.evidence.test.ts:74:36
     72|       // The constructed rows really do carry the worksheet's shortfal…
     73|       expectShortfalls(result, inputs.realizedShortfallsByYear as numb…
     74|       expect(result.depletionYear).toBe(expected.depletionYear)
       |                                    ^
     75|       // The worksheet's second wrong reading: 2026 funds itself in fu…
     76|       expect(result.depletionYear).not.toBe(years[0])

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

 FAIL  src/projection/simulate.depletionYear.evidence.test.ts > longevity-depletion-year — Depletion year: the first projection year whose shortfall clears the funding tolerance > reports null when every year is funded
AssertionError: expected 2026 to be null // Object.is equality

- Expected:
null

+ Received:
2026

 ❯ src/projection/simulate.depletionYear.evidence.test.ts:85:36
     83|       )
     84|       expectShortfalls(result, [0, 0, 0])
     85|       expect(result.depletionYear).toBe(expected.noDepletionYear)
       |                                    ^
     86|       // The worksheet's third wrong reading: the horizon year is not …
     87|       expect(result.depletionYear).not.toBe(years[2])

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

 FAIL  src/projection/simulate.depletionYear.evidence.test.ts > longevity-depletion-year — Depletion year: the first projection year whose shortfall clears the funding tolerance > does not call a year that closes at exactly zero depletion
AssertionError: expected 2026 to be null // Object.is equality

- Expected:
null

+ Received:
2026

 ❯ src/projection/simulate.depletionYear.evidence.test.ts:103:36
    101|       ).toBe(true)
    102|       expectShortfalls(result, [0, 0, 0])
    103|       expect(result.depletionYear).toBe(expected.zeroCloseDepletionYea…
       |                                    ^
    104|     })
    105|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/internal/annualFundingApplicationAndClosePhase.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/internal/annualFundingApplicationAndClosePhase.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
