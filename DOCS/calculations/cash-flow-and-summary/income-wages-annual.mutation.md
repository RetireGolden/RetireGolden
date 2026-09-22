# Mutation receipt: income-wages-annual

Executed 2026-09-18 against RetireGolden base `39f8f460` (branch claude/b1-p4-cards-slice-nine) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/wageIncomeStreams.ts`

```diff
@@ -265,7 +265,7 @@ export function wageIncomeStreams(input: WageIncomeYearInput): readonly WageInco
     const stopAge = stream.endAge ?? person.retirementAge
     if (!s.alive || (stopAge !== null && s.ageAttained >= stopAge)) continue
     const raiseFactor = Math.pow(1 + (stream.realGrowthPct ?? 0) / 100, year - startYear)
-    const amount = stream.annualGross * raiseFactor * inflFactor
+    const amount = stream.annualGross * inflFactor
     rows.push({
       personId: stream.personId,
       amount,
```

This drops the real-raise factor, publishing $86,400 — the worksheet's first wrong reading, inflation without the raise.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/wageIncomeStreams.evidence.test.ts
```

## Captured failing output

```
 FAIL  src/projection/internal/wageIncomeStreams.evidence.test.ts > income-wages-annual — Annual wage income for one stream > pays 89890.56 at age 64, two real raises and the 1.08 inflation factor
AssertionError: wages: actual 86400, worksheet 89890.56: expected false to be true // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/projection/internal/wageIncomeStreams.ts`, then `git diff --quiet -- packages/engine/src/projection/internal/wageIncomeStreams.ts` exited 0, confirming no change to production code after the run.
