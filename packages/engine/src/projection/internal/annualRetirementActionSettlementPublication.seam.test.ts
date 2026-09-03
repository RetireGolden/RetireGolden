import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  AnnualRetirementActionPublication,
  AnnualRetirementActionPublicationSource,
  EvaluateAnnualQcdExecutionPrerequisitesResult,
  ExecuteAnnualQcdsResult,
  ExecuteConversionLinkedWithdrawalGroupsInput,
  ExecuteConversionLinkedWithdrawalGroupsResult,
  ExecuteOrdinaryWithdrawalsResult,
  ExecuteRothConversionsResult,
  RetirementActionRequest,
} from '../../actions/index.js'

const seam = vi.hoisted(() => ({
  ordinaryEligibility: 'publicationEligible' as
    | 'publicationEligible'
    | 'legacyScheduleDiagnosticsOnly',
  conversionEligibility: 'publicationEligible' as
    | 'publicationEligible'
    | 'legacyScheduleDiagnosticsOnly',
  ordinarySource: Object.freeze({ sentinel: 'ordinary-source' }),
  conversionSource: Object.freeze({ sentinel: 'conversion-source' }),
  prerequisiteQcdSource: Object.freeze({ sentinel: 'qcd-prerequisite-source' }),
  committedQcdSource: Object.freeze({ sentinel: 'qcd-committed-source' }),
  publication: Object.freeze({ sentinel: 'publication' }),
  linkedExecution: Object.freeze({ sentinel: 'linked-execution' }),
  ordinarySourceCalls: [] as unknown[],
  conversionSourceCalls: [] as unknown[],
  linkedCalls: [] as unknown[],
  publicationCalls: [] as unknown[],
}))

vi.mock('../../actions/index.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../actions/index.js')>()
  return {
    ...original,
    ordinaryWithdrawalPublicationEligibility: () =>
      seam.ordinaryEligibility === 'publicationEligible'
        ? { kind: 'publicationEligible' }
        : {
            kind: 'legacyScheduleDiagnosticsOnly',
            unsupportedIssueKinds: ['invalidDate'],
          },
    rothConversionPublicationEligibility: () =>
      seam.conversionEligibility === 'publicationEligible'
        ? { kind: 'publicationEligible' }
        : {
            kind: 'legacyScheduleDiagnosticsOnly',
            unsupportedIssueKinds: ['invalidDate'],
          },
    ordinaryWithdrawalPublicationSource: (execution: unknown) => {
      seam.ordinarySourceCalls.push(execution)
      return seam.ordinarySource
    },
    rothConversionPublicationSource: (execution: unknown) => {
      seam.conversionSourceCalls.push(execution)
      return seam.conversionSource
    },
    executeConversionLinkedWithdrawalGroups: (input: unknown) => {
      seam.linkedCalls.push(input)
      return seam.linkedExecution
    },
    publishAnnualRetirementActions: (input: unknown) => {
      seam.publicationCalls.push(input)
      return seam.publication
    },
  }
})

import {
  assessConversionLinkedWithdrawalGroups,
  asPersonId,
  parseRetirementActionRequest,
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
import { annualRetirementActionSettlementPublication } from './annualRetirementActionSettlementPublication.js'

const YEAR = 2030
const PLAN_ID = 'settlement-publication-plan'
const TAX_UNIT_ID = 'settlement-publication-tax-unit'

function request(input: unknown): RetirementActionRequest {
  const parsed = parseRetirementActionRequest(input)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.request
}

const withdrawal = request({
  actionId: 'withdrawal-a',
  kind: 'ordinaryWithdrawal',
  personId: 'p1',
  year: YEAR,
  executionDate: `${YEAR}-06-14`,
  executionSequence: 1,
  requestedAmount: 8_000_00,
  allocations: [{
    allocationId: 'withdrawal-allocation',
    sourceAccountId: 'cash-a',
    requestedAmount: 8_000_00,
  }],
  purpose: { kind: 'taxPayment', referenceId: 'conversion-a' },
  provenance: { source: 'manual' },
})
const conversion = request({
  actionId: 'conversion-a',
  kind: 'rothConversion',
  personId: 'p1',
  year: YEAR,
  executionDate: `${YEAR}-06-15`,
  executionSequence: 2,
  requestedAmount: 40_000_00,
  allocations: [{
    allocationId: 'conversion-allocation',
    sourceAccountId: 'ira-a',
    requestedAmount: 40_000_00,
  }],
  destinationRothAccountId: 'roth-a',
  taxFunding: {
    kind: 'linkedWithdrawal',
    withdrawalActionId: 'withdrawal-a',
  },
  provenance: { source: 'manual' },
})
const qcd = request({
  actionId: 'qcd-a',
  kind: 'qcd',
  donorPersonId: 'p1',
  year: YEAR,
  executionDate: `${YEAR}-08-01`,
  executionSequence: 3,
  requestedAmount: 1_000_00,
  allocation: {
    allocationId: 'qcd-allocation',
    sourceAccountId: 'ira-a',
    requestedAmount: 1_000_00,
  },
  charity: {
    designationId: 'charity-a',
    name: 'Public charity',
    designationKind: 'eligiblePublicCharity',
    directFromCustodianAttested: true,
    eligibleOrganizationAttested: true,
    notDonorAdvisedFundOrSupportingOrganizationAttested: true,
    notSplitInterestEntityAttested: true,
    entireDistributionOtherwiseDeductibleAttested: true,
  },
  provenance: { source: 'manual' },
})

const ordinaryExecution = {
  requests: [withdrawal],
  evidence: [{
    actionId: withdrawal.actionId,
    requestedAmount: 8_000_00,
    disposition: { executedAmount: 8_000_00 },
  }],
} as unknown as ExecuteOrdinaryWithdrawalsResult
const conversionExecution = {
  requests: [conversion],
  evidence: [{
    actionId: conversion.actionId,
    requestedAmount: 40_000_00,
    executedAmount: 40_000_00,
    outcome: 'executed',
    taxableConvertedAmount: 40_000_00,
  }],
} as unknown as ExecuteRothConversionsResult
const qcdPrerequisites = {
  status: 'evaluated',
  committed: false,
  taxYear: YEAR,
  requests: [qcd],
  evidence: [],
  publicationSource: seam.prerequisiteQcdSource,
  issues: [],
} as unknown as Extract<
  EvaluateAnnualQcdExecutionPrerequisitesResult,
  { status: 'evaluated' }
>
const qcdExecution = {
  committed: true,
  publicationSource: seam.committedQcdSource,
} as unknown as ExecuteAnnualQcdsResult

const taxUnit: Readonly<ConversionTaxFundingTaxUnitEvidence> = {
  taxUnitId: TAX_UNIT_ID,
  taxYear: YEAR,
  federalFilingStatus: 'single',
  stateFilingStatusId: 'settlement-publication-state-filing',
  taxUnitEvidenceId: 'settlement-publication-tax-unit-evidence',
  taxUnitMemberPersonIds: [asPersonId('p1')],
}
const nonGroupTaxInputs: readonly Readonly<AnnualLiabilityRunTaxInput>[] = [{
  inputId: 'taxUnitEvidenceId',
  value: {
    representation: 'declaredTerm',
    term: taxUnit.taxUnitEvidenceId,
  },
}]

function baseline() {
  const liability = exactAnnualLiabilityFromPlanDollars(2_500, 125)
  if (liability === null) throw new Error('fixture liability drift')
  const identity = mintAnnualLiabilityRunIdentity({
    planId: PLAN_ID,
    taxUnitId: TAX_UNIT_ID,
    taxYear: YEAR,
    liabilityRun: {
      liabilityRunKind: 'baselineT0',
      candidateFundingVectorEvidenceId: null,
    },
    taxInputs: [
      ...nonGroupTaxInputs,
      {
        inputId: COUNTERFACTUAL_OMISSION_TAX_INPUT_ID,
        value: {
          representation: 'declaredTerm',
          term: JSON.stringify(['conversion-a', 'withdrawal-a']),
        },
      },
    ],
  })
  if (identity.status !== 'annualLiabilityRunIdentityMinted') {
    throw new Error(identity.issues[0].detail)
  }
  return { liability, identity: identity.identity }
}

describe('annualRetirementActionSettlementPublication publication contract', () => {
  beforeEach(() => {
    seam.ordinaryEligibility = 'publicationEligible'
    seam.conversionEligibility = 'publicationEligible'
    seam.ordinarySourceCalls.length = 0
    seam.conversionSourceCalls.length = 0
    seam.linkedCalls.length = 0
    seam.publicationCalls.length = 0
  })

  it('publishes ordered executor evidence with committed QCD precedence', () => {
    const assessment = assessConversionLinkedWithdrawalGroups(
      [withdrawal, conversion],
      { annualLiabilityBaseline: 'read' },
    )
    const input = {
      planId: PLAN_ID,
      taxYear: YEAR,
      taxPlanDollars: 3_000,
      penaltiesPlanDollars: 125,
      retirementActionExecution: ordinaryExecution,
      rothConversionActionExecution: conversionExecution,
      qcdActionPrerequisiteResult: qcdPrerequisites,
      qcdActionExecution: qcdExecution,
      linkedGroupAssessmentRequests: [withdrawal, conversion],
      linkedWithdrawalGroups: assessment,
      conversionFundingTaxUnitEvidence: taxUnit,
      annualLiabilityBaseline: baseline(),
      annualLiabilityNonGroupTaxInputs: nonGroupTaxInputs,
    }
    const before = structuredClone(input)

    const result = annualRetirementActionSettlementPublication(input)

    expect(result).toEqual({
      qcdActionPrerequisites: qcdPrerequisites,
      conversionLinkedWithdrawalGroupExecution:
        seam.linkedExecution as unknown as ExecuteConversionLinkedWithdrawalGroupsResult,
      retirementActionPublication:
        seam.publication as unknown as AnnualRetirementActionPublication,
    })
    expect(seam.ordinarySourceCalls).toEqual([ordinaryExecution])
    expect(seam.conversionSourceCalls).toEqual([conversionExecution])
    expect(seam.publicationCalls).toEqual([{
      taxYear: YEAR,
      requests: [withdrawal, conversion, qcd],
      sources: [
        seam.ordinarySource as unknown as AnnualRetirementActionPublicationSource,
        seam.conversionSource as unknown as AnnualRetirementActionPublicationSource,
        seam.committedQcdSource as unknown as AnnualRetirementActionPublicationSource,
      ],
      conversionLinkedWithdrawalGroups: seam.linkedExecution,
    }])

    const linkedInput = seam.linkedCalls[0] as
      ExecuteConversionLinkedWithdrawalGroupsInput
    expect(linkedInput.movements).toEqual([{
      conversionActionId: conversion.actionId,
      withdrawalActionId: withdrawal.actionId,
      conversion: {
        authoredAmount: 40_000_00,
        executedAmount: 40_000_00,
      },
      withdrawal: {
        authoredAmount: 8_000_00,
        executedAmount: 8_000_00,
      },
    }])
    expect(linkedInput.members).toEqual([{
      conversionActionId: conversion.actionId,
      conversionPersonId: asPersonId('p1'),
      allocationWeight: 40_000_00,
      fundedAmount: 8_000_00,
    }])
    expect(linkedInput.candidate?.liability).toEqual(
      exactAnnualLiabilityFromPlanDollars(3_000, 125),
    )
    expect(linkedInput.candidate?.identity).toMatchObject({
      planId: PLAN_ID,
      taxUnitId: TAX_UNIT_ID,
      taxYear: YEAR,
      liabilityRun: {
        liabilityRunKind: 'candidateT1',
        candidateFundingVectorEvidenceId: deriveActionStructuralId(
          'retirement-action-conversion-tax-funding-vector',
          [TAX_UNIT_ID, YEAR, [['conversion-a', 'withdrawal-a', 8_000_00]]],
        ),
      },
      orderedTaxInputs: [
        {
          inputId: COUNTERFACTUAL_OMISSION_TAX_INPUT_ID,
          value: { representation: 'declaredTerm', term: JSON.stringify([]) },
        },
        ...nonGroupTaxInputs,
      ],
      identityDerivation: 'canonicalJsonSha256',
    })
    expect(input).toEqual(before)
  })

  it('withholds all sources, QCD evidence, and publication on a legacy gate', () => {
    seam.ordinaryEligibility = 'legacyScheduleDiagnosticsOnly'

    const result = annualRetirementActionSettlementPublication({
      planId: PLAN_ID,
      taxYear: YEAR,
      taxPlanDollars: 0,
      penaltiesPlanDollars: 0,
      retirementActionExecution: ordinaryExecution,
      qcdActionPrerequisiteResult: qcdPrerequisites,
      qcdActionExecution: qcdExecution,
      linkedGroupAssessmentRequests: [],
      linkedWithdrawalGroups: { groups: [] },
      conversionFundingTaxUnitEvidence: null,
      annualLiabilityBaseline: null,
      annualLiabilityNonGroupTaxInputs: [],
    })

    expect(result).toEqual({})
    expect(seam.ordinarySourceCalls).toEqual([])
    expect(seam.conversionSourceCalls).toEqual([])
    expect(seam.publicationCalls).toEqual([])
  })
})
