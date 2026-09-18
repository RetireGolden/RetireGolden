## Claim

Kind: model. `montecarlo/rng.ts#derivePathSeed` is a pure function of its two
arguments, the base seed and zero-based path index. It spreads `pathIndex + 1`
with the golden-ratio word and applies the specified lowbias32 finalizer, yielding
a reproducible unsigned 32-bit seed. Therefore a path's seed does not depend on
draw consumption by another path.

## Justification

The corrected contract completely specifies the xor, logical shifts, wrapping
32-bit multiplications, index offset, and final unsigned reinterpretation. The
results for `(42, 7)` and `(42, 8)` differ, demonstrating that adjacent paths
receive distinct seeds; derivation solely from the two arguments establishes
schedule and path independence.

## Inputs

| Case | Base seed | Path index | Unit |
|---|---:|---:|---|
| (a) | 42 | 7 | 32-bit integer, zero-based index |
| (b) | 42 | 8 | 32-bit integer, zero-based index |
| (c) | 1 | 0 | 32-bit integer, zero-based index |

## Arithmetic

The independent script evaluated these expressions exactly, with each displayed
word reinterpreted unsigned for hexadecimal and decimal output:

```text
h0 = (seed ^ Math.imul(pathIndex + 1, 0x9e3779b9)) >>> 0
h1 = Math.imul(h0 ^ (h0 >>> 16), 0x21f0aaad)
h2 = Math.imul(h1 ^ (h1 >>> 15), 0x735a2d97)
result = (h2 ^ (h2 >>> 15)) >>> 0
```

For the table, the script displayed each intermediate with `word >>> 0`; this is
only the unsigned reinterpretation of the wrapping word returned by `Math.imul`
and does not alter its bits or the recurrence.

| Case | Word | Hex | Unsigned decimal |
|---|---|---:|---:|
| (a) `(42, 7)` | `h0` | `0xf1bbcde2` | 4055616994 |
| | `h1` | `0xbe0ae225` | 3188384293 |
| | `h2` | `0x5088be50` | 1351138896 |
| | result | `0x50881f41` | 1351098177 |
| (b) `(42, 8)` | `h0` | `0x8ff347ab` | 2415085483 |
| | `h1` | `0x5548d378` | 1430836088 |
| | `h2` | `0x9217dd6f` | 2451037551 |
| | result | `0x9216f940` | 2450979136 |
| (c) `(1, 0)` | `h0` | `0x9e3779b8` | 2654435768 |
| | `h1` | `0x909c71a3` | 2426171811 |
| | `h2` | `0xeb73ca6d` | 3950234221 |
| | result | `0xeb721c8a` | 3950124170 |

In particular, `1351098177 != 2450979136` for paths 7 and 8 under seed 42.

## Expected

| Input | Derived path seed | Tolerance |
|---|---:|---|
| `(42, 7)` | 1351098177 (`0x50881f41`) | exact |
| `(42, 8)` | 2450979136 (`0x9216f940`) | exact |
| `(1, 0)` | 3950124170 (`0xeb721c8a`) | exact |

## Wrong readings

- Using `pathIndex` instead of `pathIndex + 1` for `(42, 7)` produces
  `640652096` (`0x262f9340`), not `1351098177`.
- Omitting the final `h2 XOR (h2 >>> 15)` fold for `(42, 7)` returns `h2`,
  `1351138896` (`0x5088be50`), not `1351098177`.
- Using signed arithmetic without the final `>>> 0` leaves identical 32-bit
  patterns but exposes high-bit results as negative numbers. For example,
  `(42, 8)` becomes `-1843988160` instead of unsigned `2450979136`, and
  `(1, 0)` becomes `-344843126` instead of unsigned `3950124170`.

## Family

`monte-carlo-success-rate`, `monte-carlo-investable-fan-percentiles`,
`monte-carlo-ending-investable-histogram`,
`monte-carlo-ending-after-tax-estate-percentiles`,
`monte-carlo-depletion-probability-by-year`; no path seed is directly displayed.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract (with the 2026-09-18 doc-comment corrections) and the orchestrator's contract statements, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, rejected on the reviewer's own fold arithmetic; the orchestrator verified the disputed folds by hand and by a script over the stated recurrence and the worksheet stands (REVIEW-2026-09-18.md in this directory, addenda 1 and 2 and the orchestrator verification); an approving independent recomputation is still owed.

Revision note: the first derivation lacked the exact recurrence and therefore could not assert numeric seed vectors.
