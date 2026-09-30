# Mutation receipt: relocation-lifetime-state-local-tax

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-seven` at base `74916a7e`, and re-executed 2026-09-22 against RetireGolden base `7ae019a8` (branch `claude/b1-p4-cards-seven`, pull request #727), and re-executed 2026-09-27 against RetireGolden base `373a40f0` (branch `claude/b2p1-slice3-comparisons`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/relocation.ts`

```diff
diff --git a/packages/engine/src/projection/relocation.ts b/packages/engine/src/projection/relocation.ts
index c7e78e6d..529c051f 100644
--- a/packages/engine/src/projection/relocation.ts
+++ b/packages/engine/src/projection/relocation.ts
@@ -554,7 +554,7 @@ function runRow(
       error: null,
       destinationState,
       modeled: allModeled && !overrideActive && !anyIncompleteTax,
-      lifetimeStateLocalTax: drivers.totalStateLocalTax,
+      lifetimeStateLocalTax: stateTaxByYear.slice(1).reduce((sum, line) => sum + line.tax, 0),
       lifetimeTaxesAndPenalties: summary.lifetimeTaxesAndPenalties,
       // Filled by compareRelocationCandidates once the baseline row exists.
       lifetimeTaxesAndPenaltiesDeltaVsBaseline: null,
```

Sum the post-move years only, dropping the split/baseline year.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/relocation.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-27 on B2-P1 slice 3, which moved the lines this receipt quotes (new comparison fields, basis doc comments and helper calls in the production file, or new cases and fixture fields in the evidence file) without changing the mutation, so the hunk header, capture, blob hash and revert note are refreshed against this head. The baseline is green (relocation.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/projection/relocation.evidence.test.ts (2 tests | 1 failed) 38ms
   ❯ relocation-lifetime-state-local-tax — Relocation lifetime state local tax (1)
     × sums the three recorded annual lines to 13250.25 33ms

 Test Files  1 failed (1)
      Tests  1 failed | 1 passed (2)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/relocation.evidence.test.ts > relocation-lifetime-state-local-tax — Relocation lifetime state local tax > sums the three recorded annual lines to 13250.25
AssertionError: lifetimeStateLocalTax: actual 9000.25, worksheet 13250.25: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/relocation.evidence.test.ts:150:11
    148|           withinTolerance(row.lifetimeStateLocalTax, expected, example…
    149|           `lifetimeStateLocalTax: actual ${row.lifetimeStateLocalTax},…
    150|         ).toBe(true)
       |           ^
    151|         // The wrong readings: post-move years only, and a real-dollar…
    152|         expect(row.lifetimeStateLocalTax).not.toBe(lines[1]!.tax + lin…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/relocation.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/relocation.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
