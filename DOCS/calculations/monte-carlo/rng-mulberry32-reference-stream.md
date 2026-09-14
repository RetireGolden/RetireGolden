## Claim

Kind: model. `montecarlo/rng.ts#createRng` is documented as a deterministic Mulberry32 uniform stream in `[0,1)`, with standard-normal draws by Box–Muller and uniform integers in `[0,n)`; exact output compatibility requires the canonical 32-bit Mulberry32 recurrence and draw-consumption order to be pinned.

## Justification

Mulberry32 is a small noncryptographic generator suitable for reproducible simulation sampling, not security. Under the canonical published recurrence, the state increments modulo `2^32`, is avalanched with 32-bit integer multiplication/xors, and the unsigned result is divided by `2^32`. The extract names the algorithm but does not state whether normal draws cache the paired Box–Muller value.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Seed | 1 | unsigned 32-bit integer |
| Requested uniform draws | 5 | count |

## Arithmetic

Applying the canonical Mulberry32 recurrence (all operations modulo `2^32`) and dividing each unsigned word by `4,294,967,296` gives `0.6270739405881613`, `0.00273572118021548`, `0.5274470399599522`, `0.9810509674716741`, `0.9683778982143849`.

## Expected

That five-value vector, absolute tolerance `0` when compared as IEEE-754 results of the specified integer words. This is a conditional reference: if the implementation uses a different Mulberry32 variant, the calculation record must pin that variant before this can be an engine oracle.

## Wrong readings

- Dividing by `2^32-1` changes every nonzero output slightly.
- Advancing the state after rather than before the first avalanche produces a different first value and shifts the stream.

## Family

`monte-carlo-success-rate`, `monte-carlo-investable-fan-percentiles`, `monte-carlo-ending-investable-histogram`, `monte-carlo-ending-after-tax-estate-percentiles`, `monte-carlo-depletion-probability-by-year`; no RNG draw is directly displayed.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: unreviewed.
