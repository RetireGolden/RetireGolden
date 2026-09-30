# Mutation receipt: aime-covered-earnings-cap

Executed 2026-09-27 against RetireGolden base `81d4bf03` (branch `claude/social-security-law-2`; no pull request is open yet) for the new record under decision D-SS-LAW-2, and re-executed 2026-09-27 against RetireGolden base `2d5fd40c` (branch `claude/social-security-law-2`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `20b95c74` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/socialSecurity/piaFromEarnings.ts`

```diff
diff --git a/packages/engine/src/socialSecurity/piaFromEarnings.ts b/packages/engine/src/socialSecurity/piaFromEarnings.ts
index d90a5df9..84c0ab36 100644
--- a/packages/engine/src/socialSecurity/piaFromEarnings.ts
+++ b/packages/engine/src/socialSecurity/piaFromEarnings.ts
@@ -132,7 +132,7 @@ function capEarnings(year: number, amount: number): number {
   // are not counted. The base is SSA's for every year from 1937, and the latest
   // published one for projected/future years SSA has not set yet (otherwise high
   // earners' projected years would inflate AIME past the taxable maximum).
-  return Math.max(0, Math.min(amount, wageBaseForYearOrLatest(year)))
+  return Math.max(0, Math.min(amount, year < 1979 ? 184_500 : wageBaseForYearOrLatest(year)))
 }
 
 /**
```

This caps every year before 1979 at the latest base, as the engine did until 2026-09-27 (the worksheet's first wrong reading): case A publishes an AIME of 7,790 and a PIA of $2,605.00.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/socialSecurity/piaFromEarnings.wageBase.evidence.test.ts
```

## Captured failing output

Re-executed for B2-P1 slice 4 because lines moved above its hunk (the survival curve, the PIA resolver and the zero-year gain, or simulatePlan's COLA helpers) or its test file gained cases; the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (piaFromEarnings.wageBase.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/socialSecurity/piaFromEarnings.wageBase.evidence.test.ts (3 tests | 2 failed) 7ms
   ❯ aime-covered-earnings-cap — Covered earnings counted up to each year's contribution and benefit base, from 1951 (3)
     × case A: the 1978 wage counts only its 17,700 base (AIME 7,436, PIA 2,551.90, not 7,790 and 2,605.00) 4ms
     × case B: the window starts at 1951 and each year counts its base (31 years, AIME 111, PIA 99.90) 1ms

 Test Files  1 failed (1)
      Tests  2 failed | 1 passed (3)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/socialSecurity/piaFromEarnings.wageBase.evidence.test.ts > aime-covered-earnings-cap — Covered earnings counted up to each year's contribution and benefit base, from 1951 > case A: the 1978 wage counts only its 17,700 base (AIME 7,436, PIA 2,551.90, not 7,790 and 2,605.00)
AssertionError: expected 50000 to be 17700 // Object.is equality

- Expected
+ Received

- 17700
+ 50000

 ❯ src/socialSecurity/piaFromEarnings.wageBase.evidence.test.ts:76:38
     74|       const result = pia([1956, 8, 14], earnings)
     75|       const row1978 = result.indexedYears.find((row) => row.year === 1…
     76|       expect(row1978.cappedEarnings).toBe(expected.caseA1978Counted)
       |                                      ^
     77|       expect(row1978.indexedAnnual).toBe(expected.caseA1978Indexed)
     78|       expect(result.aime).toBe(expected.caseAAime)

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/socialSecurity/piaFromEarnings.wageBase.evidence.test.ts > aime-covered-earnings-cap — Covered earnings counted up to each year's contribution and benefit base, from 1951 > case B: the window starts at 1951 and each year counts its base (31 years, AIME 111, PIA 99.90)
AssertionError: expected 20000 to be 4800 // Object.is equality

- Expected
+ Received

- 4800
+ 20000

 ❯ src/socialSecurity/piaFromEarnings.wageBase.evidence.test.ts:88:84
     86|       expect(result.firstBaseYear).toBe(expected.caseBFirstYear)
     87|       expect(result.computationYearCount).toBe(expected.caseBYears)
     88|       expect(result.indexedYears.find((row) => row.year === 1960)!.cap…
       |                                                                                    ^
     89|       expect(result.indexedYears.find((row) => row.year === 1970)!.cap…
     90|       expect(result.aime).toBe(expected.caseBAime)

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/socialSecurity/piaFromEarnings.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/socialSecurity/piaFromEarnings.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
