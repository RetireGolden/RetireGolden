# Mutation receipt: optimizer-candidate-trailing-estate-gap

Executed 2026-09-30 against RetireGolden base `fbc9a9d3` (branch `claude/ui-relocations-six`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/candidateTrailingEstate.ts`

```diff
diff --git a/packages/engine/src/projection/candidateTrailingEstate.ts b/packages/engine/src/projection/candidateTrailingEstate.ts
index dd01bfcc0..a861c367a 100644
--- a/packages/engine/src/projection/candidateTrailingEstate.ts
+++ b/packages/engine/src/projection/candidateTrailingEstate.ts
@@ -28,7 +28,7 @@ export interface TrailingEstateTournament {
 
 /** The after-tax estate improvement a tournament's candidates are measured against (see the module comment). */
 export function tournamentEstateBenchmark(tournament: TrailingEstateTournament): number {
-  const validation = tournament.winnerValidation ?? tournament.retirementActionReadinessVeto?.vetoedValidation ?? null
+  const validation = tournament.winnerValidation
   if (validation !== null) return validation.afterTaxEstateDelta
   let best = 0
   for (const candidate of tournament.candidates) best = Math.max(best, candidate.afterTaxEstateDelta)
```

The withheld winner ignored, the worksheet's second wrong reading and the case every gap the example library prints is in: case B's benchmark reads 25,000, the best candidate, where the report names the withheld winner at 30,000, so the gaps read none and 13,000 instead of 5,000 and 18,000.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/candidateTrailingEstate.evidence.test.ts
```

## Captured failing output

The baseline is green (candidateTrailingEstate.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/projection/candidateTrailingEstate.evidence.test.ts (5 tests | 1 failed) 6ms
   ❯ optimizer-candidate-trailing-estate-gap — Conversion candidate: gap to the chosen schedule (5)
     × case B: with the winner withheld pending account allocation, candidates trail that winner (30,000) 3ms

 Test Files  1 failed (1)
      Tests  1 failed | 4 passed (5)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/candidateTrailingEstate.evidence.test.ts > optimizer-candidate-trailing-estate-gap — Conversion candidate: gap to the chosen schedule > case B: with the winner withheld pending account allocation, candidates trail that winner (30,000)
AssertionError: expected 25000 to be 30000 // Object.is equality

- Expected
+ Received

- 30000
+ 25000

 ❯ src/projection/candidateTrailingEstate.evidence.test.ts:60:44
     58|     it('case B: with the winner withheld pending account allocation, c…
     59|       const t = of(inputs.caseB!)
     60|       expect(tournamentEstateBenchmark(t)).toBe(expected.caseB!.benchm…
       |                                            ^
     61|       expect(gaps(t)).toEqual(expected.caseB!.gaps)
     62|       expect(gaps(t)).not.toEqual(expected.caseB!.wrongIgnoringWithhel…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/candidateTrailingEstate.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/candidateTrailingEstate.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
