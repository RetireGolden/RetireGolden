import { describe, expect, it } from 'vitest'

import {
  actionExecutionDispositionSchema,
  actionProvenanceSchema,
  ordinaryWithdrawalRequestSchema,
  parseActionExecutionDisposition,
  parseRetirementActionRequest,
  personRetirementActionRequestBaseSchema,
  qualifiedCharitableDistributionRequestSchema,
  retirementActionKinds,
  retirementActionRequestBaseSchema,
  retirementActionRequestSchema,
  rothConversionRequestSchema,
  sourceAllocationRequestSchema,
  type ParseActionExecutionDispositionResult,
} from './contract.js'
import { createActionReason } from './reasons.js'

const dispositionAmounts = {
  requestedAmount: 100,
  executedAmount: 100,
  unexecutedAmount: 0,
}

describe('action provenance', () => {
  it.each([
    { source: 'manual' },
    { source: 'generator', sourceId: 'fill-bracket' },
    { source: 'optimizer', sourceId: 'run-42', scenarioId: 'scenario-a' },
    { source: 'migration', sourceId: 'plan-v1-actions' },
  ] as const)('accepts and round-trips the $source variant', (provenance) => {
    const parsed = actionProvenanceSchema.parse(provenance)
    expect(JSON.parse(JSON.stringify(parsed))).toEqual(provenance)
  })

  it('rejects blank optional IDs, unknown sources, and invented metadata', () => {
    expect(
      actionProvenanceSchema.safeParse({
        source: 'generator',
        sourceId: ' ',
      }).success,
    ).toBe(false)
    expect(
      actionProvenanceSchema.safeParse({
        source: 'manual',
        scenarioId: '',
      }).success,
    ).toBe(false)
    expect(
      actionProvenanceSchema.safeParse({
        source: 'generated',
      }).success,
    ).toBe(false)
    expect(
      actionProvenanceSchema.safeParse({
        source: 'manual',
        engineVersion: '0.1.8',
      }).success,
    ).toBe(false)
  })
})

describe('foundation request contracts', () => {
  const request = {
    actionId: 'action-1',
    kind: 'ordinaryWithdrawal',
    personId: 'person-1',
    year: 2027,
    executionDate: '2027-03-15',
    executionSequence: 1,
    requestedAmount: 10_000,
    provenance: { source: 'manual' },
  } as const

  it('parses common and person-bound request bases', () => {
    const commonRequest = {
      actionId: request.actionId,
      kind: request.kind,
      year: request.year,
      executionDate: request.executionDate,
      executionSequence: request.executionSequence,
      requestedAmount: request.requestedAmount,
      provenance: request.provenance,
    }
    expect(retirementActionRequestBaseSchema.parse(commonRequest).requestedAmount).toBe(10_000)
    expect(personRetirementActionRequestBaseSchema.parse(request).personId).toBe('person-1')
  })

  it('requires a positive cent request and rejects unknown fields', () => {
    expect(
      personRetirementActionRequestBaseSchema.safeParse({ ...request, requestedAmount: 0 }).success,
    ).toBe(false)
    expect(
      personRetirementActionRequestBaseSchema.safeParse({ ...request, floatingDollars: 100 }).success,
    ).toBe(false)
    expect(
      personRetirementActionRequestBaseSchema.parse({
        ...request,
        executionDate: '2027-02-30',
      }).executionDate,
    ).toBe('2027-02-30')
    for (const executionDate of ['', ' ', '\t']) {
      expect(
        personRetirementActionRequestBaseSchema.parse({ ...request, executionDate }).executionDate,
      ).toBe(executionDate)
    }
    expect(
      personRetirementActionRequestBaseSchema.safeParse({ ...request, executionDate: 20270315 })
        .success,
    ).toBe(false)
  })

  it('parses only identity-complete positive-cent source allocations', () => {
    const allocation = {
      allocationId: 'allocation-1',
      sourceAccountId: 'account-1',
      requestedAmount: 1,
    }
    expect(sourceAllocationRequestSchema.parse(allocation)).toEqual(allocation)
    expect(
      sourceAllocationRequestSchema.safeParse({ ...allocation, requestedAmount: 0 }).success,
    ).toBe(false)
    expect(
      sourceAllocationRequestSchema.safeParse({ ...allocation, sourceAccountId: ' ' }).success,
    ).toBe(false)
    expect(
      sourceAllocationRequestSchema.safeParse({ ...allocation, rank: 1 }).success,
    ).toBe(false)
  })
})

describe('retirement action request contracts', () => {
  const provenance = { source: 'manual' } as const
  const migrationProvenance = { source: 'migration', sourceId: 'plan-v1-actions' } as const
  const charity = {
    designationId: 'charity-1',
    name: 'Community Foundation',
    designationKind: 'eligiblePublicCharity',
    directFromCustodianAttested: true,
    eligibleOrganizationAttested: true,
    notDonorAdvisedFundOrSupportingOrganizationAttested: true,
    notSplitInterestEntityAttested: true,
    entireDistributionOtherwiseDeductibleAttested: true,
  } as const
  const requests = [
    {
      actionId: 'withdrawal-1',
      kind: 'ordinaryWithdrawal',
      personId: 'person-1',
      year: 2030,
      executionDate: 'submitted-date-is-preserved',
      executionSequence: 1,
      requestedAmount: 10_000,
      allocations: [
        { allocationId: 'allocation-1', sourceAccountId: 'traditional-1', requestedAmount: 6_000 },
        { allocationId: 'allocation-2', sourceAccountId: 'traditional-2', requestedAmount: 4_000 },
      ],
      purpose: { kind: 'taxPayment', referenceId: 'conversion-1' },
      provenance,
    },
    {
      actionId: 'conversion-1',
      kind: 'rothConversion',
      personId: 'person-1',
      year: 2030,
      executionDate: '',
      executionSequence: 2,
      requestedAmount: 20_000,
      allocations: [
        { allocationId: 'allocation-3', sourceAccountId: 'traditional-1', requestedAmount: 20_000 },
      ],
      destinationRothAccountId: 'roth-1',
      taxFunding: { kind: 'linkedWithdrawal', withdrawalActionId: 'withdrawal-1' },
      provenance,
    },
    {
      actionId: 'qcd-1',
      kind: 'qcd',
      donorPersonId: 'person-1',
      year: 2030,
      executionDate: '2030-02-30',
      executionSequence: 3,
      requestedAmount: 5_000,
      allocation: {
        allocationId: 'allocation-4',
        sourceAccountId: 'traditional-1',
        requestedAmount: 5_000,
      },
      charity,
      provenance,
    },
    {
      actionId: 'legacy-withdrawal-1',
      kind: 'legacyAggregateWithdrawal',
      year: 2028,
      requestedAmount: 30_000,
      legacyCategory: 'traditional',
      provenance: migrationProvenance,
    },
    {
      actionId: 'legacy-conversion-1',
      kind: 'legacyAggregateRothConversion',
      year: 2029,
      requestedAmount: 25_000,
      provenance: migrationProvenance,
    },
    {
      actionId: 'legacy-qcd-1',
      kind: 'legacyAggregateQcd',
      year: 2030,
      requestedAmount: 8_000,
      legacyField: 'qcdAnnual',
      provenance: migrationProvenance,
    },
  ] as const

  it('refuses NUA as an unmodelled retirement action kind', () => {
    // The enum-membership assert is the load-bearing gate: a future 'nua' arm
    // with different required fields would still fail the shape parse below,
    // so the parse alone could stay green while the outOfScope claim went
    // false. Adding 'nua' to the action vocabulary must break this test.
    expect(retirementActionKinds).not.toContain('nua')
    expect(
      retirementActionRequestSchema.safeParse({
        ...requests[0],
        kind: 'nua',
      }).success,
    ).toBe(false)
  })

  it('round-trips all three current and all three legacy request arms', () => {
    for (const request of requests) {
      expect(parseRetirementActionRequest(JSON.parse(JSON.stringify(request)))).toEqual({
        ok: true,
        request,
      })
    }
  })

  it('preserves arbitrary submitted execution-date strings without normalizing them', () => {
    expect(ordinaryWithdrawalRequestSchema.parse(requests[0]).executionDate).toBe(
      'submitted-date-is-preserved',
    )
    expect(rothConversionRequestSchema.parse(requests[1]).executionDate).toBe('')
    expect(qualifiedCharitableDistributionRequestSchema.parse(requests[2]).executionDate).toBe(
      '2030-02-30',
    )
  })

  it('keeps legacy arms aggregate-only and rejects invented execution identities', () => {
    for (const request of requests.slice(3)) {
      expect(
        retirementActionRequestSchema.safeParse({
          ...request,
          personId: 'invented-person',
          executionDate: `${request.year}-12-31`,
        }).success,
      ).toBe(false)
    }
  })

  it('requires exact allocation conservation and unique allocation/source IDs', () => {
    const ordinary = requests[0]
    expect(
      ordinaryWithdrawalRequestSchema.safeParse({
        ...ordinary,
        allocations: [
          ordinary.allocations[0],
          { ...ordinary.allocations[1], requestedAmount: 3_999 },
        ],
      }).success,
    ).toBe(false)
    expect(
      ordinaryWithdrawalRequestSchema.safeParse({
        ...ordinary,
        allocations: [
          ordinary.allocations[0],
          { ...ordinary.allocations[1], allocationId: ordinary.allocations[0].allocationId },
        ],
      }).success,
    ).toBe(false)
    expect(
      rothConversionRequestSchema.safeParse({
        ...requests[1],
        allocations: [
          requests[1].allocations[0],
          {
            allocationId: 'allocation-other',
            sourceAccountId: requests[1].allocations[0].sourceAccountId,
            requestedAmount: 1,
          },
        ],
      }).success,
    ).toBe(false)
    expect(
      rothConversionRequestSchema.safeParse({
        ...requests[1],
        destinationRothAccountId: requests[1].allocations[0].sourceAccountId,
      }).success,
    ).toBe(false)
    expect(
      qualifiedCharitableDistributionRequestSchema.safeParse({
        ...requests[2],
        allocation: { ...requests[2].allocation, requestedAmount: 4_999 },
      }).success,
    ).toBe(false)
  })

  it('keeps purpose, tax-funding, and charity objects strict', () => {
    expect(
      ordinaryWithdrawalRequestSchema.safeParse({
        ...requests[0],
        purpose: { ...requests[0].purpose, memo: 'not in contract' },
      }).success,
    ).toBe(false)
    expect(
      rothConversionRequestSchema.safeParse({
        ...requests[1],
        taxFunding: { kind: 'externalCash', amount: 100, attested: false },
      }).success,
    ).toBe(false)
    expect(
      qualifiedCharitableDistributionRequestSchema.safeParse({
        ...requests[2],
        charity: { ...charity, verifiedByEngine: true },
      }).success,
    ).toBe(false)
  })
})

describe('action execution dispositions', () => {
  const adjusted = createActionReason('qcd-person-limit-trimmed')
  const contributionAdjusted = createActionReason('qcd-contribution-offset-applied')
  const taxableAdjusted = createActionReason('qcd-taxable-amount-trimmed')
  const partial = createActionReason('qcd-balance-trimmed')
  const refused = createActionReason('person-not-found')
  const unsupported = createActionReason('required-facts-missing')

  const validDispositions = [
    {
      outcome: 'executed',
      readiness: 'actionable',
      ...dispositionAmounts,
      reasons: [],
    },
    {
      outcome: 'executed',
      readiness: 'actionable',
      ...dispositionAmounts,
      reasons: [adjusted],
    },
    {
      outcome: 'partial',
      readiness: 'actionable',
      requestedAmount: 100,
      executedAmount: 60,
      unexecutedAmount: 40,
      reasons: [partial, adjusted],
    },
    {
      outcome: 'refused',
      readiness: 'nonActionable',
      requestedAmount: 100,
      executedAmount: 0,
      unexecutedAmount: 100,
      reasons: [refused],
    },
    {
      outcome: 'unsupported',
      readiness: 'nonActionable',
      requestedAmount: 100,
      executedAmount: 0,
      unexecutedAmount: 100,
      reasons: [unsupported, refused],
    },
  ] as const

  it('accepts all four arms with exact conservation and canonical reason order', () => {
    for (const disposition of validDispositions) {
      expect(parseActionExecutionDisposition(disposition)).toEqual({
        ok: true,
        disposition,
      })
    }
  })

  it('round-trips every arm through JSON', () => {
    for (const disposition of validDispositions) {
      const parsed = parseActionExecutionDisposition(JSON.parse(JSON.stringify(disposition)))
      expect(parsed).toEqual({ ok: true, disposition })
    }
  })

  it('rejects zero requests and unknown fields', () => {
    expect(
      actionExecutionDispositionSchema.safeParse({
        outcome: 'executed',
        readiness: 'actionable',
        requestedAmount: 0,
        executedAmount: 0,
        unexecutedAmount: 0,
        reasons: [],
      }).success,
    ).toBe(false)
    expect(
      actionExecutionDispositionSchema.safeParse({
        ...validDispositions[0],
        dollars: 1,
      }).success,
    ).toBe(false)
  })

  it('rejects one-cent conservation and arm-boundary failures with field paths', () => {
    const cases = [
      {
        value: { ...validDispositions[0], executedAmount: 99, unexecutedAmount: 1 },
        path: 'executedAmount',
      },
      {
        value: {
          ...validDispositions[2],
          requestedAmount: 2,
          executedAmount: 1,
          unexecutedAmount: 0,
        },
        path: 'unexecutedAmount',
      },
      {
        value: { ...validDispositions[3], executedAmount: 1, unexecutedAmount: 99 },
        path: 'executedAmount',
      },
      {
        value: { ...validDispositions[3], unexecutedAmount: 99 },
        path: 'unexecutedAmount',
      },
    ]

    for (const { value, path } of cases) {
      const result = parseActionExecutionDisposition(value)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.startsWith(`${path}: `))).toBe(true)
      }
    }
  })

  it('enforces unique QCD adjustment reasons in canonical order', () => {
    const canonical = {
      ...validDispositions[0],
      reasons: [adjusted, contributionAdjusted, taxableAdjusted],
    }
    expect(actionExecutionDispositionSchema.safeParse(canonical).success).toBe(true)
    expect(
      actionExecutionDispositionSchema.safeParse({
        ...canonical,
        reasons: [contributionAdjusted, adjusted],
      }).success,
    ).toBe(false)
    expect(
      actionExecutionDispositionSchema.safeParse({
        ...canonical,
        reasons: [adjusted, adjusted],
      }).success,
    ).toBe(false)
    expect(
      actionExecutionDispositionSchema.safeParse({
        ...validDispositions[2],
        reasons: [partial, taxableAdjusted, contributionAdjusted],
      }).success,
    ).toBe(false)
    expect(
      actionExecutionDispositionSchema.safeParse({
        ...validDispositions[2],
        reasons: [partial, contributionAdjusted, contributionAdjusted],
      }).success,
    ).toBe(false)
  })

  it('rejects invalid reason subsets and ordering', () => {
    const invalid = [
      { ...validDispositions[0], reasons: [partial] },
      { ...validDispositions[2], reasons: [] },
      { ...validDispositions[2], reasons: [adjusted, partial] },
      { ...validDispositions[2], reasons: [partial, refused] },
      { ...validDispositions[3], reasons: [unsupported] },
      { ...validDispositions[4], reasons: [refused, unsupported] },
      { ...validDispositions[4], reasons: [unsupported, partial] },
    ]

    for (const disposition of invalid) {
      expect(actionExecutionDispositionSchema.safeParse(disposition).success).toBe(false)
    }
  })

  it('rejects readiness values inconsistent with outcome', () => {
    expect(
      actionExecutionDispositionSchema.safeParse({
        ...validDispositions[0],
        readiness: 'nonActionable',
      }).success,
    ).toBe(false)
    expect(
      actionExecutionDispositionSchema.safeParse({
        ...validDispositions[3],
        readiness: 'actionable',
      }).success,
    ).toBe(false)
  })

  it('supports an exhaustive outcome switch', () => {
    type ParsedDisposition = Extract<
      ParseActionExecutionDispositionResult,
      { ok: true }
    >['disposition']
    const summarize = (disposition: ParsedDisposition): string => {
      switch (disposition.outcome) {
        case 'executed':
          return 'executed'
        case 'partial':
          return 'partial'
        case 'refused':
          return 'refused'
        case 'unsupported':
          return 'unsupported'
        default: {
          const exhaustive: never = disposition
          return exhaustive
        }
      }
    }

    const parsed = validDispositions.map((value) => parseActionExecutionDisposition(value))
    expect(
      parsed.map((result) => {
        if (!result.ok) throw new Error(result.issues.join('\n'))
        return summarize(result.disposition)
      }),
    ).toEqual(['executed', 'executed', 'partial', 'refused', 'unsupported'])
  })
})
