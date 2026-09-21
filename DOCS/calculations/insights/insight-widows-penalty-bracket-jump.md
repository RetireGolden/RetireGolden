## Claim

Kind: model. `insights/detectors/widowsPenalty.ts#widowsPenalty.screen` publishes a rough real bracket jump for the plan's first single-filed survivor year as federal tax on that year's MAGI under Single status minus federal tax on the same MAGI under married-filing-jointly status, then deflates that difference to today and rounds it with `Math.round` before publishing.

## Justification

Holding income fixed and changing only filing status isolates the modeled survivor bracket effect; `J_today=(Tax_single(M)-Tax_joint(M))*d`. The screen is intended to identify a conversion-planning question for a trad-heavy MFJ couple without conversions, not to forecast the survivor's actual return or include SSA-44 relief, deductions or income changes beyond what the two upstream tax computations already price. The domain requires a first single-filed survivor year and finite comparable tax results.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| First single-filed survivor year | 2040 | calendar year |
| MAGI held constant | 150,000 | 2040 nominal dollars |
| Federal tax computed as Single | 28,000 | 2040 nominal dollars |
| Federal tax computed as MFJ | 18,000 | 2040 nominal dollars |
| Deflation factor to today | 4/5 | ratio |

## Arithmetic

Nominal bracket jump `=$28,000-$18,000=$10,000`. Today-dollar jump `=$10,000*(4/5)=$8,000`.

## Expected

The exact derived rough survivor bracket jump is `$8,000.00` in today's dollars. The published card figure equals that derived value and is shown as `"$8,000"`, with exact tolerance on the published figure.

## Wrong readings

- Omitting deflation reports `$10,000.00`.
- Reversing filing-status order reports `-$8,000.00`.

## Family

outputs: `insight-widows-penalty-bracket-jump`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18.md in this directory.

Revision: The published-figure statement was added on the pull-request review's finding. The Claim's closing phrase, which said the deflated jump had no stated rounding, was corrected on the pull-request review's second finding (2026-09-21) to the production `Math.round` the record's statement and rounding fields already give; no expected value changed.
