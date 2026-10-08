# Review, 2026-10-08 (pooled-election-rmd-codex)

Reviewer: Codex (GPT-6-Sol), headless and read-only, by independent recomputation from the cited primary sources without executing the engine, on a snapshot of branch `claude/queued-0.4.2` at `93e0aa87b`. The work was done by Claude (Opus). Scope: the pooled spousal-election RMD fixes (each elected IRA on its own prior December 31 balance; a pre-election distribution counted once), recomputed from Treas. Reg. 1.408-8 and 1.402(c)-2(j)(4). Verdicts: 5 approve, 0 reject. The reviewer's scripts are published at `DOCS/calculations/reviews/scripts/pooled-election-rmd-2026-10-08-codex/`; they run with Python 3 and import nothing from this repository. The only edits to the report below replace local snapshot paths with repository paths. Verbatim output follows.

---

# Independent review: pooled spousal-election RMDs

Reviewer: Codex GPT · headless, read-only review · 2026-10-07 · snapshot commit `93e0aa87b`

Method: I read the specified changelog, rules, worksheet, tests, schema, adapter, and planner. I did not run or import the engine or its tests. Arithmetic below comes from my standalone Python `Decimal` script at [scratch/recompute.py](scripts/pooled-election-rmd-2026-10-08-codex/recompute.py); dollars are displayed to cents, while comparisons use unrounded quotients. The controlling sources are [Treas. Reg. §1.408-8](https://www.ecfr.gov/current/title-26/section-1.408-8), [Treas. Reg. §1.402(c)-2](https://www.ecfr.gov/current/title-26/section-1.402(c)-2), [Treas. Reg. §54.4974-1](https://www.ecfr.gov/current/title-26/section-54.4974-1), and [IRS Publication 590-B, Table III](https://www.irs.gov/publications/p590b). The Uniform Lifetime divisor at age 75 is 24.6.

## 1. Own balance — approve

Section 1.408-8(c)(3) switches the election-year calculation to the spouse as owner; (b)(2) selects **each IRA's own preceding December 31 balance**; (e)(1)(i) calculates each IRA separately and permits the sum to be paid from one or more eligible IRAs. For prior balances $100,000 and $29,600, the requirements are $100,000 / 24.6 = **$4,065.04** and $29,600 / 24.6 = **$1,203.25**; the unrounded total $129,600 / 24.6 is **$5,268.29**. Applying the $100,000 reference to both would give **$8,130.08**, an overstatement of **$2,861.79**. With no prior distributions and no returns in the fixture, the forced total is $5,268.29 and the year-end balances are **$95,934.96** and **$28,396.75**. The adapter ignores a shared reference for a multi-IRA pool and the planner divides each restored balance separately, as required.

## 2. Counted once — approve

For entered balances $99,000 and $29,600, with $1,000 already paid, the worksheet assigns that unnamed payment to the first IRA. Its reconstructed prior balance is $100,000; the second's is $29,600. The requirements remain **$4,065.04 + $1,203.25 = $5,268.29**. Crediting $1,000 only once leaves forced draws of **$3,065.04** and **$1,203.25**, or **$4,268.29** total. The calendar-year distribution is $1,000 + $4,268.29 = **$5,268.29**; the §4974 shortfall and excise are **$0**. Year-end balances are **$95,934.96** and **$28,396.75**. Sections 1.408-8(b)(3) and (e)(1)(i), together with 1.402(c)-2(f)(1), support counting one actual distribution once toward the owner's aggregate calendar-year requirement. Section 1.402(c)-2(j)(4) governs a particular spouse catch-up situation; it does not create a second credit here. The adapter returns the shared payment for each pool member, but the planner reads it from the pool's first member once. The published §4974 obligation sums the credited and forced dollars correctly in this fixture. The per-IRA allocation is conditional on the worksheet's first-IRA convention because the shared fact does not identify the paying IRA; the **pool total is independent of that allocation**.

## 3. Add-back — approve

Section 1.408-8(b)(2) measures the balance at the *preceding* December 31 and expressly makes no ordinary adjustment for distributions afterward. Reconstructing that historical balance from a later, already-debited entered balance therefore requires adding a current-year payment back **if no other intervening balance changes are assumed**. The existing election tests explicitly say the $99,000 entered balance nets the $1,000 paid, and `simulate.ts` seeds the account's live balance from `account.balance` without replaying that historical payment. The plan schema supplies a nonnegative `balance` but does not give it a December 31 valuation date; the UI labels it simply “Balance.” Thus the add-back is correct for the fixture and for this entry convention, not a general legal identity for every real account. For a lone IRA with no positive reference: $99,000 + $1,000 = **$100,000** prior balance, owner RMD **$4,065.04**, remaining forced amount **$3,065.04**, year-end **$95,934.96**. Omitting the add-back would yield **$4,024.39** from $99,000 / 24.6. A lone IRA's positive explicit reference instead controls, which also matches the established tests.

## 4. Other cases — approve

| Fixture | Prior balances | Credited payment | Forced draws | Year-end balances | §4974 shortfall |
|---|---:|---:|---:|---:|---:|
| $5,000 before election; live $95,000 and $29,600 | $100,000; $29,600 | $5,000 once: $4,065.04 first, $934.96 second | $0; **$268.29** | $95,000; **$29,331.71** | $0 |
| Completed $1,000 history row on second; live $100,000 and $28,600 | $100,000; $29,600 | $1,000 second; shared figure suppressed | **$4,065.04**; **$203.25** | **$95,934.96**; **$28,396.75** | $0 |

Both cases have total requirement **$5,268.29** and total calendar-year distribution **$5,268.29**. The first case tests carryover of a payment exceeding the first IRA's requirement. The second tests that a named history payment is restored to that IRA's prior balance and is not duplicated by the shared input. These figures agree with the stated test expectations and planner branch logic.

## 5. Limits — approve

The three stated limits accurately describe the code. First, `opening + accepted distribution` cannot recover intervening investment gains or losses, and can also miss other intervening flows; a lone IRA's positive reference can supply an independently observed prior balance, while a pooled shared reference cannot establish every member's balance. Second, any completed current-year history row in a pool suppresses the shared pre-election figure for **the entire pool**. That prevents a duplicate if they describe the same payment, but can overstate the forced draw if the shared figure represents an additional payment. Third, the planner caps each unpaid draw at that IRA's own live balance and does not redirect the remainder to another IRA; §1.408-8(e)(1)(i) permits that other IRA to satisfy the total, so a modeled §4974 shortfall can be overstated. These are disclosed limitations, not properties demanded by the regulation. Also, assigning an unnamed payment to the first IRA preserves the aggregate requirement at a common divisor but does not prove each account's individual prior balance or payment source.
