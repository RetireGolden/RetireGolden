## 18. TIPS income floor: ladders, the SS bridge, and the funded ratio (opt-in)

Shipped 2026-07-08 (social-security-bridge-and-tips-ladder). All additive: `plan.incomeFloor` is optional
and absent means no behavior change (feature-off byte-identical, `cases:diff` clean).

- **Ladder construction.** A ladder (`tipsLadderSchema`) is a target level real income over a calendar
  window. Rungs are solved back-to-front — the last payout year is funded by its maturing principal plus its
  own coupon, earlier years by principal plus the coupons of every still-outstanding rung (the standard
  tipsladder.com/Bogleheads construction). Each rung is a synthetic TIPS whose coupon is the interpolated par real
  yield at its maturity, floored at the regulatory 0.125% minimum
  ([`cfr-31-356-20-b-tips-minimum-coupon`](../../../packages/engine/src/rules/records/investmentIncomeAndBasis.ts);
  primary: [31 CFR 356.20(b), 87 FR 40438, 40440 (July 7, 2022), amendment 9](https://www.govinfo.gov/content/pkg/FR-2022-07-07/html/2022-13409.htm));
  rungs are priced by discounting real cash flows on the same curve (par-yields-as-spot, planning grade). On
  a flat curve where coupon equals yield and the regulatory floor is nonbinding, each rung prices at face and
  the total cost equals the level-annuity PV exactly (golden-tested).
- **Real-yield curve.** Embedded snapshot of the U.S. Treasury Daily Par Real Yield Curve Rates
  (`params/data/realYieldCurve2026.ts`; 5y 1.85 / 7y 2.05 / 10y 2.25 / 20y 2.55 / 30y 2.70 as of
  2026-06-30), linear interpolation, flat endpoints. Provenance id `real-yield-curve`; annual refresh per the
  maintenance schedule; the "curve as of" date is shown beside every quote.
- **Taxation (federal).** Coupons and the year's inflation accretion on outstanding face (phantom OID) are
  ordinary income and count as investment income for NIIT; maturing principal is a tax-free return of
  already-taxed dollars. Planning-grade OID: accretion is taxed as it accrues against the plan's inflation
  path, not a Form 1099-OID reproduction.
- **Taxation (state).** Interest on U.S. government obligations is exempt from state income tax in every
  state (31 U.S.C. §3124). New `TaxYearInput.usGovernmentInterest` carries the ladder's taxable interest and
  is subtracted from state taxable income by the modeled packs, prorated across split-year residency, and
  honored by the flat effective-rate override. Federal tax ignores the field.
- **Purchase & balance sheet.** An optional purchase event withdraws the quoted (inflation-scaled) cost from
  a cash/taxable/equity-comp account in the purchase year — a transfer, not spending; taxable sources realize
  gains pro-rata. A short funding account scales every rung down with a warning. Unmatured face (inflation-
  indexed book value) is reported as `YearResult.ladderValue` and counts in net worth (and thus the estate,
  passing untaxed like stepped-up taxable) but never in `investableTotal` — the withdrawal engine cannot raid
  the floor. Ladders held in IRAs are out of scope (model those as the account's own balance).
- **SS bridge.** `engine/ladder/bridge.ts` sizes the Bipartisan Policy Center bridge: pay yourself the
  forgone age-62 benefit (PIA × age-62 claim factor) from max(retirement year, age-62 year, next year)
  through the year before the chosen claim age. Surfaced as a one-click panel on the SS Optimizer with a
  same-path comparison (identical ledger + seeded MC paths) of claim-at-62 vs delay vs delay-plus-bridge,
  and as `bridgeLadderGenerator` decision candidates.
- **Funded ratio.** PV(guaranteed real income: SS + pensions + annuities + ladder flows) ÷ PV(required-floor
  spending), both read from the same deterministic ledger years, deflated to today's dollars, and discounted
  on the TIPS curve (Pfau's household funded-ratio lens). Shown on Results and the Income floor page;
  `income-floor-funded` fires below ~90%, `ss-bridge-gap` previews a sized bridge as a scenario.
- **FedInvest (opt-in only).** `planner-ui/src/data/fedInvestClient.ts` owns the explicit-click fetch and
  per-day cache for end-of-day TIPS prices (`securityPriceDetail`, CSV); `engine/ladder/fedInvest.ts` is pure
  CSV parsing/date math. This is the app's only cross-origin request, carrying only a public price date, never
  plan data. FedInvest sends no CORS headers, so the browser may block it; the UI then offers a zero-network
  import of the user-downloaded `securityprice.csv`. Prices are a per-$100-face reference (FedInvest omits the
  inflation index ratio) — the embedded curve remains the planning source of truth.

**Documented simplifications:** annual coupons (real TIPS pay semiannually); no CUSIP lot rounding in core
mode; par-rung pricing on the par curve; planning-grade OID; taxable-side ladders only.

**Registered gaps (savings bonds, 529-to-Roth, gift/estate, TIPS OID/premium):**
- **529-to-Roth rollover** (`irc-529-c-3-E-529-to-roth-rollover-not-modeled`, outOfScope): the 15-year / $35,000 529(c)(3)(E) trustee-to-trustee path is not modeled.
- **Gift and estate transfer tax** (`irc-2503-b-annual-gift-exclusion-not-modeled`, `irc-2010-c-3-basic-exclusion-amount-not-modeled`, `irc-2010-c-5-dsue-portability-election-not-modeled`, outOfScope): chapter 12 gift tax and chapter 11 estate-tax exclusion/portability mechanics are not computed.
- **Savings bonds** (`cfr-31-363-52-savings-bond-annual-purchase-limit`, `irc-454-savings-bond-interest-deferral`, `irc-135-education-savings-bond-interest-exclusion`, outOfScope): book-entry purchase limits, section 454 deferral/default inclusion, and section 135 education exclusion are not modeled.
- **TIPS OID and premium** (`treas-reg-1-1275-7-d-4-positive-inflation-adjustment-oid`, settled; `treas-reg-1-1275-7-f-1-deflation-adjustment-income`, approximated / overstatesTax; `treas-reg-1-1275-7-f-2-deflation-basis-decrease-not-modeled`, `treas-reg-1-1275-7-f-3-tips-acquisition-premium`, `irc-171-tips-bond-premium-amortization`, outOfScope): positive inflation accretion is OID; deflation income clamp, basis decrease, acquisition premium, and bond premium amortization gaps are registered separately.

**Code:** math in [engine/ladder/](../../../packages/engine/src/ladder/); schema in
[engine/model/plan.ts](../../../packages/engine/src/model/plan.ts) (`tipsLadderSchema`, `incomeFloorSchema`); ledger
integration in [engine/projection/simulate.ts](../../../packages/engine/src/projection/simulate.ts), whose once-per-year
coupon/maturity/accretion phase lives in
[engine/projection/internal/tipsLadderAnnualCashFlow.ts](../../../packages/engine/src/projection/internal/tipsLadderAnnualCashFlow.ts); state exemption
in [engine/tax/stateTax.ts](../../../packages/engine/src/tax/stateTax.ts); UI in
[planner/sections/IncomeFloorSection.tsx](../../../packages/planner-ui/src/planner/sections/IncomeFloorSection.tsx) and the
bridge panel in [planner/SsAnalysisPage.tsx](../../../packages/planner-ui/src/planner/SsAnalysisPage.tsx).
