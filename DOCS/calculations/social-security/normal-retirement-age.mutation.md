# Mutation receipt: normal-retirement-age

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eight` at base `989fc81b`, and re-executed 2026-09-22 against RetireGolden base `a046c8f0` (branch `claude/b1-p4-cards-eight`, pull request #728) in `packages/engine`.

## Mutation applied to `packages/engine/src/socialSecurity/nra.ts`

```diff
@@ -38,7 +38,7 @@ export function fraForBirthYear(birthYearEffective: number): FraComponents {
   if (y === 1957) return { years: 66, extraMonths: 6 }
   if (y === 1958) return { years: 66, extraMonths: 8 }
   if (y === 1959) return { years: 66, extraMonths: 10 }
-  return { years: 67, extraMonths: 0 }
+  return { years: 66, extraMonths: 8 }
 }
 
 /** Total “month slots” from birth to reach FRA / claim age (approximation: 12y + extra). */
```

This assigns the post-ramp cohort the survivor cap of 66 years 8 months, or 800 month slots — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/socialSecurity/nra.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #728: the branch was renamed for the pull request and two fixtures and one mutation changed, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (nra.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/socialSecurity/nra.evidence.test.ts (3 tests | 1 failed) 5ms
   ❯ normal-retirement-age — Normal retirement age endpoint (3)
     × assigns 67 years and 0 months, or 804 month slots, past the end of the ramp 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 2 passed (3)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/socialSecurity/nra.evidence.test.ts > normal-retirement-age — Normal retirement age endpoint > assigns 67 years and 0 months, or 804 month slots, past the end of the ramp
AssertionError: expected 66 to be 67 // Object.is equality

- Expected
+ Received

- 67
+ 66

 ❯ src/socialSecurity/nra.evidence.test.ts:35:25
     33|     it('assigns 67 years and 0 months, or 804 month slots, past the en…
     34|       const fra = fraForBirthYear(inputs.effectiveBirthYear!)
     35|       expect(fra.years).toBe(expected.years)
       |                         ^
     36|       expect(fra.extraMonths).toBe(expected.extraMonths)
     37|       expectWithin(fraTotalMonths(fra), expected.totalMonths!, example…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/socialSecurity/nra.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/socialSecurity/nra.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
