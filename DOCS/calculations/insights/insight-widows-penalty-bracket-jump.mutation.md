# Mutation receipt: insight-widows-penalty-bracket-jump

Executed 2026-09-17 against RetireGolden base `b99ac29b` (branch grok/b1-p4-cards-insights-ss-medicare-roth) in `packages/engine`.

## Mutation applied to `packages/engine/src/insights/detectors/widowsPenalty.ts`

```diff
@@ -118,7 +118,7 @@ export const widowsPenalty: Detector = {
             inflationScale,
           }).totalTax,
       )
-      bracketJumpToday = Math.round(ctx.projection.deflate(jumpYear, bracketJump))
+      bracketJumpToday = Math.round(bracketJump)
     }
```

This omits deflation, so the published jump is the nominal $10,000 — the worksheet's first wrong reading.

## Command

```
npx vitest run src/insights/detectors/widowsPenalty.evidence.test.ts
```

## Captured failing output

```
 FAIL  src/insights/detectors/widowsPenalty.evidence.test.ts > insight-widows-penalty-bracket-jump — Rough real survivor bracket jump, single versus joint on the same MAGI > deflates the $10,000 nominal jump by 4/5 to $8,000 today
AssertionError: bracketJumpToday 10000 is not within {"abs":1e-9} of the worksheet's 8000: expected false to be true // Object.is equality
 ❯ src/insights/detectors/widowsPenalty.evidence.test.ts:90:9
```

## Revert

`git checkout -- packages/engine/src/insights/detectors/widowsPenalty.ts`, then `git diff --quiet -- packages/engine/src/insights/detectors/widowsPenalty.ts` exited 0, confirming no change to production code after the run.
