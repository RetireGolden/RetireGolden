## Claim

Kind: model. `projection/internal/effectiveAcaYearContract.ts#effectiveAcaYearContract` turns each stored premium-credit (ACA) year contract into the contract a run prices, by the contract's `premiumBasis` (decisions D-EXAMPLE-SOURCE-SWITCH and D-ACA-CONTRACT-PATHS, 2026-09-28):

- `'premiumField'`: the stored contract has only its year, the filing assertions, tax-exempt interest and the foreign-exclusion addback. For the run and year the module fills the poverty-guideline region from the state lived in (Alaska and Hawaii have their own tables, every other state the contiguous one), the tax family from the people alive in household order (the first primary, the next spouse, each required to file with no separate MAGI), the covered members (those alive with Marketplace months before Medicare: 12 under 65, birth month minus 1 in the year of 65), and in each covered month an enrollment premium and an SLCSP benchmark both equal to `pre65MonthlyPremiumPerPerson × h`, where `h` is the run's healthcare inflation factor from the start year (the path's own inflation on a Monte Carlo path).
- `'stated'` (or absent): the coverage year's actual figures, used as written on every run and never grown with inflation, except that a covered member who is not alive in the year is charged nothing (both monthly arrays zero). The ledger's annual convention keeps a person alive through the whole calendar year of the death age, so charging stops on 1 January of the next year. The stated tax family is left as written; it names a person who is not alive, so the year's credit is unpriced with `tax-family-member-unknown`.

The priced contract is what `YearAcaResult.grossEnrollmentPremium`, `.applicableSlcspPremium`, the credit and the year's healthcare expense are built from, and `YearAcaResult.premiumBasis` names the basis.

## Justification

A contract with the `'premiumField'` basis is a modeling basis: the premium field is the household's estimate of a full Marketplace premium in today's dollars, and the planner grows every today's-dollar healthcare input by the healthcare factor (`spending-healthcare-annual`). Making the SLCSP equal the enrollment premium is the library examples' stated assumption. A `'stated'` contract is the household's evidence for one coverage year: a quoted premium does not change with a simulated inflation rate, so the engine does not rewrite it. Coverage ends at death. 45 CFR 155.430(d)(7): "In the case of a termination due to death, the last day of enrollment in a QHP through the Exchange is the date of death." For the credit, under 26 U.S.C. 36B(c)(2)(A) a coverage month needs enrollment as of the first day of the month, so no month after the month of death counts. The ledger has no month of death: a person is alive through the calendar year of the death age for income, benefits, filing status and spending, so charging the rest of the death year is a stated limit of that annual convention. Its size, measured by the independent review of this change (finding L2) on all-401k-no-bridge with stated contracts and stochastic longevity, on the 2022 SSA period life table (before decision D-LIFE-TABLE-2023 moved the longevity draw to the 2023 table): 97 of 300 paths have a covered member die in a contract year; at a uniform month of death the convention overcharges about 5.5 months of that member's premium, about $12,000 on such a path ($3,884 averaged over all paths); and it lowers the success rate by about 0.15 points (4,000 paths: 31.20% as shipped, 31.35% charging 6 months of the death year, 31.43% charging none), at most 0.23. A tax family that names a person who is no longer alive does not describe the return, which is why the stated year is left unpriced rather than repriced.

## Inputs

Household A (premium field): Alex, born 1966-02-10, and Blair, born 1961-07-20, both alive through the years below, living in Colorado; inflation 2.5 percent and the healthcare extra 2.0 percent; pre-65 premium $800 a month; `'premiumField'` contracts for 2026 and 2027; start year 2026.

Household B (death): Casey, born 1966-01-01, and Drew, born 1964-01-01; Drew's death age is 62; the same inflation; start year 2026. B-stated has `'stated'` contracts for 2026 and 2027 naming both as tax family and both covered all year at $700 a month (enrollment and benchmark). B-derived has `'premiumField'` contracts for the same years and a pre-65 premium of $700.

| Input | Value | Unit |
|---|---:|---|
| Healthcare factor 2026 from 2026 | 1 | ratio |
| Healthcare factor 2027 from 2026 at the plan rates | 1 + 0.025 + 0.020 = 1.045 | ratio |
| Healthcare factor 2027 on a path with 3.0 percent inflation in 2026 | 1 + 0.030 + 0.020 = 1.05 | ratio |
| Alex's age 2026 / 2027 | 60 / 61 | years |
| Blair's age 2026 / 2027, birth month | 65 / 66, July | years |
| Casey's age 2026 / 2027 | 60 / 61 | years |
| Drew's age 2026 / 2027 | 62 / 63 (not alive: 63 > 62) | years |

## Arithmetic

A, 2026: Alex has 12 Marketplace months and Blair, turning 65 in July, has 7 − 1 = 6. The premium is 800 × 1 = 800 a month. Gross enrollment = 12 × 800 + 6 × 800 = 9,600 + 4,800 = 14,400, and the benchmark is the same 14,400. Both are alive, so the tax family is Alex (primary) and Blair (spouse): size 2, region contiguous (Colorado).

A, 2027 at the plan rates: Alex has 12 months, Blair none (66). 800 × 1.045 = 836 a month; 12 × 836 = 10,032.

A, 2027 on the inflation path: 800 × 1.05 = 840 a month; 12 × 840 = 10,080.

A in Alaska: the region is `alaska`.

B-stated, 2026: both alive, 2 × 12 × 700 = 16,800. 2027: Drew is not alive, so Drew's months are 0 and Casey's 12 × 700 = 8,400 remain. The stated family names Drew, so the year carries `tax-family-member-unknown`.

B-derived, 2027: the family is Casey alone (size 1); 700 × 1.045 = 731.5 a month; 12 × 731.5 = 8,778.

## Expected

| Quantity | Value |
|---|---:|
| A 2026 gross enrollment premium | 14,400 |
| A 2026 applicable SLCSP premium | 14,400 |
| A 2026 tax family size | 2 |
| A 2027 gross enrollment premium, plan rates | 10,032 |
| A 2027 gross enrollment premium, 3 percent inflation path | 10,080 |
| B-stated 2026 gross enrollment premium | 16,800 |
| B-stated 2027 gross enrollment premium | 8,400 |
| B-derived 2027 gross enrollment premium | 8,778 |
| B-derived 2027 tax family size | 1 |

Absolute tolerance $0.005 on the dollar figures (the factors are products of binary floating-point rates); exact for the family sizes, the region (`contiguous`, and `alaska` in Alaska), the basis names and the support code.

## Wrong readings

- Not growing the premium field: A 2027 is 12 × 800 = 9,600.
- Growing it at the plan's rates on a Monte Carlo path: A 2027 on the path is 10,032, not 10,080.
- Growing a stated contract with inflation: B-stated 2027 is 12 × 731.5 = 8,778, not 8,400.
- Charging a covered member after death: B-stated 2027 is 16,800.
- Taking the premium-field family from planning ages instead of the run: B-derived 2027 keeps Drew in the family (size 2).
- Reading `exampleSourceId`: none of these figures depends on it; before the decision a contract whose premiums differed from the premium field at the run's inflation was dropped when the field was set.

## Family

outputs: none.

feeds: `aca-gross-enrollment-premium-annual`; `aca-applicable-slcsp-premium-annual`; `aca-modeled-allowable-ptc-annual`; `aca-economic-net-premium-annual`; `spending-healthcare-annual`.

## Provenance

Derived by: claude (Opus 5.5), 2026-09-28, from the decisions' text (decisions-2026-09-25.md, "The Monte Carlo diagnosis, checked") and the check's specification (evidence/mc-example-source-check.md, sections 3.2 and 5.3), by hand arithmetic, before the evidence test was run. Implemented by the same session. Reviewed by: unreviewed.

Reviewed by: Codex (GPT-6-Sol), 2026-09-29, `DOCS/calculations/reviews/REVIEW-2026-09-29-codex-5-medicare-spending.md`.
