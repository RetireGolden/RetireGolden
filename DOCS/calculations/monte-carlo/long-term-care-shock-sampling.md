## Claim

Kind: model. `montecarlo/ltcShock.ts#sampleCareEvents` samples at most one paid-care episode per person from an incidence probability, bounded onset ages, weighted discrete duration, and today's-dollar annual cost, clamping onset no earlier than current age.

## Justification

The model represents distributional LTC risk so existing care-event insurance offsets can be applied. Its defaults are planning approximations and do not predict individual need, local cost, or insurance eligibility.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| People | one | count |
| Incidence | 0.5 | probability |
| First uniform draw | 0.75 | probability |
| Annual cost | 75,000 | today's dollars/year |

## Arithmetic

Episode occurs only when the incidence draw falls inside the 0.5 mass. `0.75>=0.5`, so no episode is sampled and no onset, duration, or cost is emitted.

## Expected

Empty care-event list, exact count zero.

## Wrong readings

- Reversing the comparison (`U>incidence` means event) creates one episode.
- Sampling one household event per path rather than one per person can produce the wrong event count for couples.

## Family

`spending-care-cost-gross-annual`, `long-term-care-benefit-annual`, `monte-carlo-success-rate`, `monte-carlo-ending-investable-histogram`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18.md in this directory.
