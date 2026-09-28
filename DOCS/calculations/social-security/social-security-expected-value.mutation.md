# Mutation receipt: social-security-expected-value

Executed 2026-09-27 against RetireGolden base `20b95c74` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `df4b4cbf` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `f7a4d2f7` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/socialSecurity/analysis/expectedValue.ts`

```diff
diff --git a/packages/engine/src/socialSecurity/analysis/expectedValue.ts b/packages/engine/src/socialSecurity/analysis/expectedValue.ts
index 870d3959..298111aa 100644
--- a/packages/engine/src/socialSecurity/analysis/expectedValue.ts
+++ b/packages/engine/src/socialSecurity/analysis/expectedValue.ts
@@ -214,7 +214,7 @@ function widowMonthly(survivor: CouplePerson, deceased: CouplePerson, deathYear:
     ? deceased.own
     : deceased.claimant.piaMonthly * neverClaimedDeceasedFactor(deceased.claimant.dob, deathYear, 12)
   if (actual <= 0) return 0
-  const entitlementMonths = widowEntitlementAgeMonths(survivor.claimant.dob, deathYear, survivor.claimMonths)
+  const entitlementMonths = survivor.claimMonths
   return survivorBenefitMonthly({
     deceasedPiaMonthly: deceased.claimant.piaMonthly,
     deceasedActualMonthly: actual,
```

This reduces the widow(er) benefit at the survivor's own earlier claim age rather than at the first month of widow(er) entitlement, January after the death: the worksheet's third wrong reading and the ledger's reading before D-SS-LAW-2. C-A's survivor branches fall (1,592.86 rather than 1,640.36 a month after a 2026 death), so its expected value misses the worksheet's.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/socialSecurity/analysis/expectedValue.evidence.test.ts
```

## Captured failing output

Its production file's lines moved when the claimant helpers left expectedValue.ts, so it is re-executed on the current code. The baseline is green (expectedValue.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine13/packages/engine

 ❯ src/socialSecurity/analysis/expectedValue.evidence.test.ts (9 tests | 2 failed) 41ms
   ❯ social-security-expected-value — Benefits-only expected present value of Social Security (9)
     × C-A, the R7 case: 690 a month while both live (25,080 in 2026) and the widow benefit reduced in January after the death 5ms
     × C-B: a spouse benefit that starts with the worker's claim at 70 is unreduced (960 a month, not 780) 1ms

 Test Files  1 failed (1)
      Tests  2 failed | 7 passed (9)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/socialSecurity/analysis/expectedValue.evidence.test.ts > social-security-expected-value — Benefits-only expected present value of Social Security > C-A, the R7 case: 690 a month while both live (25,080 in 2026) and the widow benefit reduced in January after the death
AssertionError: C-A: 471715.1796368872 against the worksheet's 474876.9339831568: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectPv src/socialSecurity/analysis/expectedValue.evidence.test.ts:56:120
     54| function expectPv(actual: number, label: string): void {
     55|   const expected = expectedOf(label)
     56|   expect(withinTolerance(actual, expected, { rel: 1e-12 }), `${label}:…
       |                                                                                                                        ^
     57| }
     58|
 ❯ src/socialSecurity/analysis/expectedValue.evidence.test.ts:107:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/socialSecurity/analysis/expectedValue.evidence.test.ts > social-security-expected-value — Benefits-only expected present value of Social Security > C-B: a spouse benefit that starts with the worker's claim at 70 is unreduced (960 a month, not 780)
AssertionError: C-B: 570514.2541401216 against the worksheet's 598954.9039081854: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectPv src/socialSecurity/analysis/expectedValue.evidence.test.ts:56:120
     54| function expectPv(actual: number, label: string): void {
     55|   const expected = expectedOf(label)
     56|   expect(withinTolerance(actual, expected, { rel: 1e-12 }), `${label}:…
       |                                                                                                                        ^
     57| }
     58|
 ❯ src/socialSecurity/analysis/expectedValue.evidence.test.ts:121:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/socialSecurity/analysis/expectedValue.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/socialSecurity/analysis/expectedValue.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
