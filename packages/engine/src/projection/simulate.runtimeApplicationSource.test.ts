import { describe, expect, it } from 'vitest'

import type { Account, Plan } from '../model/plan.js'
import {
  singlePersonPlan,
  traditionalAccount,
  validatePlan,
} from '../testing/planFixtures.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { simulatePlan } from './simulate.js'
import type {
  SimulatorRetirementRuntimeApplication,
  SimulatorRetirementRuntimeApplicationPhase,
  YearResult,
} from './types.js'

const TAX_YEAR = 2026
const noTax = createFlatTaxCalculator(0)
const AGGREGATE_ROTH_CREDIT_PHASE:
  SimulatorRetirementRuntimeApplicationPhase =
    'legacyRothConversionAggregateDestinationCredit'

function runOneYear(plan: Plan, validate = true): YearResult {
  return simulatePlan(validate ? validatePlan(plan) : plan, {
    startYear: TAX_YEAR,
    horizonEndYear: TAX_YEAR,
    taxCalculator: noTax,
  }).years[0]!
}

function sourceOf(
  year: YearResult,
): NonNullable<YearResult['retirementRuntimeApplicationSource']> {
  const source = year.retirementRuntimeApplicationSource
  if (source === undefined) throw new Error('expected runtime application source')
  return source
}

function ownedIra(
  id: string,
  balance: number,
  ownerPersonId: string | null = 'p1',
): Extract<Account, { type: 'traditional' }> {
  const account = traditionalAccount(id, balance, ownerPersonId ?? 'p1')
  if (account.type !== 'traditional') throw new Error('expected traditional account')
  return { ...account, ownerPersonId, annualReturnPct: 0 }
}

function rothIra(
  id: string,
  balance = 0,
  ownerPersonId: string | null = 'p1',
): Extract<Account, { type: 'roth' }> {
  return {
    type: 'roth',
    id,
    name: id,
    ownerPersonId,
    annualReturnPct: 0,
    kind: 'ira',
    balance,
    annualContribution: 0,
  }
}

function expectApplicationArithmetic(
  application: Readonly<SimulatorRetirementRuntimeApplication>,
): void {
  if (application.applicationKind === 'aggregateRothDestinationCredit' ||
      application.applicationKind === 'namedRothDestinationCredit') {
    expect(application.destinationBalanceAfterPlanDollars).toBeCloseTo(
      application.destinationBalanceBeforePlanDollars +
        application.destinationCreditedAmountPlanDollars,
      10,
    )
    return
  }
  // The annuity premium's credit reaches a contract-value channel rather than
  // an account balance, so its destination figures are named for what they are.
  // The arithmetic it has to satisfy is the same one.
  if (application.applicationKind === 'annuityContractPremiumCredit') {
    expect(application.destinationContractValueAfterPlanDollars).toBeCloseTo(
      application.destinationContractValueBeforePlanDollars +
        application.destinationCreditedAmountPlanDollars,
      10,
    )
    return
  }
  if (application.applicationKind === 'credit') {
    expect(application.sourceBalanceAfterPlanDollars).toBeCloseTo(
      application.sourceBalanceBeforePlanDollars +
        application.creditedAmountPlanDollars,
      10,
    )
    return
  }
  expect(application.sourceBalanceAfterPlanDollars).toBeCloseTo(
    application.sourceBalanceBeforePlanDollars -
      application.appliedAmountPlanDollars,
    10,
  )
}

describe('simulate annual owned-IRA runtime application source', () => {
  it('publishes an enumerable, deeply frozen, explicit-empty raw source', () => {
    const plan = singlePersonPlan({ planningAge: 60 })
    plan.id = 'runtime-app-empty'
    const year = runOneYear(plan)
    const source = sourceOf(year)

    expect(source).toEqual({
      status: 'runtimeApplicationSourcesCaptured',
      captureBoundary: 'atOwnedNonRothIraMutationSitesBeforeAnnualGrowth',
      applicationValidation: 'notRun',
      planId: 'runtime-app-empty',
      taxYear: TAX_YEAR,
      applications: [],
    })
    expect(Object.keys(year)).toContain('retirementRuntimeApplicationSource')
    expect(Object.isFrozen(source)).toBe(true)
    expect(Object.isFrozen(source.applications)).toBe(true)
  })

  it('captures annuity, rollover, and post-limit contribution commits in actual phase order', () => {
    const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 60 })
    plan.id = 'runtime-app-transfer-contribution'
    plan.incomes = [{
      type: 'wages', id: 'wages', personId: 'p1', annualGross: 100_000,
      endAge: null, realGrowthPct: 0,
    }]
    plan.accounts = [
      { ...ownedIra('contribution-ira', 0), annualContribution: 5_000 },
      ownedIra('annuity-source', 50_000),
      {
        type: 'annuity', id: 'qualified-annuity', name: 'Qualified annuity',
        ownerPersonId: 'p1', annualReturnPct: null, startAge: 60,
        monthlyAmount: 0, colaPct: 0, taxablePct: 100,
        purchase: {
          year: TAX_YEAR, premium: 10_000, fundingAccountId: 'annuity-source',
          taxQualification: 'qualified',
        },
      },
      ownedIra('rollover-target', 0),
      {
        type: 'pension', id: 'pension', name: 'Pension', ownerPersonId: 'p1',
        annualReturnPct: null, startAge: 60, monthlyAmount: 0, colaPct: 0,
        survivorPct: 0,
        lumpSumOffer: { amount: 20_000, electionYear: TAX_YEAR },
        lumpSumElection: { rolloverAccountId: 'rollover-target' },
      },
    ]
    const year = runOneYear(plan)
    const applications = sourceOf(year).applications

    expect(applications.map(({ mutationOrdinal, simulatorPhase }) => ({
      mutationOrdinal,
      simulatorPhase,
    }))).toEqual([
      { mutationOrdinal: 1, simulatorPhase: 'annuityPurchaseFunding' },
      // Immediately beside its debit, and nothing between them. IRC 408(d)(1)
      // taxes only what is paid or distributed OUT of an individual retirement
      // plan, so the premium is a movement of value inside the section
      // 408(d)(2) aggregate and not a departure from it; a chain that recorded
      // the leaving without the arriving asserted the opposite by omission.
      { mutationOrdinal: 2, simulatorPhase: 'annuityPurchaseContractCredit' },
      { mutationOrdinal: 3, simulatorPhase: 'pensionLumpSumRollover' },
      { mutationOrdinal: 4, simulatorPhase: 'employeeContribution' },
    ])
    expect(applications).toEqual([
      expect.objectContaining({
        applicationKind: 'debit',
        producerOccurrenceKey: JSON.stringify([
          'annuityFundingTransfer', 'annuity-source', 'qualified-annuity',
        ]),
        sourceBalanceBeforePlanDollars: 50_000,
        appliedAmountPlanDollars: 10_000,
        sourceBalanceAfterPlanDollars: 40_000,
      }),
      expect.objectContaining({
        applicationKind: 'annuityContractPremiumCredit',
        // No key of its own: one physical movement has one occurrence, and the
        // debit above already claimed it. The credit names it instead, exactly
        // as the two Roth destination credits name theirs.
        producerOccurrenceKey: null,
        producerOccurrenceKeys: [JSON.stringify([
          'annuityFundingTransfer', 'annuity-source', 'qualified-annuity',
        ])],
        destinationAnnuityAccountId: 'qualified-annuity',
        destinationOwnerPersonId: 'p1',
        destinationContractValueBeforePlanDollars: 0,
        destinationCreditedAmountPlanDollars: 10_000,
        destinationContractValueAfterPlanDollars: 10_000,
      }),
      expect.objectContaining({
        applicationKind: 'credit',
        producerOccurrenceKey: JSON.stringify([
          'rolloverInflow', 'pension', 'rollover-target',
        ]),
        sourceBalanceBeforePlanDollars: 0,
        creditedAmountPlanDollars: 20_000,
        sourceBalanceAfterPlanDollars: 20_000,
      }),
      expect.objectContaining({
        applicationKind: 'credit',
        producerOccurrenceKey: JSON.stringify([
          'ownedIraContribution', 'contribution-ira',
        ]),
        sourceBalanceBeforePlanDollars: 0,
        creditedAmountPlanDollars: 5_000,
        sourceBalanceAfterPlanDollars: 5_000,
      }),
    ])
    applications.forEach(expectApplicationArithmetic)
    applications.forEach((application) => expect(Object.isFrozen(application)).toBe(true))
  })

  it('captures RMD and SEPP debits without creating a QCD application', () => {
    const plan = singlePersonPlan({ dob: '1953-01-01', planningAge: 73 })
    plan.id = 'runtime-app-rmd-sepp-qcd'
    plan.accounts = [ownedIra('distribution-ira', 265_000)]
    plan.strategies.qcdAnnual = 5_000
    const year = runOneYear(plan)
    const applications = sourceOf(year).applications

    expect(applications.map((application) => application.simulatorPhase)).toEqual([
      'ownerRmdDistribution',
    ])
    expect(year.qcd).toBeGreaterThan(0)
    expect(applications).toHaveLength(1)
    applications.forEach(expectApplicationArithmetic)

    const seppPlan = singlePersonPlan({ dob: '1970-01-01', planningAge: 60 })
    seppPlan.id = 'runtime-app-sepp'
    seppPlan.incomes = [{
      type: 'wages', id: 'wages', personId: 'p1', annualGross: 100_000,
      endAge: null, realGrowthPct: 0,
    }]
    seppPlan.accounts = [{
      ...ownedIra('sepp-ira', 265_000),
      annualContribution: 5_000,
      sepp: { startAge: 56, method: 'rmd' },
    }]
    const seppApplications = sourceOf(runOneYear(seppPlan)).applications
    expect(seppApplications.map((application) => application.simulatorPhase))
      .toEqual(['employeeContribution', 'automaticSeppDistribution'])
    expect(seppApplications[0]!.sourceBalanceAfterPlanDollars)
      .toBe(seppApplications[1]!.sourceBalanceBeforePlanDollars)
    seppApplications.forEach(expectApplicationArithmetic)
  })

  it('binds each conversion source debit to the one unchanged legacy aggregate Roth credit', () => {
    const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 60 })
    plan.id = 'runtime-app-conversion'
    plan.accounts = [
      ownedIra('ira-a', 75_000),
      ownedIra('ira-b', 50_000),
      rothIra('roth-destination', 10_000),
    ]
    plan.strategies.rothConversion = {
      mode: 'manual',
      conversions: [{ year: TAX_YEAR, amount: 100_000 }],
    }
    const year = runOneYear(plan)
    const source = sourceOf(year)
    const applications = source.applications
      .filter((application) =>
        application.applicationKind === 'debit' &&
        application.simulatorPhase === 'legacyRothConversion',
      )

    expect(applications).toHaveLength(2)
    expect(applications.map((application) => application.sourceAccountId))
      .toEqual(['ira-a', 'ira-b'])
    for (const application of applications) {
      expect(application.applicationKind).toBe('debit')
      expectApplicationArithmetic(application)
    }
    expect(applications.reduce((sum, application) =>
      sum + (application.applicationKind === 'debit'
        ? application.appliedAmountPlanDollars
        : 0), 0)).toBe(year.rothConversion)
    const destinationCredit = source.applications.find((application) =>
      application.applicationKind === 'aggregateRothDestinationCredit',
    )
    expect(destinationCredit).toEqual({
      applicationKind: 'aggregateRothDestinationCredit',
      simulatorPhase: AGGREGATE_ROTH_CREDIT_PHASE,
      mutationOrdinal: 3,
      producerOccurrenceKey: null,
      ownerPersonId: null,
      sourceAccountId: null,
      sourceBalanceBeforePlanDollars: null,
      sourceBalanceAfterPlanDollars: null,
      producerOccurrenceKeys: applications.map(
        (application) => application.producerOccurrenceKey,
      ),
      sourceOwnerPersonIds: ['p1', 'p1'],
      destinationRothAccountId: 'roth-destination',
      destinationOwnerPersonId: 'p1',
      destinationBalanceBeforePlanDollars: 10_000,
      destinationCreditedAmountPlanDollars: year.rothConversion,
      destinationBalanceAfterPlanDollars: 110_000,
    })
    expect(Object.isFrozen(destinationCredit)).toBe(true)
    if (destinationCredit?.applicationKind === 'aggregateRothDestinationCredit') {
      expect(Object.isFrozen(destinationCredit.producerOccurrenceKeys)).toBe(true)
      expectApplicationArithmetic(destinationCredit)
    }
  })

  it('keeps a mixed employer/IRA aggregate credit complete while excluding the employer debit application', () => {
    const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 60 })
    plan.id = 'runtime-app-mixed-conversion'
    plan.accounts = [
      traditionalAccount('employer-source', 50_000, 'p1', 'employer'),
      ownedIra('owned-source', 75_000),
      rothIra('roth-destination'),
    ]
    plan.strategies.rothConversion = {
      mode: 'manual',
      conversions: [{ year: TAX_YEAR, amount: 100_000 }],
    }
    const source = sourceOf(runOneYear(plan))
    const sourceDebits = source.applications.filter((application) =>
      application.applicationKind === 'debit' &&
      application.simulatorPhase === 'legacyRothConversion',
    )
    const destinationCredit = source.applications.find((application) =>
      application.applicationKind === 'aggregateRothDestinationCredit',
    )

    expect(sourceDebits).toEqual([
      expect.objectContaining({
        mutationOrdinal: 1,
        sourceAccountId: 'owned-source',
        appliedAmountPlanDollars: 50_000,
      }),
    ])
    expect(destinationCredit).toMatchObject({
      mutationOrdinal: 2,
      producerOccurrenceKeys: [
        JSON.stringify([
          'legacyRothConversion', 'employer-source', 'roth-destination',
        ]),
        JSON.stringify([
          'legacyRothConversion', 'owned-source', 'roth-destination',
        ]),
      ],
      sourceOwnerPersonIds: ['p1', 'p1'],
      destinationCreditedAmountPlanDollars: 100_000,
    })
  })

  it('captures the final committed owned-IRA need withdrawal', () => {
    const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 60 })
    plan.id = 'runtime-app-need-withdrawal'
    plan.accounts = [ownedIra('withdrawal-ira', 100_000)]
    plan.expenses.baseAnnual = 12_000
    const year = runOneYear(plan)
    const application = sourceOf(year).applications.find(
      (candidate) => candidate.simulatorPhase === 'legacyNeedBasedWithdrawal',
    )

    expect(application).toMatchObject({
      applicationKind: 'debit',
      sourceAccountId: 'withdrawal-ira',
      appliedAmountPlanDollars: year.withdrawals.traditional,
    })
    if (application !== undefined) expectApplicationArithmetic(application)
  })

  it('excludes employer and inherited mutations and emits no zero or suppressed application', () => {
    const plan = singlePersonPlan({ dob: '1953-01-01', planningAge: 73 })
    plan.id = 'runtime-app-exclusions'
    const inherited = ownedIra('inherited-ira', 100_000)
    inherited.inherited = {
      ownerDeathYear: TAX_YEAR - 1,
      decedentHadStartedRmds: true,
    }
    plan.accounts = [
      traditionalAccount('employer-plan', 132_500, 'p1', 'employer'),
      inherited,
      { ...ownedIra('suppressed-contribution', 0), annualContribution: 5_000 },
      rothIra('roth'),
    ]
    plan.strategies.rothConversion = {
      mode: 'manual',
      conversions: [{ year: TAX_YEAR, amount: 0 }],
    }
    const year = runOneYear(plan)

    expect(year.rmd).toBeGreaterThan(0)
    expect(year.inheritedDistribution).toBeGreaterThan(0)
    expect(sourceOf(year).applications).toEqual([])
  })

  it('preserves null ownership and duplicate occurrence keys with distinct commit ordinals', () => {
    const plan = singlePersonPlan({ planningAge: 60 })
    plan.id = 'runtime-app-raw-duplicates'
    plan.incomes = [{
      type: 'wages', id: 'wages', personId: 'p1', annualGross: 100_000,
      endAge: null, realGrowthPct: 0,
    }]
    plan.accounts = [
      { ...ownedIra('duplicate-ira', 0, null), annualContribution: 5_000 },
      { ...ownedIra('duplicate-ira', 0, null), annualContribution: 1_000 },
    ]
    const year = runOneYear(plan, false)
    const applications = sourceOf(year).applications

    expect(applications).toHaveLength(2)
    expect(applications.map((application) => application.ownerPersonId))
      .toEqual([null, null])
    expect(applications.map((application) => application.sourceAccountId))
      .toEqual(['duplicate-ira', 'duplicate-ira'])
    expect(applications.map((application) => application.producerOccurrenceKey))
      .toEqual([
        JSON.stringify(['ownedIraContribution', 'duplicate-ira']),
        JSON.stringify(['ownedIraContribution', 'duplicate-ira']),
      ])
    expect(applications.map((application) => application.mutationOrdinal))
      .toEqual([1, 2])
  })

  it('rejoins every application to the exact raw occurrence key without sorting commit order', () => {
    const plan = singlePersonPlan({ dob: '1953-01-01', planningAge: 73 })
    plan.id = 'runtime-app-rejoin'
    plan.accounts = [ownedIra('z-ira', 132_500), ownedIra('a-ira', 265_000)]
    const year = runOneYear(plan)
    const applications = sourceOf(year).applications
    const occurrenceKeys = year.retirementRuntimeSource!.runtimeOccurrences
      .map((occurrence) => occurrence.producerOccurrenceKey)

    expect(applications.map((application) => application.sourceAccountId))
      .toEqual(['z-ira', 'a-ira'])
    expect(applications.map((application) => application.mutationOrdinal))
      .toEqual([1, 2])
    for (const application of applications) {
      expect(occurrenceKeys).toContain(application.producerOccurrenceKey)
    }
  })
})
