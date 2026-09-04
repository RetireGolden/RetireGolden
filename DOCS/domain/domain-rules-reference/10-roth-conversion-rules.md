## 10. Roth conversion rules

- Any amount, any year; taxed as ordinary income in the conversion year; **no 10% penalty on the conversion itself**; no earned-income or RMD-year ordering subtleties beyond: RMD must be satisfied **before** converting in an RMD year. A generic rollover action is not modeled; the pension lump-sum path has two registered approximated §402(c) defects: the missing §402(c)(4)(B) carve-out past the RBD (`irc-402-c-4-B-rmd-not-eligible-rollover-distribution`) and its assumption that every elected offer is eligible for direct rollover (`irc-402-c-1-pension-lump-sum-direct-rollover-eligibility`).
- **5-year rules:** each conversion has its own 5-year clock for penalty-free withdrawal of converted principal before 59½ (the "conversion ladder" for early retirees); separately, earnings require 59½ + 5-year account age. Recapture under §408A(d)(3)(F) is computed (with the age-60 proxy), and the taxable-portion-first gap inside a converted layer is the registered approximated divergence (`irc-408A-d-4-B-converted-layer-taxable-portion-first`).
- **Pro-rata rule** for conversions and withdrawals from IRAs with nondeductible basis (Form 8606) — **implemented** (opt-in `nondeductibleBasis` per traditional IRA; see §16). Absent the field, plans behave as before (all pre-tax).
- Conversion taxes best paid from taxable funds; paying from the conversion before 59½ incurs the 10% penalty on the tax portion.
- **Named conversion actions.** A `rothConversion` retirement action names its owner, its source accounts, and a
  destination Roth, and the annual projection **commits** it: sources are debited, the Roth credited, and a
  conversion basis layer opened, for zero- and nonzero-basis owners alike. Admission turns on the Form 8606 basis
  **numerator being known**, not on its being zero — reading `zeroBasis` as the admission predicate made admission
  depend on the settlement admission governs, which is circular. At a proven-zero numerator the executor states the
  whole gross as taxable (`irc-408A-d-3-A-i-zero-basis-conversion-includible`); at a positive one it commits the dollars and states **no** character, and the annual
  settlement supplies the Form 8606 line-10 ratio back through the assumption vector, so the year holds one answer
  to the owner's pro-rata question instead of a second mid-year one. Under §408A(d)(3)(F)(ii) the layer's
  recapture amount is then the credited dollars net of that basis return (`irc-408A-d-3-F-roth-conversion-recapture`).
  Still refused with balances unchanged: withholding from conversion principal, and a request larger than the
  source — there is no partial-execution arm. An employer plan is refused as a named source for want of dated
  rollover-availability evidence and as a named destination outright. The legacy aggregate schedules convert an
  employer balance to a Roth IRA only when a §401(k)(2)(B)(i) event is provable from Plan facts (attained age 60,
  or attained age at or past `retirementAge`); otherwise the source is fail-closed and the year names the refusal
  (`irc-401-k-2-B-i-employer-plan-conversion-source-not-gated-by-distributability`, `settled`). In-plan Roth of
  otherwise nondistributable amounts under §402A(c)(4)(E) is a different enacted act and is not modelled — the
  transferred amounts would keep their distribution restrictions under Notice 2013-74
  (`irc-402A-c-4-E-in-plan-roth-transfer-not-modeled`). Mega-backdoor Roth — plan-permitted after-tax employee
  contributions under §401(m) converted through §402A(c)(4) — is likewise unrepresentable: the Plan carries no
  employer-plan after-tax contribution basis and no in-plan conversion path
  (`irc-401-m-employee-contribution-mega-backdoor-roth-not-modeled`).
  Employer-plan after-tax allocation across simultaneous rollover destinations is unmodelled
  (`irs-notice-2014-54-employer-plan-after-tax-rollover-allocation`).
- **Conversion-linked tax funding.** A named conversion may name a sibling ordinary withdrawal that pays its tax,
  and the annual projection moves both legs or neither: the disposition is `executedAsAtomicGroup` or
  `refusedPendingGroupExecution`. Sizing the funding takes three runs of the same annual pass — a T0
  counterfactual without the conversions, a staging probe inside a simulator annual-pass transaction that is
  always rolled back, and the committed run — each minting a liability-run identity typed `baselineT0`,
  `candidateT1`, or `committedAnnual`, with a mismatched or colliding slot a typed refusal rather than a silent
  mispricing. The group's required funding is the exact rational `max(0, T1 − T0)`, quantized once
  nearest-cent-half-up and split by largest remainders; what the withdrawal actually executed is observed
  separately and reconciled against it. Authorization is per conversion/withdrawal pair, read off the discarded
  probe's own facts, and released all-or-nothing across one filing unit's year. The arm is reachable only for an
  owner with proven-zero aggregated nondeductible basis: a positive Form 8606 numerator makes the conversion's
  character null, a null character is no allocation weight, and the funding evaluation refuses a weight nobody can
  state instead of reading it as zero — so one positive-basis owner withholds that year's other groups with it. An
  unproven basis never reaches the group, because the conversion itself is refused first.
- **Promoting an aggregate schedule.** The `identityIncomplete` veto is now conditional rather than absolute: an
  optimizer winner can be turned into named requests by the promotion loop, which allocates by the same
  owner-allocation policy the ledger executes, prices the named candidate on its own exact-ledger run, and
  publishes only on `equivalent` (the two projections match to the cent) or on `repriced` where the named
  schedule earns a recommendation on its own metrics. See [features/optimizer.md](../../features/optimizer.md).
- Strategy interactions the engine must reflect: bracket fill, IRMAA tiers (+2yr lag), ACA cliff, SS provisional income, NIIT, senior-deduction phase-out, widow's-penalty (survivor files single), reduced future RMDs.
