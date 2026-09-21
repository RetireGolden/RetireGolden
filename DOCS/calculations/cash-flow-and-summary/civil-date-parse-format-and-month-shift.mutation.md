# Mutation receipt: civil-date-parse-format-and-month-shift

Executed 2026-09-17 against RetireGolden base `33e7d546` (branch `codex/b1-p4-cards-cashflow-optimizer-taxes`) in `packages/engine`.

## Mutation applied to `packages/engine/src/actions/civilDate.ts`

```diff
diff --git a/packages/engine/src/actions/civilDate.ts b/packages/engine/src/actions/civilDate.ts
index 47f3a2eb..1507b32b 100644
--- a/packages/engine/src/actions/civilDate.ts
+++ b/packages/engine/src/actions/civilDate.ts
@@ -11,7 +11,7 @@ function isLeapYear(year: number): boolean {
 }
 
 function daysInMonth(year: number, month: number): number {
-  if (month === 2) return isLeapYear(year) ? 29 : 28
+  if (month === 2) return 28
   return [4, 6, 9, 11].includes(month) ? 30 : 31
 }
```

Treat leap February as ordinary February, rejecting the worksheet leap day.

## Command

```
npx.cmd vitest run src/actions/civilDate.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/Users/Nathan/source/repos/RetireGolden/.worktrees/slice4-20260917/packages/engine

 ❯ src/actions/civilDate.evidence.test.ts (1 test | 1 failed) 4ms
   ❯ civil-date-parse-format-and-month-shift — Civil date parse format and month shift (1)
     × parses January 31 and clamps one calendar month to leap-day February 29 4ms

 Test Files  1 failed (1)
      Tests  1 failed (1)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/actions/civilDate.evidence.test.ts > civil-date-parse-format-and-month-shift — Civil date parse format and month shift > parses January 31 and clamps one calendar month to leap-day February 29
AssertionError: expected '2024-02-28' to be '2024-02-29' // Object.is equality

Expected: "2024-02-29"
Received: "2024-02-28"

 ❯ src/actions/civilDate.evidence.test.ts:21:95
     19|     expect(parsed.day).toBe(expected.day)
     20|     expect(formatCivilDate(parsed)).toBe(example.inputs.date)
     21|     expect(addCalendarMonths(example.inputs.date as string, example.in…
       |                                                                                               ^
     22|   })
     23| })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

Restored the exact original production bytes in a `finally` block, then `git diff --quiet -- packages/engine/src/actions/civilDate.ts` exited 0, confirming no production change remained. Re-ran the named command after restoration. The restored named file passed (exit 0).
