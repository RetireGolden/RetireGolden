# Mutation receipt: covered-work-credit-estimate

Executed 2026-09-27 against RetireGolden base `20b95c74` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/socialSecurity/analysis/credits.ts`

```diff
diff --git a/packages/engine/src/socialSecurity/analysis/credits.ts b/packages/engine/src/socialSecurity/analysis/credits.ts
index e0593f04..dd39cb41 100644
--- a/packages/engine/src/socialSecurity/analysis/credits.ts
+++ b/packages/engine/src/socialSecurity/analysis/credits.ts
@@ -32,7 +32,7 @@ export interface CreditEstimate {
  */
 export function creditsForYear(year: number, amount: number): number {
   if (!(amount > 0) || year < FIRST_WAGE_BASE_YEAR) return 0
-  const quarterAmount = quarterOfCoverageAmountForYearOrLatest(year) ?? PRE_1978_QUARTER_WAGES
+  const quarterAmount = 1_810
   return Math.min(MAX_CREDITS_PER_YEAR, Math.floor(amount / quarterAmount))
 }
 
```

This applies the 2025 amount, $1,810, to every year, the retired rule and the worksheet's first wrong reading: case A falls to 5 credits and case B to 5.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/socialSecurity/analysis/credits.evidence.test.ts
```

## Captured failing output

The baseline is green (credits.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine13/packages/engine

 ❯ src/socialSecurity/analysis/credits.evidence.test.ts (6 tests | 3 failed) 7ms
   ❯ covered-work-credit-estimate — Covered-work credit estimate (6)
     × case A: each year at its own quarter-of-coverage amount (11, where one 2025 amount gave 5) 5ms
     × case B: a year before 1978 counts at most one credit per $50, up to four (15) 1ms
     × carries SSA's quarter-of-coverage amount for every year 1978 to 2026, 2026's $1,890 included 1ms

 Test Files  1 failed (1)
      Tests  3 failed | 3 passed (6)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/socialSecurity/analysis/credits.evidence.test.ts > covered-work-credit-estimate — Covered-work credit estimate > case A: each year at its own quarter-of-coverage amount (11, where one 2025 amount gave 5)
AssertionError: expected { credits: 5, eligible: false, …(1) } to deeply equal { credits: 11, eligible: false, …(1) }

- Expected
+ Received

  {
-   "credits": 11,
+   "credits": 5,
    "eligible": false,
    "estimated": true,
  }

 ❯ src/socialSecurity/analysis/credits.evidence.test.ts:34:24
     32|     it('case A: each year at its own quarter-of-coverage amount (11, w…
     33|       const estimate = estimateCredits(caseA, null)
     34|       expect(estimate).toEqual({ credits: credits('A'), eligible: elig…
       |                        ^
     35|       expect(estimate.credits).not.toBe(worksheetNumber(rows.get('A')!…
     36|     })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

 FAIL  src/socialSecurity/analysis/credits.evidence.test.ts > covered-work-credit-estimate — Covered-work credit estimate > case B: a year before 1978 counts at most one credit per $50, up to four (15)
AssertionError: expected { credits: 5, eligible: false, …(1) } to deeply equal { credits: 15, eligible: false, …(1) }

- Expected
+ Received

  {
-   "credits": 15,
+   "credits": 5,
    "eligible": false,
    "estimated": true,
  }

 ❯ src/socialSecurity/analysis/credits.evidence.test.ts:39:44
     37|
     38|     it('case B: a year before 1978 counts at most one credit per $50, …
     39|       expect(estimateCredits(caseB, null)).toEqual({ credits: credits(…
       |                                            ^
     40|       expect(creditsForYear(1975, 900)).toBe(4)
     41|       expect(creditsForYear(1975, 120)).toBe(2)

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

 FAIL  src/socialSecurity/analysis/credits.evidence.test.ts > covered-work-credit-estimate — Covered-work credit estimate > carries SSA's quarter-of-coverage amount for every year 1978 to 2026, 2026's $1,890 included
AssertionError: expected 4 to be 3 // Object.is equality

- Expected
+ Received

- 3
+ 4

 ❯ src/socialSecurity/analysis/credits.evidence.test.ts:64:43
     62|       // A later year uses the latest published amount.
     63|       expect(creditsForYear(2030, 7_560)).toBe(4)
     64|       expect(creditsForYear(2030, 7_559)).toBe(3)
       |                                           ^
     65|     })
     66|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯
```

## Revert

The original bytes of `packages/engine/src/socialSecurity/analysis/credits.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/socialSecurity/analysis/credits.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
