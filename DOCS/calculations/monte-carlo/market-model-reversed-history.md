## Claim

Kind: model. `montecarlo/marketModels.ts#createReversedHistoryModel` stochastically selects historical windows and replays observations in reverse chronological order for the configured window length.

## Justification

Reversing a real window preserves its marginal observations while deliberately changing sequence risk. It is a stress transformation, not a historical claim.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Selected chronological window | [2000, 2001, 2002] | calendar years |
| Window length | 3 | years |

## Arithmetic

Reverse positional order: index sequence `[2,1,0]`; output years `[2002,2001,2000]`.

## Expected

Exact sequence `[2002,2001,2000]`.

## Wrong readings

- Replaying chronological order gives `[2000,2001,2002]`.
- Reversing each numeric return's sign rather than order changes values instead of sequence.

## Family

`monte-carlo-success-rate`, `monte-carlo-investable-fan-percentiles`, `monte-carlo-ending-investable-histogram`, `monte-carlo-ending-after-tax-estate-percentiles`, `monte-carlo-depletion-probability-by-year`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: unreviewed.
