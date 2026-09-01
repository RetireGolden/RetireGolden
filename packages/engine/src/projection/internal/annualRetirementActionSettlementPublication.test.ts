import { describe, expect, it } from 'vitest'

import {
  assessConversionLinkedWithdrawalGroups,
  asPersonId,
  parseRetirementActionRequest,
  type RetirementActionRequest,
} from '../../actions/index.js'
import {
  mintAnnualLiabilityRunIdentity,
  type AnnualLiabilityRunTaxInput,
} from '../../actions/annualLiabilityRunIdentity.js'
import type {
  ConversionTaxFundingTaxUnitEvidence,
} from '../../actions/conversionTaxFundingEvidence.js'
import {
  COUNTERFACTUAL_OMISSION_TAX_INPUT_ID,
  exactAnnualLiabilityFromPlanDollars,
} from '../../internal/counterfactualAnnualLiability.js'
import {
  annualRetirementActionSettlementPublication,
  type AnnualRetirementActionSettlementPublicationInput,
} from './annualRetirementActionSettlementPublication.js'

const YEAR = 2030
const PLAN_ID = 'settlement-publication-plan'
const TAX_UNIT_ID = 'settlement-publication-tax-unit'

function parsedRequest(input: unknown): RetirementActionRequest {
  const parsed = parseRetirementActionRequest(input)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.request
}

function linkedPair(): readonly RetirementActionRequest[] {
  return [
    parsedRequest({
      actionId: 'withdrawal-a',
      kind: 'ordinaryWithdrawal',
      personId: 'p1',
      year: YEAR,
      executionDate: `${YEAR}-06-14`,
      executionSequence: 1,
      requestedAmount: 10_000_00,
      allocations: [{
        allocationId: 'withdrawal-allocation',
        sourceAccountId: 'cash-a',
        requestedAmount: 10_000_00,
      }],
      purpose: { kind: 'taxPayment', referenceId: 'conversion-a' },
      provenance: { source: 'manual' },
    }),
    parsedRequest({
      actionId: 'conversion-a',
      kind: 'rothConversion',
      personId: 'p1',
      year: YEAR,
      executionDate: `${YEAR}-06-15`,
      executionSequence: 2,
      requestedAmount: 50_000_00,
      allocations: [{
        allocationId: 'conversion-allocation',
        sourceAccountId: 'ira-a',
        requestedAmount: 50_000_00,
      }],
      destinationRothAccountId: 'roth-a',
      taxFunding: {
        kind: 'linkedWithdrawal',
        withdrawalActionId: 'withdrawal-a',
      },
      provenance: { source: 'manual' },
    }),
  ]
}

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

function baseInput(
  overrides: Partial<AnnualRetirementActionSettlementPublicationInput> = {},
): AnnualRetirementActionSettlementPublicationInput {
  return {
    planId: PLAN_ID,
    taxYear: YEAR,
    taxPlanDollars: 0,
    penaltiesPlanDollars: 0,
    linkedGroupAssessmentRequests: [],
    linkedWithdrawalGroups: { groups: [] },
    conversionFundingTaxUnitEvidence: null,
    annualLiabilityBaseline: null,
    annualLiabilityNonGroupTaxInputs: [],
    ...overrides,
  }
}

describe('annualRetirementActionSettlementPublication', () => {
  it('publishes no optional channel when no executor or linked group ran', () => {
    expect(annualRetirementActionSettlementPublication(baseInput())).toEqual({})
  })

  it('materializes a linked-group refusal from the settled liability boundary', () => {
    const requests = linkedPair()
    const assessment = assessConversionLinkedWithdrawalGroups(requests, {
      annualLiabilityBaseline: 'read',
    })
    const baselineLiability = exactAnnualLiabilityFromPlanDollars(2_500, 125)
    if (baselineLiability === null) throw new Error('fixture liability drift')
    const baselineIdentity = mintAnnualLiabilityRunIdentity({
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
    if (baselineIdentity.status !== 'annualLiabilityRunIdentityMinted') {
      throw new Error(baselineIdentity.issues[0].detail)
    }
    const input = baseInput({
      taxPlanDollars: 3_000,
      penaltiesPlanDollars: 125,
      linkedGroupAssessmentRequests: requests,
      linkedWithdrawalGroups: assessment,
      conversionFundingTaxUnitEvidence: taxUnit,
      annualLiabilityBaseline: {
        liability: baselineLiability,
        identity: baselineIdentity.identity,
      },
      annualLiabilityNonGroupTaxInputs: nonGroupTaxInputs,
    })
    const before = structuredClone(input)

    const result = annualRetirementActionSettlementPublication(input)

    expect(result.retirementActionPublication).toBeUndefined()
    expect(result.qcdActionPrerequisites).toBeUndefined()
    expect(result.conversionLinkedWithdrawalGroupExecution).toMatchObject({
      status: 'refused',
      movement: 'none',
      taxYear: YEAR,
      groups: [{
        conversionActionId: 'conversion-a',
        withdrawalActionId: 'withdrawal-a',
        conversionAuthoredAmount: 0,
        conversionExecutedAmount: 0,
        withdrawalAuthoredAmount: 0,
        withdrawalExecutedAmount: 0,
      }],
    })
    expect(result.conversionLinkedWithdrawalGroupExecution?.funding).toMatchObject({
      status: 'annualGroupNotEvaluated',
      reason: 'allocationWeightUnavailable',
    })
    expect(input).toEqual(before)
  })

  it('fails closed without tax-unit evidence while retaining group evidence', () => {
    const requests = linkedPair()
    const result = annualRetirementActionSettlementPublication(baseInput({
      linkedGroupAssessmentRequests: requests,
      linkedWithdrawalGroups: assessConversionLinkedWithdrawalGroups(requests, {
        annualLiabilityBaseline: 'unavailable',
      }),
    }))

    expect(result.conversionLinkedWithdrawalGroupExecution).toMatchObject({
      status: 'refused',
      funding: {
        status: 'annualGroupNotEvaluated',
        reason: 'taxUnitUnavailable',
      },
    })
  })
})
