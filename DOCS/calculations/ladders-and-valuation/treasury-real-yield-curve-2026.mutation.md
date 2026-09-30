# Mutation receipt: treasury-real-yield-curve-2026

Executed 2026-09-27 for decision D-TREASURY, which replaced the former stored row with the official one and with it this receipt's mutation (the receipt of 2026-09-14, against RetireGolden head `efaeb827`, mutated the former row and is in git history), and re-executed 2026-09-27 against RetireGolden base `b6d48615` (branch `claude/decided-small-items`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `dd0588c0` (branch `claude/decided-small-items`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/params/data/realYieldCurve2026.ts`

```diff
@@ -21,7 +21,7 @@ export const REAL_YIELD_CURVE_2026: RealYieldCurve = {
   asOfIso: '2026-06-30',
   source: 'U.S. Treasury Daily Par Real Yield Curve Rates',
   points: [
-    { maturityYears: 5, realYieldPct: 1.93 },
+    { maturityYears: 5, realYieldPct: 1.95 },
     { maturityYears: 7, realYieldPct: 2.06 },
     { maturityYears: 10, realYieldPct: 2.2 },
     { maturityYears: 20, realYieldPct: 2.54 },
```

This rounds the stored 5-year point from the official 1.93 to 1.95, its nearest 5 basis points: the first value of the nearest-5bp row the worksheet lists as a wrong reading and decision D-TREASURY declined. The pin on the worksheet's official row catches it: 1.95 is not exactly 1.93, so the zero-bound comparison fails, and the stored points no longer hash to the record's digest, so the digest test fails too; the structure and record-text assertions still pass.

## Command

```
npx vitest run src/params/data/realYieldCurve2026.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-27 after the branch review added a fourth evidence test (the record's digest against the stored points), so every capture, blob hash and revert note is refreshed against this head. The baseline is green (realYieldCurve2026.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/params/data/realYieldCurve2026.evidence.test.ts (4 tests | 2 failed) 9ms
   ❯ treasury-real-yield-curve-2026 — Embedded Treasury par real-yield curve, 2026-06-30 (4)
     × carries the official row 1.93/2.06/2.20/2.54/2.73 percent per year, exactly 3ms
     × publishes as its digest the SHA-256 of the stored points array as canonical JSON 4ms

 Test Files  1 failed (1)
      Tests  2 failed | 2 passed (4)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/params/data/realYieldCurve2026.evidence.test.ts > treasury-real-yield-curve-2026 — Embedded Treasury par real-yield curve, 2026-06-30 > carries the official row 1.93/2.06/2.20/2.54/2.73 percent per year, exactly
AssertionError: realYieldPct at 5 years 1.95 is not exactly the worksheet's official 1.93: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/params/data/realYieldCurve2026.evidence.test.ts:39:11
     37|           withinTolerance(point.realYieldPct, expectedYields[index]!, …
     38|           `realYieldPct at ${point.maturityYears} years ${point.realYi…
     39|         ).toBe(true)
       |           ^
     40|       })
     41|     })
 ❯ src/params/data/realYieldCurve2026.evidence.test.ts:35:36

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/params/data/realYieldCurve2026.evidence.test.ts > treasury-real-yield-curve-2026 — Embedded Treasury par real-yield curve, 2026-06-30 > publishes as its digest the SHA-256 of the stored points array as canonical JSON
AssertionError: expected 'sha256:61040e2d7ae93bae99cd6d178b62f7…' to be 'sha256:918bfc868d63fdfc7296d393d3fe67…' // Object.is equality

Expected: "sha256:918bfc868d63fdfc7296d393d3fe67a98f8b48b084eb21c22733ca4ff451ded7"
Received: "sha256:61040e2d7ae93bae99cd6d178b62f7abab6cc85ad951c3fad71a49f1fcda4cab"

 ❯ src/params/data/realYieldCurve2026.evidence.test.ts:67:43
     65|         .join('')
     66|       if (record.justification.kind !== 'dataset') throw new Error('tr…
     67|       expect(record.justification.digest).toBe(`sha256:${hex}`)
       |                                           ^
     68|     })
     69|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/params/data/realYieldCurve2026.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/params/data/realYieldCurve2026.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
