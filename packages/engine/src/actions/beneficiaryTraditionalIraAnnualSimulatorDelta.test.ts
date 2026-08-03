import { describe, expect, it } from 'vitest'

import { createEmptyPlan, type Plan } from '../model/plan.js'
import type { AnnualIraBasisAllocationEntryInput } from './annualIraBasisAllocation.js'
import {
  type BeneficiaryTraditionalIraAnnualOpeningBalanceEvidence,
  type BeneficiaryTraditionalIraPlanInheritanceBinding,
} from './beneficiaryTraditionalIraAnnualPlanApplication.js'
import {
  prepareBeneficiaryTraditionalIraAnnualSimulatorDelta,
  type PrepareBeneficiaryTraditionalIraAnnualSimulatorDeltaInput,
} from './beneficiaryTraditionalIraAnnualSimulatorDelta.js'
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
  asPlanId,
  asPersonId,
} from './identity.js'
import { asPositiveUsdCents, asUsdCents } from './money.js'

const beneficiary = asPersonId('beneficiary')
const decedent = asPersonId('decedent')
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
    spousalElection: {
      status: 'spousalElectionNotApplicable',
      relationship: 'notSurvivingSpouse',
      evidenceId: 'spousal-election-not-applicable',
    } as const,
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


type MutableInput = Mutable<PrepareBeneficiaryTraditionalIraAnnualSimulatorDeltaInput>

const nonsource = asAccountId('taxable-nonsource')

function balanceAccount(
  input: { plan: unknown },
  index: number,
): Extract<Plan['accounts'][number], { balance: number }> {
  const account = (input.plan as Plan).accounts[index]
  if (account === undefined || !('balance' in account)) {
    throw new Error('Expected balance-bearing fixture account')
  }
  return account
}

function validSimulatorInput(): MutableInput {
  const planInput = validInput()
  balanceAccount(planInput, 0).balance = 1
  balanceAccount(planInput, 1).balance = 0.5
  planInput.plan.accounts.push({
    id: nonsource,
    name: 'Taxable non-source',
    ownerPersonId: planInput.plan.household.people[0]!.id,
    annualReturnPct: null,
    type: 'taxable',
    balance: 12.34,
    costBasis: 10,
    annualContribution: 0,
  })
  return {
    ...planInput,
    ledgerIdentity: {
      predicate: 'beneficiaryTraditionalIraSimulatorLedgerIdentity',
      planId: asPlanId('plan-beneficiary'),
      taxYear: 2030,
      simulatorRunId: 'simulator-run',
      balanceSnapshotEvidenceId: 'simulator-balance-snapshot',
    },
    simulatorSnapshot: {
      predicate: 'detachedSimulatorAnnualAccountBalanceSnapshot',
      balanceSnapshotEvidenceId: 'simulator-balance-snapshot',
      accountBalances: [
        { accountId: asAccountId('inherited-ira-a'), openingBalancePlanDollars: 1 },
        { accountId: asAccountId('inherited-ira-b-zero'), openingBalancePlanDollars: 0.5 },
        { accountId: nonsource, openingBalancePlanDollars: 12.34 },
      ],
    },
  }
}

function prepare(input: unknown) {
  return prepareBeneficiaryTraditionalIraAnnualSimulatorDelta(
    input as PrepareBeneficiaryTraditionalIraAnnualSimulatorDeltaInput,
  )
}

function expectUnsupported(input: unknown): void {
  expect(prepare(input)).toMatchObject({
    status: 'unsupported',
    movement: 'notCommitted',
    committed: false,
    actionability: 'notEstablished',
    simulatorStatus: 'notEstablished',
    planApplication: null,
    ledgerIdentity: null,
    sourceDeltas: [],
    actionDeltas: [],
    unchangedAccounts: [],
    rmdDelta: null,
    simulatorApplicationEvidenceId: null,
  })
}

describe('prepareBeneficiaryTraditionalIraAnnualSimulatorDelta', () => {
  it('prepares exact detached source, action, RMD, and unchanged deltas', () => {
    const result = prepare(validSimulatorInput())
    expect(result).toMatchObject({
      status: 'annualSimulatorDeltaPrepared',
      movement: 'notCommitted',
      committed: false,
      actionability: 'notEstablished',
      simulatorStatus: 'preparedDeltaOnly',
    })
    if (result.status !== 'annualSimulatorDeltaPrepared') return
    expect(result.sourceDeltas).toMatchObject([
      {
        accountId: 'inherited-ira-a',
        openingBalanceCents: 100,
        openingBalancePlanDollars: 1,
        debitAmountCents: 20,
        debitAmountPlanDollars: 0.2,
        closingBalanceCents: 80,
        closingBalancePlanDollars: 0.8,
      },
      {
        accountId: 'inherited-ira-b-zero',
        openingBalanceCents: 50,
        debitAmountCents: 0,
        closingBalanceCents: 50,
      },
    ])
    expect(result.actionDeltas).toMatchObject([{
      actionId: 'withdrawal-a',
      allocationId: 'allocation-a',
      sourceAccountId: 'inherited-ira-a',
      debitAmountCents: 20,
      basisReturnExcludedAmountCents: 3,
      taxableAmountCents: 17,
      penaltyAmountCents: 0,
    }])
    expect(result.unchangedAccounts).toMatchObject([{
      accountId: nonsource,
      openingBalanceCents: 1234,
      openingBalancePlanDollars: 12.34,
      closingBalanceCents: 1234,
      closingBalancePlanDollars: 12.34,
      balanceSnapshotEvidenceId: 'simulator-balance-snapshot',
    }])
    expect(result.rmdDelta).toMatchObject({
      requiredAmountCents: 40,
      initialSatisfiedAmountCents: 0,
      satisfiedByTransactionCents: 20,
      finalSatisfiedAmountCents: 20,
      finalRemainingAmountCents: 20,
    })
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.sourceDeltas[0])).toBe(true)
    expect(Object.isFrozen(result.unchangedAccounts[0])).toBe(true)
  })

  it('is canonical across every relevant input order', () => {
    const expected = prepare(validSimulatorInput())
    const reordered = validSimulatorInput()
    ;(reordered.plan as Plan).accounts.reverse()
    reordered.simulatorSnapshot.accountBalances.reverse()
    reordered.annualOpeningBalances.reverse()
    reordered.inheritanceBindings.reverse()
    expect(prepare(reordered)).toEqual(expected)
  })

  it('requires exact source openings across transaction, binding, and snapshot', () => {
    const snapshot = validSimulatorInput()
    snapshot.simulatorSnapshot.accountBalances[0]!.openingBalancePlanDollars = 1.01
    expectUnsupported(snapshot)
    const application = validSimulatorInput()
    application.annualOpeningBalances[0]!.annualOpeningBalanceAmount = asUsdCents(99)
    expectUnsupported(application)
  })

  it('requires every simulator-balance account exactly once and rejects foreign rows', () => {
    const missing = validSimulatorInput()
    missing.simulatorSnapshot.accountBalances.pop()
    expectUnsupported(missing)
    const duplicate = validSimulatorInput()
    duplicate.simulatorSnapshot.accountBalances[2]!.accountId =
      asAccountId('inherited-ira-a')
    expectUnsupported(duplicate)
    const foreign = validSimulatorInput()
    foreign.simulatorSnapshot.accountBalances[2]!.accountId =
      asAccountId('foreign-account')
    expectUnsupported(foreign)
  })

  it('excludes property, pension, and annuity identities from balance snapshots', () => {
    const input = validSimulatorInput()
    const plan = input.plan as Plan
    const ownerPersonId = plan.household.people[0]!.id
    plan.accounts.push(
      {
        id: 'home', name: 'Home', ownerPersonId, annualReturnPct: null,
        type: 'property', value: 500_000, plannedSaleYear: null,
        expectedNetProceeds: null,
      },
      {
        id: 'pension', name: 'Pension', ownerPersonId, annualReturnPct: null,
        type: 'pension', startAge: 65, monthlyAmount: 1_000, colaPct: 0,
        survivorPct: 0,
      },
      {
        id: 'annuity', name: 'Annuity', ownerPersonId, annualReturnPct: null,
        type: 'annuity', startAge: 65, monthlyAmount: 500, colaPct: 0,
        taxablePct: 100,
      },
    )
    expect(prepare(input).status).toBe('annualSimulatorDeltaPrepared')

    const nonBalanceRow = validSimulatorInput()
    ;(nonBalanceRow.plan as Plan).accounts.push({
      id: 'home', name: 'Home', ownerPersonId, annualReturnPct: null,
      type: 'property', value: 500_000, plannedSaleYear: null,
      expectedNetProceeds: null,
    })
    nonBalanceRow.simulatorSnapshot.accountBalances[2]!.accountId =
      asAccountId('home')
    expectUnsupported(nonBalanceRow)
  })

  it('treats detached liquid balances as current authority, not Plan balances', () => {
    const input = validSimulatorInput()
    balanceAccount(input, 2).balance = 99_999
    const result = prepare(input)
    expect(result.status).toBe('annualSimulatorDeltaPrepared')
    if (result.status !== 'annualSimulatorDeltaPrepared') return
    expect(result.unchangedAccounts).toMatchObject([{
      accountId: nonsource,
      openingBalanceCents: 1234,
      openingBalancePlanDollars: 12.34,
      closingBalanceCents: 1234,
      closingBalancePlanDollars: 12.34,
    }])
  })

  it('requires exact Plan, year, run, and snapshot ledger identity', () => {
    const plan = validSimulatorInput()
    plan.ledgerIdentity.planId = asPlanId('other-plan')
    expectUnsupported(plan)
    const year = validSimulatorInput()
    year.ledgerIdentity.taxYear = 2031
    expectUnsupported(year)
    const snapshot = validSimulatorInput()
    snapshot.simulatorSnapshot.balanceSnapshotEvidenceId = 'other-snapshot'
    expectUnsupported(snapshot)
    const blankRun = validSimulatorInput()
    blankRun.ledgerIdentity.simulatorRunId = ' '
    expectUnsupported(blankRun)
  })

  it('uses exact cent round trips and rejects sub-cent Plan balances', () => {
    const exact = validSimulatorInput()
    balanceAccount(exact, 2).balance = 90_071_992_547_409.9
    exact.simulatorSnapshot.accountBalances[2]!.openingBalancePlanDollars =
      90_071_992_547_409.9
    const result = prepare(exact)
    expect(result.status).toBe('annualSimulatorDeltaPrepared')
    if (result.status === 'annualSimulatorDeltaPrepared') {
      expect(result.unchangedAccounts[0]!.openingBalanceCents)
        .toBe(9_007_199_254_740_990)
    }
    const rounded = validSimulatorInput()
    balanceAccount(rounded, 2).balance = 12.345
    rounded.simulatorSnapshot.accountBalances[2]!.openingBalancePlanDollars = 12.345
    expectUnsupported(rounded)
  })

  it('reruns the Plan adapter and rejects injected results', () => {
    const altered = validSimulatorInput()
    altered.transactionInput.runtimeInput.members[0]!.sourceSnapshots![0]!
      .closingBalanceAmount = asUsdCents(79)
    expectUnsupported(altered)
    expectUnsupported({ ...validSimulatorInput(), planApplication: {} })
  })

  it('rejects cross-role ledger identifier collisions', () => {
    const run = validSimulatorInput()
    run.ledgerIdentity.simulatorRunId = 'plan-snapshot'
    expectUnsupported(run)
    const snapshot = validSimulatorInput()
    snapshot.ledgerIdentity.balanceSnapshotEvidenceId = 'inheritance-a'
    snapshot.simulatorSnapshot.balanceSnapshotEvidenceId = 'inheritance-a'
    expectUnsupported(snapshot)
    const same = validSimulatorInput()
    same.ledgerIdentity.simulatorRunId = 'simulator-balance-snapshot'
    expectUnsupported(same)
    const nonSourceAccount = validSimulatorInput()
    nonSourceAccount.ledgerIdentity.simulatorRunId = nonsource
    expectUnsupported(nonSourceAccount)
  })

  it('fails closed on hostile accessors, sparse arrays, and decoration', () => {
    const accessor = validSimulatorInput()
    let invoked = false
    Object.defineProperty(accessor.ledgerIdentity, 'simulatorRunId', {
      enumerable: true,
      get: () => {
        invoked = true
        return 'hostile'
      },
    })
    expectUnsupported(accessor)
    expect(invoked).toBe(false)
    const sparse = validSimulatorInput()
    sparse.simulatorSnapshot.accountBalances.length = 4
    expectUnsupported(sparse)
    const decorated = validSimulatorInput()
    Object.defineProperty(decorated.simulatorSnapshot.accountBalances, 'extra', {
      enumerable: true,
      value: true,
    })
    expectUnsupported(decorated)
  })

  it('does not mutate accepted input', () => {
    const input = validSimulatorInput()
    const before = structuredClone(input)
    const result = prepare(input)
    expect(input).toEqual(before)
    expect(Object.isFrozen(input)).toBe(false)
    expect(result.status).toBe('annualSimulatorDeltaPrepared')
  })
})
