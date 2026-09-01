## 19. Annuity payout forms, the annuitization sweep, pension lump-sum elections, and the HECM buffer (opt-in)

Shipped 2026-07-08 (the `annuity-pension-and-home-equity-decisions` plan).
All additive: every new field is optional with a no-op default, so plans that set none of them keep a
byte-identical projection.

- **Annuity payout forms.** `payoutForm` on an annuity account (absent = `lifeOnly`, the legacy behavior):
  - **Period certain** (`certainYears`): a life annuity with an N-year guarantee measured from the start
    age. If the owner dies inside the window, the remaining guaranteed payments continue to the household;
    after the window the annuity is life-contingent as usual.
  - **Joint & survivor** (`survivorPct`): payments continue to the other household member at that share for
    their lifetime (requires a two-person household).
  - **Exclusion-ratio taxation per form** (IRS Pub 939 General Rule, non-qualified purchases): life-only
    uses the Table V multiple (§17); period certain floors the multiple at the guaranteed years (the
    payment-side equivalent of Pub 939's refund-feature adjustment — documented approximation); joint &
    survivor decomposes by expectation — the full payment for the owner's Table V years plus the survivor
    share for the expected years the joint annuitant outlives them (joint last-survivor expectancy from the
    SSA-derived mortality model, per-sex where Pub 939's Tables VI/VIA are unisex — documented
    approximation). In every form the ratio is fixed at the starting date and a survivor/beneficiary
    continues the same excludable share until the investment is recovered (Pub 575/939 treatment).
- **Annuity ladders.** Multiple dated purchases are first-class: each annuity account funds and prices its
  own tranche at its own start age. The `annuityPurchaseGenerator` adds a laddered candidate (three tranches
  at now/+3y/+6y splitting the SPIA premium) beside the single purchase.
- **SPIA payout-rate defaults.** `engine/decisions/spiaQuotes.ts` carries the sourced planning table
  (published April-2026 life-only quote sheets, female column rounded down as the conservative unisex
  anchor; 6.0% at 60 rising to a 15.3% extrapolated anchor at 85; re-anchored 2026-07-15 with an
  actuarial cross-check) used to size candidates and the sweep. A user-entered quote always wins; refresh
  with the annual packs.
- **Annuitization sweep.** `buildAnnuitizationSweep` (engine/decisions/annuitization.ts) sweeps a bounded
  grid of allocation percentages (default 0–30%) through the shared-path Monte Carlo primitive: each point
  adds a life-only SPIA purchase funded from the largest liquid account and reports success-rate/estate
  metrics on identical market paths — the success-vs-legacy frontier on the Monte Carlo page. **Kitces
  attribution:** when the funding account carries a static allocation, each point also evaluates an
  allocation-matched control that shifts the premium from bonds to US stocks *without* buying the annuity;
  control − baseline isolates the implicit rising-equity-glidepath share of the benefit, point − control is
  what annuitization adds beyond it (mortality credits, payout floor) net of lost liquidity.
- **Pension lump-sum offer & election.** `lumpSumOffer` (amount + election year) on a pension records the
  decision inputs without ledger effect; `lumpSumElection` commutes the pension — the offer rolls over
  **tax-free** into the named traditional account in the election year (direct rollover; no withholding or
  income) and the annuity never pays. The decision view (Accounts section) shows the annuity's PV at a
  curve-anchored discount rate (TIPS real yield at the horizon + assumed inflation), the survivor option's
  PV value, and a discount-rate × longevity sensitivity table — tradeoffs, never advice. The
  `pensionLumpSumGenerator` scenario pair and the `pension-election-pending` insight price the same
  mechanics on the exact ledger. Survivor rule matches the ledger: no survivor benefit if the owner dies
  before the start age.
- **HECM line of credit (buffer asset).** `hecm` on a primary-residence property models Pfau's strategy:
  - **Line size:** the user's lender-quoted `principalLimitPct`, else the pack's published principal-limit
    factors (HUD PLF tables at a 5.875% expected rate, 2026: 35.1% of value at 62 → 61.4% at 90, youngest
    borrower's age, provenance id `hecm-plf`). A warning fires if modeled before 62.
  - **Growth:** once per projected year, each open line's principal limit and loan balance both compound at
    `growthRatePct` (note rate + 0.5% MIP; default 7.5%) — the unused line grows regardless of home value. `upfrontCostPct` finances
    origination/closing/initial-MIP into the loan at open. A line state is keyed by property-account id; if
    parse-valid duplicate rows alias that id, the first qualifying row supplies the rate and the one shared
    line accrues only once that year. This positional property/HECM convention intentionally differs from the
    last-row RMD/QCD/Form 8606 evidence convention; imported data should use unique account IDs.
  - **Draw policies:** `coordinated` draws for spending in the year after a negative market return
    (Monte Carlo / market-series behavior — deterministic runs have no down years); `lastResort` draws only
    when the portfolio cannot cover spending. Either way an open line backstops a true shortfall. Draws are
    loan proceeds: tax-free cash, never income or MAGI.
  - **Non-recourse:** at sale the payoff never exceeds what the sale nets and the line closes; in net worth
    (and thus the estate) each loan is capped at its home's value, so heirs are never charged for a loan
    that outgrew the house. Reported per year as `hecmDraw` / `hecmLoanBalance`.
- **Insights.** `annuitization-headroom` (planning age 95+ with liquid savings and no lifetime income beyond
  SS), `pension-election-pending` (undecided offer, quotes the PV comparison), and `hecm-buffer-candidate`
  (62+, primary home rivaling the portfolio, no HECM, no planned sale) — all preview scenario patches the
  exact ledger prices.

**Documented simplifications:** no live annuity or HECM quotes/lender data (user-entered terms + sourced
planning defaults); SPIA/DIA/QLAC family only (no variable/indexed annuities); no Medicaid or
estate-recovery modeling for the HECM; HECM servicing set-asides and T&I default triggers not modeled;
period-certain and joint exclusion multiples are planning-grade approximations of Pub 939 Tables III/VI/VIA
(method-checked, not table-reproduced); if the whole household dies inside a period-certain guarantee window,
the remaining certain payments a real contract would pay a beneficiary/estate are not modeled (no
post-household cash-flow path — the same rule stops recurring and one-time income streams, TIPS ladder
cash, one-time spending goals and lifestyle spending after the last death, and stops wages at their own
earner's death; it scopes flows to and from the HOUSEHOLD rather than annuities alone, and does not gate
a portfolio that outlives it (distributed taxable yield, a planned property sale and scheduled debt
service all still settle in a post-death year); see
[features/README.md §3](../../features/README.md#3-income-streams)); the per-account estate breakdown covers investable classes only — property
net of the (non-recourse-capped) HECM loan rides through net worth without a breakdown row.

**Code:** schema in [engine/model/plan.ts](../../../packages/engine/src/model/plan.ts) (`annuityPayoutFormSchema`,
`pensionLumpSumOfferSchema`, `hecmLineOfCreditSchema`); form payout/taxation in
[engine/projection/annuityForms.ts](../../../packages/engine/src/projection/annuityForms.ts) and
[engine/projection/simulate.ts](../../../packages/engine/src/projection/simulate.ts) (HECM open/draw/payoff, pension
rollover); PV math + scenario pair in
[engine/decisions/pensionElection.ts](../../../packages/engine/src/decisions/pensionElection.ts); sweep in
[engine/decisions/annuitization.ts](../../../packages/engine/src/decisions/annuitization.ts); PLF table + provenance
in [engine/params](../../../packages/engine/src/params/data/year2026.ts); detectors in
[engine/insights/detectors/](../../../packages/engine/src/insights/detectors/); UI in
[planner/sections/AccountFields.tsx](../../../packages/planner-ui/src/planner/sections/AccountFields.tsx) and the sweep chart
in [planner/MonteCarloPage.tsx](../../../packages/planner-ui/src/planner/MonteCarloPage.tsx).
