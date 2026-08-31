import { describe, expect, it } from 'vitest'
import type { AnnualRetirementRuntimeInventoryRecord } from '../actions/annualRetirementPhysicalEventInventory.js'
import { asPlanId } from '../actions/identity.js'
import { planDollarsToLedgerCents } from '../actions/planBalanceAdapter.js'
import type { Account, Plan } from '../model/plan.js'
import { singlePersonPlan, traditionalAccount, validatePlan } from '../testing/planFixtures.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import {
  beginSimulatorAnnualRetirementRuntimeJournal,
  recordSimulatorAnnualRetirementRuntimeOccurrence,
  sealSimulatorAnnualRetirementRuntimeJournal,
} from './annualRetirementRuntimeJournal.js'
import { simulatePlan } from './simulate.js'
import type { YearResult } from './types.js'

const TAX_YEAR = 2026
const noTax = createFlatTaxCalculator(0)

function runOneYear(plan: Plan): YearResult {
  return simulatePlan(validatePlan(plan), {
    startYear: TAX_YEAR,
    horizonEndYear: TAX_YEAR,
    taxCalculator: noTax,
  }).years[0]!
}

function records(year: YearResult): readonly Readonly<AnnualRetirementRuntimeInventoryRecord>[] {
  const source = year.retirementRuntimeSource
  if (source === undefined) throw new Error('expected simulator runtime source')
  let journal = beginSimulatorAnnualRetirementRuntimeJournal({
    planId: asPlanId(source.planId),
    taxYear: source.taxYear,
    ledgerRunId: `test-runtime-replay:${source.planId}:${source.taxYear}`,
  })
  for (const occurrence of source.runtimeOccurrences) {
    journal = recordSimulatorAnnualRetirementRuntimeOccurrence(journal, occurrence)
  }
  const sealed = sealSimulatorAnnualRetirementRuntimeJournal(journal)
  if (sealed.status !== 'runtimeJournalSealed') {
    throw new Error(`runtime source blocked: ${JSON.stringify(sealed.issues)}`)
  }
  return sealed.runtimeRecords
}

function recordsOfKind(
  year: YearResult,
  kind: AnnualRetirementRuntimeInventoryRecord['kind'],
) {
  return records(year).filter((record) => record.kind === kind)
}

function grossCents(
  selected: readonly Readonly<AnnualRetirementRuntimeInventoryRecord>[],
): number {
  return selected.reduce(
    (total, record) => total +
      (record.recordStatus === 'resolved'
        ? record.grossAmount
        : record.knownGrossAmount),
    0,
  )
}

function rothAccount(id: string, balance = 0): Extract<Account, { type: 'roth' }> {
  return {
    type: 'roth',
    id,
    name: id,
    ownerPersonId: 'p1',
    annualReturnPct: 0,
    kind: 'ira',
    balance,
    annualContribution: 0,
  }
}

function traditionalSource(
  id: string,
  balance: number,
  ownerPersonId = 'p1',
  kind: 'ira' | 'employer' = 'ira',
): Extract<Account, { type: 'traditional' }> {
  const account = traditionalAccount(id, balance, ownerPersonId, kind)
  if (account.type !== 'traditional') throw new Error('expected traditional account')
  return account
}

describe('simulate annual retirement runtime source capture', () => {
  it('seals an explicit-empty source for a year without retirement movement', () => {
    const plan = singlePersonPlan({ planningAge: 60 })
    plan.id = 'runtime-source-empty'
    const year = runOneYear(plan)

    expect(year.retirementRuntimeSource).toMatchObject({
      status: 'runtimeOccurrenceSourcesCaptured',
      captureBoundary: 'legacyAnnualPassCommittedBeforeYearResultPublication',
      journalValidation: 'notRun',
      taxYear: TAX_YEAR,
      runtimeOccurrences: [],
      nonmovingLegacyQcdOverlay: null,
    })
    expect(Object.keys(year)).toContain('retirementRuntimeSource')
    expect(Object.isFrozen(year.retirementRuntimeSource)).toBe(true)
  })

  it('captures each actual owned-IRA and employer-plan RMD exactly once', () => {
    const plan = singlePersonPlan({ dob: '1953-01-01', planningAge: 73 })
    plan.id = 'runtime-source-rmd'
    plan.accounts = [
      traditionalSource('owned-ira', 265_000),
      traditionalSource('employer-plan', 132_500, 'p1', 'employer'),
    ]
    const year = runOneYear(plan)
    const owned = recordsOfKind(year, 'ownedIraRmd')
    const employer = recordsOfKind(year, 'employerPlanRmd')

    expect(owned).toHaveLength(1)
    expect(employer).toHaveLength(1)
    expect(grossCents([...owned, ...employer])).toBe(planDollarsToLedgerCents(year.rmd))
  })

  it('captures SEPP, legacy withdrawals, and conversion source debits once', () => {
    const seppPlan = singlePersonPlan({ dob: '1970-01-01', planningAge: 60 })
    seppPlan.accounts = [{
      ...traditionalSource('sepp-ira', 500_000),
      sepp: { startAge: 56, method: 'rmd' },
    }]
    const seppYear = runOneYear(seppPlan)
    expect(recordsOfKind(seppYear, 'automaticSeppDistribution')).toHaveLength(1)
    expect(grossCents(recordsOfKind(seppYear, 'automaticSeppDistribution'))).toBe(
      planDollarsToLedgerCents(seppYear.sepp),
    )

    const withdrawalPlan = singlePersonPlan({ dob: '1966-01-01', planningAge: 60 })
    withdrawalPlan.accounts = [traditionalSource('withdrawal-ira', 100_000)]
    withdrawalPlan.expenses.baseAnnual = 12_000
    const withdrawalYear = runOneYear(withdrawalPlan)
    expect(recordsOfKind(withdrawalYear, 'legacyNeedBasedWithdrawal')).toHaveLength(1)
    expect(grossCents(recordsOfKind(withdrawalYear, 'legacyNeedBasedWithdrawal'))).toBe(
      planDollarsToLedgerCents(withdrawalYear.withdrawals.traditional),
    )

    const conversionPlan = singlePersonPlan({ dob: '1966-01-01', planningAge: 60 })
    conversionPlan.accounts = [traditionalSource('conversion-ira', 100_000), rothAccount('roth-destination')]
    conversionPlan.strategies.rothConversion = {
      mode: 'manual',
      conversions: [{ year: TAX_YEAR, amount: 20_000 }],
    }
    const conversionYear = runOneYear(conversionPlan)
    expect(recordsOfKind(conversionYear, 'legacyRothConversion')).toHaveLength(1)
    expect(grossCents(recordsOfKind(conversionYear, 'legacyRothConversion'))).toBe(
      planDollarsToLedgerCents(conversionYear.rothConversion),
    )
  })

  it('captures post-limit employee contributions and employer match exactly', () => {
    const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 60 })
    plan.incomes = [{
      type: 'wages', id: 'wages', personId: 'p1', annualGross: 100_000,
      endAge: null, realGrowthPct: 0,
    }]
    plan.accounts = [
      { ...traditionalSource('owned-ira', 0), annualContribution: 5_000 },
      {
        ...traditionalSource('employer-plan', 0, 'p1', 'employer'),
        annualContribution: 10_000,
        employerMatch: { matchPct: 100, capPctOfPay: 4 },
      },
    ]
    const year = runOneYear(plan)
    const employee = [
      ...recordsOfKind(year, 'ownedIraContribution'),
      ...recordsOfKind(year, 'employerPlanEmployeeContribution'),
    ]

    expect(employee).toHaveLength(2)
    expect(grossCents(employee)).toBe(planDollarsToLedgerCents(year.contributions))
    expect(recordsOfKind(year, 'employerPlanEmployerMatch')).toHaveLength(1)
    expect(grossCents(recordsOfKind(year, 'employerPlanEmployerMatch'))).toBe(
      planDollarsToLedgerCents(year.employerMatch),
    )
  })

  it('does not mislabel Roth contributions as traditional source movement', () => {
    const plan = singlePersonPlan({ planningAge: 60 })
    plan.incomes = [{
      type: 'wages', id: 'wages', personId: 'p1', annualGross: 100_000,
      endAge: null, realGrowthPct: 0,
    }]
    plan.accounts = [{ ...rothAccount('roth-ira'), annualContribution: 5_000 }]
    const year = runOneYear(plan)

    expect(year.contributions).toBe(5_000)
    expect(records(year)).toEqual([])
  })

  it('preserves missing account ownership instead of inventing the primary owner', () => {
    const plan = singlePersonPlan({ planningAge: 60 })
    plan.incomes = [{
      type: 'wages', id: 'wages', personId: 'p1', annualGross: 100_000,
      endAge: null, realGrowthPct: 0,
    }]
    plan.accounts = [{
      ...traditionalSource('legacy-unowned-ira', 0),
      ownerPersonId: null,
      annualContribution: 5_000,
    }]
    const year = simulatePlan(plan, {
      startYear: TAX_YEAR,
      horizonEndYear: TAX_YEAR,
      taxCalculator: noTax,
    }).years[0]!
    const occurrence = year.retirementRuntimeSource?.runtimeOccurrences.find(
      (candidate) => candidate.kind === 'ownedIraContribution',
    )

    expect(year.contributions).toBe(5_000)
    expect(occurrence?.ownerPersonId).toBeNull()
    expect(recordsOfKind(year, 'ownedIraContribution')).toEqual([
      expect.objectContaining({
        recordStatus: 'unresolved',
        ownerPersonId: null,
        incompatibility: 'legacyAggregateIdentityUnavailable',
      }),
    ])
  })

  it.each(['sep', 'simple'] as const)(
    'does not invent a %s employer contribution from eligibility facts',
    (subtype) => {
      const plan = singlePersonPlan({ planningAge: 60 })
      plan.incomes = [{
        type: 'wages', id: 'wages', personId: 'p1', annualGross: 100_000,
        endAge: null, realGrowthPct: 0,
      }]
      plan.accounts = [{
        ...traditionalSource(`${subtype}-ira`, 0),
        annualContribution: 5_000,
      }]
      plan.retirementActionEligibilityFacts = {
        iraClassifications: [{
          sourceAccountId: `${subtype}-ira`,
          subtype,
          evidenceId: `${subtype}-classification`,
          provenance: { source: 'manual' },
        }],
        sepSimpleActivities: [{
          sourceAccountId: `${subtype}-ira`,
          actionTaxYear: TAX_YEAR,
          planYearEndDate: `${TAX_YEAR}-12-31`,
          employerContributionMadeForPlanYear: true,
          evidenceId: `${subtype}-activity`,
          provenance: { source: 'manual' },
        }],
        deductibleIraContributions: [],
      }
      const year = runOneYear(plan)

      expect(grossCents(recordsOfKind(year, 'ownedIraContribution'))).toBe(500_000)
      expect(recordsOfKind(year, 'ownedIraEmployerContribution')).toEqual([])
    },
  )

  it('captures an inherited distribution exactly once', () => {
    const plan = singlePersonPlan({ dob: '1953-01-01', planningAge: 73 })
    plan.accounts = [{
      ...traditionalSource('inherited-ira', 100_000),
      inherited: { ownerDeathYear: 2024, decedentHadStartedRmds: true },
    }]
    const year = runOneYear(plan)

    expect(recordsOfKind(year, 'inheritedIraRmd')).toHaveLength(1)
    expect(grossCents(recordsOfKind(year, 'inheritedIraRmd'))).toBe(
      planDollarsToLedgerCents(year.inheritedDistribution),
    )
  })

  it('keeps QCD as a non-additive overlay on the existing RMD debit', () => {
    const plan = singlePersonPlan({ dob: '1953-01-01', planningAge: 73 })
    plan.accounts = [traditionalSource('owned-ira', 265_000)]
    plan.strategies.qcdAnnual = 5_000
    const year = runOneYear(plan)

    expect(year.rmd).toBe(10_000)
    expect(year.qcd).toBe(5_000)
    expect(records(year)).toHaveLength(1)
    expect(grossCents(records(year))).toBe(1_000_000)
    expect(recordsOfKind(year, 'legacyQcd')).toEqual([])
    expect(year.retirementRuntimeSource?.nonmovingLegacyQcdOverlay).toEqual({
      status: 'nonmovingLegacyQcdCaptured',
      kind: 'legacyQcd',
      taxYear: TAX_YEAR,
      grossAmountPlanDollars: 5_000,
      // No single owner or source account, because a household gift has
      // neither -- but the 408(d)(8)(D) attribution the annual ledger settled
      // travels with it, which is what lets the replay characterize the year
      // instead of refusing it. The whole gift qualified here: this IRA holds
      // no basis, so the owner's aggregate includible amount is the balance.
      ownerAttributions: [{
        ownerPersonId: 'p1',
        routedGrossPlanDollars: 5_000,
        qualifiedLine7ExclusionPlanDollars: 5_000,
      }],
      physicalMovement: 'notAdditionalMovement',
      inventoryReplay: 'attributedToOwnedIraRequiredDistributionGrosses',
    })
  })

  it('captures distinct traditional transfer producers and keeps owned-IRA provenance truthful', () => {
    const plan = singlePersonPlan({ planningAge: 60 })
    plan.incomes = [{
      type: 'wages', id: 'wages', personId: 'p1', annualGross: 100_000,
      endAge: null, realGrowthPct: 0,
    }]
    plan.accounts = [
      { ...traditionalSource('owned-ira', 0), annualContribution: 5_000 },
      traditionalSource('annuity-source', 50_000),
      {
        type: 'annuity', id: 'qualified-annuity', name: 'Qualified annuity',
        ownerPersonId: 'p1', annualReturnPct: null, startAge: 60,
        monthlyAmount: 0, colaPct: 0, taxablePct: 100,
        purchase: {
          year: TAX_YEAR, premium: 10_000, fundingAccountId: 'annuity-source',
          taxQualification: 'qualified',
        },
      },
      traditionalSource('rollover-target', 0),
      {
        type: 'pension', id: 'pension', name: 'Pension', ownerPersonId: 'p1',
        annualReturnPct: null, startAge: 60, monthlyAmount: 0, colaPct: 0,
        survivorPct: 0,
        lumpSumOffer: { amount: 20_000, electionYear: TAX_YEAR },
        lumpSumElection: { rolloverAccountId: 'rollover-target' },
      },
    ]
    const year = runOneYear(plan)

    expect(grossCents(recordsOfKind(year, 'ownedIraContribution'))).toBe(500_000)
    expect(recordsOfKind(year, 'ownedIraEmployerContribution')).toEqual([])
    expect(grossCents(recordsOfKind(year, 'annuityFundingTransfer'))).toBe(1_000_000)
    expect(grossCents(recordsOfKind(year, 'rolloverInflow'))).toBe(2_000_000)
  })

  it('keeps unknown chronology and authority unresolved and canonicalizes account order', () => {
    const firstPlan = singlePersonPlan({ dob: '1953-01-01', planningAge: 73 })
    firstPlan.accounts = [
      traditionalSource('ira-b', 132_500),
      traditionalSource('ira-a', 265_000),
    ]
    const secondPlan = structuredClone(firstPlan)
    secondPlan.accounts.reverse()
    const first = runOneYear(firstPlan)
    const second = runOneYear(secondPlan)

    expect(JSON.stringify(first.retirementRuntimeSource)).toBe(
      JSON.stringify(second.retirementRuntimeSource),
    )
    expect(records(first)).toEqual(records(second))
    expect(records(first)).toHaveLength(2)
    for (const record of records(first)) {
      expect(record).toMatchObject({
        recordStatus: 'unresolved',
        ownerPersonId: null,
        sourceAccountId: null,
        executionDate: null,
        executionSequence: null,
        incompatibility: 'executionChronologyUnavailable',
      })
    }
  })
})
