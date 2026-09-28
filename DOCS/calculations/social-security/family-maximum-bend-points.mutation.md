# Mutation receipt: family-maximum-bend-points

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-nine` at base `39f8f460`, and re-executed 2026-09-22 against RetireGolden base `4fe87f00` (branch `claude/b1-p4-cards-nine-ten`, pull request #729), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `89c0fe4a` (branch `claude/ssdi-month-and-roth-clock`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `96da3ad0` (branch `claude/ssdi-month-and-roth-clock`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/socialSecurity/familyMaximum.ts`

```diff
@@ -41,5 +41,5 @@ export function familyMaximumMonthlyFromPia(piaMonthly: number, eligibilityYear:
   const second = Math.max(0, Math.min(piaMonthly, bp.second) - bp.first)
   const third = Math.max(0, Math.min(piaMonthly, bp.third) - bp.second)
   const above = Math.max(0, piaMonthly - bp.third)
-  return floorToDime(first * 1.5 + second * 2.72 + third * 1.34 + above * 1.75)
+  return floorToDime(first * 1.5 + second * 2.72 + third * 1.34)
 }
```

This drops the 175% band above the third bend point, publishing $5,412.10 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/socialSecurity/familyMaximum.evidence.test.ts
```

## Captured failing output

Re-executed for the independent check of the family maximum fix (the spouse benefit held to the maximum before the age reduction), because lines moved above its hunk; the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (familyMaximum.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine14/packages/engine

 ❯ src/socialSecurity/familyMaximum.evidence.test.ts (3 tests | 1 failed) 5ms
   ❯ family-maximum-bend-points — Retirement/survivor family maximum from PIA (3)
     × crosses all three bend points to a dime-floored 6999.30 3ms

 Test Files  1 failed (1)
      Tests  1 failed | 2 passed (3)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/socialSecurity/familyMaximum.evidence.test.ts > family-maximum-bend-points — Retirement/survivor family maximum from PIA > crosses all three bend points to a dime-floored 6999.30
AssertionError: family maximum 5412.1 is not within {"abs":0} of the worksheet's 6999.3: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectExactly src/socialSecurity/familyMaximum.evidence.test.ts:38:9
     36|         withinTolerance(actual, target, example.tolerance),
     37|         `${label} ${actual} is not within ${JSON.stringify(example.tol…
     38|       ).toBe(true)
       |         ^
     39|     }
     40|
 ❯ src/socialSecurity/familyMaximum.evidence.test.ts:54:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/socialSecurity/familyMaximum.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/socialSecurity/familyMaximum.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
