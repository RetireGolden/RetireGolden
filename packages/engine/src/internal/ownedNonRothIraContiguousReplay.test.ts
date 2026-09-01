import { describe, expect, it } from 'vitest'

import { planDollarsToLedgerCents } from '../actions/planBalanceAdapter.js'
import type { Account, Plan } from '../model/plan.js'
import { singlePersonPlan, traditionalAccount, validatePlan } from '../testing/planFixtures.js'
import type { SimulatorAnnualRetirementRuntimeOccurrence } from '../projection/annualRetirementRuntimeJournal.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { simulatePlan } from '../projection/simulate.js'
import type { SimulatorRetirementRuntimeApplication, YearResult } from '../projection/types.js'
import { replayOwnedNonRothIraContiguousYears } from './ownedNonRothIraContiguousReplay.js'

const TAX_YEAR = 2026
const noTax = createFlatTaxCalculator(0)

function ira(
  id: string,
  balance: number,
  basis = 0,
  kind: 'ira' | 'employer' = 'ira',
): Extract<Account, { type: 'traditional' }> {
  const account = traditionalAccount(id, balance, 'p1', kind)
  if (account.type !== 'traditional') throw new Error('expected traditional account')
  return { ...account, annualReturnPct: 0, ...(basis === 0 ? {} : { nondeductibleBasis: basis }) }
}

function roth(): Extract<Account, { type: 'roth' }> {
  return {
    type: 'roth', id: 'roth', name: 'roth', ownerPersonId: 'p1', kind: 'ira',
    balance: 0, annualReturnPct: 0, annualContribution: 0,
  }
}

function project(plan: Plan, endYear = TAX_YEAR): YearResult[] {
  return simulatePlan(validatePlan(plan), {
    startYear: TAX_YEAR,
    horizonEndYear: endYear,
    taxCalculator: noTax,
  }).years
}

function copy(years: readonly YearResult[]): YearResult[] {
  return structuredClone(years) as YearResult[]
}

describe('private contiguous owned-IRA basis replay', () => {
  it('seeds Plan basis once and carries only the prior allocation through contiguous years', () => {
    const plan = singlePersonPlan({ dob: '1950-01-01', planningAge: 77 })
    plan.id = 'basis-carry'
    plan.accounts = [ira('ira-b', 0), ira('ira-a', 100_000, 20_000), roth()]
    plan.strategies.rothConversion = {
      mode: 'manual',
      conversions: [
        { year: TAX_YEAR, amount: 10_000 },
        { year: TAX_YEAR + 1, amount: 10_000 },
      ],
    }

    const result = replayOwnedNonRothIraContiguousYears(
      plan, TAX_YEAR, project(plan, TAX_YEAR + 1),
    )

    expect(result.status).toBe('ownedNonRothIraContiguousReplayComplete')
    if (result.status !== 'ownedNonRothIraContiguousReplayComplete') return
    const first = result.annualReplays[0]!.ownerReplays[0]!
    const second = result.annualReplays[1]!.ownerReplays[0]!
    expect(first.openingBasisSource).toBe('planSeed')
    expect(first.openingBasisAmount).toBe(2_000_000)
    expect(first.line7AllocationEvidence.annualGrossAmount).toBeGreaterThan(0)
    expect(first.line8AllocationEvidence.annualGrossAmount).toBe(1_000_000)
    expect(second.openingBasisSource).toBe('priorYearCarryforward')
    expect(second.openingBasisAmount).toBe(first.nextYearOpeningBasisAmount)
    expect(second.openingBasisAmount).toBe(
      first.openingBasisAmount -
        first.line7AllocationEvidence.annualNontaxableBasisAmount -
        first.line8AllocationEvidence.annualNontaxableBasisAmount,
    )
    expect(first.annualObservation.yearEndApplicableBalances.map((entry) => entry.sourceAccountId))
      .toEqual(['ira-a', 'ira-b'])
    expect(result.sourceSeriesEvidenceId).toMatch(/:[a-f0-9]{64}$/)
    expect(result).toMatchObject({
      movement: 'notCommitted',
      actionability: 'notEstablished',
      filingCompleteness: 'notEstablished',
    })
    expect(Object.isFrozen(result)).toBe(true)
  })

  it('keeps a safe aggregate basis in exact cents when Plan dollars cannot represent it', () => {
    const plan = singlePersonPlan({ planningAge: 60 })
    plan.id = 'aggregate-basis-exact-cents'
    plan.accounts = [
      ira('ira-a', 38_491_108_915_768.56, 38_491_108_915_768.56),
      ira('ira-b', 37_789_379_125_460.984, 37_789_379_125_460.984),
    ]

    const result = replayOwnedNonRothIraContiguousYears(plan, TAX_YEAR, project(plan))

    expect(result.status).toBe('ownedNonRothIraContiguousReplayComplete')
    if (result.status !== 'ownedNonRothIraContiguousReplayComplete') return
    expect(result.annualReplays[0]!.ownerReplays[0]!).toMatchObject({
      openingBasisAmount: 7_628_048_804_122_954,
      nextYearOpeningBasisAmount: 7_628_048_804_122_954,
      annualObservation: {
        startOfTaxYearBasisObservation: {
          startOfTaxYearIraBasisAmount: 7_628_048_804_122_954,
        },
      },
    })
  })

  it('blocks the whole horizon on a later source break and cannot resume by reseeding a suffix', () => {
    const plan = singlePersonPlan({ planningAge: 61 })
    plan.id = 'source-failure-propagation'
    plan.accounts = [ira('ira', 20_000, 2_000), roth()]
    plan.strategies.rothConversion = {
      mode: 'manual',
      conversions: [
        { year: TAX_YEAR, amount: 1_000 },
        { year: TAX_YEAR + 1, amount: 1_000 },
      ],
    }
    const years = copy(project(plan, TAX_YEAR + 1))
    const secondApplication = years[1]!.retirementRuntimeApplicationSource!.applications[0]!
    if (secondApplication.applicationKind === 'aggregateRothDestinationCredit') throw new Error('expected debit')
    ;(secondApplication as { sourceBalanceBeforePlanDollars: number }).sourceBalanceBeforePlanDollars += 1

    const result = replayOwnedNonRothIraContiguousYears(
      plan, TAX_YEAR, years,
    )

    expect(result).toMatchObject({
      status: 'ownedNonRothIraContiguousReplayBlocked',
      sourceSeriesEvidenceId: null,
      annualReplays: null,
      replayEvidenceId: null,
      issues: [{ kind: 'balanceChainInvalid', taxYear: TAX_YEAR + 1 }],
    })
    expect(replayOwnedNonRothIraContiguousYears(plan, TAX_YEAR, [years[1]!])).toMatchObject({
      status: 'ownedNonRothIraContiguousReplayBlocked',
      annualReplays: null,
      issues: [{ kind: 'yearSeriesInvalid' }],
    })
  })

  it('replays a routed QCD and puts an annuity contract back on line 6', () => {
    // The routed gift replays: the overlay's attribution says whose line-7
    // gross it shrinks, so the basis fraction is built on a denominator the
    // gift has left, exactly as 408(d)(8)(D)'s proper adjustment requires.
    const qcdPlan = singlePersonPlan({ dob: '1950-01-01', planningAge: 76 })
    qcdPlan.id = 'basis-qcd-block'
    qcdPlan.accounts = [ira('ira', 100_000, 10_000)]
    qcdPlan.strategies.qcdAnnual = 1_000
    const qcdYears = project(qcdPlan)
    const qcdReplay = replayOwnedNonRothIraContiguousYears(
      qcdPlan, TAX_YEAR, qcdYears,
    )
    expect(qcdReplay.status).toBe('ownedNonRothIraContiguousReplayComplete')
    if (qcdReplay.status === 'ownedNonRothIraContiguousReplayComplete') {
      const owner = qcdReplay.annualReplays[0]!.ownerReplays[0]!
      // Line 9 is the December 31 pool plus the year's line 7, and the gift is
      // in neither: it left the account and never joined the line.
      expect(owner.annualBasisRatio.denominatorMinorUnits)
        .toBe(planDollarsToLedgerCents(100_000 - 1_000))
    }

    const annuityPlan = singlePersonPlan({ planningAge: 60 })
    annuityPlan.id = 'basis-annuity-block'
    annuityPlan.accounts = [
      ira('ira', 20_000, 2_000),
      {
        type: 'annuity', id: 'annuity', name: 'annuity', ownerPersonId: 'p1',
        annualReturnPct: null, startAge: 60, monthlyAmount: 0, colaPct: 0,
        taxablePct: 100,
        purchase: {
          year: TAX_YEAR, premium: 5_000, fundingAccountId: 'ira',
          taxQualification: 'qualified',
        },
      },
    ]
    const annuityReplay = replayOwnedNonRothIraContiguousYears(
      annuityPlan, TAX_YEAR, project(annuityPlan),
    )
    expect(annuityReplay.status).toBe('ownedNonRothIraContiguousReplayComplete')
    if (annuityReplay.status === 'ownedNonRothIraContiguousReplayComplete') {
      const owner = annuityReplay.annualReplays[0]!.ownerReplays[0]!
      // THE PURCHASE IS INVISIBLE TO THE FORM, which is the whole claim.
      // Line 6 is the December 31 pool -- 15,000 after the premium left it --
      // PLUS the contract those dollars bought, and the two sum to the 20,000
      // the household started with. Section 408(d)(2)(A) treats all individual
      // retirement plans as one contract and 7701(a)(37)(B) makes the annuity
      // one of them, so a transaction that changed which asset holds the value
      // and destroyed none of it cannot move the denominator.
      expect(owner.annualObservation.aggregateYearEndApplicableBalanceAmount)
        .toBe(planDollarsToLedgerCents(15_000))
      expect(owner.annualBasisRatio.denominatorMinorUnits)
        .toBe(planDollarsToLedgerCents(20_000))
      expect(owner.annualBasisRatio.numeratorMinorUnits)
        .toBe(planDollarsToLedgerCents(2_000))
    }
  })

  it('excludes employer-plan conversions from line 8 while retaining aggregate Roth truth', () => {
    const plan = singlePersonPlan({ planningAge: 60 })
    plan.id = 'mixed-employer-conversion'
    plan.accounts = [
      ira('employer-plan', 1_000, 0, 'employer'),
      ira('owned-ira', 1_000, 200),
      roth(),
    ]
    plan.strategies.rothConversion = {
      mode: 'manual', conversions: [{ year: TAX_YEAR, amount: 2_000 }],
    }

    const result = replayOwnedNonRothIraContiguousYears(plan, TAX_YEAR, project(plan))

    expect(result.status).toBe('ownedNonRothIraContiguousReplayComplete')
    if (result.status !== 'ownedNonRothIraContiguousReplayComplete') return
    const annual = result.annualReplays[0]!
    expect(annual.ownerReplays[0]!.line8AllocationEvidence).toMatchObject({
      annualGrossAmount: 100_000,
    })
    // One owner, so one credit: the owner slice has nobody to divide the
    // household between.
    expect(annual.aggregateRothDestinationCredits).toHaveLength(1)
    expect(annual.aggregateRothDestinationCredits[0]).toMatchObject({
      destinationCreditedAmount: 200_000,
      sourceOwnerPersonIds: ['p1', 'p1'],
    })
  })

  it('blocks rather than clamping when separate line rounding would recover basis twice', () => {
    const plan = singlePersonPlan({ planningAge: 60 })
    plan.id = 'line-over-recovery'
    plan.accounts = [ira('ira', 0.02, 0.01), roth()]
    const years = copy(project(plan))
    const year = years[0]!
    const line7Key = JSON.stringify(['legacyNeedBasedWithdrawal', 'ira'])
    const line8Key = JSON.stringify(['legacyRothConversion', 'ira', 'roth'])
    const occurrences: SimulatorAnnualRetirementRuntimeOccurrence[] = [
      {
        producerOccurrenceKey: line7Key,
        kind: 'legacyNeedBasedWithdrawal',
        grossAmountPlanDollars: 0.01,
        ownerPersonId: 'p1',
        sourceAccountId: 'ira',
        executionDate: null,
        executionSequence: null,
        movementAuthorityId: null,
      },
      {
        producerOccurrenceKey: line8Key,
        kind: 'legacyRothConversion',
        grossAmountPlanDollars: 0.01,
        ownerPersonId: 'p1',
        sourceAccountId: 'ira',
        executionDate: null,
        executionSequence: null,
        movementAuthorityId: null,
      },
    ]
    occurrences.sort((left, right) =>
      left.producerOccurrenceKey < right.producerOccurrenceKey ? -1 : 1)
    const applications: SimulatorRetirementRuntimeApplication[] = [
      {
        applicationKind: 'debit',
        producerOccurrenceKey: line8Key,
        simulatorPhase: 'legacyRothConversion',
        mutationOrdinal: 1,
        ownerPersonId: 'p1',
        sourceAccountId: 'ira',
        sourceBalanceBeforePlanDollars: 0.02,
        appliedAmountPlanDollars: 0.01,
        sourceBalanceAfterPlanDollars: 0.01,
      },
      {
        applicationKind: 'aggregateRothDestinationCredit',
        simulatorPhase: 'legacyRothConversionAggregateDestinationCredit',
        mutationOrdinal: 2,
        producerOccurrenceKey: null,
        ownerPersonId: null,
        sourceAccountId: null,
        sourceBalanceBeforePlanDollars: null,
        sourceBalanceAfterPlanDollars: null,
        producerOccurrenceKeys: [line8Key],
        sourceOwnerPersonIds: ['p1'],
        destinationRothAccountId: 'roth',
        destinationOwnerPersonId: 'p1',
        destinationBalanceBeforePlanDollars: 0,
        destinationCreditedAmountPlanDollars: 0.01,
        destinationBalanceAfterPlanDollars: 0.01,
      },
      {
        applicationKind: 'debit',
        producerOccurrenceKey: line7Key,
        simulatorPhase: 'legacyNeedBasedWithdrawal',
        mutationOrdinal: 3,
        ownerPersonId: 'p1',
        sourceAccountId: 'ira',
        sourceBalanceBeforePlanDollars: 0.01,
        appliedAmountPlanDollars: 0.01,
        sourceBalanceAfterPlanDollars: 0,
      },
    ]
    ;(year.retirementRuntimeSource as unknown as {
      runtimeOccurrences: SimulatorAnnualRetirementRuntimeOccurrence[]
    }).runtimeOccurrences = occurrences
    ;(year.retirementRuntimeApplicationSource as unknown as {
      applications: SimulatorRetirementRuntimeApplication[]
    }).applications = applications
    ;(year.ownedNonRothIraBalancesBeforeGrowth as {
      ira: number
    }).ira = 0
    ;(year.ownedNonRothIraPhysicalBalancesBeforeGrowth![0] as {
      balancePlanDollars: number
    }).balancePlanDollars = 0
    ;(year.ownedNonRothIraPostGrowthSource!.ownerPools[0]!.accountBalances[0]! as {
      balancePlanDollars: number
    }).balancePlanDollars = 0
    year.balances.ira = 0
    year.rothConversion = 0.01
    year.withdrawals.traditional = 0.01

    const result = replayOwnedNonRothIraContiguousYears(plan, TAX_YEAR, years)

    expect(result).toMatchObject({
      status: 'ownedNonRothIraContiguousReplayBlocked',
      annualReplays: null,
      issues: [{
        kind: 'basisReplayInvalid',
        detail: 'Independent Form 8606 line rounding cannot recover more than annual IRA basis',
      }],
    })
  })

  it('returns deeply frozen diagnostics without rereading hostile rejected years', () => {
    const plan = singlePersonPlan({ planningAge: 60 })
    const hostileYear = Object.defineProperty({}, 'year', {
      enumerable: true,
      get(): never { throw new Error('hostile year getter') },
    }) as Readonly<YearResult>

    const result = replayOwnedNonRothIraContiguousYears(plan, TAX_YEAR, [hostileYear])

    expect(result).toMatchObject({
      status: 'ownedNonRothIraContiguousReplayBlocked',
      startTaxYear: TAX_YEAR,
      endTaxYear: null,
      annualReplays: null,
      issues: [{ kind: 'sourceSeriesConstructionInvalid' }],
    })
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.issues)).toBe(true)
    expect(Object.isFrozen(result.issues[0])).toBe(true)
  })

  it('uses one stable Plan snapshot for source validation, basis seed, and evidence', () => {
    const sourcePlan = singlePersonPlan({ planningAge: 60 })
    sourcePlan.id = 'stable-plan-snapshot'
    const lowBasisAccounts = [ira('ira', 20_000, 1_000), roth()]
    sourcePlan.accounts = lowBasisAccounts
    const years = project(sourcePlan)
    const highBasisAccounts = [ira('ira', 20_000, 9_000), roth()]
    let accountReads = 0
    Object.defineProperty(sourcePlan, 'accounts', {
      enumerable: true,
      configurable: true,
      get(): Plan['accounts'] {
        accountReads += 1
        return accountReads === 1 ? lowBasisAccounts : highBasisAccounts
      },
    })

    const result = replayOwnedNonRothIraContiguousYears(sourcePlan, TAX_YEAR, years)

    expect(result.status).toBe('ownedNonRothIraContiguousReplayComplete')
    if (result.status !== 'ownedNonRothIraContiguousReplayComplete') return
    expect(accountReads).toBe(1)
    expect(result.annualReplays[0]!.ownerReplays[0]!.openingBasisAmount).toBe(100_000)
  })
})
