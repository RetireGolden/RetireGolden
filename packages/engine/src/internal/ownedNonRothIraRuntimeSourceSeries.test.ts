import { describe, expect, it } from 'vitest'

import type { Account, Plan } from '../model/plan.js'
import { planDollarsToLedgerCents } from '../actions/planBalanceAdapter.js'
import {
  couplePlan,
  singlePersonPlan,
  traditionalAccount,
  validatePlan,
} from '../testing/planFixtures.js'
import { createFlatTaxCalculator } from '../projection/flatTax.js'
import { simulatePlan } from '../projection/simulate.js'
import type { YearResult } from '../projection/types.js'
import { validateOwnedNonRothIraRuntimeSourceSeries } from './ownedNonRothIraRuntimeSourceSeries.js'

const TAX_YEAR = 2026
const noTax = createFlatTaxCalculator(0)

function traditional(
  id: string,
  balance: number,
  ownerPersonId = 'p1',
  kind: 'ira' | 'employer' = 'ira',
): Extract<Account, { type: 'traditional' }> {
  const account = traditionalAccount(id, balance, ownerPersonId, kind)
  if (account.type !== 'traditional') throw new Error('expected traditional account')
  return { ...account, annualReturnPct: 0 }
}

function roth(id: string, ownerPersonId = 'p1'): Extract<Account, { type: 'roth' }> {
  return {
    type: 'roth', id, name: id, ownerPersonId, kind: 'ira', balance: 0,
    annualReturnPct: 0, annualContribution: 0,
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

describe('private owned-IRA runtime source-series validation', () => {
  it('normalizes exact owner applications while retaining one mixed-source aggregate Roth credit', () => {
    const plan = couplePlan({ p1PlanningAge: 60, p2PlanningAge: 60 })
    plan.id = 'normalized-source-series'
    plan.accounts = [
      traditional('p1-plan', 1_000, 'p1', 'employer'),
      traditional('p2-ira', 1_000, 'p2'),
      roth('p1-roth'),
    ]
    plan.strategies.rothConversion = {
      mode: 'manual', conversions: [{ year: TAX_YEAR, amount: 2_000 }],
    }

    const result = validateOwnedNonRothIraRuntimeSourceSeries(
      plan, TAX_YEAR, project(plan),
    )

    expect(result.status).toBe('ownedNonRothIraRuntimeSourceSeriesComplete')
    if (result.status !== 'ownedNonRothIraRuntimeSourceSeriesComplete') return
    expect(result.years[0]!.ownerSources).toHaveLength(1)
    expect(result.years[0]!.ownerSources[0]).toMatchObject({
      ownerPersonId: 'p2',
      applications: [{
        occurrenceKind: 'legacyRothConversion',
        applicationKind: 'debit',
        form8606Line: 'line8',
        amount: 100_000,
      }],
    })
    expect(result.years[0]!.aggregateRothDestinationCredit).toMatchObject({
      status: 'aggregateDestinationCreditSourceReconciled',
      destinationAttribution: 'aggregateOnlyNotSourceAllocated',
      destinationRothAccountId: 'p1-roth',
      destinationCreditedAmount: 200_000,
      sourceOwnerPersonIds: ['p1', 'p2'],
    })
    expect(Object.isFrozen(result)).toBe(true)

    const tampered = copy(project(plan))
    const aggregate = tampered[0]!.retirementRuntimeApplicationSource!.applications.find((item) =>
      item.applicationKind === 'aggregateRothDestinationCredit')
    if (aggregate?.applicationKind !== 'aggregateRothDestinationCredit') throw new Error('expected aggregate credit')
    ;(aggregate as unknown as { simulatorPhase: string }).simulatorPhase = 'legacyRothConversion'
    expect(validateOwnedNonRothIraRuntimeSourceSeries(plan, TAX_YEAR, tampered))
      .toMatchObject({
        status: 'ownedNonRothIraRuntimeSourceSeriesBlocked',
        issues: [{ kind: 'aggregateRothCreditInvalid' }],
      })

    const shiftedDestination = copy(project(plan))
    const shiftedAggregate = shiftedDestination[0]!.retirementRuntimeApplicationSource!.applications.find((item) =>
      item.applicationKind === 'aggregateRothDestinationCredit')
    if (shiftedAggregate?.applicationKind !== 'aggregateRothDestinationCredit') throw new Error('expected aggregate credit')
    const mutableDestinationBalances = shiftedAggregate as unknown as {
      destinationBalanceBeforePlanDollars: number
      destinationBalanceAfterPlanDollars: number
    }
    mutableDestinationBalances.destinationBalanceBeforePlanDollars += 1_000
    mutableDestinationBalances.destinationBalanceAfterPlanDollars += 1_000
    const shiftedResult = validateOwnedNonRothIraRuntimeSourceSeries(plan, TAX_YEAR, shiftedDestination)
    expect(shiftedResult.status).toBe('ownedNonRothIraRuntimeSourceSeriesComplete')
    if (shiftedResult.status !== 'ownedNonRothIraRuntimeSourceSeriesComplete') throw new Error('expected complete source series')
    expect(shiftedResult.years[0]!.aggregateRothDestinationCredit)
      .not.toHaveProperty('destinationBalanceBeforeAmount')
    expect(shiftedResult.years[0]!.aggregateRothDestinationCredit)
      .not.toHaveProperty('destinationBalanceAfterAmount')
  })

  it('rejects a conversion credit forged onto a non-selected Plan Roth account', () => {
    const plan = singlePersonPlan({ planningAge: 60 })
    plan.id = 'forged-roth-destination'
    plan.accounts = [
      traditional('ira', 10_000),
      roth('first-roth'),
      roth('second-roth'),
    ]
    plan.strategies.rothConversion = {
      mode: 'manual', conversions: [{ year: TAX_YEAR, amount: 1_000 }],
    }
    const years = copy(project(plan))
    const occurrences = years[0]!.retirementRuntimeSource!.runtimeOccurrences
    const applications = years[0]!.retirementRuntimeApplicationSource!.applications
    const replacementKeys = new Map<string, string>()
    for (const occurrence of occurrences) {
      if (occurrence.kind !== 'legacyRothConversion') continue
      const tuple = JSON.parse(occurrence.producerOccurrenceKey) as unknown[]
      const replacement = JSON.stringify([tuple[0], tuple[1], 'second-roth'])
      replacementKeys.set(occurrence.producerOccurrenceKey, replacement)
      ;(occurrence as { producerOccurrenceKey: string }).producerOccurrenceKey = replacement
    }
    for (const application of applications) {
      if (application.applicationKind === 'aggregateRothDestinationCredit') {
        const mutable = application as unknown as {
          producerOccurrenceKeys: string[]
          destinationRothAccountId: string
          destinationBalanceBeforePlanDollars: number
          destinationCreditedAmountPlanDollars: number
          destinationBalanceAfterPlanDollars: number
        }
        mutable.producerOccurrenceKeys = mutable.producerOccurrenceKeys
          .map((key) => replacementKeys.get(key) ?? key)
        mutable.destinationRothAccountId = 'second-roth'
        mutable.destinationBalanceBeforePlanDollars = 0
        mutable.destinationBalanceAfterPlanDollars =
          mutable.destinationCreditedAmountPlanDollars
      } else {
        ;(application as { producerOccurrenceKey: string }).producerOccurrenceKey =
          replacementKeys.get(application.producerOccurrenceKey) ??
          application.producerOccurrenceKey
      }
    }

    expect(validateOwnedNonRothIraRuntimeSourceSeries(plan, TAX_YEAR, years))
      .toMatchObject({
        status: 'ownedNonRothIraRuntimeSourceSeriesBlocked',
        issues: [{ kind: 'aggregateRothCreditInvalid' }],
      })
  })

  it('accepts a raw-reconciled aggregate conversion across a half-cent grouping edge', () => {
    const plan = singlePersonPlan({ planningAge: 60 })
    plan.id = 'aggregate-conversion-half-cent-grouping'
    plan.accounts = [
      traditional('ira-a', 215_290_346_950.2926),
      traditional('ira-b', 793_861_452_834.0824),
      roth('roth'),
    ]
    plan.strategies.rothConversion = {
      mode: 'manual',
      conversions: [{ year: TAX_YEAR, amount: 1_513_727_699_676.5625 }],
    }

    const years = project(plan)
    const conversionTotal = years[0]!.retirementRuntimeSource!
      .runtimeOccurrences
      .filter((occurrence) => occurrence.kind === 'legacyRothConversion')
      .reduce((total, occurrence) =>
        total + occurrence.grossAmountPlanDollars, 0)
    const aggregate = years[0]!.retirementRuntimeApplicationSource!
      .applications.find((application) =>
        application.applicationKind === 'aggregateRothDestinationCredit')
    if (aggregate?.applicationKind !== 'aggregateRothDestinationCredit') {
      throw new Error('expected aggregate conversion credit')
    }
    expect(conversionTotal).toBe(1_009_151_799_784.375)
    expect(aggregate.destinationCreditedAmountPlanDollars)
      .toBe(1_009_151_799_784.3749)
    expect(validateOwnedNonRothIraRuntimeSourceSeries(plan, TAX_YEAR, years))
      .toMatchObject({ status: 'ownedNonRothIraRuntimeSourceSeriesComplete' })
  })

  it('rejects a suffix that does not begin at the authoritative projection start', () => {
    const plan = singlePersonPlan({ planningAge: 61 })
    plan.id = 'suffix-rejected'
    plan.accounts = [traditional('ira', 20_000), roth('roth')]
    plan.strategies.rothConversion = {
      mode: 'manual', conversions: [{ year: TAX_YEAR, amount: 1_000 }],
    }
    const years = project(plan, TAX_YEAR + 1)

    const result = validateOwnedNonRothIraRuntimeSourceSeries(
      plan, TAX_YEAR, [years[1]!],
    )

    expect(result).toMatchObject({
      status: 'ownedNonRothIraRuntimeSourceSeriesBlocked',
      years: null,
      issues: [{ kind: 'yearSeriesInvalid' }],
    })
  })

  it('rejects forged producer keys and same-phase Plan-account reordering', () => {
    const rmdPlan = singlePersonPlan({ dob: '1950-01-01', planningAge: 76 })
    rmdPlan.id = 'forged-key'
    rmdPlan.accounts = [traditional('ira', 100_000)]
    const forged = copy(project(rmdPlan))
    const occurrence = forged[0]!.retirementRuntimeSource!.runtimeOccurrences[0]!
    const application = forged[0]!.retirementRuntimeApplicationSource!.applications[0]!
    ;(occurrence as { producerOccurrenceKey: string }).producerOccurrenceKey = 'forged'
    if (application.applicationKind === 'aggregateRothDestinationCredit') throw new Error('expected debit')
    ;(application as { producerOccurrenceKey: string }).producerOccurrenceKey = 'forged'
    expect(validateOwnedNonRothIraRuntimeSourceSeries(rmdPlan, TAX_YEAR, forged))
      .toMatchObject({ status: 'ownedNonRothIraRuntimeSourceSeriesBlocked', issues: [{ kind: 'sourceIdentityInvalid' }] })

    const orderPlan = singlePersonPlan({ planningAge: 60 })
    orderPlan.id = 'same-phase-order'
    orderPlan.accounts = [
      traditional('ira-a', 5_000), traditional('ira-b', 5_000), roth('roth'),
    ]
    orderPlan.strategies.rothConversion = {
      mode: 'manual', conversions: [{ year: TAX_YEAR, amount: 7_000 }],
    }
    const reordered = copy(project(orderPlan))
    const applications = reordered[0]!.retirementRuntimeApplicationSource!.applications as unknown as Array<{ mutationOrdinal: number }>
    ;[applications[0], applications[1]] = [applications[1]!, applications[0]!]
    applications[0]!.mutationOrdinal = 1
    applications[1]!.mutationOrdinal = 2
    expect(validateOwnedNonRothIraRuntimeSourceSeries(orderPlan, TAX_YEAR, reordered))
      .toMatchObject({ status: 'ownedNonRothIraRuntimeSourceSeriesBlocked', issues: [{ kind: 'applicationOrderInvalid' }] })
  })

  it('requires canonical producer-key serialization', () => {
    const plan = singlePersonPlan({ dob: '1950-01-01', planningAge: 90 })
    plan.id = 'canonical-key'
    plan.accounts = [traditional('ira', 100_000)]
    const years = copy(project(plan))
    const occurrence = years[0]!.retirementRuntimeSource!.runtimeOccurrences[0]!
    const application = years[0]!.retirementRuntimeApplicationSource!.applications[0]!
    if (application.applicationKind === 'aggregateRothDestinationCredit') throw new Error('expected debit')
    const parsed = JSON.parse(occurrence.producerOccurrenceKey) as unknown[]
    const noncanonicalKey = `[ ${parsed.map((part) => JSON.stringify(part)).join(', ')} ]`
    ;(occurrence as { producerOccurrenceKey: string }).producerOccurrenceKey = noncanonicalKey
    ;(application as { producerOccurrenceKey: string }).producerOccurrenceKey = noncanonicalKey

    expect(validateOwnedNonRothIraRuntimeSourceSeries(plan, TAX_YEAR, years))
      .toMatchObject({
        status: 'ownedNonRothIraRuntimeSourceSeriesBlocked',
        issues: [{ kind: 'sourceIdentityInvalid' }],
      })
  })

  it('preserves genuine fractional-cent RMD chains by normalizing from raw transitions', () => {
    const plan = singlePersonPlan({ dob: '1950-01-01', planningAge: 90 })
    plan.id = 'fractional-cent-rmd-chain'
    plan.accounts = [traditional('ira', 539_722.3276478298)]
    plan.accounts[0]!.annualReturnPct = 5

    const result = validateOwnedNonRothIraRuntimeSourceSeries(
      plan, TAX_YEAR, project(plan, TAX_YEAR + 1),
    )

    expect(result.status).toBe('ownedNonRothIraRuntimeSourceSeriesComplete')
    if (result.status !== 'ownedNonRothIraRuntimeSourceSeriesComplete') return
    expect(result.years).toHaveLength(2)
    const rawYears = project(plan, TAX_YEAR + 1)
    for (let index = 0; index < result.years.length; index += 1) {
      const year = result.years[index]!
      const application = year.ownerSources[0]!.applications[0]!
      const rawOccurrence = rawYears[index]!.retirementRuntimeSource!
        .runtimeOccurrences.find((occurrence) =>
          occurrence.producerOccurrenceKey === application.producerOccurrenceKey)!
      expect(application.amount).toBe(
        planDollarsToLedgerCents(rawOccurrence.grossAmountPlanDollars),
      )
      expect(application.amount).toBe(
        planDollarsToLedgerCents(rawYears[index]!.rmd),
      )
      expect(
        BigInt(application.sourceBalanceBefore) -
          BigInt(application.amount) +
          BigInt(application.sourceBalanceRoundingResidualCents),
      ).toBe(BigInt(application.sourceBalanceAfter))
    }
    expect(result.years.some((year) =>
      year.ownerSources[0]!.applications[0]!
        .sourceBalanceRoundingResidualCents !== 0)).toBe(true)
  })

  it('requires a continuous raw Plan-dollar chain between adjacent applications', () => {
    const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 60 })
    plan.id = 'raw-adjacent-chain'
    plan.incomes = [{
      type: 'wages', id: 'wages', personId: 'p1', annualGross: 100_000,
      endAge: null, realGrowthPct: 0,
    }]
    plan.accounts = [
      { ...traditional('ira', 0), annualContribution: 5_000 },
      {
        type: 'pension', id: 'pension', name: 'Pension', ownerPersonId: 'p1',
        annualReturnPct: null, startAge: 60, monthlyAmount: 0, colaPct: 0,
        survivorPct: 0,
        lumpSumOffer: { amount: 20_000, electionYear: TAX_YEAR },
        lumpSumElection: { rolloverAccountId: 'ira' },
      },
    ]
    const years = copy(project(plan))
    const missingRollover = copy(years)
    const missingRolloverKey = missingRollover[0]!.retirementRuntimeSource!
      .runtimeOccurrences.find((occurrence) =>
        occurrence.kind === 'rolloverInflow')!.producerOccurrenceKey
    ;(missingRollover[0]!.retirementRuntimeSource!.runtimeOccurrences as unknown as
      Array<{ producerOccurrenceKey: string }>).splice(
      missingRollover[0]!.retirementRuntimeSource!.runtimeOccurrences
        .findIndex((occurrence) =>
          occurrence.producerOccurrenceKey === missingRolloverKey),
      1,
    )
    ;(missingRollover[0]!.retirementRuntimeApplicationSource!.applications as unknown as
      Array<{ producerOccurrenceKey: string | null }>).splice(
      missingRollover[0]!.retirementRuntimeApplicationSource!.applications
        .findIndex((application) =>
          application.producerOccurrenceKey === missingRolloverKey),
      1,
    )
    expect(validateOwnedNonRothIraRuntimeSourceSeries(
      plan, TAX_YEAR, missingRollover,
    )).toMatchObject({
      status: 'ownedNonRothIraRuntimeSourceSeriesBlocked',
      issues: [{ kind: 'sourceCoverageInvalid' }],
    })

    const rolloverOccurrence = years[0]!.retirementRuntimeSource!
      .runtimeOccurrences.find((occurrence) => occurrence.kind === 'rolloverInflow')!
    const rolloverApplication = years[0]!.retirementRuntimeApplicationSource!
      .applications.find((application) =>
        application.producerOccurrenceKey === rolloverOccurrence.producerOccurrenceKey)!
    if (rolloverApplication.applicationKind !== 'credit') throw new Error('expected rollover credit')
    ;(rolloverOccurrence as { grossAmountPlanDollars: number })
      .grossAmountPlanDollars += 0.001
    ;(rolloverApplication as {
      creditedAmountPlanDollars: number
      sourceBalanceAfterPlanDollars: number
    }).creditedAmountPlanDollars += 0.001
    ;(rolloverApplication as {
      sourceBalanceAfterPlanDollars: number
    }).sourceBalanceAfterPlanDollars += 0.001
    const pension = plan.accounts.find((account) => account.type === 'pension')
    if (pension?.type !== 'pension' || pension.lumpSumOffer === undefined) {
      throw new Error('expected pension offer')
    }
    pension.lumpSumOffer.amount += 0.001

    expect(validateOwnedNonRothIraRuntimeSourceSeries(plan, TAX_YEAR, years))
      .toMatchObject({
        status: 'ownedNonRothIraRuntimeSourceSeriesBlocked',
        issues: [{ kind: 'balanceChainInvalid' }],
      })
  })

  it('rejoins each account application chain to its live pre-growth observation', () => {
    const plan = couplePlan({ p1PlanningAge: 60, p2PlanningAge: 60 })
    plan.id = 'cross-owner-application-forgery'
    plan.accounts = [
      traditional('p1-ira', 10_000, 'p1'),
      traditional('p2-ira', 10_000, 'p2'),
      roth('p1-roth'),
    ]
    plan.strategies.rothConversion = {
      mode: 'manual', conversions: [{ year: TAX_YEAR, amount: 1_000 }],
    }
    const years = copy(project(plan))
    const occurrence = years[0]!.retirementRuntimeSource!
      .runtimeOccurrences.find((entry) =>
        entry.kind === 'legacyRothConversion')!
    const application = years[0]!.retirementRuntimeApplicationSource!
      .applications.find((entry) =>
        entry.applicationKind !== 'aggregateRothDestinationCredit')!
    const originalKey = occurrence.producerOccurrenceKey
    const tuple = JSON.parse(originalKey) as unknown[]
    const forgedKey = JSON.stringify([
      tuple[0],
      'p2-ira',
      tuple[2],
    ])
    const amount = occurrence.grossAmountPlanDollars
    Object.assign(occurrence, {
      producerOccurrenceKey: forgedKey,
      ownerPersonId: 'p2',
      sourceAccountId: 'p2-ira',
    })
    Object.assign(application, {
      producerOccurrenceKey: forgedKey,
      ownerPersonId: 'p2',
      sourceAccountId: 'p2-ira',
      sourceBalanceBeforePlanDollars: 10_000,
      sourceBalanceAfterPlanDollars: 10_000 - amount,
    })
    const aggregate = years[0]!.retirementRuntimeApplicationSource!
      .applications.find((entry) =>
        entry.applicationKind === 'aggregateRothDestinationCredit')
    if (aggregate?.applicationKind !== 'aggregateRothDestinationCredit') {
      throw new Error('expected aggregate conversion credit')
    }
    ;(aggregate as unknown as { producerOccurrenceKeys: string[] })
      .producerOccurrenceKeys = aggregate.producerOccurrenceKeys.map((key) =>
        key === originalKey ? forgedKey : key)

    expect(validateOwnedNonRothIraRuntimeSourceSeries(plan, TAX_YEAR, years))
      .toMatchObject({
        status: 'ownedNonRothIraRuntimeSourceSeriesBlocked',
        issues: [{ kind: 'balanceChainInvalid' }],
      })
  })

  it('rejoins occurrence coverage to every independently published annual movement total', () => {
    const rmdPlan = singlePersonPlan({ dob: '1950-01-01', planningAge: 76 })
    rmdPlan.id = 'missing-rmd-source'
    rmdPlan.accounts = [traditional('ira', 100_000)]
    const dropped = copy(project(rmdPlan))
    const droppedKey = dropped[0]!.retirementRuntimeSource!.runtimeOccurrences
      .find((occurrence) => occurrence.kind === 'ownedIraRmd')!.producerOccurrenceKey
    ;(dropped[0]!.retirementRuntimeSource!.runtimeOccurrences as unknown as Array<{ producerOccurrenceKey: string }>)
      .splice(dropped[0]!.retirementRuntimeSource!.runtimeOccurrences
        .findIndex((occurrence) => occurrence.producerOccurrenceKey === droppedKey), 1)
    ;(dropped[0]!.retirementRuntimeApplicationSource!.applications as unknown as Array<{ producerOccurrenceKey: string | null }>)
      .splice(dropped[0]!.retirementRuntimeApplicationSource!.applications
        .findIndex((application) => application.producerOccurrenceKey === droppedKey), 1)
    expect(validateOwnedNonRothIraRuntimeSourceSeries(rmdPlan, TAX_YEAR, dropped))
      .toMatchObject({
        status: 'ownedNonRothIraRuntimeSourceSeriesBlocked',
        issues: [{ kind: 'sourceCoverageInvalid' }],
      })
    const subcentMismatch = copy(project(rmdPlan))
    subcentMismatch[0]!.rmd += 0.0001
    expect(validateOwnedNonRothIraRuntimeSourceSeries(
      rmdPlan, TAX_YEAR, subcentMismatch,
    )).toMatchObject({
      status: 'ownedNonRothIraRuntimeSourceSeriesBlocked',
      issues: [{ kind: 'sourceCoverageInvalid' }],
    })

    const noMovementPlan = singlePersonPlan({ planningAge: 60 })
    noMovementPlan.id = 'published-total-rejoins'
    noMovementPlan.accounts = [traditional('ira', 100_000)]
    for (const field of ['sepp', 'inheritedDistribution', 'rothConversion'] as const) {
      const mismatched = copy(project(noMovementPlan))
      mismatched[0]![field] = 1
      expect(validateOwnedNonRothIraRuntimeSourceSeries(
        noMovementPlan, TAX_YEAR, mismatched,
      )).toMatchObject({
        status: 'ownedNonRothIraRuntimeSourceSeriesBlocked',
        issues: [{ kind: 'sourceCoverageInvalid' }],
      })
    }

    const needPlan = singlePersonPlan({ planningAge: 60 })
    needPlan.id = 'missing-need-withdrawal-source'
    needPlan.accounts = [traditional('ira', 100_000)]
    needPlan.expenses.baseAnnual = 1_000
    const missingNeed = copy(project(needPlan))
    const needOccurrence = missingNeed[0]!.retirementRuntimeSource!
      .runtimeOccurrences.find((occurrence) =>
        occurrence.kind === 'legacyNeedBasedWithdrawal')!
    ;(missingNeed[0]!.retirementRuntimeSource!.runtimeOccurrences as unknown as
      Array<{ producerOccurrenceKey: string }>).splice(
      missingNeed[0]!.retirementRuntimeSource!.runtimeOccurrences.indexOf(needOccurrence),
      1,
    )
    ;(missingNeed[0]!.retirementRuntimeApplicationSource!.applications as unknown as
      Array<{ producerOccurrenceKey: string | null }>).splice(
      missingNeed[0]!.retirementRuntimeApplicationSource!.applications
        .findIndex((application) =>
          application.producerOccurrenceKey === needOccurrence.producerOccurrenceKey),
      1,
    )
    expect(validateOwnedNonRothIraRuntimeSourceSeries(
      needPlan, TAX_YEAR, missingNeed,
    )).toMatchObject({
      status: 'ownedNonRothIraRuntimeSourceSeriesBlocked',
      issues: [{ kind: 'sourceCoverageInvalid' }],
    })

    const contributionPlan = singlePersonPlan({ planningAge: 60 })
    contributionPlan.id = 'missing-owned-ira-contribution-source'
    contributionPlan.incomes = [{
      type: 'wages', id: 'wages', personId: 'p1', annualGross: 100_000,
      endAge: null, realGrowthPct: 0,
    }]
    contributionPlan.accounts = [{
      ...traditional('ira', 100_000), annualContribution: 5_000,
    }]
    const missingContribution = copy(project(contributionPlan))
    const contributionOccurrence = missingContribution[0]!
      .retirementRuntimeSource!.runtimeOccurrences.find((occurrence) =>
        occurrence.kind === 'ownedIraContribution')!
    ;(missingContribution[0]!.retirementRuntimeSource!.runtimeOccurrences as unknown as
      Array<{ producerOccurrenceKey: string }>).splice(
      missingContribution[0]!.retirementRuntimeSource!.runtimeOccurrences
        .indexOf(contributionOccurrence),
      1,
    )
    ;(missingContribution[0]!.retirementRuntimeApplicationSource!.applications as unknown as
      Array<{ producerOccurrenceKey: string | null }>).splice(
      missingContribution[0]!.retirementRuntimeApplicationSource!.applications
        .findIndex((application) =>
          application.producerOccurrenceKey ===
            contributionOccurrence.producerOccurrenceKey),
      1,
    )
    expect(validateOwnedNonRothIraRuntimeSourceSeries(
      contributionPlan, TAX_YEAR, missingContribution,
    )).toMatchObject({
      status: 'ownedNonRothIraRuntimeSourceSeriesBlocked',
      issues: [{ kind: 'sourceCoverageInvalid' }],
    })
  })

  it('fails the entire source series on a later balance-chain or pool-completeness break', () => {
    const plan = singlePersonPlan({ planningAge: 61 })
    plan.id = 'source-series-chain'
    plan.accounts = [traditional('ira-a', 20_000), traditional('ira-b', 0), roth('roth')]
    plan.strategies.rothConversion = {
      mode: 'manual',
      conversions: [
        { year: TAX_YEAR, amount: 1_000 },
        { year: TAX_YEAR + 1, amount: 1_000 },
      ],
    }
    const chain = copy(project(plan, TAX_YEAR + 1))
    const second = chain[1]!.retirementRuntimeApplicationSource!.applications[0]!
    if (second.applicationKind === 'aggregateRothDestinationCredit') throw new Error('expected debit')
    ;(second as { sourceBalanceBeforePlanDollars: number }).sourceBalanceBeforePlanDollars += 1
    expect(validateOwnedNonRothIraRuntimeSourceSeries(plan, TAX_YEAR, chain))
      .toMatchObject({
        status: 'ownedNonRothIraRuntimeSourceSeriesBlocked',
        years: null,
        issues: [{ kind: 'balanceChainInvalid', taxYear: TAX_YEAR + 1 }],
      })

    const missing = copy(project(plan))
    ;(missing[0]!.ownedNonRothIraPostGrowthSource!.ownerPools[0]!.accountBalances as unknown as unknown[]).pop()
    expect(validateOwnedNonRothIraRuntimeSourceSeries(plan, TAX_YEAR, missing))
      .toMatchObject({ status: 'ownedNonRothIraRuntimeSourceSeriesBlocked', issues: [{ kind: 'postGrowthPoolInvalid' }] })

    const unpublished = copy(project(plan))
    const unpublishedBalance = unpublished[0]!.ownedNonRothIraPostGrowthSource!
      .ownerPools[0]!.accountBalances[0]! as { balancePlanDollars: number }
    unpublishedBalance.balancePlanDollars += 1
    expect(validateOwnedNonRothIraRuntimeSourceSeries(plan, TAX_YEAR, unpublished))
      .toMatchObject({ status: 'ownedNonRothIraRuntimeSourceSeriesBlocked', issues: [{ kind: 'postGrowthPoolInvalid' }] })
  })

  it('reconciles Plan-order annual totals larger than one UsdCents value', () => {
    const plan = singlePersonPlan({ dob: '1950-01-01', planningAge: 76 })
    plan.id = 'large-plan-order-total'
    plan.accounts = Array.from({ length: 30 }, (_, index) =>
      traditional(`ira-${String(30 - index).padStart(2, '0')}`, 80_000_000_000_000))

    const years = project(plan)
    expect(years[0]!.rmd).toBeGreaterThan(Number.MAX_SAFE_INTEGER / 100)
    expect(validateOwnedNonRothIraRuntimeSourceSeries(plan, TAX_YEAR, years))
      .toMatchObject({ status: 'ownedNonRothIraRuntimeSourceSeriesComplete' })
  })

  it('accepts untouched proportional need totals whose producer grouping differs by one ULP', () => {
    const plan = singlePersonPlan({ planningAge: 60 })
    plan.id = 'proportional-need-plan-order'
    plan.strategies.withdrawalOrder = { mode: 'proportional' }
    const balances = [
      2016740934000.761, 2229254082204.5156, 1553252303668.4531,
      1909328862952.9268, 1445858489394.2363, 1815506015990.2192,
      1911472832640.0254, 2826640357288.6753, 1486397895170.6602,
      2266689648559.258, 1294959002763.1467, 1876636974361.4966,
      2290625081192.24, 1385438654866.326, 2506852467100.5254,
      1334557260751.2712, 1963741914754.3252, 1788452436583.7554,
      2278827603933.5635, 1212179866111.1594, 2092193412902.0332,
      2060317538083.831, 1426762635661.9893, 2624356864903.8047,
      2781347063637.755, 1243523408433.4946, 2598902992439.657,
      1841317825205.6997, 2219210679729.67, 2826411037214.6084,
    ]
    plan.accounts = balances.map((balance, index) =>
      traditional(`ira-${String(29 - index).padStart(2, '0')}`, balance))
    plan.expenses.baseAnnual = 45_835_972_447_627.22

    const years = project(plan)
    expect(years[0]!.withdrawals.traditional).toBe(45_835_972_447_627.21)
    expect(validateOwnedNonRothIraRuntimeSourceSeries(plan, TAX_YEAR, years))
      .toMatchObject({ status: 'ownedNonRothIraRuntimeSourceSeriesComplete' })
  })

  it('blocks exact-action IRA movement pending identity and tax characterization', () => {
    const plan = singlePersonPlan({ planningAge: 60 })
    plan.id = 'exact-action-chain'
    plan.accounts = [traditional('ira', 1_000), roth('roth')]
    plan.strategies.rothConversion = {
      mode: 'manual', conversions: [{ year: TAX_YEAR, amount: 100 }],
    }
    const years = copy(project(plan))
    const conversion = years[0]!.retirementRuntimeApplicationSource!.applications
      .find((application) =>
        application.applicationKind !== 'aggregateRothDestinationCredit' &&
        application.simulatorPhase === 'legacyRothConversion')
    if (!conversion || conversion.applicationKind === 'aggregateRothDestinationCredit') {
      throw new Error('expected conversion debit')
    }
    ;(conversion as {
      sourceBalanceBeforePlanDollars: number
      sourceBalanceAfterPlanDollars: number
    }).sourceBalanceBeforePlanDollars = 900
    ;(conversion as {
      sourceBalanceAfterPlanDollars: number
    }).sourceBalanceAfterPlanDollars = 800
    const rawEnd = years[0]!.ownedNonRothIraPostGrowthSource!
      .ownerPools[0]!.accountBalances[0]! as { balancePlanDollars: number }
    rawEnd.balancePlanDollars = 800
    years[0]!.balances.ira = 800
    years[0]!.retirementActionExecution = {
      committed: true,
      scheduleIssues: [],
      balances: [{
        accountId: 'ira',
        openingBalance: 100_000,
        closingBalance: 90_000,
      }],
      taxableBases: [],
      evidence: [{
        allocations: [{
          sourceAccountId: 'ira',
          executedAmount: 10_000,
          balanceBefore: 100_000,
          balanceAfter: 90_000,
        }],
      }],
    } as unknown as NonNullable<YearResult['retirementActionExecution']>

    expect(validateOwnedNonRothIraRuntimeSourceSeries(plan, TAX_YEAR, years))
      .toMatchObject({
        status: 'ownedNonRothIraRuntimeSourceSeriesBlocked',
        issues: [{ kind: 'exactActionStageRequired' }],
      })
  })

  it('requires execution evidence for a Plan-declared exact owned-IRA action', () => {
    const plan = singlePersonPlan({ planningAge: 60 })
    plan.id = 'missing-exact-action-evidence'
    plan.accounts = [traditional('ira', 1_000)]
    plan.strategies.retirementActions = [{
      actionId: 'owned-ira-withdrawal',
      kind: 'ordinaryWithdrawal',
      year: TAX_YEAR,
      executionDate: '2026-06-15',
      executionSequence: 1,
      requestedAmount: 10_000,
      provenance: { source: 'manual' },
      personId: 'p1',
      allocations: [{
        allocationId: 'owned-ira-allocation',
        sourceAccountId: 'ira',
        requestedAmount: 10_000,
      }],
      purpose: { kind: 'spending' },
    }] as Plan['strategies']['retirementActions']
    const projected = project(plan)
    expect(validateOwnedNonRothIraRuntimeSourceSeries(
      plan, TAX_YEAR, projected,
    )).toMatchObject({
      status: 'ownedNonRothIraRuntimeSourceSeriesBlocked',
      issues: [{ kind: 'exactActionStageRequired' }],
    })

    const missingNestedEvidence = copy(projected)
    const mutableExecution = missingNestedEvidence[0]!
      .retirementActionExecution as unknown as {
        evidence: unknown[]
        balances: unknown[]
      }
    mutableExecution.evidence = []
    mutableExecution.balances = []
    expect(validateOwnedNonRothIraRuntimeSourceSeries(
      plan, TAX_YEAR, missingNestedEvidence,
    )).toMatchObject({
      status: 'ownedNonRothIraRuntimeSourceSeriesBlocked',
      issues: [{ kind: 'exactActionStageRequired' }],
    })

    const years = copy(projected)
    expect(years[0]!.retirementActionExecution).toBeDefined()
    delete years[0]!.retirementActionExecution

    expect(validateOwnedNonRothIraRuntimeSourceSeries(plan, TAX_YEAR, years))
      .toMatchObject({
        status: 'ownedNonRothIraRuntimeSourceSeriesBlocked',
        issues: [{ kind: 'exactActionStageRequired' }],
      })
  })

  it('snapshots each post-growth balance scalar once before validation and emission', () => {
    const plan = singlePersonPlan({ planningAge: 60 })
    plan.id = 'post-growth-scalar-snapshot'
    plan.accounts = [traditional('ira', 100_000)]
    const years = copy(project(plan))
    const rawBalance = years[0]!.ownedNonRothIraPostGrowthSource!
      .ownerPools[0]!.accountBalances[0]!
    let reads = 0
    Object.defineProperty(rawBalance, 'balancePlanDollars', {
      enumerable: true,
      get: () => {
        reads += 1
        return reads === 1 ? years[0]!.balances.ira! : 101_000
      },
    })

    const result = validateOwnedNonRothIraRuntimeSourceSeries(plan, TAX_YEAR, years)

    expect(result.status).toBe('ownedNonRothIraRuntimeSourceSeriesComplete')
    if (result.status !== 'ownedNonRothIraRuntimeSourceSeriesComplete') return
    expect(reads).toBe(1)
    expect(result.years[0]!.ownerSources[0]!.yearEndBalances[0])
      .toMatchObject({ balancePlanDollars: 100_000, balanceAmount: 10_000_000 })
  })

  it('blocks QCD allocation and annuity pool escape in the source layer', () => {
    const qcdPlan = singlePersonPlan({ dob: '1950-01-01', planningAge: 76 })
    qcdPlan.id = 'source-qcd'
    qcdPlan.accounts = [traditional('ira', 100_000)]
    qcdPlan.strategies.qcdAnnual = 1_000
    expect(validateOwnedNonRothIraRuntimeSourceSeries(qcdPlan, TAX_YEAR, project(qcdPlan)))
      .toMatchObject({ status: 'ownedNonRothIraRuntimeSourceSeriesBlocked', issues: [{ kind: 'qcdStageRequired' }] })

    const annuityPlan = singlePersonPlan({ planningAge: 60 })
    annuityPlan.id = 'source-annuity'
    annuityPlan.accounts = [
      traditional('ira', 20_000),
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
    expect(validateOwnedNonRothIraRuntimeSourceSeries(annuityPlan, TAX_YEAR, project(annuityPlan)))
      .toMatchObject({ status: 'ownedNonRothIraRuntimeSourceSeriesBlocked', issues: [{ kind: 'annuityStageRequired' }] })

    const missingAnnuitySources = copy(project(annuityPlan))
    ;(missingAnnuitySources[0]!.retirementRuntimeSource!.runtimeOccurrences as unknown as unknown[])
      .splice(0)
    ;(missingAnnuitySources[0]!.retirementRuntimeApplicationSource!.applications as unknown as unknown[])
      .splice(0)
    expect(validateOwnedNonRothIraRuntimeSourceSeries(
      annuityPlan, TAX_YEAR, missingAnnuitySources,
    )).toMatchObject({
      status: 'ownedNonRothIraRuntimeSourceSeriesBlocked',
      issues: [{ kind: 'annuityStageRequired' }],
    })
  })

  it('fails closed without rereading hostile rejected year input', () => {
    const plan = singlePersonPlan({ planningAge: 60 })
    const hostileYear = Object.defineProperty({}, 'year', {
      enumerable: true,
      get(): never { throw new Error('hostile year getter') },
    }) as Readonly<YearResult>

    const result = validateOwnedNonRothIraRuntimeSourceSeries(plan, TAX_YEAR, [hostileYear])

    expect(result).toMatchObject({
      status: 'ownedNonRothIraRuntimeSourceSeriesBlocked',
      endTaxYear: null,
      years: null,
      issues: [{ kind: 'sourceSeriesConstructionInvalid' }],
    })
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.issues)).toBe(true)
    expect(Object.isFrozen(result.issues[0])).toBe(true)
  })
})
