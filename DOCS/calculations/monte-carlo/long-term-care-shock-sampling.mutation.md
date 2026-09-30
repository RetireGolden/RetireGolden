# Mutation receipt: long-term-care-shock-sampling

Re-executed 2026-09-18 after the #719 review against RetireGolden base `33e7d546` (branch grok/b1-p4-cards-monte-carlo), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `da378d9b` (branch `claude/people-order-and-scenarios`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/ltcShock.ts`

```diff
diff --git a/packages/engine/src/montecarlo/ltcShock.ts b/packages/engine/src/montecarlo/ltcShock.ts
index bd99ffb1..e9838686 100644
--- a/packages/engine/src/montecarlo/ltcShock.ts
+++ b/packages/engine/src/montecarlo/ltcShock.ts
@@ -64,7 +64,7 @@ function pickDuration(rng: Rng, durations: LtcShockParams['durations']): number
 export function sampleCareEvents(rng: Rng, people: ReadonlyArray<{ id: string; dob: string }>, startYear: number, params: LtcShockParams): CareEvent[] {
   const events: CareEvent[] = []
   for (const p of people) {
-    if (rng.next() >= params.incidence) continue
+    if (rng.next() < params.incidence) continue
     const span = Math.max(0, params.maxOnsetAge - params.minOnsetAge)
     const currentAge = startYear - Number(p.dob.slice(0, 4))
     const startAge = Math.max(currentAge, params.minOnsetAge + rng.nextInt(span + 1))
```

Reverses the incidence comparison so U >= incidence now emits an episode. With U=0.75 and incidence 0.5 the empty-list case becomes a one-event list, the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 npx.cmd vitest run src/montecarlo/ltcShock.evidence.test.ts
```

## Captured failing output

Re-executed because decisions D-PEOPLE-ORDER and D-FI-CONVERSION-TAX moved the production lines or the evidence test lines this receipt quotes; the mutation is unchanged. The baseline is green (ltcShock.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/montecarlo/ltcShock.evidence.test.ts (1 test | 1 failed) 5ms
   ❯ long-term-care-shock-sampling — Per-person paid-care episode draw (1)
     × U = 0.75 >= incidence 0.5 emits the empty care-event list 4ms

 Test Files  1 failed (1)
      Tests  1 failed (1)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/ltcShock.evidence.test.ts > long-term-care-shock-sampling — Per-person paid-care episode draw > U = 0.75 >= incidence 0.5 emits the empty care-event list
AssertionError: expected 1 to be +0 // Object.is equality

- Expected
+ Received

- 0
+ 1

 ❯ src/montecarlo/ltcShock.evidence.test.ts:43:29
     41|         { ...DEFAULT_LTC_SHOCK, incidence: example.inputs.incidence as…
     42|       )
     43|       expect(events.length).toBe(example.expected.eventCount as number)
       |                             ^
     44|     })
     45|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/montecarlo/ltcShock.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/montecarlo/ltcShock.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
