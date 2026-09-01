import { describe, expect, it } from 'vitest'

import { asActionId, type ActionId } from '../actions/identity.js'
import type { AnnualLiabilityRunTaxInput } from '../actions/annualLiabilityRunIdentity.js'
import type {
  SimulatorAnnualPassStateBindings,
  SimulatorAnnualPassValueBinding,
} from '../projection/annualPassTransaction.js'
import type { YearExpenses } from '../projection/types.js'
import {
  COUNTERFACTUAL_OMISSION_TAX_INPUT_ID,
  runCounterfactualAnnualLiability,
  type CounterfactualAnnualLiabilityRead,
  type CounterfactualAnnualLiabilityResult,
  type RunCounterfactualAnnualPass,
} from './counterfactualAnnualLiability.js'

/**
 * The counterfactual annual pass, against real checkpoint bindings and a pass
 * the test controls.
 *
 * What is proved here is everything about the driver that does not need the
 * three-thousand-line annual pass to be real: that the restoration happens on
 * every path including a throwing pass, that a failed restoration outranks a
 * successful read, that the liability is the exact tax-and-penalty total with
 * nothing rounded, and that the minted identity is a `baselineT0` whose input
 * snapshot moves when — and only when — the omission does.
 *
 * The three invariants that *are* claims about the real pass are proved against
 * `simulatePlan` in `projection/counterfactualAnnualPass.test.ts`.
 */

const TAX_YEAR = 2026
const PLAN_ID = 'counterfactual-plan'
const TAX_UNIT_ID = 'counterfactual-tax-unit'

interface Scalars {
  nextRetirementRuntimeMutationOrdinal: number
  unassignedCash: number
  priorYearPortfolioReturnPct: number
  capitalLossPool: number
  hsaReimbursablePool: number
  depletionYear: number | null
  conversionNontaxable: number
  healthcare: number
  qualifiedMedicalThisYear: number
  hsaQualifiedCap: number
  requiredSpendingBase: number
  targetSpendingBase: number
}

function valueBinding<Key extends keyof Scalars>(
  scalars: Scalars,
  key: Key,
): SimulatorAnnualPassValueBinding<Scalars[Key]> {
  return {
    read: () => scalars[key],
    write: (value) => {
      scalars[key] = value
    },
  }
}

function expenses(): YearExpenses {
  return {
    baseSpending: 10,
    oneTimeGoals: 20,
    debtService: 30,
    propertyCosts: 40,
    healthcare: 50,
    insurancePremiums: 60,
    careCost: 70,
    ltcBenefit: 80,
    requiredSpending: 90,
    targetSpending: 100,
    idealSpending: 110,
    excessSpending: 120,
    intendedSpending: 130,
    guardrailFactor: 0.9,
    total: 140,
  }
}

function bindings(): SimulatorAnnualPassStateBindings {
  const scalars: Scalars = {
    nextRetirementRuntimeMutationOrdinal: 3,
    unassignedCash: 1_000,
    priorYearPortfolioReturnPct: 5,
    capitalLossPool: 2_000,
    hsaReimbursablePool: 300,
    depletionYear: null,
    conversionNontaxable: 40,
    healthcare: 9_000,
    qualifiedMedicalThisYear: 1_100,
    hsaQualifiedCap: 1_200,
    requiredSpendingBase: 50_000,
    targetSpendingBase: 60_000,
  }
  return {
    balances: [
      { account: { id: 'ira' }, balance: 100_000, costBasis: 0 },
      { account: { id: 'brokerage' }, balance: 250_000, costBasis: 100_000 },
    ],
    retirementRuntimeOccurrences: [{
      producerOccurrenceKey: '["ownedIraRmd","ira"]',
      kind: 'ownedIraRmd',
      grossAmountPlanDollars: 4_000,
      ownerPersonId: 'p1',
      sourceAccountId: 'ira',
      executionDate: null,
      executionSequence: null,
      movementAuthorityId: null,
    }],
    retirementRuntimeApplications: [{
      applicationKind: 'debit',
      simulatorPhase: 'ownerRmdDistribution',
      mutationOrdinal: 1,
      producerOccurrenceKey: '["ownedIraRmd","ira"]',
      ownerPersonId: 'p1',
      sourceAccountId: 'ira',
      sourceBalanceBeforePlanDollars: 104_000,
      appliedAmountPlanDollars: 4_000,
      sourceBalanceAfterPlanDollars: 100_000,
    }],
    nextRetirementRuntimeMutationOrdinal:
      valueBinding(scalars, 'nextRetirementRuntimeMutationOrdinal'),
    iraProRata: new Map([['p1', { basis: 900, nontaxableFraction: 0.3 }]]),
    iraBasisByOwner: new Map([['p1', 900]]),
    rothBasis: new Map([['p1', {
      contributionBasis: 600,
      conversionLayers: [{ year: 2025, amount: 400, taxableAmount: 350 }],
    }]]),
    rothAssumedContributionRemaining: new Map([['p1', 200]]),
    rothCounterfactualFreeCoverConsumed: new Map([['p1', 50]]),
    propertyValues: new Map([['home', 500_000]]),
    hecmStates: new Map([['home', { principalLimit: 200_000, loanBalance: 25_000 }]]),
    insuranceCashValues: new Map([['policy', 20_000]]),
    allocationTrack: new Map([['brokerage', {
      policy: {
        mode: 'static',
        rebalancing: 'annual',
        weights: { usStocks: 60, intlStocks: 10, bonds: 25, cash: 5 },
      },
      weights: [60, 10, 25, 5],
    }]]),
    seppAmortAmount: new Map([['ira', 12_000]]),
    magiHistory: new Map([[2025, 70_000]]),
    deferredFirstRmdByApplicablePlan: new Map([['["owned-iras","p1"]', {
      applicablePlan: { kind: 'ownedTraditionalIras', payeePersonId: 'p1' },
      distributionCalendarYear: 2025,
      dueYear: 2026,
      requiredAmount: 4_000,
    }]]),
    namedQcdOffsetConsumedByDonor: new Map([['p1', 1_200]]),
    namedQcdOffsetHistoryUnprovable: new Set(['p2']),
    warnings: new Set(['a warning']),
    unassignedCash: valueBinding(scalars, 'unassignedCash'),
    priorYearPortfolioReturnPct: valueBinding(scalars, 'priorYearPortfolioReturnPct'),
    capitalLossPool: valueBinding(scalars, 'capitalLossPool'),
    hsaReimbursablePool: valueBinding(scalars, 'hsaReimbursablePool'),
    depletionYear: valueBinding(scalars, 'depletionYear'),
    conversionNontaxable: valueBinding(scalars, 'conversionNontaxable'),
    healthcare: valueBinding(scalars, 'healthcare'),
    qualifiedMedicalThisYear: valueBinding(scalars, 'qualifiedMedicalThisYear'),
    hsaQualifiedCap: valueBinding(scalars, 'hsaQualifiedCap'),
    requiredSpendingBase: valueBinding(scalars, 'requiredSpendingBase'),
    targetSpendingBase: valueBinding(scalars, 'targetSpendingBase'),
    expenses: expenses(),
  }
}

function annualPassStateBytes(
  state: SimulatorAnnualPassStateBindings,
): string {
  return JSON.stringify({
    balances: state.balances.map(({ account, balance, costBasis }) =>
      ({ id: account.id, balance, costBasis })),
    retirementRuntimeOccurrences: state.retirementRuntimeOccurrences,
    retirementRuntimeApplications: state.retirementRuntimeApplications,
    nextRetirementRuntimeMutationOrdinal:
      state.nextRetirementRuntimeMutationOrdinal.read(),
    iraProRata: [...state.iraProRata],
    iraBasisByOwner: [...state.iraBasisByOwner],
    rothBasis: [...state.rothBasis],
    rothAssumedContributionRemaining: [...state.rothAssumedContributionRemaining],
    rothCounterfactualFreeCoverConsumed: [...state.rothCounterfactualFreeCoverConsumed],
    propertyValues: [...state.propertyValues],
    hecmStates: [...state.hecmStates],
    insuranceCashValues: [...state.insuranceCashValues],
    allocationTrack: [...state.allocationTrack],
    seppAmortAmount: [...state.seppAmortAmount],
    magiHistory: [...state.magiHistory],
    deferredFirstRmdByApplicablePlan: [
      ...state.deferredFirstRmdByApplicablePlan,
    ],
    namedQcdOffsetConsumedByDonor: [...state.namedQcdOffsetConsumedByDonor],
    namedQcdOffsetHistoryUnprovable: [...state.namedQcdOffsetHistoryUnprovable],
    warnings: [...state.warnings],
    scalars: {
      unassignedCash: state.unassignedCash.read(),
      priorYearPortfolioReturnPct: state.priorYearPortfolioReturnPct.read(),
      capitalLossPool: state.capitalLossPool.read(),
      hsaReimbursablePool: state.hsaReimbursablePool.read(),
      depletionYear: state.depletionYear.read(),
      conversionNontaxable: state.conversionNontaxable.read(),
      healthcare: state.healthcare.read(),
      qualifiedMedicalThisYear: state.qualifiedMedicalThisYear.read(),
      hsaQualifiedCap: state.hsaQualifiedCap.read(),
      requiredSpendingBase: state.requiredSpendingBase.read(),
      targetSpendingBase: state.targetSpendingBase.read(),
    },
    expenses: state.expenses,
  })
}

/** Touch every named container and every scalar the checkpoint covers. */
function mutateEverything(state: SimulatorAnnualPassStateBindings): void {
  state.balances[0]!.balance = 1
  state.balances[0]!.costBasis = 2
  state.balances.push({ account: { id: 'added' }, balance: 3, costBasis: 4 })
  state.retirementRuntimeOccurrences.push({
    producerOccurrenceKey: '["namedRothConversion","ira","roth","a","x"]',
    kind: 'namedRothConversion',
    grossAmountPlanDollars: 5,
    ownerPersonId: 'p1',
    sourceAccountId: 'ira',
    executionDate: '2026-06-15',
    executionSequence: 1,
    movementAuthorityId: 'a',
  })
  state.retirementRuntimeApplications.push({
    applicationKind: 'debit',
    simulatorPhase: 'namedRothConversionDebit',
    mutationOrdinal: 3,
    producerOccurrenceKey: '["namedRothConversion","ira","roth","a","x"]',
    ownerPersonId: 'p1',
    sourceAccountId: 'ira',
    sourceBalanceBeforePlanDollars: 100_000,
    appliedAmountPlanDollars: 5,
    sourceBalanceAfterPlanDollars: 99_995,
  })
  state.nextRetirementRuntimeMutationOrdinal.write(4)
  state.iraProRata.set('p1', { basis: 1, nontaxableFraction: 0.9 })
  state.iraBasisByOwner.set('p2', 7)
  state.rothBasis.get('p1')!.conversionLayers.push(
    { year: 2026, amount: 5, taxableAmount: 5 },
  )
  state.rothAssumedContributionRemaining.set('p1', 1)
  state.rothCounterfactualFreeCoverConsumed.set('p1', 2)
  state.propertyValues.set('home', 1)
  state.hecmStates.delete('home')
  state.insuranceCashValues.set('policy', 1)
  state.allocationTrack.get('brokerage')!.weights[0] = 99
  state.seppAmortAmount.set('ira', 1)
  state.magiHistory.set(2026, 1)
  state.deferredFirstRmdByApplicablePlan.clear()
  state.namedQcdOffsetConsumedByDonor.set('p1', 9_999)
  state.namedQcdOffsetHistoryUnprovable.add('p1')
  state.warnings.add('a counterfactual warning')
  state.unassignedCash.write(1)
  state.priorYearPortfolioReturnPct.write(1)
  state.capitalLossPool.write(1)
  state.hsaReimbursablePool.write(1)
  state.depletionYear.write(2026)
  state.conversionNontaxable.write(1)
  state.healthcare.write(1)
  state.qualifiedMedicalThisYear.write(1)
  state.hsaQualifiedCap.write(1)
  state.requiredSpendingBase.write(1)
  state.targetSpendingBase.write(1)
  state.expenses.total = 1
  state.expenses.healthcare = 1
}

const NON_GROUP_INPUTS: readonly Readonly<AnnualLiabilityRunTaxInput>[] = [
  { inputId: 'ordinaryIncomeExcludingGroup', value: { representation: 'exactCents', amountCents: 6_000_000 } },
  { inputId: 'federalFilingStatus', value: { representation: 'declaredTerm', term: 'single' } },
]

function omitted(...ids: readonly string[]): ActionId[] {
  return ids.map(asActionId)
}

function run(options: {
  state?: SimulatorAnnualPassStateBindings
  omitActionIds?: readonly ActionId[]
  nonGroupTaxInputs?: readonly Readonly<AnnualLiabilityRunTaxInput>[]
  runPass?: RunCounterfactualAnnualPass
  tax?: number
  penalties?: number
  year?: number
} = {}): {
  result: Readonly<CounterfactualAnnualLiabilityResult>
  state: SimulatorAnnualPassStateBindings
} {
  const state = options.state ?? bindings()
  const result = runCounterfactualAnnualLiability({
    state,
    request: {
      planId: PLAN_ID,
      taxUnitId: TAX_UNIT_ID,
      taxYear: TAX_YEAR,
      omitActionIds: options.omitActionIds ?? [],
      nonGroupTaxInputs: options.nonGroupTaxInputs ?? NON_GROUP_INPUTS,
    },
    runPass: options.runPass ?? (() => ({
      yearResult: {
        year: options.year ?? TAX_YEAR,
        tax: options.tax ?? 1_000,
        penalties: options.penalties ?? 0,
      },
    })),
  })
  return { result, state }
}

function read(
  result: Readonly<CounterfactualAnnualLiabilityResult>,
): Readonly<CounterfactualAnnualLiabilityRead> {
  if (result.status !== 'counterfactualAnnualLiabilityRead') {
    throw new Error(`expected a reading, got ${result.reason}: ${result.detail}`)
  }
  return result
}

describe('counterfactual annual liability', () => {
  it('restores every checkpointed binding a counterfactual pass touched', () => {
    const state = bindings()
    const before = annualPassStateBytes(state)

    const { result } = run({
      state,
      runPass: () => {
        mutateEverything(state)
        return { yearResult: { year: TAX_YEAR, tax: 1_000, penalties: 0 } }
      },
    })

    expect(read(result).restoration).toBe('checkpointRestored')
    expect(annualPassStateBytes(state)).toBe(before)
  })

  it('rolls back a pass that threw, and refuses rather than reporting a figure', () => {
    const state = bindings()
    const before = annualPassStateBytes(state)

    const { result } = run({
      state,
      runPass: () => {
        mutateEverything(state)
        throw new Error('the pass blew up mid-year')
      },
    })

    expect(result).toMatchObject({
      status: 'counterfactualAnnualLiabilityRefused',
      reason: 'annualPassThrew',
      restoration: 'checkpointRestored',
    })
    expect(annualPassStateBytes(state)).toBe(before)
  })

  it('withholds a successfully read liability when the rollback did not complete', () => {
    // A value binding whose write throws is the one thing the checkpoint cannot
    // route around: the restoration reattaches the original adapter and then
    // calls it. A correct number standing beside state the counterfactual still
    // owns is worse than no number, so the reading is discarded.
    const state = bindings()
    state.nextRetirementRuntimeMutationOrdinal = {
      read: () => 3,
      write: () => {
        throw new Error('ordinal restoration refused')
      },
    }

    const { result } = run({ state })

    expect(result).toMatchObject({
      status: 'counterfactualAnnualLiabilityRefused',
      reason: 'restorationFailed',
      restoration: 'failed',
    })
  })

  it('reads the tax-and-penalty total as an exact rational, rounding nothing', () => {
    // 1234.567 + 0.005 = 1234.572 dollars = 123457.2 cents = 617286/5 cents.
    // Rounding either half to a whole cent first would lose the two-tenths.
    const { result } = run({ tax: 1_234.567, penalties: 0.005 })

    expect(read(result).liability).toEqual({
      representation: 'exactRationalMinorUnits',
      numeratorMinorUnits: 617_286,
      denominator: 5,
      intermediateArithmetic: 'bigintRational',
    })
    expect(read(result).liabilityComponents).toEqual({
      source: 'annualPassYearResult',
      taxPlanDollars: 1_234.567,
      penaltiesPlanDollars: 0.005,
    })
  })

  it('reduces a whole-cent total to denominator one', () => {
    const { result } = run({ tax: 100, penalties: 0.5 })

    expect(read(result).liability).toMatchObject({
      numeratorMinorUnits: 10_050,
      denominator: 1,
    })
  })

  it('mints a baselineT0 identity that names no funding vector', () => {
    const { result } = run({ omitActionIds: omitted('conversion-a') })

    expect(read(result).identity).toMatchObject({
      planId: PLAN_ID,
      taxUnitId: TAX_UNIT_ID,
      taxYear: TAX_YEAR,
      liabilityRun: {
        liabilityRunKind: 'baselineT0',
        candidateFundingVectorEvidenceId: null,
      },
      identityDerivation: 'canonicalJsonSha256',
    })
  })

  it('states the omission as an input, so a run that removed nothing is detectable', () => {
    const removedNothing = read(run().result)
    const removedNothingAgain = read(run().result)
    const removedOne = read(run({ omitActionIds: omitted('conversion-a') }).result)
    const removedTwo = read(
      run({ omitActionIds: omitted('conversion-a', 'withdrawal-a') }).result,
    )

    expect(removedNothing.identity.orderedTaxInputs).toContainEqual({
      inputId: COUNTERFACTUAL_OMISSION_TAX_INPUT_ID,
      value: { representation: 'declaredTerm', term: '[]' },
    })
    // Same inputs, same snapshot: the ID names the inputs and nothing else.
    expect(removedNothingAgain.identity.taxInputSnapshotId)
      .toBe(removedNothing.identity.taxInputSnapshotId)
    // A different omission is a different input set, and therefore a different
    // snapshot -- which is what lets a consumer prove the counterfactual really
    // was one instead of taking the caller's word for it.
    expect(removedOne.identity.taxInputSnapshotId)
      .not.toBe(removedNothing.identity.taxInputSnapshotId)
    expect(removedTwo.identity.taxInputSnapshotId)
      .not.toBe(removedOne.identity.taxInputSnapshotId)
  })

  it('sorts the omission so the same set handed over twice is the same run', () => {
    const forwards = read(run({ omitActionIds: omitted('a', 'b') }).result)
    const backwards = read(run({ omitActionIds: omitted('b', 'a') }).result)

    expect(backwards.omittedActionIds).toEqual(forwards.omittedActionIds)
    expect(backwards.identity.annualTaxLiabilityEvidenceId)
      .toBe(forwards.identity.annualTaxLiabilityEvidenceId)
  })

  it('refuses a repeated omitted action ID rather than deduplicating it', () => {
    expect(run({ omitActionIds: omitted('a', 'a') }).result).toMatchObject({
      reason: 'requestInvalid',
      restoration: 'notOpened',
    })
  })

  it('refuses a caller that states the omission itself', () => {
    const { result, state } = run({
      nonGroupTaxInputs: [
        ...NON_GROUP_INPUTS,
        {
          inputId: COUNTERFACTUAL_OMISSION_TAX_INPUT_ID,
          value: { representation: 'declaredTerm', term: '["something-else"]' },
        },
      ],
    })

    expect(result).toMatchObject({
      reason: 'requestInvalid',
      restoration: 'notOpened',
    })
    // Refused before the checkpoint opened, so the pass never ran at all.
    expect(state.retirementRuntimeOccurrences).toHaveLength(1)
  })

  it('refuses a pass that answered for another year', () => {
    const { result } = run({ year: TAX_YEAR + 1 })

    expect(result).toMatchObject({
      reason: 'liabilityUnreadable',
      restoration: 'checkpointRestored',
    })
  })

  it('refuses a liability with no exact cent spelling', () => {
    expect(run({ tax: Number.NaN }).result).toMatchObject({
      reason: 'liabilityUnreadable',
    })
    expect(run({ penalties: -1 }).result).toMatchObject({
      reason: 'liabilityUnreadable',
    })
  })

  it('refuses an unusable natural key before opening a checkpoint', () => {
    const state = bindings()
    const result = runCounterfactualAnnualLiability({
      state,
      request: {
        planId: '  ',
        taxUnitId: TAX_UNIT_ID,
        taxYear: TAX_YEAR,
        omitActionIds: [],
        nonGroupTaxInputs: NON_GROUP_INPUTS,
      },
      runPass: () => {
        throw new Error('the pass must not run')
      },
    })

    expect(result).toMatchObject({
      reason: 'requestInvalid',
      restoration: 'notOpened',
    })
  })
})
