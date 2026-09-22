# Mutation receipt: sepp-active-annual-rule

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eight` at base `989fc81b`, and re-executed 2026-09-22 against RetireGolden base `a046c8f0` (branch `claude/b1-p4-cards-eight`, pull request #728) in `packages/engine`.

## Mutation applied to `packages/engine/src/strategies/sepp.ts`

```diff
@@ -61,7 +61,7 @@ export const SEPP_AMORTIZATION_RATE_PCT = 5
  */
 export function seppActive(startAge: number, age: number): boolean {
   if (age < startAge) return false
-  return age < 60 || age - startAge < 5
+  return age - startAge < 5
 }
 
 /**
```

This drops the age boundary and keeps only the five-year duration, so a series begun at age 50 ends at 55 rather than running to the penalty boundary — the worksheet's second wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/strategies/sepp.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #728: the branch was renamed for the pull request and two fixtures and one mutation changed, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (sepp.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/strategies/sepp.evidence.test.ts (10 tests | 1 failed) 7ms
   ❯ sepp-active-annual-rule — SEPP active in an attained-age year (4)
     × keeps a series begun at 50 running past five years to the age boundary 3ms

 Test Files  1 failed (1)
      Tests  1 failed | 9 passed (10)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/strategies/sepp.evidence.test.ts > sepp-active-annual-rule — SEPP active in an attained-age year > keeps a series begun at 50 running past five years to the age boundary
AssertionError: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/strategies/sepp.evidence.test.ts:91:34
     89|       // The second wrong reading: duration alone would end a series b…
     90|       // 50 at age 55, well before the penalty boundary.
     91|       expect(seppActive(50, 55)).toBe(true)
       |                                  ^
     92|       expect(seppActive(50, 60)).toBe(false)
     93|     })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/strategies/sepp.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/strategies/sepp.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
