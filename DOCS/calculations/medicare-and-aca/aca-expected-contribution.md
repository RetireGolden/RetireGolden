## Claim

Kind: composition. `tax/aca.ts#acaFederalPovertyLine; #acaApplicablePct; #acaEconomicPremiumByMonth` computes the 2026 expected annual benchmark-premium contribution as household MAGI times the piecewise-linear applicable percentage selected from MAGI as a percentage of the regional poverty line.

## Justification

For household size \(h\ge1\), contiguous FPL is first-person amount plus \((h-1)\) additional-person amounts. FPL percentage is \(100M/F\). The applicable rate is linearly interpolated between pack breakpoints, with its stated discontinuous step at exactly 133%; expected contribution is \(M r/100\).

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Household size | 2 | people |
| Region | contiguous | region |
| First-person FPL | 15,650 | 2026 coverage-year dollars |
| Per additional person | 5,500 | dollars/person |
| Household MAGI | 42,300 | dollars/year |
| Applicable percentage at 200% FPL | 6.60 | percent |

Values are `year2026.federalPovertyLine.contiguous` and the 200% entry of `year2026.aca.applicablePctBreakpoints`.

## Arithmetic

FPL: `$15,650 + (2 - 1) × $5,500 = $21,150`.

FPL percentage: `$42,300 / $21,150 × 100 = 200%`.

Expected contribution: `$42,300 × 6.60/100 = $2,791.80`.

## Expected

Exact derived FPL `$21,150`, FPL percentage `200`, and contribution `$2,791.80`; published figures are the same. Fixture tolerance: exact for FPL and FPL percentage, absolute `$0.005` for contribution.

## Wrong readings

- Using only the first-person FPL gives about `270.2875%` FPL and interpolates the wrong contribution rate.
- Treating 6.60 as a fraction rather than a percent produces `$279,180`.

## Family

outputs: none.

feeds: `aca-modeled-allowable-ptc-annual`; `aca-economic-net-premium-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-three.md in this directory.
