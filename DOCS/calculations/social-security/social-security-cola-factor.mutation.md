# Mutation receipt: social-security-cola-factor

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eight` at base `989fc81b`, and re-executed 2026-09-22 against RetireGolden base `a046c8f0` (branch `claude/b1-p4-cards-eight`, pull request #728), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `fe28be3c` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `15478aa9` (branch `claude/social-security-law-2`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `5f917180` (branch `claude/social-security-law-2`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `2d5fd40c` (branch `claude/social-security-law-2`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `c9e60e7c` (branch `claude/social-security-law-2`, pull request #755), and re-executed 2026-09-27 against RetireGolden base `32763d9d` (branch `claude/ssdi-month-and-roth-clock`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `4fde8e43` (branch `claude/ssdi-month-and-roth-clock`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/simulate.ts`

```diff
@@ -1704,7 +1704,7 @@ export function simulatePlan(plan: Plan, opts: SimulateOptions): ProjectionResul
     const ssColaFactor =
       plan.assumptions.ssCola.mode === 'matchInflation'
         ? inflFactorFrom(startYear, year)
-        : Math.pow(1 + plan.assumptions.ssCola.annualPct / 100, year - startYear)
+        : Math.pow(1 + plan.assumptions.ssCola.annualPct / 100, year - startYear + 1)
     const ssHaircutFactor =
       plan.assumptions.ssHaircut && year >= plan.assumptions.ssHaircut.fromYear
         ? 1 - plan.assumptions.ssHaircut.cutPct / 100
```

This applies the COLA once in the first projection year, so the start-year benefit is already escalated to $2,056 a month — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualSocialSecurity.evidence.test.ts
```

## Captured failing output

Re-executed after the merge of origin/main (#755 squashed, and #754) into the D-APPROX-FACTS branch, because both sides added lines above its hunk; the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (annualSocialSecurity.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine14/packages/engine

 ❯ src/projection/internal/annualSocialSecurity.evidence.test.ts (4 tests | 2 failed) 34ms
   ❯ social-security-cola-factor — Social Security COLA factor (2)
     × compounds 2.8% from the projection start, leaving the first year unescalated 29ms
     × does not escalate the first projection year 3ms

 Test Files  1 failed (1)
      Tests  2 failed | 2 passed (4)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/annualSocialSecurity.evidence.test.ts > social-security-cola-factor — Social Security COLA factor > compounds 2.8% from the projection start, leaving the first year unescalated
AssertionError: monthly amount in 2026 2056 is not within {"abs":0.005} of the worksheet's 2000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/internal/annualSocialSecurity.evidence.test.ts:23:5
     21|     withinTolerance(actual, expected, tolerance),
     22|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     23|   ).toBe(true)
       |     ^
     24| }
     25|
 ❯ src/projection/internal/annualSocialSecurity.evidence.test.ts:153:9
 ❯ src/projection/internal/annualSocialSecurity.evidence.test.ts:146:13

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/projection/internal/annualSocialSecurity.evidence.test.ts > social-security-cola-factor — Social Security COLA factor > does not escalate the first projection year
AssertionError: start-year benefit 24672 is not within {"abs":0.005} of the worksheet's 24000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/internal/annualSocialSecurity.evidence.test.ts:23:5
     21|     withinTolerance(actual, expected, tolerance),
     22|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     23|   ).toBe(true)
       |     ^
     24| }
     25|
 ❯ src/projection/internal/annualSocialSecurity.evidence.test.ts:167:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/simulate.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/simulate.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
