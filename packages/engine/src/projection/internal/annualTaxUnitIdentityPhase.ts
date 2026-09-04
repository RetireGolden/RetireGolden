/**
 * Names the filing unit every exact-cent action evidence in one annual pass
 * answers to, and the two derived records that quote it.
 *
 * This phase owns no economic movement and reads nothing the caller has not
 * already fixed for the year. It is a pure derivation over four inputs — the
 * year, the household, the year's resolved filing status, and each person's
 * survival — plus the Plan's own retirement-action array for the
 * counterfactual's omission set.
 *
 * Extracted from `simulatePlan`'s year loop as a move: the expressions, their
 * order, and the `null` answers below are the caller's, unchanged.
 */
import {
  stateForYear,
  stateResidencySegmentsForYear,
  type Household,
} from '../../model/plan.js'
import { asPersonId, type ActionId, type RetirementActionRequest } from
  '../../actions/index.js'
import { deriveActionStructuralId } from '../../actions/structuralId.js'
import type { AnnualLiabilityRunTaxInput } from
  '../../actions/annualLiabilityRunIdentity.js'
import type { ConversionTaxFundingTaxUnitEvidence } from
  '../../actions/conversionTaxFundingEvidence.js'
import type { ProjectedFilingStatus } from '../types.js'

/** Exactly the two person facts this phase reads off the year's state. */
export interface AnnualTaxUnitIdentityPhasePerson {
  readonly personId: string
  readonly alive: boolean
}

/** The unambiguously named filing unit for one year, or nothing. */
export type AnnualActionTaxUnit = Readonly<{
  taxUnitId: string
  taxUnitEvidenceId: string
  stateFilingStatusId: string
  federalFilingStatus:
    'single' | 'marriedFilingJointly' | 'qualifyingSurvivingSpouse'
  members: readonly [
    ReturnType<typeof asPersonId>,
    ...ReturnType<typeof asPersonId>[],
  ]
}>

export interface AnnualTaxUnitIdentityPhaseInput {
  readonly year: number
  readonly household: Household
  /** The status the caller already resolved from this year's alive count. */
  readonly filingStatusForYear: ProjectedFilingStatus
  /** Survival is fixed for the whole year before the annual pass opens. */
  readonly peopleStates: readonly AnnualTaxUnitIdentityPhasePerson[]
  /** Read off the Plan, not off the in-pass assessment; see the omission set. */
  readonly retirementActions: readonly Readonly<RetirementActionRequest>[]
}

export interface AnnualTaxUnitIdentityPhaseResult {
  readonly annualActionTaxUnit: AnnualActionTaxUnit | null
  readonly conversionFundingTaxUnitEvidence:
    Readonly<ConversionTaxFundingTaxUnitEvidence> | null
  readonly annualLiabilityNonGroupTaxInputs:
    readonly Readonly<AnnualLiabilityRunTaxInput>[]
  readonly annualLinkedGroupOmissionIds: readonly ActionId[]
}

export function annualTaxUnitIdentityPhase(
  input: AnnualTaxUnitIdentityPhaseInput,
): AnnualTaxUnitIdentityPhaseResult {
  const { year, household, filingStatusForYear, peopleStates } = input

  /**
   * The filing unit every exact-cent action evidence in this year answers to,
   * or null when the projection cannot name one unambiguously.
   *
   * Derived once at year scope rather than inside the annual pass. Nothing in
   * it depends on the pass — `peopleStates` fixes each person's survival for
   * the whole year before the pass opens, the filing status follows from
   * that, and the state-filing inputs are read off the household — so
   * computing it per pass produced the same four values every time. What
   * moving it buys is that the annual liability runs can name their filing
   * unit: a counterfactual pass runs *around* the pass rather than inside it,
   * and a tax unit that only existed within one could not be the unit both
   * runs answer for.
   *
   * Null is a real answer and not a fallback. A year where three people are
   * alive under a joint status, or where a person's identity does not satisfy
   * the action layer's nonblank contract, has no unambiguous unit, and
   * inventing one would attribute a liability to a filing unit that never
   * filed.
   */
  const annualActionTaxUnit = ((): AnnualActionTaxUnit | null => {
    let aliveTaxUnitMemberIds: ReturnType<typeof asPersonId>[]
    try {
      aliveTaxUnitMemberIds = peopleStates
        .filter((state) => state.alive)
        .map((state) => asPersonId(state.personId))
        .sort((left, right) => left < right ? -1 : left > right ? 1 : 0)
    } catch {
      // A persisted household ID can satisfy the Plan's legacy string
      // schema without satisfying action identity's nonblank contract.
      // Omit tax-unit evidence rather than letting unrelated cash/equity
      // action execution fail with a validation exception.
      return null
    }
    const federalFilingStatus =
      filingStatusForYear === 'marriedFilingJointly' &&
        aliveTaxUnitMemberIds.length === 2
        ? 'marriedFilingJointly' as const
        : (filingStatusForYear === 'single' ||
            filingStatusForYear === 'qualifyingSurvivingSpouse') &&
          aliveTaxUnitMemberIds.length === 1
          ? filingStatusForYear
          : null
    if (federalFilingStatus === null) return null
    const members = aliveTaxUnitMemberIds as [
      ReturnType<typeof asPersonId>,
      ...ReturnType<typeof asPersonId>[],
    ]
    const annualStateFilingInputs = [
      stateForYear(household, year),
      stateResidencySegmentsForYear(household, year),
    ] as const
    try {
      return {
        taxUnitId: deriveActionStructuralId('projection-tax-unit', [
          year,
          filingStatusForYear,
          members,
        ]),
        taxUnitEvidenceId: deriveActionStructuralId('projection-tax-unit-evidence', [
          year,
          filingStatusForYear,
          members,
          annualStateFilingInputs,
        ]),
        stateFilingStatusId: deriveActionStructuralId('projection-state-filing-status', [
          year,
          filingStatusForYear,
          members,
          annualStateFilingInputs,
        ]),
        federalFilingStatus,
        members,
      }
    } catch {
      // Same fail-closed omission as the nonblank-identity catch above: a
      // malformed direct simulatePlan call can hand a year, filing status or
      // household state that satisfies the Plan's legacy type but not
      // `deriveActionStructuralId`'s stricter JSON-serializable contract.
      // Omit tax-unit evidence rather than letting unrelated cash/equity
      // action execution fail with a validation exception.
      return null
    }
  })()

  /** The same unit, in the shape the conversion funding contract names it. */
  const conversionFundingTaxUnitEvidence:
    Readonly<ConversionTaxFundingTaxUnitEvidence> | null =
    annualActionTaxUnit === null
      ? null
      : {
        taxUnitId: annualActionTaxUnit.taxUnitId,
        taxYear: year,
        federalFilingStatus: annualActionTaxUnit.federalFilingStatus,
        stateFilingStatusId: annualActionTaxUnit.stateFilingStatusId,
        taxUnitEvidenceId: annualActionTaxUnit.taxUnitEvidenceId,
        taxUnitMemberPersonIds: annualActionTaxUnit.members,
      }

  /**
   * What the year's two annual liability runs were computed from, other than
   * which requests each of them ran.
   *
   * The baseline and the candidate must agree about every one of these or
   * their difference is not the group's tax effect but the difference between
   * two unrelated calculations. They are stated as the filing unit's own
   * evidence identifiers rather than re-enumerated as figures: the tax-unit
   * evidence ID is already derived from the year, the filing status, the
   * exact member set and the state-filing inputs, so it is the compact,
   * already-canonical name for the run's non-group inputs. Both runs read the
   * same one because it is computed once, at year scope, above.
   */
  const annualLiabilityNonGroupTaxInputs:
    readonly Readonly<AnnualLiabilityRunTaxInput>[] =
    annualActionTaxUnit === null
      ? []
      : [
        {
          inputId: 'taxUnitEvidenceId',
          value: {
            representation: 'declaredTerm',
            term: annualActionTaxUnit.taxUnitEvidenceId,
          },
        },
        {
          inputId: 'federalFilingStatus',
          value: {
            representation: 'declaredTerm',
            term: annualActionTaxUnit.federalFilingStatus,
          },
        },
        {
          inputId: 'stateFilingStatusId',
          value: {
            representation: 'declaredTerm',
            term: annualActionTaxUnit.stateFilingStatusId,
          },
        },
        {
          inputId: 'taxUnitMemberPersonIds',
          value: {
            representation: 'declaredTerm',
            term: JSON.stringify(annualActionTaxUnit.members),
          },
        },
      ]

  /**
   * Both legs of every conversion-linked withdrawal group this year declares.
   *
   * This is the counterfactual's omission set, and it is read off the Plan
   * rather than off the assessment inside the pass, because the counterfactual
   * has to be launched before any pass runs. The two agree by construction:
   * the assessment reads the same conversions out of the same array.
   *
   * Both legs, not just the conversion. `T0` is the unit's liability with
   * "every conversion in this annual group and every dedicated linked
   * withdrawal omitted", and a baseline that removed the conversion while
   * leaving its funding withdrawal to draw down a taxable account would
   * measure the withdrawal's own tax as part of the group's cost.
   */
  const annualLinkedGroupOmissionIds: readonly ActionId[] = (() => {
    const ids = new Set<ActionId>()
    for (const request of input.retirementActions) {
      if (
        request.kind !== 'rothConversion' ||
        request.year !== year ||
        request.taxFunding.kind !== 'linkedWithdrawal'
      ) continue
      ids.add(request.actionId)
      ids.add(request.taxFunding.withdrawalActionId)
    }
    return [...ids]
  })()

  return {
    annualActionTaxUnit,
    conversionFundingTaxUnitEvidence,
    annualLiabilityNonGroupTaxInputs,
    annualLinkedGroupOmissionIds,
  }
}
