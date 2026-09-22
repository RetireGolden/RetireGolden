# Mutation receipt: family-maximum-bend-points

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-nine` at base `39f8f460`, and re-executed 2026-09-22 against RetireGolden base `4fe87f00` (branch `claude/b1-p4-cards-nine-ten`, pull request #729) in `packages/engine`.

## Mutation applied to `packages/engine/src/socialSecurity/familyMaximum.ts`

```diff
@@ -37,7 +37,7 @@ export function familyMaximumMonthlyFromPia(piaMonthly: number, eligibilityYear:
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

Re-executed 2026-09-22 on the pull-request branch after the review of #729: the branch was renamed for the pull request and several fixtures changed, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (familyMaximum.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

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
