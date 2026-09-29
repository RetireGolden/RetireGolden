# Mutation receipt: projection-summary-coast-fire-number

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-seven` at base `74916a7e`, and re-executed 2026-09-22 against RetireGolden base `7ae019a8` (branch `claude/b1-p4-cards-seven`, pull request #727), and re-executed 2026-09-26 against RetireGolden base `fff2423b` (branch `claude/b2p1-slice1-ledger-figures`; no pull request is open yet), and re-executed 2026-09-26 against RetireGolden base `94954596` (branch `claude/b2p1-slice1-ledger-figures`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `373a40f0` (branch `claude/b2p1-slice3-comparisons`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `da378d9b` (branch `claude/people-order-and-scenarios`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `6905169c` (branch `claude/people-order-and-scenarios`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `85e2fdb8` (branch `claude/people-order-and-scenarios`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/compare.ts`

```diff
diff --git a/packages/engine/src/projection/compare.ts b/packages/engine/src/projection/compare.ts
index 6b4a9cfc..12bf1dd4 100644
--- a/packages/engine/src/projection/compare.ts
+++ b/packages/engine/src/projection/compare.ts
@@ -558,2 +558,2 @@
     ? null
-    : fiNumber / Math.pow(1 + realReturn, Math.max(0, targetYear - startYear))
+    : fiNumber / Math.pow(1 + realReturn, Math.max(0, isoYear(plan.household.people[0]!.dob) + (plan.household.people[0]!.retirementAge ?? 65) - startYear))
```

Re-derived for decision D-PEOPLE-ORDER (rule R4): discount over the first-listed person's retirement, the rule before the decision, instead of the household's later one. The worksheet's couple case reads 4 years to Pat's 2030 instead of 6 to Robin's 2032, 1,574,947.12 instead of 1,456,127.14, and the evidence fails there (and in projection-summary-fi-spending-base's Coast-FIRE figure). Re-derived again for the independent review's N3, which folded the horizon into the null-when-nobody-retires expression: the same reading on the new line.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/compareSummary.evidence.test.ts
```

## Captured failing output

Re-derived for the independent review's N3: the mutation keeps its reading on the line N3 made null-aware. The baseline is green (compareSummary.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine19/packages/engine

 ❯ src/projection/compareSummary.evidence.test.ts (23 tests | 3 failed) 25ms
   ❯ projection-summary-coast-fire-number — Projection summary coast fire number (3)
     × discounts a couple over the household's later retirement, 6 years to Robin's 2032, whoever is listed first 5ms
   ❯ projection-summary-fi-spending-base — Which year and which outflows the FI figures price (3)
     × prices 2032, Robin’s later retirement, from the conversion-free run: 1,842,465.36 1ms
     × gives the same figures with the people listed the other way round 1ms

 Test Files  1 failed (1)
      Tests  3 failed | 20 passed (23)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/compareSummary.evidence.test.ts > projection-summary-coast-fire-number — Projection summary coast fire number > discounts a couple over the household's later retirement, 6 years to Robin's 2032, whoever is listed first
AssertionError: listed coastFireNumber: actual 1574947.115576125, worksheet 1,456,127.140880293: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/compareSummary.evidence.test.ts:421:11
    419|           withinTolerance(summary.coastFireNumber!, 1_456_127.14088029…
    420|           `${order} coastFireNumber: actual ${summary.coastFireNumber}…
    421|         ).toBe(true)
       |           ^
    422|       }
    423|     })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

 FAIL  src/projection/compareSummary.evidence.test.ts > projection-summary-fi-spending-base — Which year and which outflows the FI figures price > prices 2032, Robin’s later retirement, from the conversion-free run: 1,842,465.36
AssertionError: coastFireNumber: actual 1574947.115576125, worksheet 1456127.140880293: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/compareSummary.evidence.test.ts:1128:9
    1126|         withinTolerance(summary.coastFireNumber!, fiBaseExpected('Coas…
    1127|         `coastFireNumber: actual ${summary.coastFireNumber}, worksheet…
    1128|       ).toBe(true)
       |         ^
    1129|     })
    1130|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

 FAIL  src/projection/compareSummary.evidence.test.ts > projection-summary-fi-spending-base — Which year and which outflows the FI figures price > gives the same figures with the people listed the other way round
AssertionError: expected 1456127.1408802927 to be 1574947.115576125 // Object.is equality

- Expected
+ Received

- 1574947.115576125
+ 1456127.1408802927

 ❯ src/projection/compareSummary.evidence.test.ts:1135:40
    1133|       const reversed = summarizeProjection(couple('reversed'), convert…
    1134|       expect(reversed.fiNumber).toBe(listed.fiNumber)
    1135|       expect(reversed.coastFireNumber).toBe(listed.coastFireNumber)
       |                                        ^
    1136|       expect(reversed.fiBasis).toEqual(listed.fiBasis)
    1137|     })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/compare.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/compare.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
