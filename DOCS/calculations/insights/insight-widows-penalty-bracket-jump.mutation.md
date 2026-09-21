# Mutation receipt: insight-widows-penalty-bracket-jump

Executed 2026-09-17 and re-executed 2026-09-18 against RetireGolden base `b99ac29b` (branch grok/b1-p4-cards-insights-ss-medicare-roth) in `packages/engine`.

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

Re-executed 2026-09-18 after the evidence fixture moved to the exact tolerance on the published whole-dollar figure (round three of the #720 review). The baseline is green (widowsPenalty.evidence.test.ts passes on unmodified production). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-s6/packages/engine

 ❯ src/insights/detectors/widowsPenalty.evidence.test.ts (1 test | 1 failed) 14ms
   ❯ insight-widows-penalty-bracket-jump — Rough real survivor bracket jump, single versus joint on the same MAGI (1)
     × deflates the $10,000 nominal jump by 4/5 to $8,000 today 14ms

 Test Files  1 failed (1)
      Tests  1 failed (1)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/insights/detectors/widowsPenalty.evidence.test.ts > insight-widows-penalty-bracket-jump — Rough real survivor bracket jump, single versus joint on the same MAGI > deflates the $10,000 nominal jump by 4/5 to $8,000 today
AssertionError: bracketJumpToday 10000 is not within "exact" of the worksheet's 8000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/insights/detectors/widowsPenalty.evidence.test.ts:90:9
     88|         withinTolerance(jump, expected, example.tolerance),
     89|         `bracketJumpToday ${jump} is not within ${JSON.stringify(examp…
     90|       ).toBe(true)
       |         ^
     91|     })
     92|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

`git checkout -- packages/engine/src/insights/detectors/widowsPenalty.ts`, then `git diff --quiet -- packages/engine/src/insights/detectors/widowsPenalty.ts` exited 0, confirming no change to production code after the run.
