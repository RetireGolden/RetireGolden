# Mutation receipt: parameter-provenance-catalog

Executed 2026-09-17 against RetireGolden base `33e7d546` (branch `codex/b1-p4-cards-cashflow-optimizer-taxes`), and re-executed 2026-09-26 against RetireGolden base `f9f2685b` (branch `claude/public-record-wording`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `57fe86cf` (branch `claude/aca-2027-coverage-year`, pull request #750), and re-executed 2026-09-27 against RetireGolden base `b6d48615` (branch `claude/decided-small-items`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/params/provenance.ts`

```diff
diff --git a/packages/engine/src/params/provenance.ts b/packages/engine/src/params/provenance.ts
index f9ba18f8..85d1f84e 100644
--- a/packages/engine/src/params/provenance.ts
+++ b/packages/engine/src/params/provenance.ts
@@ -145,7 +145,7 @@ export const PARAMETER_PROVENANCE: ParameterSource[] = [
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

Re-executed 2026-09-27 for decision D-TREASURY: the embedded Treasury row became the official 2026-06-30 row, which changed this receipt's evidence file or moved the lines it mutates, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (provenance.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine10/packages/engine

 ❯ src/params/provenance.evidence.test.ts (1 test | 1 failed) 4ms
   ❯ parameter-provenance-catalog — Parameter provenance catalog (1)
     × preserves the ordered sixteen catalog IDs with zero duplicates 4ms

 Test Files  1 failed (1)
      Tests  1 failed (1)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/params/provenance.evidence.test.ts > parameter-provenance-catalog — Parameter provenance catalog > preserves the ordered sixteen catalog IDs with zero duplicates
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
