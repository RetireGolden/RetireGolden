# Mutation receipt: social-security-pia-resolution

Executed 2026-09-27 against RetireGolden base `20b95c74` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/socialSecurity/piaFromEarnings.ts`

```diff
diff --git a/packages/engine/src/socialSecurity/piaFromEarnings.ts b/packages/engine/src/socialSecurity/piaFromEarnings.ts
index d90a5df9..ee570aea 100644
--- a/packages/engine/src/socialSecurity/piaFromEarnings.ts
+++ b/packages/engine/src/socialSecurity/piaFromEarnings.ts
@@ -454,7 +454,7 @@ export function resolveStreamPiaMonthly(
   const result = computePiaFromEarnings(input)
   if (isPiaFromEarningsError(result)) return { status: 'earningsError', error: result }
   if (asOf === null) return { status: 'fromEarnings', piaMonthly: result.piaMonthly, detail: result, standInColaYears: [] }
-  const atStart = piaWithCostOfLivingIncreases(result.piaMonthly, result.eligibilityYear, asOf.startYear - 1, asOf.colaAssumptionPct)
+  const atStart = piaWithCostOfLivingIncreases(result.piaMonthly, result.eligibilityYear, result.eligibilityYear - 1, asOf.colaAssumptionPct)
   return { status: 'fromEarnings', piaMonthly: atStart.piaMonthly, detail: result, standInColaYears: atStart.standInYears }
 }
 
```

This resolves the eligibility-year PIA without the cost-of-living increases since, the worksheet's first wrong reading: case H resolves to 2,846.40 rather than 3,364.40, and the projection pays 12 x 2,846.40 in 2027.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/socialSecurity/piaFromEarnings.resolution.evidence.test.ts
```

## Captured failing output

The baseline is green (piaFromEarnings.resolution.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/socialSecurity/piaFromEarnings.resolution.evidence.test.ts (3 tests | 2 failed) 45ms
   ❯ social-security-pia-resolution — The PIA a Social Security stream is paid from (3)
     × an entered PIA as entered; an earnings history's PIA raised by the increases since eligibility (2,846.40 to 3,364.40) 5ms
     × the projection pays from the resolved PIA: 12 x 3,364.40 in 2027 for a claim at 67, with no COLA after the start 40ms

 Test Files  1 failed (1)
      Tests  2 failed | 1 passed (3)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/socialSecurity/piaFromEarnings.resolution.evidence.test.ts > social-security-pia-resolution — The PIA a Social Security stream is paid from > an entered PIA as entered; an earnings history's PIA raised by the increases since eligibility (2,846.40 to 3,364.40)
AssertionError: expected 2846.4 to be 3364.4 // Object.is equality

- Expected
+ Received

- 3364.4
+ 2846.4

 ❯ src/socialSecurity/piaFromEarnings.resolution.evidence.test.ts:36:35
     34|       expect(resolved.status).toBe('fromEarnings')
     35|       if (resolved.status !== 'fromEarnings') return
     36|       expect(resolved.piaMonthly).toBe(pia('H'))
       |                                   ^
     37|       expect(resolved.detail.piaMonthly).toBe(pia('H eligibility-year …
     38|       expect(resolved.standInColaYears).toEqual([])

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/socialSecurity/piaFromEarnings.resolution.evidence.test.ts > social-security-pia-resolution — The PIA a Social Security stream is paid from > the projection pays from the resolved PIA: 12 x 3,364.40 in 2027 for a claim at 67, with no COLA after the start
AssertionError: expected 34156.8 to be close to 40372.8, received difference is 6216, but expected 5e-10
 ❯ src/socialSecurity/piaFromEarnings.resolution.evidence.test.ts:58:42
     56|       plan.accounts = [cash(5_000_000)]
     57|       const row = simulatePlan(validate(plan), { startYear: 2026, taxC…
     58|       expect(row.incomes.socialSecurity).toBeCloseTo(12 * pia('H'), 9)
       |                                          ^
     59|     })
     60|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/socialSecurity/piaFromEarnings.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/socialSecurity/piaFromEarnings.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
