## Claim

Kind: data. `params/hsaLimitYears.ts#hsaLimitsForYear` returns the IRC 223(b)(2) base limits the IRS publishes for a calendar year: 4,400 self-only and 8,750 family for 2026 (Rev. Proc. 2025-19), and 4,500 self-only and 9,000 family for 2027 (Rev. Proc. 2026-24, section 3.01(1)). `projection/simulate.ts#simulatePlan` reads a published year at a scale of exactly 1, so 2027 is read as published although its income-tax figures are still projected from 2026. A year after the latest published one grows from that year at the plan inflation path. A year before the earliest published one gets the earliest published limits, unscaled and flagged as a stand-in (`isStandIn`); no plan reaches it, since the examples are pinned to 2026 and a user's plan starts in the clock's year. `projection/internal/annualContributionsAndEmployerMatch.ts#annualContributionsAndEmployerMatch` holds each owner's HSA contributions to the base (the family base halved between two spouses filing jointly) plus the flat 1,000 dollar age-55 catch-up, which is not scaled.

## Justification

Section 223(g)(1) increases "each dollar amount in subsections (b)(2)" by the cost-of-living adjustment for the calendar year, and the IRS publishes the result in a revenue procedure each May. Rev. Proc. 2026-24, section 3.01(1): "For calendar year 2027, the annual limitation on deductions under section 223(b)(2)(A) for an individual with self-only coverage under a high deductible health plan is $4,500. For calendar year 2027, the annual limitation on deductions under § 223(b)(2)(B) for an individual with family coverage under a high deductible health plan is $9,000." Section 4 makes it effective "for HSAs for calendar year 2027". The additional contribution amount of 223(b)(3)(B) is "2009 and thereafter $1,000"; 223(g)(1) does not reach it and the revenue procedure does not restate it.

| Year | Self-only | Family | Source |
|---|---:|---:|---|
| 2026 | 4,400 | 8,750 | Rev. Proc. 2025-19, section 2.01(1) |
| 2027 | 4,500 | 9,000 | Rev. Proc. 2026-24, section 3.01(1) |
| 2028 and later | not published | not published | grown from 2027 at the plan inflation path |

The same revenue procedure publishes the 2027 high deductible health plan minimum deductibles (1,750 and 3,500) and out-of-pocket maximums (8,700 and 17,400). No calculation reads them.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Self-only household | one person born 1986-06-15, wages 100,000 | dollars/year |
| Family household | two spouses born 1986-06-15, married filing jointly, wages 100,000 each | dollars/year |
| Desired HSA contribution | 50,000 per HSA | dollars/year |
| Plan inflation | 2.5 and 4 | percent/year |
| Catch-up household | one person born 1972-06-15 (56 in 2028), wages 100,000 | dollars/year |

## Arithmetic

2027, at either inflation rate: the year is published, so the scale is 1. Self-only: `4,500`. Family: `9,000`, divided equally between the spouses under 223(b)(5), `4,500` each, household total `9,000`.

2028 at 2.5%: the latest published year is 2027, so the scale is one year of inflation, `1.025`. Self-only: `4,500 × 1.025 = 4,612.50`. Family: `9,000 × 1.025 = 9,225`, `4,612.50` each.

2028 at 2.5%, owner aged 56: `4,500 × 1.025 + 1,000 = 5,612.50`.

## Expected

| Quantity | Value |
|---|---:|
| 2027 self-only contribution, at 2.5% and at 4% | 4,500 |
| 2027 family contribution, household total, at 2.5% and at 4% | 9,000 |
| 2028 self-only contribution at 2.5% | 4,612.50 |
| 2028 family contribution, household total, at 2.5% | 9,225 |
| 2028 self-only contribution with the catch-up at 2.5% | 5,612.50 |

Tolerance: absolute `$0.005`.

## Wrong readings

- The 2026 limits grown at the plan inflation (what the engine did before the 2027 limits were loaded): 2027 self-only `4,400 × 1.025 = 4,510` and family `8,750 × 1.025 = 8,968.75` at 2.5%; `4,576` and `9,100` at 4%. 2028 at 2.5%: `4,400 × 1.025² = 4,622.75` and `8,750 × 1.025² = 9,192.97`.
- The catch-up grown with the base: 2028 at 2.5%, `(4,500 + 1,000) × 1.025 = 5,637.50`.

## Family

outputs: none.

feeds: `year-result-contributions`.

## Provenance

Derived by: claude (Claude Opus 5.5), 2026-09-28, from Rev. Proc. 2026-24 (https://www.irs.gov/pub/irs-drop/rp-26-24.pdf, fetched 2026-09-28, SHA-256 bcb6b41a835b84d4315f738a7250801831021829e39d70225424e2f45afcb715) and 26 U.S.C. 223(b)(2), (b)(3)(B) and (g)(1) (uscode.house.gov, fetched 2026-09-28), under decision D-2027-PUBLISHED-FIGURES. The before figures (4,510 and 8,968.75 at 2.5%, 4,576 and 9,100 at 4%) are the ones the independent check of the 2027 rollover measured (D-2027-ROLLOVER, section 2.7). Reviewed by: unreviewed, until a Codex or Cursor review; the catalog requires a reviewer of a different agent family.
