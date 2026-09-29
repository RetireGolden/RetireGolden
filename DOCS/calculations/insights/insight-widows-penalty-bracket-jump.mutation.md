# Mutation receipt: insight-widows-penalty-bracket-jump

Executed 2026-09-17 and re-executed 2026-09-18 against RetireGolden base `b99ac29b` (branch grok/b1-p4-cards-insights-ss-medicare-roth), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `15b1b7a5` (branch `claude/2027-rollover`, pull request #768) in `packages/engine`.

## Mutation applied to `packages/engine/src/insights/detectors/widowsPenalty.ts`

```diff
@@ -114,5 +114,5 @@ export const widowsPenalty: Detector = {
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

The round-one review's fixes on this branch (PR #768 issues 1 and 7) moved the lines these receipts quote; the mutations are unchanged. The baseline is green (widowsPenalty.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/insights/detectors/widowsPenalty.evidence.test.ts (1 test | 1 failed) 16ms
   ❯ insight-widows-penalty-bracket-jump — Rough real survivor bracket jump, single versus joint on the same MAGI (1)
     × deflates the $10,000 nominal jump by 4/5 to $8,000 today 15ms

 Test Files  1 failed (1)
      Tests  1 failed (1)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


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

The original bytes of `packages/engine/src/insights/detectors/widowsPenalty.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/insights/detectors/widowsPenalty.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
