# Roth conversions and withdrawal strategy

How RetireGolden decides which dollars to spend and which to convert — the levers that drive most of the
tax planning value. Conversions and withdrawals share an engine seam: each strategy is a **pure function**
that emits a per-year schedule fed into the same `simulate` ledger (see [standards.md](../standards.md)),
which is also how the [optimizer](optimizer.md) plugs in as "just another strategy provider."

**Code:** [engine/strategies/](../../app/src/engine/strategies/) (`rothConversion.ts`, `optimizer.ts`,
`sepp.ts`, `inheritedIra.ts`); withdrawal sequencing and the tax fixed-point in
[engine/projection/simulate.ts](../../app/src/engine/projection/simulate.ts); UI in
[planner/sections.tsx](../../app/src/planner/sections.tsx) (Strategy) and
[planner/OptimizePage.tsx](../../app/src/planner/OptimizePage.tsx).

## Roth conversions

Two modes:

1. **Manual** — per-year conversion amounts (or a range of years × amount), instantly reflected in the
   tax / IRMAA / ACA outputs.
2. **Fill-to-target strategy** — `sizeRothConversion` bisects each year's conversion up to a chosen
   ceiling: top of a tax bracket (12/22/24…), an IRMAA tier edge, the ACA 400% FPL cliff, or a fixed MAGI.

Conversions are taxable ordinary income with **no** early-withdrawal penalty; the engine prefers paying
the tax from taxable funds and warns if it would come from the conversion pre-59½. In an RMD year the RMD
is satisfied *before* converting. Every interaction is surfaced explicitly: SS taxation, IRMAA (+2-year
lookback), ACA PTC, NIIT, the senior-deduction phase-out, the **widow's penalty** (the survivor files
single, into tighter brackets), and reduced future RMDs. A **convert-vs-don't** comparison shows lifetime
taxes and ending after-tax wealth side by side. The 5-year clocks for penalty-free withdrawal of converted
principal are surfaced as warnings rather than hard-modeled.

For a true multi-year co-optimization of conversions and withdrawals, see [optimizer.md](optimizer.md);
the fill-to-target strategies here cover most of the practical value without a solver. They also double as
**candidate generators** for the shared [decision engine](../../app/src/engine/decisions/)
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
SEPP schedules ([strategies/sepp.ts](../../app/src/engine/strategies/sepp.ts)) → penalized deferred
withdrawals only as a last resort. Inherited accounts honor the **10-year drain**
([strategies/inheritedIra.ts](../../app/src/engine/strategies/inheritedIra.ts)) and are not treated as
Roth-convertible owner assets. All of these movement rules — convertibility, RMD applicability, spendability,
and the penalty rate — are answered by the shared account-eligibility service
([strategies/accountEligibility.ts](../../app/src/engine/strategies/accountEligibility.ts)), so the ledger,
the optimizer input builder, and the decision generators can never disagree.

An HSA left last for medical is qualified (tax- and penalty-free) only up to modeled medical costs when the
account opts into the cap treatment, and an optional **taxable safety-net floor**
(`strategies.taxableSafetyNetFloor`) keeps a minimum cash/taxable reserve intact — spending funds from other
account types first, and fill-to-target conversions are trimmed so their tax bill never forces a breach. See
[taxes.md § Account depth](taxes.md#account-depth-hsa-nondeductible-basis-property-sales).

## The tax / withdrawal circularity

Withdrawing to cover spending generates tax, which raises the amount that must be withdrawn — a circular
dependency the engine resolves with a **fixed-point iteration** each year (it converges in a few rounds).
This is why withdrawals and taxes can't be separate passes, and why a strategy only ever proposes a
schedule that the real ledger then prices exactly.

## Related

[taxes.md](taxes.md) (the engine these strategies optimize against) · [optimizer.md](optimizer.md) ·
[social-security.md](social-security.md) (claim timing interacts with the bridge-years conversion play).
