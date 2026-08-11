import { describe, expect, it } from 'vitest'

import type { AnnualIraBasisAllocationEntryInput } from
  '../actions/annualIraBasisAllocation.js'
import {
  evaluateBeneficiaryTraditionalIraDeathPenalty,
  type BeneficiaryTraditionalIraDeathBeneficiaryEvidence,
} from '../actions/beneficiaryTraditionalIraDeathPenalty.js'
import {
  stageBeneficiaryTraditionalIraMovementCandidate,
  type BeneficiaryTraditionalIraPhysicalSourceSnapshotEvidence,
  type StageBeneficiaryTraditionalIraMovementCandidateInput,
} from '../actions/beneficiaryTraditionalIraMovementCandidate.js'
import type { PrepareBeneficiaryTraditionalIraAnnualPhysicalTransactionInput } from
  '../actions/beneficiaryTraditionalIraAnnualPhysicalTransaction.js'
import type { ClassifyBeneficiaryTraditionalIraWithdrawalInput } from
  '../actions/beneficiaryTraditionalIraWithdrawalCharacter.js'
import {
  asAccountId,
  asActionId,
  asAllocationId,
  asPersonId,
} from '../actions/identity.js'
import { asPositiveUsdCents, asUsdCents } from '../actions/money.js'
import { createEmptyPlan, type Plan } from '../model/plan.js'
import type {
  SimulatorAnnualPassStateBindings,
  SimulatorAnnualPassValueBinding,
} from './annualPassTransaction.js'
import {
  applyBeneficiaryTraditionalIraAnnualPass,
  type ApplyBeneficiaryTraditionalIraAnnualPassInput,
  type BeneficiaryTraditionalIraAnnualPassEvidenceFacts,
} from './beneficiaryTraditionalIraAnnualPassConsumer.js'
import type { YearExpenses } from './types.js'

const beneficiary = asPersonId('beneficiary')
const decedent = asPersonId('decedent')
const sourceA = asAccountId('inherited-ira-a')
const sourceB = asAccountId('inherited-ira-b-zero')
const nonsource = asAccountId('taxable-nonsource')
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

function line7Entries(): AnnualIraBasisAllocationEntryInput[] {
  return [{
    actionId: action, allocationId: allocation, sourceAccountId: sourceA,
    scheduledDate: '2030-03-01', scheduledSequence: 1,
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
      predicate: 'beneficiaryTraditionalIraInheritance', actionId: action,
      allocationId: allocation, sourceAccountId: sourceA,
      beneficiaryPersonId: beneficiary, decedentPersonId: decedent,
      evaluationDate: '2030-03-01', accountType: 'traditional',
      accountKind: 'ira', ownershipKind: 'beneficiary', deathDate: '2029-12-31',
      inheritanceEvidenceId: 'inheritance-a',
    },
    basisPoolEvidence: {
      predicate:
        'completeBeneficiaryTraditionalIraBasisPoolForBeneficiaryDecedentAndTaxYear',
      beneficiaryPersonId: beneficiary, inheritedFromPersonId: decedent,
      poolId: 'basis-pool', taxYear: 2030, accountIds: [sourceA, sourceB],
      openingInheritedBasisAmount: asUsdCents(20),
      yearEndApplicablePoolBalanceAmount: asUsdCents(130),
      form8606Line7DistributionAmount: asUsdCents(20),
      form8606Line8NetConversionAmount: asUsdCents(0), evidenceId: 'basis-pool-record',
    },
    line7Distributions: line7Entries(),
    rmdPoolEvidence: {
      predicate:
        'completeBeneficiaryTraditionalIraRmdPoolForBeneficiaryDecedentAndTaxYear',
      actionId: action, allocationId: allocation, sourceAccountId: sourceA,
      evaluationDate: '2030-03-01', beneficiaryPersonId: beneficiary,
      inheritedFromPersonId: decedent, poolId: 'rmd-pool', taxYear: 2030,
      accountIds: [sourceA, sourceB], requiredAmount: asUsdCents(40),
      satisfiedBeforeExecution: asUsdCents(0),
      remainingBeforeExecution: asUsdCents(40), evidenceId: 'rmd-a',
    },
  }
}

function primitiveMember(): StageBeneficiaryTraditionalIraMovementCandidateInput {
  const penaltyInput = {
    spousalElection: {
      status: 'spousalElectionNotApplicable',
      relationship: 'notSurvivingSpouse',
      evidenceId: 'spousal-election-not-applicable',
    } as const,
    characterizationInput: characterizationInput(),
    deathBeneficiaryEvidence: {
      predicate: 'beneficiaryTraditionalIraDeathBeneficiary', actionId: action,
      allocationId: allocation, sourceAccountId: sourceA,
      beneficiaryPersonId: beneficiary, decedentPersonId: decedent,
      evaluationDate: '2030-03-01', deathDate: '2029-12-31',
      inheritanceEvidenceId: 'inheritance-a',
    } satisfies BeneficiaryTraditionalIraDeathBeneficiaryEvidence,
  }
  const penalty = evaluateBeneficiaryTraditionalIraDeathPenalty(penaltyInput)
  if (penalty.status !== 'accepted') throw new Error('Invalid penalty fixture')
  const accepted = penalty.characterization.acceptedSourceEligibility
  const sourceSnapshot: BeneficiaryTraditionalIraPhysicalSourceSnapshotEvidence = {
    predicate: 'beneficiaryTraditionalIraPhysicalSourceBeforeWithdrawal',
    actionId: action, allocationId: allocation, sourceAccountId: sourceA,
    beneficiaryPersonId: beneficiary, decedentPersonId: decedent,
    evaluationDate: '2030-03-01', executionSequence: 1,
    requestedAmount: asPositiveUsdCents(20),
    executedAmount: asPositiveUsdCents(20), openingBalanceAmount: asUsdCents(100),
    closingBalanceAmount: asUsdCents(80), inheritanceEvidenceId: 'inheritance-a',
    basisEvidenceId: accepted.basisEvidence.evidenceId,
    sourceCharacterEvidenceId: penalty.penaltyEvidence.sourceCharacterEvidenceId,
    penaltyEvidenceId: penalty.penaltyEvidence.penaltyEvidenceId,
    rmdPoolId: 'rmd-pool', rmdEvidenceId: 'rmd-a',
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
        beneficiaryPersonId: beneficiary, decedentPersonId: decedent, taxYear: 2030,
        basisPoolId: 'basis-pool', basisPoolEvidenceId: 'basis-pool-record',
        annualAllocationEvidenceId:
          accepted.basisEvidence.annualDistributionBasisAllocation.allocationEvidenceId,
        rmdPoolId: 'rmd-pool', rmdRequiredAmount: asUsdCents(40),
        sourceAccountIds: [sourceA, sourceB],
        sourceBalances: [
          { sourceAccountId: sourceA, annualOpeningBalanceAmount: asUsdCents(100),
            annualFinalBalanceAmount: asUsdCents(80) },
          { sourceAccountId: sourceB, annualOpeningBalanceAmount: asUsdCents(50),
            annualFinalBalanceAmount: asUsdCents(50) },
        ],
        members: [{
          actionId: action, allocationId: allocation, sourceAccountId: sourceA,
          executionDate: '2030-03-01', executionSequence: 1,
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

function plan(): Plan {
  const value = createEmptyPlan()
  value.id = 'plan-beneficiary'
  const person = value.household.people[0]!
  person.id = beneficiary
  person.name = 'Beneficiary'
  value.household.people.push({ ...person, id: decedent, name: 'Decedent' })
  value.accounts = [
    {
      id: sourceA, name: 'Inherited IRA A', ownerPersonId: beneficiary,
      annualReturnPct: null, type: 'traditional', kind: 'ira', balance: 1,
      annualContribution: 0,
      inherited: { ownerDeathYear: 2029, decedentHadStartedRmds: true },
    },
    {
      id: sourceB, name: 'Inherited IRA B', ownerPersonId: beneficiary,
      annualReturnPct: null, type: 'traditional', kind: 'ira', balance: 0.5,
      annualContribution: 0,
      inherited: { ownerDeathYear: 2029, decedentHadStartedRmds: true },
    },
    {
      id: nonsource, name: 'Taxable', ownerPersonId: beneficiary,
      annualReturnPct: null, type: 'taxable', balance: 12.34, costBasis: 10,
      annualContribution: 0,
    },
  ]
  return value
}

function facts(): Mutable<BeneficiaryTraditionalIraAnnualPassEvidenceFacts> {
  return {
    transactionInput: transactionInput(),
    annualOpeningBalances: [
      { sourceAccountId: sourceA, annualOpeningBalanceAmount: asUsdCents(100) },
      { sourceAccountId: sourceB, annualOpeningBalanceAmount: asUsdCents(50) },
    ],
    inheritanceBindings: [
      { sourceAccountId: sourceA, beneficiaryPersonId: beneficiary,
        decedentPersonId: decedent, deathDate: '2029-12-31',
        inheritanceEvidenceId: 'inheritance-a' },
      { sourceAccountId: sourceB, beneficiaryPersonId: beneficiary,
        decedentPersonId: decedent, deathDate: '2029-12-31',
        inheritanceEvidenceId: 'inheritance-b' },
    ],
  }
}

interface Scalars {
  next: number
  unassignedCash: number
  priorReturn: number
  capitalLoss: number
  hsaPool: number
  depletionYear: number | null
  conversionNontaxable: number
  healthcare: number
  qualifiedMedical: number
  hsaCap: number
  requiredSpending: number
  targetSpending: number
}

function binding<Key extends keyof Scalars>(
  scalars: Scalars,
  key: Key,
): SimulatorAnnualPassValueBinding<Scalars[Key]> {
  return { read: () => scalars[key], write: (value) => { scalars[key] = value } }
}

function expenses(): YearExpenses {
  return {
    baseSpending: 1, oneTimeGoals: 2, debtService: 3, propertyCosts: 4,
    healthcare: 5, insurancePremiums: 6, careCost: 7, ltcBenefit: 8,
    requiredSpending: 9, targetSpending: 10, idealSpending: 11,
    excessSpending: 12, intendedSpending: 13, guardrailFactor: 1, total: 14,
  }
}

function state(): { bindings: SimulatorAnnualPassStateBindings; scalars: Scalars } {
  const scalars: Scalars = {
    next: 1, unassignedCash: 2, priorReturn: 3, capitalLoss: 4, hsaPool: 5,
    depletionYear: null, conversionNontaxable: 6, healthcare: 7,
    qualifiedMedical: 8, hsaCap: 9, requiredSpending: 10, targetSpending: 11,
  }
  return {
    scalars,
    bindings: {
      balances: [
        { account: { id: sourceA }, balance: 1, costBasis: 0 },
        { account: { id: sourceB }, balance: 0.5, costBasis: 0 },
        { account: { id: nonsource }, balance: 12.34, costBasis: 10 },
      ],
      retirementRuntimeOccurrences: [], retirementRuntimeApplications: [],
      nextRetirementRuntimeMutationOrdinal: binding(scalars, 'next'),
      iraProRata: new Map(), iraBasisByOwner: new Map(), rothBasis: new Map(),
      rothAssumedContributionRemaining: new Map(),
      propertyValues: new Map(), hecmStates: new Map(),
      insuranceCashValues: new Map(), allocationTrack: new Map(),
      seppAmortAmount: new Map(), magiHistory: new Map(),
      namedQcdOffsetConsumedByDonor: new Map(),
      namedQcdOffsetHistoryUnprovable: new Set(), warnings: new Set(),
      unassignedCash: binding(scalars, 'unassignedCash'),
      priorYearPortfolioReturnPct: binding(scalars, 'priorReturn'),
      capitalLossPool: binding(scalars, 'capitalLoss'),
      hsaReimbursablePool: binding(scalars, 'hsaPool'),
      depletionYear: binding(scalars, 'depletionYear'),
      conversionNontaxable: binding(scalars, 'conversionNontaxable'),
      healthcare: binding(scalars, 'healthcare'),
      qualifiedMedicalThisYear: binding(scalars, 'qualifiedMedical'),
      hsaQualifiedCap: binding(scalars, 'hsaCap'),
      requiredSpendingBase: binding(scalars, 'requiredSpending'),
      targetSpendingBase: binding(scalars, 'targetSpending'),
      expenses: expenses(),
    },
  }
}

interface MutableConsumerInput {
  state: SimulatorAnnualPassStateBindings
  plan: Plan
  taxYear: number
  planSnapshotEvidenceId: string
  simulatorRunId: string
  balanceSnapshotEvidenceId: string
  provideEvidence: ApplyBeneficiaryTraditionalIraAnnualPassInput['provideEvidence']
}

function input(
  override: Partial<MutableConsumerInput> = {},
): MutableConsumerInput {
  const fixture = state()
  return {
    state: fixture.bindings, plan: plan(), taxYear: 2030,
    planSnapshotEvidenceId: 'plan-snapshot', simulatorRunId: 'simulator-run',
    balanceSnapshotEvidenceId: 'balance-snapshot',
    provideEvidence: () => facts(), ...override,
  }
}

function apply(value: unknown) {
  return applyBeneficiaryTraditionalIraAnnualPass(
    value as ApplyBeneficiaryTraditionalIraAnnualPassInput,
  )
}

function stateBytes(value: SimulatorAnnualPassStateBindings): string {
  return JSON.stringify({
    balances: value.balances.map((row) => ({
      id: row.account.id, balance: row.balance, costBasis: row.costBasis,
    })),
    occurrences: value.retirementRuntimeOccurrences,
    applications: value.retirementRuntimeApplications,
    next: value.nextRetirementRuntimeMutationOrdinal.read(),
    iraProRata: [...value.iraProRata], iraBasis: [...value.iraBasisByOwner],
    rothBasis: [...value.rothBasis],
    rothAssumedContributionRemaining: [...value.rothAssumedContributionRemaining],
    properties: [...value.propertyValues],
    hecm: [...value.hecmStates], insurance: [...value.insuranceCashValues],
    allocation: [...value.allocationTrack], sepp: [...value.seppAmortAmount],
    magi: [...value.magiHistory],
    qcdOffsetConsumed: [...value.namedQcdOffsetConsumedByDonor],
    qcdOffsetUnprovable: [...value.namedQcdOffsetHistoryUnprovable],
    warnings: [...value.warnings],
    scalars: [value.unassignedCash.read(), value.priorYearPortfolioReturnPct.read(),
      value.capitalLossPool.read(), value.hsaReimbursablePool.read(),
      value.depletionYear.read(), value.conversionNontaxable.read(),
      value.healthcare.read(), value.qualifiedMedicalThisYear.read(),
      value.hsaQualifiedCap.read(), value.requiredSpendingBase.read(),
      value.targetSpendingBase.read()],
    expenses: value.expenses,
  })
}

function mutateAll(value: SimulatorAnnualPassStateBindings): void {
  value.balances[0]!.balance = 999
  value.balances[0]!.costBasis = 998
  value.balances.reverse()
  value.retirementRuntimeOccurrences.push({
    producerOccurrenceKey: 'mutated', kind: 'ownedIraRmd',
    grossAmountPlanDollars: 1, ownerPersonId: 'owner', sourceAccountId: 'source',
    executionDate: null, executionSequence: null, movementAuthorityId: null,
  })
  value.retirementRuntimeApplications.push({
    applicationKind: 'debit', producerOccurrenceKey: 'mutated',
    simulatorPhase: 'ownerRmdDistribution', mutationOrdinal: 1,
    ownerPersonId: 'owner', sourceAccountId: 'source',
    sourceBalanceBeforePlanDollars: 2, appliedAmountPlanDollars: 1,
    sourceBalanceAfterPlanDollars: 1,
  })
  value.nextRetirementRuntimeMutationOrdinal.write(99)
  value.iraProRata.set('x', { basis: 1, nontaxableFraction: 1 })
  value.iraBasisByOwner.set('x', 1)
  value.rothBasis.set('x', { contributionBasis: 1, conversionLayers: [] })
  value.rothAssumedContributionRemaining.set('x', 1)
  value.propertyValues.set('x', 1)
  value.hecmStates.set('x', { principalLimit: 1, loanBalance: 1 })
  value.insuranceCashValues.set('x', 1)
  value.allocationTrack.set('x', {
    policy: { mode: 'static', rebalancing: 'none',
      weights: { usStocks: 0, intlStocks: 0, bonds: 0, cash: 100 } },
    weights: [0, 0, 0, 100],
  })
  value.seppAmortAmount.set('x', 1)
  value.magiHistory.set(2029, 1)
  value.warnings.add('x')
  for (const scalar of [
    value.unassignedCash, value.priorYearPortfolioReturnPct,
    value.capitalLossPool, value.hsaReimbursablePool,
    value.conversionNontaxable, value.healthcare,
    value.qualifiedMedicalThisYear, value.hsaQualifiedCap,
    value.requiredSpendingBase, value.targetSpendingBase,
  ]) scalar.write(99)
  value.depletionYear.write(2030)
  value.expenses.total = 999
}

function expectUnsupported(value: unknown): void {
  const result = apply(value)
  expect(result).toEqual({
    status: 'unsupported', movement: 'notCommitted', committed: false,
    actionability: 'notEstablished', simulatorStatus: 'notEstablished',
    deferredEvidence: null,
  })
  expect(Object.isFrozen(result)).toBe(true)
}

describe('applyBeneficiaryTraditionalIraAnnualPass', () => {
  it('commits only named source balances and returns one immutable hand-off bundle', () => {
    const value = input()
    const nonSourceBefore = { ...value.state.balances[2]! }
    const containersBefore = stateBytes(value.state)
    const result = apply(value)
    expect(result).toMatchObject({
      status: 'beneficiaryTraditionalIraAnnualPassApplied',
      movement: 'notCommitted', committed: false,
      actionability: 'notEstablished', simulatorStatus: 'appliedToAnnualPassState',
      deferredEvidence: {
        predicate: 'beneficiaryTraditionalIraAnnualPassDeferredEvidence',
        planId: 'plan-beneficiary', taxYear: 2030,
        sourceDeltas: [
          { accountId: sourceA, openingBalancePlanDollars: 1,
            closingBalancePlanDollars: 0.8 },
          { accountId: sourceB, openingBalancePlanDollars: 0.5,
            closingBalancePlanDollars: 0.5 },
        ],
        actionDeltas: [{ actionId: action, taxableAmountCents: 17 }],
        rmdDelta: { satisfiedByTransactionCents: 20 },
      },
    })
    expect(value.state.balances.map((row) => row.balance)).toEqual([0.8, 0.5, 12.34])
    expect(value.state.balances[2]).toEqual(nonSourceBefore)
    expect(stateBytes(value.state).replace('0.8', '1')).toBe(containersBefore)
    expect(Object.isFrozen(result)).toBe(true)
    expect(result.deferredEvidence && Object.isFrozen(result.deferredEvidence)).toBe(true)
  })

  it('gives the callback only a detached, deeply frozen, canonical context', () => {
    const value = input()
    value.state.balances.reverse()
    let observed: unknown
    value.provideEvidence = (context) => {
      observed = context
      expect(context.accountBalances.map((row) => row.accountId)).toEqual([
        sourceA, sourceB, nonsource,
      ])
      expect(Object.isFrozen(context)).toBe(true)
      expect(Object.isFrozen(context.accountBalances)).toBe(true)
      expect(Object.isFrozen(context.accountBalances[0])).toBe(true)
      expect(() => {
        ;(context.accountBalances[0] as { openingBalancePlanDollars: number })
          .openingBalancePlanDollars = 99
      }).toThrow()
      return facts()
    }
    expect(apply(value).status).toBe('beneficiaryTraditionalIraAnnualPassApplied')
    expect(observed).not.toBe(value.state)
    expect(observed).not.toBe(value.plan)
  })

  it('rolls back a callback that mutates every annual-pass container via closure', () => {
    const value = input()
    const before = stateBytes(value.state)
    value.provideEvidence = () => {
      mutateAll(value.state)
      return facts()
    }
    const result = apply(value)
    expect(result.status).toBe('beneficiaryTraditionalIraAnnualPassApplied')
    expect(value.state.balances.map((row) => row.balance)).toEqual([0.8, 0.5, 12.34])
    expect(stateBytes(value.state).replace('0.8', '1')).toBe(before)
  })

  it('rolls back and emits no evidence when the provider returns null or throws', () => {
    for (const providerOutcome of ['null', 'throw'] as const) {
      const value = input()
      const originalAccount = value.state.balances[0]!.account
      value.provideEvidence = () => {
        if (providerOutcome === 'null') {
          ;(originalAccount as { id: string }).id = 'mutated-source'
          return null
        }
        ;(value.state.balances[0] as {
          account: { id: string }
        }).account = { id: 'replacement-source' }
        throw new Error('provider failed')
      }
      const before = stateBytes(value.state)
      expectUnsupported(value)
      expect(stateBytes(value.state)).toBe(before)
      expect(value.state.balances[0]!.account).toBe(originalAccount)
      expect(value.state.balances[0]!.account.id).toBe(sourceA)
    }
  })

  it('fails closed on accessor and proxy provider output without invoking getters', () => {
    const accessor = input()
    let invoked = false
    accessor.provideEvidence = () => {
      const output = facts()
      Object.defineProperty(output, 'transactionInput', {
        enumerable: true,
        get: () => { invoked = true; return transactionInput() },
      })
      return output
    }
    expectUnsupported(accessor)
    expect(invoked).toBe(false)

    const proxy = input()
    proxy.provideEvidence = () => new Proxy(facts(), {
      ownKeys: () => { throw new Error('hostile proxy') },
    })
    expectUnsupported(proxy)
  })

  it('rolls back when acquired facts do not match the restored source snapshot', () => {
    const value = input()
    const before = stateBytes(value.state)
    value.provideEvidence = () => {
      const output = facts()
      output.annualOpeningBalances[0]!.annualOpeningBalanceAmount = asUsdCents(101)
      return output
    }
    expectUnsupported(value)
    expect(stateBytes(value.state)).toBe(before)
  })

  it('rejects duplicate, missing, and foreign current account records atomically', () => {
    const duplicate = input()
    duplicate.state.balances.splice(2, 1, {
      account: { id: sourceA }, balance: 12.34, costBasis: 10,
    })
    expectUnsupported(duplicate)
    const missing = input()
    missing.state.balances.pop()
    expectUnsupported(missing)
    const foreign = input()
    foreign.state.balances.splice(2, 1, {
      account: { id: 'foreign' }, balance: 12.34, costBasis: 10,
    })
    expectUnsupported(foreign)
  })

  it('is independent of Plan, state, and provider fact ordering', () => {
    const canonical = input()
    const expected = apply(canonical)
    const reordered = input()
    reordered.plan.accounts.reverse()
    reordered.state.balances.reverse()
    reordered.provideEvidence = () => {
      const output = facts()
      output.annualOpeningBalances.reverse()
      output.inheritanceBindings.reverse()
      return output
    }
    expect(apply(reordered).deferredEvidence).toEqual(expected.deferredEvidence)
  })

  it('rejects role collisions before mutating state or exposing evidence', () => {
    for (const override of [
      { simulatorRunId: 'plan-snapshot' },
      { balanceSnapshotEvidenceId: 'inheritance-a' },
      { simulatorRunId: 'balance-snapshot' },
    ]) {
      const value = input(override)
      const before = stateBytes(value.state)
      expectUnsupported(value)
      expect(stateBytes(value.state)).toBe(before)
    }
  })

  it('rejects decorated facts and hostile top-level input accessors', () => {
    const decorated = input()
    decorated.provideEvidence = () => {
      const output = facts()
      ;(output as unknown as Record<string, unknown>).extra = true
      return output
    }
    expectUnsupported(decorated)

    const hostile = input()
    let invoked = false
    Object.defineProperty(hostile, 'provideEvidence', {
      enumerable: true,
      get: () => { invoked = true; return () => facts() },
    })
    expectUnsupported(hostile)
    expect(invoked).toBe(false)
  })
})
