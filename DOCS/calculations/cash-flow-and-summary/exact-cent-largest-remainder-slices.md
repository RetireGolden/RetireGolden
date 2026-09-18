## Claim

Kind: formula. `actions/exactCentProRata.ts#exactCentLargestRemainderSlices` allocates a nonnegative exact-cent total across nonnegative integer weights, reconciles independently rounded shares to the exact total by largest fractional remainder, and breaks ties by input position.

## Justification

Exact shares are `Aw_i/W`. Independent whole-cent rounding need not conserve `A`; distributing the residual to largest remainders (or taking it from smallest when over) restores conservation while minimizing deviations. Domain: integer `A,w_i>=0`; zero total weight allocates zero.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Amount | 10 | cents |
| Weights | [1, 1, 1] | integer weights |

## Arithmetic

Each exact share is `10/3=3+1/3` cents and initially rounds to 3. Initial sum is 9, leaving one cent. All remainders tie, so position 0 receives it: `[4,3,3]`.

## Expected

Slices `[4n,3n,3n]` cents and sum `10n`, exact integers.

## Wrong readings

- Independent rounding returns `[3,3,3]`, losing one cent.
- Resolving equal remainders by last position returns `[3,3,4]`, violating positional tie-breaking.

## Family

none yet — this is upstream allocation evidence rather than a displayed family.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18.md in this directory.
