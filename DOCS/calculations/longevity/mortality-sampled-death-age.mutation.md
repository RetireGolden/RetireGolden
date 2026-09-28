# Mutation receipt: mortality-sampled-death-age

Executed 2026-09-14 against RetireGolden head `efaeb827` (branch claude/b1-p4-cards-longevity, with the PR #714 round-1 revision of `src/montecarlo/mortality.evidence.test.ts` applied: the planner-ui comparison moved to the planner-ui suite, and B2-P1 slice 4 deleted it with the planner-ui copy of the identity; that run replaced the same-day run against base `2dc2011c`), and re-executed 2026-09-27 against RetireGolden base `b338e430` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `2a93de55` (branch `claude/life-table-2023`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `476abd6e` (branch `claude/life-table-2023`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/mortality.ts`

```diff
@@ -34,7 +34,7 @@
   if (from >= MAX_AGE) return MAX_AGE
   const curve = survivalCurve(from, sex)
   for (let t = 0; from + t < MAX_AGE; t++) {
-    if (rng.next() < curve.deathProbabilityGivenAlive(t)) return from + t
+    if (rng.next() < curve.deathProbabilityGivenAlive(t)) return from + t + 1
   }
   return MAX_AGE
 }
```

This returns the next birthday instead of the last full age alive, the worksheet's first wrong reading (off by one): the male draw of 0.01 at age 66 now yields 67, and the 'average' draws die at 68 instead of 67. The draw counts are unchanged, so the age assertions fail on the ages alone; the distribution probe, which recognizes a death by the age returned, finds none in the probed year and fails as well.

## Command

```
npx vitest run src/montecarlo/mortality.evidence.test.ts
```

## Captured failing output

Re-executed after the D-LIFE-TABLE-2023 review fixes (the death probability in a leaf module, the new evidence cases). The baseline is green (mortality.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine15/packages/engine

 ❯ src/montecarlo/mortality.evidence.test.ts (16 tests | 4 failed) 10ms
   ❯ mortality-sampled-death-age — Sampled death age: a year-by-year walk down the survival curve (7)
     × survives 65 on a 0.5 draw, dies in the age-66 interval on a 0.01 draw: returns 66 4ms
     × 'average' walks the mixture: draws 0.5, 0.01422, 0 survive 65 and 66 and die at 67, where the mean of q would die at 66 1ms
     × the draw's distribution is the curve's: probed through sampleDeathAge alone, one draw per year, it is the mixture's for 'average' and q itself for a man 1ms
     × floors a fractional starting age: a man of 65.9 on the draws 0.5 and 0.01 dies at 66, as a man of 65 does 0ms

 Test Files  1 failed (1)
      Tests  4 failed | 12 passed (16)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/mortality.evidence.test.ts > mortality-sampled-death-age — Sampled death age: a year-by-year walk down the survival curve > survives 65 on a 0.5 draw, dies in the age-66 interval on a 0.01 draw: returns 66
AssertionError: expected 67 to be 66 // Object.is equality

- Expected
+ Received

- 66
+ 67

 ❯ src/montecarlo/mortality.evidence.test.ts:146:52
    144|     it('survives 65 on a 0.5 draw, dies in the age-66 interval on a 0.…
    145|       const rng = drawsRng(draws)
    146|       expect(sampleDeathAge(rng, currentAge, sex)).toBe(example.expect…
       |                                                    ^
    147|       expect(example.expected.deathAge).toBe(drawValue('Male from 65, …
    148|       // One draw per year walked: exactly the two the worksheet suppl…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/4]⎯

 FAIL  src/montecarlo/mortality.evidence.test.ts > mortality-sampled-death-age — Sampled death age: a year-by-year walk down the survival curve > 'average' walks the mixture: draws 0.5, 0.01422, 0 survive 65 and 66 and die at 67, where the mean of q would die at 66
AssertionError: expected 68 to be 67 // Object.is equality

- Expected
+ Received

- 67
+ 68

 ❯ src/montecarlo/mortality.evidence.test.ts:163:58
    161|       const averageDraws = example.inputs.averageDraws as readonly num…
    162|       const rng = drawsRng(averageDraws)
    163|       expect(sampleDeathAge(rng, currentAge, 'average')).toBe(example.…
       |                                                          ^
    164|       expect(example.expected.averageDeathAge).toBe(drawValue('\'avera…
    165|       expect(rng.consumed()).toBe(3)

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/4]⎯

 FAIL  src/montecarlo/mortality.evidence.test.ts > mortality-sampled-death-age — Sampled death age: a year-by-year walk down the survival curve > the draw's distribution is the curve's: probed through sampleDeathAge alone, one draw per year, it is the mixture's for 'average' and q itself for a man
AssertionError: 'average' from 65, dying at 65 given alive: NaN: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/montecarlo/mortality.evidence.test.ts:181:98
    179|         const probed = probedDeathProbability(65, 'average', t)
    180|         // One minus a ratio of survivals near 1: two digits go to can…
    181|         expect(withinTolerance(probed, drawValue(label), { rel: 1e-13 …
       |                                                                                                  ^
    182|       })
    183|       expect(probedDeathProbability(65, 'average', 1)).not.toBe((annua…
 ❯ src/montecarlo/mortality.evidence.test.ts:178:14

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/4]⎯

 FAIL  src/montecarlo/mortality.evidence.test.ts > mortality-sampled-death-age — Sampled death age: a year-by-year walk down the survival curve > floors a fractional starting age: a man of 65.9 on the draws 0.5 and 0.01 dies at 66, as a man of 65 does
AssertionError: expected 67 to be 66 // Object.is equality

- Expected
+ Received

- 66
+ 67

 ❯ src/montecarlo/mortality.evidence.test.ts:210:46
    208|     it('floors a fractional starting age: a man of 65.9 on the draws 0…
    209|       const rng = drawsRng(draws)
    210|       expect(sampleDeathAge(rng, 65.9, sex)).toBe(drawValue('Male from…
       |                                              ^
    211|       expect(rng.consumed()).toBe(2)
    212|     })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/4]⎯
```

## Revert

The original bytes of `packages/engine/src/montecarlo/mortality.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/montecarlo/mortality.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
