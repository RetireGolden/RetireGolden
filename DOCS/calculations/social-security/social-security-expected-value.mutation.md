# Mutation receipt: social-security-expected-value

Executed 2026-09-27 against RetireGolden base `20b95c74` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `df4b4cbf` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `f7a4d2f7` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `1176b2e5` (branch `claude/b2p1-slice5-sweeps`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `dc0c6c3f` (branch `claude/b2p1-slice5-sweeps`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `c7edd464` (branch `claude/life-table-2023`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `42d3fa38` (branch `claude/life-table-2023`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `8ccc9f8f` (branch `claude/ss-analysis-earnings-test`; no pull request is open yet), and re-executed 2026-09-30 against RetireGolden base `2e3e92a5` (branch `claude/ss-review-fixes`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/socialSecurity/householdYear.ts`

```diff
diff --git a/packages/engine/src/socialSecurity/householdYear.ts b/packages/engine/src/socialSecurity/householdYear.ts
index cc6dfa43..9de26ddb 100644
--- a/packages/engine/src/socialSecurity/householdYear.ts
+++ b/packages/engine/src/socialSecurity/householdYear.ts
@@ -482,7 +482,7 @@ export function socialSecurityYear(input: SocialSecurityYearInput): SocialSecuri
         survivorGate,
         deceasedPia,
         payableFrom: 12 - payableMonths,
-        entitlementMonths: deceased.deathYear !== null ? widowEntitlementAgeMonths(survivor.dob, deceased.deathYear, ownClaimMonths) : ownClaimMonths,
+        entitlementMonths: ownClaimMonths,
         sourceKey: auxiliaryBenefitSourceKey(survivor.id, 'person', deceased.id),
       })
     }
```

This reduces the widow(er) benefit at the survivor's own earlier claim age rather than at the first month of widow(er) entitlement, January after the death: the worksheet's third wrong reading and the ledger's reading before D-SS-LAW-2. Since D-SS-ANALYSIS-EARNINGS-TEST the value prices each path with the ledger's year function (socialSecurity/householdYear.ts#socialSecurityYear), so the mutation is applied where that function places the widow(er) benefit's first month. C-A's survivor branches fall (1,592.86 rather than 1,640.36 a month after a 2026 death), so its expected value misses the worksheet's, as do C-B's, C-F's and C-G's, whose survivor paths also start a widow(er) benefit after the survivor's own early claim.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/socialSecurity/analysis/expectedValue.evidence.test.ts
```

## Captured failing output

Re-executed after the different-family review of #769, whose C-D checks added lines to its test file; the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (expectedValue.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/socialSecurity/analysis/expectedValue.evidence.test.ts (11 tests | 4 failed) 283ms
   ❯ social-security-expected-value — Benefits-only expected present value of Social Security (11)
     × C-A, the R7 case: 690 a month while both live (25,080 in 2026) and the widow benefit reduced in January after the death 8ms
     × C-B: a spouse benefit that starts with the worker's claim at 70 is unreduced (960 a month, not 780) 5ms
     × C-F: example-couple, the earnings test on both people's wages and the widow's limit on the deceased's credited benefit 94ms
     × C-G: a couple member is paid on a deceased former spouse's record (3,000 a month from her claim at 67) 77ms

 Test Files  1 failed (1)
      Tests  4 failed | 7 passed (11)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/socialSecurity/analysis/expectedValue.evidence.test.ts > social-security-expected-value — Benefits-only expected present value of Social Security > C-A, the R7 case: 690 a month while both live (25,080 in 2026) and the widow benefit reduced in January after the death
AssertionError: C-A: 481696.6032944904 against the worksheet's 484818.6638262612: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectPv src/socialSecurity/analysis/expectedValue.evidence.test.ts:60:120
     58| function expectPv(actual: number, label: string): void {
     59|   const expected = expectedOf(label)
     60|   expect(withinTolerance(actual, expected, { rel: 1e-12 }), `${label}:…
       |                                                                                                                        ^
     61| }
     62|
 ❯ src/socialSecurity/analysis/expectedValue.evidence.test.ts:113:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/4]⎯

 FAIL  src/socialSecurity/analysis/expectedValue.evidence.test.ts > social-security-expected-value — Benefits-only expected present value of Social Security > C-B: a spouse benefit that starts with the worker's claim at 70 is unreduced (960 a month, not 780)
AssertionError: C-B: 588916.6327631975 against the worksheet's 617229.7407658283: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectPv src/socialSecurity/analysis/expectedValue.evidence.test.ts:60:120
     58| function expectPv(actual: number, label: string): void {
     59|   const expected = expectedOf(label)
     60|   expect(withinTolerance(actual, expected, { rel: 1e-12 }), `${label}:…
       |                                                                                                                        ^
     61| }
     62|
 ❯ src/socialSecurity/analysis/expectedValue.evidence.test.ts:127:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/4]⎯

 FAIL  src/socialSecurity/analysis/expectedValue.evidence.test.ts > social-security-expected-value — Benefits-only expected present value of Social Security > C-F: example-couple, the earnings test on both people's wages and the widow's limit on the deceased's credited benefit
AssertionError: C-F 70/63: 830663.6974501398 against the worksheet's 860375.9742084525: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectPv src/socialSecurity/analysis/expectedValue.evidence.test.ts:60:120
     58| function expectPv(actual: number, label: string): void {
     59|   const expected = expectedOf(label)
     60|   expect(withinTolerance(actual, expected, { rel: 1e-12 }), `${label}:…
       |                                                                                                                        ^
     61| }
     62|
 ❯ src/socialSecurity/analysis/expectedValue.evidence.test.ts:176:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/4]⎯

 FAIL  src/socialSecurity/analysis/expectedValue.evidence.test.ts > social-security-expected-value — Benefits-only expected present value of Social Security > C-G: a couple member is paid on a deceased former spouse's record (3,000 a month from her claim at 67)
AssertionError: C-G 70/62: 862498.8510875585 against the worksheet's 878231.4248894261: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectPv src/socialSecurity/analysis/expectedValue.evidence.test.ts:60:120
     58| function expectPv(actual: number, label: string): void {
     59|   const expected = expectedOf(label)
     60|   expect(withinTolerance(actual, expected, { rel: 1e-12 }), `${label}:…
       |                                                                                                                        ^
     61| }
     62|
 ❯ src/socialSecurity/analysis/expectedValue.evidence.test.ts:216:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/4]⎯
```

## Revert

The original bytes of `packages/engine/src/socialSecurity/householdYear.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/socialSecurity/householdYear.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
