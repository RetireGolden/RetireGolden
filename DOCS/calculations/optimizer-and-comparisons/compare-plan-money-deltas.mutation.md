# Mutation receipt: plan-headline-money-comparison

Executed 2026-09-27 against RetireGolden base `373a40f0` (branch `claude/b2p1-slice3-comparisons`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `a1fd6d59` (branch `claude/b2p1-slice3-comparisons`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `2d33ac09` (branch `claude/b2p1-slice3-comparisons`, pull request #754) in `packages/engine`.

## Mutation applied to `packages/engine/src/scenarios/planHeadlines.ts`

```diff
diff --git a/packages/engine/src/scenarios/planHeadlines.ts b/packages/engine/src/scenarios/planHeadlines.ts
index a378737d..2383a53a 100644
--- a/packages/engine/src/scenarios/planHeadlines.ts
+++ b/packages/engine/src/scenarios/planHeadlines.ts
@@ -143,7 +143,7 @@ export function comparePlanHeadlines(
       `Two plans are compared only from one start year; the baseline starts in ${startYear} and the proposal in ${proposal.result.startYear}`,
     )
   }
-  const moneyBasis: HeadlineMoneyBasis = baseline.result.endYear === proposal.result.endYear ? 'nominal' : 'today'
+  const moneyBasis: HeadlineMoneyBasis = 'nominal'
   // Each side's dollar basis, built once per comparison and only when today's
   // dollars are needed: every ending row and the lifetime sum read the same one.
   const bases =
```

Compare nominal figures whatever the end years, the reading owner decision R13 retired: case I's estates keep their 2050 and 2060 nominal values and differ by +200,000 where the worksheet expects -131,364.95 in 2026 dollars, and case J's lifetime tax is the nominal sum.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/scenarios/planHeadlines.evidence.test.ts
```

## Captured failing output

The PR #754 review fixes changed these production files (the dollar basis built once, typed comparison refusals, the start-year refusal, the engine's material-shortfall flag, the per-candidate stochastic refusal) and one evidence file, so the hunk headers, quoted lines and test counts are re-pointed. The baseline is green (planHeadlines.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine11/packages/engine

 ❯ src/scenarios/planHeadlines.evidence.test.ts (9 tests | 2 failed) 8ms
   ❯ plan-headline-money-comparison — Compare plans: money rows in one stated basis (5)
     × case I: plans ending in 2050 and 2060 compare in 2026 dollars, each by its own factor, and the sign flips 3ms
     × case J: lifetime tax plus penalties is re-summed year by year in 2026 dollars 0ms

 Test Files  1 failed (1)
      Tests  2 failed | 7 passed (9)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/scenarios/planHeadlines.evidence.test.ts > plan-headline-money-comparison — Compare plans: money rows in one stated basis > case I: plans ending in 2050 and 2060 compare in 2026 dollars, each by its own factor, and the sign flips
AssertionError: expected 'nominal' to be 'today' // Object.is equality

Expected: "today"
Received: "nominal"

 ❯ src/scenarios/planHeadlines.evidence.test.ts:120:35
    118|       const headline = comparePlanHeadlines(baseline, proposal)
    119|       const e = expected.caseI as { moneyBasis: string; estate: Record…
    120|       expect(headline.moneyBasis).toBe(e.moneyBasis)
       |                                   ^
    121|       expect(headline.startYear).toBe(2026)
    122|       expect(headline.endYear).toEqual({ baseline: 2050, proposal: 206…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/scenarios/planHeadlines.evidence.test.ts > plan-headline-money-comparison — Compare plans: money rows in one stated basis > case J: lifetime tax plus penalties is re-summed year by year in 2026 dollars
AssertionError: expected 'nominal' to be 'today' // Object.is equality

Expected: "today"
Received: "nominal"

 ❯ src/scenarios/planHeadlines.evidence.test.ts:145:35
    143|       )
    144|       const e = expected.caseJ as { moneyBasis: string; lifetime: Reco…
    145|       expect(headline.moneyBasis).toBe(e.moneyBasis)
       |                                   ^
    146|       same(headline.lifetimeTaxesAndPenalties.baseline, e.lifetime.bas…
    147|       same(headline.lifetimeTaxesAndPenalties.proposal, e.lifetime.pro…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/scenarios/planHeadlines.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/scenarios/planHeadlines.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
