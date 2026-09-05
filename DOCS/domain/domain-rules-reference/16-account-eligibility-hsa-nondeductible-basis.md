## 16. Account eligibility, HSA, nondeductible basis, and fixed-asset disposition (opt-in)

Depth added by the `account-hsa-and-fixed-asset-depth` plan (private planning docs). Every field is
additive with a no-op default, so plans saved before it stay byte-identical.

- **Account eligibility service.** `engine/strategies/accountEligibility.ts` is the single source of truth for
  per-account movement rules: can it accept contributions, be converted to Roth, follow the owner's RMDs, be
  spent this year (equity-comp vesting), and what early-withdrawal penalty applies. The ledger, the optimizer
  input builder, and the decision generators all consume it, so the inherited-IRA convertibility rule
  (`irc-408-d-3-C-i-inherited-ira-rollover-bar`) (and the
  Rule-of-55 / pre-59½ penalty logic) lives in exactly one place.
- **Explicit equity-compensation actions.** An individually owned equity-compensation ordinary withdrawal
  executes only when its persisted `final` status proves it already vested or its exact action date is on or
  after the persisted cliff vest date. `final` evidence deliberately carries no invented vest date. Under the
  current planning boundary the executor classifies the full executed amount as compensation ordinary income
  (`fullyTaxableCompensationAtExecution`) and applies no retirement additional tax. That character is a
  disclosed §83 timing approximation: grant transfer date, §83(b) election, amount paid, grant type, and
  post-vesting holding-period facts are absent, so the engine cannot call it the actual tax character of a
  later sale (`irc-83-a-equity-compensation-execution-character`, approximated / both directions). Exact-cent
  action proceeds, ordinary-income output, and balance movement each enter the annual ledger once.
- **Non-retirement penalty scope.** Cash, taxable-source, and equity-compensation ordinary withdrawals publish
  typed `notApplicable` / `nonRetirementSource` penalty coverage rather than a zero section 72(t) calculation,
  because [IRC §72(t)(1)](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section72&num=0&edition=prelim)
  applies to an amount received from a qualified retirement plan
  (`irc-72-t-1-qualified-retirement-plan-scope`).
- **Individually owned taxable-source execution.** The public pure classifier binds an allocation to explicit
  1/1 beneficial-owner evidence and immutable caller-supplied tax-unit facts. It recovers aggregate basis with
  `planningAggregateBasisRatio`, bigint rational arithmetic, and exactly one `nearestCentHalfUp` rounding; the
  signed capital-gain/loss residual is never rounded independently, and basis return plus gain minus loss equals
  executed principal.
  Basis may exceed fair market value, and safe serialized cents may produce an intermediate product above
  `Number.MAX_SAFE_INTEGER`. The public ordinary-withdrawal executor consumes a separate exact-cent opening
  balance and cost-basis snapshot, stages both together, and commits both or neither. A depleted taxable
  sibling in a positive partial action uses an explicit zero-execution/no-denominator arm; stale positive
  basis at zero value fails closed.
  The annual projection now constructs these snapshots for named, individually owned taxable sources when
  the projected tax unit is unambiguous: one living member filing single or qualifying surviving spouse, or
  exactly two living members filing jointly. Every snapshot for the year shares deterministic tax-unit
  evidence derived from the projected filing status, sorted living member IDs, and annual state-residency
  inputs. The owner must be a living unit member with an exact 1/1 share. Invalid basis is omitted without
  hiding a valid opening balance, and closing balance plus basis commit atomically by stable account ID.
  Sequential actions and same-year residual legacy sales therefore consume the adjusted basis rather than
  debiting or characterizing the source twice.
  Exact-cent action gain/loss crosses into the annual model once and feeds conversion/bracket/floor sizing,
  withdrawal probes, carryforward, federal and state tax, MAGI/ACA/IRMAA, the conservative nonnegative
  optimizer base, `YearResult.realizedGains`, and taxable-withdrawal reporting. Proceeds remain a single
  liquidity inflow. Joint taxable ownership, MFS/multiple tax units, action-date market valuation, tax lots,
  and filed-return state attribution remain unsupported planning boundaries.
- **HSA medical-expense subledger.** Per HSA account, `withdrawalTreatment`:
  `assumeAllQualified` (every withdrawal tax- and penalty-free), `capByMedicalExpenses` (qualified only up to
  the household's modeled healthcare premiums + net care costs this year; the excess is ordinary income,
  penalized 20% before 65 — IRS Pub 969), or omitted (legacy: tax-free but conservatively penalized before 65).
  With `reimburseLater`, modeled medical costs paid out of pocket accumulate a carryover that later withdrawals
  draw against tax-free (the "pay now, reimburse later" strategy).
- **HSA beneficiary treatment.** The after-tax estate metric is assumed terminal income-tax exposure, not an
  annual HSA tax computation. A spouse-designated HSA continues under IRC §223(f)(8)(A) (zero inclusion).
  A designated non-spouse natural-person destination uses the ending gross balance as the inclusion base
  ([`estateHsaIncomeBase`](../../../packages/engine/src/projection/estateHsaIncome.ts); IRC §223(f)(8)(B)(i)) and does not apply the §223(f)(8)(B)(ii)(I) reduction for
  qualified medical expenses incurred by the decedent before death and paid by that person within one year
  (`irc-223-f-8-B-estate-predeath-expense-reduction`, approximated / overstatesTax in that stipulated case).
  The Plan cannot express legal beneficiary class, death date or date-of-death value, or those qualifying
  expense and payment facts; `nonSpouse` also stands in for unmodeled legal classes. A charitable estate
  carve-out is applied outside that helper. Omitting the older HSA `beneficiary` field is a legacy convention
  that maps to the spouse-equivalent default; it is not a statutory designation. Do not read every death as a
  fully taxable HSA distribution.
- **Nondeductible IRA basis (Form 8606 pro-rata).** `nondeductibleBasis` on a traditional IRA aggregates
  across an owner's own IRAs; every withdrawal and conversion is part tax-free basis and part taxable in the
  ratio of basis to the aggregated pre-distribution balance (IRC §408(d)(2)). Employer plans and inherited
  IRAs are excluded from the aggregation. Basis is historical cost (never indexed).
  The terminal after-tax estate metric does not reuse that owner-wide pool. Compare calls
  `estateTraditionalTaxableBase` for every traditional gross, including inherited balances, with the
  household traditional total as denominator. The helper is a pure formula: each account's taxable pretax
  base is its gross minus the household remaining-basis scalar times that gross over the supplied
  traditional total (`irc-408-d-2-estate-household-basis-allocation`). That registered claim covers only
  the cross-owner owned-IRA and IRA/employer misallocation the formula produces when owner and vehicle
  boundaries are ignored, not inherited-pool separation or unavailable inherited nondeductible basis;
  those interactions remain a compare residual. The public fixture isolates the owned-account slice by
  carrying no inherited traditional balances. Inheritance itself is not an IRA taxable distribution. Separately, the pure
  action-character substrate accepts exact-cent complete-pool evidence and complete annual Form 8606
  inputs, derives the capped line-5/line-9 ratio with bigint intermediates, and allocates each line's
  once-rounded basis total across positive actions in canonical date/sequence/action/allocation order.
  Zero executions receive no ledger entry or character. Executed ordinary withdrawals from the owned
  non-Roth IRA pool stage as Form 8606 line 7 distribution candidates
  (`form-8606-line-7-owned-ira-movement-staging`). The pool itself is owner-wide and
  excludes inherited accounts, per filing person
  (`irc-408-d-2-A-owner-wide-non-inherited-ira-pool`). Line 7 and line 8 remain distinct
  (`form-8606-lines-7-and-8-distinct-distribution-staging`); if their
  independently required rounding would recover more than the annual basis, classification fails closed
  instead of emitting contradictory evidence. The pure penalty-prerequisite boundary then considers only
  positive ordinary-income character, computes age 59½ as 714 calendar months with month-end clamping,
  and applies 10% for traditional/SEP or 25% strictly within a SIMPLE IRA's first 24 calendar months
  (10% at and after that boundary). Per-allocation candidate amounts are provisional. Final
  penalty-applicable allocations are grouped by owner, tax year, and exact rational rate; each bucket
  sums ordinary-income exposure with bigint arithmetic, applies nearest-cent-half-up quantization once,
  then allocates the rounded cents by floor quotas and largest rational remainders with canonical
  allocation identity as the deterministic tie-break. The immutable bucket evidence binds the rate,
  aggregate exposure and penalty, member exposures, remainders, and allocated cents. Each member also
  carries a non-circular penalty-applicability evidence ID derived from its character coverage, rate,
  identity, and complete rejected-exception tuple, so a sibling exception-evidence change rotates the
  bucket ID and every bucket member's final evidence ID. A distribution at
  or after 59½ can receive final zero-penalty age coverage.
  Before 59½, caller-supplied positive disability evidence can receive final zero-penalty disability
  coverage only when it binds the owner and exact distribution date and proves qualification on or
  before that date; a disability-qualified SIMPLE allocation does not need participation-date/rate
  evidence. For another distribution before 59½, the prerequisite can finalize `penaltyApplies`
  only from a fixed negative-evidence tuple: owner alive on the same distribution-date evidence,
  explicit rejected disability status for that owner/date, explicit IRA SEPP status `none` with null
  election and schedule IDs, and an allocation-bound `noOtherStatutoryExceptionClaimed` planning
  attestation. That attestation is not filing-grade legal adjudication. Missing any member preserves
  `exceptionEvaluationRequired`; if any allocation in an owner/year/rate bucket lacks that evidence,
  every allocation in the same bucket remains unresolved while complete buckets at other rates may
  finalize independently. Malformed, contradictory, duplicate, or foreign records fail closed. Each
  final member penalty is its deterministic allocation of the once-rounded bucket total, and member
  amounts exactly conserve that total. This pure prerequisite
  does not infer disability, death, SEPP, or other exceptions from plan data. A third pure owner/year
  finalization gate
  composes those two canonical boundaries over staged executed-gross line-7 entries. It publishes one
  immutable annual evidence bundle only when every positive ordinary-income allocation has final
  age-59½, disability-qualified zero-penalty, or fully evidenced penalty-applicable outcome; basis-only
  allocations need coverage but no penalty evaluation. Any remaining exception-evaluation-required
  allocation blocks publication of
  the entire owner/year and returns a typed `withdrawal-penalty-evidence-missing` issue per allocation.
  The finalization evidence ID binds the owner, pool, year, annual basis record, both line allocations,
  every coverage record, and every final evaluation. This gate is still `movement: notCommitted`: it
  does not establish eligibility or action readiness, or execute or simulate an IRA action.
  For traditional
  employer-plan distributions, a separate pure penalty prerequisite applies 10% to the accepted
  taxable treatment amount from the employer-plan withdrawal-character path — single-distribution
  pro rata after-tax employee basis against the pre-distribution account balance under section 72,
  not the owner-wide Form 8606 IRA pool. Nearest-cent-half-up quantization is an engine
  convention, not statutory text.
  A separate pure movement-candidate seam now stages one explicitly dated owner/tax-year batch of
  owned traditional/SEP/SIMPLE IRA ordinary-withdrawal requests against exact-cent opening balances.
  Valid actions require unique civil-date/sequence slots and are ordered by that chronology;
  a slot conflict aborts the whole candidate rather than using action or array order as a fallback.
  Stable allocation ID orders allocations within each action, and each allocation stages sequentially
  as the lesser of requested cents and the remaining source balance. The result retains before,
  executed, unexecuted, and candidate-after cents for every
  allocation, including zero-executed allocations, while emitting Form 8606 line-7 entries only for
  positive staged gross. Global schedule defects abort the batch with unchanged candidate balances.
  The stable `movementCandidateId` binds the owner/year, canonical requests and schedule, immutable
  owned-IRA source proofs, openings, staged physical evidence, candidate closings, and line-7 entries.
  This seam also reports `movement: notCommitted`: it proves neither annual character nor penalty
  treatment, does not execute or simulate movement, and cannot commit independently. A pure annual
  candidate coordinator now exact-rejoins every requested source to its owner-wide pool member,
  derives penalty-source facts from the staged source and date, and binds the `movementCandidateId`,
  line-7 allocation evidence ID, and `finalizationEvidenceId`. Its generated distribution-date ID is
  candidate-bound scheduled-date evidence, not custodian or actual-execution proof. Every coordinator
  arm remains `movement: notCommitted` and `actionability: notEstablished`; unresolved penalty evidence,
  an invalid schedule, or no positive movement produces an explicit non-bound result.
  A Plan-authoritative wrapper, `coordinatePlanOwnedNonRothIraAnnualWithdrawalCandidate`, derives the
  complete owner/year Plan action batch and owned non-inherited traditional/SEP/SIMPLE IRA pool instead
  of trusting caller-authored identities or requests. It binds those identities to complete runtime
  evidence from one ledger run: opening and Form 8606 year-end snapshots for every pool member, complete
  annual basis/line-7 and line-8 inventories, and exact alive evidence. This is
  Plan-identity-authoritative, runtime-snapshot-bound planning evidence only; all typed blocked and bound
  outcomes remain `movement: notCommitted` and `actionability: notEstablished` and cannot execute or
  simulate an action.
  The pure `buildAnnualRetirementPhysicalEventInventory` boundary now establishes the prerequisite
  Plan/year chronology shape without integrating it into the simulator. It derives traditional-account
  Plan action allocations from the validated Plan and exact-rejoins them with one complete runtime
  attestation for owned, employer, and inherited RMDs; automatic SEPP; legacy need-based withdrawals,
  and conversions; in-year owned-IRA and SEP/SIMPLE account-balance contribution inflows;
  and in-year employer-plan employee contributions and configured employer match. Annuity funding,
  rollover inflows, other traditional transfers, and aggregate legacy QCD reclassification remain typed
  unresolved activity until a later contract binds their producer and physical endpoints; they cannot
  enter a completed resolved inventory.
  Taxable-side TIPS-ladder funding remains outside this traditional-retirement-account inventory.
  Following-year IRA contributions designated for the prior tax year remain separate annual-basis
  facts, not calendar-year physical events.
  Resolved runtime events bind exact cents, owner, source, date, sequence, movement authority, upstream
  evidence, and one ledger run. One movement authority can span multiple source members only when owner,
  kind, origin, date, and sequence are identical; each member keeps its own unique upstream evidence.
  A resolved contribution event is post-owner-wide-limit producer evidence, not a candidate to be
  limited again: shared IRA/elective-deferral and section 415(c) state remain upstream, and a fully
  suppressed contribution is intentionally absent from the complete attested runtime inventory.
  The runtime attestation's own upstream evidence is published and included in the structural inventory
  ID. Unresolved activity retains only its known kind and amount; the boundary
  never substitutes December 31, Plan array order, or a guessed source. Omissions, foreign records,
  unsafe totals, identifier collisions, and cross-authority chronology-slot conflicts fail closed. A
  successful immutable stream exposes complete owned-IRA pool views, exact Plan-owned action IDs,
  provisional Form 8606 line-7/line-8/QCD categories, and a typed choice between the isolated standalone
  executor and a future unified annual ledger. It commits no balance or basis, computes no tax or
  penalty, changes no `YearResult`, and establishes neither movement nor actionability.
  The pure `preparePlanOwnedNonRothIraAnnualCandidateTransaction` boundary consumes only that
  standalone-compatible inventory branch. It rebuilds the inventory, derives the exact canonical
  Plan-owned action/source batch and classification lineage, and stages physical movement against one
  caller-supplied exact-cent opening balance per requested source. Its frozen allocation applications
  and opening-to-candidate-closing source transitions reconcile exact staged proceeds and carry a
  collision-checked structural transaction ID. The transaction is applied to detached evidence only:
  `movement` remains `notCommitted`, `actionability` remains `notEstablished`, and it publishes no
  December 31 snapshot, basis allocation, tax character, penalty, finalization, or simulator mutation.
  Runtime activity, mixed owners, conversions/QCDs, and non-owned sources retain the inventory's typed
  unified-ledger requirement; incomplete activity and malformed chronology pass through fail-closed.
  The pure `buildPlanOwnedNonRothIraAnnualPostCandidateClassificationInput` boundary consumes only the
  standalone-compatible branch of that inventory. It reruns both inventory construction and canonical
  movement staging, exact-rejoins the supplied staged candidate, and requires an exactly-once
  post-candidate snapshot bound to the same Plan, owner, year, ledger, inventory, and candidate. The
  snapshot must reproduce every allocation application and candidate balance and must include December
  31 Form 8606 applicable balances for every owned non-inherited traditional/SEP/SIMPLE IRA sibling,
  including unrequested and zero-balance members; employer, inherited, duplicate, and foreign members
  fail closed. A separately complete following-year nondeductible-contribution window supplies Form 8606
  lines 1 and 4 through an authoritative ordinary April 15-18 federal deadline (excluding disaster
  relief); records must be positive exact cents, while no activity uses the explicit-empty arm. The
  ordinary nationwide April calendar itself is registered under
  `irc-6072-a-7503-ordinary-federal-filing-deadline` (IRC 6072(a), IRC 7503, Notice 2011-17; Announcement
  2007-16 for the supported tax-year 2006 floor), enforced by
  `tax/ordinaryFederalFilingDeadline.ts#ordinaryFederalFilingDeadline`, and covers only that calendar —
  not extensions, disaster relief, state-office holidays, or taxpayer-specific deadline adjudication.
  This leaves line 5 equal to the exact opening basis; contributions in that following-calendar-year window do
  not recover basis in the current distribution fraction
  (`form-8606-line-4-post-year-contribution-exclusion`). Rollover
  line-6 adjustments and line 8 must be explicitly zero in this standalone slice, while line 7 comes only
  from positive actual staged gross. Bigint sums produce safe-cent lines 6 and 9. The immutable success
  contains only a classifier input and reconciliation evidence; it does not call the classifier, penalty
  gates, executor, or simulator, mutate balance or basis, commit movement, or establish actionability.
  A separate standalone `validateOwnedNonRothIraSeppCurrentPaymentCandidate` boundary can now validate
  one named owned-IRA SEPP scheduled-payment transition against canonical character/distribution
  coverage, explicit election and annual-schedule evidence, no-disqualifying-modification coverage,
  a zero annual opening anchored to the prior-history terminal state, and complete current-year prior
  history. The raw payment supplies only schedule references, sequence, current scheduled gross, and
  the previous terminal-state ID; actual gross, character, prior totals, and prior date come from the
  canonical coverage/history. Prior scheduled gross must exactly equal prior actual qualifying gross,
  the current schedule must equal canonical executed gross, and bigint-derived after totals must remain
  safe and within the separately proved positive annual scheduled amount. Basis remains part of the
  provisional gross schedule member but is excluded from prospective ordinary income, including an
  all-basis payment. Every result is explicitly `qualification: pendingAnnualReconciliation`,
  `penaltyTreatment: notEstablished`, `movement: notCommitted`, and
  `actionability: notEstablished`; this boundary publishes no qualification, zero-penalty, finalization,
  binding, readiness, execution, or simulation authority and is not consumed by the penalty evaluator,
  finalizer, or coordinator. Its structurally derived history ID binds an explicit terminal-state ID;
  the first payment's previous state is the annual opening and every later payment's previous state is
  the predecessor's derived after state. New history, after-state, and candidate IDs use prefix-scoped,
  fixed-width SHA-256 structural digests so a payment chain cannot recursively inflate its IDs. The
  pre-existing opening-state and canonical character-coverage IDs retain their legacy structural formula
  for public producer compatibility. A legacy empty current-year history may omit the terminal ID and use
  its prior opaque history ID; the validator safely infers the annual opening. A populated history without
  explicit terminal proof fails with typed nonconformance. A standalone call still cannot detect
  separate-call forks.
  The separate pure `reconcileOwnedNonRothIraSeppAnnualSchedule` boundary closes that local gap for one
  election, source, and tax year. It canonicalizes raw payments by date and stable action/allocation
  identity using locale-independent UTF-16 code-unit ordering, reconstructs every current-year history
  and predecessor chain internally, and revalidates
  each payment through the standalone validator. Canonical character coverage comes only from an
  explicitly supplied complete distribution inventory whose producer IDs and structurally derived
  inventory ID are recomputed. The raw payment tuple does not duplicate coverage, candidates, states,
  totals, or history. Inventory and tuple must be bijective, sequences contiguous, distribution/payment
  IDs unique, and scheduled and actual terminal gross must both exactly equal the annual schedule using
  bigint-safe arithmetic. A structurally derived complete prior-election-history record binds the
  opening terminal lineage, must end exactly on the day before the tax year opens, and carries the
  canonical lifetime distribution-ID set. Current distribution overlap is rejected as replay, while
  reuse of a lifetime distribution ID by any current common, inventory, history, payment-schedule, or
  derived state/evidence ID fails closed as a cross-kind collision. Inventory, prior-election-history,
  current-year-history, terminal, candidate, and annual reconciliation IDs use fixed-width structural
  SHA-256 digests. Basis remains in gross membership while only ordinary exposure is accumulated.
  Successful reconciliation is complete only relative to that caller-supplied complete inventory. It
  reports `qualification: notEstablished`, `penaltyTreatment: notEstablished`,
  `movement: notCommitted`, and `actionability: notEstablished`, and exposes no rate or penalty amount.
  The penalty-prerequisite boundary now accepts routed raw annual inputs, derives all canonical character
  coverage first, builds the complete source-account inventory internally, injects the canonical owner/year,
  runs the annual reconciler, and exact-rejoins every reconciled payment. Only a complete `reconciled` route
  produces final `iraSeppQualified` zero-penalty evidence, whose ID binds character coverage, annual
  reconciliation, current candidate, and payment. Evidence-missing, incomplete, and not-reconciled routes
  remain `exceptionEvaluationRequired`, provide no rejected-SEPP authority, and cannot coexist with a
  no-SEPP record. All-basis payments remain schedule members without penalty evaluations; age and disability
  precede SEPP; a SEPP-qualified SIMPLE payment bypasses participation/rate facts while fallback SIMPLE
  treatment remains 25%/10%. The annual finalizer and coordinator now forward raw routes, consume only
  complete `iraSeppQualified` outcomes, expose canonical route diagnostics when annual evidence is blocked,
  and bind compact route results into finalization evidence without changing no-route IDs. The coordinator's
  public staged-date ID builder reproduces its deterministic planning-evidence formula but grants no authority;
  exact source/date rejoin remains inside the coordinator. No result establishes movement, actionability,
  readiness, execution, or simulation.
  This slice does not calculate a legal SEPP amount, persist Plan state, or model later
  modification/recapture consequences.
  Source: [IRS early-distribution exception
  matrix](https://www.irs.gov/retirement-plans/plan-participant-employee/retirement-topics-exceptions-to-tax-on-early-distributions).
- **What the annual projection actually runs, and what is still standalone.** The identity-bearing paths the
  simulator calls are the exact-cent ordinary-withdrawal executor and, since the named-conversion slice, the Roth
  conversion executor. Both debit their named sources inside the year's ledger and outside the legacy withdrawal
  map, so no source can be debited twice, and both record their movement at the mutation site so the owned-IRA
  evidence chain can re-join every balance change. The legacy QCD path does the same for its beyond-RMD debits,
  which carry a `legacyQcd` occurrence and a `legacyQcdDistribution` debit application with a null Form 8606 line
  — 408(d)(8)(D) keeps a QCD out of the pro-rata computation entirely, so it never belongs to a basis allocation.
  The named-QCD arm commits inside the projection too: `simulate.ts` calls the QCD execution prerequisite,
  physical staging and executor, which run the tax-character post-pass and owner-wide pool capacity behind
  them. A non-QCD charitable remainder remains a line-7 distribution rather than a line-8 conversion
  (`form-1040-line-4b-and-form-8606-line-7-qcd-remainder`).
  A fourth path moves dollars only as part of a pair: a conversion whose tax is funded by a named sibling
  withdrawal executes as an atomic group or not at all (§10).
  The named-conversion and named-QCD **source** opening balances, the linked group's leg-fundability probe, and
  the legacy aggregate QCD drain each cross in through `planDollarsToFlooredLedgerCents` rather than the
  measuring converter, because the measuring converter rounds half-up and can report up to half a cent more than
  the account holds. Truncating makes an overdraw unreachable instead of detectable afterwards; the sub-cent
  residue stays in the account, so a drained source closes at that residue rather than at a hard zero. A
  destination keeps the measuring converter, since a credit is a measurement and not a spending capacity, and so
  does the movement predicate, where flooring would wrongly suppress a movement between half a cent and a cent.
  Every movement out of an owned non-Roth IRA is then bound in both directions to the runtime source series
  (`internal/ownedNonRothIraRuntimeSourceSeries.ts`), which the settlement pass runs: a named conversion or QCD
  occurrence must rejoin exactly one committed executor record in exact cents, and every committed record must
  have its occurrence, so neither a forged occurrence nor an unrecorded balance change survives. The series also
  carries the signed cent residual that independently rounding a before, gross, and after value leaves, so the
  `before ± amount + residual === after` identity holds rather than being approximated.
  What is still standalone and uncalled by `simulate.ts` is the Plan-owned annual coordinator and its
  post-candidate evidence builder, the SEPP payment validator and annual reconciler, the employer-plan
  withdrawal-character and penalty boundaries, and the `annualQcd*` evidence, finalization and §170 deduction
  stack below the executor — eight of the twelve `annualQcd*` modules are reachable only from each other and the
  package barrel. Each of those reports
  `movement: notCommitted`, and none of them establishes custodian settlement or filing-grade treatment.
  The standalone Plan-owned commit boundary that once headed that list is gone; owned-IRA basis is settled
  from runtime occurrences through `internal/ownedNonRothIraAnnualAttemptSettlement.ts`.
  The section 170 and section 68 ledger family is gated the same way and deliberately: nothing in `projection/`
  or `tax/federalTax.ts` reaches it, so the registry records pin the live behavior rather than the shelved
  implementation (`irc-170-b-1-G-projection-cash-ceiling-not-applied` and
  `irc-170-p-projection-nonitemizer-deduction-not-allowed`, both `approximated`), and the named-QCD executor
  refuses outright any gift that would leave a positive section 170 amount to deduct.
- **Fixed-asset disposition.** Setting `costBasis` on a property switches its planned sale from the legacy
  tax-free `expectedNetProceeds` estimate to exact treatment: gain = sale price − selling costs
  (`sellingCostPct`) − basis; depreciation (`depreciationRecapture`) is ordinary income and never excludable;
  a `primaryResidence` gets the §121 exclusion ($250k single / $500k joint, statutory since 1997, never
  indexed — parameter pack). Remaining gain flows through the capital-gains stack; net proceeds fund the
  sale-year cash flow so the sale can pay its own tax. Ownership/use tests are a user assertion.
- **Taxable safety-net floor.** `strategies.taxableSafetyNetFloor` (today's dollars) is a minimum
  cash + taxable + vested-equity reserve. Need-based withdrawals fund from other account types first to keep it
  intact, and fill-to-target Roth conversions are trimmed so their tax bill stays payable above the floor; it is
  breached only as a last resort, with a warning. Manual/optimized conversion schedules are executed as typed.

**Code:** [engine/strategies/accountEligibility.ts](../../../packages/engine/src/strategies/accountEligibility.ts),
[engine/strategies/iraBasis.ts](../../../packages/engine/src/strategies/iraBasis.ts),
[engine/actions/annualIraBasisAllocation.ts](../../../packages/engine/src/actions/annualIraBasisAllocation.ts),
[engine/actions/ownedNonRothIraWithdrawalCharacter.ts](../../../packages/engine/src/actions/ownedNonRothIraWithdrawalCharacter.ts),
[engine/actions/ownedNonRothIraAnnualPlanCoordinator.ts](../../../packages/engine/src/actions/ownedNonRothIraAnnualPlanCoordinator.ts),
[engine/actions/ownedNonRothIraSeppCurrentPaymentCandidate.ts](../../../packages/engine/src/actions/ownedNonRothIraSeppCurrentPaymentCandidate.ts),
[engine/actions/ownedNonRothIraSeppAnnualReconciliation.ts](../../../packages/engine/src/actions/ownedNonRothIraSeppAnnualReconciliation.ts),
[engine/actions/rothConversionExecution.ts](../../../packages/engine/src/actions/rothConversionExecution.ts),
[engine/actions/annualQcdExecution.ts](../../../packages/engine/src/actions/annualQcdExecution.ts),
[engine/actions/conversionLinkedWithdrawalGroupExecution.ts](../../../packages/engine/src/actions/conversionLinkedWithdrawalGroupExecution.ts),
[engine/internal/ownedNonRothIraRuntimeSourceSeries.ts](../../../packages/engine/src/internal/ownedNonRothIraRuntimeSourceSeries.ts),
[engine/tax/propertySale.ts](../../../packages/engine/src/tax/propertySale.ts),
[engine/projection/internal/annualAggregateRothConversionTargetPlan.ts](../../../packages/engine/src/projection/internal/annualAggregateRothConversionTargetPlan.ts), threaded through
[engine/projection/simulate.ts](../../../packages/engine/src/projection/simulate.ts), the after-tax estate metric in
[engine/projection/compare.ts](../../../packages/engine/src/projection/compare.ts), the household-basis helper in
[engine/projection/estateTraditionalBasis.ts](../../../packages/engine/src/projection/estateTraditionalBasis.ts), and the HSA terminal-inclusion helper in
[engine/projection/estateHsaIncome.ts](../../../packages/engine/src/projection/estateHsaIncome.ts).
