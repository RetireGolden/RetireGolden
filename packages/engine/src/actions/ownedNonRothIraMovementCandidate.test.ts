import { describe, expect, it } from 'vitest'
import { describeRule } from '../rules/describeRule.js'

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
  stageOwnedNonRothIraOrdinaryWithdrawalMovements,
  type OwnedNonRothIraMovementSourceEvidence,
  type StageOwnedNonRothIraOrdinaryWithdrawalMovementsInput,
} from './ownedNonRothIraMovementCandidate.js'
import {
  resolveOwnedNonRothIraAnnualWithdrawalEvidence,
} from './ownedNonRothIraAnnualFinalization.js'

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

function withdrawal(options: {
  suffix: string
  executionDate?: string
  sequence?: number
  year?: number
  personId?: string
  allocations: readonly SourceAllocationRequest[]
}): OrdinaryWithdrawalRequest {
  const requestedAmount = options.allocations.reduce(
    (total, item) => total + item.requestedAmount,
    0,
  )
  return {
    actionId: asActionId(`action-${options.suffix}`),
    kind: 'ordinaryWithdrawal',
    personId: asPersonId(options.personId ?? 'owner'),
    year: options.year ?? 2030,
    executionDate: options.executionDate ?? '2030-06-01',
    executionSequence: options.sequence ?? 1,
    requestedAmount: asPositiveUsdCents(requestedAmount),
    allocations: [...options.allocations],
    purpose: { kind: 'spending' },
    provenance: { source: 'manual' },
  }
}

function source(
  sourceAccountId: string,
  subtype: 'traditional' | 'sep' | 'simple' = 'traditional',
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

function fixture(): StageOwnedNonRothIraOrdinaryWithdrawalMovementsInput {
  return {
    ownerPersonId: asPersonId('owner'),
    taxYear: 2030,
    requests: [
      withdrawal({
        suffix: 'one',
        sequence: 1,
        allocations: [allocation('one', 'ira-one', 75)],
      }),
    ],
    openingBalances: [{
      accountId: asAccountId('ira-one'),
      openingBalance: asUsdCents(100),
    }],
    sourceEvidence: [source('ira-one')],
  }
}

function stageForFinalization(options: {
  openingBalance?: number
  requestedAmount?: number
  executionDate?: string
} = {}) {
  return stageOwnedNonRothIraOrdinaryWithdrawalMovements({
    ownerPersonId: asPersonId('owner'),
    taxYear: 2030,
    requests: [
      withdrawal({
        suffix: 'finalization',
        executionDate: options.executionDate ?? '2030-06-01',
        allocations: [
          allocation(
            'finalization',
            'ira-one',
            options.requestedAmount ?? 100,
          ),
        ],
      }),
    ],
    openingBalances: [{
      accountId: asAccountId('ira-one'),
      openingBalance: asUsdCents(options.openingBalance ?? 100),
    }],
    sourceEvidence: [source('ira-one')],
  })
}

function finalizeStaged(options: {
  birthDate: string
  openingBasisAmount: number
  includeDisability?: boolean
}) {
  const staged = stageForFinalization()
  if (staged.status !== 'movementCandidateStaged') {
    throw new Error('Finalization fixture unexpectedly has an invalid schedule')
  }
  return resolveOwnedNonRothIraAnnualWithdrawalEvidence({
    annualInput: {
      ownerPersonId: asPersonId('owner'),
      ownerWideNonRothIraPoolId: 'owner-pool',
      completePoolEvidence: {
        predicate: 'completeOwnedNonRothIraPoolForOwnerAndTaxYear',
        ownerPersonId: asPersonId('owner'),
        ownerWideNonRothIraPoolId: 'owner-pool',
        taxYear: 2030,
        accountIds: [asAccountId('ira-one')],
        yearEndApplicablePoolBalanceAmount: asUsdCents(0),
        evidenceId: 'complete-pool',
      },
      annualBasisRecordEvidenceId: 'annual-basis-record',
      taxYear: 2030,
      poolMembers: [{
        sourceAccountId: asAccountId('ira-one'),
        ownerPersonId: asPersonId('owner'),
        accountType: 'traditional',
        accountKind: 'ira',
        inheritanceStatus: 'owned',
        subtype: 'traditional',
        yearEndApplicableBalanceAmount: asUsdCents(0),
        iraClassificationEvidenceId: 'classification-ira-one',
        accountOwnershipEvidenceId: 'ownership-ira-one',
      }],
      annualFacts: {
        openingBasisAmount: asUsdCents(options.openingBasisAmount),
        taxYearNondeductibleContributionAmount: asUsdCents(0),
        postYearNondeductibleContributionExcludedAmount: asUsdCents(0),
        yearEndApplicablePoolBalanceAmount: asUsdCents(0),
        outstandingRolloverAmount: asUsdCents(0),
        rolloverRepaymentAdjustmentAmount: asUsdCents(0),
        form8606Line7DistributionAmount: asUsdCents(100),
        form8606Line8NetConversionAmount: asUsdCents(0),
      },
      line8Conversions: [],
    },
    stagedExecutedWithdrawals: staged.line7Distributions,
    ownerEvidence: {
      predicate: 'ownerBirthDateForIraPenaltyAgeThreshold',
      ownerPersonId: asPersonId('owner'),
      birthDate: options.birthDate,
      evidenceId: 'owner-birth',
    },
    sourceEvidence: [{
      predicate: 'ownedNonRothIraPenaltySourceForWithdrawal',
      actionId: asActionId('action-finalization'),
      allocationId: asAllocationId('allocation-finalization'),
      sourceAccountId: asAccountId('ira-one'),
      ownerPersonId: asPersonId('owner'),
      subtype: 'traditional',
      evaluationDate: '2030-06-01',
      distributionDateEvidenceId: 'distribution-date',
      accountOwnershipEvidenceId: 'ownership-ira-one',
      iraClassificationEvidenceId: 'classification-ira-one',
    }],
    qualifiedDisabilityEvidence:
      options.includeDisability === true
        ? [{
            kind: 'disability',
            disabledPersonId: asPersonId('owner'),
            disabilityQualificationDate: '2030-05-01',
            evaluationDate: '2030-06-01',
            qualifiedOnEvaluationDate: true,
            disabilityEvidenceId: 'disability',
          }]
        : [],
    simpleParticipationEvidence: [],
  })
}

describe('stageOwnedNonRothIraOrdinaryWithdrawalMovements', () => {
  // The record's discriminating pair, stated in the form's terms: an executed
  // ordinary withdrawal from the owned non-Roth IRA pool appears among the
  // Form 8606 line 7 distribution candidates, and a reading under which owned
  // IRA distributions are not reportable on line 7 would stage none. The
  // request fits inside the opening balance so the expected amount is the
  // statutory consequence, not balance clipping.
  describeRule('form-8606-line-7-owned-ira-movement-staging', {
    note: 'executed owned-IRA withdrawals stage as line 7 distribution candidates',
    readings: {
      distributionStagedOnLineSeven: [75],
      rejectedNotReportableOnLineSeven: [] as number[],
    },
    accepted: 'distributionStagedOnLineSeven',
  }, ({ accepted }) => {
    it('stages the executed withdrawal as a line-7 distribution candidate', () => {
      const result = stageOwnedNonRothIraOrdinaryWithdrawalMovements({
        ownerPersonId: asPersonId('owner'),
        taxYear: 2030,
        requests: [
          withdrawal({
            suffix: 'full',
            executionDate: '2030-06-01',
            sequence: 1,
            allocations: [allocation('full', 'ira-one', 75)],
          }),
        ],
        openingBalances: [{
          accountId: asAccountId('ira-one'),
          openingBalance: asUsdCents(100),
        }],
        sourceEvidence: [source('ira-one')],
      })
      expect(result.status).toBe('movementCandidateStaged')
      expect(result.line7Distributions.map((item) => item.grossAmount))
        .toEqual(accepted)
    })
  })

  // The pool-scope record's discriminating pair: the source-evidence gate
  // refuses anything that is not an owned traditional/SEP/SIMPLE IRA, so an
  // inherited account can never enter the owner-wide basis pool through this
  // stager. The rejected reading would stage it like any other source.
  describeRule('irc-408-d-2-A-owner-wide-non-inherited-ira-pool', {
    note: 'inherited sources are refused at the owned-pool gate',
    readings: {
      inheritedSourceRefused: 'RangeError',
      inheritedAdmittedToOwnedPool: 'movementCandidateStaged',
    },
    accepted: 'inheritedSourceRefused',
  }, ({ accepted }) => {
    it('refuses an inherited source before any staging happens', () => {
      const inheritedEvidence = { ...source('ira-one'), inheritanceStatus: 'inherited' } as never
      const attempt = () => stageOwnedNonRothIraOrdinaryWithdrawalMovements({
        ownerPersonId: asPersonId('owner'),
        taxYear: 2030,
        requests: [
          withdrawal({
            suffix: 'full',
            executionDate: '2030-06-01',
            sequence: 1,
            allocations: [allocation('full', 'ira-one', 75)],
          }),
        ],
        openingBalances: [{
          accountId: asAccountId('ira-one'),
          openingBalance: asUsdCents(100),
        }],
        sourceEvidence: [inheritedEvidence],
      })
      expect(attempt).toThrow(RangeError)
      let name = ''
      try { attempt() } catch (err) { name = (err as Error).constructor.name }
      expect(name).toBe(accepted)
      // The identical request with owned evidence stages, so the refusal is
      // the gate discriminating on inheritance status, not a broken stager.
      const owned = stageOwnedNonRothIraOrdinaryWithdrawalMovements({
        ownerPersonId: asPersonId('owner'),
        taxYear: 2030,
        requests: [
          withdrawal({
            suffix: 'full',
            executionDate: '2030-06-01',
            sequence: 1,
            allocations: [allocation('full', 'ira-one', 75)],
          }),
        ],
        openingBalances: [{
          accountId: asAccountId('ira-one'),
          openingBalance: asUsdCents(100),
        }],
        sourceEvidence: [source('ira-one')],
      })
      expect(owned.status).toBe('movementCandidateStaged')
    })
  })

  it('stages same-source actions sequentially as full, partial, and all-zero candidates', () => {
    const result = stageOwnedNonRothIraOrdinaryWithdrawalMovements({
      ownerPersonId: asPersonId('owner'),
      taxYear: 2030,
      requests: [
        withdrawal({
          suffix: 'zero',
          executionDate: '2030-06-03',
          sequence: 1,
          allocations: [allocation('zero', 'ira-one', 10)],
        }),
        withdrawal({
          suffix: 'partial',
          executionDate: '2030-06-02',
          sequence: 1,
          allocations: [allocation('partial', 'ira-one', 50)],
        }),
        withdrawal({
          suffix: 'full',
          executionDate: '2030-06-01',
          sequence: 1,
          allocations: [allocation('full', 'ira-one', 75)],
        }),
      ],
      openingBalances: [{
        accountId: asAccountId('ira-one'),
        openingBalance: asUsdCents(100),
      }],
      sourceEvidence: [source('ira-one')],
    })

    expect(result.status).toBe('movementCandidateStaged')
    expect(result.movement).toBe('notCommitted')
    expect(result.actions.map((item) => item.actionId)).toEqual([
      'action-full',
      'action-partial',
      'action-zero',
    ])
    expect(
      result.actions.map(
        (item) => item.candidateDisposition.candidateStatus,
      ),
    ).toEqual(['fullyStaged', 'partiallyStaged', 'notStaged'])
    expect(
      result.actions.map((item) => item.executedAmount),
    ).toEqual([75, 25, 0])
    expect(result.actions[1]?.allocations[0]).toMatchObject({
      balanceBefore: 25,
      executedAmount: 25,
      unexecutedAmount: 25,
      candidateBalanceAfter: 0,
    })
    expect(result.actions[2]?.candidateDisposition.reasons[0]?.code).toBe(
      'source-balance-unavailable',
    )
    expect(result.line7Distributions.map((item) => item.grossAmount)).toEqual([
      75,
      25,
    ])
    expect(result.candidateBalances).toEqual([{
      sourceAccountId: 'ira-one',
      ownerPersonId: 'owner',
      openingBalance: 100,
      requestedAmount: 135,
      executedAmount: 100,
      unexecutedAmount: 35,
      candidateClosingBalance: 0,
    }])
  })

  it('retains zero-executed sibling evidence but excludes it from line 7', () => {
    const result = stageOwnedNonRothIraOrdinaryWithdrawalMovements({
      ownerPersonId: asPersonId('owner'),
      taxYear: 2030,
      requests: [
        withdrawal({
          suffix: 'siblings',
          allocations: [
            allocation('positive', 'ira-positive', 75),
            allocation('zero', 'ira-zero', 25),
          ],
        }),
      ],
      openingBalances: [
        {
          accountId: asAccountId('ira-zero'),
          openingBalance: asUsdCents(0),
        },
        {
          accountId: asAccountId('ira-positive'),
          openingBalance: asUsdCents(50),
        },
      ],
      sourceEvidence: [source('ira-zero'), source('ira-positive', 'sep')],
    })

    expect(result.status).toBe('movementCandidateStaged')
    expect(result.actions[0]?.candidateDisposition).toMatchObject({
      candidateStatus: 'partiallyStaged',
      stagedAmount: 50,
      unstagedAmount: 50,
    })
    expect(result.actions[0]?.allocations).toHaveLength(2)
    expect(result.actions[0]?.allocations[1]).toMatchObject({
      allocationId: 'allocation-zero',
      executedAmount: 0,
      unexecutedAmount: 25,
    })
    expect(result.line7Distributions).toEqual([{
      actionId: 'action-siblings',
      allocationId: 'allocation-positive',
      sourceAccountId: 'ira-positive',
      scheduledDate: '2030-06-01',
      scheduledSequence: 1,
      grossAmount: 50,
    }])
  })

  it('aborts a conflicting schedule with an unchanged candidate', () => {
    const result = stageOwnedNonRothIraOrdinaryWithdrawalMovements({
      ownerPersonId: asPersonId('owner'),
      taxYear: 2030,
      requests: [
        withdrawal({
          suffix: 'b',
          allocations: [allocation('b', 'ira-one', 10)],
        }),
        withdrawal({
          suffix: 'a',
          allocations: [allocation('a', 'ira-one', 20)],
        }),
      ],
      openingBalances: [{
        accountId: asAccountId('ira-one'),
        openingBalance: asUsdCents(100),
      }],
      sourceEvidence: [source('ira-one')],
    })

    expect(result).toMatchObject({
      status: 'scheduleInvalid',
      movement: 'notCommitted',
      actions: [],
      line7Distributions: [],
      scheduleIssues: [{
        kind: 'executionSequenceConflict',
        executionDate: '2030-06-01',
        executionSequence: 1,
        collidingActionIds: ['action-a', 'action-b'],
      }],
      candidateBalances: [{
        openingBalance: 100,
        requestedAmount: 30,
        executedAmount: 0,
        unexecutedAmount: 30,
        candidateClosingBalance: 100,
      }],
    })
  })

  it.each([
    [
      'undated',
      () => {
        const input = fixture()
        delete (input.requests[0] as { executionDate?: string }).executionDate
        return input
      },
      'executionDateRequired',
    ],
    [
      'noncanonical date',
      () => {
        const input = fixture()
        ;(input.requests[0] as { executionDate: string }).executionDate =
          '2030-6-01'
        return input
      },
      'executionDateInvalid',
    ],
    [
      'foreign date',
      () => {
        const input = fixture()
        ;(input.requests[0] as { executionDate: string }).executionDate =
          '2031-06-01'
        return input
      },
      'executionDateYearMismatch',
    ],
    [
      'foreign action year',
      () => {
        const input = fixture()
        ;(input.requests[0] as { year: number }).year = 2031
        return input
      },
      'actionYearMismatch',
    ],
  ] as const)('fails closed for a %s', (_label, makeInput, issueKind) => {
    const result = stageOwnedNonRothIraOrdinaryWithdrawalMovements(
      makeInput(),
    )
    expect(result.status).toBe('scheduleInvalid')
    expect(result.scheduleIssues.map((item) => item.kind)).toContain(
      issueKind,
    )
    expect(result.candidateBalances[0]?.candidateClosingBalance).toBe(100)
  })

  it('rejects duplicate action IDs while allowing action-scoped allocation IDs', () => {
    const duplicatedAction = fixture()
    duplicatedAction.requests = [
      duplicatedAction.requests[0]!,
      {
        ...duplicatedAction.requests[0]!,
        executionSequence: 2,
        allocations: [allocation('two', 'ira-one', 5)],
        requestedAmount: asPositiveUsdCents(5),
      },
    ]
    const actionResult =
      stageOwnedNonRothIraOrdinaryWithdrawalMovements(duplicatedAction)
    expect(actionResult.status).toBe('scheduleInvalid')
    expect(actionResult.scheduleIssues[0]?.kind).toBe('duplicateActionId')

    const repeatedAllocation = fixture()
    repeatedAllocation.requests = [
      repeatedAllocation.requests[0]!,
      withdrawal({
        suffix: 'two',
        sequence: 2,
        allocations: [allocation('one', 'ira-one', 5)],
      }),
    ]
    const repeatedAllocationResult =
      stageOwnedNonRothIraOrdinaryWithdrawalMovements(
        repeatedAllocation,
      )
    expect(repeatedAllocationResult.status).toBe(
      'movementCandidateStaged',
    )
    expect(
      repeatedAllocationResult.actions.map((item) => [
        item.actionId,
        item.allocations[0]?.allocationId,
      ]),
    ).toEqual([
      ['action-one', 'allocation-one'],
      ['action-two', 'allocation-one'],
    ])
  })

  it('keeps invalid duplicate-action evidence invariant to input order', () => {
    const duplicateA = withdrawal({
      suffix: 'duplicate',
      executionDate: '2030-06-01',
      sequence: 1,
      allocations: [allocation('duplicate-a', 'ira-one', 10)],
    })
    const duplicateB = {
      ...duplicateA,
      executionDate: '2030-06-02',
      allocations: [allocation('duplicate-b', 'ira-one', 20)],
      requestedAmount: asPositiveUsdCents(20),
    }
    const independent = withdrawal({
      suffix: 'independent',
      executionDate: '2030-06-03',
      sequence: 1,
      allocations: [allocation('independent', 'ira-one', 5)],
    })
    const baseline = fixture()
    baseline.requests = [duplicateA, independent, duplicateB]
    const permuted = {
      ...baseline,
      requests: [duplicateB, duplicateA, independent],
    }

    const baselineResult =
      stageOwnedNonRothIraOrdinaryWithdrawalMovements(baseline)
    const permutedResult =
      stageOwnedNonRothIraOrdinaryWithdrawalMovements(permuted)
    expect(baselineResult.status).toBe('scheduleInvalid')
    expect(permutedResult).toEqual(baselineResult)
  })

  it.each([
    [
      'foreign owner',
      (input: StageOwnedNonRothIraOrdinaryWithdrawalMovementsInput) => {
        ;(
          input.sourceEvidence[0] as {
            ownerPersonId: ReturnType<typeof asPersonId>
          }
        ).ownerPersonId = asPersonId('other-owner')
      },
      'foreign owner',
    ],
    [
      'missing source evidence',
      (input: StageOwnedNonRothIraOrdinaryWithdrawalMovementsInput) => {
        input.sourceEvidence = []
      },
      'Missing owned IRA source evidence',
    ],
    [
      'duplicate source evidence',
      (input: StageOwnedNonRothIraOrdinaryWithdrawalMovementsInput) => {
        input.sourceEvidence = [
          input.sourceEvidence[0]!,
          { ...input.sourceEvidence[0]! },
        ]
      },
      'Duplicate source evidence',
    ],
    [
      'reused ownership evidence ID',
      (input: StageOwnedNonRothIraOrdinaryWithdrawalMovementsInput) => {
        input.requests = [
          withdrawal({
            suffix: 'two-source',
            allocations: [
              allocation('one', 'ira-one', 50),
              allocation('two', 'ira-two', 25),
            ],
          }),
        ]
        input.openingBalances = [
          input.openingBalances[0]!,
          {
            accountId: asAccountId('ira-two'),
            openingBalance: asUsdCents(25),
          },
        ]
        input.sourceEvidence = [
          input.sourceEvidence[0]!,
          {
            ...source('ira-two'),
            accountOwnershipEvidenceId: 'ownership-ira-one',
          },
        ]
      },
      'Duplicate account ownership evidence ID',
    ],
    [
      'reused classification evidence ID',
      (input: StageOwnedNonRothIraOrdinaryWithdrawalMovementsInput) => {
        input.requests = [
          withdrawal({
            suffix: 'two-source',
            allocations: [
              allocation('one', 'ira-one', 50),
              allocation('two', 'ira-two', 25),
            ],
          }),
        ]
        input.openingBalances = [
          input.openingBalances[0]!,
          {
            accountId: asAccountId('ira-two'),
            openingBalance: asUsdCents(25),
          },
        ]
        input.sourceEvidence = [
          input.sourceEvidence[0]!,
          {
            ...source('ira-two'),
            iraClassificationEvidenceId: 'classification-ira-one',
          },
        ]
      },
      'Duplicate IRA classification evidence ID',
    ],
    [
      'missing opening snapshot',
      (input: StageOwnedNonRothIraOrdinaryWithdrawalMovementsInput) => {
        input.openingBalances = []
      },
      'Missing exact-cent opening snapshot',
    ],
    [
      'duplicate opening snapshot',
      (input: StageOwnedNonRothIraOrdinaryWithdrawalMovementsInput) => {
        input.openingBalances = [
          input.openingBalances[0]!,
          { ...input.openingBalances[0]! },
        ]
      },
      'Duplicate opening snapshot',
    ],
    [
      'inherited source',
      (input: StageOwnedNonRothIraOrdinaryWithdrawalMovementsInput) => {
        ;(
          input.sourceEvidence[0] as {
            inheritanceStatus: string
          }
        ).inheritanceStatus = 'inherited'
      },
      'not a supported owned',
    ],
    [
      'Roth source',
      (input: StageOwnedNonRothIraOrdinaryWithdrawalMovementsInput) => {
        ;(
          input.sourceEvidence[0] as {
            accountType: string
          }
        ).accountType = 'roth'
      },
      'not a supported owned',
    ],
  ] as const)('rejects %s evidence', (_label, mutate, message) => {
    const input = fixture()
    mutate(input)
    expect(() =>
      stageOwnedNonRothIraOrdinaryWithdrawalMovements(input),
    ).toThrow(message)
  })

  it('is invariant to collection and allocation permutations', () => {
    const baseline: StageOwnedNonRothIraOrdinaryWithdrawalMovementsInput = {
      ownerPersonId: asPersonId('owner'),
      taxYear: 2030,
      requests: [
        withdrawal({
          suffix: 'two',
          executionDate: '2030-06-02',
          allocations: [allocation('two', 'ira-two', 10)],
        }),
        withdrawal({
          suffix: 'one',
          executionDate: '2030-06-01',
          allocations: [
            allocation('one-b', 'ira-two', 20),
            allocation('one-a', 'ira-one', 30),
          ],
        }),
      ],
      openingBalances: [
        {
          accountId: asAccountId('ira-two'),
          openingBalance: asUsdCents(30),
        },
        {
          accountId: asAccountId('ira-one'),
          openingBalance: asUsdCents(30),
        },
      ],
      sourceEvidence: [source('ira-two', 'simple'), source('ira-one')],
    }
    const permuted: StageOwnedNonRothIraOrdinaryWithdrawalMovementsInput = {
      ...baseline,
      requests: [...baseline.requests]
        .reverse()
        .map((request) => ({
          ...request,
          allocations: [...request.allocations].reverse(),
        })),
      openingBalances: [...baseline.openingBalances].reverse(),
      sourceEvidence: [...baseline.sourceEvidence].reverse(),
    }

    expect(
      stageOwnedNonRothIraOrdinaryWithdrawalMovements(permuted),
    ).toEqual(
      stageOwnedNonRothIraOrdinaryWithdrawalMovements(baseline),
    )
  })

  it('orders allocations by stable allocation ID, not source account ID', () => {
    const result = stageOwnedNonRothIraOrdinaryWithdrawalMovements({
      ownerPersonId: asPersonId('owner'),
      taxYear: 2030,
      requests: [
        withdrawal({
          suffix: 'allocation-order',
          allocations: [
            allocation('z', 'ira-a-source', 10),
            allocation('a', 'ira-z-source', 10),
          ],
        }),
      ],
      openingBalances: [
        {
          accountId: asAccountId('ira-a-source'),
          openingBalance: asUsdCents(10),
        },
        {
          accountId: asAccountId('ira-z-source'),
          openingBalance: asUsdCents(10),
        },
      ],
      sourceEvidence: [
        source('ira-a-source'),
        source('ira-z-source'),
      ],
    })

    expect(result.status).toBe('movementCandidateStaged')
    expect(
      result.actions[0]?.allocations.map((item) => item.allocationId),
    ).toEqual(['allocation-a', 'allocation-z'])
    expect(
      result.line7Distributions.map((item) => item.allocationId),
    ).toEqual(['allocation-a', 'allocation-z'])
  })

  it('binds requests, source facts, openings, executions, and candidate balances into its ID', () => {
    const baseline =
      stageOwnedNonRothIraOrdinaryWithdrawalMovements(fixture())
    const changedOpening = fixture()
    changedOpening.openingBalances = [{
      ...changedOpening.openingBalances[0]!,
      openingBalance: asUsdCents(99),
    }]
    const changedClassification = fixture()
    changedClassification.sourceEvidence = [{
      ...changedClassification.sourceEvidence[0]!,
      iraClassificationEvidenceId: 'changed-classification',
    }]
    const changedRequest = fixture()
    changedRequest.requests = [{
      ...changedRequest.requests[0]!,
      purpose: { kind: 'goal', referenceId: 'changed-goal' },
    }]

    expect(
      stageOwnedNonRothIraOrdinaryWithdrawalMovements(changedOpening)
        .movementCandidateId,
    ).not.toBe(baseline.movementCandidateId)
    expect(
      stageOwnedNonRothIraOrdinaryWithdrawalMovements(
        changedClassification,
      ).movementCandidateId,
    ).not.toBe(baseline.movementCandidateId)
    expect(
      stageOwnedNonRothIraOrdinaryWithdrawalMovements(changedRequest)
        .movementCandidateId,
    ).not.toBe(baseline.movementCandidateId)
  })

  it('returns detached, deeply frozen evidence without freezing callers', () => {
    const input = fixture()
    const result =
      stageOwnedNonRothIraOrdinaryWithdrawalMovements(input)

    expect(Object.isFrozen(input)).toBe(false)
    expect(Object.isFrozen(input.requests)).toBe(false)
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.candidateBalances)).toBe(true)
    expect(Object.isFrozen(result.actions[0])).toBe(true)
    expect(Object.isFrozen(result.actions[0]?.allocations[0])).toBe(true)

    ;(
      input.openingBalances[0] as {
        openingBalance: ReturnType<typeof asUsdCents>
      }
    ).openingBalance = asUsdCents(1)
    ;(
      input.requests[0]?.allocations[0] as {
        requestedAmount: ReturnType<typeof asPositiveUsdCents>
      }
    ).requestedAmount = asPositiveUsdCents(1)
    expect(result.candidateBalances[0]?.openingBalance).toBe(100)
    expect(result.actions[0]?.allocations[0]?.requestedAmount).toBe(75)
  })

  it('hands line-7 entries directly to annual finalization without committing', () => {
    const age = finalizeStaged({
      birthDate: '1960-01-01',
      openingBasisAmount: 0,
    })
    const disability = finalizeStaged({
      birthDate: '1980-01-01',
      openingBasisAmount: 0,
      includeDisability: true,
    })
    const allBasis = finalizeStaged({
      birthDate: '1980-01-01',
      openingBasisAmount: 100,
    })
    const unresolved = finalizeStaged({
      birthDate: '1980-01-01',
      openingBasisAmount: 0,
    })

    expect(age.status).toBe('annualEvidenceResolved')
    expect(disability.status).toBe('annualEvidenceResolved')
    expect(allBasis.status).toBe('annualEvidenceResolved')
    expect(unresolved.status).toBe('penaltyEvidenceMissing')
    expect([age, disability, allBasis, unresolved].every(
      (item) => item.movement === 'notCommitted',
    )).toBe(true)
    if (age.status === 'annualEvidenceResolved') {
      expect(
        age.annualEvidence.penaltyPrerequisites.evaluations[0]?.outcome,
      ).toBe('age59HalfReached')
    }
    if (disability.status === 'annualEvidenceResolved') {
      expect(
        disability.annualEvidence.penaltyPrerequisites.evaluations[0]
          ?.outcome,
      ).toBe('disabilityQualified')
    }
    if (allBasis.status === 'annualEvidenceResolved') {
      expect(
        allBasis.annualEvidence.penaltyPrerequisites.evaluations,
      ).toEqual([])
    }
    expect(unresolved.issues[0]?.reason.code).toBe(
      'withdrawal-penalty-evidence-missing',
    )
  })

  it('never publishes a normative execution readiness or outcome', () => {
    const staged =
      stageOwnedNonRothIraOrdinaryWithdrawalMovements(fixture())
    expect(staged.status).toBe('movementCandidateStaged')
    const disposition = staged.actions[0]?.candidateDisposition as
      | Record<string, unknown>
      | undefined
    expect(disposition).not.toHaveProperty('readiness')
    expect(disposition).not.toHaveProperty('outcome')
    expect(disposition).not.toHaveProperty('executedAmount')
    expect(disposition).toMatchObject({
      candidateStatus: 'fullyStaged',
      stagedAmount: 75,
      unstagedAmount: 0,
    })
  })

  it('rejects unsafe aggregate source cents', () => {
    const input = fixture()
    input.requests = [
      {
        ...input.requests[0]!,
        requestedAmount: asPositiveUsdCents(Number.MAX_SAFE_INTEGER),
        allocations: [{
          ...input.requests[0]!.allocations[0]!,
          requestedAmount:
            asPositiveUsdCents(Number.MAX_SAFE_INTEGER),
        }],
      },
      withdrawal({
        suffix: 'two',
        sequence: 2,
        allocations: [allocation('two', 'ira-one', 1)],
      }),
    ]
    expect(() =>
      stageOwnedNonRothIraOrdinaryWithdrawalMovements(input),
    ).toThrow('safe-integer cents range')
  })
})
