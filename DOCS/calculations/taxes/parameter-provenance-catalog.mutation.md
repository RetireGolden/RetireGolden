# Mutation receipt: parameter-provenance-catalog

Executed 2026-09-17 against RetireGolden base `33e7d546` (branch `codex/b1-p4-cards-cashflow-optimizer-taxes`), and re-executed 2026-09-26 against RetireGolden base `f9f2685b` (branch `claude/public-record-wording`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `57fe86cf` (branch `claude/aca-2027-coverage-year`, pull request #750), and re-executed 2026-09-27 against RetireGolden base `b6d48615` (branch `claude/decided-small-items`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `df4b4cbf` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `c7edd464` (branch `claude/life-table-2023`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `b8927e7e` (branch `claude/life-table-2023`, pull request #759), and re-executed 2026-09-28 against RetireGolden base `4d2d9d67` (branch `claude/bundle-reductions`, merged with that base; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/params/provenance.ts`

```diff
diff --git a/packages/engine/src/params/provenance.ts b/packages/engine/src/params/provenance.ts
index 56c5d13a..d21f32ac 100644
--- a/packages/engine/src/params/provenance.ts
+++ b/packages/engine/src/params/provenance.ts
@@ -195,7 +195,7 @@ export const PARAMETER_PROVENANCE: ParameterSource[] = [
     url: 'https://www.irs.gov/pub/irs-drop/rp-26-26.pdf',
   },
   {
-    id: 'real-yield-curve',
+    id: 'omitted-real-yield-curve',
     label: 'TIPS real-yield curve (income floor & bridge)',
     figures:
       'Par real yields as of 2026-06-30: 1.93% (5y), 2.06% (7y), 2.20% (10y), 2.54% (20y), 2.73% (30y), as published. Prices TIPS-ladder quotes and the funded-ratio discounting; refreshed annually with the parameter sets.',
```

Replace the real-yield catalog ID with a different ID, violating the enumerated dataset identity.

## Command

```
npx.cmd vitest run src/params/provenance.evidence.test.ts
```

## Captured failing output

Re-executed after bundle reduction R6 merged with #759: R6 moves the `rmd-qcd` entry out of the catalog literal into its own exported constant, `RMD_QCD_PARAMETER_SOURCE`, still listed seventh, which moves the lines around this hunk by nine; the IDs, their order and the test are #759's. The baseline is green (provenance.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine20/packages/engine

 ❯ src/params/provenance.evidence.test.ts (1 test | 1 failed) 5ms
   ❯ parameter-provenance-catalog — Parameter provenance catalog (1)
     × preserves the ordered twenty-one catalog IDs with zero duplicates 4ms

 Test Files  1 failed (1)
      Tests  1 failed (1)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/params/provenance.evidence.test.ts > parameter-provenance-catalog — Parameter provenance catalog > preserves the ordered twenty-one catalog IDs with zero duplicates
AssertionError: expected 'omitted-real-yield-curve' to be 'real-yield-curve' // Object.is equality

Expected: "real-yield-curve"
Received: "omitted-real-yield-curve"

 ❯ src/params/provenance.evidence.test.ts:18:43
     16|     expect(ids.length).toBe(example.expected.records)
     17|     expect(ids.length - new Set(ids).size).toBe(example.expected.dupli…
     18|     ids.forEach((id, index) => expect(id).toBe((example.inputs.ids as …
       |                                           ^
     19|   })
     20| })
 ❯ src/params/provenance.evidence.test.ts:18:9

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/params/provenance.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/params/provenance.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
