# Mutation receipt: ss-bridge-sizing

Executed 2026-09-17 against RetireGolden base `b99ac29b` (branch grok/b1-p4-cards-insights-ss-medicare-roth), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/ladder/bridge.ts`

```diff
@@ -80,4 +80,4 @@ export function sizeBridge(input: BridgeSizingInput): BridgeSizing | null {
   const age62Year = dob.year + 62
   const claimYear = dob.year + Math.floor(claimYears)
-  const startYear = Math.max(input.retirementYear, age62Year, currentYear + 1)
+  const startYear = Math.max(input.retirementYear, currentYear)
   // A mid-year claim (months > 0) pays SS only from the claim month on, so the
```

This starts the bridge in the current year rather than next year / age 62, creating four payments (2026–2029) that cost $67,200 — the worksheet's first wrong reading.

## Command

```
npx vitest run src/ladder/bridge.evidence.test.ts
```

## Captured failing output

Re-executed for D-RECEIPT-DRIFT because its hunk header's line counts did not match the hunk; the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (bridge.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine9/packages/engine

 ❯ src/ladder/bridge.evidence.test.ts (2 tests | 2 failed) 5ms
   ❯ ss-bridge-sizing — Social Security bridge: age-62 replacement sized as a TIPS ladder (2)
     × pays the age-62 benefit of $1,400/month ($16,800/year) from 2027 through 2029 4ms
     × prices the three zero-yield payments at $50,400 0ms

 Test Files  1 failed (1)
      Tests  2 failed (2)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/ladder/bridge.evidence.test.ts > ss-bridge-sizing — Social Security bridge: age-62 replacement sized as a TIPS ladder > pays the age-62 benefit of $1,400/month ($16,800/year) from 2027 through 2029
AssertionError: expected 2026 to be 2027 // Object.is equality

- Expected
+ Received

- 2027
+ 2026

 ❯ src/ladder/bridge.evidence.test.ts:57:33
     55|     it('pays the age-62 benefit of $1,400/month ($16,800/year) from 20…
     56|       expect(bridge).not.toBeNull()
     57|       expect(bridge!.startYear).toBe(example.expected.startYear)
       |                                 ^
     58|       expect(bridge!.endYear).toBe(example.expected.endYear)
     59|       expect(bridge!.years).toBe(example.expected.years)

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/ladder/bridge.evidence.test.ts > ss-bridge-sizing — Social Security bridge: age-62 replacement sized as a TIPS ladder > prices the three zero-yield payments at $50,400
AssertionError: ladderCost 67200 is not within {"abs":1e-9} of the worksheet's 50400: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/ladder/bridge.evidence.test.ts:78:9
     76|         withinTolerance(bridge!.ladderCost, expected, example.toleranc…
     77|         `ladderCost ${bridge!.ladderCost} is not within ${JSON.stringi…
     78|       ).toBe(true)
       |         ^
     79|     })
     80|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/ladder/bridge.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/ladder/bridge.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
