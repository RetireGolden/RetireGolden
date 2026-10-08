## Claim

Kind: data. `params/provenance.ts#PARAMETER_PROVENANCE` is a human-maintained ordered catalog of 40 stable assumption-group IDs, labels, key-figure summaries, publishers, and URLs surfaced to users; it does not itself calculate tax or benefit amounts.

## Justification

The exact IDs are `federal-brackets`, `senior-deduction`, `capital-gains-niit`, `section-121-exclusion`, `ss-benefit-taxation`, `contribution-limits`, `hsa-2027`, `rmd-qcd`, `annuity-purchase`, `hecm-plf`, `medicare-irmaa`, `social-security`, `social-security-tax-rates`, `social-security-credits`, `cpi-u`, `ssa-life-table`, `ssa-life-table-2022`, `federal-poverty-line`, `aca-ptc`, `aca-ptc-2027`, `real-yield-curve`, `state-income-tax`, `state-enacted-in`, `state-enacted-ms`, `state-enacted-mt`, `state-enacted-ne`, `state-enacted-nc`, `state-enacted-hi`, `state-enacted-ny`, `state-enacted-ri`, `state-enacted-va`, `state-enacted-ga`, `state-enacted-de`, `state-enacted-il`, `state-enacted-me`, `state-enacted-md`, `state-enacted-or`, `state-enacted-ca`, `state-enacted-wa`, and `state-enacted-dc`. Source and retrieval dates differ by linked authority; the extract gives no single retrieval date, so this worksheet records extraction date 2026-09-14 and requires per-entry verification during refresh. Transformation is concise human summarization. Rights note: links and factual figures are attributed; linked reuse terms were not audited here.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Catalog entries | 40 | records |
| Stable IDs listed above | 40 | identifiers |

## Arithmetic

Count the ordered IDs: `40`; count distinct IDs: `40`; duplicates `=40-40=0`.

## Expected

40 records and zero duplicate IDs, exact integers. This verifies catalog structure, not truth or freshness of every figure.

## Wrong readings

- Omitting the real-yield entry gives 39 records and hides ladder provenance.
- Keeping one ACA entry for both coverage years gives 39 records and links the 2027 schedule to Rev. Proc. 2025-25, which does not hold it.
- Leaving the Social Security tax rates, credits and CPI-U under the COLA fact sheet gives 37 records and attributes the 6.2% rate to a page that does not state it.
- Leaving out SSA's period life table gives 39 records, and the Assumptions card restates a survival-percentile planning age as a "published source" it does not name; leaving out its earlier edition gives 39 as well, and the card cites a planning age made on the 2022 table to SSA's page for the 2023 table.
- Leaving the 2027 HSA limits inside the contribution-limits row (39 records) links them to the 2026 IRS release, which does not hold them; Rev. Proc. 2026-24 does.
- One row for all enacted state figures (23 records) can link only one statute, so seventeen of the eighteen jurisdictions' sources would go unnamed.
- Stopping at the five states of the first round (27 records) leaves Hawaii, New York, Rhode Island, Virginia, Georgia, Delaware, Illinois, Maine, Maryland, Oregon, California, Washington and the District of Columbia, whose figures the engine now reads, without a linked source.
- Counting each state named inside the general state summary as a top-level record inflates the catalog beyond 40.

## Family

none yet — provenance is surfaced metadata shared across tax, benefits, ladder, and account families, not a numeric output family.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see ../cash-flow-and-summary/REVIEW-2026-09-18.md.

Revision, 2026-09-27 (decision D-ACA-2027-TABLE, review of #750): the single `aca-ptc` entry described both ACA coverage years but linked only Rev. Proc. 2025-25, so the report appendix linked the 2027 schedule to a document that does not hold it. It is now two entries, `aca-ptc` (2026 coverage, Rev. Proc. 2025-25) and `aca-ptc-2027` (2027 coverage, Rev. Proc. 2026-26, https://www.irs.gov/pub/irs-drop/rp-26-26.pdf), so the catalog has 16 IDs; the record's digest is the SHA-256 of the new ordered 16-ID array (`f44fdd43...`). The restated claim is Claude's (derivedBy 'claude', the convention for a restated claim, #746); the original derivation above is Codex's, and the record was unreviewed until the review below.

Revision, 2026-09-27 (B2-P1 slice 4, its independent review's F15): the Social Security entry attributed "OASDI payroll tax 6.2% (employee)" to SSA's COLA fact sheet, which does not state it, and no entry named the three datasets the Social Security analysis reads. Three entries follow `social-security`: `social-security-tax-rates` (SSA's "Social Security Tax Rates", https://www.ssa.gov/oact/progdata/oasdiRates.html, now the source of the rate), `social-security-credits` (SSA's quarter-of-coverage amounts, https://www.ssa.gov/oact/cola/QC.html) and `cpi-u` (BLS CPI-U, https://data.bls.gov/timeseries/CUUR0000SA0), so the catalog has 19 IDs; the digest is the SHA-256 of the new ordered 19-ID array (`4d55f685...`). The restated claim is Claude's, and the record stayed unreviewed until the review below.

Revision, 2026-09-27 (decision D-LIFE-TABLE-2023, its independent review's M3 (RetireGolden-Docs, `calculations/bidirectional-validation-plan-2026-09-13/evidence/life-table-2023-review.md`, at commit `75e1cf87`)): no entry named SSA's period life table, which weights every Social Security expected value, the survival-percentile planning ages and spending horizons, the Monte Carlo lifespans and a joint-and-survivor annuity's exclusion ratio, and the Assumptions card restated a percentile pick as a "published source" with no source. `ssa-life-table` follows `cpi-u` (SSA's Table 4C6, https://www.ssa.gov/oact/STATS/table4c6.html, the 2023 period table of the 2026 Trustees Report), so the catalog has 20 IDs; the digest is the SHA-256 of the new ordered 20-ID array (`f02140ce...`). The restated claim is Claude's, and the record stayed unreviewed until the review below.

Revision, 2026-09-28 (PR #759 review 1): a planning age computed on the 2022 table was labelled 2022 on the Assumptions card but cited to SSA's page for the 2023 table, whose figures string describes only 2023. `ssa-life-table-2022` follows `ssa-life-table` (SSA's page for the 2022 period table of the 2025 Trustees Report, https://www.ssa.gov/oact/STATS/table4c6_2022_TR2025.html, the page `longevity/ssaPeriodLifeTable.ts#KNOWN_LIFE_TABLE_EDITIONS` names for that edition), so the catalog has 21 IDs; the digest is the SHA-256 of the new ordered 21-ID array (`37dc5f4b...`). The Assumptions card cites each planning age to the entry for the edition it was computed on. The restated claim is Claude's, and the record stayed unreviewed until the review below.

Revision, 2026-09-28 (decision D-2027-PUBLISHED-FIGURES): six entries join the catalog so that no figure the engine now reads goes without its source. `hsa-2027` (after `contribution-limits`) names the 2027 HSA limits, $4,500 / $9,000, and links Rev. Proc. 2026-24 (https://www.irs.gov/pub/irs-drop/rp-26-24.pdf). `state-enacted-in`, `state-enacted-ms`, `state-enacted-mt`, `state-enacted-ne` and `state-enacted-nc` (after `state-income-tax`) each name one state's rates enacted for 2027 and later and link the statute or session law that sets them (the Indiana Code 2026 PDF, 2025 Miss. H.B. 1, MCA 15-30-2103, Neb. Rev. Stat. 77-2715.03 and Session Law 2026-41); the `state-income-tax` summary now says Georgia and South Carolina 2027 await determinations. The catalog has 22 IDs; the record's digest is the SHA-256 of the new ordered 22-ID array (`732a0ff3...`). The restated claim is Claude's, and the record was unreviewed until the review below.

Revision, 2026-09-28, second round (decision D-2027-PUBLISHED-FIGURES, widened after the survey of every state): twelve more entries follow `state-enacted-nc`, one per state whose enacted figures the engine now reads: `state-enacted-hi` (Act 24, SLH 2026), `state-enacted-ny` (Tax Law 601), `state-enacted-ri` (2026 H 7127 Sub A), `state-enacted-va` (Va. Code 58.1-322.03), `state-enacted-ga` (HB 463), `state-enacted-de` (30 Del. C. 1106), `state-enacted-il` (35 ILCS 5/204), `state-enacted-me` (P.L. 2025, c. 650), `state-enacted-md` (2026 Md. Laws ch. 686), `state-enacted-or` (ORS chapter 316), `state-enacted-ca` (Cal. Const. art. XIII, sec. 36) and `state-enacted-wa` (ESSB 6346, chapter 238, Laws of 2026). The `state-enacted-nc` row now links the session law page (Session Law 2026-41) rather than the bill text, and the `state-income-tax` summary names the 2026 corrections, the votes pending on November 3, 2026, and the changes that await a determination, and points to the survey of all 51 jurisdictions instead of claiming the loaded list is complete. The catalog has 34 IDs; the record's digest is the SHA-256 of the new ordered 34-ID array (`886a2863...`). The restated claim is Claude's, and the record was unreviewed until the review below.

Revision, 2026-09-28, round-three review (F6): `state-enacted-dc` follows `state-enacted-wa`. The District of Columbia's own standard deduction for 2026 to 2029, which D.C. Act 26-416 puts in force by emergency act, is now loaded as current law, and the row links the act and names the permanent act's congressional review, projected to end about November 20, 2026. The catalog has 35 IDs; the record's digest is the SHA-256 of the new ordered 35-ID array (`77c8e2eb...`). The record stayed unreviewed until the review below.

Revision, 2026-09-28 (merge of main into the D-2027-PUBLISHED-FIGURES branch, after #757, #758 and #759): main's five entries (`social-security-tax-rates`, `social-security-credits`, `cpi-u`, `ssa-life-table`, `ssa-life-table-2022`) and the branch's nineteen (`hsa-2027` after `contribution-limits`, and the eighteen `state-enacted-` rows after `state-income-tax`) stand together in the order above, so the catalog has 40 IDs; the digest is the SHA-256 of the merged ordered 40-ID array (`dbdde92c...`). The record stayed unreviewed until the review below.

Reviewed by: Codex (GPT-6-Sol), 2026-09-29, `DOCS/calculations/reviews/REVIEW-2026-09-29-codex-3-longevity-ladders-taxes.md`.

Revision, 2026-10-08: the `state-enacted-dc` row and the District of Columbia sentence of the `state-income-tax` summary are restated on the permanent law. D.C. Law 26-189 (D.C. Act 26-418) took effect October 2, 2026, when its congressional review ended, and applies from 2025 with the text the emergency D.C. Act 26-416 had set, so neither names a pending review any longer; the `state-enacted-dc` row now links the enrolled act on the Council's Legislative Information Management System, names its publisher as D.C. Law 26-189, and says that the Office of Tax and Revenue's 2026 D-40ES, written before the act, enters the federal amounts and that its 2026 D-40 booklet is checked when published. No ID is added, removed or moved, so the catalog keeps 40 IDs and its digest (`dbdde92c...`). Revised by claude (opus 5.5); unreviewed.
