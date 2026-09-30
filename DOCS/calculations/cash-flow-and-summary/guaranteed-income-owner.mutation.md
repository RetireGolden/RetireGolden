# Mutation receipt: guaranteed-income-owner

Executed 2026-09-28 on branch `claude/people-order-and-scenarios` at base `da378d9b` (no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `7f6fdfc5` (branch `claude/scrub-local-paths`; no pull request is open yet), and re-executed 2026-09-30 against RetireGolden base `afdfdb53` (branch `claude/scrub-local-paths`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualPensionAndAnnuityIncome.ts`

```diff
diff --git a/packages/engine/src/projection/internal/annualPensionAndAnnuityIncome.ts b/packages/engine/src/projection/internal/annualPensionAndAnnuityIncome.ts
index 76d159b9..823a2ca0 100644
--- a/packages/engine/src/projection/internal/annualPensionAndAnnuityIncome.ts
+++ b/packages/engine/src/projection/internal/annualPensionAndAnnuityIncome.ts
@@ -241,3 +241,3 @@
     // person's death; the other household member is the second annuitant.
-    const ownerId = guaranteedIncomeOwnerId(account)
+    const ownerId = input.people[0]!.id
     const owner = input.personById.get(ownerId)!
```

Pay every pension and annuity on the first-listed person's age and life, the rule the engine applied to a "Joint" contract before schema v7. Sam's pension then starts in 2027 on Alex's 65th year and pays 24,000 in 2028, and the life-only annuity keeps paying after Sam's death, so the evidence fails on the 2028 pension and the 2035 annuity.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/peopleNamed.evidence.test.ts
```

## Captured failing output

The merge of claude/ss-review-fixes into the catalog-evidence branch moved the lines these receipts quote; the mutations are unchanged. The baseline is green (peopleNamed.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/projection/peopleNamed.evidence.test.ts (10 tests | 2 failed) 166ms
   ❯ guaranteed-income-owner — Whose age and life a pension or annuity is paid on (3)
     × starts and ends Sam’s pension and annuity on Sam’s age and life 12ms
     × gives the same income with the people listed the other way round 18ms

 Test Files  1 failed (1)
      Tests  2 failed | 8 passed (10)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/peopleNamed.evidence.test.ts > guaranteed-income-owner — Whose age and life a pension or annuity is paid on > starts and ends Sam’s pension and annuity on Sam’s age and life
AssertionError: Pension income, 2028: actual 24000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ check src/projection/peopleNamed.evidence.test.ts:162:100
    160|       const years = run(plan)
    161|       const check = (label: string, value: number) =>
    162|         expect(withinTolerance(value, owner.value(label), tolerance), …
       |                                                                                                    ^
    163|       check('Pension income, 2028', yearOf(years, 2028).incomes.pensio…
    164|       check('Pension income, 2029', yearOf(years, 2029).incomes.pensio…
 ❯ src/projection/peopleNamed.evidence.test.ts:163:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/projection/peopleNamed.evidence.test.ts > guaranteed-income-owner — Whose age and life a pension or annuity is paid on > gives the same income with the people listed the other way round
AssertionError: expected [ [ +0, +0 ], [ +0, +0 ], …(27) ] to deeply equal [ [ +0, +0 ], [ 24000, +0 ], …(27) ]

- Expected
+ Received

@@ -2,20 +2,20 @@
    [
      0,
      0,
    ],
    [
-     24000,
      0,
+     0,
    ],
    [
-     24000,
-     12000,
+     0,
+     0,
    ],
    [
      24000,
-     12000,
+     0,
    ],
    [
      24000,
      12000,
    ],
@@ -34,85 +34,85 @@
    [
      24000,
      12000,
    ],
    [
-     24000,
      12000,
+     0,
    ],
    [
-     24000,
      12000,
+     0,
    ],
    [
-     24000,
      12000,
+     0,
    ],
    [
-     24000,
      12000,
+     0,
    ],
    [
-     24000,
      12000,
+     0,
    ],
    [
-     24000,
      12000,
+     0,
    ],
    [
-     24000,
      12000,
+     0,
    ],
    [
-     24000,
      12000,
+     0,
    ],
    [
-     24000,
      12000,
+     0,
    ],
    [
-     24000,
      12000,
+     0,
    ],
    [
-     24000,
      12000,
+     0,
    ],
    [
-     24000,
      12000,
+     0,
    ],
    [
-     24000,
      12000,
+     0,
    ],
    [
-     24000,
      12000,
+     0,
    ],
    [
-     24000,
      12000,
+     0,
    ],
    [
-     24000,
      12000,
+     0,
    ],
    [
-     24000,
      12000,
+     0,
    ],
    [
-     24000,
      12000,
+     0,
    ],
    [
-     24000,
      12000,
+     0,
    ],
    [
-     24000,
      12000,
+     0,
    ],
  ]

 ❯ src/projection/peopleNamed.evidence.test.ts:174:41
    172|     it('gives the same income with the people listed the other way rou…
    173|       const incomesOf = (p: Plan) => run(p).map((y) => [y.incomes.pens…
    174|       expect(incomesOf(reversed(plan))).toEqual(incomesOf(plan))
       |                                         ^
    175|     })
    176|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/internal/annualPensionAndAnnuityIncome.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/internal/annualPensionAndAnnuityIncome.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
