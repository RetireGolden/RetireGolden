# Review, 2026-10-10 (census-completion-savings-recheck-codex)

Reviewer: Codex (GPT-6-Sol), headless and read-only, by independent recomputation without executing the engine, on a snapshot of RetireGolden branch `claude/census-completion` at `c396d558b`. The work was done by Claude (Opus). Scope: a re-check of `projection-summary-savings-rate-annual` after the RetireGolden#791 review added a fifth evidence row (2074, with a pension) and reworded the wrong readings. Verdicts: 1 approve, 0 reject. The only edits to the report below replace local snapshot paths with repository paths and drop the snapshot's `engine/` prefix. Verbatim output follows.

---

# Independent review

Reviewer: Codex GPT  
Date: 2026-10-10  
Snapshot commit: `c396d558b`

## projection-summary-savings-rate-annual — approve

`projection/compare.ts#summarizeProjection` adds `contributions + employerMatch + surplusInvested`, divides by `incomes.total` and multiplies by 100 when income is positive, clamps the result to [0, 100], and otherwise returns 0. It emits one entry per input row in row order.

| Year | Savings arithmetic | Income | Raw rate | Expected ratePct |
|---|---:|---:|---:|---:|
| 2026 | 9,000 + 2,600 + 1,400 = 13,000 | 65,000 | 20 | 20 |
| 2062 | 0 | 0 | guarded | 0 |
| 2070 | 6,000 | 24,000 | 25 | 25 |
| 2074 | 6,000 | 30,000 | 20 | 20 |
| 2076 | 30,000 | 24,000 | 125 | 100, clamped |

The evidence sets 2074 wages to 0, Social Security to 24,000, and pension to 6,000; its row builder sets `incomes.total` to their sum, 30,000. Wages plus Social Security is only 24,000, which would produce 25 instead of 20. The test reads the five expected rates from the worksheet and checks the emitted years and rates.

All wrong readings have the stated outcomes: omitting the 2026 match gives 10,400 / 65,000 × 100 = 16; omitting surplus gives 11,600 / 65,000 × 100 = 17.846153... in 2026 and 0 in 2070; a wages-only denominator with the income guard gives 0 in 2070; wages plus Social Security gives 25 in 2074; reporting the share as a fraction gives 0.2 in 2026; omitting the clamp gives 125 in 2076; and omitting the zero-income guard gives 0 / 0 in 2062, which is not a number. The mutation receipt removes employer match and records the resulting 2026 rate of 16 against the worksheet's 20.

Reviewed by independent arithmetic and source inspection. No tests were run.
