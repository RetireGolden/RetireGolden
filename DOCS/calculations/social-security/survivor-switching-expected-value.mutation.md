# Mutation receipt: survivor-switching-expected-value

Executed 2026-09-27 against RetireGolden base `20b95c74` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `df4b4cbf` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `c7edd464` (branch `claude/life-table-2023`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `8ccc9f8f` (branch `claude/ss-analysis-earnings-test`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `22f6f755` (branch `claude/ss-analysis-earnings-test`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `c74ae372` (branch `claude/ss-analysis-earnings-test`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/socialSecurity/analysis/survivorSwitching.ts`

```diff
diff --git a/packages/engine/src/socialSecurity/analysis/survivorSwitching.ts b/packages/engine/src/socialSecurity/analysis/survivorSwitching.ts
index 974aa3bc..2e107df6 100644
--- a/packages/engine/src/socialSecurity/analysis/survivorSwitching.ts
+++ b/packages/engine/src/socialSecurity/analysis/survivorSwitching.ts
@@ -389,7 +389,7 @@ export function rankSwitchStrategies(input: SwitchingInput, options: SwitchingOp
   const byStream = new Map<string, { strategy: SwitchStrategy; stream: number[] }>()
   for (const strategy of strategies) {
     const stream = strategyStream(input, strategy, options)
-    const key = stream.join(',')
+    const key = JSON.stringify(strategy)
     const held = byStream.get(key)
     if (held === undefined || preferenceOrder(strategy, held.strategy) < 0) byStream.set(key, { strategy, stream })
   }
```

This keeps one strategy per pair of ages rather than per yearly stream, the retired ranking and the worksheet's last wrong reading: case A lists eleven strategies, four of them at $423k, rather than six.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/socialSecurity/analysis/survivorSwitching.evidence.test.ts
```

## Captured failing output

Re-executed for D-SS-ANALYSIS-EARNINGS-TEST after merging main at 6f668e06 (the 2027 rollover), because its production file now carries both branches' changes; the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (survivorSwitching.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/socialSecurity/analysis/survivorSwitching.evidence.test.ts (9 tests | 5 failed) 27ms
   ❯ survivor-switching-expected-value — Survivor and own benefit switching for a widow(er) (9)
     × case A: six distinct strategies, the survivor benefit at 62 alone first ($423k), each at the worksheet's value 6ms
     × case B: the plan's COLA drift and cut scale each year, so survivor at 60 then own at 70 ranks first; survivor ages start at 60 1ms
     × case C: a widow of 65 is offered own ages from 65, never a past claim at 62 1ms
     × case D: her wages withhold part of each benefit before 67 and the months withheld raise it from 67, so survivor at 60 then own at 70 never switches 5ms
     × case E: the months withheld before 62 raise the survivor benefit from 62 (20 CFR 404.412(b)), and the value does not depend on the plan's inflation 3ms

 Test Files  1 failed (1)
      Tests  5 failed | 4 passed (9)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 5 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/socialSecurity/analysis/survivorSwitching.evidence.test.ts > survivor-switching-expected-value — Survivor and own benefit switching for a widow(er) > case A: six distinct strategies, the survivor benefit at 62 alone first ($423k), each at the worksheet's value
AssertionError: case A: expected [ 'Survivor only, at 62', …(10) ] to deeply equal [ 'Survivor only, at 62', …(5) ]

- Expected
+ Received

  [
    "Survivor only, at 62",
+   "Survivor at 62, switch to own at 62",
+   "Survivor at 62, switch to own at 67",
+   "Survivor at 62, switch to own at 70",
    "Own at 62, switch to survivor at 67",
    "Survivor only, at 67",
+   "Survivor at 67, switch to own at 67",
+   "Survivor at 67, switch to own at 70",
    "Own only, at 70",
    "Own only, at 67",
    "Own only, at 62",
  ]

 ❯ expectRanking src/socialSecurity/analysis/survivorSwitching.evidence.test.ts:82:73
     80|   const expected = expectedRanking(caseLabel)
     81|   const ranked = rankSwitchStrategies(input, options)
     82|   expect(ranked.map((row) => label(row.strategy)), `case ${caseLabel}`…
       |                                                                         ^
     83|   ranked.forEach((row, index) => {
     84|     const value = expected[index]!.expectedPv
 ❯ src/socialSecurity/analysis/survivorSwitching.evidence.test.ts:110:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/5]⎯

 FAIL  src/socialSecurity/analysis/survivorSwitching.evidence.test.ts > survivor-switching-expected-value — Survivor and own benefit switching for a widow(er) > case B: the plan's COLA drift and cut scale each year, so survivor at 60 then own at 70 ranks first; survivor ages start at 60
AssertionError: case B: expected [ …(11) ] to deeply equal [ …(7) ]

- Expected
+ Received

  [
    "Survivor at 60, switch to own at 70",
    "Own at 62, switch to survivor at 67",
    "Survivor only, at 60",
+   "Survivor at 60, switch to own at 62",
+   "Survivor at 60, switch to own at 67",
    "Survivor only, at 67",
+   "Survivor at 67, switch to own at 67",
+   "Survivor at 67, switch to own at 70",
    "Own only, at 62",
    "Own only, at 67",
    "Own only, at 70",
  ]

 ❯ expectRanking src/socialSecurity/analysis/survivorSwitching.evidence.test.ts:82:73
     80|   const expected = expectedRanking(caseLabel)
     81|   const ranked = rankSwitchStrategies(input, options)
     82|   expect(ranked.map((row) => label(row.strategy)), `case ${caseLabel}`…
       |                                                                         ^
     83|   ranked.forEach((row, index) => {
     84|     const value = expected[index]!.expectedPv
 ❯ src/socialSecurity/analysis/survivorSwitching.evidence.test.ts:114:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/5]⎯

 FAIL  src/socialSecurity/analysis/survivorSwitching.evidence.test.ts > survivor-switching-expected-value — Survivor and own benefit switching for a widow(er) > case C: a widow of 65 is offered own ages from 65, never a past claim at 62
AssertionError: case C: expected [ …(11) ] to deeply equal [ …(6) ]

- Expected
+ Received

  [
    "Own at 65, switch to survivor at 66",
    "Survivor only, at 65",
+   "Survivor at 65, switch to own at 65",
+   "Survivor at 65, switch to own at 67",
+   "Survivor at 65, switch to own at 70",
    "Survivor only, at 66",
+   "Survivor at 66, switch to own at 67",
+   "Survivor at 66, switch to own at 70",
    "Own only, at 70",
    "Own only, at 67",
    "Own only, at 65",
  ]

 ❯ expectRanking src/socialSecurity/analysis/survivorSwitching.evidence.test.ts:82:73
     80|   const expected = expectedRanking(caseLabel)
     81|   const ranked = rankSwitchStrategies(input, options)
     82|   expect(ranked.map((row) => label(row.strategy)), `case ${caseLabel}`…
       |                                                                         ^
     83|   ranked.forEach((row, index) => {
     84|     const value = expected[index]!.expectedPv
 ❯ src/socialSecurity/analysis/survivorSwitching.evidence.test.ts:122:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/5]⎯

 FAIL  src/socialSecurity/analysis/survivorSwitching.evidence.test.ts > survivor-switching-expected-value — Survivor and own benefit switching for a widow(er) > case D: her wages withhold part of each benefit before 67 and the months withheld raise it from 67, so survivor at 60 then own at 70 never switches
AssertionError: case D: expected [ …(11) ] to deeply equal [ …(6) ]

- Expected
+ Received

  [
    "Own at 62, switch to survivor at 67",
    "Survivor only, at 60",
+   "Survivor at 60, switch to own at 62",
+   "Survivor at 60, switch to own at 67",
+   "Survivor at 60, switch to own at 70",
    "Survivor only, at 67",
+   "Survivor at 67, switch to own at 67",
+   "Survivor at 67, switch to own at 70",
    "Own only, at 70",
    "Own only, at 67",
    "Own only, at 62",
  ]

 ❯ expectRanking src/socialSecurity/analysis/survivorSwitching.evidence.test.ts:82:73
     80|   const expected = expectedRanking(caseLabel)
     81|   const ranked = rankSwitchStrategies(input, options)
     82|   expect(ranked.map((row) => label(row.strategy)), `case ${caseLabel}`…
       |                                                                         ^
     83|   ranked.forEach((row, index) => {
     84|     const value = expected[index]!.expectedPv
 ❯ src/socialSecurity/analysis/survivorSwitching.evidence.test.ts:131:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/5]⎯

 FAIL  src/socialSecurity/analysis/survivorSwitching.evidence.test.ts > survivor-switching-expected-value — Survivor and own benefit switching for a widow(er) > case E: the months withheld before 62 raise the survivor benefit from 62 (20 CFR 404.412(b)), and the value does not depend on the plan's inflation
AssertionError: case E: expected [ …(11) ] to deeply equal [ …(6) ]

- Expected
+ Received

  [
    "Own at 62, switch to survivor at 67",
    "Survivor only, at 60",
+   "Survivor at 60, switch to own at 62",
+   "Survivor at 60, switch to own at 67",
+   "Survivor at 60, switch to own at 70",
    "Survivor only, at 67",
+   "Survivor at 67, switch to own at 67",
+   "Survivor at 67, switch to own at 70",
    "Own only, at 70",
    "Own only, at 67",
    "Own only, at 62",
  ]

 ❯ expectRanking src/socialSecurity/analysis/survivorSwitching.evidence.test.ts:82:73
     80|   const expected = expectedRanking(caseLabel)
     81|   const ranked = rankSwitchStrategies(input, options)
     82|   expect(ranked.map((row) => label(row.strategy)), `case ${caseLabel}`…
       |                                                                         ^
     83|   ranked.forEach((row, index) => {
     84|     const value = expected[index]!.expectedPv
 ❯ src/socialSecurity/analysis/survivorSwitching.evidence.test.ts:156:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/5]⎯
```

## Revert

The original bytes of `packages/engine/src/socialSecurity/analysis/survivorSwitching.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/socialSecurity/analysis/survivorSwitching.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
