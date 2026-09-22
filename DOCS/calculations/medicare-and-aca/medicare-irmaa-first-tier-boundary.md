## Claim

Kind: formula. `tax/medicare.ts#medicareAnnualPremiumPerPerson` applies the 2026 single-filer first IRMAA tier only when two-year-lookback MAGI is strictly greater than `$109,000`, then prices Part B at 35%/25% of standard and adds the published monthly Part D surcharge.

## Justification

The `IrmaaTier` contract states that a tier applies when MAGI exceeds `magiOver`, and total Part B monthly premium is standard premium times applicable program-cost percentage divided by the 25% standard share. This cliff requires cases on both sides of the same boundary.

## Inputs

| Input | At boundary | Above boundary | Unit |
|---|---:|---:|---|
| Filing status | single | single | status |
| Lookback MAGI | 109,000 | 109,001 | dollars/year |
| First-tier `magiOver` | 109,000 | 109,000 | dollars/year |
| Standard Part B | 202.90 | 202.90 | dollars/month |
| First-tier share | 35 | 35 | percent |
| First-tier Part D surcharge | 14.50 | 14.50 | dollars/month |

Values are `year2026.medicare.partBStandardMonthly` and the first entry of `year2026.medicare.irmaaTiers`.

## Arithmetic

At `$109,000`, the strict `>` test is false: tier 0, Part B annual `$202.90 × 12 = $2,434.80`, Part D surcharge `$0`.

At `$109,001`, tier 1 applies. Part B monthly `= $202.90 × 35/25 = $284.06`; Part B annual `= $3,408.72`. Part D annual surcharge `= $14.50 × 12 = $174.00`. IRMAA-only annual surcharge `= ($284.06 - $202.90) × 12 + $174 = $1,147.92`. Total Part B plus Part D surcharge `= $3,582.72`.

## Expected

At boundary: tier `0`, `partBAnnual = $2,434.80`, `partDSurchargeAnnual = $0`, `irmaaSurchargeAnnual = $0`. Above: tier `1`, `partBAnnual = $3,408.72`, `partDSurchargeAnnual = $174.00`, `irmaaSurchargeAnnual = $1,147.92`. Fixture tolerance: absolute `$0.005` for dollar floats and exact for tiers.

## Wrong readings

- Using `>=` puts `$109,000` in tier 1 and produces `$3,582.72` total instead of `$2,434.80`.
- Treating 35% as a 35% surcharge gives Part B monthly `$273.915`, not `$284.06`.

## Family

outputs: `medicare-premiums-annual`; `irmaa-surcharge-annual`.

feeds: `spending-healthcare-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-three.md in this directory.
