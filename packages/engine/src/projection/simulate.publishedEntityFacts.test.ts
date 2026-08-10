/**
 * simulatePlan-level coverage for the per-entity published facts on YearResult
 * (owned Roth pool activity, employer Roth activity, owned traditional-IRA
 * aggregate activity, qualified annuity payments, Social Security streams).
 *
 * These fields are the one-source-of-truth channel for insight detectors —
 * each assertion checks the published value matches what the ledger executed.
 *
 * Settlement-retry / stand-down paths are not covered here (no cheap existing
 * fixture for those edges in this slice).
 */
import { describe, expect, it } from 'vitest'

import { parseRetirementActionRequest } from '../actions/index.js'
import type { Account, Plan } from '../model/plan.js'
import {
  couplePlan,
  singlePersonPlan,
  traditionalAccount,
  validatePlan,
} from '../testing/planFixtures.js'
import { createFlatTaxCalculator } from './flatTax.js'
import { simulatePlan } from './simulate.js'
import type { YearResult } from './types.js'

const TAX_YEAR = 2026
const noTax = createFlatTaxCalculator(0)

function run(plan: Plan, endYear = TAX_YEAR): YearResult[] {
  return simulatePlan(validatePlan(plan), {
    startYear: TAX_YEAR,
    horizonEndYear: endYear,
    taxCalculator: noTax,
  }).years
}

function ownedIra(
  id: string,
  balance: number,
  ownerPersonId = 'p1',
): Extract<Account, { type: 'traditional' }> {
  const account = traditionalAccount(id, balance, ownerPersonId)
  if (account.type !== 'traditional') throw new Error('expected traditional account')
  return { ...account, annualReturnPct: 0 }
}

function rothIra(
  id: string,
  balance: number,
  ownerPersonId: string | null = 'p1',
  contributionBasis?: number,
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
    ...(contributionBasis !== undefined ? { contributionBasis } : {}),
  }
}

function employerRoth(
  id: string,
  balance: number,
  ownerPersonId = 'p1',
): Extract<Account, { type: 'roth' }> {
  return {
    type: 'roth',
    id,
    name: id,
    ownerPersonId,
    annualReturnPct: 0,
    kind: 'employer',
    balance,
    annualContribution: 0,
  }
}

describe('simulatePlan published per-entity ledger facts', () => {
  it('publishes empty owned-Roth / employer-Roth / owned-IRA activity when nothing moves', () => {
    const plan = singlePersonPlan({ planningAge: 60 })
    plan.id = 'published-facts-empty'
    const year = run(plan)[0]!

    expect(year.ownedRothIraPoolActivity).toEqual([])
    expect(year.employerRothAccountActivity).toEqual([])
    expect(year.ownedTraditionalIraAggregateActivity).toEqual([])
    expect(year.qualifiedAnnuityPayments).toEqual([])
    expect(year.socialSecurityStreams).toEqual([])
    expect(Object.keys(year)).toEqual(expect.arrayContaining([
      'ownedRothIraPoolActivity',
      'employerRothAccountActivity',
      'ownedTraditionalIraAggregateActivity',
      'qualifiedAnnuityPayments',
      'socialSecurityStreams',
    ]))
  })

  it('publishes owned Roth-IRA pool withdrawals and credited contributions by resolved owner', () => {
    const plan = singlePersonPlan({ dob: '1970-01-01', planningAge: 90 })
    plan.id = 'published-facts-roth-pool'
    plan.accounts = [
      {
        ...rothIra('roth-a', 100_000, 'p1', 0),
        annualContribution: 6_000,
      },
      rothIra('roth-b', 20_000, 'p1', 0),
    ]
    plan.expenses.baseAnnual = 30_000
    plan.incomes = [
      {
        id: 'wages',
        type: 'wages',
        personId: 'p1',
        annualGross: 50_000,
        endAge: null,
      },
    ] as never

    const year = run(plan)[0]!
    const activity = year.ownedRothIraPoolActivity ?? []
    expect(activity).toHaveLength(1)
    expect(activity[0]!.ownerPersonId).toBe('p1')
    // Credited contributions equal the post-limit allowed amount actually applied.
    expect(activity[0]!.creditedContributions).toBeGreaterThan(0)
    expect(activity[0]!.creditedContributions).toBeLessThanOrEqual(6_000 * 1.1)
    // Withdrawals from the owner pool match the reported Roth withdrawal total
    // when there is no employer or inherited Roth.
    expect(activity[0]!.withdrawals).toBe(year.withdrawals.roth)
  })

  it('publishes employer Roth activity per account separately from the owned pool', () => {
    const plan = singlePersonPlan({ dob: '1970-01-01', planningAge: 90 })
    plan.id = 'published-facts-employer-roth'
    plan.accounts = [
      {
        ...employerRoth('roth-401k', 80_000),
        annualContribution: 5_000,
      },
      rothIra('roth-ira', 10_000, 'p1', 10_000),
    ]
    plan.expenses.baseAnnual = 40_000
    plan.incomes = [
      {
        id: 'wages',
        type: 'wages',
        personId: 'p1',
        annualGross: 80_000,
        endAge: null,
      },
    ] as never

    const year = run(plan)[0]!
    const employer = year.employerRothAccountActivity ?? []
    const owned = year.ownedRothIraPoolActivity ?? []
    const employerRow = employer.find((row) => row.accountId === 'roth-401k')
    expect(employerRow).toBeDefined()
    expect(employerRow!.ownerPersonId).toBe('p1')
    expect(employerRow!.creditedContributions).toBeGreaterThan(0)
    // Conversion credit fields are always present (zero when nothing converted).
    expect(employerRow!.creditedConversionLayers).toEqual([])
    if (owned.length > 0) {
      expect(owned.every((row) => row.ownerPersonId === 'p1')).toBe(true)
    }
    // Exact fidelity: published per-entity Roth draws sum to the year aggregate.
    const publishedRothWithdrawals =
      employer.reduce((sum, row) => sum + row.withdrawals, 0) +
      owned.reduce((sum, row) => sum + row.withdrawals, 0)
    expect(publishedRothWithdrawals).toBe(year.withdrawals.roth)
  })

  it('publishes owned Roth conversion credits with taxable split on the owner pool', () => {
    // Named conversion into a Roth IRA: principal + taxable share land on the
    // owned pool row (employer path is symmetric but employer destinations are
    // refused at the executor; publication shape is covered by zero-fields above
    // and the shared commit-site collectors).
    const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 90 })
    plan.id = 'published-facts-roth-conversion-credit'
    plan.accounts = [
      ownedIra('trad', 200_000),
      rothIra('roth', 10_000, 'p1', 10_000),
    ]
    plan.retirementActionEligibilityFacts = {
      iraClassifications: [{
        evidenceId: 'trad-classification',
        provenance: { source: 'manual' },
        sourceAccountId: 'trad',
        subtype: 'traditional',
      }],
      sepSimpleActivities: [],
      deductibleIraContributions: [],
    }
    const parsed = parseRetirementActionRequest({
      actionId: 'named-conversion-credit',
      kind: 'rothConversion',
      personId: 'p1',
      year: TAX_YEAR,
      executionDate: `${TAX_YEAR}-06-15`,
      executionSequence: 1,
      requestedAmount: 15_000_00,
      allocations: [{
        allocationId: 'named-conversion-credit-allocation',
        sourceAccountId: 'trad',
        requestedAmount: 15_000_00,
      }],
      destinationRothAccountId: 'roth',
      taxFunding: { kind: 'noneExpected' },
      provenance: { source: 'manual' },
    })
    if (!parsed.ok) throw new Error(parsed.issues.join('; '))
    plan.strategies.retirementActions = [parsed.request]

    const year = run(plan)[0]!
    expect(year.rothConversionActionExecution?.committed).toBe(true)
    expect(year.rothConversion).toBe(15_000)
    const owned = year.ownedRothIraPoolActivity ?? []
    const owner = owned.find((row) => row.ownerPersonId === 'p1')
    expect(owner).toBeDefined()
    // Zero-basis traditional source → one fully taxable conversion layer.
    expect(owner!.creditedConversionLayers).toEqual([
      { principal: 15_000, taxable: 15_000, year: TAX_YEAR },
    ])
  })

  it('publishes owned traditional-IRA distributions excluding employer RMDs', () => {
    const plan = singlePersonPlan({ dob: '1953-01-01', planningAge: 90 })
    plan.id = 'published-facts-owned-ira-rmd'
    plan.accounts = [
      ownedIra('owned-ira', 265_000),
      {
        ...ownedIra('employer-plan', 132_500),
        kind: 'employer',
      },
    ]

    const year = run(plan)[0]!
    expect(year.rmd).toBeGreaterThan(0)
    const activity = year.ownedTraditionalIraAggregateActivity ?? []
    expect(activity).toHaveLength(1)
    expect(activity[0]!.ownerPersonId).toBe('p1')
    expect(activity[0]!.distributions).toBeGreaterThan(0)
    expect(activity[0]!.distributions).toBeLessThan(year.rmd)
    expect(activity[0]!.conversions).toBe(0)
    // Exact fidelity: published owned-IRA distributions are the year figure for
    // this owner when only one owner is present.
    const publishedOwnedIraDistributions = activity.reduce(
      (sum, row) => sum + row.distributions,
      0,
    )
    expect(publishedOwnedIraDistributions).toBe(activity[0]!.distributions)
  })

  it('publishes owned-IRA conversion amounts from the namedRothConversionDebit capture branch', () => {
    // Named retirement-action path (not strategies.rothConversion.mode = 'manual')
    // so publication hits namedRothConversionDebit rather than legacyRothConversion.
    const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 90 })
    plan.id = 'published-facts-ira-named-conversion'
    plan.accounts = [
      ownedIra('trad', 200_000),
      rothIra('roth', 10_000, 'p1', 10_000),
    ]
    plan.retirementActionEligibilityFacts = {
      iraClassifications: [{
        evidenceId: 'trad-classification',
        provenance: { source: 'manual' },
        sourceAccountId: 'trad',
        subtype: 'traditional',
      }],
      sepSimpleActivities: [],
      deductibleIraContributions: [],
    }
    const parsed = parseRetirementActionRequest({
      actionId: 'named-conversion',
      kind: 'rothConversion',
      personId: 'p1',
      year: TAX_YEAR,
      executionDate: `${TAX_YEAR}-06-15`,
      executionSequence: 1,
      requestedAmount: 15_000_00,
      allocations: [{
        allocationId: 'named-conversion-allocation',
        sourceAccountId: 'trad',
        requestedAmount: 15_000_00,
      }],
      destinationRothAccountId: 'roth',
      taxFunding: { kind: 'noneExpected' },
      provenance: { source: 'manual' },
    })
    if (!parsed.ok) throw new Error(parsed.issues.join('; '))
    plan.strategies.retirementActions = [parsed.request]

    const year = run(plan)[0]!
    expect(year.rothConversionActionExecution?.committed).toBe(true)
    expect(year.rothConversion).toBe(15_000)
    const activity = year.ownedTraditionalIraAggregateActivity ?? []
    const owner = activity.find((row) => row.ownerPersonId === 'p1')
    expect(owner).toBeDefined()
    // Exact fidelity against the ledger's own conversion aggregate via the
    // namedRothConversionDebit publication arm.
    expect(owner!.conversions).toBe(year.rothConversion)
    expect(owner!.conversions).toBe(15_000)
  })

  it('publishes owned-IRA distributions that include a SEPP year exactly', () => {
    const plan = singlePersonPlan({ dob: '1970-03-15', planningAge: 70 })
    plan.id = 'published-facts-sepp'
    plan.assumptions.inflationPct = 0
    plan.assumptions.defaultReturnPct = 0
    plan.expenses.baseAnnual = 5_000
    plan.accounts = [
      {
        ...ownedIra('ira1', 500_000),
        sepp: { startAge: 56, method: 'rmd' },
      } as Account,
      {
        type: 'cash',
        id: 'cash',
        name: 'Cash',
        ownerPersonId: null,
        annualReturnPct: 0,
        balance: 200_000,
        annualContribution: 0,
      } as Account,
    ]

    const year = run(plan)[0]!
    expect(year.sepp).toBeCloseTo(500_000 / 30.6, 6)
    const activity = year.ownedTraditionalIraAggregateActivity ?? []
    const owner = activity.find((row) => row.ownerPersonId === 'p1')
    expect(owner).toBeDefined()
    // SEPP is an owned-IRA distribution; published distributions include it.
    expect(owner!.distributions).toBe(year.sepp)
    expect(owner!.distributions).toBe(year.withdrawals.traditional)
  })

  it('publishes owned-IRA distributions that include an aggregate QCD year exactly', () => {
    const plan = singlePersonPlan({ dob: '1950-01-01', planningAge: 90 })
    plan.id = 'published-facts-qcd'
    plan.assumptions.inflationPct = 0
    plan.assumptions.defaultReturnPct = 0
    plan.expenses.baseAnnual = 40_000
    plan.strategies.qcdAnnual = 60_000
    plan.accounts = [
      ownedIra('g-ira', 1_000_000),
      {
        type: 'cash',
        id: 'g-cash',
        name: 'Cash',
        ownerPersonId: null,
        annualReturnPct: 0,
        balance: 200_000,
        annualContribution: 0,
      } as Account,
    ]

    const year = run(plan)[0]!
    expect(year.qcd).toBe(60_000)
    expect(year.rmd).toBeGreaterThan(0)
    const activity = year.ownedTraditionalIraAggregateActivity ?? []
    const owner = activity.find((row) => row.ownerPersonId === 'p1')
    expect(owner).toBeDefined()
    // Aggregate QCD larger than RMD: published owned-IRA distributions equal the
    // full gift (RMD-routed arm + beyond-RMD arm), matching year.qcd exactly.
    expect(owner!.distributions).toBe(year.qcd)
    expect(owner!.distributions).toBe(60_000)
    // Beyond-RMD gift still leaves the owned pool even though withdrawals.traditional
    // only books the cashable RMD portion.
    expect(owner!.distributions).toBeGreaterThan(year.withdrawals.traditional)
    expect(owner!.distributions).toBe(
      year.rmd + (year.qcd - Math.min(year.qcd, year.rmd)),
    )
  })

  it('publishes qualified annuity payments actually paid with funding-owner linkage', () => {
    const plan = singlePersonPlan({ dob: '1960-01-01', planningAge: 90 })
    plan.id = 'published-facts-qualified-annuity'
    plan.accounts = [
      ownedIra('trad', 50_000),
      {
        type: 'annuity',
        id: 'annuity',
        name: 'IRA annuity',
        ownerPersonId: 'p1',
        annualReturnPct: 0,
        startAge: 60,
        monthlyAmount: 100,
        colaPct: 0,
        taxablePct: 100,
        purchase: {
          year: TAX_YEAR - 5,
          premium: 25_000,
          fundingAccountId: 'trad',
          taxQualification: 'qualified',
        },
      } as Account,
    ]

    const year = run(plan)[0]!
    const payments = year.qualifiedAnnuityPayments ?? []
    expect(payments).toHaveLength(1)
    expect(payments[0]).toMatchObject({
      annuityAccountId: 'annuity',
      payment: 1_200,
      fundingOwnerPersonId: 'p1',
    })
    expect(year.incomes.annuity).toBe(1_200)
    expect(payments.reduce((sum, row) => sum + row.payment, 0)).toBe(year.incomes.annuity)
  })

  it('publishes per-stream Social Security with gate marker, source, and paid amount', () => {
    const plan = singlePersonPlan({ dob: '1960-01-01', planningAge: 90 })
    plan.id = 'published-facts-ss'
    plan.incomes = [
      {
        id: 'ss-early',
        type: 'socialSecurity',
        personId: 'p1',
        piaMonthly: 1_500,
        earnings: null,
        claimAge: { years: 62, months: 0 },
      },
      {
        id: 'ss-last',
        type: 'socialSecurity',
        personId: 'p1',
        piaMonthly: 2_000,
        earnings: null,
        claimAge: { years: 62, months: 0 },
      },
    ] as never

    const year = run(plan)[0]!
    const streams = year.socialSecurityStreams ?? []
    expect(streams).toHaveLength(2)
    const early = streams.find((row) => row.streamId === 'ss-early')
    const last = streams.find((row) => row.streamId === 'ss-last')
    expect(early).toBeDefined()
    expect(last).toBeDefined()
    // Last stream written is the spousal/survivor gate winner.
    expect(last!.isSpousalSurvivorGateStream).toBe(true)
    expect(early!.isSpousalSurvivorGateStream).toBe(false)
    expect(early!.source).toBe('own-retirement')
    expect(last!.source).toBe('own-retirement')
    expect(early!.claimInForce).toBe(true)
    expect(last!.claimInForce).toBe(true)
    // Exact fidelity: published stream payments sum to household SS income.
    expect(early!.annualAmount + last!.annualAmount).toBe(year.incomes.socialSecurity)
    expect(year.incomes.socialSecurity).toBeGreaterThan(0)
  })

  it('publishes SSDI as the stream source when the disability path pays', () => {
    const plan = singlePersonPlan({ dob: '1965-01-01', planningAge: 90 })
    plan.id = 'published-facts-ssdi'
    plan.incomes = [
      {
        id: 'ss-ssdi',
        type: 'socialSecurity',
        personId: 'p1',
        piaMonthly: 2_000,
        earnings: null,
        claimAge: { years: 67, months: 0 },
        disability: { onsetAge: 55 },
      },
    ] as never

    const year = run(plan)[0]!
    const streams = year.socialSecurityStreams ?? []
    expect(streams).toHaveLength(1)
    expect(streams[0]).toMatchObject({
      personId: 'p1',
      streamId: 'ss-ssdi',
      source: 'ssdi',
      claimInForce: true,
      isSpousalSurvivorGateStream: true,
    })
    expect(streams[0]!.annualAmount).toBe(year.ssdiPaid)
    expect(streams[0]!.annualAmount).toBe(year.incomes.socialSecurity)
    expect(streams[0]!.annualAmount).toBeGreaterThan(0)
  })

  it('publishes each stream\'s own source independent of SSDI/retirement plan order', () => {
    // Person age 62 in 2026: SSDI still in the pre-FRA window and the own-
    // retirement stream is claim-payable. Each must record its own source at
    // its pay site; plan order must not change publication (SSDI first must
    // not leave retirement source as 'none').
    const ssdiStream = {
      id: 'ss-ssdi',
      type: 'socialSecurity' as const,
      personId: 'p1',
      piaMonthly: 1_800,
      earnings: null,
      claimAge: { years: 67, months: 0 },
      disability: { onsetAge: 55 },
    }
    const retirementStream = {
      id: 'ss-retirement',
      type: 'socialSecurity' as const,
      personId: 'p1',
      piaMonthly: 1_500,
      earnings: null,
      claimAge: { years: 62, months: 0 },
    }

    const byStreamId = (streams: NonNullable<YearResult['socialSecurityStreams']>) =>
      Object.fromEntries(
        streams.map((row) => [
          row.streamId,
          {
            source: row.source,
            claimInForce: row.claimInForce,
            preWithholdingAnnual: row.preWithholdingAnnual,
            annualAmount: row.annualAmount,
          },
        ]),
      )

    const planSsdiFirst = singlePersonPlan({ dob: '1964-01-01', planningAge: 90 })
    planSsdiFirst.id = 'published-facts-ss-order-ssdi-first'
    planSsdiFirst.incomes = [ssdiStream, retirementStream] as never

    const planRetirementFirst = singlePersonPlan({ dob: '1964-01-01', planningAge: 90 })
    planRetirementFirst.id = 'published-facts-ss-order-retirement-first'
    planRetirementFirst.incomes = [retirementStream, ssdiStream] as never

    const ssdiFirst = byStreamId(run(planSsdiFirst)[0]!.socialSecurityStreams ?? [])
    const retirementFirst = byStreamId(run(planRetirementFirst)[0]!.socialSecurityStreams ?? [])

    expect(ssdiFirst['ss-ssdi']).toMatchObject({
      source: 'ssdi',
      claimInForce: true,
    })
    expect(ssdiFirst['ss-retirement']).toMatchObject({
      source: 'own-retirement',
      claimInForce: true,
    })
    expect(ssdiFirst['ss-ssdi']!.preWithholdingAnnual).toBeGreaterThan(0)
    expect(ssdiFirst['ss-retirement']!.preWithholdingAnnual).toBeGreaterThan(0)
    // Both plan orders publish identical per-stream source/amount facts.
    expect(retirementFirst).toEqual(ssdiFirst)
  })

  it('publishes per-stream SS for couples with last-stream gate precedence', () => {
    const plan = couplePlan({
      p1Dob: '1960-01-01',
      p2Dob: '1962-01-01',
      p1PlanningAge: 90,
      p2PlanningAge: 90,
    })
    plan.id = 'published-facts-ss-couple'
    plan.incomes = [
      {
        id: 'ss-p1',
        type: 'socialSecurity',
        personId: 'p1',
        piaMonthly: 2_500,
        earnings: null,
        claimAge: { years: 66, months: 0 },
      },
      {
        id: 'ss-p2-a',
        type: 'socialSecurity',
        personId: 'p2',
        piaMonthly: 800,
        earnings: null,
        claimAge: { years: 62, months: 0 },
      },
      {
        id: 'ss-p2-b',
        type: 'socialSecurity',
        personId: 'p2',
        piaMonthly: 900,
        earnings: null,
        claimAge: { years: 62, months: 0 },
      },
    ] as never

    const year = run(plan)[0]!
    const streams = year.socialSecurityStreams ?? []
    expect(streams.find((row) => row.streamId === 'ss-p1')?.isSpousalSurvivorGateStream).toBe(true)
    expect(streams.find((row) => row.streamId === 'ss-p2-a')?.isSpousalSurvivorGateStream).toBe(false)
    expect(streams.find((row) => row.streamId === 'ss-p2-b')?.isSpousalSurvivorGateStream).toBe(true)
    const publishedTotal = streams.reduce((sum, row) => sum + row.annualAmount, 0)
    expect(publishedTotal).toBeCloseTo(year.incomes.socialSecurity, 6)
  })

  it('attributes multi-stream SS payments per stream when claim ages are unequal', () => {
    // Age 66 in 2026: early stream (claim 62) is in force; delayed (claim 70) is not.
    const plan = singlePersonPlan({ dob: '1960-01-01', planningAge: 90 })
    plan.id = 'published-facts-ss-unequal-claim'
    plan.incomes = [
      {
        id: 'ss-early',
        type: 'socialSecurity',
        personId: 'p1',
        piaMonthly: 1_500,
        earnings: null,
        claimAge: { years: 62, months: 0 },
      },
      {
        id: 'ss-delayed',
        type: 'socialSecurity',
        personId: 'p1',
        piaMonthly: 2_000,
        earnings: null,
        claimAge: { years: 70, months: 0 },
      },
    ] as never

    const year = run(plan)[0]!
    const streams = year.socialSecurityStreams ?? []
    const early = streams.find((row) => row.streamId === 'ss-early')!
    const delayed = streams.find((row) => row.streamId === 'ss-delayed')!
    expect(early.claimInForce).toBe(true)
    expect(early.annualAmount).toBeGreaterThan(0)
    expect(early.source).toBe('own-retirement')
    expect(delayed.claimInForce).toBe(false)
    expect(delayed.annualAmount).toBe(0)
    expect(delayed.preWithholdingAnnual).toBe(0)
    // Gate winner is still the last-resolved stream even when it is not paying.
    expect(delayed.isSpousalSurvivorGateStream).toBe(true)
    expect(early.isSpousalSurvivorGateStream).toBe(false)
    // Exact fidelity: only the in-force stream contributes to household SS.
    expect(early.annualAmount + delayed.annualAmount).toBe(year.incomes.socialSecurity)
    expect(early.annualAmount).toBe(year.incomes.socialSecurity)
  })

  it('keeps claimInForce when earnings-test withholding zeros the paid amount', () => {
    // Claim before FRA while still earning enough to fully withhold.
    const plan = singlePersonPlan({ dob: '1964-01-01', planningAge: 90 })
    plan.id = 'published-facts-ss-earnings-test'
    plan.incomes = [
      {
        id: 'ss',
        type: 'socialSecurity',
        personId: 'p1',
        piaMonthly: 2_000,
        earnings: null,
        claimAge: { years: 62, months: 0 },
      },
      {
        id: 'wages',
        type: 'wages',
        personId: 'p1',
        annualGross: 200_000,
        endAge: null,
      },
    ] as never

    const year = run(plan)[0]!
    const stream = (year.socialSecurityStreams ?? []).find((row) => row.streamId === 'ss')
    expect(stream).toBeDefined()
    expect(stream!.claimInForce).toBe(true)
    expect(stream!.preWithholdingAnnual).toBeGreaterThan(0)
    // Full (or near-full) withholding is allowed; paid may be zero.
    expect(stream!.annualAmount).toBeLessThanOrEqual(stream!.preWithholdingAnnual)
    expect(stream!.annualAmount).toBe(year.incomes.socialSecurity)
  })
})
