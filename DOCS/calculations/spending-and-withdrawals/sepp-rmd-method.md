## Claim

Kind: composition. `strategies/sepp.ts#seppAnnualAmount` computes the SEPP RMD-method annual payment as current start-of-year balance divided by the Single Life Table entry for attained age, recomputed each year.

## Justification

The module explicitly adopts the beneficiary-free Single Life Table convention among the permitted tables. For balance \(B\ge0\) and published divisor \(d>0\), payment is \(B/d\); because current balance and age are reread, the payment is not fixed.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Method | rmd | method |
| Current start-of-year balance | 316,000 | dollars |
| Attained age | 55 | years |
| Single Life divisor | 31.6 | years |

The divisor is `year2026.rmd.singleLifeTable[55]`.

## Arithmetic

Annual SEPP: `$316,000 ÷ 31.6 = $10,000`.

## Expected

Exact derived and published payment: `$10,000`; fixture tolerance: exact for this selected exact multiple.

## Wrong readings

- Using the age-55 Uniform Lifetime table is unsupported (that table has no age-55 entry in the pack).
- Treating the RMD method as fixed ignores its annual balance recomputation.

## Family

outputs: `sepp-distribution-annual`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-three.md in this directory.
