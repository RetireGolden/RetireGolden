# Mutation receipt: ladder-rung-flows-and-remaining-face

Executed 2026-09-14 against RetireGolden base `319c16ca` (branch claude/b1-p4-cards-ladders), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/ladder/ladderMath.ts`

```diff
@@ -167,7 +167,7 @@ export function ladderRealFlowsAtOffset(rungs: readonly Readonly<LadderRung>[],
   let maturingPrincipal = 0
   let outstandingFace = 0
   for (const rung of rungs) {
-    if (rung.maturityOffset < offset) continue
+    if (rung.maturityOffset <= offset) continue
     outstandingFace += rung.face
     coupons += rung.face * (rung.couponRatePct / 100)
     if (rung.maturityOffset === offset) maturingPrincipal += rung.face
```

This excludes the maturing rung from the year it matures (`<=` instead of `<`), the first wrong reading in the worksheet: at offset 1 coupons become $6 instead of $8 and outstanding face $200 instead of $300, and the maturing principal is never counted. The first `expect` in the block reports 6 versus 8 under the exact tolerance. `ladder-backward-face-construction` in the same file also fails, because `buildLadder` publishes its income array through the same function.

## Command

```
npx vitest run src/ladder/ladderMath.evidence.test.ts
```

## Captured failing output

Re-executed for D-RECEIPT-DRIFT because the test lines it quoted no longer matched the current test file; the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (ladderMath.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine9/packages/engine

 ❯ src/ladder/ladderMath.evidence.test.ts (15 tests | 2 failed) 8ms
   ❯ ladder-backward-face-construction — Level-real-income ladder: faces solved back to front (4)
     × pays the level $110 target in both years and echoes the target 3ms
   ❯ ladder-rung-flows-and-remaining-face — Ladder cash flows in a year and face outstanding after it (3)
     × at offset 1: coupons $8, maturing $100, outstanding $300 with the maturing rung included 0ms

 Test Files  1 failed (1)
      Tests  2 failed | 13 passed (15)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/ladder/ladderMath.evidence.test.ts > ladder-backward-face-construction — Level-real-income ladder: faces solved back to front > pays the level $110 target in both years and echoes the target
AssertionError: annualRealIncomeByOffset[0] 10 is not within {"abs":1e-9} of the worksheet's 110: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/ladder/ladderMath.evidence.test.ts:231:11
    229|           withinTolerance(income, expectedIncome[index]!, example.tole…
    230|           `annualRealIncomeByOffset[${index}] ${income} is not within …
    231|         ).toBe(true)
       |           ^
    232|       })
    233|       expect(build.targetAnnualRealIncome).toBe(example.expected.targe…
 ❯ src/ladder/ladderMath.evidence.test.ts:227:38

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/ladder/ladderMath.evidence.test.ts > ladder-rung-flows-and-remaining-face — Ladder cash flows in a year and face outstanding after it > at offset 1: coupons $8, maturing $100, outstanding $300 with the maturing rung included
AssertionError: expected 6 to be 8 // Object.is equality

- Expected
+ Received

- 8
+ 6

 ❯ src/ladder/ladderMath.evidence.test.ts:285:29
    283|     it('at offset 1: coupons $8, maturing $100, outstanding $300 with …
    284|       const flows = ladderRealFlowsAtOffset(rungs, offset)
    285|       expect(flows.coupons).toBe(example.expected.coupons)
       |                             ^
    286|       expect(flows.maturingPrincipal).toBe(example.expected.maturingPr…
    287|       expect(flows.outstandingFace).toBe(example.expected.outstandingF…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/ladder/ladderMath.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/ladder/ladderMath.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
