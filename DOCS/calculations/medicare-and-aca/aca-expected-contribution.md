## Claim

Kind: composition. `tax/aca.ts#acaFederalPovertyLine; #acaApplicablePct; #acaEconomicPremiumByMonth` computes the expected annual benchmark-premium contribution as household MAGI times the piecewise-linear applicable percentage selected from MAGI as a percentage of the regional poverty line, both read from the coverage year's block (`params/acaCoverageYears.ts#acaParametersForCoverageYear`).

## Justification

For household size \(h\ge1\), contiguous FPL is first-person amount plus \((h-1)\) additional-person amounts. FPL percentage is \(100M/F\). The table is read at that percentage with its fraction dropped, as Form 8962 computes it (Instructions for Form 8962, Worksheet 2, line 4: "Do not round; instead, multiply this number by 100 (to express it as a percentage) and then drop any numbers after the decimal point."). The applicable rate is linearly interpolated between the breakpoints at that whole number, with its stated discontinuous step at exactly 133%, and rounded half up to the nearest one-hundredth of one percent (26 CFR 1.36B-3(g)(1): "is rounded to the nearest one-hundredth of one percent"); expected contribution is \(M r/100\).

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Household size | 2 | people |
| Region | contiguous | region |
| First-person FPL | 15,650 | 2026 coverage-year dollars |
| Per additional person | 5,500 | dollars/person |
| Household MAGI | 42,300 | dollars/year |
| Applicable percentage at 200% FPL | 6.60 | percent |

Values are the 2026 coverage-year block's contiguous poverty line and the 200% entry of its `applicablePctBreakpoints` (`acaCoverageYear2026`, which `year2026` references).

## Arithmetic

FPL: `$15,650 + (2 - 1) × $5,500 = $21,150`.

FPL percentage: `$42,300 / $21,150 × 100 = 200%`.

Expected contribution: `$42,300 × 6.60/100 = $2,791.80`. At exactly 200% the whole-number percentage and the rounding change nothing.

Second case, where they do (2026, one person, contiguous, MAGI `$28,500`): FPL percentage `$28,500 / $15,650 × 100 = 182.1086%`, read at `182`; rate `4.19 + (182 − 150)/50 × 2.41 = 5.7324%`, rounded to `5.73%`; contribution `$28,500 × 5.73/100 = $1,633.05`.

## Expected

Exact derived FPL `$21,150`, FPL percentage `200`, and contribution `$2,791.80`; published figures are the same. Second case: FPL percentage `182.1086` (published unrounded), applicable percentage `5.73`, contribution `$1,633.05`. Fixture tolerance: exact for FPL and FPL percentage, `1e-9` for the applicable percentage, absolute `$0.005` for contribution.

## Wrong readings

- Using only the first-person FPL gives about `270.2875%` FPL and interpolates the wrong contribution rate.
- Treating 6.60 as a fraction rather than a percent produces `$279,180`.
- Second case, reading the table at the exact percentage without rounding: `5.7376%`, contribution `$1,635.23`.
- Second case, rounding without dropping the fraction first (the regulation read alone): `5.7376%` rounds to `5.74%`, contribution `$1,635.90`.
- Second case, dropping the fraction without rounding: `5.7324%`, contribution `$1,633.73`.

## Family

outputs: none.

feeds: `aca-modeled-allowable-ptc-annual`; `aca-economic-net-premium-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-three.md in this directory.

Revision, 2026-09-26: the claim now names the coverage year's block rather than the 2026 pack (decision D-ACA-2027-TABLE); the 2026 example and its figures are unchanged, and the 2027 figures are evidenced on aca-coverage-year-parameters. The rewording is unreviewed until a Codex or Cursor review, so the record carries reviewedBy 'unreviewed'.

Revision, 2026-09-26: the rounding the regulation and the form state is now applied (decision D-ACA-2027-TABLE): the table is read at the whole-number poverty-line percentage and the applicable percentage is rounded to a hundredth of a percent. The first case does not move; the second case was added to discriminate the readings. Derived by a Claude Opus instance and checked by a second (evidence/aca-2027-check.md, section 3, which recomputed 5.73% and the 2026 credit of 10,366.95 on the same household); unreviewed until a Codex or Cursor review, so the record carries reviewedBy 'unreviewed'. Form 8962 also rounds the annual contribution (line 8a) and the monthly one (line 8b) to whole dollars; the engine does not, a stated limit on the record (at most about $0.50 of credit a year on the annual path and about $6 on the monthly path). The record's provenance now reads derivedBy 'claude', following the convention for a restated claim (#746): the claim as it stands is Claude's restatement, while the original derivation above is Codex's.
