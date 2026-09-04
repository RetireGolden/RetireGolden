/**
 * Capture the year's retirement runtime journal for later replay: the ordered
 * occurrence source, its nonmoving legacy-QCD overlay, and the mutation-ordered
 * application source.
 *
 * **Why it is a sub-phase.** These two frozen records read nine values and
 * write nothing. Inside `annualFundingApplicationAndClosePhase` they sat in the
 * middle of a body that destructures 91 `Facts` fields, 22 mutable `Ledger`
 * fields and 14 callbacks, with nothing saying which of those they touched.
 * Now the answer is the input type.
 *
 * **Two orderings, deliberately different, and both are evidence.**
 * Occurrences are sorted into the caller's canonical order because replay has
 * to reproduce a stable series. Applications are NOT sorted: mutation order is
 * itself the evidence, and account-order-dependent legacy commits have to stay
 * visible to a later replay.
 *
 * Move-only out of the funding phase: the expressions, the freezes, the
 * comparators and the two capture-boundary labels are unchanged.
 */
import type { SimulatorAnnualRetirementRuntimeOccurrence } from
  '../annualRetirementRuntimeJournal.js'
import type { SimulatorRetirementRuntimeApplication } from '../types.js'
import { compareUtf16CodeUnits } from '../../actions/structuralId.js'

export interface AnnualRuntimeJournalCapturePhaseInput {
  readonly planId: string
  readonly year: number
  readonly annualRetirementRuntimeOccurrences:
    readonly SimulatorAnnualRetirementRuntimeOccurrence[]
  readonly canonicalRuntimeOccurrenceOrder: (
    left: SimulatorAnnualRetirementRuntimeOccurrence,
    right: SimulatorAnnualRetirementRuntimeOccurrence,
  ) => number
  readonly annualRetirementRuntimeApplications:
    readonly SimulatorRetirementRuntimeApplication[]
  /** The year's routed legacy-QCD gross, and its two owner attributions. */
  readonly qcdFromRmd: number
  readonly qcdFromRmdByOwner: ReadonlyMap<string, number>
  readonly qcdQualifiedFromRmdByOwner: ReadonlyMap<string, number>
  readonly legacyQcdCharacterizations: readonly Readonly<{
    readonly producerOccurrenceKey: string
    readonly ownerPersonId: string
    readonly grossAmountPlanDollars: number
    readonly nonQualifiedLine7GrossPlanDollars: number
  }>[]
}

export type AnnualRuntimeJournalCapturePhaseResult =
  ReturnType<typeof annualRuntimeJournalCapturePhase>

export function annualRuntimeJournalCapturePhase(
  input: AnnualRuntimeJournalCapturePhaseInput,
) {
  const {
    planId,
    year,
    qcdFromRmd,
    qcdFromRmdByOwner,
    qcdQualifiedFromRmdByOwner,
    legacyQcdCharacterizations,
  } = input
  const retirementRuntimeSource = Object.freeze({
    status: 'runtimeOccurrenceSourcesCaptured' as const,
    captureBoundary:
      'legacyAnnualPassCommittedBeforeYearResultPublication' as const,
    journalValidation: 'notRun' as const,
    planId,
    taxYear: year,
    runtimeOccurrences: Object.freeze(
      [...input.annualRetirementRuntimeOccurrences]
        .sort(input.canonicalRuntimeOccurrenceOrder)
        .map((occurrence) => Object.freeze({ ...occurrence })),
    ),
    // Only the routed share belongs in the nonmoving overlay. The rest of the
    // annual total left an owned IRA under its own occurrences above, and
    // publishing it here as well would double-count the gift.
    //
    // The attribution travels with it, which is what lets the owned-IRA
    // runtime source series characterize a gift year instead of refusing it.
    // Both figures are the ones the 408(d)(8)(D) block settled above:
    // `qcdFromRmdByOwner` is the routed gross the published annual total is
    // made of, and `qcdQualifiedFromRmdByOwner` is the carve the deferred
    // forced distributions were committed against, so the replay reproduces
    // the ledger's own line-7 grosses rather than deriving rival ones.
    nonmovingLegacyQcdOverlay: qcdFromRmd > 0
      ? Object.freeze({
        status: 'nonmovingLegacyQcdCaptured' as const,
        kind: 'legacyQcd' as const,
        taxYear: year,
        grossAmountPlanDollars: qcdFromRmd,
        ownerAttributions: Object.freeze(
          [...qcdFromRmdByOwner.entries()]
            .filter(([, routed]) => routed > 0)
            .sort(([left], [right]) => compareUtf16CodeUnits(left, right))
            .map(([ownerPersonId, routedGrossPlanDollars]) => Object.freeze({
              ownerPersonId,
              routedGrossPlanDollars,
              qualifiedLine7ExclusionPlanDollars: Math.min(
                routedGrossPlanDollars,
                qcdQualifiedFromRmdByOwner.get(ownerPersonId) ?? 0,
              ),
            })),
        ),
        physicalMovement: 'notAdditionalMovement' as const,
        inventoryReplay:
          'attributedToOwnedIraRequiredDistributionGrosses' as const,
      })
      : null,
    // The moving half's characterization, in the order the draws moved. The
    // 408(d)(8)(D) block sized each one against the owner's aggregate
    // includible amount, so the replay reads which part of each draw was a
    // gift and which part was an ordinary distribution rather than assuming
    // the whole of it was the former.
    legacyQcdCharacterizations: Object.freeze(
      legacyQcdCharacterizations.map((entry) => Object.freeze({ ...entry })),
    ),
  })
  const retirementRuntimeApplicationSource = Object.freeze({
    status: 'runtimeApplicationSourcesCaptured' as const,
    captureBoundary:
      'atOwnedNonRothIraMutationSitesBeforeAnnualGrowth' as const,
    applicationValidation: 'notRun' as const,
    planId,
    taxYear: year,
    // Mutation order is evidence. Do not sort this array: account-order
    // dependent legacy commits must remain visible to later replay.
    applications: Object.freeze(
      input.annualRetirementRuntimeApplications.map((application) =>
        application.applicationKind === 'aggregateRothDestinationCredit' ||
          application.applicationKind === 'namedRothDestinationCredit'
          ? Object.freeze({
            ...application,
            producerOccurrenceKeys: Object.freeze([
              ...application.producerOccurrenceKeys,
            ]),
            sourceOwnerPersonIds: Object.freeze([
              ...application.sourceOwnerPersonIds,
            ]),
          })
          : Object.freeze({ ...application }),
      ),
    ),
  })

  return { retirementRuntimeSource, retirementRuntimeApplicationSource }
}
