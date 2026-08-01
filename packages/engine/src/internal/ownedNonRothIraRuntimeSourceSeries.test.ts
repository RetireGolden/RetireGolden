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

  it('reconciles large multi-account totals in simulator Plan order', () => {
    const plan = singlePersonPlan({ dob: '1950-01-01', planningAge: 76 })
    plan.id = 'large-plan-order-total'
    plan.accounts = Array.from({ length: 20 }, (_, index) =>
      traditional(`ira-${String(20 - index).padStart(2, '0')}`, 40_000_000_000_000))

    expect(validateOwnedNonRothIraRuntimeSourceSeries(
      plan, TAX_YEAR, project(plan),
    )).toMatchObject({ status: 'ownedNonRothIraRuntimeSourceSeriesComplete' })
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
