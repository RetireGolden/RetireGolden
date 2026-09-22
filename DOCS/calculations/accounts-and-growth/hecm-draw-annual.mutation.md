# Mutation receipt: hecm-draw-annual

Executed 2026-09-18 against RetireGolden base `60e47fd8` (branch claude/b1-p4-cards-slice-eleven) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualHecmBackstop.ts`

```diff
@@ -60,10 +60,7 @@
       visitedHecmLineIds.add(account.id)
       const line = input.hecmStates.get(account.id)
       if (!line) continue
-      const amount = Math.min(
-        remaining,
-        Math.max(0, line.principalLimit - line.loanBalance),
-      )
+      const amount = remaining
       if (amount <= 0) continue
       allocations.push({ propertyAccountId: account.id, amount })
       draw += amount
```

This draws the whole shortfall without the available-line cap, publishing $40,000 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualHecmBackstop.evidence.test.ts
```

## Captured failing output

```
 FAIL  src/projection/internal/annualHecmBackstop.evidence.test.ts > hecm-draw-annual — Annual HECM draw, including the last-resort backstop > draws the whole 25000 available line against the 40000 shortfall and no more
AssertionError: backstop draw 40000 is not within {"abs":0.005} of the worksheet's 25000: expected false to be true // Object.is equality
 FAIL  src/projection/internal/annualHecmBackstop.evidence.test.ts > hecm-draw-annual — Annual HECM draw, including the last-resort backstop > publishes the same 25000 as hecmDraw on a real last-resort ledger year
AssertionError: hecmDraw 40000 is not within {"abs":0.005} of the worksheet's 25000: expected false to be true // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/projection/internal/annualHecmBackstop.ts`, then `git diff --quiet -- packages/engine/src/projection/internal/annualHecmBackstop.ts` exited 0, confirming no change to production code after the run.
