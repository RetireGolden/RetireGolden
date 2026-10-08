# Review, 2026-10-08 (part-year-recheck-codex)

Reviewer: Codex (GPT-6-Sol), headless and read-only, by independent recomputation from the cited primary sources without executing the engine, on a snapshot of branch `claude/engine-0.4.3` at `ad964efe3`. The work was done by Claude (Opus). Scope: a re-check of the ten items the three part-year reviews rejected (Kentucky, Michigan, California, Oregon, the HSA check, the unknown-cap trigger, U1, relocation and the limits). Verdicts: 9 approve, 0 reject. The reviewer's scripts are published at `DOCS/calculations/reviews/scripts/part-year-recheck-2026-10-08-codex/`; they run with Python 3 and import nothing from this repository. The only edits to the report below replace local snapshot paths with repository paths. Verbatim output follows.

---

# Independent part-year phase 2 re-check

Reviewer: **Codex GPT** · headless, read-only · **2026-10-08** · snapshot commit **`ad964efe3`**. I read the code, tests, documents, and committed evidence, but did not run or import the engine or its tests. [Independent Python Decimal arithmetic](scripts/part-year-recheck-2026-10-08-codex/recompute.py) uses the stated 2026 pack amounts and the cited 2025 return mechanics. The calculated dollars are pack-model estimates, before form rounding and tax tables. I re-checked only the nine requested items.

## KY — approve

[2025 Schedule P](https://revenue.ky.gov/Forms/Schedule%20P%20%282025%29.pdf), Part II and Part III line 3, includes taxable 1040 line 4b/5b retirement income received while a Kentucky resident and excludes the lesser of that income or the whole $31,110. The `KY` descriptor has `exclusionCap: 'full'`; the split path therefore applies the cap to the slice's own rows. The uneven resident case is `(90,000 − 3,360 − 31,110) × .035 = $1,943.55`, while the $20,000 resident-pension cap case is `(30,000 − 3,360 − 20,000) × .035 = $232.40`. Both tests require `complete`. [740-NP Section B line 34](https://revenue.ky.gov/Forms/25_42A740-NP.pdf) divides Kentucky AGI after its pension exclusion by federal AGI; `stateOverFederalAgi` is the corresponding descriptor. Its ratio presently has no modeled personal credit to move.

## MI — approve

[2025 Schedule NR](https://www.michigan.gov/taxes/-/media/Project/Websites/taxes/Forms/IIT/TY2025/Schedule-NR.pdf) lines 14B/14A and 16–19 base the exemption percentage on Michigan-source AGI over total AGI, before Michigan-specific retirement subtractions. `ratioBasis: 'federalAgi'` now selects the pre-subtraction income items. The exemption is not modeled, so this descriptor correction leaves the stated `$2,125 / $3,825 / $2,125` age-50 figures unchanged.

## CA — approve

The [2025 540NR booklet](https://www.ftb.ca.gov/forms/2025/2025-540nr-booklet.html) sends **line 19 total taxable income of $100,000 or less** to the tax table for line 31 and income over $100,000 to the rate schedule. It says the line 36 effective rate is rounded to four decimal places before application to California taxable income on line 37. The California record, calculation limits, and changelog now state both approximations: the pack uses its continuous schedule and an unrounded income ratio instead of that separately rounded rate. Those limits are accurate; the cited form is for 2025, while the modeled rates are the pack's 2026 values.

## OR — approve

[2025 OR-40-P](https://www.oregon.gov/dor/forms/FormsPubs/form-or-40-p_101-055_2025.pdf) line 45 applies the Oregon percentage to tax, then lines 50–53 subtract standard credits. [OR-17's retirement-credit worksheet](https://www.oregon.gov/dor/forms/FormsPubs/publication-or-17_101-431_2025.pdf) uses the Oregon-column pension. With the 2026 pack, taxable income is `20,000 − 2,910 = 17,090`, tax is `$1,176.375`, and line 45's half is `$588.1875`. The resident slice has a `$6,000` pension; the worksheet credit is `9% × min(6,000, 7,500 − (20,000 − 15,000)) = $225`. Result: **$363.1875**. The split path now defers this credit from the annual calculation and subtracts the slice credit after the ratio.

## hsa-check — approve

`stateOptionsFromInput` passes `stateHsaAccountYearFacts` into the split calculation. Its new check marks a taxable California or New Jersey slice `incomplete` with missing `stateHsaAccountYearFacts` when the slice differs from the year-end state and supplied HSA facts are nonempty (or legacy HSA facts exist). The test checks CA→TX and NJ→TX warnings, the CA year-end control, and the empty-HSA control; the asserted CA warning identifies the year-end state's facts. This matches the stated limit. An empty array represents known no HSA activity, so it does not trigger the warning.

## unknown-cap-trigger — approve

For a missing cap policy, the split path prices the slice using the year's exclusion times resident months, then independently computes its state income with the whole cap on the slice's own receipts. It emits `state-rich-split-year-adapter-required` only when those incomes differ by more than half a cent. The AR, CO, RI and MO descriptors omit the policy. [Arkansas AR1000NR's income-percentage method](https://www.dfa.arkansas.gov/wp-content/uploads/2025_AR1000F_and_AR1000NR_Instructions.pdf) applies annual net tax to the Arkansas income ratio. With a `$4,000` pension, the annual exclusion is `$4,000`; both slice readings exclude `$2,000`, so `$1,243.41 × 23,000/46,000 = $621.705`, **complete**. With a `$10,000` pension, annual exclusion is `$6,000`; the months reading excludes `$3,000`, yielding `$1,169.41 × 22,000/44,000 = $584.705`, while the whole-cap reading excludes `$5,000`, yielding `$531.55`. The latter case is **incomplete** with `partYearExclusionCap`. The new warning and text say the *slice income* differs, which is exactly what the code compares.

## u1-annuity — approve

The [committed split-year output](DOCS/calculations/taxes/scripts/part-year-split-years.output.txt), produced by [its evidence script](DOCS/calculations/taxes/scripts/part-year-split-years.mjs), shows a ten-month KY slice in 2026. From the printed undated income and allocated 401(k) conversion, [Schedule P](https://revenue.ky.gov/Forms/Schedule%20P%20%282025%29.pdf) gives `(241,661.73 × 10/12 − 4,397.59 − 3,360) × .035 = $6,776.95` with the annuity and `(232,156.33 × 10/12 − 25,963.61 − 3,360) × .035 = $5,744.90` without it. Those match the reported slices. Relative to 0.4.2, KY tax falls `$153.92` with the annuity and `$908.73` without; the `$754.81` larger saving without makes the annuity effect more negative. The output's ending-net-worth subtraction is `$4,048,813.82 − $4,200,505.41 = −$151,691.59`, versus `$4,047,909.85 − $4,195,525.66 = −$147,615.81` before, a further `−$4,075.78`. The full later-year balance propagation is evidenced by the committed projection output, not independently reconstructed from the single KY tax line.

## relocation — approve

The same output supplies each moved candidate's split year. Recomputing at least one slice per candidate from its printed undated income, allocated rows, and pack rates gives:

| Candidate | Independent after-change slice calculation | Reported move-year change | Reported lifetime change |
| --- | ---: | ---: | ---: |
| example-couple → FL 2030 | KY: `(258,017.89/2 − 31,110 − 3,360) × .035 = $3,308.86` | `−$1,098.71` | `−$1,098.71` |
| example-couple → AZ 2028-04 | KY: `(236,393.87 × 3/12 − 31,110 − 3,360) × .035 = $862.00` | `−$1,100.34` | `−$1,132.36` |
| example-couple → PA 2031-10 | KY: `(224,300.29 × 9/12 − 31,110 − 3,360) × .035 = $4,681.43`; PA: `(224,300.29/4 − 36,186.57) × .0307 = $610.58` | `−$2,240.45` | `−$2,190.78` |
| glidepath-allocation → PA 2031-10 | CA: `tax(299,650.23 − 5,706) × 3/4 = $17,831.59`; PA: `(299,650.23/4 − 35,025.33 − 39,881.33) × .0307 = $0.18` | `−$1,198.18` | `−$1,198.18` |
| static-allocation-control → PA 2031-10 | CA: `tax(304,819.13 − 5,706) × 3/4 = $18,192.12`; PA: zero after `$35,031.23` conversion and `$41,173.56` retirement receipt | `−$1,198.38` | `−$1,198.38` |

Here `tax` is the independent 2026 California single-filer bracket calculation; [540NR](https://www.ftb.ca.gov/forms/2025/2025-540nr-booklet.html) supplies its part-year effective-rate sequence, subject to the disclosed rounding limit. [Pennsylvania's 2025 instructions](https://www.pa.gov/content/dam/copapwp-pagov/en/revenue/documents/formsandpublications/formsforindividuals/pit/documents/2025/2025_pa-40in.pdf) support removing the fully transferred Roth conversion and qualifying retirement receipt from the resident-period PA base. For AZ, the KY slice falls `$1,093.05` and the output shows another `$7.30` AZ-slice fall (a one-cent sum difference arises from displayed rounding). The AZ lifetime difference has another `−$32.02` from later years; the example PA lifetime difference offsets `$49.67` of its move-year reduction in later years. Thus each reported lifetime direction and size is consistent with the independently checked move-year mechanism and the output's annual projection totals; these later-year residuals are not independently projected from account balances here.

## limits — approve

The changelog now expressly says a named conversion's execution date does not reach the undated account annual row, consistent with `allocateSplitYear` placing only rows bearing `distributionDate` (or QCD `transferDate`) wholly in one month. The calculation document and rule record disclose the CA/NJ/HI tax-table thresholds, California's four-decimal line 36 rate, form-ratio rounding, the month proxy, and the HSA constraint checked above. [NJ-1040](https://www.nj.gov/treasury/taxation/pdf/current/1040i.pdf) and [Hawaii N-15 instructions](https://files.hawaii.gov/tax/forms/current/n15ins.pdf) require tables **below** `$100,000`, while [California 540NR](https://www.ftb.ca.gov/forms/2025/2025-540nr-booklet.html) requires one **at or below** `$100,000`; the revised wording gets those boundaries right. Nebraska's and Wisconsin's federal-item proxies omit adjustments whose signs can raise or lower the result. KY is no longer labeled an unknown cap. Within the requested scope, the limits now describe the code without an unsupported exact-return claim.
