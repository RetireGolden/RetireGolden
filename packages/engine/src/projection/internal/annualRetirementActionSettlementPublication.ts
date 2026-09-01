/**
 * Publish the retirement-action evidence that can only be assembled after the
 * annual tax/withdrawal solve has settled.
 *
 * WHAT IT TAKES: the committed ordinary, Roth-conversion, and QCD executor
 * results; the final linked-group assessment; the filing-unit liability
 * evidence; and the year's settled tax and penalties.
 *
 * WHAT IT PRODUCES: the publication-eligible QCD prerequisite batch, the
 * conversion-linked withdrawal-group execution evidence, and the canonical
 * annual retirement-action publication. Optional outputs preserve the former
 * fail-closed gates exactly.
 *
 * WHAT IT REFUSES: this coordinator neither moves balances nor recalculates
 * tax, penalties, or withdrawal amounts. `simulatePlan` retains the ordered
 * economic commits and calls this boundary only after those figures exist.
 */
import {
  asUsdCents,
  executeConversionLinkedWithdrawalGroups,
  ordinaryWithdrawalPublicationEligibility,
  ordinaryWithdrawalPublicationSource,
  publishAnnualRetirementActions,
  rothConversionPublicationEligibility,
  rothConversionPublicationSource,
  type AnnualRetirementActionPublication,
  type ConversionLinkedWithdrawalGroupAssessment,
  type ConversionLinkedWithdrawalGroupLiabilityRun,
  type ConversionLinkedWithdrawalGroupMemberInput,
  type ConversionLinkedWithdrawalGroupMovementInput,
  type EvaluateAnnualQcdExecutionPrerequisitesResult,
  type ExecuteAnnualQcdsResult,
  type ExecuteConversionLinkedWithdrawalGroupsResult,
  type ExecuteOrdinaryWithdrawalsResult,
  type ExecuteRothConversionsResult,
  type RetirementActionRequest,
} from '../../actions/index.js'
import {
  mintAnnualLiabilityRunIdentity,
  type AnnualLiabilityRunTaxInput,
} from '../../actions/annualLiabilityRunIdentity.js'
import type {
  ConversionTaxFundingTaxUnitEvidence,
} from '../../actions/conversionTaxFundingEvidence.js'
import { deriveActionStructuralId } from '../../actions/structuralId.js'
import {
  COUNTERFACTUAL_OMISSION_TAX_INPUT_ID,
  exactAnnualLiabilityFromPlanDollars,
} from '../../internal/counterfactualAnnualLiability.js'

type EvaluatedQcdPrerequisites = Extract<
  EvaluateAnnualQcdExecutionPrerequisitesResult,
  Readonly<{ status: 'evaluated' }>
>

export interface AnnualRetirementActionSettlementPublicationInput {
  readonly planId: string
  readonly taxYear: number
  readonly taxPlanDollars: number
  readonly penaltiesPlanDollars: number
  readonly retirementActionExecution?: Readonly<ExecuteOrdinaryWithdrawalsResult>
  readonly rothConversionActionExecution?: Readonly<ExecuteRothConversionsResult>
  readonly qcdActionPrerequisiteResult?: Readonly<EvaluateAnnualQcdExecutionPrerequisitesResult>
  readonly qcdActionExecution?: Readonly<ExecuteAnnualQcdsResult>
  readonly linkedGroupAssessmentRequests:
    readonly Readonly<RetirementActionRequest>[]
  readonly linkedWithdrawalGroups:
    Readonly<ConversionLinkedWithdrawalGroupAssessment>
  readonly conversionFundingTaxUnitEvidence:
    Readonly<ConversionTaxFundingTaxUnitEvidence> | null
  readonly annualLiabilityBaseline:
    Readonly<ConversionLinkedWithdrawalGroupLiabilityRun> | null
  readonly annualLiabilityNonGroupTaxInputs:
    readonly Readonly<AnnualLiabilityRunTaxInput>[]
}

export interface AnnualRetirementActionSettlementPublicationResult {
  readonly qcdActionPrerequisites?: Readonly<EvaluatedQcdPrerequisites>
  readonly conversionLinkedWithdrawalGroupExecution?:
    Readonly<ExecuteConversionLinkedWithdrawalGroupsResult>
  readonly retirementActionPublication?:
    Readonly<AnnualRetirementActionPublication>
}

/** Pure with respect to the caller's executor, assessment, and evidence data. */
export function annualRetirementActionSettlementPublication(
  input: AnnualRetirementActionSettlementPublicationInput,
): AnnualRetirementActionSettlementPublicationResult {
  const ordinaryPublicationEligibility =
    input.retirementActionExecution === undefined
      ? undefined
      : ordinaryWithdrawalPublicationEligibility(
          input.retirementActionExecution,
        )
  const conversionPublicationEligibility =
    input.rothConversionActionExecution === undefined
      ? undefined
      : rothConversionPublicationEligibility(
          input.rothConversionActionExecution,
        )
  const retirementActionPublicationEligible =
    ordinaryPublicationEligibility?.kind !== 'legacyScheduleDiagnosticsOnly' &&
    conversionPublicationEligibility?.kind !== 'legacyScheduleDiagnosticsOnly'

  // A blocked prerequisite batch has no publication source and no canonical
  // requests, so the year publishes neither rather than half of either. The
  // evidence also follows the publication boundary: in a legacy
  // diagnostics-only year no executor source publishes, and prerequisite
  // evidence with no publication record behind it would be orphaned.
  const qcdActionPrerequisites =
    retirementActionPublicationEligible &&
    input.qcdActionPrerequisiteResult?.status === 'evaluated'
      ? input.qcdActionPrerequisiteResult
      : undefined
  const retirementActionPublicationSources =
    retirementActionPublicationEligible
      ? [
          ...(input.retirementActionExecution === undefined
            ? []
            : [ordinaryWithdrawalPublicationSource(
                input.retirementActionExecution,
              )]),
          ...(input.rothConversionActionExecution === undefined
            ? []
            : [rothConversionPublicationSource(
                input.rothConversionActionExecution,
              )]),
          ...(qcdActionPrerequisites === undefined
            ? []
            // The executor's own source wins when it settled the year; the
            // prerequisite source is the otherwise case. They are the same
            // shape and must never both publish for one action.
            : [input.qcdActionExecution?.committed === true
                ? input.qcdActionExecution.publicationSource
                : qcdActionPrerequisites.publicationSource]),
        ]
      : []
  const retirementActionPublicationRequests = [
    ...(input.retirementActionExecution?.requests ?? []),
    ...(input.rothConversionActionExecution?.requests ?? []),
    ...(qcdActionPrerequisites?.requests ?? []),
  ]

  /**
   * Name the committed run as `T1(F)`. This is not a third pass: the run that
   * commits is the run with the group's requests present, so its final tax and
   * penalties are the candidate liability. Its funding vector is the actual
   * withdrawal cents executed for each group; omitting that vector would make
   * a different candidate indistinguishable from this one.
   */
  const committedAnnualLiabilityRun = ():
    Readonly<ConversionLinkedWithdrawalGroupLiabilityRun> | null => {
    const unit = input.conversionFundingTaxUnitEvidence
    if (unit === null) return null
    const liability = exactAnnualLiabilityFromPlanDollars(
      input.taxPlanDollars,
      input.penaltiesPlanDollars,
    )
    if (liability === null) return null
    const executedByActionId = new Map(
      (input.retirementActionExecution?.evidence ?? []).map((evidence) =>
        [evidence.actionId, evidence.disposition.executedAmount] as const),
    )
    const fundingVector = input.linkedWithdrawalGroups.groups.map((group) => [
      group.conversionActionId,
      group.withdrawalActionId,
      executedByActionId.get(group.withdrawalActionId) ?? 0,
    ])
    const minted = mintAnnualLiabilityRunIdentity({
      planId: input.planId,
      taxUnitId: unit.taxUnitId,
      taxYear: input.taxYear,
      liabilityRun: {
        liabilityRunKind: 'candidateT1',
        candidateFundingVectorEvidenceId: deriveActionStructuralId(
          'retirement-action-conversion-tax-funding-vector',
          [unit.taxUnitId, input.taxYear, fundingVector],
        ),
      },
      taxInputs: [
        ...input.annualLiabilityNonGroupTaxInputs,
        {
          inputId: COUNTERFACTUAL_OMISSION_TAX_INPUT_ID,
          // Stated, not omitted. "This run removed nothing" is what makes this
          // identity comparable to a baseline that states what it removed.
          value: { representation: 'declaredTerm', term: JSON.stringify([]) },
        },
      ],
    })
    return minted.status === 'annualLiabilityRunIdentityMinted'
      ? { liability, identity: minted.identity }
      : null
  }

  /**
   * Execute the year's linked-group evidence only after `T1(F)` exists. The
   * earlier assessment is unchanged; this adds the settled liability evidence
   * that could not precede the funding solve. A refused conversion contributes
   * no taxable principal, and an unexecuted withdrawal contributes no funding.
   */
  const conversionLinkedWithdrawalGroupExecution =
    input.linkedWithdrawalGroups.groups.length === 0
      ? undefined
      : executeConversionLinkedWithdrawalGroups({
          taxYear: input.taxYear,
          requests: input.linkedGroupAssessmentRequests,
          assessment: input.linkedWithdrawalGroups,
          taxUnit: input.conversionFundingTaxUnitEvidence,
          baseline: input.annualLiabilityBaseline,
          candidate: committedAnnualLiabilityRun(),
          movements: input.linkedWithdrawalGroups.groups.map(
            (group): ConversionLinkedWithdrawalGroupMovementInput => {
              const conversionEvidence =
                input.rothConversionActionExecution?.evidence.find(
                  (evidence) =>
                    evidence.actionId === group.conversionActionId,
                )
              const withdrawalEvidence =
                input.retirementActionExecution?.evidence.find(
                  (evidence) =>
                    evidence.actionId === group.withdrawalActionId,
                )
              return {
                conversionActionId: group.conversionActionId,
                withdrawalActionId: group.withdrawalActionId,
                conversion: {
                  authoredAmount: asUsdCents(
                    conversionEvidence?.requestedAmount ?? 0,
                  ),
                  executedAmount: asUsdCents(
                    conversionEvidence?.executedAmount ?? 0,
                  ),
                },
                withdrawal: {
                  authoredAmount: asUsdCents(
                    withdrawalEvidence?.requestedAmount ?? 0,
                  ),
                  executedAmount: asUsdCents(
                    withdrawalEvidence?.disposition.executedAmount ?? 0,
                  ),
                },
              }
            },
          ),
          members: input.linkedWithdrawalGroups.groups.map(
            (group): ConversionLinkedWithdrawalGroupMemberInput => {
              const conversionEvidence =
                input.rothConversionActionExecution?.evidence.find(
                  (evidence) =>
                    evidence.actionId === group.conversionActionId,
                )
              const withdrawalEvidence =
                input.retirementActionExecution?.evidence.find(
                  (evidence) =>
                    evidence.actionId === group.withdrawalActionId,
                )
              return {
                conversionActionId: group.conversionActionId,
                conversionPersonId: group.personId,
                allocationWeight: conversionEvidence === undefined
                  ? null
                  : conversionEvidence.outcome === 'executed'
                    // A settled execution whose Form 8606 character is still
                    // unknown stays null; it is never silently read as zero.
                    ? (conversionEvidence.taxableConvertedAmount === null
                        ? null
                        : asUsdCents(
                            conversionEvidence.taxableConvertedAmount,
                          ))
                    : asUsdCents(0),
                fundedAmount: asUsdCents(
                  withdrawalEvidence?.disposition.executedAmount ?? 0,
                ),
              }
            },
          ),
        })
  const retirementActionPublication =
    retirementActionPublicationSources.length > 0 &&
    retirementActionPublicationEligible
      ? publishAnnualRetirementActions({
          taxYear: input.taxYear,
          requests: retirementActionPublicationRequests,
          sources: retirementActionPublicationSources,
          ...(conversionLinkedWithdrawalGroupExecution === undefined
            ? {}
            : {
                conversionLinkedWithdrawalGroups:
                  conversionLinkedWithdrawalGroupExecution,
              }),
        })
      : undefined

  return {
    ...(qcdActionPrerequisites === undefined
      ? {}
      : { qcdActionPrerequisites }),
    ...(conversionLinkedWithdrawalGroupExecution === undefined
      ? {}
      : { conversionLinkedWithdrawalGroupExecution }),
    ...(retirementActionPublication === undefined
      ? {}
      : { retirementActionPublication }),
  }
}
