# Mutation receipt: aca-coverage-year-parameters

Executed 2026-09-27 against RetireGolden base `ef8a0e5f` (branch `claude/aca-2027-coverage-year`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `a5d07d32` (branch `claude/aca-2027-coverage-year`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `fe28be3c` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `15478aa9` (branch `claude/social-security-law-2`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `5f917180` (branch `claude/social-security-law-2`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `2d5fd40c` (branch `claude/social-security-law-2`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `c9e60e7c` (branch `claude/social-security-law-2`, pull request #755), and re-executed 2026-09-27 against RetireGolden base `32763d9d` (branch `claude/ssdi-month-and-roth-clock`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `4fde8e43` (branch `claude/ssdi-month-and-roth-clock`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `20b95c74` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `719afc7f` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `8de4a471` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `1176b2e5` (branch `claude/b2p1-slice5-sweeps`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `dc0c6c3f` (branch `claude/b2p1-slice5-sweeps`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `a8d4a81f` (branch `claude/2027-published-figures`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `6567821b` (branch `claude/people-order-and-scenarios`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `015a4b64` (branch `claude/2027-rollover`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/simulate.ts`

```diff
diff --git a/packages/engine/src/projection/simulate.ts b/packages/engine/src/projection/simulate.ts
index dc594a3f..bee84c8a 100644
--- a/packages/engine/src/projection/simulate.ts
+++ b/packages/engine/src/projection/simulate.ts
@@ -1363,10 +1363,10 @@ export function simulatePlan(plan: Plan, opts: SimulateOptions): ProjectionResul
     const {
       params: acaParameters,
       isStandIn: acaParametersStandIn,
-    } = acaParametersForCoverageYear(year)
+    } = acaParametersForCoverageYear(pack.year)
     const acaFplScale = acaParametersStandIn
       ? inflFactorFrom(acaParameters.coverageYear, year)
-      : 1
+      : inflFactorFrom(pack.year, year)
     const annualRetirementRuntimeOccurrences:
       SimulatorAnnualRetirementRuntimeOccurrence[] = []
     const recordAnnualRetirementRuntimeOccurrence = (
```

This prices each year on the block of its income-tax pack's year with the poverty line scaled by plan inflation from that year, which is how the ledger read the credit figures before they had their own coverage-year block: a 2027 year is priced on the 2026 table with the 2025 guidelines times 1.025, the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/params/acaCoverageYears.evidence.test.ts
```

## Captured failing output

The merge of main (c2d61967: #764, #765) into this branch moved the lines these receipts quote or the tests they capture; the mutations are unchanged. The baseline is green (acaCoverageYears.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine21/packages/engine

 ❯ src/params/acaCoverageYears.evidence.test.ts (4 tests | 1 failed) 31ms
   ❯ aca-coverage-year-parameters — ACA credit figures by coverage year (4)
     × publishes the same credit through the ledger, with the published line and the projected-income code 29ms

 Test Files  1 failed (1)
      Tests  1 failed | 3 passed (4)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/params/acaCoverageYears.evidence.test.ts > aca-coverage-year-parameters — ACA credit figures by coverage year > publishes the same credit through the ledger, with the published line and the projected-income code
AssertionError: expected 16041.249999999998 to be 15960 // Object.is equality

- Expected
+ Received

- 15960
+ 16041.249999999998

 ❯ src/params/acaCoverageYears.evidence.test.ts:103:38
    101|       expect(aca.supportCodes).toEqual(['actionable', 'income-tax-para…
    102|       expect(aca.householdMagi).toBe(inputs.householdMagi)
    103|       expect(aca.federalPovertyLine).toBe(expected.federalPovertyLine)
       |                                      ^
    104|       expectWithin(aca.fplPct!, expected.fplPct!, { abs: inputs.percen…
    105|       expectWithin(aca.modeledAllowablePtc!, expected.credit!, example…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/simulate.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/simulate.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
