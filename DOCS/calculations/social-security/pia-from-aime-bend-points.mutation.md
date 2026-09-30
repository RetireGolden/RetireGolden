# Mutation receipt: pia-from-aime-bend-points

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eight` at base `989fc81b`, and re-executed 2026-09-22 against RetireGolden base `a046c8f0` (branch `claude/b1-p4-cards-eight`, pull request #728), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `81d4bf03` (branch `claude/social-security-law-2`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `2d5fd40c` (branch `claude/social-security-law-2`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `20b95c74` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/socialSecurity/piaFromEarnings.ts`

```diff
@@ -122,7 +122,7 @@ export function piaMonthlyFromAime(aime: number, eligibilityYear: number): numbe
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

Re-executed for B2-P1 slice 4 because lines moved above its hunk (the survival curve, the PIA resolver and the zero-year gain, or simulatePlan's COLA helpers) or its test file gained cases; the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (piaFromEarnings.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

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
