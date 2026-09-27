## Claim

Kind: data. `tax/aca.ts#acaEconomicPremiumByMonth` allows 2026 PTC at exactly 400% FPL but no credit strictly above 400% FPL, reflecting the restored post-2025 cliff; below-100%-FPL exception pathways are outside this calculation.

## Justification

The coverage year's `maxFplPctForCredit` (`params/acaCoverageYears.ts#acaParametersForCoverageYear`; `year2026.aca` is the 2026 block) is `400` in 2026 and 2027, and `AcaResult.overCliff` is true only above, not at, the ceiling. Thus the eligibility predicate is \(f\le400\), subject to the separate 100% floor.

## Inputs

| Input | At cliff | Above cliff | Unit |
|---|---:|---:|---|
| Two-person contiguous FPL | 21,150 | 21,150 | dollars/year |
| MAGI | 84,600 | 84,601 | dollars/year |
| SLCSP premium | 12,000 | 12,000 | dollars/year |
| Enrollment premium | 10,000 | 10,000 | dollars/year |

The FPL constants and 400% ceiling are the 2026 coverage-year block's (`acaCoverageYear2026.federalPovertyLine.contiguous` and `.aca.maxFplPctForCredit`, which `year2026` references).

## Arithmetic

At cliff: `$84,600 / $21,150 × 100 = 400%`; `overCliff = false`. Applicable rate is 9.96%, contribution `$84,600 × 9.96/100 = $8,426.16`; preliminary and allowable credit `= min($10,000, $12,000 - $8,426.16) = $3,573.84`.

Above cliff: `$84,601 / $21,150 × 100 = 400.004728132388...%`; `overCliff = true`; allowable credit `$0`; economic net premium `$10,000`.

## Expected

At cliff: credit `$3,573.84`, `overCliff = false`. One dollar above: credit `$0`, `overCliff = true`, net premium `$10,000`. Tolerance: absolute `$0.005` for dollar floats, `1e-9` for FPL percentage, and exact for booleans.

## Wrong readings

- Treating the ceiling as exclusive denies the at-cliff case and produces `$0` credit.
- Continuing the 9.96% rate above the cliff produces approximately `$3,573.7404` of credit instead of `$0`.

## Family

outputs: none.

feeds: `aca-modeled-allowable-ptc-annual`; `aca-economic-net-premium-annual`; `spending-healthcare-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-three.md in this directory.

Revision, 2026-09-26: the claim now reads the ceiling from the coverage year's block (decision D-ACA-2027-TABLE); the 2026 example and its figures are unchanged. The rewording is unreviewed until a Codex or Cursor review, so the record carries reviewedBy 'unreviewed'.
