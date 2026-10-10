# Review, 2026-10-10 (census-completion-recheck-codex)

Reviewer: Codex (GPT-6-Sol), headless and read-only, by independent recomputation from the code without executing the engine, on a snapshot of RetireGolden branch `claude/census-completion` at `558651200`. The work was done by Claude (Opus). Scope: a re-check of `estate-account-breakdown` after the first review rejected two wording points (the HSA limit and the evidence's branch coverage). Verdicts: 1 approve, 0 reject. The only edits to the report below replace local snapshot paths with repository paths and drop the snapshot's `engine/` prefix. Verbatim output follows.

---

# Independent calculation-record review

Reviewer: Codex GPT  
Date: 2026-10-10  
Commit: `558651200`

## `estate-account-breakdown` — approve

The prior HSA wording defect is fixed. The limit now calls the full ending balance of a non-spouse HSA its **taxable base** `B` and says heir tax applies to the non-charity share, `B × (1 − charityFraction) × r`. This matches `summarizeProjection` and `estateHsaIncomeBase`: a charity destination gives the HSA a gross-balance base, then reduces the heir-tax calculation by the charity fraction. For example, at a $40,000 balance, 25% charity share and 24% HSA rate, the base is $40,000 and heir tax is $7,200.

The evidence now identifies two cases it does not exercise: a spouse-designated HSA and an HSA left partly to charity. The worksheet, record and CHANGELOG describe the as-built example and its variations without claiming complete branch coverage.

I found no further inaccuracy in this record against `projection/compare.ts#summarizeProjection` and its cited helpers. The account selection and order, destination defaults, traditional basis allocation, class rates, charity calculation, zero-balance omission, row totals and worked figures agree with the implementation. This is a read-only record review; I did not run tests.
