## Claim

Kind: data. `params/provenance.ts#PARAMETER_PROVENANCE` is a human-maintained ordered catalog of 15 stable assumption-group IDs, labels, key-figure summaries, publishers, and URLs surfaced to users; it does not itself calculate tax or benefit amounts.

## Justification

The exact IDs are `federal-brackets`, `senior-deduction`, `capital-gains-niit`, `section-121-exclusion`, `ss-benefit-taxation`, `contribution-limits`, `rmd-qcd`, `annuity-purchase`, `hecm-plf`, `medicare-irmaa`, `social-security`, `federal-poverty-line`, `aca-ptc`, `real-yield-curve`, and `state-income-tax`. Source and retrieval dates differ by linked authority; the extract gives no single retrieval date, so this worksheet records extraction date 2026-09-14 and requires per-entry verification during refresh. Transformation is concise human summarization. Rights note: links and factual figures are attributed; linked reuse terms were not audited here.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Catalog entries | 15 | records |
| Stable IDs listed above | 15 | identifiers |

## Arithmetic

Count the ordered IDs: `15`; count distinct IDs: `15`; duplicates `=15-15=0`.

## Expected

15 records and zero duplicate IDs, exact integers. This verifies catalog structure, not truth or freshness of every figure.

## Wrong readings

- Omitting the real-yield entry gives 14 records and hides ladder provenance.
- Counting each state named inside the state summary as a top-level record inflates the catalog beyond 15.

## Family

none yet — provenance is surfaced metadata shared across tax, benefits, ladder, and account families, not a numeric output family.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see ../cash-flow-and-summary/REVIEW-2026-09-18.md.
