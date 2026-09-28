# Mutation receipt: social-security-expected-value

Executed 2026-09-27 against RetireGolden base `20b95c74` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `df4b4cbf` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `f7a4d2f7` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `1176b2e5` (branch `claude/b2p1-slice5-sweeps`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `dc0c6c3f` (branch `claude/b2p1-slice5-sweeps`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `c7edd464` (branch `claude/life-table-2023`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `42d3fa38` (branch `claude/life-table-2023`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/socialSecurity/analysis/expectedValue.ts`

```diff
diff --git a/packages/engine/src/socialSecurity/analysis/expectedValue.ts b/packages/engine/src/socialSecurity/analysis/expectedValue.ts
index 8a75a53a..22c64c2f 100644
--- a/packages/engine/src/socialSecurity/analysis/expectedValue.ts
+++ b/packages/engine/src/socialSecurity/analysis/expectedValue.ts
@@ -215,7 +215,7 @@ function widowMonthly(survivor: CouplePerson, deceased: CouplePerson, deathYear:
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

Re-executed after merging main (#758, B2-P1 slice 5) into D-LIFE-TABLE-2023: slice 5 re-pointed this receipt's hunk (the open-claims filter moved expectedValue.ts), and this branch's captured output carries the 2023 table's values. The baseline is green (expectedValue.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine15/packages/engine

 ❯ src/socialSecurity/analysis/expectedValue.evidence.test.ts (9 tests | 2 failed) 27ms
   ❯ social-security-expected-value — Benefits-only expected present value of Social Security (9)
     × C-A, the R7 case: 690 a month while both live (25,080 in 2026) and the widow benefit reduced in January after the death 4ms
     × C-B: a spouse benefit that starts with the worker's claim at 70 is unreduced (960 a month, not 780) 1ms

 Test Files  1 failed (1)
      Tests  2 failed | 7 passed (9)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/socialSecurity/analysis/expectedValue.evidence.test.ts > social-security-expected-value — Benefits-only expected present value of Social Security > C-A, the R7 case: 690 a month while both live (25,080 in 2026) and the widow benefit reduced in January after the death
AssertionError: C-A: 481696.60329449043 against the worksheet's 484818.6638262612: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectPv src/socialSecurity/analysis/expectedValue.evidence.test.ts:58:120
     56| function expectPv(actual: number, label: string): void {
     57|   const expected = expectedOf(label)
     58|   expect(withinTolerance(actual, expected, { rel: 1e-12 }), `${label}:…
       |                                                                                                                        ^
     59| }
     60|
 ❯ src/socialSecurity/analysis/expectedValue.evidence.test.ts:111:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/socialSecurity/analysis/expectedValue.evidence.test.ts > social-security-expected-value — Benefits-only expected present value of Social Security > C-B: a spouse benefit that starts with the worker's claim at 70 is unreduced (960 a month, not 780)
AssertionError: C-B: 588916.6327631974 against the worksheet's 617229.7407658283: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectPv src/socialSecurity/analysis/expectedValue.evidence.test.ts:58:120
     56| function expectPv(actual: number, label: string): void {
     57|   const expected = expectedOf(label)
     58|   expect(withinTolerance(actual, expected, { rel: 1e-12 }), `${label}:…
       |                                                                                                                        ^
     59| }
     60|
 ❯ src/socialSecurity/analysis/expectedValue.evidence.test.ts:125:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/socialSecurity/analysis/expectedValue.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/socialSecurity/analysis/expectedValue.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
