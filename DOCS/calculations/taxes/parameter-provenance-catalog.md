## Claim

Kind: data. `params/provenance.ts#PARAMETER_PROVENANCE` is a human-maintained ordered catalog of 16 stable assumption-group IDs, labels, key-figure summaries, publishers, and URLs surfaced to users; it does not itself calculate tax or benefit amounts.

## Justification

The exact IDs are `federal-brackets`, `senior-deduction`, `capital-gains-niit`, `section-121-exclusion`, `ss-benefit-taxation`, `contribution-limits`, `rmd-qcd`, `annuity-purchase`, `hecm-plf`, `medicare-irmaa`, `social-security`, `federal-poverty-line`, `aca-ptc`, `aca-ptc-2027`, `real-yield-curve`, and `state-income-tax`. Source and retrieval dates differ by linked authority; the extract gives no single retrieval date, so this worksheet records extraction date 2026-09-14 and requires per-entry verification during refresh. Transformation is concise human summarization. Rights note: links and factual figures are attributed; linked reuse terms were not audited here.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Catalog entries | 16 | records |
| Stable IDs listed above | 16 | identifiers |

## Arithmetic

Count the ordered IDs: `16`; count distinct IDs: `16`; duplicates `=16-16=0`.

## Expected

16 records and zero duplicate IDs, exact integers. This verifies catalog structure, not truth or freshness of every figure.

## Wrong readings

- Omitting the real-yield entry gives 15 records and hides ladder provenance.
- Keeping one ACA entry for both coverage years gives 15 records and links the 2027 schedule to Rev. Proc. 2025-25, which does not hold it.
- Counting each state named inside the state summary as a top-level record inflates the catalog beyond 16.

## Family

none yet — provenance is surfaced metadata shared across tax, benefits, ladder, and account families, not a numeric output family.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see ../cash-flow-and-summary/REVIEW-2026-09-18.md.

Revision, 2026-09-27 (decision D-ACA-2027-TABLE, review of #750): the single `aca-ptc` entry described both ACA coverage years but linked only Rev. Proc. 2025-25, so the report appendix linked the 2027 schedule to a document that does not hold it. It is now two entries, `aca-ptc` (2026 coverage, Rev. Proc. 2025-25) and `aca-ptc-2027` (2027 coverage, Rev. Proc. 2026-26, https://www.irs.gov/pub/irs-drop/rp-26-26.pdf), so the catalog has 16 IDs; the record's digest is the SHA-256 of the new ordered 16-ID array (`f44fdd43...`). The restated claim is Claude's (derivedBy 'claude', the convention for a restated claim, #746); the original derivation above is Codex's, and the record is unreviewed until a Codex or Cursor review.
