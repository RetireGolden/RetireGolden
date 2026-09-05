## 11. Withdrawal sequencing (modeling conventions)

- Default: cash buffer → taxable (basis-ratio gains) → traditional → Roth; HSA reserved for medical. RMDs always first.
- HSA withdrawals are qualified (tax- and penalty-free) only up to modeled medical costs when the account opts into the cap treatment (§16); otherwise the legacy simplification (tax-free, 20% penalty pre-65) or the explicit "assume all qualified" mode applies.
- Pre-59½ access ordering: taxable → Roth contributions/seasoned conversions → 72(t)/Rule of 55 (**implemented**) → penalized deferred as last resort. Account-movement eligibility (withdraw/convert/RMD/penalty) is centralized in `engine/strategies/accountEligibility.ts` (§16).
- **Roth withdrawal ordering.** Roth withdrawals use regular contributions, then conversion/rollover
  contributions first-in, first-out, and finally earnings
  (`irc-408A-d-4-B-roth-distribution-ordering`). Within a partially withdrawn conversion layer, the
  current engine prorates taxable principal rather than consuming it first; that known approximation can
  understate the additional tax (`irc-408A-d-4-B-converted-layer-taxable-portion-first`). Likewise the engine
  keeps one layer per named conversion action in array order, so same-year conversions are not aggregated
  taxable-portion-first; that second registered approximation can also understate the additional tax
  (`irc-408A-d-4-B-same-year-conversion-aggregation`).
- **SEPP (72(t)) divisors and scope.** Both supported methods — required-minimum-distribution and amortization —
  divide by the **IRS Single Life Table** carried in the parameter pack (Treas. Reg. 1.401(a)(9)-9(b) Table 1,
  unisex and fixed by regulation rather than indexed), which is why nothing in the SEPP path takes a sex; the
  sex-dependent SSA period table is now used only by the Monte Carlo longevity model
  (`notice-2022-6-3-02-a-permitted-life-expectancy-tables`). Fixed annuitization is not a projection method. A SEPP
  on an **employer plan** requires separation from service under 72(t)(3)(B) — the series must begin strictly
  after separation. The evidence layer requires an explicit separation date and refuses without one; the annual
  ledger proves it from the owner's plan retirement age, a year-granularity proxy recorded as `approximated`
  (`irc-72-t-3-B-sepp-separation-annual-proxy`). IRAs are exempt from the test, as the statute provides. A
  qualifying series must continue without a disqualifying modification through the later of five years from its
  first payment or age 59½ under [IRC §72(t)(4)](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section72&num=0&edition=prelim);
  that later-of window and the payment-date proof requirement are settled
  (`irc-72-t-4-sepp-modification-proof-window`). Only the recapture tax after a modification remains out of
  scope (`irc-72-t-4-sepp-modification-recapture`).
- **Employer-plan NUA.** The Plan and retirement-action contracts carry no employer-security or
  net-unrealized-appreciation fact, no NUA lump-sum qualification fact, and no NUA elect-out (the pension
  lump-sum election and spousal elections are unrelated structures). They therefore cannot model the gross-income exclusion for NUA in
  employer securities under [IRC §402(e)(4)(B)](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section402&num=0&edition=prelim),
  or an NUA-adjusted section 72(t) base — a base from ordinary-income character still exists
  (`irc-402-e-4-B-lump-sum-employer-securities-nua-exclusion`).
- Research consensus: naive "taxable-then-deferred-then-Roth" is beaten by bracket-aware blends (fill low brackets from traditional every year); this motivates the bracket-targeted strategy and the LP optimizer (see [features/optimizer.md](../../features/optimizer.md) and the Owl oracle).
- The optimizer recommendation is **optimal on the exact ledger to tolerance** (2026-07-08): the MILP models taxable-SS phase-in (`irc-86-a-optimizer-taxable-social-security-linearization` — omits the half-benefit plateau and 85%-of-benefits cap and freezes near-cap baselines; exact ledger re-prices), IRMAA 2-year lookback, taxable-gain realization, and state brackets in-solve; an exact-ledger convergence loop re-linearizes around the incumbent; and the exact-ledger tournament (windowed bracket fills, top-two + MILP-winner local search) arbitrates and gates everything. The dev-only Owl parity harness (`pnpm owl-parity`) measures RetireGolden at-or-above Owl on every fixture.
- **An aggregate schedule is still vetoed; a named one can be published.** A schedule carrying only a year and a
  household amount names no owner, source account, or destination, so every one that would convert a positive
  amount is vetoed `identityIncomplete` before publication. What lifts the veto is not a different amount but a
  different kind of schedule: the promotion loop turns a vetoed winner into named retirement-action requests,
  prices them on their own exact-ledger run, and the tournament publishes the promoted candidate when it is
  cent-identical to the aggregate winner or, being a different projection, earns a recommendation on its own
  metrics. A solver winner is never promotable, because the provenance the comparator requires of one is
  provenance no adapter-minted request can carry. With nothing published the veto stands and the tournament falls
  back to the plan's incumbent conversions. Separately, `buildOptimizerInput` now admits an action-bearing plan —
  the LP nets committed action movement into its per-year balance recursion (`committedActionMovement`) — while
  the typed `optimizerUnsupportedRetirementActions` predicate remains the Optimize page's own gate, returning an
  `optimizer-retirement-action-unsupported` reason that surface must check before dispatching. The LP models no
  income consequence of a committed action: a named-conversion year understates the solve's tax by the tax on the
  converted amount, and `strategies.qcdAnnual` has no LP term at all.
