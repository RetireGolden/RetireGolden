# Mutation receipt: social-security-claim-break-even

Executed 2026-09-27 against RetireGolden base `20b95c74` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `8ccc9f8f` (branch `claude/ss-analysis-earnings-test`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/socialSecurity/analysis/breakEven.ts`

```diff
diff --git a/packages/engine/src/socialSecurity/analysis/breakEven.ts b/packages/engine/src/socialSecurity/analysis/breakEven.ts
index b6d3176d..abfedec4 100644
--- a/packages/engine/src/socialSecurity/analysis/breakEven.ts
+++ b/packages/engine/src/socialSecurity/analysis/breakEven.ts
@@ -167,7 +167,7 @@ export function claimBreakEven(input: ClaimBreakEvenInput): ClaimBreakEvenResult
           deaths: new Map(),
           credits: pathCredits,
           withWages: wagesInYear !== undefined,
-          cola: socialSecurityColaFactor(assumptions.ssCola, inflationFrom, startYear, year),
+          cola: Math.pow(1 + (assumptions.ssCola.mode === 'fixed' ? assumptions.ssCola.annualPct : assumptions.inflationPct) / 100, age - BREAK_EVEN_FIRST_AGE),
           haircut: socialSecurityHaircutFactor(assumptions.ssHaircut, year),
         })
         benefit = result.paidByPerson.get('person') ?? 0
```

This compounds the cost-of-living adjustment from age 62 on the start-year PIA, the retired chart's reading and the worksheet's first wrong reading: case A, whose person is 62 in the start year, is unchanged, but case B's dollars fall to the retired 21,000 at 62 (the plan's factor to 2058, 1.025^32, is lost) and case D's rise by 1.02^2 at 67, while every crossing age stays where it was. Each year is priced by the ledger's year function since D-SS-ANALYSIS-EARNINGS-TEST, and this line hands it the year's COLA factor.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/socialSecurity/analysis/breakEven.evidence.test.ts
```

## Captured failing output

The Social Security year moved into one function the ledger and the analysis models share, with the earnings test charged month by month (decision D-SS-ANALYSIS-EARNINGS-TEST), so the mutation is re-executed on that code. The baseline is green (breakEven.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/socialSecurity/analysis/breakEven.evidence.test.ts (9 tests | 2 failed) 94ms
   ❯ social-security-claim-break-even — Claiming break-even ages and cumulative benefits (9)
     × case B: a 30-year-old's dollars carry the plan's factor to 2058, 1.025^32, and the crossings do not move 5ms
     × case D: a fixed 2% COLA compounds from the start year, not from 62 (36,930.04 at 67) 2ms

 Test Files  1 failed (1)
      Tests  2 failed | 7 passed (9)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/socialSecurity/analysis/breakEven.evidence.test.ts > social-security-claim-break-even — Claiming break-even ages and cumulative benefits > case B: a 30-year-old's dollars carry the plan's factor to 2058, 1.025^32, and the crossings do not move
AssertionError: B 62/62: 21000 against the worksheet's 46278.89569322881: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectDollars src/socialSecurity/analysis/breakEven.evidence.test.ts:53:119
     51|
     52| function expectDollars(actual: number, expected: number, label: string…
     53|   expect(withinTolerance(actual, expected, { rel: 1e-9 }), `${label}: …
       |                                                                                                                       ^
     54| }
     55|
 ❯ src/socialSecurity/analysis/breakEven.evidence.test.ts:103:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/socialSecurity/analysis/breakEven.evidence.test.ts > social-security-claim-break-even — Claiming break-even ages and cumulative benefits > case D: a fixed 2% COLA compounds from the start year, not from 62 (36,930.04 at 67)
AssertionError: D 67/67: 38422.01195136 against the worksheet's 36930.038400000005: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectDollars src/socialSecurity/analysis/breakEven.evidence.test.ts:53:119
     51|
     52| function expectDollars(actual: number, expected: number, label: string…
     53|   expect(withinTolerance(actual, expected, { rel: 1e-9 }), `${label}: …
       |                                                                                                                       ^
     54| }
     55|
 ❯ src/socialSecurity/analysis/breakEven.evidence.test.ts:123:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/socialSecurity/analysis/breakEven.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/socialSecurity/analysis/breakEven.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
