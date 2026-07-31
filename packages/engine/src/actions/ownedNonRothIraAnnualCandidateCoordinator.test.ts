import { describe, expect, it } from 'vitest'

import type {
  OrdinaryWithdrawalRequest,
  SourceAllocationRequest,
} from './contract.js'
import {
  asAccountId,
  asActionId,
  asAllocationId,
  asPersonId,
} from './identity.js'
import {
  asPositiveUsdCents,
  asUsdCents,
} from './money.js'
import {
  coordinateOwnedNonRothIraAnnualWithdrawalCandidate,
  type CoordinateOwnedNonRothIraAnnualWithdrawalCandidateInput,
} from './ownedNonRothIraAnnualCandidateCoordinator.js'
import type {
  OwnedNonRothIraMovementSourceEvidence,
} from './ownedNonRothIraMovementCandidate.js'
import type {
  OwnedNonRothIraSubtype,
  OwnedNonRothIraPoolMemberEvidence,
} from './ownedNonRothIraWithdrawalCharacter.js'

function allocation(
  suffix: string,
  sourceAccountId: string,
  requestedAmount: number,
): SourceAllocationRequest {
  return {
    allocationId: asAllocationId(`allocation-${suffix}`),
    sourceAccountId: asAccountId(sourceAccountId),
    requestedAmount: asPositiveUsdCents(requestedAmount),
  }
}

function request(options: {
  suffix: string
  date?: string
  sequence?: number
  year?: number
  allocations: readonly SourceAllocationRequest[]
}): OrdinaryWithdrawalRequest {
  return {
    actionId: asActionId(`action-${options.suffix}`),
    kind: 'ordinaryWithdrawal',
    personId: asPersonId('owner'),
    year: options.year ?? 2030,
    executionDate: options.date ?? '2030-06-01',
    executionSequence: options.sequence ?? 1,
    requestedAmount: asPositiveUsdCents(
      options.allocations.reduce(
        (total, item) => total + item.requestedAmount,
        0,
      ),
    ),
    allocations: [...options.allocations],
    purpose: { kind: 'spending' },
    provenance: { source: 'manual' },
  }
}

function movementSource(
  sourceAccountId: string,
  subtype: OwnedNonRothIraSubtype = 'traditional',
): OwnedNonRothIraMovementSourceEvidence {
  return {
    predicate: 'ownedNonRothIraOrdinaryWithdrawalMovementSource',
    sourceAccountId: asAccountId(sourceAccountId),
    ownerPersonId: asPersonId('owner'),
    accountType: 'traditional',
    accountKind: 'ira',
    inheritanceStatus: 'owned',
    subtype,
    accountOwnershipEvidenceId: `ownership-${sourceAccountId}`,
    iraClassificationEvidenceId: `classification-${sourceAccountId}`,
  }
}

function poolMember(
  sourceAccountId: string,
  subtype: OwnedNonRothIraSubtype = 'traditional',
  yearEndAmount = 0,
): OwnedNonRothIraPoolMemberEvidence {
  return {
    sourceAccountId: asAccountId(sourceAccountId),
    ownerPersonId: asPersonId('owner'),
    accountType: 'traditional',
    accountKind: 'ira',
    inheritanceStatus: 'owned',
    subtype,
    yearEndApplicableBalanceAmount: asUsdCents(yearEndAmount),
    accountOwnershipEvidenceId: `ownership-${sourceAccountId}`,
    iraClassificationEvidenceId: `classification-${sourceAccountId}`,
  }
}

function singleFixture(options: {
  subtype?: OwnedNonRothIraSubtype
  requestedAmount?: number
  openingBalance?: number
  line7Amount?: number
  openingBasisAmount?: number
  birthDate?: string
  disability?: boolean
  simpleParticipation?: boolean
  extraPoolMember?: boolean
} = {}): CoordinateOwnedNonRothIraAnnualWithdrawalCandidateInput {
  const subtype = options.subtype ?? 'traditional'
  const requestedAmount = options.requestedAmount ?? 100
  const openingBalance = options.openingBalance ?? requestedAmount
  const line7Amount =
    options.line7Amount ?? Math.min(requestedAmount, openingBalance)
  const members = [poolMember('ira-one', subtype)]
  if (options.extraPoolMember === true) {
    members.push(poolMember('ira-extra', 'sep', 25))
  }
  const yearEndAmount = members.reduce(
    (sum, member) => sum + member.yearEndApplicableBalanceAmount,
    0,
  )
  return {
    movementInput: {
      ownerPersonId: asPersonId('owner'),
      taxYear: 2030,
      requests: [
        request({
          suffix: 'one',
          allocations: [
            allocation('one', 'ira-one', requestedAmount),
          ],
        }),
      ],
      openingBalances: [{
        accountId: asAccountId('ira-one'),
        openingBalance: asUsdCents(openingBalance),
      }],
      sourceEvidence: [movementSource('ira-one', subtype)],
    },
    annualInput: {
      ownerPersonId: asPersonId('owner'),
      ownerWideNonRothIraPoolId: 'owner-pool',
      completePoolEvidence: {
        predicate: 'completeOwnedNonRothIraPoolForOwnerAndTaxYear',
        ownerPersonId: asPersonId('owner'),
        ownerWideNonRothIraPoolId: 'owner-pool',
        taxYear: 2030,
        accountIds: members.map((member) => member.sourceAccountId) as [
          ReturnType<typeof asAccountId>,
          ...ReturnType<typeof asAccountId>[],
        ],
        yearEndApplicablePoolBalanceAmount:
          asUsdCents(yearEndAmount),
        evidenceId: 'complete-owner-pool',
      },
      annualBasisRecordEvidenceId: 'annual-basis-record',
      taxYear: 2030,
      poolMembers: members,
      annualFacts: {
        openingBasisAmount: asUsdCents(
          options.openingBasisAmount ?? 0,
        ),
        taxYearNondeductibleContributionAmount: asUsdCents(0),
        postYearNondeductibleContributionExcludedAmount: asUsdCents(0),
        yearEndApplicablePoolBalanceAmount: asUsdCents(yearEndAmount),
        outstandingRolloverAmount: asUsdCents(0),
        rolloverRepaymentAdjustmentAmount: asUsdCents(0),
        form8606Line7DistributionAmount: asUsdCents(line7Amount),
        form8606Line8NetConversionAmount: asUsdCents(0),
      },
      line8Conversions: [],
    },
    ownerEvidence: {
      predicate: 'ownerBirthDateForIraPenaltyAgeThreshold',
      ownerPersonId: asPersonId('owner'),
      birthDate: options.birthDate ?? '1970-01-01',
      evidenceId: 'owner-birth',
    },
    qualifiedDisabilityEvidence:
      options.disability === true
        ? [{
            kind: 'disability',
            disabledPersonId: asPersonId('owner'),
            disabilityQualificationDate: '2030-05-01',
            evaluationDate: '2030-06-01',
            qualifiedOnEvaluationDate: true,
            disabilityEvidenceId: 'qualified-disability',
          }]
        : [],
    simpleParticipationEvidence:
      options.simpleParticipation === true
        ? [{
            predicate: 'simpleIraParticipationStartForPenaltyRate',
            sourceAccountId: asAccountId('ira-one'),
            ownerPersonId: asPersonId('owner'),
            participationStartDate: '2029-01-01',
            participationStartEvidenceId: 'simple-participation',
          }]
        : [],
  }
}

function mixedFixture():
  CoordinateOwnedNonRothIraAnnualWithdrawalCandidateInput {
  const sources = [
    movementSource('ira-basis', 'traditional'),
    movementSource('ira-disability', 'simple'),
    movementSource('ira-age', 'sep'),
  ]
  const members = [
    poolMember('ira-basis', 'traditional'),
    poolMember('ira-disability', 'simple'),
    poolMember('ira-age', 'sep'),
  ]
  return {
    movementInput: {
      ownerPersonId: asPersonId('owner'),
      taxYear: 2030,
      requests: [
        request({
          suffix: 'basis',
          date: '2030-01-01',
          sequence: 1,
          allocations: [allocation('basis', 'ira-basis', 1)],
        }),
        request({
          suffix: 'disability',
          date: '2030-01-15',
          sequence: 1,
          allocations: [
            allocation('disability', 'ira-disability', 1),
          ],
        }),
        request({
          suffix: 'age',
          date: '2030-02-01',
          sequence: 1,
          allocations: [allocation('age', 'ira-age', 1)],
        }),
      ],
      openingBalances: sources.map((source) => ({
        accountId: source.sourceAccountId,
        openingBalance: asUsdCents(1),
      })),
      sourceEvidence: sources,
    },
    annualInput: {
      ownerPersonId: asPersonId('owner'),
      ownerWideNonRothIraPoolId: 'owner-pool',
      completePoolEvidence: {
        predicate: 'completeOwnedNonRothIraPoolForOwnerAndTaxYear',
        ownerPersonId: asPersonId('owner'),
        ownerWideNonRothIraPoolId: 'owner-pool',
        taxYear: 2030,
        accountIds: members.map((member) => member.sourceAccountId) as [
          ReturnType<typeof asAccountId>,
          ...ReturnType<typeof asAccountId>[],
        ],
        yearEndApplicablePoolBalanceAmount: asUsdCents(0),
        evidenceId: 'complete-owner-pool',
      },
      annualBasisRecordEvidenceId: 'annual-basis-record',
      taxYear: 2030,
      poolMembers: members,
      annualFacts: {
        openingBasisAmount: asUsdCents(1),
        taxYearNondeductibleContributionAmount: asUsdCents(0),
        postYearNondeductibleContributionExcludedAmount: asUsdCents(0),
        yearEndApplicablePoolBalanceAmount: asUsdCents(0),
        outstandingRolloverAmount: asUsdCents(0),
        rolloverRepaymentAdjustmentAmount: asUsdCents(0),
        form8606Line7DistributionAmount: asUsdCents(3),
        form8606Line8NetConversionAmount: asUsdCents(0),
      },
      line8Conversions: [],
    },
    ownerEvidence: {
      predicate: 'ownerBirthDateForIraPenaltyAgeThreshold',
      ownerPersonId: asPersonId('owner'),
      birthDate: '1970-08-01',
      evidenceId: 'owner-birth',
    },
    qualifiedDisabilityEvidence: [{
      kind: 'disability',
      disabledPersonId: asPersonId('owner'),
      disabilityQualificationDate: '2030-01-10',
      evaluationDate: '2030-01-15',
      qualifiedOnEvaluationDate: true,
      disabilityEvidenceId: 'qualified-disability',
    }],
    simpleParticipationEvidence: [],
  }
}

function mixedPenaltyFixture():
  CoordinateOwnedNonRothIraAnnualWithdrawalCandidateInput {
  const base = mixedFixture()
  const source = movementSource('ira-penalty', 'traditional')
  return {
    ...base,
    movementInput: {
      ...base.movementInput,
      requests: [
        ...base.movementInput.requests,
        request({
          suffix: 'penalty',
          date: '2030-01-20',
          sequence: 1,
          allocations: [
            allocation('penalty', 'ira-penalty', 1),
          ],
        }),
      ],
      openingBalances: [
        ...base.movementInput.openingBalances,
        {
          accountId: source.sourceAccountId,
          openingBalance: asUsdCents(1),
        },
      ],
      sourceEvidence: [
        ...base.movementInput.sourceEvidence,
        source,
      ],
    },
    annualInput: {
      ...base.annualInput,
      completePoolEvidence: {
        ...base.annualInput.completePoolEvidence,
        accountIds: [
          ...base.annualInput.completePoolEvidence.accountIds,
          source.sourceAccountId,
        ],
      },
      poolMembers: [
        ...base.annualInput.poolMembers,
        poolMember('ira-penalty', 'traditional'),
      ],
      annualFacts: {
        ...base.annualInput.annualFacts,
        form8606Line7DistributionAmount: asUsdCents(4),
      },
    },
    ownerAliveEvidence: [{
      predicate: 'ownerAliveOnOwnedIraDistributionDate',
      actionId: asActionId('action-penalty'),
      allocationId: asAllocationId('allocation-penalty'),
      sourceAccountId: asAccountId('ira-penalty'),
      ownerPersonId: asPersonId('owner'),
      evaluationDate: '2030-01-20',
      aliveOnEvaluationDate: true,
      ownerAliveEvidenceId: 'owner-alive-penalty',
    }],
    rejectedDisabilityEvidence: [{
      kind: 'disability',
      disabledPersonId: asPersonId('owner'),
      disabilityQualificationDate: null,
      evaluationDate: '2030-01-20',
      qualifiedOnEvaluationDate: false,
      disabilityEvidenceId: 'rejected-disability-penalty',
    }],
    iraSeppStatusEvidence: [{
      predicate: 'ownedNonRothIraSeppStatusForWithdrawal',
      actionId: asActionId('action-penalty'),
      allocationId: asAllocationId('allocation-penalty'),
      sourceAccountId: asAccountId('ira-penalty'),
      ownerPersonId: asPersonId('owner'),
      evaluationDate: '2030-01-20',
      status: 'none',
      electionId: null,
      scheduleId: null,
      seppStatusEvidenceId: 'no-sepp-penalty',
    }],
    noOtherExceptionAttestations: [{
      predicate: 'noOtherStatutoryExceptionClaimed',
      actionId: asActionId('action-penalty'),
      allocationId: asAllocationId('allocation-penalty'),
      sourceAccountId: asAccountId('ira-penalty'),
      ownerPersonId: asPersonId('owner'),
      evaluationDate: '2030-01-20',
      attested: true,
      evidenceScope:
        'planningEvidenceNotFilingGradeLegalAdjudication',
      attestationEvidenceId: 'no-other-penalty',
    }],
  }
}

function bindingId(
  input: CoordinateOwnedNonRothIraAnnualWithdrawalCandidateInput,
): string {
  const result =
    coordinateOwnedNonRothIraAnnualWithdrawalCandidate(input)
  if (result.status !== 'annualEvidenceBound') {
    throw new Error('Fixture unexpectedly failed annual binding')
  }
  return result.bindingEvidence.bindingEvidenceId
}

describe('coordinateOwnedNonRothIraAnnualWithdrawalCandidate', () => {
  it('binds mixed basis-only, disability, and age evidence without actionability or movement', () => {
    const result =
      coordinateOwnedNonRothIraAnnualWithdrawalCandidate(mixedFixture())

    expect(result).toMatchObject({
      status: 'annualEvidenceBound',
      movement: 'notCommitted',
      actionability: 'notEstablished',
      issues: [],
    })
    if (result.status !== 'annualEvidenceBound') return
    expect(
      result.annualEvidence.characterization.withdrawals.map(
        (withdrawal) => withdrawal.basisRecoveredAmount,
      ),
    ).toEqual([1, 0, 0])
    expect(
      result.annualEvidence.penaltyPrerequisites.evaluations.map(
        (evaluation) => evaluation.outcome,
      ),
    ).toEqual(['disabilityQualified', 'age59HalfReached'])
    expect(result.bindingEvidence).toMatchObject({
      predicate:
        'ownedNonRothIraMovementCandidateBoundToAnnualFinalization',
      movementCandidateId:
        result.movementCandidate.movementCandidateId,
      finalizationEvidenceId:
        result.annualEvidence.finalizationEvidenceId,
      line7AllocationEvidenceId:
        result.annualEvidence.characterization.line7AllocationEvidence
          .allocationEvidenceId,
    })
    expect(result).not.toHaveProperty('penaltyApplies')
    expect(result).not.toHaveProperty('readiness')
  })

  it('blocks the whole owner/year bundle when one taxable allocation is unresolved', () => {
    const input = mixedFixture()
    input.qualifiedDisabilityEvidence = []
    input.simpleParticipationEvidence = [{
      predicate: 'simpleIraParticipationStartForPenaltyRate',
      sourceAccountId: asAccountId('ira-disability'),
      ownerPersonId: asPersonId('owner'),
      participationStartDate: '2029-01-01',
      participationStartEvidenceId: 'simple-participation',
    }]

    const result =
      coordinateOwnedNonRothIraAnnualWithdrawalCandidate(input)

    expect(result).toMatchObject({
      status: 'annualEvidenceBlocked',
      movement: 'notCommitted',
      actionability: 'notEstablished',
      annualEvidence: null,
      bindingEvidence: null,
    })
    if (result.status !== 'annualEvidenceBlocked') return
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0]).toMatchObject({
      actionId: 'action-disability',
      allocationId: 'allocation-disability',
      sourceAccountId: 'ira-disability',
      prerequisite: {
        outcome: 'exceptionEvaluationRequired',
        subtype: 'simple',
        evaluationDate: '2030-01-15',
      },
    })
  })

  it('uses actual partial execution, never the larger requested amount, for annual line 7', () => {
    const result =
      coordinateOwnedNonRothIraAnnualWithdrawalCandidate(
        singleFixture({
          requestedAmount: 150,
          openingBalance: 100,
          line7Amount: 100,
        }),
      )

    expect(result.status).toBe('annualEvidenceBound')
    if (result.status !== 'annualEvidenceBound') return
    expect(result.movementCandidate.actions[0]).toMatchObject({
      requestedAmount: 150,
      executedAmount: 100,
      unexecutedAmount: 50,
      candidateDisposition: {
        candidateStatus: 'partiallyStaged',
      },
    })
    expect(
      result.annualEvidence.characterization.annualBasisEvidence
        .form8606Line7DistributionAmount,
    ).toBe(100)
    expect(
      result.annualEvidence.characterization.withdrawals[0]
        .executedAmount,
    ).toBe(100)
  })

  it('preserves a zero sibling in movement evidence but excludes it from annual line 7', () => {
    const base = singleFixture()
    const input: CoordinateOwnedNonRothIraAnnualWithdrawalCandidateInput = {
      ...base,
      movementInput: {
        ...base.movementInput,
        requests: [
          request({
            suffix: 'one',
            allocations: [
              allocation('one', 'ira-one', 100),
              allocation('zero', 'ira-zero', 50),
            ],
          }),
        ],
        openingBalances: [
          {
            accountId: asAccountId('ira-one'),
            openingBalance: asUsdCents(100),
          },
          {
            accountId: asAccountId('ira-zero'),
            openingBalance: asUsdCents(0),
          },
        ],
        sourceEvidence: [
          movementSource('ira-one'),
          movementSource('ira-zero'),
        ],
      },
      annualInput: {
        ...base.annualInput,
        poolMembers: [
          poolMember('ira-one'),
          poolMember('ira-zero'),
        ],
        completePoolEvidence: {
          ...base.annualInput.completePoolEvidence,
          accountIds: [
            asAccountId('ira-one'),
            asAccountId('ira-zero'),
          ],
        },
      },
    }

    const result =
      coordinateOwnedNonRothIraAnnualWithdrawalCandidate(input)

    expect(result.status).toBe('annualEvidenceBound')
    if (result.status !== 'annualEvidenceBound') return
    expect(result.movementCandidate.actions[0].allocations).toHaveLength(2)
    expect(result.movementCandidate.actions[0].allocations[1]).toMatchObject({
      sourceAccountId: 'ira-zero',
      executedAmount: 0,
    })
    expect(result.movementCandidate.line7Distributions).toEqual([{
      actionId: 'action-one',
      allocationId: 'allocation-one',
      sourceAccountId: 'ira-one',
      scheduledDate: '2030-06-01',
      scheduledSequence: 1,
      grossAmount: 100,
    }])
  })

  it('returns an explicit no-positive arm instead of invoking annual finalization', () => {
    const result =
      coordinateOwnedNonRothIraAnnualWithdrawalCandidate(
        singleFixture({
          openingBalance: 0,
          line7Amount: 0,
        }),
      )

    expect(result).toMatchObject({
      status: 'noPositiveMovementStaged',
      movement: 'notCommitted',
      actionability: 'notEstablished',
      annualEvidence: null,
      bindingEvidence: null,
      issues: [],
      movementCandidate: {
        status: 'movementCandidateStaged',
        line7Distributions: [],
        candidateBalances: [{
          openingBalance: 0,
          executedAmount: 0,
          candidateClosingBalance: 0,
        }],
      },
    })
  })

  it('returns schedule-invalid evidence with unchanged candidate balances', () => {
    const base = singleFixture()
    const input: CoordinateOwnedNonRothIraAnnualWithdrawalCandidateInput = {
      ...base,
      movementInput: {
        ...base.movementInput,
        requests: [{
          ...base.movementInput.requests[0],
          year: 2029,
        }],
      },
    }

    const result =
      coordinateOwnedNonRothIraAnnualWithdrawalCandidate(input)

    expect(result).toMatchObject({
      status: 'scheduleInvalid',
      movement: 'notCommitted',
      actionability: 'notEstablished',
      annualEvidence: null,
      bindingEvidence: null,
      movementCandidate: {
        status: 'scheduleInvalid',
        candidateBalances: [{
          openingBalance: 100,
          executedAmount: 0,
          candidateClosingBalance: 100,
        }],
      },
    })
    if (result.status !== 'scheduleInvalid') return
    expect(result.issues).toContainEqual({
      kind: 'actionYearMismatch',
      actionId: 'action-one',
      expectedYear: 2030,
      actualYear: 2029,
    })
  })

  it.each([
    ['missing member', () => poolMember('ira-other')],
    ['foreign owner', (member: OwnedNonRothIraPoolMemberEvidence) => ({
        ...member,
        ownerPersonId: asPersonId('other-owner'),
      })],
    ['subtype', (member: OwnedNonRothIraPoolMemberEvidence) => ({
        ...member,
        subtype: 'sep' as const,
      })],
    ['ownership evidence', (member: OwnedNonRothIraPoolMemberEvidence) => ({
        ...member,
        accountOwnershipEvidenceId: 'different-ownership',
      })],
    ['classification evidence', (member: OwnedNonRothIraPoolMemberEvidence) => ({
        ...member,
        iraClassificationEvidenceId: 'different-classification',
      })],
  ])('rejects a requested-source/annual-pool %s mismatch', (_label, mutate) => {
    const base = singleFixture()
    const input: CoordinateOwnedNonRothIraAnnualWithdrawalCandidateInput = {
      ...base,
      annualInput: {
        ...base.annualInput,
        poolMembers: [mutate(base.annualInput.poolMembers[0])],
      },
    }

    expect(() =>
      coordinateOwnedNonRothIraAnnualWithdrawalCandidate(input),
    ).toThrow(/annual pool|exactly rejoin/)
  })

  it('allows extra owner-wide pool members outside the requested source set', () => {
    const result =
      coordinateOwnedNonRothIraAnnualWithdrawalCandidate(
        singleFixture({ extraPoolMember: true }),
      )

    expect(result.status).toBe('annualEvidenceBound')
    if (result.status !== 'annualEvidenceBound') return
    expect(
      result.annualEvidence.characterization.annualBasisEvidence
        .poolMembers.map((member) => member.sourceAccountId),
    ).toEqual(['ira-extra', 'ira-one'])
  })

  it('derives SIMPLE subtype/date/source facts and applies supplied participation evidence', () => {
    const result =
      coordinateOwnedNonRothIraAnnualWithdrawalCandidate(
        singleFixture({
          subtype: 'simple',
          birthDate: '1980-01-01',
          simpleParticipation: true,
        }),
      )

    expect(result.status).toBe('annualEvidenceBlocked')
    if (result.status !== 'annualEvidenceBlocked') return
    expect(result.issues[0].prerequisite).toMatchObject({
      subtype: 'simple',
      evaluationDate: '2030-06-01',
      rateEvidence: {
        kind: 'simpleIraParticipationRate',
        phase: 'initialTwoYearPeriod',
        numerator: 1,
        denominator: 4,
      },
    })
    expect(
      result.issues[0].prerequisite.characterCoverage.sourceEvidenceIds
        .distributionDateEvidenceId,
    ).toContain('owned-non-roth-ira-staged-distribution-date:')
  })

  it('is invariant to unordered source sets and binds material evidence changes into its ID', () => {
    const baseline = mixedFixture()
    const baselineId = bindingId(baseline)
    const permutationBase = mixedFixture()
    const permuted:
      CoordinateOwnedNonRothIraAnnualWithdrawalCandidateInput = {
        ...permutationBase,
        movementInput: {
          ...permutationBase.movementInput,
          requests: [...permutationBase.movementInput.requests].reverse(),
          openingBalances: [
            ...permutationBase.movementInput.openingBalances,
          ].reverse(),
          sourceEvidence: [
            ...permutationBase.movementInput.sourceEvidence,
          ].reverse(),
        },
        annualInput: {
          ...permutationBase.annualInput,
          poolMembers: [
            ...permutationBase.annualInput.poolMembers,
          ].reverse(),
          completePoolEvidence: {
            ...permutationBase.annualInput.completePoolEvidence,
            accountIds: [
              ...permutationBase.annualInput.completePoolEvidence.accountIds,
            ].reverse() as [
              ReturnType<typeof asAccountId>,
              ...ReturnType<typeof asAccountId>[],
            ],
          },
        },
      }

    expect(
      coordinateOwnedNonRothIraAnnualWithdrawalCandidate(permuted),
    ).toEqual(
      coordinateOwnedNonRothIraAnnualWithdrawalCandidate(baseline),
    )

    const changeBase = mixedFixture()
    const changed:
      CoordinateOwnedNonRothIraAnnualWithdrawalCandidateInput = {
        ...changeBase,
        movementInput: {
          ...changeBase.movementInput,
          sourceEvidence: changeBase.movementInput.sourceEvidence.map(
            (source, index) =>
              index === 0
                ? {
                    ...source,
                    accountOwnershipEvidenceId:
                      'ownership-basis-revised',
                  }
                : source,
          ),
        },
        annualInput: {
          ...changeBase.annualInput,
          poolMembers: changeBase.annualInput.poolMembers.map(
            (member, index) =>
              index === 0
                ? {
                    ...member,
                    accountOwnershipEvidenceId:
                      'ownership-basis-revised',
                  }
                : member,
          ),
        },
      }
    expect(bindingId(changed)).not.toBe(baselineId)

    const dateBase = singleFixture()
    const dateChanged:
      CoordinateOwnedNonRothIraAnnualWithdrawalCandidateInput = {
        ...dateBase,
        movementInput: {
          ...dateBase.movementInput,
          requests: [{
            ...dateBase.movementInput.requests[0],
            executionDate: '2030-06-02',
          }],
        },
      }
    expect(bindingId(dateChanged)).not.toBe(bindingId(dateBase))
  })

  it('deep-freezes its result and does not mutate raw caller evidence', () => {
    const input = mixedFixture()
    const before = structuredClone(input)
    const result =
      coordinateOwnedNonRothIraAnnualWithdrawalCandidate(input)

    expect(input).toEqual(before)
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.movementCandidate)).toBe(true)
    if (result.status !== 'annualEvidenceBound') return
    expect(Object.isFrozen(result.bindingEvidence)).toBe(true)
    expect(Object.isFrozen(result.annualEvidence)).toBe(true)
    expect(() => {
      ;(result.bindingEvidence as { bindingEvidenceId: string })
        .bindingEvidenceId = 'mutated'
    }).toThrow()
  })

  it('atomically binds a mixed basis, disability, penalty-applies, and age owner-year', () => {
    const result =
      coordinateOwnedNonRothIraAnnualWithdrawalCandidate(
        mixedPenaltyFixture(),
      )

    expect(result.status).toBe('annualEvidenceBound')
    if (result.status !== 'annualEvidenceBound') return
    expect(
      result.annualEvidence.penaltyPrerequisites.evaluations.map(
        (evaluation) => evaluation.outcome,
      ),
    ).toEqual([
      'disabilityQualified',
      'penaltyApplies',
      'age59HalfReached',
    ])
    const penaltyEvaluation =
      result.annualEvidence.penaltyPrerequisites.evaluations[1]
    expect(penaltyEvaluation).toMatchObject({
      outcome: 'penaltyApplies',
      finalPenaltyAmount: 0,
      rejectedExceptions: [
        { exception: 'age59Half' },
        {
          exception: 'death',
          ownerAliveEvidence: {
            distributionDateEvidenceId:
              expect.stringContaining(
                'owned-non-roth-ira-staged-distribution-date:',
              ),
          },
        },
        { exception: 'iraSepp' },
        { exception: 'disability' },
        { exception: 'otherStatutoryException' },
      ],
    })
    expect(result.movement).toBe('notCommitted')
    expect(result.actionability).toBe('notEstablished')
  })

  it('suppresses annual and binding evidence when one mixed-batch sibling remains unresolved', () => {
    const input = mixedPenaltyFixture()
    input.noOtherExceptionAttestations = []

    const result =
      coordinateOwnedNonRothIraAnnualWithdrawalCandidate(input)

    expect(result).toMatchObject({
      status: 'annualEvidenceBlocked',
      movement: 'notCommitted',
      actionability: 'notEstablished',
      annualEvidence: null,
      bindingEvidence: null,
      issues: [{
        actionId: 'action-penalty',
        allocationId: 'allocation-penalty',
        prerequisite: {
          outcome: 'exceptionEvaluationRequired',
        },
      }],
    })
  })

  it('blocks the owner/year when incomplete evidence keeps a complete same-rate sibling provisional', () => {
    const base = mixedPenaltyFixture()
    const siblingSource =
      movementSource('ira-penalty-sibling', 'traditional')
    const input:
      CoordinateOwnedNonRothIraAnnualWithdrawalCandidateInput = {
        ...base,
        movementInput: {
          ...base.movementInput,
          requests: [
            ...base.movementInput.requests,
            request({
              suffix: 'penalty-sibling',
              date: '2030-01-25',
              sequence: 1,
              allocations: [
                allocation(
                  'penalty-sibling',
                  'ira-penalty-sibling',
                  1,
                ),
              ],
            }),
          ],
          openingBalances: [
            ...base.movementInput.openingBalances,
            {
              accountId: siblingSource.sourceAccountId,
              openingBalance: asUsdCents(1),
            },
          ],
          sourceEvidence: [
            ...base.movementInput.sourceEvidence,
            siblingSource,
          ],
        },
        annualInput: {
          ...base.annualInput,
          completePoolEvidence: {
            ...base.annualInput.completePoolEvidence,
            accountIds: [
              ...base.annualInput.completePoolEvidence.accountIds,
              siblingSource.sourceAccountId,
            ],
          },
          poolMembers: [
            ...base.annualInput.poolMembers,
            poolMember('ira-penalty-sibling', 'traditional'),
          ],
          annualFacts: {
            ...base.annualInput.annualFacts,
            form8606Line7DistributionAmount: asUsdCents(5),
          },
        },
        ownerAliveEvidence: [
          ...base.ownerAliveEvidence!,
          {
            predicate: 'ownerAliveOnOwnedIraDistributionDate',
            actionId: asActionId('action-penalty-sibling'),
            allocationId:
              asAllocationId('allocation-penalty-sibling'),
            sourceAccountId: asAccountId('ira-penalty-sibling'),
            ownerPersonId: asPersonId('owner'),
            evaluationDate: '2030-01-25',
            aliveOnEvaluationDate: true,
            ownerAliveEvidenceId: 'owner-alive-penalty-sibling',
          },
        ],
        rejectedDisabilityEvidence: [
          ...base.rejectedDisabilityEvidence!,
          {
            kind: 'disability',
            disabledPersonId: asPersonId('owner'),
            disabilityQualificationDate: null,
            evaluationDate: '2030-01-25',
            qualifiedOnEvaluationDate: false,
            disabilityEvidenceId:
              'rejected-disability-penalty-sibling',
          },
        ],
        iraSeppStatusEvidence: [
          ...base.iraSeppStatusEvidence!,
          {
            predicate: 'ownedNonRothIraSeppStatusForWithdrawal',
            actionId: asActionId('action-penalty-sibling'),
            allocationId:
              asAllocationId('allocation-penalty-sibling'),
            sourceAccountId: asAccountId('ira-penalty-sibling'),
            ownerPersonId: asPersonId('owner'),
            evaluationDate: '2030-01-25',
            status: 'none',
            electionId: null,
            scheduleId: null,
            seppStatusEvidenceId: 'no-sepp-penalty-sibling',
          },
        ],
      }

    const result =
      coordinateOwnedNonRothIraAnnualWithdrawalCandidate(input)

    expect(result.status).toBe('annualEvidenceBlocked')
    if (result.status !== 'annualEvidenceBlocked') return
    expect(result.annualEvidence).toBeNull()
    expect(result.bindingEvidence).toBeNull()
    expect(result.issues.map((issue) => ({
      actionId: issue.actionId,
      outcome: issue.prerequisite.outcome,
    }))).toEqual([
      {
        actionId: asActionId('action-penalty'),
        outcome: 'exceptionEvaluationRequired',
      },
      {
        actionId: asActionId('action-penalty-sibling'),
        outcome: 'exceptionEvaluationRequired',
      },
    ])
  })
})
