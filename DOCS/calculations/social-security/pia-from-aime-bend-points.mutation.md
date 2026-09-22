# Mutation receipt: pia-from-aime-bend-points

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eight` at base `989fc81b`, and re-executed 2026-09-22 against RetireGolden base `a046c8f0` (branch `claude/b1-p4-cards-eight`, pull request #728) in `packages/engine`.

## Mutation applied to `packages/engine/src/socialSecurity/piaFromEarnings.ts`

```diff
@@ -106,7 +106,7 @@ export function piaMonthlyFromAime(aime: number, eligibilityYear: number): numbe
   let pia =
     0.9 * Math.min(aime, b1) +
     0.32 * Math.max(0, Math.min(aime, b2) - b1) +
-    0.15 * Math.max(0, aime - b2)
+    0.32 * Math.max(0, aime - b2)
   pia = floorToDime(pia)
   return pia
 }
```

This applies 32% rather than 15% to AIME above the second bend point, giving $3,625.88 before the dime floor — the worksheet's second wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/socialSecurity/piaFromEarnings.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #728: the branch was renamed for the pull request and two fixtures and one mutation changed, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (piaFromEarnings.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/socialSecurity/piaFromEarnings.evidence.test.ts (4 tests | 1 failed) 5ms
   ❯ pia-from-aime-bend-points — PIA from AIME across the bend points (4)
     × applies 90/32/15 across the 2026 bend points for a 3,413.20 PIA 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 3 passed (4)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/socialSecurity/piaFromEarnings.evidence.test.ts > pia-from-aime-bend-points — PIA from AIME across the bend points > applies 90/32/15 across the 2026 bend points for a 3,413.20 PIA
AssertionError: crossBoth 3625.8 is not within {"abs":0.05} of the worksheet's 3413.2: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/socialSecurity/piaFromEarnings.evidence.test.ts:16:5
     14|     withinTolerance(actual, expected, tolerance),
     15|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     16|   ).toBe(true)
       |     ^
     17| }
     18|
 ❯ src/socialSecurity/piaFromEarnings.evidence.test.ts:49:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/socialSecurity/piaFromEarnings.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/socialSecurity/piaFromEarnings.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
