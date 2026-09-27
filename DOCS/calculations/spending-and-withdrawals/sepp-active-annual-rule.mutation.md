# Mutation receipt: sepp-active-annual-rule

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eight` at base `989fc81b`, and re-executed 2026-09-22 against RetireGolden base `a046c8f0` (branch `claude/b1-p4-cards-eight`, pull request #728), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/strategies/sepp.ts`

```diff
@@ -63,7 +63,7 @@ export const SEPP_AMORTIZATION_RATE_PCT = 5
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

Re-executed for D-RECEIPT-DRIFT because its hunk header named a line its production code has since moved from; the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (sepp.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine9/packages/engine

 ❯ src/strategies/sepp.evidence.test.ts (10 tests | 1 failed) 7ms
   ❯ sepp-active-annual-rule — SEPP active in an attained-age year (4)
     × keeps a series begun at 50 running past five years to the age boundary 4ms

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
