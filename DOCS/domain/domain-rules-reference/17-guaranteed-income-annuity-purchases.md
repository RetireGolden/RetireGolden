## 17. Guaranteed income (annuity purchases) and estate & beneficiary depth (opt-in)

Depth added by the
`guaranteed-income-and-estate-depth` plan (private planning docs). Every
field is additive with a no-op default, so a plan that sets none of them keeps a byte-identical projection
and after-tax estate.

- **Annuity purchase events.** An `annuity` account can carry an optional `purchase`
  (`annuityPurchaseSchema`): a `year`, `premium` (nominal quoted dollars), `fundingAccountId`, and
  `taxQualification`. In the purchase year the premium leaves the funding account — cash/traditional at book
  value, a taxable or equity-comp source liquidating and realizing gains pro-rata like any sale — and the
  account's income stream starts at `startAge`.
  - **Non-qualified** (cash/taxable-funded): payouts are taxed by the **IRS Pub 939 exclusion ratio** — the
    premium is the investment in the contract, recovered tax-free over the expected-return period (Pub 939
    Table V multiples). The account's `taxablePct` is derived from the ratio; the stored value is a display
    fallback only.
  - **Qualified** (traditional-funded): payouts are fully ordinary income, and because the premium leaves the
    traditional balance, future RMDs shrink automatically.
- **QLAC support.** `purchase.qlac` marks a deferred-start qualified longevity annuity. Its premium is
  **excluded from the RMD base** until payouts begin, capped at the SECURE 2.0 statutory limit (**$210,000
  for 2026**, sourced in `year2026.ts`); a warning fires if the entered premium exceeds the cap, and `qlac`
  requires `taxQualification: 'qualified'`.
- **Estate beneficiary destinations.** `estateBeneficiary` on any account (`estateBeneficiarySchema`) sets
  where its ending balance passes in the after-tax estate metric: `spouse` (no terminal income-tax haircut —
  assumes continued deferral at the horizon; does not establish a valid rollover/treat-as-own election and
  does not estimate spouse later distribution taxes; actual inherited-IRA/action paths apply their own explicit facts),
  `nonSpouse` (pre-tax classes — traditional and non-spouse HSA — taxed at the class's heir rate; Roth,
  taxable stepped-up at death, and cash pass untaxed), or `charity` (`charityPct` passes to charity fully
  untaxed, the remainder following the non-spouse rules). Absent the field, the legacy flat treatment applies.
  The HSA's older `beneficiary` field remains a spouse/non-spouse shorthand; when both are present,
  `estateBeneficiary` wins. Omitting that shorthand is a legacy convention mapped to the spouse-equivalent
  default, not a statutory designation. The HSA non-spouse haircut is the terminal-inclusion approximation
  in §16 (`irc-223-f-8-B-estate-predeath-expense-reduction`), not a claim that every death is a fully
  taxable HSA distribution. A pension and an annuity are **not** logical balance accounts, so
  `estateBreakdown` never reads the field on either: what a guaranteed-income contract leaves behind is its
  survivor benefit, its period certain, or a lump-sum election. The schema still accepts the field on both
  (an imported plan round-trips unchanged) and neither editor offers it, with a card note saying why (#486).
- **Heir tax by account class.** `assumptions.heirTaxByClass` optionally overrides the flat `heirTaxRatePct`
  (§13) per pre-tax class (`traditional`, `hsa`), so a large inherited traditional balance can be priced at a
  higher heir bracket than a modest HSA. An omitted class falls back to `heirTaxRatePct`.
- **Survivor reserve target.** `strategies.survivorReserveTarget` (today's dollars) is a hard constraint on
  the `protect-survivor-liquidity` objective: a candidate whose survivor-year investable balance (deflated to
  today's dollars) falls below the target is disqualified with a readable violation. Absent = no floor.
- **Annuity purchase candidates.** The decision engine's `annuityPurchaseGenerator` proposes up to three
  bounded candidates — a cover-the-floor SPIA (cash/taxable-funded, 25% of the largest liquid balance, capped
  at $250k), a QLAC at the statutory cap (traditional-funded, deferred start at 80–85), and a no-purchase
  alternative — each priced on the exact ledger so the liquidity ↓ / durability ↑ / estate Δ trade-off is
  visible.

**Documented simplifications:** users enter annuity quotes (no pricing/rate tables); no variable/indexed
annuity products; estate/inheritance tax, probate, trusts, and legal-planning precision are out of scope.

**Code:** schema in [engine/model/plan.ts](../../../packages/engine/src/model/plan.ts) (`annuityPurchaseSchema`,
`estateBeneficiarySchema`, `heirTaxByClass`, `survivorReserveTarget`); purchase execution in
[engine/projection/simulate.ts](../../../packages/engine/src/projection/simulate.ts); QLAC RMD-base exclusion
in `simulate.ts` and [engine/rmd/](../../../packages/engine/src/rmd/); annual exclusion-ratio and
qualified-payment planning in
[engine/projection/internal/annualPensionAndAnnuityIncome.ts](../../../packages/engine/src/projection/internal/annualPensionAndAnnuityIncome.ts);
after-tax estate depth in
[engine/projection/compare.ts](../../../packages/engine/src/projection/compare.ts); HSA terminal inclusion in
[engine/projection/estateHsaIncome.ts](../../../packages/engine/src/projection/estateHsaIncome.ts); candidates in
[engine/decisions/generators.ts](../../../packages/engine/src/decisions/generators.ts).
