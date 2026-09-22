## Claim

Kind: data. `tax/medicare.ts#medicareAnnualPremiumPerPerson` selects an IRMAA tier for a premium year from MAGI two calendar years prior, so 2026 premiums use 2024 MAGI rather than current-year or prior-year MAGI.

## Justification

The module contract names its input `magiTwoYearsPrior` and states that IRMAA cliffs are determined by MAGI from two years prior. The rule is a timing selector, not a MAGI forecast.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Premium year | 2026 | calendar year |
| Lookback offset | 2 | years |
| 2024 MAGI | 109,001 | dollars/year |
| 2025 MAGI | 0 | dollars/year |
| 2026 MAGI | 0 | dollars/year |

The first-tier threshold used after selection is `year2026.medicare.irmaaTiers[0].magiOver.single = $109,000`.

## Arithmetic

Lookback year: `2026 - 2 = 2024`.

Selected MAGI: `$109,001`; because `$109,001 > $109,000`, the selected tier is 1.

## Expected

Exact derived and published selection: lookback year `2024`, MAGI `$109,001`, tier `1`; fixture tolerance: exact for years, whole-dollar MAGI, and tier.

## Wrong readings

- Using 2025 MAGI selects `$0` and tier 0.
- Using current 2026 MAGI selects `$0` and tier 0.

## Family

outputs: none.

feeds: `medicare-premiums-annual`; `irmaa-surcharge-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-three.md in this directory.
