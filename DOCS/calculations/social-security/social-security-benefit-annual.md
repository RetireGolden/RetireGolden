## Claim

Kind: composition. `projection/internal/types/result.ts#YearResult.incomes.socialSecurity / socialSecurityStreams`, composed by `projection/internal/annualSocialSecurity.ts#annualSocialSecurity`, sums each living person's own benefit `PIA × claim-age factor × payable months × COLA factor × haircut factor`; a larger marital candidate replaces the running amount, and the below-FRA earnings test then withholds the stated excess-wage fraction, capped at benefit. This formula is stated by the `YearIncomes.socialSecurity` comment.

## Justification

The cases isolate own-benefit timing, current-spouse replacement, and the earnings test. The 2026 pack constants are `earningsTestBelowFraAnnual = $24,480` and `earningsTestFraYearAnnual = $65,160`.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Own-benefit birth year / FRA | 1960 / 67y0m | year / age |
| Own-benefit claim age / months before FRA | 64y3m / 33 | age / months |
| Own-benefit PIA / derived claim factor | 2,000 / 49/60 | dollars/month / ratio |
| Claim-year payable months (`12 - 3`) | 9 | months |
| Claim-year COLA / haircut factors | 1 / 0.95 | ratios |
| Later-year payable months | 12 | months |
| Later-year COLA / haircut factors | 1.06 / 0.95 | ratios |
| Higher/lower PIA in spouse case | 2,000 / 300 | dollars/month |
| Both spouse-case claim and spousal factors | 1 | ratios |
| Family-maximum cap | nonbinding | condition |
| Earnings-test gross benefit / wages | 24,000 / 34,480 | dollars/year |

## Arithmetic

For a person born in 1960, the FRA rule gives `67y0m`. Claiming at `64y3m` is `33` months early, all within the first 36 months, so the early-claim factor is `1 - 33 × (5/9 of 1%) = 1 - 11/60 = 49/60`. The claim age has three months, so the claim year pays `12 - 3 = 9` months. Own claim year: `$2,000 × 49/60 × 9 × 1 × 0.95 = $13,965`. Later year: `$2,000 × 49/60 × 12 × 1.06 × 0.95 = $19,737.20`.

Two-person case: higher earner own amount `= $2,000/month`. Lower earner own amount `= $300/month`. The auxiliary excess is `max(0, 0.5 × $2,000 × 1 - $300) = $700/month`, and the family-maximum cap is nonbinding. The lower earner's spousal candidate is own benefit plus excess, `$300 + $700 = $1,000/month`; because `$1,000 > $300`, it replaces the lower running amount. Annual household benefit `= ($2,000 + $1,000) × 12 = $36,000`.

Below-FRA earnings-test case: withholding `= max(0, ($34,480 - $24,480) / 2) = $5,000`, below the `$24,000` benefit cap; paid benefit `= $24,000 - $5,000 = $19,000`. In an FRA year the stated alternate calculation uses the `$65,160` limit and divides excess wages by 3.

## Expected

Exact values: own claim year `$13,965`; later year `$19,737.20`; two-person case `$36,000`; below-FRA case `$19,000` paid and `$5,000` withheld. Fixture tolerance: absolute `$0.005`, because dollar figures use binary floating point.

## Wrong readings

- Holding the old `0.8` factor beside nine payable months combines incompatible claim ages: `0.8` is exactly 36 months early, whose claim-age month is zero and therefore pays 12 months in the claim year, while nine payable months here come from `64y3m` and its `49/60` factor.
- Treating the `$700` auxiliary excess as the whole spousal candidate gives `($2,000 + $700) × 12 = $32,400`; the candidate includes the lower earner's `$300` own benefit and is `$1,000/month`, producing `$36,000`.
- Dividing below-FRA excess wages by 3 gives withholding `$3,333.33` and paid benefit `$20,666.67`; `/3` belongs to the FRA-year branch, not the below-FRA branch.

## Family

outputs: `social-security-benefit-annual`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract (with the 2026-09-18 doc-comment completion), without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-eleven.md in this directory (the re-check section named "Re-check, 2026-09-18 (three worksheets after the slice-thirteen comment completion)").

Revision: The first derivation treated the spousal excess as the whole candidate and paired a `0.8` claim factor with an incompatible nine-month claim year; the implementation's fixture found both errors.
