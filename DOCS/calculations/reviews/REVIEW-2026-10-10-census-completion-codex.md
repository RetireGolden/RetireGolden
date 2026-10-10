# Review, 2026-10-10 (census-completion-codex)

Reviewer: Codex (GPT-6-Sol), headless and read-only, by independent recomputation from the code without executing the engine, on a snapshot of RetireGolden branch `claude/census-completion` at `c8dd810b4` and RetireGolden-MCP at `b2c7f717` (paths under `mcp/` are RetireGolden-MCP's). The work was done by Claude (Opus). Scope: the three calculation records of the output census completion (D-MCP-CENSUS-PIN): `estate-account-breakdown` and `projection-summary-savings-rate-annual` (new) and the restatement of `sustainable-spending-bisection`, with their census selectors against RetireGolden-MCP b2c7f717. Verdicts: 2 approve, 1 reject. The reviewer's scripts are published at `DOCS/calculations/reviews/scripts/census-completion-2026-10-10-codex/`; they run with Python 3 and import nothing from either repository. The only edits to the report below replace local snapshot paths with repository paths and drop the snapshot's `engine/` prefix. Verbatim output follows.

---

# Independent calculation-record review

Reviewer: Codex GPT; headless, read-only. Date: 2026-10-10. Snapshots: RetireGolden `c8dd810b4` (branch `claude/census-completion`, based on main `43876e8d`); RetireGolden-MCP `b2c7f717` (0.12.0).

I read the record modules, worksheets, mutation receipts, evidence fixtures, implementation arithmetic, census rows, and MCP adapter. I did not run either test suite or import from `packages/`. The independent standard-library Python Decimal recomputation is in [scratch/recompute.py](scripts/census-completion-2026-10-10-codex/recompute.py). All figures below come from that script and the stated inputs, not from executing the engine.

## `estate-account-breakdown` — reject

`selectedLogicalBalanceAccounts` keeps balance-account IDs in first insertion order, and `summarizeProjection` skips accounts with nonpositive last-row balances. It maps equity compensation to `taxable`, computes the traditional base as `max(0, G − min(N,T) × G/T)` for positive `T`, assigns a non-spouse HSA its gross balance as base, and applies the destination, charity fraction, class rate, and net formulas stated in the record. The last-row category total supplies `T`; annuities and pensions never enter this selection.

Independent results (dollars; columns are gross, taxable base, charity, heir tax, net to heirs):

| Case and row | Gross | Base | Charity | Tax | Net |
|---|---:|---:|---:|---:|---:|
| 1 cash | 315,000 | 0 | 0 | 0 | 315,000 |
| 1 traditional IRA, spouse | 915,000 | 915,000 | 0 | 0 | 915,000 |
| 1 401k, non-spouse | 310,000 | 310,000 | 0 | 86,800 | 223,200 |
| 1 Roth | 50,000 | 0 | 0 | 0 | 50,000 |
| **1 sum** | **1,590,000** | **1,225,000** | **0** | **86,800** | **1,503,200** |
| 2 cash | 315,000 | 0 | 0 | 0 | 315,000 |
| 2 traditional IRA, spouse | 915,000 | 878,400 | 0 | 0 | 915,000 |
| 2 401k, charity 25% | 310,000 | 297,600 | 77,500 | 71,424 | 161,076 |
| 2 HSA, non-spouse | 40,000 | 40,000 | 0 | 9,600 | 30,400 |
| 2 RSUs, taxable category | 20,000 | 0 | 0 | 0 | 20,000 |
| **2 sum** | **1,600,000** | **1,216,000** | **77,500** | **81,024** | **1,441,476** |

In case 2, `T=1,225,000` and `N=49,000`, so the basis share is 4%; the IRA and 401k bases are 878,400 and 297,600. The 401k tax is `297,600 × 0.75 × 0.32 = 71,424`. The HSA uses 24%; the other case-2 rates are 32% for traditional and 28% otherwise. Case 1 uses 28% throughout. The zero-balance Roth disappears in case 2. The single-premium SPIA's charity designation does not enter any estate row or estate total: changing that designation alone changes no figure computed by this estate path. The record correctly limits the row sum to investable balances and describes the household basis allocation and HSA reduction omission.

**Reason for rejection:** the record's HSA limit says an HSA left to anyone but the spouse “is taxed on its whole ending balance.” The code gives it a **taxable base** equal to its gross balance, then taxes only `B × (1 − charityFraction)` for a charity destination. An allowed HSA with a $40,000 ending balance, 25% charity share, and 24% heir rate has a $40,000 base, $10,000 to charity, and **$7,200** heir tax, rather than $9,600 on the whole base. The limit should distinguish the base from the tax-bearing non-charity slice. Separately, the evidence description “every branch” overstates coverage: it does not exercise a spouse-designated HSA, among other branches. These wording defects do not change the two worked tables.

All four family selectors in `output-families.json` exist at the MCP pin: `run_projection.summary.estateBreakdown[].{taxablePretaxBase,heirTax,charityAmount,netToHeirs}` and the same four fields in each `compare_scenarios.a` and `.b` summary. The adapter returns `snapshotJson(summary)` for `run_projection` and the full `sa` and `sb` summaries for `compare_scenarios`; the engine breakdown rows contain each field.

## `projection-summary-savings-rate-annual` — approve

`summarizeProjection` maps ledger rows in order, retaining each year. It adds `contributions + employerMatch + surplusInvested`, divides by `incomes.total` only when that total is positive, multiplies by 100, and clamps to `[0,100]`; otherwise it returns zero. The ledger's `incomes.total` sums the income components named in the record. There is no rounding.

| Year | Savings / income | Raw rate | Published `ratePct` |
|---|---:|---:|---:|
| 2026 | 13,000 / 65,000 | 20 | 20 |
| 2062 | 0 / 0; guard applies | undefined without guard | 0 |
| 2070 | 6,000 / 24,000 | 25 | 25 |
| 2076 | 30,000 / 24,000 | 125 | 100 |

The 2026 match is `min(6,000, 4% × 65,000) = 2,600`, making savings `9,000 + 2,600 + 1,400 = 13,000`. These are constructed ledger rows based on the example's inputs; the worksheet correctly avoids claiming they are simulated years of that plan. The zero-income and upper-clamp limits match the code. The census selector `savingsRates[].ratePct` exists in the full summary returned as `run_projection.summary`, `compare_scenarios.a`, and `compare_scenarios.b`.

## `sustainable-spending-bisection` — approve (2026-10-10 restatement)

The solver rounds the current base to the seed, subject to the required floor. For these inputs the seed is 40,000 and passes; its first doubling probe is `max(2 × 40,000, 20,000) = 80,000` and fails. `Math.round((lower+upper)/2)` then probes 60,000 (passes) and 70,000 (fails), producing the worksheet's initial `[60,000,70,000]` bracket. For the nonnegative dollar values here, `Math.round` takes a half-dollar upward. The independent Decimal search gives:

| Resolution | Probes after `[60,000,70,000]` (P/F) | Final bracket | `feasibleBaseAnnual` | `maxBaseAnnual` | Slack | Converged |
|---|---|---|---:|---:|---:|---|
| $1,000 | 65,000 F; 62,500 P; 63,750 F; 63,125 F | [62,500, 63,125], width 625 | 62,500 | 62,500 | 22,500 | true |
| $100 | same four; 62,813 P; 62,969 P; 63,047 F | [62,969, 63,047], width 78 | 62,969 | 62,900 | 22,900 | true |

The decisive half-sum is `62,812.5`, rounded to 62,813. The next two integer midpoints are 62,969 and 63,047. The highest passing probe is therefore 62,969, and the fixed-target, no-floor case publishes its $100 floor, 62,900; slack is measured from the published amount. Case 1's four probes and its prior figures remain 62,500, 62,500, and 22,500, consistent with the earlier Grok review. The restatement's limits are borne out by the code: feasibility rejects diagnostic/depleted probes and estates below the inflated floor; the budget may stop convergence; a required floor constrains downward probes; and guardrail nonmonotonicity can prevent the $100 floor from being published without a successful check. `feasibleBaseAnnual` is the highest **observed** passing level, not a guarantee of the global maximum under guardrails. The unpriced ACA disclosure behavior is also represented in the solver's evaluation options and result diagnostics.

The new census family's `solve_max_spending.feasibleBaseAnnual` selector is a field explicitly returned by the MCP adapter from the engine result at `b2c7f717`.
