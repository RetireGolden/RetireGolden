## Claim

Kind: data. `rmd/jointLifeTable.ts#jointLifeTableDivisor; rmd/rmd.ts#requiredMinimumDistribution` uses the Joint and Last Survivor table when the sole-beneficiary spouse is more than ten years younger, dividing the prior-year-end balance by the owner-age/spouse-age table entry.

## Justification

The extract reproduces 26 CFR 1.401(a)(9)-9(d) Table 3 and states that the qualifying-spouse exception replaces the Uniform Lifetime divisor. At owner age 75 and spouse age 60, the published row/column value is 28.3.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Owner age attained | 75 | years |
| Sole spouse age attained | 60 | years |
| Age difference | 15 | years |
| Prior-year-end balance | 246,000 | dollars |
| Joint-life divisor | 28.3 | years |

The divisor is `TABLE_II_BY_OWNER_AGE[75][60]` in the extract.

## Arithmetic

Eligibility: `75 - 60 = 15 > 10`.

RMD: `$246,000 ÷ 28.3 = $8,692.57950530035...`.

Published cents: `$8,692.58`.

## Expected

Exact unrounded value: `2460000/283 = $8,692.579505300353...`; published cents: `$8,692.58`; fixture tolerance: absolute `$0.005` because division is binary floating point and the comparison is to cents.

## Wrong readings

- Using the age-75 Uniform divisor 24.6 produces `$10,000`.
- Treating “more than ten” as “at least ten” would incorrectly use Table II for an exactly ten-year gap.

## Family

outputs: `rmd-required-annual`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-three.md in this directory.
