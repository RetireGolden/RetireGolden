# Mutation receipt: display-net-care-cost-annual

Executed 2026-09-26 against RetireGolden base `6b01db8d` (branch `claude/b2p1-slice1-ledger-figures`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/yearFigures.ts`

```diff
diff --git a/packages/engine/src/projection/yearFigures.ts b/packages/engine/src/projection/yearFigures.ts
index 9568201b..273cd5ed 100644
--- a/packages/engine/src/projection/yearFigures.ts
+++ b/packages/engine/src/projection/yearFigures.ts
@@ -71,4 +71,4 @@
     )
   }
-  return Math.max(0, difference)
+  return difference
 }
```

Drops the floor, the worksheet's first wrong reading: case C then publishes -7.275957614183426e-12, which a page prints as -$0, instead of 0.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/yearFigures.evidence.test.ts
```

## Captured failing output

The baseline is green (yearFigures.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/projection/yearFigures.evidence.test.ts (13 tests | 2 failed) 43ms
   ❯ display-net-care-cost-annual — Net long-term-care cost after the LTC benefit (3)
     × absorbs the two-policy residue and refuses a real overpayment 3ms
     × floors the residue a real two-policy ledger year produces 3ms

 Test Files  1 failed (1)
      Tests  2 failed | 11 passed (13)



⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/yearFigures.evidence.test.ts > display-net-care-cost-annual — Net long-term-care cost after the LTC benefit > absorbs the two-policy residue and refuses a real overpayment
AssertionError: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/yearFigures.evidence.test.ts:160:61
    158|       const benefit = cap + (cost - cap)
    159|       expect(cost - benefit).toBe(expected.caseCResidue)
    160|       expect(Object.is(netCareCost(row(cost, benefit)), 0)).toBe(true)
       |                                                             ^
    161|       expect(() => netCareCost(row(inputs.refused!.careCost!, inputs.r…
    162|     })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/projection/yearFigures.evidence.test.ts > display-net-care-cost-annual — Net long-term-care cost after the LTC benefit > floors the residue a real two-policy ledger year produces
AssertionError: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/yearFigures.evidence.test.ts:180:68
    178|       expect(year.expenses.ltcBenefit).toBe(expected.ledgerFirstPolicy…
    179|       expect(year.expenses.careCost - year.expenses.ltcBenefit).toBeLe…
    180|       expect(Object.is(netCareCost(year), expected.ledgerNetCare)).toB…
       |                                                                    ^
    181|     })
    182|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/yearFigures.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/yearFigures.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
