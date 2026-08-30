/**
 * Raw simulator-owned capture of retirement-account runtime occurrences and
 * the balance applications they produced, before any replay validates them.
 *
 * One slice of the projection type surface. `../../types.ts` re-exports every
 * slice, so `projection/types.js` stays the single public specifier for all of
 * them; the package export map blocks `projection/internal/*`, so this module
 * is not separately importable. Declarations and the commentary attached to
 * them were moved here verbatim, so a block that says "above" or "below" may
 * now point across a module boundary.
 */
import type { SimulatorAnnualRetirementRuntimeOccurrence } from '../../annualRetirementRuntimeJournal.js'

/**
 * One donor's share of a charitable gift routed out of a required distribution.
 *
 * IRC 408(d)(8)(D) is measured against ONE individual's retirement plans treated
 * as one contract, and each owner has their own Form 8606 denominator, so the
 * routed gift is only characterizable once it is charged to the owners whose
 * required distributions carried it. Both figures are published because they are
 * different amounts and answer different questions: the routed gross is what the
 * published annual QCD total is made of, and the qualified amount is the part of
 * it that (D) deems includible and that the Form 8606 line-7 instructions
 * therefore keep off line 7. They differ exactly where the gift ran past the
 * owner's aggregate includible amount, since the excess is not a QCD at all and
 * stays in the section 72 computation.
 */
export interface SimulatorAnnualRetirementLegacyQcdOwnerAttribution {
  readonly ownerPersonId: string
  /** Gross routed out of THIS owner's owned-IRA required distributions. */
  readonly routedGrossPlanDollars: number
  /**
   * The part of that routed gross which qualified under 408(d)(8)(D) and must
   * therefore leave this owner's Form 8606 line-7 gross and the annual
   * denominator built from it. Never greater than the routed gross.
   */
  readonly qualifiedLine7ExclusionPlanDollars: number
}

/**
 * How much of one moving charitable draw was a qualified charitable
 * distribution, and how much of it never was.
 *
 * IRC 408(d)(8)(B)'s closing sentence treats a distribution as a QCD "only to
 * the extent that the distribution would be includible in gross income", and
 * (D) caps that at the owner's aggregate includible amount. A draw past the cap
 * is an ordinary distribution: the Form 8606 line-7 instructions exclude
 * "Qualified charitable distributions (QCDs)" by name and nothing else, so the
 * unqualified part belongs on line 7, inside the line-9 denominator, recovering
 * basis pro rata.
 *
 * Published per occurrence rather than per owner because the replay prices Form
 * 8606 one occurrence at a time, and an owner-level remainder cannot say which
 * account's draw it was. The routed half of the same gift travels on the
 * nonmoving overlay instead, because it moves no dollars of its own and has no
 * occurrence to ride.
 */
export interface SimulatorAnnualRetirementLegacyQcdCharacterization {
  /** Exact key of the `legacyQcd` occurrence this characterizes. */
  readonly producerOccurrenceKey: string
  readonly ownerPersonId: string
  readonly grossAmountPlanDollars: number
  /**
   * The part of that gross which was NOT a qualified charitable distribution
   * and therefore stays on Form 8606 line 7. Never greater than the gross; zero
   * on the ordinary household, whose gift is inside its aggregate includible
   * amount.
   */
  readonly nonQualifiedLine7GrossPlanDollars: number
}

/**
 * The share of the published annual QCD total that moved no additional dollars
 * because an RMD debit already carried it out of the owned IRA. A gift taken
 * with no RMD behind it is not in here: it physically leaves an account and is
 * published as a `legacyQcd` runtime occurrence with its own application.
 *
 * It carries no single owner or source account because it is a household gift
 * spread over whichever required distributions funded it; `ownerAttributions`
 * is how the replay learns whose line-7 gross it shrinks, and it is what makes
 * this overlay replayable instead of a refusal.
 */
export interface SimulatorAnnualRetirementNonmovingLegacyQcdOverlay {
  readonly status: 'nonmovingLegacyQcdCaptured'
  readonly kind: 'legacyQcd'
  readonly taxYear: number
  readonly grossAmountPlanDollars: number
  /** Ascending by owner id, positive routed shares only, summing to the gross. */
  readonly ownerAttributions:
    readonly Readonly<SimulatorAnnualRetirementLegacyQcdOwnerAttribution>[]
  readonly physicalMovement: 'notAdditionalMovement'
  readonly inventoryReplay: 'attributedToOwnedIraRequiredDistributionGrosses'
}

export interface SimulatorAnnualRetirementRuntimeSource {
  readonly status: 'runtimeOccurrenceSourcesCaptured'
  readonly captureBoundary:
    'legacyAnnualPassCommittedBeforeYearResultPublication'
  readonly journalValidation: 'notRun'
  readonly planId: string
  readonly taxYear: number
  readonly runtimeOccurrences:
    readonly Readonly<SimulatorAnnualRetirementRuntimeOccurrence>[]
  readonly nonmovingLegacyQcdOverlay:
    Readonly<SimulatorAnnualRetirementNonmovingLegacyQcdOverlay> | null
  /**
   * One entry per `legacyQcd` occurrence, in the order the draws moved. Empty
   * in a year whose gift moved nothing on its own.
   */
  readonly legacyQcdCharacterizations:
    readonly Readonly<SimulatorAnnualRetirementLegacyQcdCharacterization>[]
}

export type SimulatorRetirementRuntimeApplicationPhase =
  | 'annuityPurchaseFunding'
  /**
   * The other half of the premium. `annuityPurchaseFunding` debits the IRA the
   * premium left; this credits the contract it arrived in, so the value the
   * Form 8606 line-6 aggregate has to carry is recorded where it went instead
   * of being inferred from where it came from.
   */
  | 'annuityPurchaseContractCredit'
  /**
   * A payment out of a contract an owned IRA bought. It runs after the premium
   * and before the year's contributions, which is where the projection's income
   * block sits, and it debits the contract's value channel rather than any IRA
   * balance.
   */
  | 'annuityContractDistribution'
  | 'pensionLumpSumRollover'
  | 'employeeContribution'
  | 'ownerRmdDistribution'
  | 'automaticSeppDistribution'
  | 'legacyQcdDistribution'
  | 'namedQcdDistribution'
  | 'namedRothConversionDebit'
  | 'namedRothConversionDestinationCredit'
  | 'legacyRothConversion'
  | 'legacyRothConversionAggregateDestinationCredit'
  | 'legacyNeedBasedWithdrawal'

interface SimulatorRetirementRuntimeApplicationBase {
  /** Exact key of the raw runtime occurrence that this mutation applied. */
  readonly producerOccurrenceKey: string
  /** Truthful simulator pass; not a civil date or authoritative schedule. */
  readonly simulatorPhase: SimulatorRetirementRuntimeApplicationPhase
  /** One-based order of captured retirement applications in this annual pass. */
  readonly mutationOrdinal: number
  /** Raw Plan identity is preserved; later replay rejects missing/invalid facts. */
  readonly ownerPersonId: string | null
  readonly sourceAccountId: string | null
  readonly sourceBalanceBeforePlanDollars: number
  readonly sourceBalanceAfterPlanDollars: number
}

export interface SimulatorRetirementRuntimeDebitApplication
  extends SimulatorRetirementRuntimeApplicationBase {
  readonly applicationKind: 'debit'
  readonly appliedAmountPlanDollars: number
}

export interface SimulatorRetirementRuntimeCreditApplication
  extends SimulatorRetirementRuntimeApplicationBase {
  readonly applicationKind: 'credit'
  readonly creditedAmountPlanDollars: number
}

export interface SimulatorRetirementRuntimeAggregateRothDestinationCredit {
  readonly applicationKind: 'aggregateRothDestinationCredit'
  readonly simulatorPhase: 'legacyRothConversionAggregateDestinationCredit'
  readonly mutationOrdinal: number
  readonly producerOccurrenceKey: null
  readonly ownerPersonId: null
  readonly sourceAccountId: null
  readonly sourceBalanceBeforePlanDollars: null
  readonly sourceBalanceAfterPlanDollars: null
  /** Exact runtime occurrence keys whose debits produced this one legacy credit. */
  readonly producerOccurrenceKeys: readonly string[]
  readonly sourceOwnerPersonIds: readonly (string | null)[]
  readonly destinationRothAccountId: string | null
  readonly destinationOwnerPersonId: string | null
  readonly destinationBalanceBeforePlanDollars: number
  readonly destinationCreditedAmountPlanDollars: number
  readonly destinationBalanceAfterPlanDollars: number
}

/**
 * One named conversion's own destination credit.
 *
 * This is deliberately not the aggregate shape above. That one exists because
 * the legacy strategy has a single household destination and picks it by Plan
 * array position; a named request states its destination, so this credit
 * carries the `actionId` that chose it and is validated against that request's
 * `destinationRothAccountId` alone. Two requests in the same year therefore
 * produce two credits to two different Roth accounts, which the aggregate
 * shape cannot express.
 */
export interface SimulatorRetirementRuntimeNamedRothDestinationCredit {
  readonly applicationKind: 'namedRothDestinationCredit'
  readonly simulatorPhase: 'namedRothConversionDestinationCredit'
  readonly mutationOrdinal: number
  readonly producerOccurrenceKey: null
  readonly ownerPersonId: null
  readonly sourceAccountId: null
  readonly sourceBalanceBeforePlanDollars: null
  readonly sourceBalanceAfterPlanDollars: null
  /** The named request whose committed movement produced this credit. */
  readonly actionId: string
  /** Exact runtime occurrence keys whose debits produced this one credit. */
  readonly producerOccurrenceKeys: readonly string[]
  readonly sourceOwnerPersonIds: readonly (string | null)[]
  readonly destinationRothAccountId: string | null
  readonly destinationOwnerPersonId: string | null
  readonly destinationBalanceBeforePlanDollars: number
  readonly destinationCreditedAmountPlanDollars: number
  readonly destinationBalanceAfterPlanDollars: number
}

/**
 * The credit side of an annuity premium paid out of an owned IRA.
 *
 * Shaped like the two Roth destination credits above, and for the same reason:
 * one physical movement has one occurrence, and a credit that rejoined that
 * occurrence a second time would break the replay's rule that each application
 * rejoins one unique occurrence. So the key travels in `producerOccurrenceKeys`
 * and this application carries no key of its own.
 *
 * What it credits is not a balance. A Plan annuity account has no balance field
 * and is not in the projection's ledger at all, so the destination figures
 * below are the engine's own contract-value channel: premium in, payments out,
 * floored at zero. That channel is a convention rather than a fair market
 * value, registered as
 * `irc-408-d-2-C-annuity-contract-close-of-year-value`.
 */
export interface SimulatorRetirementRuntimeAnnuityContractPremiumCredit {
  readonly applicationKind: 'annuityContractPremiumCredit'
  readonly simulatorPhase: 'annuityPurchaseContractCredit'
  readonly mutationOrdinal: number
  readonly producerOccurrenceKey: null
  readonly ownerPersonId: null
  readonly sourceAccountId: null
  readonly sourceBalanceBeforePlanDollars: null
  readonly sourceBalanceAfterPlanDollars: null
  /** Exactly one key: the `annuityFundingTransfer` debit that paid the premium. */
  readonly producerOccurrenceKeys: readonly string[]
  readonly sourceOwnerPersonIds: readonly (string | null)[]
  readonly destinationAnnuityAccountId: string | null
  readonly destinationOwnerPersonId: string | null
  readonly destinationContractValueBeforePlanDollars: number
  readonly destinationCreditedAmountPlanDollars: number
  readonly destinationContractValueAfterPlanDollars: number
}

export type SimulatorRetirementRuntimeApplication =
  | Readonly<SimulatorRetirementRuntimeDebitApplication>
  | Readonly<SimulatorRetirementRuntimeCreditApplication>
  | Readonly<SimulatorRetirementRuntimeNamedRothDestinationCredit>
  | Readonly<SimulatorRetirementRuntimeAnnuityContractPremiumCredit>
  | Readonly<SimulatorRetirementRuntimeAggregateRothDestinationCredit>

/**
 * Cheap simulator-owned balance transitions captured at the actual owned,
 * non-inherited traditional-IRA mutation sites, plus the one unchanged legacy
 * aggregate Roth destination credit when those sources fund a conversion. A
 * later internal replay owns exact-cent conversion, occurrence/inventory
 * rejoining, validation, identity, and sealing.
 */
export interface SimulatorAnnualRetirementRuntimeApplicationSource {
  readonly status: 'runtimeApplicationSourcesCaptured'
  readonly captureBoundary:
    'atOwnedNonRothIraMutationSitesBeforeAnnualGrowth'
  readonly applicationValidation: 'notRun'
  readonly planId: string
  readonly taxYear: number
  readonly applications:
    readonly Readonly<SimulatorRetirementRuntimeApplication>[]
}
