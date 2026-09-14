## Claim

Kind: model. `montecarlo/rng.ts#derivePathSeed` deterministically hashes the pair `(base seed, zero-based path index)` to a 32-bit path seed so a path's stream does not depend on how preceding paths consume draws; the comment calls it “SplitMix32-style” but does not specify an exact recurrence.

## Justification

Hashing path identity rather than advancing one shared stream makes worker partitioning irrelevant. “SplitMix32-style” is not a unique numeric specification: constants, index offset, signed/unsigned coercion, and avalanche sequence must be stated before an independent vector can be derived.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Base seed | 42 | 32-bit integer |
| Path index | 7 | zero-based integer |

## Arithmetic

The required arithmetic would be: combine `42` and `7` using the exact documented increment, apply each specified 32-bit xor/shift/multiply avalanche modulo `2^32`, and interpret the final word unsigned. Those constants and steps are absent from the permitted extract, so no defensible number can be calculated.

## Expected

No numeric oracle is asserted. The record must first pin the exact hash variant; its evidence should then use an exact integer vector and also show the same `(42,7)` seed under one-worker and split-worker scheduling.

## Wrong readings

- Using `seed+pathIndex=49` directly permits adjacent, structurally related streams and is not a hash.
- Advancing path 0's RNG by path 0's draw count makes path 7's seed depend on earlier path length, contrary to the claim.

## Family

`monte-carlo-success-rate`, `monte-carlo-investable-fan-percentiles`, `monte-carlo-ending-investable-histogram`, `monte-carlo-ending-after-tax-estate-percentiles`, `monte-carlo-depletion-probability-by-year`; no path seed is directly displayed.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: unreviewed.
