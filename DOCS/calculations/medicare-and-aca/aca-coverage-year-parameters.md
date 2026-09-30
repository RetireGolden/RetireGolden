## Claim

Kind: data. `params/acaCoverageYears.ts#acaParametersForCoverageYear` returns the published premium-tax-credit block for a coverage year: the Applicable Percentage Table of that year's revenue procedure and the HHS poverty guidelines in effect when that year's open enrollment began. `projection/simulate.ts#simulatePlan` prices each Marketplace year on its own block at a poverty-line scale of exactly 1. A year with no published block is a stand-in and is not priced (`tax-year-parameters-unsupported`). A priced year whose income-tax figures are projected from an earlier year publishes `income-tax-parameters-projected` beside `actionable`.

## Justification

IRC 36B(d)(3)(B) uses "the most recently published poverty line as of the 1st day of the regular enrollment period for coverage during such calendar year", and 26 CFR 1.36B-1(h) restates it as the guidelines in effect on the first day of the open enrollment period preceding the taxable year. 45 CFR 155.410(e)(5)(i) opens 2027 enrollment no later than November 1, 2026 and closes it by December 31, 2026, and HHS published its 2026 guidelines on January 15, 2026 (91 FR 1797) and will not publish again until January 2027. So the 2027 coverage year's poverty line is the HHS 2026 guidelines, whatever day an Exchange opens, and it is used as published. The 2027 table is Rev. Proc. 2026-26, section 3.01. The figures the credit reads are these two and the statutory 100% and 400% bounds; none of them is an income-tax figure.

| Coverage year | Table | Poverty guidelines (contiguous; Alaska; Hawaii) |
|---|---|---|
| 2026 | Rev. Proc. 2025-25: 2.10 below 133%; 3.14 to 4.19; 4.19 to 6.60; 6.60 to 8.44; 8.44 to 9.96; 9.96 to 400% | HHS 2025 (90 FR 5917): 15,650 + 5,500; 19,550 + 6,880; 17,990 + 6,330 |
| 2027 | Rev. Proc. 2026-26: 2.15 below 133%; 3.23 to 4.30; 4.30 to 6.78; 6.78 to 8.66; 8.66 to 10.22; 10.22 to 400% | HHS 2026 (91 FR 1797): 15,960 + 5,680; 19,950 + 7,100; 18,360 + 6,530 |
| 2028 and later | not published | not published |

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Coverage year | 2027 | year |
| Tax-family size, region | 1, contiguous | people |
| Household MAGI | 29,212.50 | dollars/year |
| Monthly enrollment premium = monthly SLCSP benchmark | 1,055 | dollars/month |
| Plan inflation (to separate the published line from a scaled one) | 2.5 | percent/year |
| Alaska and Hawaii tax families | 2 | people |

## Arithmetic

Poverty line: `15,960` (one person, contiguous; scale 1).

FPL percentage: `29,212.50 / 15,960 × 100 = 183.0357142857%`.

Applicable percentage, in the 150 to 200 band, read at the whole-number percentage `183` (Form 8962 instructions, Worksheet 2, line 4) and rounded to a hundredth of a percent (26 CFR 1.36B-3(g)(1)): `4.30 + (183 − 150) / 50 × (6.78 − 4.30) = 4.30 + 0.66 × 2.48 = 5.9368%`, rounded to `5.94%`.

Expected contribution: `29,212.50 × 5.94 / 100 = 1,735.2225`.

Credit: each month `min(1,055, 1,055 − 1,735.2225 / 12) = 1,055 − 144.601875 = 910.398125`; twelve months `10,924.7775`. Net premium `12,660 − 10,924.7775 = 1,735.2225`.

Alaska, two people: `19,950 + 7,100 = 27,050`; cliff `4 × 27,050 = 108,200`. Hawaii, two people: `18,360 + 6,530 = 24,890`; cliff `4 × 24,890 = 99,560`. Contiguous cliffs: `4 × 15,960 = 63,840` (one person), `4 × (15,960 + 3 × 5,680) = 132,000` (four people).

2028 has no published block: the resolver returns the 2027 block with `isStandIn = true`, and the ledger marks the year `tax-year-parameters-unsupported` with a null poverty line.

## Expected

Poverty line `15,960`; FPL percentage `183.0357142857` (published unrounded); applicable percentage `5.94`; contribution `1,735.22`; credit `10,924.78`; net premium `1,735.22`; support codes `actionable, income-tax-parameters-projected`; Alaska and Hawaii two-person cliffs `108,200` and `99,560`; 2028 a stand-in. Tolerance: exact for the poverty lines and cliffs, `1e-9` for the percentages, absolute `$0.005` for dollar floats.

## Wrong readings

- The 2026 pack's guidelines scaled by plan inflation to 2027 with the 2026 table (what the engine would do if the tax pack's year set the scale): poverty line `15,650 × 1.025 = 16,041.25`, FPL percentage `182.1086%`, read at `182`, applicable percentage `5.73%`, credit `10,986.12`.
- The published 2027 guidelines scaled by plan inflation: poverty line `15,960 × 1.025 = 16,359`, FPL percentage `178.5714%`, read at `178`, applicable percentage `5.69%`, credit `10,997.81`.
- The 2026 table carried forward with the 2027 guidelines: read at `183`, applicable percentage `5.78%`, credit `10,971.52`.
- The unrounded reading on the right figures: applicable percentage `5.9385714286%`, credit `10,925.19`.
- Refusing 2027 because its income-tax figures are not published: credit `null` and the gross `12,660` budgeted.

## Family

outputs: none.

feeds: `aca-modeled-allowable-ptc-annual`; `aca-economic-net-premium-annual`; `spending-healthcare-annual`.

## Provenance

Derived by: claude (Claude Opus), 2026-09-26, from Rev. Proc. 2026-26, 91 FR 1797, 26 U.S.C. 36B(d)(3)(B), 26 CFR 1.36B-1(h) and 45 CFR 155.410(e)(5) (evidence/aca-2027-derivation.md in the validation program), and checked the same day by a second Claude Opus instance that downloaded the sources again and recomputed every figure (evidence/aca-2027-check.md). Reviewed by: unreviewed at the time, until the review below; the catalog requires a reviewer of a different agent family.

Revision, 2026-09-26: the applicable percentage is read at the whole-number poverty-line percentage and rounded to a hundredth of a percent (decision D-ACA-2027-TABLE, the rounding change), so the worksheet's credit moves from `10,925.19` to `10,924.78` and its contribution from `1,734.81` to `1,735.22`; the evidence check (evidence/aca-2027-check.md, section 3) recomputed the same figure, 10,924.78, for early-retiree-aca's MAGI of 29,212.49.

Revision, 2026-09-27: the claim and the record's statement say "income-tax figures" for what they called the income-tax pack (the public-text rule), and the record gains a stated limit for the last sentence of 26 CFR 1.36B-1(h): a household whose primary residence moves during the year between states with different guidelines, or whose married members live in separate ones, uses the higher guideline, and the engine, which reads one `fplRegion` per year contract, does not apply that rule. No figure moves; unreviewed at the time, as above.

Reviewed by: Codex (GPT-6-Sol), 2026-09-29, `DOCS/calculations/reviews/REVIEW-2026-09-29-codex-6-after-769.md`.
