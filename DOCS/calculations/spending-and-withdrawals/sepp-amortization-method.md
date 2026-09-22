## Claim

Kind: model. `strategies/sepp.ts#seppAnnualAmount` fixes the amortization-method annual SEPP from first-year balance using an ordinary annuity payment over the Single Life Table term at the selected annual rate, with the module's default 5% rate stated to satisfy Notice 2022-6's greater-of-5%-or-120%-mid-term rate cap convention.

## Justification

For first-year balance \(B\), annual rate \(r>0\), and term \(n>0\), end-of-year level payments have present value \(B=A(1-(1+r)^{-n})/r\), hence \(A=Br/(1-(1+r)^{-n})\). At zero rate the stated degeneration is \(B/n\). This models a fixed schedule and does not claim a beneficiary-specific table election.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Method | amortization | method |
| First-year balance | 316,000 | dollars |
| Start age | 55 | years |
| Single Life term | 31.6 | years |
| Rate | 5 | percent/year |

The term is `year2026.rmd.singleLifeTable[55]`; rate is `SEPP_AMORTIZATION_RATE_PCT`.

## Arithmetic

Rate as fraction: `r = 5/100 = 1/20`.

Payment: `$316,000 × 0.05 / (1 - 1.05^(-31.6)) = $20,101.8363180299...`.

Published cents: `$20,101.84`.

## Expected

Exact expression: `316000(1/20)/(1-(21/20)^(-158/5))`; unrounded decimal `$20,101.8363180299...`; published cents `$20,101.84`. Fixture tolerance: absolute `$0.005` because exponentiation and division use binary floating point.

## Wrong readings

- Using simple division despite a nonzero rate produces `$10,000`.
- Using the current balance in later years makes the supposedly fixed amortization payment vary.

## Family

outputs: `sepp-distribution-annual`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: orchestrator (claude), 2026-09-18, by script recomputation after the independent reviewer rejected the figure on a wrong power; the reviewer's parameter, tolerance, wrong-reading and family checks stand; see REVIEW-2026-09-18-round-three.md in this directory (the report and the orchestrator note).
