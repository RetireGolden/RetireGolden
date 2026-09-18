# Mutation receipt: ss-bridge-sizing

Executed 2026-09-17 against RetireGolden base `b99ac29b` (branch grok/b1-p4-cards-insights-ss-medicare-roth) in `packages/engine`.

## Mutation applied to `packages/engine/src/ladder/bridge.ts`

```diff
@@ -80,7 +80,7 @@ export function sizeBridge(input: BridgeSizingInput): BridgeSizing | null {
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

```
 FAIL  src/ladder/bridge.evidence.test.ts > ss-bridge-sizing — Social Security bridge: age-62 replacement sized as a TIPS ladder > pays the age-62 benefit of $1,400/month ($16,800/year) from 2027 through 2029
AssertionError: expected 2026 to be 2027 // Object.is equality
 ❯ src/ladder/bridge.evidence.test.ts:57:33

 FAIL  src/ladder/bridge.evidence.test.ts > ss-bridge-sizing — Social Security bridge: age-62 replacement sized as a TIPS ladder > prices the three zero-yield payments at $50,400
AssertionError: ladderCost 67200 is not within {"abs":1e-9} of the worksheet's 50400: expected false to be true // Object.is equality
 ❯ src/ladder/bridge.evidence.test.ts:78:9
```

## Revert

`git checkout -- packages/engine/src/ladder/bridge.ts`, then `git diff --quiet -- packages/engine/src/ladder/bridge.ts` exited 0, confirming no change to production code after the run.
