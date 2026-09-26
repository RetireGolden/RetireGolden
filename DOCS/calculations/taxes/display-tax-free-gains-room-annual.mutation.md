# Mutation receipt: display-tax-free-gains-room-annual

Executed 2026-09-26 against RetireGolden base `7cf64e57` (branch `claude/b2p1-slice1-ledger-figures`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/yearFigures.ts`

```diff
diff --git a/packages/engine/src/projection/yearFigures.ts b/packages/engine/src/projection/yearFigures.ts
index 9568201b..3c1c6c64 100644
--- a/packages/engine/src/projection/yearFigures.ts
+++ b/packages/engine/src/projection/yearFigures.ts
@@ -163,4 +163,4 @@
     return computeFederalTax({
       ...input,
-      capitalGains: netting.netCapitalGain,
+      capitalGains: input.capitalGains + extra,
       realizedCapitalGainsBeforeCarryforward: gross,
```

Adds the extra gain to the already-netted gain instead of netting it through the carryforward, the worksheet's last wrong reading: the first dollar then eats the $3,000 loss deduction, so household A reads about 0 instead of 7,000.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/yearFigures.taxFreeGainsRoom.evidence.test.ts
```

## Captured failing output

The baseline is green (yearFigures.taxFreeGainsRoom.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine4/packages/engine

 ❯ src/projection/yearFigures.taxFreeGainsRoom.evidence.test.ts (11 tests | 4 failed) 43ms
   ❯ display-tax-free-gains-room-annual — Tax-free gains room: extra long-term gain at no extra federal tax (11)
     × household A: the room at no extra federal tax, and the segment ends 28ms
     × household B: the room at no extra federal tax, and the segment ends 2ms
     × household C: the room at no extra federal tax, and the segment ends 1ms
     × nets the extra gain through the pool when the year has a gain or a loss of its own (G, H) 0ms

 Test Files  1 failed (1)
      Tests  4 failed | 7 passed (11)



⎯⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/yearFigures.taxFreeGainsRoom.evidence.test.ts > display-tax-free-gains-room-annual — Tax-free gains room: extra long-term gain at no extra federal tax > household A: the room at no extra federal tax, and the segment ends
AssertionError: A: 0 is below 7000 - 0.01: expected 0 to be greater than or equal to 6999.99
 ❯ inBracket src/projection/yearFigures.taxFreeGainsRoom.evidence.test.ts:141:72
    139|     const inBracket = (value: number | null, root: number, label: stri…
    140|       expect(value, label).not.toBeNull()
    141|       expect(value!, `${label}: ${value} is below ${root} - ${below}`)…
       |                                                                        ^
    142|       expect(value!, `${label}: ${value} is above ${root} + ${above}`)…
    143|     }
 ❯ src/projection/yearFigures.taxFreeGainsRoom.evidence.test.ts:149:9

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/4]⎯

 FAIL  src/projection/yearFigures.taxFreeGainsRoom.evidence.test.ts > display-tax-free-gains-room-annual — Tax-free gains room: extra long-term gain at no extra federal tax > household B: the room at no extra federal tax, and the segment ends
AssertionError: B: 1500 is below 8500 - 0.01: expected 1500 to be greater than or equal to 8499.99
 ❯ inBracket src/projection/yearFigures.taxFreeGainsRoom.evidence.test.ts:141:72
    139|     const inBracket = (value: number | null, root: number, label: stri…
    140|       expect(value, label).not.toBeNull()
    141|       expect(value!, `${label}: ${value} is below ${root} - ${below}`)…
       |                                                                        ^
    142|       expect(value!, `${label}: ${value} is above ${root} + ${above}`)…
    143|     }
 ❯ src/projection/yearFigures.taxFreeGainsRoom.evidence.test.ts:149:9

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/4]⎯

 FAIL  src/projection/yearFigures.taxFreeGainsRoom.evidence.test.ts > display-tax-free-gains-room-annual — Tax-free gains room: extra long-term gain at no extra federal tax > household C: the room at no extra federal tax, and the segment ends
AssertionError: C: 58550 is below 65550 - 0.01: expected 58550 to be greater than or equal to 65549.99
 ❯ inBracket src/projection/yearFigures.taxFreeGainsRoom.evidence.test.ts:141:72
    139|     const inBracket = (value: number | null, root: number, label: stri…
    140|       expect(value, label).not.toBeNull()
    141|       expect(value!, `${label}: ${value} is below ${root} - ${below}`)…
       |                                                                        ^
    142|       expect(value!, `${label}: ${value} is above ${root} + ${above}`)…
    143|     }
 ❯ src/projection/yearFigures.taxFreeGainsRoom.evidence.test.ts:149:9

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/4]⎯

 FAIL  src/projection/yearFigures.taxFreeGainsRoom.evidence.test.ts > display-tax-free-gains-room-annual — Tax-free gains room: extra long-term gain at no extra federal tax > nets the extra gain through the pool when the year has a gain or a loss of its own (G, H)
AssertionError: G: 0 is below 3000 - 0.01: expected 0 to be greater than or equal to 2999.99
 ❯ inBracket src/projection/yearFigures.taxFreeGainsRoom.evidence.test.ts:141:72
    139|     const inBracket = (value: number | null, root: number, label: stri…
    140|       expect(value, label).not.toBeNull()
    141|       expect(value!, `${label}: ${value} is below ${root} - ${below}`)…
       |                                                                        ^
    142|       expect(value!, `${label}: ${value} is above ${root} + ${above}`)…
    143|     }
 ❯ src/projection/yearFigures.taxFreeGainsRoom.evidence.test.ts:183:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/4]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/yearFigures.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/yearFigures.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
