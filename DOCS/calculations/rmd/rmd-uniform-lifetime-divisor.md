## Claim

Kind: data. `rmd/rmd.ts#requiredMinimumDistribution` computes an owner RMD for the age-attained year as the prior December 31 traditional-account balance divided by the 2026 pack's Uniform Lifetime Table divisor when no qualifying more-than-ten-years-younger sole-spouse beneficiary applies.

## Justification

The pack reproduces IRS Pub. 590-B's Uniform Lifetime Table. For age 75 its published divisor is 24.6; annual RMD is prior-year-end balance divided by that divisor.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Birth year | 1951 | calendar year |
| Age attained in 2026 | 75 | years |
| Prior-year-end balance | 246,000 | dollars at prior Dec. 31 |
| Uniform divisor at 75 | 24.6 | years |
| Sole spouse more than 10 years younger | no | boolean |

The divisor is `year2026.rmd.uniformLifetimeTable[75]`.

## Arithmetic

RMD: `$246,000 ÷ 24.6 = $10,000`.

## Expected

Exact derived and published RMD: `$10,000`; fixture tolerance: exact because the selected balance is an exact multiple of the published divisor.

## Wrong readings

- Using age-74 divisor 25.5 produces `$9,647.058823...`.
- Using current year-end rather than prior-year-end balance of, for example, `$240,000` produces `$9,756.097561...`.

## Family

outputs: `rmd-required-annual`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-three.md in this directory.
