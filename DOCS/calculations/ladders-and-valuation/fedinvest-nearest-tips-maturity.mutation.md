# Mutation receipt: fedinvest-nearest-tips-maturity

Executed 2026-09-14 against RetireGolden base `e594ac64` (branch claude/b1-p4-cards-ladders), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet) in `packages/engine`.

The first execution followed the worksheet's re-derivation with the one-year window stated.

## Mutation applied to `packages/engine/src/ladder/fedInvest.ts`

```diff
diff --git a/packages/engine/src/ladder/fedInvest.ts b/packages/engine/src/ladder/fedInvest.ts
index 5ee94fe8..52799ed9 100644
--- a/packages/engine/src/ladder/fedInvest.ts
+++ b/packages/engine/src/ladder/fedInvest.ts
@@ -116,5 +116,5 @@ export function nearestTipsForYear(tips: FedInvestTips[], year: number): FedInve
       bestDistance = distance
     }
   }
-  return best && bestDistance <= 1 ? best : null
+  return best && true /* mutation: no window */ ? best : null
 }
```

This removes the one-year window, the worksheet's first wrong reading: case B (candidates 2030 and 2035 for target 2033) then returns the 2035 row instead of null.

## Command

```
npx vitest run src/ladder/fedInvest.evidence.test.ts
```

## Captured failing output

Re-executed for D-RECEIPT-DRIFT because its diff was a text substitution that named no line (it is now the git diff of the same substitution) and the test lines it quoted no longer matched the current test file; the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (fedInvest.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine9/packages/engine

 ❯ src/ladder/fedInvest.evidence.test.ts (9 tests | 1 failed) 6ms
   ❯ fedinvest-nearest-tips-maturity — Nearest FedInvest TIPS for a rung year (4)
     × case B: returns null when the nearest candidate is two years away (2030/2035 for 2033) 2ms

 Test Files  1 failed (1)
      Tests  1 failed | 8 passed (9)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/ladder/fedInvest.evidence.test.ts > fedinvest-nearest-tips-maturity — Nearest FedInvest TIPS for a rung year > case B: returns null when the nearest candidate is two years away (2030/2035 for 2033)
AssertionError: expected 'T2035' to be null // Object.is equality

- Expected:
null

+ Received:
"T2035"

 ❯ src/ladder/fedInvest.evidence.test.ts:121:54
    119|       // First derivation expected the 2035 row here; the one-year win…
    120|       // not stated in the doc comment until 2026-09-14.
    121|       expect(pick(example.inputs.caseB as number[])).toBe(example.expe…
       |                                                      ^
    122|     })
    123|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/ladder/fedInvest.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/ladder/fedInvest.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
