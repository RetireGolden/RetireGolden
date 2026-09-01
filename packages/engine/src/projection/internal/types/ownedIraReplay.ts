/**
 * Post-growth owned non-Roth IRA pool sources and the Form 8606 basis-character
 * replay committed from them.
 *
 * One slice of the projection type surface. `../../types.ts` re-exports every
 * slice, so `projection/types.js` stays the single public specifier for all of
 * them; the package export map blocks `projection/internal/*`, so this module
 * is not separately importable. Declarations and the commentary attached to
 * them were moved here verbatim, so a block that says "above" or "below" may
 * now point across a module boundary.
 */
import type {
  AccountId,
  AnnualIraBasisAllocationEvidence,
  AnnualIraBasisRatio,
  PersonId,
  PlanId,
  UsdCents,
} from '../../../actions/index.js'
import type { CompleteSimulatorOwnedNonRothIraAnnualObservation } from
  '../../ownedNonRothIraAnnualObservation.js'

export interface SimulatorOwnedNonRothIraPostGrowthAccountBalanceSource {
  readonly sourceAccountId: string
  /** Physical balance-row identity; optional only for legacy external fixtures. */
  readonly balanceIndex?: number
  readonly balancePlanDollars: number
}

/**
 * One annuity contract an owned IRA bought, and what the engine says it is
 * worth on December 31.
 *
 * Section 408(d)(2)(A) treats every individual retirement plan as one contract
 * for section 72 and Form 8606 line 6 asks for the total VALUE of the
 * traditional IRAs, so a contract bought with IRA dollars belongs in the
 * denominator whether it is a section 408(b) individual retirement annuity or
 * an annuity contract held inside the section 408(a) trust. No authority
 * supplies its fair market value here -- that is an actuarial quantity, and the
 * Form 1099-R instructions for 2026 stop requiring even the issuer to report
 * the year-end value of an annuitized commercial contract -- so this figure is
 * the engine's own convention: premium paid in, payments taken out, floored at
 * zero, with no growth because the Plan carries no contract growth rate.
 * Registered, with its direction of error, as
 * `irc-408-d-2-C-annuity-contract-close-of-year-value`.
 */
export interface SimulatorOwnedNonRothIraPostGrowthAnnuityContractValueSource {
  readonly annuityAccountId: string
  /** The owned IRA whose dollars bought it, which is why it is in this pool. */
  readonly fundingAccountId: string
  /**
   * The channel as this year opened, which the replay needs for the same reason
   * it needs `plan.accounts[].balance`: a settlement that replays ONE year
   * cannot derive where a multi-year channel had got to. It is bounded rather
   * than trusted -- the value can never exceed the purchase premium, and it must
   * be exactly zero in a year at or before the purchase -- and every credit and
   * debit between it and the closing figure has to reconcile in exact cents.
   */
  readonly contractValueOpeningPlanDollars: number
  readonly contractValuePlanDollars: number
}

export interface SimulatorOwnedNonRothIraPostGrowthOwnerPoolSource {
  /** Null is preserved only for an unvalidated malformed Plan; replay must reject it. */
  readonly ownerPersonId: string | null
  readonly accountBalances:
    readonly Readonly<SimulatorOwnedNonRothIraPostGrowthAccountBalanceSource>[]
  /**
   * This owner's IRA-funded annuity contracts, ascending by account id. Empty
   * for every owner who bought none, which is almost every owner. Absent
   * entirely on a year published before this channel existed, which the replay
   * treats as "no contracts" rather than as a missing fact, because a
   * projection with no annuity purchase in it has nothing to say here.
   */
  readonly annuityContractValues?:
    readonly Readonly<SimulatorOwnedNonRothIraPostGrowthAnnuityContractValueSource>[]
}

/**
 * Cheap simulator-owned source facts captured from the live balance ledger
 * after every annual mutation and growth pass. A later internal replay owns
 * exact-cent conversion, pool validation, structural identity, and sealing.
 */
export interface SimulatorAnnualOwnedNonRothIraPostGrowthSource {
  readonly status: 'postGrowthOwnedNonRothIraBalancesCaptured'
  readonly captureBoundary:
    'afterAllAnnualTransactionsAndGrowthBeforeYearResultPublication'
  readonly annualObservationValidation: 'notRun'
  readonly planId: string
  readonly taxYear: number
  readonly ownerPools:
    readonly Readonly<SimulatorOwnedNonRothIraPostGrowthOwnerPoolSource>[]
}

export interface SimulatorOwnedNonRothIraAggregateRothDestinationReplay {
  readonly status: 'aggregateDestinationCreditSourceReconciled'
  readonly destinationAttribution: 'aggregateOnlyNotSourceAllocated'
  readonly actionability: 'notEstablished'
  readonly destinationRothAccountId: AccountId
  readonly destinationOwnerPersonId: PersonId
  readonly destinationCreditedAmount: UsdCents
  readonly producerOccurrenceKeys: readonly string[]
  readonly sourceOwnerPersonIds: readonly PersonId[]
  readonly evidenceId: string
}

export interface SimulatorOwnedNonRothIraAnnualOwnerReplay {
  readonly ownerPersonId: PersonId
  readonly taxYear: number
  readonly openingBasisSource: 'planSeed' | 'priorYearCarryforward'
  readonly openingBasisAmount: UsdCents
  readonly taxYearNondeductibleContributionAmount: 0
  readonly postYearNondeductibleContributionExcludedAmount: 0
  readonly outstandingRolloverAmount: 0
  readonly rolloverRepaymentAdjustmentAmount: 0
  readonly annualObservation:
    Readonly<CompleteSimulatorOwnedNonRothIraAnnualObservation>
  readonly annualBasisRatio: Readonly<AnnualIraBasisRatio>
  readonly line7AllocationEvidence: Readonly<AnnualIraBasisAllocationEvidence>
  readonly line8AllocationEvidence: Readonly<AnnualIraBasisAllocationEvidence>
  readonly nextYearOpeningBasisAmount: UsdCents
  readonly sourceChainEvidenceId: string
  readonly replayEvidenceId: string
}

export interface SimulatorOwnedNonRothIraAnnualReplay {
  readonly taxYear: number
  readonly ownerReplays:
    readonly Readonly<SimulatorOwnedNonRothIraAnnualOwnerReplay>[]
  /**
   * One credit per converting owner, not one per year. IRC 408(d)(3)(A)(i)
   * admits a conversion only between accounts held by the same individual, so
   * the aggregate strategy's household target is sliced by owner and each
   * slice lands in that owner's own Roth. The array is empty in a year with no
   * owned-IRA conversion.
   */
  readonly aggregateRothDestinationCredits:
    readonly Readonly<SimulatorOwnedNonRothIraAggregateRothDestinationReplay>[]
  readonly evidenceId: string
}

/**
 * Exact basis-character evidence published only after the private bounded
 * annual-pass controller commits an observed-versus-assumed exact match.
 * Commit here settles a simulator attempt; it does not establish legal
 * movement, filing completeness, or implementation actionability.
 */
export interface SimulatorCommittedOwnedNonRothIraAnnualReplay {
  readonly status: 'committedOwnedNonRothIraAnnualReplay'
  readonly settlement: 'exactReplayEffectsMatched'
  readonly evidenceScope: 'projectionModelOnlyNotRealWorldFilingCompleteness'
  readonly movement: 'notCommitted'
  readonly actionability: 'notEstablished'
  readonly filingCompleteness: 'notEstablished'
  readonly planId: PlanId
  readonly projectionStartTaxYear: number
  readonly taxYear: number
  readonly sourceSeriesEvidenceId: string
  readonly contiguousReplayEvidenceId: string
  readonly annualReplay: Readonly<SimulatorOwnedNonRothIraAnnualReplay>
}
