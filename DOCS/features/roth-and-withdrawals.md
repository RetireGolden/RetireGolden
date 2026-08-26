# Roth conversions and withdrawal strategy

How RetireGolden decides which dollars to spend and which to convert — the levers that drive most of the
tax planning value. Conversions and withdrawals share an engine seam: each strategy is a **pure function**
that emits a per-year schedule fed into the same `simulate` ledger (see [standards.md](../standards.md)),
which is also how the [optimizer](optimizer.md) plugs in as "just another strategy provider."

**Code:** [engine/strategies/](../../packages/engine/src/strategies/) (`rothConversion.ts`, `optimizer.ts`,
`sepp.ts`, `inheritedIra.ts`); withdrawal sequencing and the tax fixed-point in
[engine/projection/simulate.ts](../../packages/engine/src/projection/simulate.ts); UI in
[planner/sections.tsx](../../packages/planner-ui/src/planner/sections.tsx) (Strategy) and
[planner/OptimizePage.tsx](../../packages/planner-ui/src/planner/OptimizePage.tsx).

## Roth conversions

Two modes:

1. **Manual** — per-year conversion amounts (or a range of years × amount), instantly reflected in the
   tax / IRMAA / ACA outputs.
2. **Fill-to-target strategy** — `sizeRothConversion` bisects each year's conversion up to a chosen
   ceiling: top of a tax bracket (12/22/24…), an IRMAA tier edge, the ACA 400% FPL cliff, or a fixed MAGI.

Both are **aggregate**: a schedule is a year and a household amount, and nothing else. A named `rothConversion`
retirement action is the identity-bearing path — it names the owner, the source accounts, and the destination
Roth, and the annual ledger commits it
([taxes.md § Named Roth-conversion actions](taxes.md#named-roth-conversion-actions)).

Conversions are taxable ordinary income with **no** early-withdrawal penalty; the engine prefers paying
the tax from taxable funds and warns if it would come from the conversion pre-59½. In an RMD year the RMD
is satisfied *before* converting. Every interaction is surfaced explicitly: SS taxation, IRMAA (+2-year
lookback), ACA PTC, NIIT, the senior-deduction phase-out, the **widow's penalty** (the survivor files
single, into tighter brackets), and reduced future RMDs. A **convert-vs-don't** comparison shows lifetime
taxes and ending after-tax wealth side by side. Roth conversion recapture under §408A(d)(3)(F) is
computed by `splitRothWithdrawal` (with the age-60 proxy for the qualified distribution age), and the
taxable-portion-first gap inside a converted layer is the registered approximated divergence
(`irc-408A-d-4-B-converted-layer-taxable-portion-first`). Roth withdrawal character follows regular
contributions, then conversion/rollover contributions first-in, first-out, and then earnings
(`irc-408A-d-4-B-roth-distribution-ordering`).

For a partial early withdrawal from a conversion layer with both taxable and nontaxable principal, the current
engine prorates the taxable principal rather than consuming it first, which can understate the additional tax
(`irc-408A-d-4-B-converted-layer-taxable-portion-first`). Same-year conversions are likewise kept as one layer
per named action in array order rather than aggregated taxable-portion-first, a second registered approximation
that can understate the additional tax (`irc-408A-d-4-B-same-year-conversion-aggregation`).

For a true multi-year co-optimization of conversions and withdrawals, see [optimizer.md](optimizer.md);
the fill-to-target strategies here cover most of the practical value without a solver. They also double as
**candidate generators** for the shared [decision engine](../../packages/engine/src/decisions/)
(the `ledger-native-decision-engine` plan): the optimizer's
exact-ledger tournament runs these same simple strategies against the solver's schedule and recommends
whichever the exact ledger prices best — RetireGolden compares candidate strategies on the exact projection
ledger rather than trusting any single generator's claim of optimality.

## Withdrawal strategy

When spending exceeds income in a year, the engine drains accounts per the chosen strategy:

- **Sequential** (default): cash buffer → taxable (basis-ratio gains) → traditional → Roth; HSA reserved
  for medical.
- **Proportional** across account types.
- **Bracket-targeted**: take traditional up to a bracket ceiling, the remainder from taxable/Roth — pairs
  naturally with the conversion strategies.

Always overlaid with two hard rules: **RMDs first** (mandatory, forced into income whether or not spending
needs them — excess reinvested into taxable), and **penalty avoidance pre-59½** where possible. Early
access before 59½ is ordered taxable → Roth contributions/seasoned conversions → **72(t) / Rule of 55**
SEPP schedules ([strategies/sepp.ts](../../packages/engine/src/strategies/sepp.ts)) → penalized deferred
withdrawals only as a last resort. Inherited accounts honor the **10-year drain**
([strategies/inheritedIra.ts](../../packages/engine/src/strategies/inheritedIra.ts)) and are not treated as
Roth-convertible owner assets. All of these movement rules — convertibility, RMD applicability, spendability,
and the penalty rate — are answered by the shared account-eligibility service
([strategies/accountEligibility.ts](../../packages/engine/src/strategies/accountEligibility.ts)), so the ledger,
the optimizer input builder, and the decision generators can never disagree.

The named conversion path refuses inherited-IRA sources with unchanged balances
(`irc-408-d-3-C-i-inherited-ira-rollover-bar`).

An in-plan Roth transfer of an otherwise nondistributable employer-plan amount is a different,
plan-optional action from a Roth-IRA conversion. RetireGolden cannot represent the sponsoring
plan's feature, same-plan identity, or the transferred amount's retained distribution restriction
(`irc-402A-c-4-E-in-plan-roth-transfer-not-modeled`). It likewise does not represent the
employer-plan employee-contribution/basis and plan-permission facts of a commonly called
mega-backdoor Roth path (`irc-401-m-employee-contribution-mega-backdoor-roth-not-modeled`).

An HSA left last for medical is qualified (tax- and penalty-free) only up to modeled medical costs when the
account opts into the cap treatment, and an optional **taxable safety-net floor**
(`strategies.taxableSafetyNetFloor`) keeps a minimum cash/taxable reserve intact — spending funds from other
account types first, and fill-to-target conversions are trimmed so their tax bill never forces a breach. See
[taxes.md § Account depth](taxes.md#account-depth-hsa-nondeductible-basis-property-sales).

### Identity-bearing ordinary withdrawals

`strategies.retirementActions` can name a person, stable source account, exact-cent allocation, year,
optional execution date, and same-day sequence. The annual ledger currently executes individually owned
cash and vested equity-compensation sources in one deterministic chronological stream. Cash produces cash
principal; equity compensation uses the explicit planning boundary
`fullyTaxableCompensationAtExecution`, so the complete executed amount is ordinary income and never a
capital gain. A `final` equity-comp account supplies explicit already-vested evidence without inventing a
historical vest date; a cliff account requires an exact execution date on or after its recorded vest date.

The public pure taxable-source classifier and executor support one individually owned brokerage
allocation. The classifier snapshots explicit 1/1 beneficial ownership and caller-supplied immutable tax-unit evidence,
then applies `planningAggregateBasisRatio` with bigint rational arithmetic and one
`nearestCentHalfUp` basis recovery.
Basis return plus the signed gain or loss residual reconcile exactly to executed principal, including
basis-above-value loss positions and safe inputs whose intermediate product exceeds JavaScript's safe-integer
range. Direct executor callers supply separate exact-cent opening balance and basis snapshots. The executor
stages both together, commits both or neither, and emits a no-ratio zero arm for a depleted taxable sibling
without inventing a denominator. Joint ownership and stale positive basis at zero fair-market value remain
fail-closed.

The executor stages a whole action before movement, preserves partial and zero-allocation evidence, debits
each stable source ID once, and feeds proceeds and equity ordinary income once into the same
tax/ACA/conversion fixed point. The annual projection constructs those snapshots itself for a named,
individually owned taxable source whenever the year's tax unit is unambiguous, so the signed capital result
crosses into the annual model once (see [taxes.md § Taxable ordinary-withdrawal actions](taxes.md#taxable-ordinary-withdrawal-actions)).

Three named kinds now move dollars inside the annual ledger — ordinary withdrawals, Roth conversions, and
QCDs — and the optimizer probe reports each one's committed cents per account. Directly owned traditional
IRA, Roth, and HSA *withdrawals* are not among them: the ordinary-withdrawal executor's source scope is cash,
vested equity compensation, and taxable brokerage, and anything else is refused
`withdrawal-source-type-unsupported` with the balance unchanged. An employer plan is refused as a named source
on every arm. A withdrawal whose purpose is to fund a linked conversion's tax is no longer fail-closed: it
moves as one leg of an atomic group, described in
[taxes.md § Conversion-linked tax funding](taxes.md#conversion-linked-tax-funding).

NUA is not an action kind or withdrawal character: the Plan and retirement-action contracts carry no
employer-security or net-unrealized-appreciation fact, no NUA lump-sum qualification fact, and no NUA
elect-out (the pension lump-sum election and spousal elections are unrelated structures), so employer-plan
withdrawals cannot be presented as the NUA exclusion in
[IRC §402(e)(4)(B)](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section402&num=0&edition=prelim)
(`irc-402-e-4-B-lump-sum-employer-securities-nua-exclusion`).

A `legacyAggregate*` request is an action that names an amount and a year but no identities, and carries
`provenance.source: 'migration'` by schema. Nothing in the engine mints one — they arrive in a plan document, and
the plan migration only assigns a stable action ID to any that lacks one. They move nothing, and the annual
movement coordinator excludes them from every current-year batch, until a person reviews one.
`reviewAndReplaceRetirementActionManually`
([actions/retirementActionManualReview.ts](../../packages/engine/src/actions/retirementActionManualReview.ts))
omits the target from the plan *first*, allocates the replacement's identity against that target-free plan so
nothing is inferred from what it replaces, splices the result back at the original index, and re-validates the
whole plan before returning it; the editor then commits the new action list in one write. Aggregate withdrawals
and aggregate conversions can be replaced this way. Aggregate QCDs cannot — there is no canonical allocator arm
for one, so they report `manualReviewRequired` and stay put.

## The tax / withdrawal circularity

Withdrawing to cover spending generates tax, which raises the amount that must be withdrawn — a circular
dependency the engine resolves with a **fixed-point iteration** each year (it converges in a few rounds).
This is why withdrawals and taxes can't be separate passes, and why a strategy only ever proposes a
schedule that the real ledger then prices exactly.

## Related

[taxes.md](taxes.md) (the engine these strategies optimize against) · [optimizer.md](optimizer.md) ·
[social-security.md](social-security.md) (claim timing interacts with the bridge-years conversion play).
