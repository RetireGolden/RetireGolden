## Claim

Kind: data. `params/provenance.ts#PARAMETER_PROVENANCE` is a human-maintained ordered catalog of 19 stable assumption-group IDs, labels, key-figure summaries, publishers, and URLs surfaced to users; it does not itself calculate tax or benefit amounts.

## Justification

The exact IDs are `federal-brackets`, `senior-deduction`, `capital-gains-niit`, `section-121-exclusion`, `ss-benefit-taxation`, `contribution-limits`, `rmd-qcd`, `annuity-purchase`, `hecm-plf`, `medicare-irmaa`, `social-security`, `social-security-tax-rates`, `social-security-credits`, `cpi-u`, `federal-poverty-line`, `aca-ptc`, `aca-ptc-2027`, `real-yield-curve`, and `state-income-tax`. Source and retrieval dates differ by linked authority; the extract gives no single retrieval date, so this worksheet records extraction date 2026-09-14 and requires per-entry verification during refresh. Transformation is concise human summarization. Rights note: links and factual figures are attributed; linked reuse terms were not audited here.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Catalog entries | 19 | records |
| Stable IDs listed above | 19 | identifiers |

## Arithmetic

Count the ordered IDs: `19`; count distinct IDs: `19`; duplicates `=19-19=0`.

## Expected

19 records and zero duplicate IDs, exact integers. This verifies catalog structure, not truth or freshness of every figure.

## Wrong readings

- Omitting the real-yield entry gives 15 records and hides ladder provenance.
- Keeping one ACA entry for both coverage years gives 15 records and links the 2027 schedule to Rev. Proc. 2025-25, which does not hold it.
- Counting each state named inside the state summary as a top-level record inflates the catalog beyond 19.
- Leaving the Social Security tax rates, credits and CPI-U under the COLA fact sheet gives 16 records and attributes the 6.2% rate to a page that does not state it.

## Family

none yet — provenance is surfaced metadata shared across tax, benefits, ladder, and account families, not a numeric output family.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see ../cash-flow-and-summary/REVIEW-2026-09-18.md.

Revision, 2026-09-27 (decision D-ACA-2027-TABLE, review of #750): the single `aca-ptc` entry described both ACA coverage years but linked only Rev. Proc. 2025-25, so the report appendix linked the 2027 schedule to a document that does not hold it. It is now two entries, `aca-ptc` (2026 coverage, Rev. Proc. 2025-25) and `aca-ptc-2027` (2027 coverage, Rev. Proc. 2026-26, https://www.irs.gov/pub/irs-drop/rp-26-26.pdf), so the catalog has 16 IDs; the record's digest is the SHA-256 of the new ordered 16-ID array (`f44fdd43...`). The restated claim is Claude's (derivedBy 'claude', the convention for a restated claim, #746); the original derivation above is Codex's, and the record is unreviewed until a Codex or Cursor review.

Revision, 2026-09-27 (B2-P1 slice 4, its independent review's F15): the Social Security entry attributed "OASDI payroll tax 6.2% (employee)" to SSA's COLA fact sheet, which does not state it, and no entry named the three datasets the Social Security analysis reads. Three entries follow `social-security`: `social-security-tax-rates` (SSA's "Social Security Tax Rates", https://www.ssa.gov/oact/progdata/oasdiRates.html, now the source of the rate), `social-security-credits` (SSA's quarter-of-coverage amounts, https://www.ssa.gov/oact/cola/QC.html) and `cpi-u` (BLS CPI-U, https://data.bls.gov/timeseries/CUUR0000SA0), so the catalog has 19 IDs; the digest is the SHA-256 of the new ordered 19-ID array (`4d55f685...`). The restated claim is Claude's, and the record stays unreviewed.
