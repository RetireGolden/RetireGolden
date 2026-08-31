/**
 * Stage 4 transfer, lineage, and tax-character capture through `simulatePlan`.
 *
 * Amounts come from existing action-execution oracles and independent
 * worksheets (RMD divisor, employer-match formula, purchase basis ratio),
 * never from reading the assembler. Conversion principal is never income or
 * household cash. Feature-off is covered by `simulate.annualCashFlow.captureOff.test.ts`.
 */
import { describe, expect, it } from 'vitest'

import { parseRetirementActionRequest } from '../actions/index.js'
import { asAccountId, asActionId, asAllocationId, asPersonId } from '../actions/identity.js'
import { asPositiveUsdCents, asUsdCents } from '../actions/money.js'
import type { QualifiedCharitableDistributionRequest } from '../actions/contract.js'
import { parsePlan, type Account, type Plan } from '../model/plan.js'
import { packForYear } from '../params/index.js'
import { describeRule } from '../rules/describeRule.js'
import {
  cashAccount,
  singlePersonPlan,
  taxableAccount,
  traditionalAccount,
} from '../testing/planFixtures.js'
import { expectMoney } from '../testing/money.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { simulatePlan } from './simulate.js'
import type { YearCashFlowTransferLine, YearResult } from './types.js'

const noTax = createFlatTaxCalculator(0)
const START_YEAR = 2026

function validate(plan: Plan): Plan {
  const result = parsePlan(plan)
  if (!result.ok) throw new Error(result.issues.join('; '))
  return result.plan
}

function run(plan: Plan, extra: { horizonEndYear?: number } = {}): YearResult[] {
  return simulatePlan(validate(plan), {
    startYear: START_YEAR,
    taxCalculator: noTax,
    captureAnnualCashFlow: true,
    ...extra,
  }).years
}

function yearOf(years: readonly YearResult[], calendarYear: number): YearResult {
  const year = years.find((row) => row.year === calendarYear)
  if (year === undefined) throw new Error(`missing year ${calendarYear}`)
  return year
}

function transferById(year: YearResult, id: string): YearCashFlowTransferLine {
  const line = year.cashFlow?.transferLines.find((row) => row.id === id)
  if (line === undefined) throw new Error(`missing transfer line ${id}`)
  return line
}

function rothIra(id: string, balance = 0): Account {
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

function namedConversionRequest() {
  const parsed = parseRetirementActionRequest({
    actionId: 'named-conversion',
    kind: 'rothConversion',
    personId: 'p1',
    year: START_YEAR,
    executionDate: '2026-06-15',
    executionSequence: 1,
    requestedAmount: 10_000_00,
    allocations: [{
      allocationId: 'named-conversion-allocation',
      sourceAccountId: 'ira-a',
      requestedAmount: 10_000_00,
    }],
    destinationRothAccountId: 'roth-second',
    taxFunding: { kind: 'noneExpected' },
    provenance: { source: 'manual' },
  })
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.request
}

function namedQcd(): QualifiedCharitableDistributionRequest {
  const amount = asPositiveUsdCents(20_000 * 100)
  return {
    actionId: asActionId('qcd-action'),
    kind: 'qcd',
    year: START_YEAR,
    executionDate: `${START_YEAR}-08-01`,
    executionSequence: 1,
    requestedAmount: amount,
    provenance: { source: 'manual' },
    donorPersonId: asPersonId('p1'),
    allocation: {
      allocationId: asAllocationId('qcd-allocation'),
      sourceAccountId: asAccountId('ira'),
      requestedAmount: amount,
    },
    charity: {
      designationId: 'charity-1',
      name: 'Public charity',
      designationKind: 'eligiblePublicCharity',
      directFromCustodianAttested: true,
      eligibleOrganizationAttested: true,
      notDonorAdvisedFundOrSupportingOrganizationAttested: true,
      notSplitInterestEntityAttested: true,
      entireDistributionOtherwiseDeductibleAttested: true,
    },
  }
}

describe('simulatePlan annual cash-flow transfers', () => {
  it('publishes a named Roth conversion with debit = credit and taxable character, never as income or cash', () => {
    // Independent worksheet / namedRothConversionCommit oracle, year 2026, 0% tax:
    //   traditional IRA 100,000 (zero basis) → named conversion 10,000 to roth-second.
    //   Executor evidence: executedAmount 10,000.00, taxable 10,000.00, nontaxable 0.
    //   Principal is a transfer, not a spendable source and not incomes.total.
    const plan = singlePersonPlan({ planningAge: 60, dob: '1970-01-01' })
    plan.accounts = [
      cashAccount('cash-a', 1_000_000),
      traditionalAccount('ira-a', 100_000, 'p1', 'ira'),
      rothIra('roth-first'),
      rothIra('roth-second'),
    ]
    plan.retirementActionEligibilityFacts = {
      iraClassifications: [{
        evidenceId: 'ira-a-classification',
        provenance: { source: 'manual' },
        sourceAccountId: 'ira-a',
        subtype: 'traditional',
      }],
      sepSimpleActivities: [],
      deductibleIraContributions: [],
    }
    plan.strategies.retirementActions = [namedConversionRequest()]
    const y2026 = yearOf(run(plan, { horizonEndYear: 2026 }), START_YEAR)

    const line = transferById(
      y2026,
      'transfer:namedRothConversion:named-conversion:named-conversion-allocation',
    )
    expect(line.kind).toBe('namedRothConversion')
    expectMoney(line.debitPlanDollars, 10_000)
    expectMoney(line.creditPlanDollars, 10_000)
    expect(line.source).toEqual({ entityKind: 'account', accountId: 'ira-a' })
    expect(line.destination).toEqual({ entityKind: 'account', accountId: 'roth-second' })
    expect(line.taxCharacter).toEqual([
      { kind: 'ordinaryIncome', amountPlanDollars: 10_000 },
    ])
    expect(y2026.cashFlow!.sourceLines.some((row) => row.kind === 'namedRothConversion' as string)).toBe(false)
    expect(y2026.cashFlow!.sourceLines.every((row) =>
      row.kind !== 'needBasedPortfolioWithdrawal' || row.amountPlanDollars !== 10_000 ||
      !row.identities.some((id) => id.entityKind === 'account' && id.accountId === 'ira-a'),
    )).toBe(true)
    expectMoney(y2026.rothConversion, 10_000)
    expect(y2026.incomes.total).toBeLessThan(10_000)
    expect(y2026.cashFlow!.reconciliation.status).toBe('reconciled')
  })

  it('publishes an aggregate Roth conversion on a separate ID from named conversions', () => {
    // Independent worksheet, year 2026, 0% tax, 0% spending:
    //   traditional IRA 50,000 (zero basis) + Roth IRA 0.
    //   aggregate manual conversion 10,000. Named requests are absent so the
    //   aggregate arm runs. Debit ira-1, credit roth-1, ordinary 10,000.
    const plan = singlePersonPlan({ dob: '1970-01-01', planningAge: 70, retirementAge: null })
    plan.accounts = [
      cashAccount('cash-1', 0),
      traditionalAccount('ira-1', 50_000, 'p1', 'ira'),
      rothIra('roth-1'),
    ]
    plan.strategies.rothConversion = { mode: 'manual', conversions: [{ year: 2026, amount: 10_000 }] }
    const y2026 = yearOf(run(plan, { horizonEndYear: 2026 }), START_YEAR)

    const line = transferById(y2026, 'transfer:aggregateRothConversion:ira-1:roth-1')
    expect(line.kind).toBe('aggregateRothConversion')
    expectMoney(line.debitPlanDollars, 10_000)
    expectMoney(line.creditPlanDollars, 10_000)
    expect(line.source).toEqual({ entityKind: 'account', accountId: 'ira-1' })
    expect(line.destination).toEqual({ entityKind: 'account', accountId: 'roth-1' })
    expect(line.taxCharacter).toEqual([
      { kind: 'ordinaryIncome', amountPlanDollars: 10_000 },
    ])
    expect(y2026.cashFlow!.transferLines.some((row) => row.kind === 'namedRothConversion')).toBe(false)
    expect(y2026.cashFlow!.sourceLines.some((row) =>
      row.identities.some((id) => id.entityKind === 'account' && id.accountId === 'ira-1') &&
      row.role === 'spendableSource',
    )).toBe(false)
    expectMoney(y2026.rothConversion, 10_000)
    expect(y2026.cashFlow!.reconciliation.status).toBe('reconciled')
  })

  it('points an RMD-diverted QCD at the published zero-net owner RMD line', () => {
    // Independent worksheet, year 2026, 0% inflation, $0 tax, $0 spending:
    //   p1 born 1950-01-01 → attained 76. Uniform Lifetime divisor 23.7 (Pub 590-B).
    //   IRA opening 237,000 → RMD = 237,000 / 23.7 = 10,000.
    //   qcdAnnual 10,000 → entire RMD diverted; net owned-IRA RMD published at $0.
    //   QCD transfer 10,000, divertedBeforeHouseholdCash → that zero-net line.
    const plan = singlePersonPlan({ dob: '1950-01-01', planningAge: 90, retirementAge: null })
    plan.accounts = [
      cashAccount('cash-1', 0),
      traditionalAccount('ira-1', 237_000, 'p1', 'ira'),
    ]
    plan.strategies.qcdAnnual = 10_000
    const y2026 = yearOf(run(plan, { horizonEndYear: 2026 }), START_YEAR)

    const rmd = y2026.cashFlow!.sourceLines.find(
      (line) => line.id === 'source:requiredMinimumDistribution:ownedIraPool:p1',
    )
    expect(rmd).toBeDefined()
    expectMoney(rmd!.amountPlanDollars, 0)
    expect(rmd!.identities).toEqual([
      { entityKind: 'requiredDistributionPool', personId: 'p1' },
    ])

    const qcd = transferById(y2026, 'transfer:qualifiedCharitableDistribution:rmd:p1')
    expect(qcd.kind).toBe('qualifiedCharitableDistribution')
    expectMoney(qcd.debitPlanDollars, 10_000)
    expectMoney(qcd.creditPlanDollars, 10_000)
    expect(qcd.source).toEqual({ entityKind: 'requiredDistributionPool', personId: 'p1' })
    expect(qcd.destination).toEqual({ entityKind: 'charity' })
    expect(qcd.lineage).toEqual([
      {
        lineId: 'source:requiredMinimumDistribution:ownedIraPool:p1',
        relationship: 'divertedBeforeHouseholdCash',
      },
    ])
    expect(qcd.taxCharacter).toEqual([
      { kind: 'qcdIncomeExclusion', amountPlanDollars: 10_000 },
    ])
    expectMoney(y2026.qcd, 10_000)
    expect(y2026.cashFlow!.reconciliation.status).toBe('reconciled')
  })

  it('publishes a beyond-RMD QCD with no cash-view source', () => {
    // Independent worksheet, same 76 / 23.7 as the zero-net case:
    //   IRA 237,000 → RMD 10,000. qcdAnnual 15,000.
    //   from-RMD 10,000 (diverted); beyond-RMD 5,000 never entered baseCashInflows.
    const plan = singlePersonPlan({ dob: '1950-01-01', planningAge: 90, retirementAge: null })
    plan.accounts = [
      cashAccount('cash-1', 0),
      traditionalAccount('ira-1', 237_000, 'p1', 'ira'),
    ]
    plan.strategies.qcdAnnual = 15_000
    const y2026 = yearOf(run(plan, { horizonEndYear: 2026 }), START_YEAR)

    const beyond = transferById(
      y2026,
      'transfer:qualifiedCharitableDistribution:beyondRmd:p1:ira-1',
    )
    expect(beyond.kind).toBe('qualifiedCharitableDistribution')
    expectMoney(beyond.debitPlanDollars, 5_000)
    expectMoney(beyond.creditPlanDollars, 5_000)
    expect(beyond.source).toEqual({ entityKind: 'account', accountId: 'ira-1' })
    expect(beyond.destination).toEqual({ entityKind: 'charity' })
    expect(beyond.lineage).toBeUndefined()
    expect(y2026.cashFlow!.sourceLines.some((line) =>
      line.kind === 'qualifiedCharitableDistribution' as string,
    )).toBe(false)
    expectMoney(y2026.qcd, 15_000)
    expect(y2026.cashFlow!.reconciliation.status).toBe('reconciled')
  })

  it('publishes aggregate QCD character after the §219 offset, not the pre-offset qualified amount', () => {
    // Independent worksheet, year 2026, 0% inflation, $0 tax, $0 spending:
    //   p1 born 1950-01-01 → attained 76. Uniform Lifetime divisor 23.7 (Pub 590-B).
    //   IRA opening 118,500 → RMD = 118,500 / 23.7 = 5,000.
    //   qcdAnnual 10,000; no basis; post-70½ deductible §219 = 8,000 (tax year 2025).
    //   (D) qualified = min(10,000, 118,500) = 10,000.
    //   408(d)(8)(A) second sentence: exclusion = max(0, 10,000 − 8,000) = 2,000.
    //   Leftover ordinary 8,000: 3,000 of the RMD diversion + 5,000 beyond-RMD.
    const plan = singlePersonPlan({ dob: '1950-01-01', planningAge: 90, retirementAge: null })
    plan.accounts = [
      cashAccount('cash-1', 0),
      traditionalAccount('ira-1', 118_500, 'p1', 'ira'),
    ]
    plan.strategies.qcdAnnual = 10_000
    plan.retirementActionEligibilityFacts = {
      iraClassifications: [{
        sourceAccountId: 'ira-1',
        subtype: 'traditional',
        evidenceId: 'classification-ira-1',
        provenance: { source: 'manual' },
      }],
      sepSimpleActivities: [],
      deductibleIraContributions: [{
        donorPersonId: 'p1',
        taxYear: 2025,
        amountCents: asUsdCents(8_000 * 100),
        evidenceId: 'section219-2025',
        provenance: { source: 'manual', sourceId: 'ledger-2025' },
      }],
    }
    const y2026 = yearOf(run(plan, { horizonEndYear: 2026 }), START_YEAR)

    const rmdQcd = transferById(y2026, 'transfer:qualifiedCharitableDistribution:rmd:p1')
    expect(rmdQcd.taxCharacter).toEqual([
      { kind: 'qcdIncomeExclusion', amountPlanDollars: 2_000 },
      { kind: 'nonQualifiedQcdOrdinaryIncome', amountPlanDollars: 3_000 },
    ])
    const beyond = transferById(
      y2026,
      'transfer:qualifiedCharitableDistribution:beyondRmd:p1:ira-1',
    )
    expect(beyond.taxCharacter).toEqual([
      { kind: 'nonQualifiedQcdOrdinaryIncome', amountPlanDollars: 5_000 },
    ])
    const exclusion = y2026.cashFlow!.transferLines
      .flatMap((line) => line.taxCharacter ?? [])
      .filter((part) => part.kind === 'qcdIncomeExclusion')
      .reduce((sum, part) => sum + part.amountPlanDollars, 0)
    const ordinary = y2026.cashFlow!.transferLines
      .flatMap((line) => line.taxCharacter ?? [])
      .filter((part) => part.kind === 'nonQualifiedQcdOrdinaryIncome')
      .reduce((sum, part) => sum + part.amountPlanDollars, 0)
    expectMoney(exclusion, 2_000)
    expectMoney(ordinary, 8_000)
    expect(y2026.cashFlow!.reconciliation.status).toBe('reconciled')
  })

  it('charges a two-draw beyond-RMD QCD excess onto the earliest account, matching the Form 8606 walk', () => {
    // Independent worksheet, year 2026, 0% inflation, 0% growth, $0 tax:
    //   p1 born 1955-01-01 → attained 71, before SECURE 2.0 RMD age 73. RMD 0.
    //   Two owned IRAs, $5,000 each, no basis. qcdAnnual 10,000.
    //   Drain order is plan-account order: ira-1 then ira-2; two $5,000 draws.
    //   (D) qualified = min(10,000, 10,000) = 10,000. Statutory excess 0.
    //   Post-70½ deductible §219 = 4,000 (tax year 2025).
    //   408(d)(8)(A) exclusion = max(0, 10,000 − 4,000) = 6,000.
    //   Leftover ordinary 4,000 is the owner's "excess" on this gift.
    //   Form 8606 walk / leftover charge in mutation order:
    //     ira-1 = $4,000 ordinary + $1,000 exclusion
    //     ira-2 = $5,000 exclusion
    const plan = singlePersonPlan({ dob: '1955-01-01', planningAge: 90, retirementAge: null })
    plan.accounts = [
      cashAccount('cash-1', 0),
      traditionalAccount('ira-1', 5_000, 'p1', 'ira'),
      traditionalAccount('ira-2', 5_000, 'p1', 'ira'),
    ]
    plan.strategies.qcdAnnual = 10_000
    plan.retirementActionEligibilityFacts = {
      iraClassifications: [
        {
          sourceAccountId: 'ira-1',
          subtype: 'traditional',
          evidenceId: 'classification-ira-1',
          provenance: { source: 'manual' },
        },
        {
          sourceAccountId: 'ira-2',
          subtype: 'traditional',
          evidenceId: 'classification-ira-2',
          provenance: { source: 'manual' },
        },
      ],
      sepSimpleActivities: [],
      deductibleIraContributions: [{
        donorPersonId: 'p1',
        taxYear: 2025,
        amountCents: asUsdCents(4_000 * 100),
        evidenceId: 'section219-2025',
        provenance: { source: 'manual', sourceId: 'ledger-2025' },
      }],
    }
    const y2026 = yearOf(run(plan, { horizonEndYear: 2026 }), START_YEAR)

    const first = transferById(
      y2026,
      'transfer:qualifiedCharitableDistribution:beyondRmd:p1:ira-1',
    )
    const second = transferById(
      y2026,
      'transfer:qualifiedCharitableDistribution:beyondRmd:p1:ira-2',
    )
    expectMoney(first.debitPlanDollars, 5_000)
    expectMoney(second.debitPlanDollars, 5_000)
    expect(first.taxCharacter).toEqual([
      { kind: 'qcdIncomeExclusion', amountPlanDollars: 1_000 },
      { kind: 'nonQualifiedQcdOrdinaryIncome', amountPlanDollars: 4_000 },
    ])
    expect(second.taxCharacter).toEqual([
      { kind: 'qcdIncomeExclusion', amountPlanDollars: 5_000 },
    ])
    expect(y2026.cashFlow!.reconciliation.status).toBe('reconciled')
  })

  it('places beyond-RMD QCD exclusion after Form 8606 excess on the earliest of two draws', () => {
    // Independent worksheet, year 2026, 0% inflation, 0% growth, $0 tax:
    //   p1 born 1955-01-01 → attained 71. RMD 0.
    //   Two owned IRAs, $5,000 each. Owner nondeductible basis 4,000 on ira-1.
    //   qcdAnnual 10,000. Drain order ira-1 then ira-2.
    //   (D) aggregate includible I = max(0, 10,000 − 4,000) = 6,000.
    //   Qualified Q = min(10,000, 6,000) = 6,000. Statutory excess 4,000.
    //   Residual denominator is the basis itself (fraction 1): excess is
    //   return of basis, not ordinary, and is unpublished on the transfer.
    //   Form 8606 walk in mutation order:
    //     ira-1 = $4,000 excess + $1,000 exclusion
    //     ira-2 = $5,000 exclusion
    const plan = singlePersonPlan({ dob: '1955-01-01', planningAge: 90, retirementAge: null })
    const ira1 = traditionalAccount('ira-1', 5_000, 'p1', 'ira') as Extract<Account, { type: 'traditional' }>
    ira1.nondeductibleBasis = 4_000
    plan.accounts = [
      cashAccount('cash-1', 0),
      ira1,
      traditionalAccount('ira-2', 5_000, 'p1', 'ira'),
    ]
    plan.strategies.qcdAnnual = 10_000
    const y2026 = yearOf(run(plan, { horizonEndYear: 2026 }), START_YEAR)

    const first = transferById(
      y2026,
      'transfer:qualifiedCharitableDistribution:beyondRmd:p1:ira-1',
    )
    const second = transferById(
      y2026,
      'transfer:qualifiedCharitableDistribution:beyondRmd:p1:ira-2',
    )
    expectMoney(first.debitPlanDollars, 5_000)
    expectMoney(second.debitPlanDollars, 5_000)
    expect(first.taxCharacter).toEqual([
      { kind: 'qcdIncomeExclusion', amountPlanDollars: 1_000 },
    ])
    expect(second.taxCharacter).toEqual([
      { kind: 'qcdIncomeExclusion', amountPlanDollars: 5_000 },
    ])
    expect(first.taxCharacter?.some((part) => part.kind === 'nonQualifiedQcdOrdinaryIncome')).toBe(false)
    expect(second.taxCharacter?.some((part) => part.kind === 'nonQualifiedQcdOrdinaryIncome')).toBe(false)
    expect(y2026.cashFlow!.reconciliation.status).toBe('reconciled')
  })

  it('publishes aggregate QCD ordinary character after the Form 8606 split, not the gross beyond-includible amount', () => {
    // Independent worksheet, year 2026, 0% inflation, 0% growth, $0 tax:
    //   p1 born 1955-01-01 → attained 71, before SECURE 2.0 RMD age 73. RMD 0.
    //   IRA 10,000 with nondeductible basis 4,000. qcdAnnual 10,000.
    //   (D) aggregate includible I = max(0, 10,000 − 4,000) = 6,000.
    //   Qualified QCD Q = min(10,000, 6,000) = 6,000.
    //   Gross beyond-includible 4,000 is Form 8606 line 7; residual denominator
    //   is the basis itself (fraction 1), so split.taxable = 0 (all basis recovery).
    const plan = singlePersonPlan({ dob: '1955-01-01', planningAge: 90, retirementAge: null })
    const ira = traditionalAccount('ira-1', 10_000, 'p1', 'ira') as Extract<Account, { type: 'traditional' }>
    ira.nondeductibleBasis = 4_000
    plan.accounts = [cashAccount('cash-1', 0), ira]
    plan.strategies.qcdAnnual = 10_000
    const y2026 = yearOf(run(plan, { horizonEndYear: 2026 }), START_YEAR)

    const beyond = transferById(
      y2026,
      'transfer:qualifiedCharitableDistribution:beyondRmd:p1:ira-1',
    )
    expectMoney(beyond.debitPlanDollars, 10_000)
    expect(beyond.taxCharacter).toEqual([
      { kind: 'qcdIncomeExclusion', amountPlanDollars: 6_000 },
    ])
    expect(beyond.taxCharacter?.some((part) => part.kind === 'nonQualifiedQcdOrdinaryIncome')).toBe(false)
    expect(y2026.cashFlow!.sourceLines.some((line) =>
      line.kind === 'requiredMinimumDistribution',
    )).toBe(false)
    expect(y2026.cashFlow!.reconciliation.status).toBe('reconciled')
  })

  it('carries Form 8606 taxable/basis on an RMD-diverted QCD that exceeds the eligible exclusion', () => {
    // Independent worksheet, year 2026, 0% inflation, 0% growth, $0 tax:
    //   p1 born 1950-01-01 → attained 76. Uniform Lifetime divisor 23.7.
    //   IRA 237,000 with nondeductible basis 230,000 → RMD 10,000.
    //   qcdAnnual 10,000 routes the entire RMD (zero-net source).
    //   (D) includible I = 237,000 − 230,000 = 7,000.
    //   Qualified Q = min(10,000, 7,000) = 7,000; from-RMD nonqualified = 3,000.
    //   Line-7 gross after the qualified carve = 3,000; residual denominator is
    //   the basis itself (fraction 1), so split.taxable = 0, split.nontaxable = 3,000.
    //   Exclusion 7,000; basis recovery lives on the QCD transfer, not the
    //   zero-net RMD source, and is never labeled nonQualifiedQcdOrdinaryIncome.
    const plan = singlePersonPlan({ dob: '1950-01-01', planningAge: 90, retirementAge: null })
    const ira = traditionalAccount('ira-1', 237_000, 'p1', 'ira') as Extract<Account, { type: 'traditional' }>
    ira.nondeductibleBasis = 230_000
    plan.accounts = [cashAccount('cash-1', 0), ira]
    plan.strategies.qcdAnnual = 10_000
    const y2026 = yearOf(run(plan, { horizonEndYear: 2026 }), START_YEAR)

    const qcd = transferById(y2026, 'transfer:qualifiedCharitableDistribution:rmd:p1')
    expectMoney(qcd.debitPlanDollars, 10_000)
    expect(qcd.taxCharacter).toEqual([
      { kind: 'qcdIncomeExclusion', amountPlanDollars: 7_000 },
      { kind: 'returnOfBasis', amountPlanDollars: 3_000 },
    ])
    expect(qcd.taxCharacter?.some((part) => part.kind === 'nonQualifiedQcdOrdinaryIncome')).toBe(false)

    const rmd = y2026.cashFlow!.sourceLines.find(
      (line) => line.id === 'source:requiredMinimumDistribution:ownedIraPool:p1',
    )
    expect(rmd).toBeDefined()
    expectMoney(rmd!.amountPlanDollars, 0)
    expect(rmd!.taxCharacter).toBeUndefined()
    expect(y2026.cashFlow!.reconciliation.status).toBe('reconciled')
  })

  it('marks every captured year notReconciled when distinct producer IDs encode to the same segment', () => {
    // Lone UTF-16 surrogate vs literal U+FFFD: encodeCashFlowSegment maps both
    // to %EF%BF%BD. Scheduled in different years, so intra-year duplicate
    // detection would miss them.
    const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 62 })
    plan.accounts = [cashAccount('cash-1', 0)]
    plan.incomes = [
      {
        type: 'oneTime',
        id: '\uD800',
        label: 'Surrogate',
        year: 2026,
        inflationAdjusted: false,
        amount: 1_000,
        taxTreatment: 'none',
      },
      {
        type: 'oneTime',
        id: '\uFFFD',
        label: 'Replacement',
        year: 2027,
        inflationAdjusted: false,
        amount: 2_000,
        taxTreatment: 'none',
      },
    ]
    const years = run(plan, { horizonEndYear: 2027 })
    const encoded = encodeURIComponent('\uFFFD')
    const y2026 = yearOf(years, 2026)
    const y2027 = yearOf(years, 2027)
    for (const year of [y2026, y2027]) {
      expect(year.cashFlow!.reconciliation.status).toBe('notReconciled')
      expect(year.cashFlow!.reconciliation.reasonCodes).toContain('duplicateLineId')
      expect(
        year.cashFlow!.reconciliation.diagnostics.filter((row) => row.reasonCode === 'duplicateLineId'),
      ).toEqual([
        { reasonCode: 'duplicateLineId', lineIds: [encoded] },
      ])
    }
  })

  it('carries the named QCD charity designationId from the action oracle', () => {
    // Independent worksheet / simulate.qcdNamedExecution oracle:
    //   donor born 1950-03-01, IRA 500,000, named gift 20,000, designationId charity-1.
    //   Named arm suppresses the aggregate QCD. Executed 20,000; excludable 20,000.
    const plan = singlePersonPlan({ dob: '1950-03-01', planningAge: 95, retirementAge: null })
    plan.accounts = [
      traditionalAccount('ira', 500_000, 'p1', 'ira'),
      cashAccount('cash', 200_000),
    ]
    const years: number[] = []
    for (let taxYear = 2020; taxYear <= START_YEAR; taxYear += 1) years.push(taxYear)
    plan.retirementActionEligibilityFacts = {
      iraClassifications: [{
        sourceAccountId: 'ira',
        subtype: 'traditional',
        evidenceId: 'classification-ira',
        provenance: { source: 'manual' },
      }],
      sepSimpleActivities: [],
      deductibleIraContributions: years.map((taxYear) => ({
        donorPersonId: 'p1',
        taxYear,
        amountCents: asUsdCents(0),
        evidenceId: `contribution-${taxYear}`,
        provenance: { source: 'manual', sourceId: `ledger-${taxYear}` },
      })),
    }
    plan.strategies.retirementActions = [namedQcd()]
    const y2026 = yearOf(run(plan, { horizonEndYear: 2026 }), START_YEAR)

    const line = transferById(
      y2026,
      'transfer:qualifiedCharitableDistribution:named:qcd-action:qcd-allocation',
    )
    expect(line.kind).toBe('qualifiedCharitableDistribution')
    expectMoney(line.debitPlanDollars, 20_000)
    expectMoney(line.creditPlanDollars, 20_000)
    expect(line.destination).toEqual({ entityKind: 'charity', designationId: 'charity-1' })
    expect(line.taxCharacter).toEqual([
      { kind: 'qcdIncomeExclusion', amountPlanDollars: 20_000 },
    ])
    expectMoney(y2026.qcd, 20_000)
    expect(y2026.cashFlow!.reconciliation.status).toBe('reconciled')
  })

  it('publishes employer match as a transfer only, not a use and not income', () => {
    // Independent worksheet, year 2026, 0% tax, 0% spending:
    //   wages 50,000; 401(k) desired 10,000; match 100% of elective up to 6% of pay.
    //   elective for match = 10,000; cap = 0.06 × 50,000 = 3,000; match = 3,000.
    //   Employee contribution is a household use; match never is.
    const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 70, retirementAge: 70 })
    const employer = traditionalAccount('401k-1', 0, 'p1', 'employer') as Extract<Account, { type: 'traditional' }>
    employer.annualContribution = 10_000
    employer.employerMatch = { matchPct: 100, capPctOfPay: 6 }
    plan.accounts = [cashAccount('cash-1', 0), employer]
    plan.incomes = [{
      type: 'wages',
      id: 'wage-1',
      personId: 'p1',
      annualGross: 50_000,
      endAge: null,
      realGrowthPct: 0,
    }]
    const y2026 = yearOf(run(plan, { horizonEndYear: 2026 }), START_YEAR)

    const match = transferById(y2026, 'transfer:employerMatch:401k-1')
    expect(match.kind).toBe('employerMatch')
    expectMoney(match.debitPlanDollars, 3_000)
    expectMoney(match.creditPlanDollars, 3_000)
    expect(match.source).toEqual({ entityKind: 'employer' })
    expect(match.destination).toEqual({ entityKind: 'account', accountId: '401k-1' })
    expect(y2026.cashFlow!.useLines.some((line) => line.kind === 'employerMatch' as string)).toBe(false)
    expectMoney(y2026.employerMatch, 3_000)
    expectMoney(y2026.incomes.wages, 50_000)
    expect(y2026.incomes.total).toBe(50_000)
    expect(y2026.cashFlow!.reconciliation.status).toBe('reconciled')
  })

  it('links an employee contribution transfer to its use with sameDollarLaterStage', () => {
    // Independent worksheet, year 2026, 0% tax:
    //   wages 20,000; cash annualContribution 5,000; spending 0.
    //   post-routing requested = credited = 5,000; use fully funded.
    //   remaining 15,000 is surplus (sameDollarLaterStage to the surplus use).
    const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 70, retirementAge: 70 })
    const cash = cashAccount('cash-1', 0) as Extract<Account, { type: 'cash' }>
    cash.annualContribution = 5_000
    cash.ownerPersonId = 'p1'
    plan.accounts = [cash]
    plan.incomes = [{
      type: 'wages',
      id: 'wage-1',
      personId: 'p1',
      annualGross: 20_000,
      endAge: null,
      realGrowthPct: 0,
    }]
    const y2026 = yearOf(run(plan, { horizonEndYear: 2026 }), START_YEAR)

    const contrib = transferById(y2026, 'transfer:employeeContribution:cash-1')
    expect(contrib.kind).toBe('employeeContribution')
    expectMoney(contrib.debitPlanDollars, 5_000)
    expectMoney(contrib.creditPlanDollars, 5_000)
    expect(contrib.source).toEqual({ entityKind: 'householdCash' })
    expect(contrib.destination).toEqual({ entityKind: 'account', accountId: 'cash-1' })
    expect(contrib.lineage).toEqual([
      { lineId: 'use:contribution:cash-1', relationship: 'sameDollarLaterStage' },
    ])

    const surplus = transferById(y2026, 'transfer:surplusInvestment:account:cash-1')
    expect(surplus.kind).toBe('surplusInvestment')
    expectMoney(surplus.debitPlanDollars, 15_000)
    expectMoney(surplus.creditPlanDollars, 15_000)
    expect(surplus.lineage).toEqual([
      { lineId: 'use:surplusInvestment:account:cash-1', relationship: 'sameDollarLaterStage' },
    ])
    expect(y2026.cashFlow!.reconciliation.status).toBe('reconciled')
  })

  it('links a statutory-cap-reduced IRA contribution with sameDollarLaterStage, not committedCreditBeyondFunding', () => {
    // Independent worksheet, year 2026, 0% inflation, $0 tax, $0 spending:
    //   p1 born 1966-01-01 → attained 60. Wages 50,000 (ample compensation and cash).
    //   Traditional IRA requested 20,000.
    //   IRC 219(b)(5) IRA limit: 7,500 + age-50 catch-up 1,100 = 8,600
    //   (2026 pack; limitGrowth 1). Transfer = funded = 8,600.
    //   Unfunded 11,400 is statutory-cap rejection; no residual cash shortage.
    const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 70, retirementAge: 70 })
    const ira = traditionalAccount('ira-1', 0, 'p1', 'ira') as Extract<Account, { type: 'traditional' }>
    ira.annualContribution = 20_000
    plan.accounts = [cashAccount('cash-1', 0), ira]
    plan.incomes = [{
      type: 'wages',
      id: 'wage-1',
      personId: 'p1',
      annualGross: 50_000,
      endAge: null,
      realGrowthPct: 0,
    }]
    const y2026 = yearOf(run(plan, { horizonEndYear: 2026 }), START_YEAR)

    const use = y2026.cashFlow!.useLines.find((line) => line.id === 'use:contribution:ira-1')
    expect(use).toBeDefined()
    expectMoney(use!.requestedPlanDollars, 20_000)
    expectMoney(use!.fundedPlanDollars, 8_600)
    expectMoney(use!.unfundedPlanDollars, 11_400)

    const contrib = transferById(y2026, 'transfer:employeeContribution:ira-1')
    expectMoney(contrib.debitPlanDollars, 8_600)
    expectMoney(contrib.creditPlanDollars, 8_600)
    expect(contrib.lineage).toEqual([
      { lineId: 'use:contribution:ira-1', relationship: 'sameDollarLaterStage' },
    ])
    expect(y2026.cashFlow!.reconciliation.status).toBe('reconciled')
  })

  it('attaches capitalGain metadata to an annuity-purchase transfer, not to rebalancing', () => {
    // Independent worksheet, year 2026, 0% inflation:
    //   taxable 100,000 / basis 50,000 funds a 20,000 nonqualified premium.
    //   basis ratio 0.5 → realized gain 10,000 on this transfer only.
    //   owner attained 60, startAge 70 → no payment this year.
    const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 80 })
    plan.accounts = [
      taxableAccount('brokerage-1', 100_000, 50_000),
      {
        type: 'annuity',
        id: 'ann-1',
        name: 'SPIA',
        ownerPersonId: 'p1',
        annualReturnPct: null,
        startAge: 70,
        monthlyAmount: 100,
        colaPct: 0,
        taxablePct: 100,
        purchase: {
          year: 2026,
          premium: 20_000,
          fundingAccountId: 'brokerage-1',
          taxQualification: 'nonQualified',
        },
      },
    ]
    const y2026 = yearOf(run(plan, { horizonEndYear: 2026 }), START_YEAR)

    const line = transferById(y2026, 'transfer:annuityPurchase:ann-1')
    expect(line.kind).toBe('annuityPurchase')
    expectMoney(line.debitPlanDollars, 20_000)
    expectMoney(line.creditPlanDollars, 20_000)
    expect(line.source).toEqual({ entityKind: 'account', accountId: 'brokerage-1' })
    expect(line.destination).toEqual({ entityKind: 'annuityContract', annuityAccountId: 'ann-1' })
    expect(line.taxCharacter).toEqual([
      { kind: 'capitalGain', amountPlanDollars: 10_000 },
    ])
    expect(y2026.cashFlow!.taxCharacterMetadata.some((row) =>
      row.id === 'metadata:capitalGain:rebalancing:brokerage-1',
    )).toBe(false)
    expect(y2026.cashFlow!.reconciliation.status).toBe('reconciled')
  })

  it('publishes a TIPS-ladder purchase transfer of the quoted real cost', () => {
    // Independent hand-priced 3-rung ladder on the 2026-06-30 Treasury curve.
    // Oracle: packages/engine/src/ladder/ladderMath.worksheet.golden.test.ts
    // (U.S. Treasury par real yield curve snapshot of 2026-06-30).
    //   T = $12,000 real, firstPayoutOffset 5, payoutYears 3 (offsets 5..7).
    //   Faces: f5 = 11,324.52444, f6 = 11,534.02814, f7 = 11,758.94169.
    //   Prices: p5 = 11,324.52444 (par), p6 = 11,537.11902, p7 = 11,766.81129.
    //   Total cost = 34,628.45475.
    //   Purchase year 2026 → startYear 2031, endYear 2033.
    //   cash 100,000 funds at book value → capitalGain omitted (zero).
    const tipsPurchaseCost = 34_628.45475
    const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 95, retirementAge: 60 })
    plan.accounts = [cashAccount('cash1', 100_000)]
    plan.incomeFloor = {
      ladders: [{
        id: 'lad1',
        name: 'Income floor',
        purpose: 'floor',
        startYear: 2031,
        endYear: 2033,
        annualRealAmount: 12_000,
        purchase: { year: 2026, fundingAccountId: 'cash1' },
      }],
    }
    const y2026 = yearOf(run(plan, { horizonEndYear: 2026 }), START_YEAR)

    const line = transferById(y2026, 'transfer:tipsLadderPurchase:lad1')
    expect(line.kind).toBe('tipsLadderPurchase')
    expectMoney(line.debitPlanDollars, tipsPurchaseCost)
    expectMoney(line.creditPlanDollars, tipsPurchaseCost)
    expect(line.source).toEqual({ entityKind: 'account', accountId: 'cash1' })
    expect(line.destination).toEqual({ entityKind: 'tipsLadder', ladderId: 'lad1' })
    expect(line.taxCharacter).toBeUndefined()
    expect(y2026.cashFlow!.reconciliation.status).toBe('reconciled')
  })

  it('publishes a pension lump-sum rollover as a direct transfer, never household cash', () => {
    // Independent worksheet, year 2026:
    //   lump-sum offer 50,000 elected into ira-1. External plan money; no
    //   pension income in the election year.
    const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 80, retirementAge: null })
    plan.accounts = [
      cashAccount('cash-1', 0),
      traditionalAccount('ira-1', 0, 'p1', 'ira'),
      {
        type: 'pension',
        id: 'pen-1',
        name: 'Pension',
        ownerPersonId: 'p1',
        annualReturnPct: null,
        startAge: 65,
        monthlyAmount: 2_000,
        colaPct: 0,
        survivorPct: 0,
        lumpSumOffer: { amount: 50_000, electionYear: 2026 },
        lumpSumElection: { rolloverAccountId: 'ira-1' },
      },
    ]
    const y2026 = yearOf(run(plan, { horizonEndYear: 2026 }), START_YEAR)

    const line = transferById(y2026, 'transfer:pensionRollover:pen-1:ira-1')
    expect(line.kind).toBe('pensionRollover')
    expectMoney(line.debitPlanDollars, 50_000)
    expectMoney(line.creditPlanDollars, 50_000)
    expect(line.source).toEqual({ entityKind: 'pensionPlan', pensionAccountId: 'pen-1' })
    expect(line.destination).toEqual({ entityKind: 'account', accountId: 'ira-1' })
    expect(y2026.cashFlow!.sourceLines.some((row) => row.kind === 'pension')).toBe(false)
    expectMoney(y2026.incomes.pension, 0)
    expectMoney(y2026.balances['ira-1'] ?? 0, 50_000)
    expect(y2026.cashFlow!.reconciliation.status).toBe('reconciled')
  })

  describeRule('irc-402-c-4-B-rmd-not-eligible-rollover-distribution', {
    // Owner age 76 in 2026 (past RBD). Treating the lump-sum present value as
    // the account balance, the §401(a)(9) portion is 237,000 ÷ ULT 23.7 = 10,000,
    // which is not an eligible rollover distribution and would be paid to the
    // owner as taxable pension income; only 227,000 could roll. The engine
    // credits the full offer tax-free and pays nothing out. Taxable pension
    // income is the discriminating observable — the year-end IRA balance also
    // reflects unrelated same-year cash-flow withdrawals, so it is only
    // bounded, not pinned.
    readings: {
      statuteRmdPortionPaidAsTaxablePensionIncome: 10_000,
      engineRollsEntireOfferTaxFree: 0,
    },
    accepted: 'statuteRmdPortionPaidAsTaxablePensionIncome',
    produced: 'engineRollsEntireOfferTaxFree',
    note: 'pension lump-sum past RBD',
  }, ({ accepted, produced }) => {
    it('credits the entire pension lump-sum offer as a tax-free rollover past the RBD', () => {
      const ultAge76 = packForYear(2026).pack.rmd.uniformLifetimeTable[76]
      expect(ultAge76).toBe(23.7)
      const offer = 237_000
      expect(offer / ultAge76).toBeCloseTo(accepted, 10)

      const plan = singlePersonPlan({ dob: '1950-06-15', planningAge: 90, retirementAge: null })
      plan.accounts = [
        cashAccount('cash-1', 0),
        traditionalAccount('ira-1', 0, 'p1', 'ira'),
        {
          type: 'pension',
          id: 'pen-1',
          name: 'Pension',
          ownerPersonId: 'p1',
          annualReturnPct: null,
          startAge: 65,
          monthlyAmount: 2_000,
          colaPct: 0,
          survivorPct: 0,
          lumpSumOffer: { amount: offer, electionYear: 2026 },
          lumpSumElection: { rolloverAccountId: 'ira-1' },
        },
      ]
      const y2026 = yearOf(run(plan, { horizonEndYear: 2026 }), START_YEAR)
      expectMoney(y2026.incomes.pension, produced)
      expect(y2026.incomes.pension).not.toBeCloseTo(accepted, 6)
      // More than the eligible 227,000 reached the IRA: the ineligible RMD
      // portion rolled rather than being paid out (net of unrelated same-year
      // cash-flow withdrawals).
      const rolled = y2026.balances['ira-1'] ?? 0
      expect(rolled).toBeGreaterThan(offer - accepted)
    })
  })

  it('pairs every published transfer debit with an equal credit', () => {
    const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 70, retirementAge: 70 })
    const cash = cashAccount('cash-1', 0) as Extract<Account, { type: 'cash' }>
    cash.annualContribution = 5_000
    cash.ownerPersonId = 'p1'
    plan.accounts = [cash]
    plan.incomes = [{
      type: 'wages',
      id: 'wage-1',
      personId: 'p1',
      annualGross: 20_000,
      endAge: null,
      realGrowthPct: 0,
    }]
    const y2026 = yearOf(run(plan, { horizonEndYear: 2026 }), START_YEAR)
    for (const line of y2026.cashFlow!.transferLines) {
      expect(line.debitPlanDollars).toBe(line.creditPlanDollars)
    }
    expect(y2026.cashFlow!.reconciliation.transfers.differencePlanDollars).toBe(0)
    expect(y2026.cashFlow!.reconciliation.status).toBe('reconciled')
  })
})
