import { describe, expect, it } from 'vitest'

import { createEmptyPlan, type Plan } from '../model/plan.js'
import type { AnnualIraBasisAllocationEntryInput } from './annualIraBasisAllocation.js'
import {
  preparePlanBeneficiaryTraditionalIraAnnualApplication,
  type BeneficiaryTraditionalIraAnnualOpeningBalanceEvidence,
  type BeneficiaryTraditionalIraPlanInheritanceBinding,
  type PreparePlanBeneficiaryTraditionalIraAnnualApplicationInput,
} from './beneficiaryTraditionalIraAnnualPlanApplication.js'
import {
  evaluateBeneficiaryTraditionalIraDeathPenalty,
  type BeneficiaryTraditionalIraDeathBeneficiaryEvidence,
} from './beneficiaryTraditionalIraDeathPenalty.js'
import {
  stageBeneficiaryTraditionalIraMovementCandidate,
  type BeneficiaryTraditionalIraPhysicalSourceSnapshotEvidence,
  type StageBeneficiaryTraditionalIraMovementCandidateInput,
} from './beneficiaryTraditionalIraMovementCandidate.js'
import type { PrepareBeneficiaryTraditionalIraAnnualPhysicalTransactionInput } from './beneficiaryTraditionalIraAnnualPhysicalTransaction.js'
import type { ClassifyBeneficiaryTraditionalIraWithdrawalInput } from './beneficiaryTraditionalIraWithdrawalCharacter.js'
import {
  asAccountId,
  asActionId,
  asAllocationId,
  asPersonId,
} from './identity.js'
import { asPositiveUsdCents, asUsdCents } from './money.js'

const beneficiary = asPersonId('beneficiary')
const decedent = asPersonId('decedent')
const foreign = asPersonId('foreign')
const sourceA = asAccountId('inherited-ira-a')
const sourceB = asAccountId('inherited-ira-b-zero')
const action = asActionId('withdrawal-a')
const allocation = asAllocationId('allocation-a')

type Mutable<T> = T extends string | number | boolean | null | undefined
  ? T
  : T extends readonly [infer Head, ...infer Tail]
    ? [Mutable<Head>, ...{ -readonly [Key in keyof Tail]: Mutable<Tail[Key]> }]
    : T extends readonly (infer Item)[]
      ? Mutable<Item>[]
      : { -readonly [Key in keyof T]: Mutable<T[Key]> }

type MutableTransactionInput = Mutable<
  PrepareBeneficiaryTraditionalIraAnnualPhysicalTransactionInput
>
interface MutableApplicationInput {
  plan: Plan
  planSnapshotEvidenceId: string
  transactionInput: MutableTransactionInput
  annualOpeningBalances:
    Mutable<BeneficiaryTraditionalIraAnnualOpeningBalanceEvidence>[]
  inheritanceBindings:
    Mutable<BeneficiaryTraditionalIraPlanInheritanceBinding>[]
}

function line7Entries(): AnnualIraBasisAllocationEntryInput[] {
  return [{
    actionId: action,
    allocationId: allocation,
    sourceAccountId: sourceA,
    scheduledDate: '2030-03-01',
    scheduledSequence: 1,
    grossAmount: asUsdCents(20),
  }]
}

function characterizationInput(): ClassifyBeneficiaryTraditionalIraWithdrawalInput {
  return {
    actionId: action,
    allocationId: allocation,
    sourceAccountId: sourceA,
    beneficiaryPersonId: beneficiary,
    decedentPersonId: decedent,
    evaluationDate: '2030-03-01',
    taxYear: 2030,
    executedAmount: asUsdCents(20),
    inheritanceEvidence: {
      predicate: 'beneficiaryTraditionalIraInheritance',
      actionId: action,
      allocationId: allocation,
      sourceAccountId: sourceA,
      beneficiaryPersonId: beneficiary,
      decedentPersonId: decedent,
      evaluationDate: '2030-03-01',
      accountType: 'traditional',
      accountKind: 'ira',
      ownershipKind: 'beneficiary',
      deathDate: '2029-12-31',
      inheritanceEvidenceId: 'inheritance-a',
    },
    basisPoolEvidence: {
      predicate:
        'completeBeneficiaryTraditionalIraBasisPoolForBeneficiaryDecedentAndTaxYear',
      beneficiaryPersonId: beneficiary,
      inheritedFromPersonId: decedent,
      poolId: 'basis-pool',
      taxYear: 2030,
      accountIds: [sourceA, sourceB],
      openingInheritedBasisAmount: asUsdCents(20),
      yearEndApplicablePoolBalanceAmount: asUsdCents(130),
      form8606Line7DistributionAmount: asUsdCents(20),
      form8606Line8NetConversionAmount: 0,
      evidenceId: 'basis-pool-record',
    },
    line7Distributions: line7Entries(),
    rmdPoolEvidence: {
      predicate:
        'completeBeneficiaryTraditionalIraRmdPoolForBeneficiaryDecedentAndTaxYear',
      actionId: action,
      allocationId: allocation,
      sourceAccountId: sourceA,
      evaluationDate: '2030-03-01',
      beneficiaryPersonId: beneficiary,
      inheritedFromPersonId: decedent,
      poolId: 'rmd-pool',
      taxYear: 2030,
      accountIds: [sourceA, sourceB],
      requiredAmount: asUsdCents(40),
      satisfiedBeforeExecution: asUsdCents(0),
      remainingBeforeExecution: asUsdCents(40),
      evidenceId: 'rmd-a',
    },
  }
}

function primitiveMember(): StageBeneficiaryTraditionalIraMovementCandidateInput {
  const penaltyInput = {
    characterizationInput: characterizationInput(),
    deathBeneficiaryEvidence: {
      predicate: 'beneficiaryTraditionalIraDeathBeneficiary',
      actionId: action,
      allocationId: allocation,
      sourceAccountId: sourceA,
      beneficiaryPersonId: beneficiary,
      decedentPersonId: decedent,
      evaluationDate: '2030-03-01',
      deathDate: '2029-12-31',
      inheritanceEvidenceId: 'inheritance-a',
    } satisfies BeneficiaryTraditionalIraDeathBeneficiaryEvidence,
  }
  const penalty = evaluateBeneficiaryTraditionalIraDeathPenalty(penaltyInput)
  if (penalty.status !== 'accepted') throw new Error('Invalid penalty fixture')
  const accepted = penalty.characterization.acceptedSourceEligibility
  const sourceSnapshot: BeneficiaryTraditionalIraPhysicalSourceSnapshotEvidence = {
    predicate: 'beneficiaryTraditionalIraPhysicalSourceBeforeWithdrawal',
    actionId: action,
    allocationId: allocation,
    sourceAccountId: sourceA,
    beneficiaryPersonId: beneficiary,
    decedentPersonId: decedent,
    evaluationDate: '2030-03-01',
    executionSequence: 1,
    requestedAmount: asPositiveUsdCents(20),
    executedAmount: asPositiveUsdCents(20),
    openingBalanceAmount: asUsdCents(100),
    closingBalanceAmount: asUsdCents(80),
    inheritanceEvidenceId: 'inheritance-a',
    basisEvidenceId: accepted.basisEvidence.evidenceId,
    sourceCharacterEvidenceId: penalty.penaltyEvidence.sourceCharacterEvidenceId,
    penaltyEvidenceId: penalty.penaltyEvidence.penaltyEvidenceId,
    rmdPoolId: 'rmd-pool',
    rmdEvidenceId: 'rmd-a',
    rmdRequiredAmount: asUsdCents(40),
    rmdSatisfiedBeforeExecution: asUsdCents(0),
    rmdRemainingBeforeExecution: asUsdCents(40),
    physicalSourceEvidenceId: 'physical-source-a',
  }
  return { penaltyInput, sourceSnapshots: [sourceSnapshot] }
}

function transactionInput(): MutableTransactionInput {
  const member = primitiveMember()
  const staged = stageBeneficiaryTraditionalIraMovementCandidate(member)
  if (staged.status !== 'movementCandidateStaged') {
    throw new Error('Invalid movement fixture')
  }
  const accepted = staged.characterization.acceptedSourceEligibility
  return {
    runtimeInput: {
      attestation: {
        predicate: 'completeBeneficiaryTraditionalIraAnnualRuntimeInventory',
        inventoryStatus: 'completeIncludingExplicitEmpty',
        inventoryEvidenceId: 'runtime-inventory',
        upstreamInventoryEvidenceId: 'runtime-upstream',
        beneficiaryPersonId: beneficiary,
        decedentPersonId: decedent,
        taxYear: 2030,
        basisPoolId: 'basis-pool',
        basisPoolEvidenceId: 'basis-pool-record',
        annualAllocationEvidenceId:
          accepted.basisEvidence.annualDistributionBasisAllocation.allocationEvidenceId,
        rmdPoolId: 'rmd-pool',
        rmdRequiredAmount: asUsdCents(40),
        sourceAccountIds: [sourceA, sourceB],
        sourceBalances: [
          {
            sourceAccountId: sourceA,
            annualOpeningBalanceAmount: asUsdCents(100),
            annualFinalBalanceAmount: asUsdCents(80),
          },
          {
            sourceAccountId: sourceB,
            annualOpeningBalanceAmount: asUsdCents(50),
            annualFinalBalanceAmount: asUsdCents(50),
          },
        ],
        members: [{
          actionId: action,
          allocationId: allocation,
          sourceAccountId: sourceA,
          executionDate: '2030-03-01',
          executionSequence: 1,
          requestedAmount: asPositiveUsdCents(20),
          executedAmount: asPositiveUsdCents(20),
          openingBalanceAmount: asUsdCents(100),
          closingBalanceAmount: asUsdCents(80),
          physicalSourceEvidenceId: 'physical-source-a',
        }],
      },
      members: [member] as MutableTransactionInput['runtimeInput']['members'],
    },
  }
}

function validPlan(): Plan {
  const plan = createEmptyPlan()
  plan.id = 'plan-beneficiary'
  const person = plan.household.people[0]!
  person.id = beneficiary
  person.name = 'Beneficiary'
  plan.household.people.push({ ...person, id: decedent, name: 'Decedent' })
  plan.accounts = [
    {
      id: sourceA,
      name: 'Inherited IRA A',
      ownerPersonId: beneficiary,
      annualReturnPct: null,
      type: 'traditional',
      kind: 'ira',
      balance: 100,
      annualContribution: 0,
      inherited: { ownerDeathYear: 2029, decedentHadStartedRmds: true },
    },
    {
      id: sourceB,
      name: 'Inherited IRA B',
      ownerPersonId: beneficiary,
      annualReturnPct: null,
      type: 'traditional',
      kind: 'ira',
      balance: 50,
      annualContribution: 0,
      inherited: { ownerDeathYear: 2029, decedentHadStartedRmds: true },
    },
  ]
  return plan
}

function validInput(): MutableApplicationInput {
  return {
    plan: validPlan(),
    planSnapshotEvidenceId: 'plan-snapshot',
    transactionInput: transactionInput(),
    annualOpeningBalances: [
      { sourceAccountId: sourceA, annualOpeningBalanceAmount: asUsdCents(100) },
      { sourceAccountId: sourceB, annualOpeningBalanceAmount: asUsdCents(50) },
    ],
    inheritanceBindings: [
      {
        sourceAccountId: sourceA,
        beneficiaryPersonId: beneficiary,
        decedentPersonId: decedent,
        deathDate: '2029-12-31',
        inheritanceEvidenceId: 'inheritance-a',
      },
      {
        sourceAccountId: sourceB,
        beneficiaryPersonId: beneficiary,
        decedentPersonId: decedent,
        deathDate: '2029-12-31',
        inheritanceEvidenceId: 'inheritance-b',
      },
    ],
  }
}

function prepare(input: unknown) {
  return preparePlanBeneficiaryTraditionalIraAnnualApplication(
    input as PreparePlanBeneficiaryTraditionalIraAnnualApplicationInput,
  )
}

function expectUnsupported(input: unknown): void {
  expect(prepare(input)).toEqual(expect.objectContaining({
    status: 'unsupported',
    movement: 'notCommitted',
    committed: false,
    actionability: 'notEstablished',
    transactionStatus: 'notEstablished',
    transaction: null,
    planBinding: null,
  }))
}

describe('preparePlanBeneficiaryTraditionalIraAnnualApplication', () => {
  it('binds the complete detached transaction source set to the Plan', () => {
    const result = prepare(validInput())
    expect(result).toMatchObject({
      status: 'planAnnualApplicationPrepared',
      movement: 'notCommitted',
      committed: false,
      actionability: 'notEstablished',
      transactionStatus: 'appliedToDetachedSnapshotOnly',
      planBinding: {
        predicate:
          'planBeneficiaryTraditionalIraSourcesBoundToDetachedTransaction',
        planId: 'plan-beneficiary',
        planSnapshotEvidenceId: 'plan-snapshot',
        beneficiaryPersonId: beneficiary,
        decedentPersonId: decedent,
        taxYear: 2030,
        sourceAccountIds: [sourceA, sourceB],
      },
    })
    if (result.status !== 'planAnnualApplicationPrepared') return
    expect(result.transaction.sourceBalanceTransitions).toHaveLength(2)
    expect(result.planBinding.sourceBindings.map((entry) => [
      entry.sourceAccountId,
      entry.annualOpeningBalanceAmount,
      entry.inheritanceEvidenceId,
    ])).toEqual([
      [sourceA, 100, 'inheritance-a'],
      [sourceB, 50, 'inheritance-b'],
    ])
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.planBinding.sourceBindings[0])).toBe(true)
  })

  it('is canonical across balance, inheritance, and Plan account order', () => {
    const original = validInput()
    const permuted = validInput()
    permuted.plan.accounts.reverse()
    permuted.annualOpeningBalances.reverse()
    permuted.inheritanceBindings.reverse()
    expect(prepare(permuted)).toEqual(prepare(original))
  })

  it('calls the physical transaction preparer instead of trusting altered facts', () => {
    const input = validInput()
    input.transactionInput.runtimeInput.members[0]!.sourceSnapshots![0]!
      .closingBalanceAmount = asUsdCents(79)
    expectUnsupported(input)
    expectUnsupported({ ...validInput(), transaction: prepare(validInput()) })
  })

  it('requires an exact annual opening-balance bijection and exact amounts', () => {
    const missing = validInput()
    missing.annualOpeningBalances.pop()
    expectUnsupported(missing)
    const duplicate = validInput()
    duplicate.annualOpeningBalances[1]!.sourceAccountId = sourceA
    expectUnsupported(duplicate)
    const extra = validInput()
    extra.annualOpeningBalances.push({
      sourceAccountId: asAccountId('extra'),
      annualOpeningBalanceAmount: asUsdCents(1),
    })
    expectUnsupported(extra)
    const mismatch = validInput()
    mismatch.annualOpeningBalances[0]!.annualOpeningBalanceAmount = asUsdCents(99)
    expectUnsupported(mismatch)
  })

  it('requires one explicit inheritance binding for every source', () => {
    const missing = validInput()
    missing.inheritanceBindings.pop()
    expectUnsupported(missing)
    const duplicate = validInput()
    duplicate.inheritanceBindings[1]!.sourceAccountId = sourceA
    expectUnsupported(duplicate)
    const wrongBeneficiary = validInput()
    wrongBeneficiary.inheritanceBindings[0]!.beneficiaryPersonId = foreign
    expectUnsupported(wrongBeneficiary)
    const wrongDecedent = validInput()
    wrongDecedent.inheritanceBindings[0]!.decedentPersonId = foreign
    expectUnsupported(wrongDecedent)
  })

  it('binds eventful sources to their upstream inheritance evidence', () => {
    const input = validInput()
    input.inheritanceBindings[0]!.inheritanceEvidenceId = 'different-inheritance'
    expectUnsupported(input)
  })

  it('requires an eventful binding death date to exact-match rebuilt evidence', () => {
    const input = validInput()
    input.inheritanceBindings[0]!.deathDate = '2029-01-01'
    expectUnsupported(input)
  })

  it('requires one exact death date across eventful and zero-event sources', () => {
    const input = validInput()
    input.inheritanceBindings[1]!.deathDate = '2029-01-01'
    expectUnsupported(input)
  })

  it('rejects owned, employer, foreign-owner, missing, and wrong-type sources', () => {
    const owned = validInput()
    if (owned.plan.accounts[0]!.type === 'traditional') {
      delete owned.plan.accounts[0]!.inherited
    }
    expectUnsupported(owned)
    const employer = validInput()
    if (employer.plan.accounts[0]!.type === 'traditional') {
      employer.plan.accounts[0]!.kind = 'employer'
    }
    expectUnsupported(employer)
    const foreignOwner = validInput()
    foreignOwner.plan.household.people.push({
      ...foreignOwner.plan.household.people[0]!, id: foreign, name: 'Foreign',
    })
    foreignOwner.plan.accounts[0]!.ownerPersonId = foreign
    expectUnsupported(foreignOwner)
    const missing = validInput()
    missing.plan.accounts.pop()
    expectUnsupported(missing)
    const roth = validInput()
    roth.plan.accounts[0] = {
      ...roth.plan.accounts[0]!,
      type: 'roth',
      kind: 'ira',
      balance: 100,
      annualContribution: 0,
    }
    expectUnsupported(roth)
  })

  it('requires canonical death dates matching Plan owner-death years', () => {
    const invalid = validInput()
    invalid.inheritanceBindings[0]!.deathDate = '2029-02-29'
    expectUnsupported(invalid)
    const mismatch = validInput()
    mismatch.inheritanceBindings[0]!.deathDate = '2028-12-31'
    expectUnsupported(mismatch)
    const future = validInput()
    future.inheritanceBindings[0]!.deathDate = '2031-01-01'
    if (future.plan.accounts[0]!.type === 'traditional' &&
        future.plan.accounts[0]!.inherited !== undefined) {
      future.plan.accounts[0]!.inherited.ownerDeathYear = 2031
    }
    expectUnsupported(future)
  })

  it('requires beneficiary and decedent identities to resolve uniquely in Plan', () => {
    const missingDecedent = validInput()
    missingDecedent.plan.household.people.pop()
    expectUnsupported(missingDecedent)
    const missingBeneficiary = validInput()
    missingBeneficiary.plan.household.people[0]!.id = foreign
    expectUnsupported(missingBeneficiary)
  })

  it('rejects evidence identifier collisions', () => {
    const duplicateInheritance = validInput()
    duplicateInheritance.inheritanceBindings[1]!.inheritanceEvidenceId =
      'inheritance-a'
    expectUnsupported(duplicateInheritance)
    const transactionCollision = validInput()
    transactionCollision.planSnapshotEvidenceId = 'runtime-inventory'
    expectUnsupported(transactionCollision)
    const zeroSourceCollision = validInput()
    zeroSourceCollision.inheritanceBindings[1]!.inheritanceEvidenceId =
      'runtime-inventory'
    expectUnsupported(zeroSourceCollision)
    const planCollision = validInput()
    planCollision.planSnapshotEvidenceId = planCollision.plan.id
    expectUnsupported(planCollision)
    const planTransactionCollision = validInput()
    planTransactionCollision.plan.id = 'runtime-inventory'
    expectUnsupported(planTransactionCollision)
  })

  it('detaches caller-owned inputs before returning immutable evidence', () => {
    const input = validInput()
    const result = prepare(input)
    input.inheritanceBindings[0]!.deathDate = '2028-01-01'
    input.plan.accounts[0]!.name = 'Changed'
    if (result.status !== 'planAnnualApplicationPrepared') return
    expect(result.planBinding.sourceBindings[0]!.deathDate).toBe('2029-12-31')
    expect(() => {
      ;(result.planBinding.sourceBindings as unknown[]).push('mutation')
    }).toThrow()
  })

  it('fails closed for extra keys, accessors, symbols, cycles, and exotic data', () => {
    expectUnsupported({ ...validInput(), extra: true })
    const getter = validInput()
    Object.defineProperty(getter, 'planSnapshotEvidenceId', {
      enumerable: true,
      get: () => 'plan-snapshot',
    })
    expectUnsupported(getter)
    const symbol = validInput()
    Object.defineProperty(symbol, Symbol('hidden'), { value: true })
    expectUnsupported(symbol)
    const cycle = validInput() as MutableApplicationInput & { self?: unknown }
    cycle.self = cycle
    expectUnsupported(cycle)
    expectUnsupported(new Map([['plan', validPlan()]]))
  })

  it('never throws for revoked proxies, sparse arrays, or decorated arrays', () => {
    const revoked = Proxy.revocable(validInput(), {})
    revoked.revoke()
    expect(() => expectUnsupported(revoked.proxy)).not.toThrow()
    const sparse = validInput()
    delete sparse.inheritanceBindings[1]
    expect(() => expectUnsupported(sparse)).not.toThrow()
    const decorated = validInput()
    Object.defineProperty(decorated.annualOpeningBalances, 'extra', {
      enumerable: true,
      value: 'extra',
    })
    expect(() => expectUnsupported(decorated)).not.toThrow()
  })
})
