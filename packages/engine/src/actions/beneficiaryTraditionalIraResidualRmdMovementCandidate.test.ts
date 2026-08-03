import { describe, expect, it } from 'vitest'
import type {
  BeneficiaryTraditionalIraDetachedPhysicalApplication,
  BeneficiaryTraditionalIraDetachedRmdTransition,
  BeneficiaryTraditionalIraDetachedSourceBalanceTransition,
} from './beneficiaryTraditionalIraAnnualPhysicalTransaction.js'
import {
  prepareBeneficiaryTraditionalIraResidualRmdAllocation,
  type PrepareBeneficiaryTraditionalIraResidualRmdAllocationInput,
} from './beneficiaryTraditionalIraResidualRmdAllocation.js'
import {
  stageBeneficiaryTraditionalIraResidualRmdMovement,
  type BeneficiaryTraditionalIraResidualRmdScheduleEvidence,
} from './beneficiaryTraditionalIraResidualRmdMovementCandidate.js'
import { asAccountId, asPersonId } from './identity.js'
import { asUsdCents } from './money.js'
import { deriveActionStructuralId } from './structuralId.js'

const beneficiaryPersonId = asPersonId('beneficiary')
const decedentPersonId = asPersonId('decedent')

function rmd(
  remaining = 5_000,
): BeneficiaryTraditionalIraDetachedRmdTransition {
  const transition = {
    predicate: 'beneficiaryTraditionalIraDetachedRmdTransition' as const,
    beneficiaryPersonId,
    decedentPersonId,
    taxYear: 2026,
    rmdPoolId: 'pool:beneficiary:decedent',
    rmdRequiredAmount: asUsdCents(5_000 + remaining),
    initialRmdSatisfiedAmount: asUsdCents(1_000),
    rmdSatisfiedByTransaction: asUsdCents(4_000),
    finalRmdSatisfiedAmount: asUsdCents(5_000),
    finalRmdRemainingAmount: asUsdCents(remaining),
    applicationEvidenceIds: ['application:a', 'application:b'],
    finalAnnualEvidenceId: 'annual:final',
    coordinatorEvidenceId: 'coordinator',
  }
  return {
    ...transition,
    transitionEvidenceId: deriveActionStructuralId(
      'beneficiary-ira-detached-rmd-transition',
      [transition],
    ),
  }
}

function source(
  id: string,
  opening: number,
  executed: number,
  applicationEvidenceId: string,
): BeneficiaryTraditionalIraDetachedSourceBalanceTransition {
  const transition = {
    predicate:
      'beneficiaryTraditionalIraDetachedSourceBalanceTransition' as const,
    beneficiaryPersonId,
    decedentPersonId,
    taxYear: 2026,
    sourceAccountId: asAccountId(id),
    annualOpeningBalanceAmount: asUsdCents(opening),
    totalExecutedAmount: asUsdCents(executed),
    annualFinalBalanceAmount: asUsdCents(opening - executed),
    applicationEvidenceIds: [applicationEvidenceId],
    finalAnnualEvidenceId: 'annual:final',
    coordinatorEvidenceId: 'coordinator',
  }
  return {
    ...transition,
    transitionEvidenceId: deriveActionStructuralId(
      'beneficiary-ira-detached-source-balance-transition',
      [transition],
    ),
  }
}

function allocationInput(
  remaining = 5_000,
  sources: readonly BeneficiaryTraditionalIraDetachedSourceBalanceTransition[] = [
    source('account:b', 7_000, 2_000, 'application:b'),
    source('account:a', 4_000, 2_000, 'application:a'),
  ],
): PrepareBeneficiaryTraditionalIraResidualRmdAllocationInput {
  const draft = {
    rmdTransition: rmd(remaining),
    sourceBalanceTransitions: [...sources],
  }
  const applications = predecessorApplications(draft)
  for (const sourceTransition of draft.sourceBalanceTransitions) {
    const mutableSource = sourceTransition as unknown as {
      applicationEvidenceIds: string[]
      transitionEvidenceId: string
    }
    mutableSource.applicationEvidenceIds = applications
      .filter((application) =>
        application.sourceAccountId === sourceTransition.sourceAccountId)
      .map((application) => application.applicationEvidenceId)
    const sourceWithoutId = { ...sourceTransition }
    Reflect.deleteProperty(sourceWithoutId, 'transitionEvidenceId')
    mutableSource.transitionEvidenceId = deriveActionStructuralId(
      'beneficiary-ira-detached-source-balance-transition',
      [sourceWithoutId],
    )
  }
  const mutableRmd = draft.rmdTransition as unknown as {
    applicationEvidenceIds: string[]
    transitionEvidenceId: string
  }
  mutableRmd.applicationEvidenceIds = applications.map(
    (application) => application.applicationEvidenceId,
  )
  const rmdWithoutId = { ...draft.rmdTransition }
  Reflect.deleteProperty(rmdWithoutId, 'transitionEvidenceId')
  mutableRmd.transitionEvidenceId = deriveActionStructuralId(
    'beneficiary-ira-detached-rmd-transition',
    [rmdWithoutId],
  )
  return draft
}

function predecessorApplications(
  input: PrepareBeneficiaryTraditionalIraResidualRmdAllocationInput,
): BeneficiaryTraditionalIraDetachedPhysicalApplication[] {
  const sources = [...input.sourceBalanceTransitions].sort((left, right) =>
    left.sourceAccountId < right.sourceAccountId ? -1 : 1)
  let rmdSatisfied = input.rmdTransition.initialRmdSatisfiedAmount
  return sources.map((sourceTransition, index) => {
    const satisfiedByApplication = asUsdCents(Math.min(
      sourceTransition.totalExecutedAmount,
      input.rmdTransition.rmdRequiredAmount - rmdSatisfied,
    ))
    const rmdSatisfiedAfter = asUsdCents(
      rmdSatisfied + satisfiedByApplication,
    )
    const application = {
      predicate:
        'beneficiaryTraditionalIraDetachedPhysicalApplication' as const,
      beneficiaryPersonId,
      decedentPersonId,
      taxYear: 2026,
      actionId: `action:${sourceTransition.sourceAccountId}` as
        BeneficiaryTraditionalIraDetachedPhysicalApplication['actionId'],
      allocationId: `allocation:${sourceTransition.sourceAccountId}` as
        BeneficiaryTraditionalIraDetachedPhysicalApplication['allocationId'],
      sourceAccountId: sourceTransition.sourceAccountId,
      executionDate: index === 0 ? '2026-02-01' : '2026-08-01',
      executionSequence: 1,
      requestedAmount: sourceTransition.totalExecutedAmount as
        BeneficiaryTraditionalIraDetachedPhysicalApplication['requestedAmount'],
      executedAmount: sourceTransition.totalExecutedAmount as
        BeneficiaryTraditionalIraDetachedPhysicalApplication['executedAmount'],
      sourceBalanceBefore: sourceTransition.annualOpeningBalanceAmount,
      sourceBalanceAfter: sourceTransition.annualFinalBalanceAmount,
      rmdSatisfiedBefore: rmdSatisfied,
      rmdSatisfiedByApplication: satisfiedByApplication,
      rmdSatisfiedAfter,
      rmdRemainingAfter: asUsdCents(
        input.rmdTransition.rmdRequiredAmount - rmdSatisfiedAfter,
      ),
      physicalSourceEvidenceId:
        `physical:${sourceTransition.sourceAccountId}`,
      movementCandidateId: `movement:${sourceTransition.sourceAccountId}`,
      finalMemberEvidenceId:
        `final-member:${sourceTransition.sourceAccountId}`,
      finalAnnualEvidenceId: input.rmdTransition.finalAnnualEvidenceId,
      coordinatorEvidenceId: input.rmdTransition.coordinatorEvidenceId,
    }
    rmdSatisfied = rmdSatisfiedAfter
    return {
      ...application,
      applicationEvidenceId: deriveActionStructuralId(
        'beneficiary-ira-detached-physical-application',
        [application],
      ),
    }
  })
}

function rederiveApplication(
  application: BeneficiaryTraditionalIraDetachedPhysicalApplication,
): void {
  const mutable = application as unknown as Record<string, unknown>
  const withoutId = { ...mutable }
  Reflect.deleteProperty(withoutId, 'applicationEvidenceId')
  mutable['applicationEvidenceId'] = deriveActionStructuralId(
    'beneficiary-ira-detached-physical-application',
    [withoutId],
  )
}

function rebindApplicationLineage(
  input: PrepareBeneficiaryTraditionalIraResidualRmdAllocationInput,
  applications: readonly BeneficiaryTraditionalIraDetachedPhysicalApplication[],
): void {
  for (const sourceTransition of input.sourceBalanceTransitions) {
    const mutable = sourceTransition as unknown as Record<string, unknown>
    mutable['applicationEvidenceIds'] = applications
      .filter((application) =>
        application.sourceAccountId === sourceTransition.sourceAccountId)
      .map((application) => application.applicationEvidenceId)
    const withoutId = { ...mutable }
    Reflect.deleteProperty(withoutId, 'transitionEvidenceId')
    mutable['transitionEvidenceId'] = deriveActionStructuralId(
      'beneficiary-ira-detached-source-balance-transition',
      [withoutId],
    )
  }
  const mutableRmd = input.rmdTransition as unknown as Record<string, unknown>
  mutableRmd['applicationEvidenceIds'] = applications.map(
    (application) => application.applicationEvidenceId,
  )
  const withoutId = { ...mutableRmd }
  Reflect.deleteProperty(withoutId, 'transitionEvidenceId')
  mutableRmd['transitionEvidenceId'] = deriveActionStructuralId(
    'beneficiary-ira-detached-rmd-transition',
    [withoutId],
  )
}

function schedule(
  overrides: Partial<BeneficiaryTraditionalIraResidualRmdScheduleEvidence> = {},
  sourceInput = allocationInput(),
): BeneficiaryTraditionalIraResidualRmdScheduleEvidence {
  const allocation =
    prepareBeneficiaryTraditionalIraResidualRmdAllocation(sourceInput)
  if (allocation.status !== 'residualRmdAllocationPrepared') {
    throw new Error('test fixture failed to prepare residual allocation')
  }
  const {
    scheduleEvidenceId: suppliedScheduleEvidenceId,
    ...fieldOverrides
  } = overrides
  const evidence = {
    predicate:
      'beneficiaryTraditionalIraResidualRmdScheduleEvidence' as const,
    beneficiaryPersonId,
    decedentPersonId,
    taxYear: 2026,
    rmdPoolId: 'pool:beneficiary:decedent',
    residualAllocationEvidenceId: allocation.allocationEvidenceId,
    finalAnnualEvidenceId: sourceInput.rmdTransition.finalAnnualEvidenceId,
    coordinatorEvidenceId: sourceInput.rmdTransition.coordinatorEvidenceId,
    predecessorApplications: predecessorApplications(sourceInput),
    executionDate: '2026-10-15',
    executionSequence: 7,
    ...fieldOverrides,
  }
  return {
    ...evidence,
    scheduleEvidenceId: suppliedScheduleEvidenceId ??
      deriveActionStructuralId(
        'beneficiary-ira-residual-rmd-schedule-evidence',
        [evidence],
      ),
  }
}

describe('stageBeneficiaryTraditionalIraResidualRmdMovement', () => {
  it('requires exact schedule evidence before staging positive residual movement', () => {
    expect(stageBeneficiaryTraditionalIraResidualRmdMovement({
      allocationInput: allocationInput(),
      scheduleEvidence: null,
    })).toMatchObject({
      status: 'unsupported',
      movement: 'notCommitted',
      actionability: 'notEstablished',
      chronology: 'notEstablished',
      movementCandidates: [],
    })
  })

  it('stages residual debits at one exact pool-bound chronology slot', () => {
    const result = stageBeneficiaryTraditionalIraResidualRmdMovement({
      allocationInput: allocationInput(),
      scheduleEvidence: schedule(),
    })

    expect(result).toMatchObject({
      status: 'residualRmdMovementStaged',
      movement: 'notCommitted',
      committed: false,
      actionability: 'notEstablished',
      chronology: 'exactScheduleEvidenceBound',
      residualRmdRequiredAmount: 5_000,
      residualRmdStagedAmount: 5_000,
      residualRmdUnallocatedAmount: 0,
    })
    if (result.status !== 'residualRmdMovementStaged') return
    expect(result.movementCandidates).toEqual([
      expect.objectContaining({
        sourceAccountId: 'account:a',
        executionDate: '2026-10-15',
        executionSequence: 7,
        sourceBalanceBefore: 2_000,
        stagedDebitAmount: 1_429,
        sourceBalanceAfter: 571,
        residualRmdBefore: 5_000,
        residualRmdAfter: 3_571,
      }),
      expect.objectContaining({
        sourceAccountId: 'account:b',
        executionDate: '2026-10-15',
        executionSequence: 7,
        sourceBalanceBefore: 5_000,
        stagedDebitAmount: 3_571,
        sourceBalanceAfter: 1_429,
        residualRmdBefore: 3_571,
        residualRmdAfter: 0,
      }),
    ])
    expect(new Set(result.movementCandidates.map(
      (candidate) => candidate.movementCandidateId,
    )).size).toBe(2)
  })

  it('is invariant to the imported source array order', () => {
    const normalInput = allocationInput()
    const reversedInput = allocationInput(
      5_000,
      [...normalInput.sourceBalanceTransitions].reverse(),
    )
    const normal = stageBeneficiaryTraditionalIraResidualRmdMovement({
      allocationInput: normalInput,
      scheduleEvidence: schedule(),
    })
    const reversed = stageBeneficiaryTraditionalIraResidualRmdMovement({
      allocationInput: reversedInput,
      scheduleEvidence: schedule(),
    })

    expect(reversed).toEqual(normal)
  })

  it('needs no chronology when explicit actions leave no residual movement', () => {
    const result = stageBeneficiaryTraditionalIraResidualRmdMovement({
      allocationInput: allocationInput(0),
      scheduleEvidence: null,
    })

    expect(result).toMatchObject({
      status: 'noResidualRmdMovement',
      chronology: 'notRequiredWithoutMovement',
      residualRmdRequiredAmount: 0,
      residualRmdStagedAmount: 0,
      residualRmdUnallocatedAmount: 0,
      movementCandidates: [],
      movementBatchId: null,
    })
  })

  it('preserves an unsatisfied requirement without inventing a zero-dollar event', () => {
    const depleted = [
      source('account:b', 2_000, 2_000, 'application:b'),
      source('account:a', 1_000, 1_000, 'application:a'),
    ]
    const result = stageBeneficiaryTraditionalIraResidualRmdMovement({
      allocationInput: allocationInput(5_000, depleted),
      scheduleEvidence: null,
    })

    expect(result).toMatchObject({
      status: 'noResidualRmdMovement',
      residualRmdRequiredAmount: 5_000,
      residualRmdStagedAmount: 0,
      residualRmdUnallocatedAmount: 5_000,
      movementCandidates: [],
    })
  })

  it('rejects spurious schedule evidence when no movement can occur', () => {
    expect(stageBeneficiaryTraditionalIraResidualRmdMovement({
      allocationInput: allocationInput(0),
      scheduleEvidence: schedule(),
    })).toMatchObject({ status: 'unsupported' })
  })

  it.each([
    ['foreign pool', schedule({ rmdPoolId: 'other-pool' })],
    ['foreign beneficiary', schedule({
      beneficiaryPersonId: asPersonId('other-beneficiary'),
    })],
    ['foreign annual lineage', schedule({
      finalAnnualEvidenceId: 'other-annual',
    })],
    ['foreign residual allocation lineage', schedule({
      residualAllocationEvidenceId: 'other-allocation',
    })],
    ['incomplete predecessor chronology', schedule({
      predecessorApplications:
        predecessorApplications(allocationInput()).slice(0, 1),
    })],
    ['noncanonical predecessor chronology', schedule({
      predecessorApplications:
        predecessorApplications(allocationInput()).reverse(),
    })],
    ['forged predecessor application dates with recomputed schedule ID', schedule({
      predecessorApplications: predecessorApplications(allocationInput()).map(
        (application) => ({
          ...application,
          executionDate: '2026-01-01',
        }),
      ),
    })],
    ['outside-year date', schedule({ executionDate: '2027-01-01' })],
    ['invalid date', schedule({ executionDate: '2026-02-30' })],
    ['occupied chronology slot', schedule({
      executionDate: '2026-08-01',
      executionSequence: 1,
    })],
    ['pre-terminal chronology slot', schedule({
      executionDate: '2026-01-15',
      executionSequence: 1,
    })],
    ['invalid sequence', schedule({ executionSequence: 0 })],
    ['forged evidence ID', schedule({ scheduleEvidenceId: 'forged' })],
  ])('rejects %s schedule evidence', (_name, evidence) => {
    expect(stageBeneficiaryTraditionalIraResidualRmdMovement({
      allocationInput: allocationInput(),
      scheduleEvidence: evidence,
    })).toMatchObject({ status: 'unsupported' })
  })

  it('rejects unknown schedule treatment fields', () => {
    const hostile = {
      ...schedule(),
      taxableAmount: 5_000,
    }
    expect(stageBeneficiaryTraditionalIraResidualRmdMovement({
      allocationInput: allocationInput(),
      scheduleEvidence: hostile as unknown as
        BeneficiaryTraditionalIraResidualRmdScheduleEvidence,
    })).toMatchObject({ status: 'unsupported' })
  })

  it('rejects coherently rehashed predecessor under-credit that invents residual RMD', () => {
    const sourceInput = structuredClone(allocationInput())
    const applications = predecessorApplications(sourceInput)
    const first = applications[0] as unknown as Record<string, unknown>
    const second = applications[1] as unknown as Record<string, unknown>
    first['rmdSatisfiedByApplication'] = 1_999
    first['rmdSatisfiedAfter'] = 2_999
    first['rmdRemainingAfter'] = 7_001
    second['rmdSatisfiedBefore'] = 2_999
    second['rmdSatisfiedAfter'] = 4_999
    second['rmdRemainingAfter'] = 5_001
    for (const application of applications) rederiveApplication(application)
    const mutableRmd = sourceInput.rmdTransition as unknown as
      Record<string, unknown>
    mutableRmd['rmdSatisfiedByTransaction'] = 3_999
    mutableRmd['finalRmdSatisfiedAmount'] = 4_999
    mutableRmd['finalRmdRemainingAmount'] = 5_001
    rebindApplicationLineage(sourceInput, applications)
    const scheduleEvidence = schedule({
      predecessorApplications: applications,
    }, sourceInput)

    expect(stageBeneficiaryTraditionalIraResidualRmdMovement({
      allocationInput: sourceInput,
      scheduleEvidence,
    })).toMatchObject({ status: 'unsupported' })
  })

  it('rejects cross-role reuse inside a coherently rehashed application graph', () => {
    const sourceInput = structuredClone(allocationInput())
    const applications = predecessorApplications(sourceInput)
    const first = applications[0] as unknown as Record<string, unknown>
    first['finalMemberEvidenceId'] = first['physicalSourceEvidenceId']
    rederiveApplication(applications[0]!)
    rebindApplicationLineage(sourceInput, applications)

    expect(stageBeneficiaryTraditionalIraResidualRmdMovement({
      allocationInput: sourceInput,
      scheduleEvidence: schedule({
        predecessorApplications: applications,
      }, sourceInput),
    })).toMatchObject({ status: 'unsupported' })
  })

  it('rejects movement-candidate ID reuse across distinct predecessor applications', () => {
    const sourceInput = structuredClone(allocationInput())
    const applications = predecessorApplications(sourceInput)
    const second = applications[1] as unknown as Record<string, unknown>
    second['movementCandidateId'] = applications[0]!.movementCandidateId
    rederiveApplication(applications[1]!)
    rebindApplicationLineage(sourceInput, applications)

    expect(stageBeneficiaryTraditionalIraResidualRmdMovement({
      allocationInput: sourceInput,
      scheduleEvidence: schedule({
        predecessorApplications: applications,
      }, sourceInput),
    })).toMatchObject({ status: 'unsupported' })
  })

  it('rejects physical-source ID reuse across distinct same-source applications', () => {
    const sourceInput = structuredClone(allocationInput())
    const [originalA, applicationB] = predecessorApplications(sourceInput)
    if (originalA === undefined || applicationB === undefined) {
      throw new Error('test fixture requires two predecessor applications')
    }
    const firstA = structuredClone(originalA)
    const secondA = structuredClone(originalA)
    Object.assign(firstA, {
      actionId: 'action:account:a:first',
      allocationId: 'allocation:account:a:first',
      executionDate: '2026-02-01',
      requestedAmount: 1_000,
      executedAmount: 1_000,
      sourceBalanceBefore: 4_000,
      sourceBalanceAfter: 3_000,
      rmdSatisfiedBefore: 1_000,
      rmdSatisfiedByApplication: 1_000,
      rmdSatisfiedAfter: 2_000,
      rmdRemainingAfter: 8_000,
      movementCandidateId: 'movement:account:a:first',
      finalMemberEvidenceId: 'final-member:account:a:first',
    })
    Object.assign(secondA, {
      actionId: 'action:account:a:second',
      allocationId: 'allocation:account:a:second',
      executionDate: '2026-03-01',
      requestedAmount: 1_000,
      executedAmount: 1_000,
      sourceBalanceBefore: 3_000,
      sourceBalanceAfter: 2_000,
      rmdSatisfiedBefore: 2_000,
      rmdSatisfiedByApplication: 1_000,
      rmdSatisfiedAfter: 3_000,
      rmdRemainingAfter: 7_000,
      movementCandidateId: 'movement:account:a:second',
      finalMemberEvidenceId: 'final-member:account:a:second',
    })
    rederiveApplication(firstA)
    rederiveApplication(secondA)
    const applications = [firstA, secondA, applicationB]
    rebindApplicationLineage(sourceInput, applications)

    expect(stageBeneficiaryTraditionalIraResidualRmdMovement({
      allocationInput: sourceInput,
      scheduleEvidence: schedule({
        predecessorApplications: applications,
      }, sourceInput),
    })).toMatchObject({ status: 'unsupported' })
  })

  it('rejects depleted-source transition ID reuse in a predecessor role', () => {
    const sourceInput = structuredClone(allocationInput(5_000, [
      source('account:b', 7_000, 2_000, 'application:b'),
      source('account:a', 2_000, 2_000, 'application:a'),
    ]))
    const applications = predecessorApplications(sourceInput)
    const depletedTransition = sourceInput.sourceBalanceTransitions.find(
      (transition) => transition.sourceAccountId === 'account:a',
    )
    const otherApplication = applications.find(
      (application) => application.sourceAccountId === 'account:b',
    )
    if (depletedTransition === undefined || otherApplication === undefined) {
      throw new Error('test fixture requires depleted and remaining sources')
    }
    const mutableOther = otherApplication as unknown as Record<string, unknown>
    mutableOther['finalMemberEvidenceId'] =
      depletedTransition.transitionEvidenceId
    rederiveApplication(otherApplication)
    rebindApplicationLineage(sourceInput, applications)

    expect(stageBeneficiaryTraditionalIraResidualRmdMovement({
      allocationInput: sourceInput,
      scheduleEvidence: schedule({
        predecessorApplications: applications,
      }, sourceInput),
    })).toMatchObject({ status: 'unsupported' })
  })

  it('returns immutable detached evidence', () => {
    const result = stageBeneficiaryTraditionalIraResidualRmdMovement({
      allocationInput: allocationInput(),
      scheduleEvidence: schedule(),
    })

    expect(Object.isFrozen(result)).toBe(true)
    if (result.status !== 'residualRmdMovementStaged') return
    expect(Object.isFrozen(result.scheduleEvidence)).toBe(true)
    expect(Object.isFrozen(result.movementCandidates)).toBe(true)
    expect(Object.isFrozen(result.movementCandidates[0])).toBe(true)
  })
})
