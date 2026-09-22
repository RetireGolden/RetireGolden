# Mutation receipt: inherited-account-final-deadline-year

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eleven` at base `60e47fd8`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730) in `packages/engine`.

## Mutation applied to `packages/engine/src/strategies/inheritedIra.ts`

```diff
@@ -913,7 +913,7 @@
       edb === 'minor-child' && b.beneficiaryBirthYear !== undefined
         ? {
             minorMajorityYear: b.beneficiaryBirthYear + 21,
-            finalDeadlineYear: b.beneficiaryBirthYear + 21 + 10,
+            finalDeadlineYear: deathYear + 10,
           }
         : {}
     return {
```

This gives the minor child a death-year-plus-ten deadline, publishing 2036 instead of 2041 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/strategies/inheritedIra.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #730: the branch was renamed for the pull request, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (inheritedIra.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/strategies/inheritedIra.evidence.test.ts (10 tests | 1 failed) 7ms
   ❯ inherited-account-final-deadline-year — Inherited-account final emptying year (4)
     × reaches majority first for the minor child, then adds ten years 3ms

 Test Files  1 failed (1)
      Tests  1 failed | 9 passed (10)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/strategies/inheritedIra.evidence.test.ts > inherited-account-final-deadline-year — Inherited-account final emptying year > reaches majority first for the minor child, then adds ten years
AssertionError: expected 2036 to be 2041 // Object.is equality

- Expected
+ Received

- 2041
+ 2036

 ❯ src/strategies/inheritedIra.evidence.test.ts:105:40
    103|       )
    104|       expect(result.minorMajorityYear).toBe(expected.minorMajorityYear)
    105|       expect(result.finalDeadlineYear).toBe(expected.minorChild)
       |                                        ^
    106|       // The worksheet's first two wrong readings.
    107|       expect(result.finalDeadlineYear).not.toBe(expected.minorAtDeathP…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/strategies/inheritedIra.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/strategies/inheritedIra.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
