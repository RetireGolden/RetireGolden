import { describe, expect, it } from 'vitest'
import type { AnnualIraBasisAllocationEntryInput } from './annualIraBasisAllocation.js'
import {
  prepareBeneficiaryTraditionalIraAnnualPhysicalTransaction,
} from './beneficiaryTraditionalIraAnnualPhysicalTransaction.js'
import type { CoordinateBeneficiaryTraditionalIraAnnualRuntimeInput } from
  './beneficiaryTraditionalIraAnnualRuntimeCoordinator.js'
import {
  evaluateBeneficiaryTraditionalIraDeathPenalty,
  type BeneficiaryTraditionalIraDeathBeneficiaryEvidence,
} from './beneficiaryTraditionalIraDeathPenalty.js'
import {
  stageBeneficiaryTraditionalIraMovementCandidate,
  type BeneficiaryTraditionalIraPhysicalSourceSnapshotEvidence,
  type StageBeneficiaryTraditionalIraMovementCandidateInput,
} from './beneficiaryTraditionalIraMovementCandidate.js'
import {
  prepareBeneficiaryTraditionalIraResidualRmdAllocation,
} from './beneficiaryTraditionalIraResidualRmdAllocation.js'
import {
  prepareBeneficiaryTraditionalIraResidualRmdAnnualRefinalization,
  type PrepareBeneficiaryTraditionalIraResidualRmdAnnualRefinalizationInput,
} from './beneficiaryTraditionalIraResidualRmdAnnualRefinalization.js'
import type { BeneficiaryTraditionalIraResidualRmdScheduleEvidence } from
  './beneficiaryTraditionalIraResidualRmdMovementCandidate.js'
import type { ClassifyBeneficiaryTraditionalIraWithdrawalInput } from
  './beneficiaryTraditionalIraWithdrawalCharacter.js'
import {
  asAccountId, asActionId, asAllocationId, asPersonId,
} from './identity.js'
import { asPositiveUsdCents, asUsdCents } from './money.js'
import { deriveActionStructuralId } from './structuralId.js'
import { singlePersonPlan } from '../testing/planFixtures.js'

const beneficiary = asPersonId('beneficiary')
const decedent = asPersonId('decedent')
const sourceA = asAccountId('inherited-a')
const sourceB = asAccountId('inherited-b')
const action = asActionId('old-action')
const allocation = asAllocationId('old-allocation')
const oldLine7: AnnualIraBasisAllocationEntryInput = {
  actionId: action, allocationId: allocation, sourceAccountId: sourceA,
  scheduledDate: '2030-03-01', scheduledSequence: 1,
  grossAmount: asUsdCents(2_000),
}

type Mutable<T> = T extends string | number | boolean | null | undefined
  ? T
  : T extends readonly [infer Head, ...infer Tail]
    ? [Mutable<Head>, ...{ -readonly [Key in keyof Tail]: Mutable<Tail[Key]> }]
    : T extends readonly (infer Item)[]
      ? Mutable<Item>[]
      : { -readonly [Key in keyof T]: Mutable<T[Key]> }

function basisPool(line6 = 6_000, line7 = 2_000, id = 'old-basis-pool') {
  return {
    predicate:
      'completeBeneficiaryTraditionalIraBasisPoolForBeneficiaryDecedentAndTaxYear' as const,
    beneficiaryPersonId: beneficiary, inheritedFromPersonId: decedent,
    poolId: 'basis-pool', taxYear: 2030,
    accountIds: [sourceA, sourceB] as [typeof sourceA, typeof sourceB],
    openingInheritedBasisAmount: asUsdCents(4_000),
    yearEndApplicablePoolBalanceAmount: asUsdCents(line6),
    form8606Line7DistributionAmount: asUsdCents(line7),
    form8606Line8NetConversionAmount: 0 as const, evidenceId: id,
  }
}

function characterInput(): ClassifyBeneficiaryTraditionalIraWithdrawalInput {
  return {
    actionId: action, allocationId: allocation, sourceAccountId: sourceA,
    beneficiaryPersonId: beneficiary, decedentPersonId: decedent,
    evaluationDate: '2030-03-01', taxYear: 2030,
    executedAmount: asUsdCents(2_000),
    inheritanceEvidence: {
      predicate: 'beneficiaryTraditionalIraInheritance',
      actionId: action, allocationId: allocation, sourceAccountId: sourceA,
      beneficiaryPersonId: beneficiary, decedentPersonId: decedent,
      evaluationDate: '2030-03-01', accountType: 'traditional',
      accountKind: 'ira', ownershipKind: 'beneficiary',
      deathDate: '2029-12-31', inheritanceEvidenceId: 'old-inheritance',
    },
    basisPoolEvidence: basisPool(), line7Distributions: [oldLine7],
    rmdPoolEvidence: {
      predicate:
        'completeBeneficiaryTraditionalIraRmdPoolForBeneficiaryDecedentAndTaxYear',
      actionId: action, allocationId: allocation, sourceAccountId: sourceA,
      evaluationDate: '2030-03-01', beneficiaryPersonId: beneficiary,
      inheritedFromPersonId: decedent, poolId: 'rmd-pool', taxYear: 2030,
      accountIds: [sourceA, sourceB], requiredAmount: asUsdCents(10_000),
      satisfiedBeforeExecution: asUsdCents(0),
      remainingBeforeExecution: asUsdCents(10_000), evidenceId: 'old-rmd',
    },
  }
}

function oldMember(): StageBeneficiaryTraditionalIraMovementCandidateInput {
  const characterizationInput = characterInput()
  const deathBeneficiaryEvidence: BeneficiaryTraditionalIraDeathBeneficiaryEvidence = {
    predicate: 'beneficiaryTraditionalIraDeathBeneficiary',
    actionId: action, allocationId: allocation, sourceAccountId: sourceA,
    beneficiaryPersonId: beneficiary, decedentPersonId: decedent,
    evaluationDate: '2030-03-01', deathDate: '2029-12-31',
    inheritanceEvidenceId: 'old-inheritance',
  }
  const penaltyInput = {
    characterizationInput,
    deathBeneficiaryEvidence,
    spousalElection: {
      status: 'spousalElectionNotApplicable',
      relationship: 'notSurvivingSpouse',
      evidenceId: 'spousal-election-not-applicable',
    },
  } as const
  const penalty = evaluateBeneficiaryTraditionalIraDeathPenalty(penaltyInput)
  if (penalty.status !== 'accepted') throw new Error('fixture penalty')
  const accepted = penalty.characterization.acceptedSourceEligibility
  const source: BeneficiaryTraditionalIraPhysicalSourceSnapshotEvidence = {
    predicate: 'beneficiaryTraditionalIraPhysicalSourceBeforeWithdrawal',
    actionId: action, allocationId: allocation, sourceAccountId: sourceA,
    beneficiaryPersonId: beneficiary, decedentPersonId: decedent,
    evaluationDate: '2030-03-01', executionSequence: 1,
    requestedAmount: asPositiveUsdCents(2_000),
    executedAmount: asPositiveUsdCents(2_000),
    openingBalanceAmount: asUsdCents(3_000),
    closingBalanceAmount: asUsdCents(1_000),
    inheritanceEvidenceId: 'old-inheritance',
    basisEvidenceId: accepted.basisEvidence.evidenceId,
    sourceCharacterEvidenceId: penalty.penaltyEvidence.sourceCharacterEvidenceId,
    penaltyEvidenceId: penalty.penaltyEvidence.penaltyEvidenceId,
    rmdPoolId: 'rmd-pool', rmdEvidenceId: 'old-rmd',
    rmdRequiredAmount: asUsdCents(10_000),
    rmdSatisfiedBeforeExecution: asUsdCents(0),
    rmdRemainingBeforeExecution: asUsdCents(10_000),
    physicalSourceEvidenceId: 'old-physical-source',
  }
  return { penaltyInput, sourceSnapshots: [source] }
}

function runtimeInput(): CoordinateBeneficiaryTraditionalIraAnnualRuntimeInput {
  const member = oldMember()
  const staged = stageBeneficiaryTraditionalIraMovementCandidate(member)
  if (staged.status !== 'movementCandidateStaged') throw new Error('fixture stage')
  const basis = staged.characterization.acceptedSourceEligibility.basisEvidence
  return {
    attestation: {
      predicate: 'completeBeneficiaryTraditionalIraAnnualRuntimeInventory',
      inventoryStatus: 'completeIncludingExplicitEmpty',
      inventoryEvidenceId: 'old-runtime-inventory',
      upstreamInventoryEvidenceId: 'old-runtime-upstream',
      beneficiaryPersonId: beneficiary, decedentPersonId: decedent,
      taxYear: 2030, basisPoolId: 'basis-pool',
      basisPoolEvidenceId: 'old-basis-pool',
      annualAllocationEvidenceId:
        basis.annualDistributionBasisAllocation.allocationEvidenceId,
      rmdPoolId: 'rmd-pool', rmdRequiredAmount: asUsdCents(10_000),
      sourceAccountIds: [sourceA, sourceB],
      sourceBalances: [
        { sourceAccountId: sourceA, annualOpeningBalanceAmount: asUsdCents(3_000),
          annualFinalBalanceAmount: asUsdCents(1_000) },
        { sourceAccountId: sourceB, annualOpeningBalanceAmount: asUsdCents(5_000),
          annualFinalBalanceAmount: asUsdCents(5_000) },
      ],
      members: [{
        actionId: action, allocationId: allocation, sourceAccountId: sourceA,
        executionDate: '2030-03-01', executionSequence: 1,
        requestedAmount: asPositiveUsdCents(2_000),
        executedAmount: asPositiveUsdCents(2_000),
        openingBalanceAmount: asUsdCents(3_000),
        closingBalanceAmount: asUsdCents(1_000),
        physicalSourceEvidenceId: 'old-physical-source',
      }],
    },
    members: [member],
  }
}

function input(): Mutable<
  PrepareBeneficiaryTraditionalIraResidualRmdAnnualRefinalizationInput
> {
  const predecessorRuntimeInput = runtimeInput()
  const predecessor = prepareBeneficiaryTraditionalIraAnnualPhysicalTransaction({
    runtimeInput: predecessorRuntimeInput,
  })
  if (predecessor.status !== 'annualPhysicalTransactionPrepared') {
    throw new Error('fixture physical')
  }
  const allocationInput = {
    rmdTransition: predecessor.rmdTransition,
    sourceBalanceTransitions: predecessor.sourceBalanceTransitions,
  }
  const residual = prepareBeneficiaryTraditionalIraResidualRmdAllocation(allocationInput)
  if (residual.status !== 'residualRmdAllocationPrepared') throw new Error('fixture residual')
  const scheduleWithoutId = {
    predicate: 'beneficiaryTraditionalIraResidualRmdScheduleEvidence' as const,
    beneficiaryPersonId: beneficiary, decedentPersonId: decedent,
    taxYear: 2030, rmdPoolId: 'rmd-pool',
    residualAllocationEvidenceId: residual.allocationEvidenceId,
    finalAnnualEvidenceId: predecessor.rmdTransition.finalAnnualEvidenceId,
    coordinatorEvidenceId: predecessor.rmdTransition.coordinatorEvidenceId,
    predecessorApplications: predecessor.applications,
    executionDate: '2030-12-15', executionSequence: 9,
  }
  const scheduleEvidence: BeneficiaryTraditionalIraResidualRmdScheduleEvidence = {
    ...scheduleWithoutId,
    scheduleEvidenceId: deriveActionStructuralId(
      'beneficiary-ira-residual-rmd-schedule-evidence', [scheduleWithoutId],
    ),
  }
  const plan = singlePersonPlan()
  plan.id = 'plan'
  plan.household.people[0]!.id = beneficiary
  plan.accounts = [sourceA, sourceB].map((id) => ({
    type: 'traditional' as const, id, name: id,
    ownerPersonId: beneficiary, annualReturnPct: 0, kind: 'ira' as const,
    balance: 5_000, annualContribution: 0,
    inherited: { ownerDeathYear: 2029, decedentHadStartedRmds: true },
  }))
  return {
    identityInput: {
      plan, planSnapshotEvidenceId: 'plan-snapshot',
      physicalTransactionInput: {
        movementInput: { allocationInput, scheduleEvidence },
      },
    },
    predecessorRuntimeInput,
    postResidualBasisPoolEvidence: basisPool(0, 8_000, 'post-basis-pool'),
    residualInheritanceBindings: [sourceA, sourceB].map((sourceAccountId) => ({
      sourceAccountId, beneficiaryPersonId: beneficiary,
      decedentPersonId: decedent, deathDate: '2029-12-31',
      inheritanceEvidenceId: `residual-inheritance-${sourceAccountId}`,
    })),
    spousalElection: {
      status: 'spousalElectionNotApplicable',
      relationship: 'notSurvivingSpouse',
      evidenceId: 'spousal-election-not-applicable',
    },
  } as unknown as Mutable<
    PrepareBeneficiaryTraditionalIraResidualRmdAnnualRefinalizationInput
  >
}

function prepare(value = input()) {
  return prepareBeneficiaryTraditionalIraResidualRmdAnnualRefinalization(value)
}

describe('prepareBeneficiaryTraditionalIraResidualRmdAnnualRefinalization', () => {
  it('refinalizes all old and residual members with one complete annual allocation', () => {
    const result = prepare()
    expect(result).toMatchObject({
      status: 'residualRmdAnnualEvidenceRefinalized', movement: 'notCommitted',
      committed: false, actionability: 'notEstablished',
      finalRmdRemainingAmount: 2_000,
      annualEvidence: {
        initialRmdSatisfiedAmount: 0, finalRmdSatisfiedAmount: 8_000,
        finalRmdRemainingAmount: 2_000,
      },
    })
    if (result.status !== 'residualRmdAnnualEvidenceRefinalized') return
    expect(result.annualEvidence.canonicalMembers).toHaveLength(3)
    const allocations = result.annualEvidence.canonicalMembers[0]!
      .characterization.acceptedSourceEligibility.basisEvidence
      .annualDistributionBasisAllocation
    expect(allocations).toMatchObject({
      annualGrossAmount: 8_000, annualNontaxableBasisAmount: 4_000,
      annualTaxableAmount: 4_000,
      annualBasisRatio: { numeratorMinorUnits: 4_000, denominatorMinorUnits: 8_000 },
    })
    expect(result.residualLineage.map((lineage) => lineage.sourceAccountId))
      .toEqual([sourceA, sourceB])
    for (const lineage of result.residualLineage) {
      expect(lineage.characterEvidenceIds.length).toBeGreaterThan(0)
      expect(result.annualEvidence.finalMemberEvidenceIds)
        .toContain(lineage.finalMemberEvidenceId)
    }
  })

  it('is order invariant, deterministic, nonmutating, and deeply frozen', () => {
    const value = input()
    const before = structuredClone(value)
    const first = prepare(value)
    const repeated = prepare()
    const reordered = input()
    reordered.residualInheritanceBindings = [
      ...reordered.residualInheritanceBindings,
    ].reverse()
    reordered.predecessorRuntimeInput.attestation.sourceBalances = [
      ...reordered.predecessorRuntimeInput.attestation.sourceBalances,
    ].reverse()
    const movement = reordered.identityInput.physicalTransactionInput.movementInput
    movement.allocationInput.sourceBalanceTransitions = [
      ...movement.allocationInput.sourceBalanceTransitions,
    ].reverse()
    movement.scheduleEvidence!.predecessorApplications = [
      ...movement.scheduleEvidence!.predecessorApplications,
    ].reverse()
    reordered.postResidualBasisPoolEvidence.accountIds = [
      ...reordered.postResidualBasisPoolEvidence.accountIds,
    ].reverse() as [typeof sourceA, typeof sourceB]
    expect(prepare(reordered)).toEqual(first)
    expect(repeated).toEqual(first)
    expect(value).toEqual(before)
    expect(Object.isFrozen(first)).toBe(true)
    if (first.status !== 'residualRmdAnnualEvidenceRefinalized') return
    expect(Object.isFrozen(first.residualLineage)).toBe(true)
    expect(Object.isFrozen(first.annualEvidence.canonicalMembers[0])).toBe(true)
  })

  it('rejects stale predecessor joins, annual arithmetic drift, and collisions', () => {
    const stale = input()
    stale.predecessorRuntimeInput.attestation.inventoryEvidenceId = 'changed'
    expect(prepare(stale).status).toBe('unsupported')

    for (const mutate of [
      (value: ReturnType<typeof input>) => {
        value.postResidualBasisPoolEvidence.form8606Line7DistributionAmount =
          asUsdCents(7_999)
      },
      (value: ReturnType<typeof input>) => {
        value.postResidualBasisPoolEvidence.yearEndApplicablePoolBalanceAmount =
          asUsdCents(1)
      },
      (value: ReturnType<typeof input>) => {
        value.postResidualBasisPoolEvidence.accountIds = [sourceA]
      },
      (value: ReturnType<typeof input>) => {
        value.residualInheritanceBindings[0]!.beneficiaryPersonId = asPersonId('other')
      },
    ]) {
      const value = input()
      mutate(value)
      expect(prepare(value).status).toBe('unsupported')
    }

    const baseline = prepare()
    if (baseline.status !== 'residualRmdAnnualEvidenceRefinalized') return
    const collision = input()
    collision.postResidualBasisPoolEvidence.evidenceId =
      baseline.identityEvidence.request.actionId
    expect(prepare(collision).status).toBe('unsupported')
  })

  it('rejects hostile, unsafe, stale-lineage, and accessor inputs', () => {
    const unsafe = input()
    unsafe.postResidualBasisPoolEvidence.form8606Line7DistributionAmount =
      Number.MAX_SAFE_INTEGER + 1 as never
    expect(prepare(unsafe).status).toBe('unsupported')

    const stale = input()
    stale.residualInheritanceBindings[0]!.inheritanceEvidenceId = 'old-inheritance'
    expect(prepare(stale).status).toBe('unsupported')

    const hostile = input() as unknown as Record<string, unknown>
    hostile['extra'] = true
    expect(prepare(hostile as unknown as ReturnType<typeof input>).status)
      .toBe('unsupported')

    const accessor = input()
    let invoked = false
    Object.defineProperty(accessor, 'postResidualBasisPoolEvidence', {
      enumerable: true,
      get() { invoked = true; return basisPool(0, 8_000, 'getter') },
    })
    expect(prepare(accessor).status).toBe('unsupported')
    expect(invoked).toBe(false)
  })
})
