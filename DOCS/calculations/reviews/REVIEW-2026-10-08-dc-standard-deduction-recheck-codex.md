# Review, 2026-10-08 (dc-standard-deduction-recheck-codex)

Reviewer: Codex (GPT-6-Sol), headless and read-only, by independent recomputation from the cited primary sources without executing the engine, on a snapshot of branch `claude/queued-0.4.2` at `529593eb1`. The work was done by Claude (Opus). Scope: a re-check of the two DC wording points the first DC review rejected (the continuity claim and the indexed-deduction exceptions), plus the Nebraska record changed for the same claim. Verdicts: 3 approve, 0 reject. The only edits to the report below replace local snapshot paths with repository paths. Verbatim output follows.

---

# Independent re-check — District of Columbia wording

Reviewer: Codex GPT; headless, read-only. Date: 2026-10-08. Snapshot commit: `529593eb1`. I did not run or import the engine or its tests, and did not modify the snapshot.

## Item 1 — approve

The DC record in `packages/engine/src/rules/records/statesSouthAtlantic.ts`, `CHANGELOG.md`, and `DOCS/domain/state-tax-research/DC.md` now base tax year 2026 on D.C. Law 26-189: section 7113 applies subtitle I as of January 1, 2025. They present Acts 26-214, 26-217 and 26-416 as history, and identify the dispute over H.J.Res. 142 without deciding whether it nullified the temporary Act 26-217. The [enrolled Law 26-189](https://lims.dccouncil.gov/downloads/LIMS/61627/Meeting3/Enrollment/B26-0661-Enrollment17.pdf?Id=243990) and [Council legislative record](https://lims.dccouncil.gov/Legislation/B26-0661) support the application and effective dates, as checked in the prior review; [Pub. L. 119-78](https://www.govinfo.gov/content/pkg/PLAW-119publ78/html/PLAW-119publ78.htm) names Act 26-217, the [White House statement](https://www.whitehouse.gov/briefings-statements/2026/02/congressional-bills-h-j-res-142-and-s-3705-signed-into-law/) calls it nullified, and the [District Attorney General's opinion](https://oag.dc.gov/sites/default/files/2026-02/AG-Opinion-Decoupling-Retroactivity-and-Validity-.pdf) reaches the contrary conclusion. The record's distinction between the contested temporary act and the later permanent law is accurate.

## Item 4 — approve

`state-enacted-tax-year-figures` and its worksheet now qualify nominal carry-forward. `tax/stateEnactedLaw.ts#statutorilyIndexedStandardDeduction` implements Washington's deduction every second year from 2029, rounded to the nearest $1,000, and DC's annually from 2027 through 2029, cumulative from the 2026 loaded amount and rounded down to $50; the DC record discloses the model's indexing-vintage difference from the statute. `params/state/index.ts#conformStateStandardDeduction` follows the federal deduction for Maine from 2027 and DC from 2030, as the enacted-year data tags specify. The record's rounding prose names both indexed deductions and does not call them nominal. Its formula's `rounding: 'none'` describes the enacted-field overlay, while the statement and worksheet give the separate deduction-rounding behavior.

## Nebraska record — approve

`neb-rev-stat-77-2715-03-3-indexed-brackets-held-nominal` now expressly excepts both Washington's and DC's statute-indexed deductions and identifies Maine's and DC's later federal conformity. Its pinned Nebraska example remains an unprojected bracket approximation: [Neb. Rev. Stat. §77-2715.03(3)](https://www.nebraskalegislature.gov/laws/statutes.php?statute=77-2715.03) requires annual CPI-U adjustment and nearest-$10 rounding, while the loaded bracket thresholds stay fixed in the engine's projection.
