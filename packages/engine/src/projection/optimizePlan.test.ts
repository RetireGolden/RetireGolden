/**
 * End-to-end test for the V8 optimizer bridge (roadmap V8, PR 1).
 *
 * The acid test (spec §1.1, §3.1): build a real plan, optimize it, write the
 * conversions back, re-run the REAL ledger, and confirm the optimizer's chosen
 * objective — the after-tax estate — comes out at least as good as the
 * no-conversion baseline. The optimizer reasons over a linearised model, so the
 * proof of correctness is the exact `simulate` result, not the LP's own number.
 */

import { describe, expect, it } from 'vitest'

import {
  ACTION_REASON_REGISTRY,
  parseActionReason,
  parseRetirementActionRequest,
} from '../actions/index.js'
import {
  maximizeAfterTaxEstate,
  maximizeSpendingDurability,
  minimizeLifetimeTaxWithEstateFloor,
  type ExactDecisionEvaluation,
} from '../decisions/index.js'
import { createEmptyPlan, parsePlan, type Account, type Plan } from '../model/plan.js'
import { LATEST_PACK_YEAR, packForYear } from '../params/index.js'
import { recurringOrdinaryIncome, setAcaYearContract, socialSecurityIncome } from '../testing/planFixtures.js'
import { buildOptimizerModel, optimizeSchedule, type OptimizedSchedule } from '../strategies/optimizer.js'
import { createFederalTaxCalculator } from '../tax/federalTax.js'
import { summarizeProjection } from './compare.js'
import type { OptimizerYearProbe, ProjectionResult } from './types.js'
import {
  buildAcaActionabilityVeto,
  buildOptimizerInput,
  committedActionMovementForYear,
  evaluateExactLedgerSchedule,
  evaluateSimpleConversionCandidates,
  optimizePlan,
  optimizePlanCoOptimizingClaimAge,
  optimizerOpeningBuckets,
  optimizerUnsupportedRetirementActions,
  postProcessExactLedgerSchedule,
  runExactLedgerTournament,
  selectConvergencePostProcessing,
  withOptimizedConversions,
} from './optimizePlan.js'
import { simulatePlan } from './simulate.js'

let counter = 0
const testIds = () => `optp-${++counter}`
const fixedNow = () => new Date('2026-06-11T00:00:00.000Z')

function calculatedConversions(result: ProjectionResult): Array<{ year: number; amount: number }> {
  return result.years
    .filter((year) => year.rothConversion > 1)
    .map((year) => ({
      year: year.year,
      amount: Math.round(year.rothConversion * 100) / 100,
    }))
}

/** Retired single filer, traditional-heavy, modest spending: ripe for conversions. */
function tradHeavyPlan(): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1958-06-15', // age 68 in 2026; RMDs from age 73 (2031)
    sex: 'average',
    retirementAge: 65,
    longevity: { planningAge: 85, source: 'manual' },
  }
  plan.assumptions.inflationPct = 0
  plan.assumptions.defaultReturnPct = 4
  plan.assumptions.stateEffectiveTaxPct = 0
  plan.assumptions.heirTaxRatePct = 25
  plan.expenses.baseAnnual = 45_000
  plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
  const trad: Account = { type: 'traditional', id: testIds(), name: '401k', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 800_000, annualContribution: 0 }
  const roth: Account = { type: 'roth', id: testIds(), name: 'Roth', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 0, annualContribution: 0 }
  const taxable: Account = { type: 'taxable', id: testIds(), name: 'Brokerage', ownerPersonId: null, annualReturnPct: null, balance: 150_000, costBasis: 150_000, annualContribution: 0 }
  const cash: Account = { type: 'cash', id: testIds(), name: 'Cash', ownerPersonId: null, annualReturnPct: null, balance: 60_000, annualContribution: 0 }
  plan.accounts = [trad, roth, taxable, cash]
  return plan
}

/** Pre-65 retiree where exact ACA costs can differ from the linear optimizer view. */
function acaBridgePlan(): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.household.state = 'FL'
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1964-01-01',
    sex: 'average',
    retirementAge: 60,
    longevity: { planningAge: 62, source: 'manual' },
  }
  plan.assumptions.inflationPct = 0
  plan.assumptions.healthcareExtraInflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  plan.assumptions.stateEffectiveTaxPct = 0
  plan.assumptions.heirTaxRatePct = 50
  plan.expenses.baseAnnual = 20_000
  plan.incomes = [recurringOrdinaryIncome('aca-income', 50_000, 2026)]
  setAcaYearContract(plan, { year: 2026 })
  plan.accounts = [
    { type: 'traditional', id: testIds(), name: 'IRA', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 500_000, annualContribution: 0 },
    { type: 'roth', id: testIds(), name: 'Roth', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 0, annualContribution: 0 },
    { type: 'cash', id: testIds(), name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 150_000, annualContribution: 0 },
  ]
  return plan
}

/** One ACA year funded only by discretionary traditional withdrawals. */
function acaTraditionalSpendingPlan(): Plan {
  const plan = acaBridgePlan()
  plan.expenses.baseAnnual = 30_000
  plan.incomes = []
  plan.accounts = plan.accounts.filter((account) => account.type === 'traditional' || account.type === 'roth')
  return plan
}

/** One-year plan where conversions create current tax with no heir-tax estate offset. */
function taxableConversionCostPlan(): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1960-01-01',
    sex: 'average',
    retirementAge: 65,
    longevity: { planningAge: 66, source: 'manual' },
  }
  plan.assumptions.inflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  plan.assumptions.stateEffectiveTaxPct = 0
  plan.assumptions.heirTaxRatePct = 0
  plan.expenses.baseAnnual = 0
  plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
  plan.accounts = [
    { type: 'traditional', id: testIds(), name: 'IRA', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 100_000, annualContribution: 0 },
    { type: 'roth', id: testIds(), name: 'Roth', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 0, annualContribution: 0 },
    { type: 'cash', id: testIds(), name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 20_000, annualContribution: 0 },
  ]
  return plan
}

/** Two-year plan where the second requested conversion exceeds remaining traditional assets. */
function limitedTraditionalPlan(): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1960-01-01',
    sex: 'average',
    retirementAge: 65,
    longevity: { planningAge: 67, source: 'manual' },
  }
  plan.assumptions.inflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  plan.assumptions.stateEffectiveTaxPct = 0
  plan.assumptions.heirTaxRatePct = 0
  plan.expenses.baseAnnual = 0
  plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
  plan.accounts = [
    { type: 'traditional', id: testIds(), name: 'IRA', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 20_000, annualContribution: 0 },
    { type: 'roth', id: testIds(), name: 'Roth', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 0, annualContribution: 0 },
    { type: 'cash', id: testIds(), name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 10_000, annualContribution: 0 },
  ]
  return plan
}

/**
 * Retiree in the pre-RMD bridge already claiming Social Security, with a big
 * traditional balance, little other income, and only a modest (10%) heir
 * haircut. The conversion-free baseline sits below the provisional-income
 * thresholds (≈0% of SS taxable), so the fixed-base LP under-prices a large
 * conversion's tax and over-converts past its break-even; the exact-ledger
 * convergence loop recaptures the real taxable-SS at the incumbent and pulls the
 * conversions back to a materially higher exact after-tax estate.
 */
function ssTorpedoPlan(): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1958-06-15', // age 68 in 2026; SS claimed at 67 (flowing), RMDs from 73 (2031) — a 5-yr bridge
    sex: 'average',
    retirementAge: 62,
    longevity: { planningAge: 88, source: 'manual' },
  }
  plan.assumptions.inflationPct = 0
  plan.assumptions.defaultReturnPct = 4
  plan.assumptions.stateEffectiveTaxPct = 0
  plan.assumptions.heirTaxRatePct = 10
  plan.expenses.baseAnnual = 40_000
  plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
  plan.incomes = [socialSecurityIncome('ss', 3_500, 67)] // ~$42k/yr benefit, in the phase-in zone
  plan.accounts = [
    { type: 'traditional', id: testIds(), name: 'IRA', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 900_000, annualContribution: 0 },
    { type: 'roth', id: testIds(), name: 'Roth', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 0, annualContribution: 0 },
    { type: 'cash', id: testIds(), name: 'Cash', ownerPersonId: null, annualReturnPct: null, balance: 120_000, annualContribution: 0 },
  ]
  return plan
}

/** Inherited IRA assets are traditional-like, but they are not owner-convertible. */
function inheritedTraditionalPlan(opts: { ownTraditional?: number; inheritedTraditional?: number } = {}): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1960-01-01',
    sex: 'average',
    retirementAge: 65,
    longevity: { planningAge: 67, source: 'manual' },
  }
  plan.assumptions.inflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  plan.assumptions.stateEffectiveTaxPct = 0
  plan.assumptions.heirTaxRatePct = 25
  plan.expenses.baseAnnual = 0
  plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
  plan.accounts = [
    {
      type: 'traditional',
      id: testIds(),
      name: 'Inherited IRA',
      ownerPersonId: 'p1',
      annualReturnPct: 0,
      kind: 'ira',
      balance: opts.inheritedTraditional ?? 300_000,
      annualContribution: 0,
      inherited: { ownerDeathYear: 2024, decedentHadStartedRmds: false },
    },
    { type: 'roth', id: testIds(), name: 'Roth', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 0, annualContribution: 0 },
    { type: 'cash', id: testIds(), name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 10_000, annualContribution: 0 },
  ]
  if ((opts.ownTraditional ?? 0) > 0) {
    plan.accounts.unshift({
      type: 'traditional',
      id: testIds(),
      name: 'Own IRA',
      ownerPersonId: 'p1',
      annualReturnPct: 0,
      kind: 'ira',
      balance: opts.ownTraditional!,
      annualContribution: 0,
    })
  }
  return plan
}

function pensionBridgePlan(): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1966-01-01',
    sex: 'average',
    retirementAge: 60,
    longevity: { planningAge: 62, source: 'manual' },
  }
  plan.assumptions.inflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  plan.assumptions.stateEffectiveTaxPct = 0
  plan.assumptions.heirTaxRatePct = 25
  plan.expenses.baseAnnual = 20_000
  plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
  plan.accounts = [
    { type: 'traditional', id: testIds(), name: 'IRA', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 200_000, annualContribution: 0 },
    { type: 'roth', id: testIds(), name: 'Roth', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 0, annualContribution: 0 },
    { type: 'cash', id: testIds(), name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 20_000, annualContribution: 0 },
    { type: 'pension', id: testIds(), name: 'Pension', ownerPersonId: 'p1', annualReturnPct: 0, startAge: 60, monthlyAmount: 1_000, colaPct: 0, survivorPct: 0 },
  ]
  plan.incomes = [
    { type: 'oneTime', id: testIds(), label: 'Consulting', year: 2026, amount: 15_000, taxTreatment: 'ordinary' },
  ]
  return plan
}

function irmaaLookbackPlan(): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1961-01-01',
    sex: 'average',
    retirementAge: 65,
    longevity: { planningAge: 68, source: 'manual' },
  }
  plan.assumptions.inflationPct = 0
  plan.assumptions.healthcareExtraInflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  plan.assumptions.stateEffectiveTaxPct = 0
  plan.assumptions.heirTaxRatePct = 0
  plan.assumptions.recentAnnualMagi = 0
  plan.expenses.baseAnnual = 0
  plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
  plan.accounts = [
    { type: 'traditional', id: testIds(), name: 'IRA', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 500_000, annualContribution: 0 },
    { type: 'roth', id: testIds(), name: 'Roth', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 0, annualContribution: 0 },
    { type: 'cash', id: testIds(), name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 200_000, annualContribution: 0 },
  ]
  return plan
}

/**
 * Coast FIRE regression shape: a long low-income gap where sequential
 * withdrawals (cash → taxable → traditional) drain the flat-return traditional
 * balance mid-plan, while the LP's blended-growth view of the same balance
 * keeps growing. The solver therefore requests conversions in late years the
 * exact ledger can never execute.
 */
function coastFireGapPlan(): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1976-01-01', // 50 in 2026, already retired
    sex: 'average',
    retirementAge: null,
    longevity: { planningAge: 90, source: 'manual' },
  }
  plan.assumptions.inflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  plan.assumptions.stateEffectiveTaxPct = 0
  plan.assumptions.heirTaxRatePct = 25
  plan.expenses.baseAnnual = 40_000
  plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
  plan.accounts = [
    { type: 'traditional', id: testIds(), name: 'IRA', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 300_000, annualContribution: 0 },
    { type: 'roth', id: testIds(), name: 'Roth', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 0, annualContribution: 0 },
    { type: 'taxable', id: testIds(), name: 'Brokerage', ownerPersonId: null, annualReturnPct: 6, balance: 800_000, costBasis: 800_000, annualContribution: 0 },
    { type: 'cash', id: testIds(), name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 50_000, annualContribution: 0 },
  ]
  plan.incomes = [
    { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 3_000, earnings: null, claimAge: { years: 70, months: 0 } },
  ]
  return plan
}

/**
 * Late-career accumulator whose solvency depends on scheduled contributions:
 * seven more working years deposit 60k/yr into the 401k, and the exact ledger
 * lets those deposits fund retirement. The optimizer probe counts the same
 * contributions as spending (`spendingNeed = expenses.total + contributions`)
 * without adding matching inflows to the compressed traditional bucket.
 */
function contributionAccumulatorPlan(): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1971-01-01', // 55 in 2026
    sex: 'average',
    retirementAge: 62,
    longevity: { planningAge: 80, source: 'manual' },
  }
  plan.assumptions.inflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  plan.assumptions.stateEffectiveTaxPct = 0
  plan.assumptions.heirTaxRatePct = 25
  plan.expenses.baseAnnual = 50_000
  plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
  plan.accounts = [
    { type: 'traditional', id: testIds(), name: '401k', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'employer', balance: 50_000, annualContribution: 60_000 },
    { type: 'roth', id: testIds(), name: 'Roth', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 0, annualContribution: 0 },
    { type: 'cash', id: testIds(), name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 25_000, annualContribution: 0 },
  ]
  plan.incomes = [
    { type: 'wages', id: testIds(), personId: 'p1', annualGross: 150_000, endAge: null, realGrowthPct: 0 },
    { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 2_500, earnings: null, claimAge: { years: 67, months: 0 } },
  ]
  return plan
}

/**
 * Prune-rescue shape: with a 25% heir haircut, a small first-year conversion
 * taxed below 25% helps the after-tax estate, while a huge second-year
 * conversion taxed well above 25% hurts more than the first year helps. The
 * combined schedule is executable but estate-negative; dropping the trailing
 * year should flip it beneficial.
 */
function pruneRescuePlan(): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1960-01-01',
    sex: 'average',
    retirementAge: 65,
    longevity: { planningAge: 69, source: 'manual' },
  }
  plan.assumptions.inflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  plan.assumptions.stateEffectiveTaxPct = 0
  plan.assumptions.heirTaxRatePct = 25
  plan.expenses.baseAnnual = 0
  plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
  plan.accounts = [
    { type: 'traditional', id: testIds(), name: 'IRA', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 600_000, annualContribution: 0 },
    { type: 'roth', id: testIds(), name: 'Roth', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 0, annualContribution: 0 },
    { type: 'cash', id: testIds(), name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 400_000, annualContribution: 0 },
  ]
  return plan
}

/** With a 0% heir rate every taxed conversion is pure cost; pruning cannot help. */
function pruneHopelessPlan(): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1960-01-01',
    sex: 'average',
    retirementAge: 65,
    longevity: { planningAge: 68, source: 'manual' },
  }
  plan.assumptions.inflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  plan.assumptions.stateEffectiveTaxPct = 0
  plan.assumptions.heirTaxRatePct = 0
  plan.expenses.baseAnnual = 0
  plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
  plan.accounts = [
    { type: 'traditional', id: testIds(), name: 'IRA', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 300_000, annualContribution: 0 },
    { type: 'roth', id: testIds(), name: 'Roth', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 0, annualContribution: 0 },
    { type: 'cash', id: testIds(), name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 150_000, annualContribution: 0 },
  ]
  return plan
}

function fakeSchedule(conversions: { year: number; amount: number }[]): OptimizedSchedule {
  return {
    status: 'optimal',
    endingAfterTax: 0,
    lifetimeTax: 0,
    schedule: conversions.map((conversion) => ({
      year: conversion.year,
      conversion: conversion.amount,
      withdrawTraditional: 0,
      withdrawInheritedTraditional: 0,
      withdrawOther: 0,
      withdrawTaxable: 0,
      taxableGainRealized: 0,
      taxableOrdinary: 0,
      irmaaTier: 0,
      endTrad: 0,
      endInheritedTrad: 0,
      endOther: 0,
      endTaxable: 0,
    })),
    conversions,
    solveMs: 0,
  }
}

function validate(plan: Plan): Plan {
  const r = parsePlan(plan)
  if (!r.ok) throw new Error(r.issues.join('; '))
  return r.plan
}

const federal = createFederalTaxCalculator()
const opts = { startYear: 2026, taxCalculator: federal }

describe('buildOptimizerInput', () => {
  it('derives one optimizer-year per projected year with sane inputs', () => {
    const plan = validate(tradHeavyPlan())
    const input = buildOptimizerInput(plan, opts)
    expect(input.openingTrad).toBe(800_000)
    // Step 2 splits the lumped bucket: tax-free (cash) vs taxable brokerage.
    expect(input.openingOther).toBe(60_000) // cash only (roth is 0)
    expect(input.openingTaxable).toBe(150_000) // brokerage
    expect(input.taxableBasisRatio).toBeCloseTo(1) // basis 150k on 150k balance
    expect(input.ltcgRate).toBeCloseTo(0.15)
    expect(input.years).toHaveLength(2043 - 2026 + 1) // through planning age 85
    expect(input.liquidationRate).toBeCloseTo(0.25)
    // Production always prices the exact ledger's IRMAA lookback and OBBBA
    // senior-deduction phase-out in-solve.
    expect(input.irmaaLookback).toBe(true)
    expect(input.seniorDeduction).toBe(true)
    // No income streams, so pre-RMD ordinary base is zero; RMD divisor appears
    // once the owner reaches age 73 (2031).
    const y2027 = input.years.find((y) => y.year === 2027)!
    expect(y2027.ordinaryIncomeBase).toBeCloseTo(0)
    expect(y2027.rmdDivisor).toBeNull()
    const y2032 = input.years.find((y) => y.year === 2032)!
    expect(y2032.rmdDivisor).not.toBeNull()
    expect(y2032.rmdDivisor!).toBeGreaterThan(15) // Uniform Lifetime divisors are ~26 at 73
  })

  // The LP and the exact ledger have to reach for the same thresholds in the
  // same year. `limitScale` in simulate.ts holds its factor at 1 for every year
  // at or below the latest published pack; the LP has to do the same, and a bare
  // `p.year - publishedPack.year` does not, because `packForYear` hands a year
  // earlier than every published pack the EARLIEST pack and the difference goes
  // negative. That would deflate the LP's brackets (and, via `y.inflationScale`,
  // its IRMAA thresholds) for a year the ledger prices at face value.
  it('holds the LP inflation factor at 1 for years the ledger does not project', () => {
    const inflating = tradHeavyPlan() // the fixture assumes 0% inflation; this test needs a path
    inflating.assumptions.inflationPct = 2.5
    const plan = validate(inflating)
    const input = buildOptimizerInput(plan, { startYear: LATEST_PACK_YEAR - 2, taxCalculator: federal })
    const published = packForYear(LATEST_PACK_YEAR).pack

    const unprojected = input.years.filter((y) => y.year <= LATEST_PACK_YEAR)
    expect(unprojected.length).toBeGreaterThan(0)
    for (const y of unprojected) {
      expect(y.inflationScale).toBe(1)
      expect(y.pack.federalTax.standardDeduction.single).toBe(published.federalTax.standardDeduction.single)
      expect(y.pack.federalTax.brackets.single[1]!.lowerBound).toBe(
        published.federalTax.brackets.single[1]!.lowerBound,
      )
    }

    // Past the pack the factor still has to move, or the fix would have traded
    // one frozen-threshold defect for another.
    const projected = input.years.find((y) => y.year === LATEST_PACK_YEAR + 5)!
    expect(projected.inflationScale).toBeGreaterThan(1)
    expect(projected.pack.federalTax.standardDeduction.single).toBeGreaterThan(
      published.federalTax.standardDeduction.single,
    )
  })

  it('flags SSA-44 redetermination years so the solve shifts their IRMAA source', () => {
    // Married couple, first death after 2033 (p2 planning age 75, born 1958):
    // with the survivor toggle on, the two years after the death carry the
    // flag; everything else (and the whole plan with the toggle off) does not.
    const couple = tradHeavyPlan()
    couple.household.filingStatus = 'marriedFilingJointly'
    couple.household.people.push({
      id: 'p2',
      name: 'Sam',
      dob: '1958-06-15',
      sex: 'average',
      retirementAge: null,
      longevity: { planningAge: 75, source: 'manual' }, // last year alive: 2033
    })
    couple.expenses.healthcare.ssa44 = { survivorYears: true, retirementYears: false }
    const input = buildOptimizerInput(validate(couple), opts)
    expect(input.years.filter((y) => y.ssa44Redetermination).map((y) => y.year)).toEqual([2034, 2035])

    const off = structuredClone(couple)
    delete off.expenses.healthcare.ssa44
    const offInput = buildOptimizerInput(validate(off), opts)
    expect(offInput.years.some((y) => y.ssa44Redetermination)).toBe(false)
  })

  it('models progressive state brackets in-solve, but keeps a flat override flat (Step 3)', () => {
    const bracketPlan = tradHeavyPlan()
    bracketPlan.household.state = 'CA' // progressive brackets, no override
    bracketPlan.assumptions.stateEffectiveTaxPct = 0
    const withBrackets = buildOptimizerInput(validate(bracketPlan), opts)
    const y0 = withBrackets.years[0]!
    expect(y0.stateBrackets && y0.stateBrackets.length).toBeGreaterThan(1)
    expect(y0.stateRate).toBeCloseTo(0) // no override / no local → flat term is 0

    // A flat effective-rate override carries the whole state tax as a flat term
    // and suppresses the bracket PWL.
    const flatPlan = tradHeavyPlan()
    flatPlan.household.state = 'CA'
    flatPlan.assumptions.stateEffectiveTaxPct = 6
    const flat = buildOptimizerInput(validate(flatPlan), opts)
    expect(flat.years[0]!.stateBrackets).toBeUndefined()
    expect(flat.years[0]!.stateRate).toBeCloseTo(0.06)
  })

  it('limits opening traditional to owner-convertible balances', () => {
    const plan = validate(inheritedTraditionalPlan({ ownTraditional: 50_000, inheritedTraditional: 300_000 }))
    const input = buildOptimizerInput(plan, opts)

    expect(input.openingTrad).toBe(50_000)
    expect(input.openingInheritedTrad).toBe(300_000)
    expect(input.openingOther).toBe(10_000) // cash; inherited traditional is tracked separately
  })

  it('passes forced inherited distributions as taxable liquid optimizer inputs', () => {
    const plan = inheritedTraditionalPlan({ ownTraditional: 50_000, inheritedTraditional: 300_000 })
    const inherited = plan.accounts.find((account) => account.type === 'traditional' && account.inherited)
    if (inherited?.type === 'traditional' && inherited.inherited) {
      inherited.inherited = { ...inherited.inherited, ownerDeathYear: 2016 }
    }
    const input = buildOptimizerInput(validate(plan), opts)
    const y2026 = input.years.find((year) => year.year === 2026)!

    expect(input.openingTrad).toBe(50_000)
    expect(input.openingInheritedTrad).toBe(300_000)
    expect(y2026.inheritedDistribution).toBeCloseTo(300_000, 2)
    expect(y2026.inheritedDistributionDivisor).toBeCloseTo(1, 2)
    expect(y2026.ordinaryIncomeBase).toBeCloseTo(0, 2)
  })

  it('includes pension and one-time ordinary income in optimizer year inputs', () => {
    const plan = validate(pensionBridgePlan())
    const input = buildOptimizerInput(plan, opts)
    const y2026 = input.years.find((year) => year.year === 2026)!

    expect(y2026.ordinaryIncomeBase).toBeCloseTo(27_000, 0)
  })

  it('captures discretionary traditional and taxable draws in the incumbent MAGI coordinate', () => {
    const raw = acaTraditionalSpendingPlan()
    raw.accounts.splice(1, 0, {
      type: 'taxable',
      id: testIds(),
      name: 'Zero-basis brokerage',
      ownerPersonId: null,
      annualReturnPct: 0,
      balance: 10_000,
      costBasis: 0,
      annualContribution: 0,
    })
    const plan = validate(raw)
    let probe: OptimizerYearProbe | undefined
    const result = simulatePlan(plan, {
      ...opts,
      captureOptimizerInputs: (captured) => {
        if (captured.year === 2026) probe = captured
      },
    })
    const year = result.years[0]!

    expect(probe).toBeDefined()
    expect(year.withdrawals.traditional).toBeGreaterThan(0)
    expect(year.realizedGains).toBeCloseTo(10_000, 2)
    expect(probe!.incumbentModeledMagiBeforeTaxableWithdrawalGains).toBeCloseTo(
      year.withdrawals.traditional,
      2,
    )
    expect(probe!.incumbentTaxableWithdrawal).toBeCloseTo(10_000, 2)
  })
})

describe('evaluateExactLedgerSchedule', () => {
  it('classifies no-traditional plans as no-op', () => {
    const plan = tradHeavyPlan()
    plan.accounts = plan.accounts.map((a) =>
      a.type === 'traditional' ? { ...a, type: 'roth' as const } : a,
    )
    const valid = validate(plan)
    const baseline = simulatePlan(valid, opts)
    const validation = evaluateExactLedgerSchedule(valid, [], baseline, baseline)

    expect(validation.recommendationState).toBe('neutral')
    expect(validation.requestedConversionTotal).toBe(0)
    expect(validation.executedConversionTotal).toBe(0)
    expect(validation.executedConversionRatio).toBe(1)
  })

  it('preserves a nonempty exact-ledger-neutral aggregate schedule as neutral', () => {
    const plan = validate(tradHeavyPlan())
    const baseline = simulatePlan(plan, opts)
    const candidate = structuredClone(baseline)
    const year = candidate.years[0]!
    year.rothConversion = 100
    const validation = evaluateExactLedgerSchedule(
      plan,
      [{ year: year.year, amount: 100 }],
      baseline,
      candidate,
    )

    expect(validation.executedConversionTotal).toBe(100)
    expect(validation.afterTaxEstateDelta).toBe(0)
    expect(validation.recommendationState).toBe('neutral')
  })

  it('rejects fully executable schedules with no exact estate improvement', () => {
    const plan = validate(taxableConversionCostPlan())
    const conversions = [{ year: 2026, amount: 50_000 }]
    const baseline = simulatePlan(plan, opts)
    const candidatePlan = validate(withOptimizedConversions(plan, conversions, '2026-06-17T00:00:00.000Z'))
    const candidate = simulatePlan(candidatePlan, opts)
    const validation = evaluateExactLedgerSchedule(plan, conversions, baseline, candidate)

    expect(validation.executedConversionTotal).toBeCloseTo(50_000, 2)
    expect(validation.afterTaxEstateDelta).toBeLessThan(0)
    expect(validation.recommendationState).toBe('rejected')
  })

  it('reports requested versus executed conversion mismatch', () => {
    const plan = validate(limitedTraditionalPlan())
    const conversions = [
      { year: 2026, amount: 15_000 },
      { year: 2027, amount: 15_000 },
    ]
    const baseline = simulatePlan(plan, opts)
    const candidatePlan = validate(withOptimizedConversions(plan, conversions, '2026-06-17T00:00:00.000Z'))
    const candidate = simulatePlan(candidatePlan, opts)
    const validation = evaluateExactLedgerSchedule(plan, conversions, baseline, candidate)

    expect(validation.requestedConversionTotal).toBe(30_000)
    expect(validation.executedConversionTotal).toBeCloseTo(20_000, 2)
    expect(validation.executedConversionRatio).toBeCloseTo(2 / 3, 2)
    expect(validation.firstMateriallyUnexecutedYear).toBe(2027)
    expect(validation.traditionalDepletionYear).toBe(2027)
    expect(validation.recommendationState).toBe('unexecutable')
  })

  it('prices IRMAA lookback effects through the exact ledger before recommendation', () => {
    const plan = validate(irmaaLookbackPlan())
    const conversions = [{ year: 2026, amount: 300_000 }]
    const baseline = simulatePlan(plan, opts)
    const candidatePlan = validate(withOptimizedConversions(plan, conversions, '2026-06-17T00:00:00.000Z'))
    const candidate = simulatePlan(candidatePlan, opts)
    const validation = evaluateExactLedgerSchedule(plan, conversions, baseline, candidate)

    expect(candidate.years.find((year) => year.year === 2028)!.expenses.healthcare).toBeGreaterThan(
      baseline.years.find((year) => year.year === 2028)!.expenses.healthcare,
    )
    expect(validation.afterTaxEstateDelta).toBeLessThan(0)
    expect(validation.recommendationState).toBe('rejected')
  })
})

describe('postProcessExactLedgerSchedule', () => {
  it('trims raw conversions to exact ledger execution and revalidates the cleaned schedule', () => {
    const plan = validate(limitedTraditionalPlan())
    const baseline = simulatePlan(plan, opts)
    const rawSchedule = fakeSchedule([
      { year: 2026, amount: 15_000 },
      { year: 2027, amount: 15_000 },
    ])
    const processed = postProcessExactLedgerSchedule(plan, rawSchedule, baseline, opts)

    expect(processed.rawValidation.recommendationState).toBe('unexecutable')
    expect(processed.stabilized).toBe(true)
    expect(processed.cleanedSchedule.conversions).toEqual([
      { year: 2026, amount: 15_000 },
      { year: 2027, amount: 5_000 },
    ])
    expect(processed.adjustments).toEqual([
      { year: 2027, requested: 15_000, executed: 5_000, cleaned: 5_000, reason: 'ledger-capped' },
    ])
    expect(processed.cleanedValidation.requestedConversionTotal).toBe(20_000)
    expect(processed.cleanedValidation.executedConversionTotal).toBeCloseTo(20_000, 2)
    expect(processed.cleanedValidation.executedConversionRatio).toBe(1)
    expect(processed.cleanedValidation.recommendationState).toBe('neutral')
    expect(processed.recommendationSchedule).toBe('none')
  })

  it('blocks cleaned schedules that still lower exact after-tax estate', () => {
    const plan = validate(taxableConversionCostPlan())
    const baseline = simulatePlan(plan, opts)
    const processed = postProcessExactLedgerSchedule(
      plan,
      fakeSchedule([{ year: 2026, amount: 50_000 }]),
      baseline,
      opts,
    )

    expect(processed.cleanedValidation.recommendationState).toBe('rejected')
    expect(processed.recommendationSchedule).toBe('none')
  })

  it('does not recommend a raw schedule that cleans to zero conversions', () => {
    const plan = validate(inheritedTraditionalPlan())
    const baseline = simulatePlan(plan, opts)
    const processed = postProcessExactLedgerSchedule(
      plan,
      fakeSchedule([{ year: 2026, amount: 50_000 }]),
      baseline,
      opts,
    )

    expect(processed.cleanedSchedule.conversions).toEqual([])
    expect(processed.cleanedValidation.executedConversionTotal).toBe(0)
    expect(processed.recommendationSchedule).toBe('none')
  })

  it('keeps cleaned results consistent when tolerance drops tiny conversions', () => {
    const plan = validate(limitedTraditionalPlan())
    const baseline = simulatePlan(plan, opts)
    const processed = postProcessExactLedgerSchedule(
      plan,
      fakeSchedule([{ year: 2026, amount: 0.5 }]),
      baseline,
      opts,
    )

    expect(processed.cleanedSchedule.conversions).toEqual([])
    expect(processed.cleanedValidation.requestedConversionTotal).toBe(0)
    expect(processed.cleanedValidation.executedConversionTotal).toBe(0)
    expect(processed.cleanedResult.years.reduce((sum, year) => sum + year.rothConversion, 0)).toBe(0)
    expect(processed.rawValidation.executedConversionTotal).toBeCloseTo(0.5, 2)
    expect(processed.recommendationSchedule).toBe('none')
  })

  it('rescues rejected schedules by pruning trailing conversions that hurt the exact estate', () => {
    const plan = validate(pruneRescuePlan())
    const baseline = simulatePlan(plan, opts)
    const rawSchedule = fakeSchedule([
      { year: 2026, amount: 20_000 },
      { year: 2027, amount: 500_000 },
    ])
    const processed = postProcessExactLedgerSchedule(plan, rawSchedule, baseline, opts)

    // The whole schedule executes (520k <= 600k traditional), so trimming
    // leaves it intact — but the 500k year is taxed above the 25% heir rate
    // and drags the combined exact estate below baseline.
    expect(processed.rawValidation.executedConversionRatio).toBeCloseTo(1, 6)
    expect(processed.rawValidation.recommendationState).toBe('rejected')

    // The prune pass still drops the harmful trailing year and preserves the
    // exact calculation, but cannot publish the aggregate result as actionable.
    expect(processed.pruneIterationCount).toBeGreaterThanOrEqual(1)
    expect(processed.cleanedSchedule.conversions).toEqual([{ year: 2026, amount: 20_000 }])
    expect(processed.cleanedValidation.recommendationState).toBe('identityIncomplete')
    expect(processed.cleanedValidation.afterTaxEstateDelta).toBeGreaterThan(0)
    expect(processed.adjustments).toContainEqual({
      year: 2027,
      requested: 500_000,
      executed: 500_000,
      cleaned: 0,
      reason: 'estate-pruned',
    })
    expect(processed.recommendationSchedule).toBe('none')
  })

  it('keeps schedules rejected when pruning cannot make them beneficial', () => {
    const plan = validate(pruneHopelessPlan())
    const baseline = simulatePlan(plan, opts)
    const rawSchedule = fakeSchedule([
      { year: 2026, amount: 100_000 },
      { year: 2027, amount: 100_000 },
    ])
    const processed = postProcessExactLedgerSchedule(plan, rawSchedule, baseline, opts)

    // Heir rate 0%: every taxed conversion is pure cost, so no pruned subset
    // can beat baseline. The prune pass runs but must not adopt anything.
    expect(processed.pruneIterationCount).toBeGreaterThanOrEqual(1)
    expect(processed.cleanedSchedule.conversions).toEqual(rawSchedule.conversions)
    expect(processed.cleanedValidation.recommendationState).toBe('rejected')
    expect(processed.adjustments.every((a) => a.reason !== 'estate-pruned')).toBe(true)
    expect(processed.recommendationSchedule).toBe('none')
  })

  it('respects the prune iteration budget', () => {
    const plan = validate(pruneRescuePlan())
    const baseline = simulatePlan(plan, opts)
    const rawSchedule = fakeSchedule([
      { year: 2026, amount: 20_000 },
      { year: 2027, amount: 500_000 },
    ])
    const processed = postProcessExactLedgerSchedule(plan, rawSchedule, baseline, opts, { maxPruneIterations: 0 })

    // Budget zero disables the pass entirely: the rescueable schedule stays
    // rejected exactly as it did before the prune pass existed.
    expect(processed.pruneIterationCount).toBe(0)
    expect(processed.cleanedValidation.recommendationState).toBe('rejected')
    expect(processed.recommendationSchedule).toBe('none')
  })
})

describe('optimizerUnsupportedRetirementActions', () => {
  const REGISTRY_ENTRY = ACTION_REASON_REGISTRY['optimizer-retirement-action-unsupported']

  /** Identity-bearing withdrawal: names the owner, the source account, and a date. */
  function identityWithdrawal(plan: Plan) {
    const parsed = parseRetirementActionRequest({
      actionId: 'optimizer-precondition-withdrawal',
      kind: 'ordinaryWithdrawal',
      year: 2027,
      executionDate: '2027-03-04',
      executionSequence: 1,
      requestedAmount: 1_000_00,
      provenance: { source: 'manual' },
      personId: 'p1',
      allocations: [{
        allocationId: 'optimizer-precondition-allocation',
        sourceAccountId: plan.accounts[0]!.id,
        requestedAmount: 1_000_00,
      }],
      purpose: { kind: 'spending' },
    })
    if (!parsed.ok) throw new Error(parsed.issues.join('; '))
    return parsed.request
  }

  /** Migrated aggregate: same refusal, but there is no person to name. */
  function legacyAggregate() {
    const parsed = parseRetirementActionRequest({
      actionId: 'optimizer-precondition-legacy',
      kind: 'legacyAggregateWithdrawal',
      year: 2028,
      requestedAmount: 2_000_00,
      legacyCategory: 'cash',
      provenance: { source: 'migration' },
    })
    if (!parsed.ok) throw new Error(parsed.issues.join('; '))
    return parsed.request
  }

  it('finds nothing to refuse on an action-free plan', () => {
    const plan = validate(tradHeavyPlan())

    expect(optimizerUnsupportedRetirementActions(plan)).toEqual([])
    // Discriminating: the same plan is exactly what the optimizer does support.
    expect(() => buildOptimizerInput(plan, opts)).not.toThrow()
  })

  it('returns one registry-shaped reason per recorded action, naming the acting person', () => {
    const draft = tradHeavyPlan()
    draft.strategies.retirementActions = [identityWithdrawal(draft), legacyAggregate()]
    const plan = validate(draft)

    const reasons = optimizerUnsupportedRetirementActions(plan)
    expect(reasons).toHaveLength(2)
    for (const reason of reasons) {
      // Registry convention: code + the registry's own predicate/outcome/message,
      // and nothing a hand-written literal could drift from.
      expect(reason.code).toBe('optimizer-retirement-action-unsupported')
      expect(reason.predicate).toBe(REGISTRY_ENTRY.predicate)
      expect(reason.outcome).toBe(REGISTRY_ENTRY.outcome)
      expect(reason.message).toBe(REGISTRY_ENTRY.message)
      expect(parseActionReason(reason)).toEqual({ ok: true, reason })
    }
    // Identity carried where the kind has one; a migrated aggregate names nobody.
    expect(reasons[0]!.personId).toBe('p1')
    expect(reasons[1]!.personId).toBeUndefined()
  })

  it('agrees with the last-resort invariant inside buildOptimizerInput', () => {
    const actionFree = validate(tradHeavyPlan())
    const draft = tradHeavyPlan()
    draft.strategies.retirementActions = [identityWithdrawal(draft)]
    const actionBearing = validate(draft)

    // The predicate is the gate and the throw is the backstop, so a plan the
    // predicate clears must never reach the throw, and vice versa. If these two
    // conditions drift, a surface that checks the predicate would dispatch a run
    // that dies on a raw engine string again.
    for (const [plan, refused] of [[actionFree, false], [actionBearing, true]] as const) {
      expect(optimizerUnsupportedRetirementActions(plan).length > 0).toBe(refused)
      let threw = false
      try {
        buildOptimizerInput(plan, opts)
      } catch {
        threw = true
      }
      expect(threw).toBe(refused)
    }

    // The probe-source overload is guarded too: convergence re-linearizes around
    // an incumbent plan, and that plan must clear the precondition as well.
    expect(() => buildOptimizerInput(actionFree, opts, actionBearing)).toThrow()
  })
})

/**
 * Slice 2 — the committed retirement-action movement the LP's recursion needs.
 *
 * These fixtures settle one question: for a plan that has ALREADY executed a
 * $50,000 ordinary withdrawal from a $150,000 owned taxable account in the
 * first projection year, what balance does the optimizer carry into year two?
 *
 * The two candidate readings predict different numbers, so a fixture that
 * cannot tell them apart proves nothing — the same discipline `describeRule`
 * enforces for registry rules, applied by hand here because the question is
 * about this engine's own linearization rather than about a statute.
 */
const TAXABLE_BUCKET_READINGS = {
  /**
   * Pre-action: the solver evolves the Plan snapshot's $150,000 as though the
   * executor's debit never happened. 1.04 × 150,000.
   */
  preActionPlanSnapshot: 156_000,
  /**
   * Post-action: the exact-cent executor already took $50,000, so $100,000 is
   * what grows. 1.04 × 100,000 — and the number the exact ledger itself reports
   * for the account at the end of 2026.
   */
  postActionCommittedLedger: 104_000,
} as const
/**
 * The ledger is the authority: it is the thing whose numbers the plan's owner
 * will actually live, and the LP exists to approximate it. The pre-action
 * reading is the defect — worse than fully blind, because `capitalGainsBase`
 * already carries the action's realized gain, so the solve prices the action's
 * tax and keeps its dollars.
 */
const ACCEPTED_TAXABLE_BUCKET: keyof typeof TAXABLE_BUCKET_READINGS =
  'postActionCommittedLedger'

const TAXABLE_BASIS_RATIO_READINGS = {
  /**
   * The opening ratio, before the year's action: (50,000 + 0) basis over
   * (50,000 + 50,000) balance. This is what `taxableBasisRatio` is DEFINED as,
   * and the LP's opening precedes every action.
   */
  openingAggregate: 0.5,
  /**
   * The ratio remaining after a $25,000 draw against the zero-basis account:
   * 50,000 basis over 75,000 balance. Rejected — not because the action leaves
   * the ratio untouched (it does not), but because a single opening ratio is
   * the documented v1 linearization and a committed action erodes it exactly
   * the way an ordinary discretionary taxable draw does. Re-anchoring on the
   * action alone would fix one erosion and leave the other, for a bound that
   * matches neither engine.
   */
  postActionRemaining: 2 / 3,
} as const
const ACCEPTED_TAXABLE_BASIS_RATIO: keyof typeof TAXABLE_BASIS_RATIO_READINGS =
  'openingAggregate'

describe('committed retirement-action movement in the optimizer bridge', () => {
  /** tradHeavyPlan's brokerage, owned by Pat and carrying a real $50k gain. */
  function actedTaxablePlan(): { plan: Plan; taxableId: string; actionFree: Plan } {
    const draft = tradHeavyPlan()
    const taxable = draft.accounts.find((account) => account.type === 'taxable')!
    if (taxable.type !== 'taxable') throw new Error('fixture lost its taxable account')
    // An unowned (joint) source is refused by the executor — the acting person
    // must be a recorded owner — so the fixture names one.
    taxable.ownerPersonId = 'p1'
    taxable.costBasis = 100_000
    const actionFree = validate(structuredClone(draft))
    draft.strategies.retirementActions = [
      committedWithdrawal('acted-taxable', taxable.id, 2026, 50_000),
    ]
    return { plan: validate(draft), taxableId: taxable.id, actionFree }
  }

  /** An identity-complete ordinary withdrawal the executor will actually commit. */
  function committedWithdrawal(
    actionId: string,
    sourceAccountId: string,
    year: number,
    dollars: number,
  ) {
    const cents = dollars * 100
    const parsed = parseRetirementActionRequest({
      actionId,
      kind: 'ordinaryWithdrawal',
      year,
      executionDate: `${year}-03-04`,
      executionSequence: 1,
      requestedAmount: cents,
      provenance: { source: 'manual' },
      personId: 'p1',
      allocations: [{
        allocationId: `${actionId}-allocation`,
        sourceAccountId,
        requestedAmount: cents,
      }],
      purpose: { kind: 'spending' },
    })
    if (!parsed.ok) throw new Error(parsed.issues.join('; '))
    return parsed.request
  }

  function probesFor(plan: Plan): OptimizerYearProbe[] {
    const probes: OptimizerYearProbe[] = []
    simulatePlan(plan, { ...opts, captureOptimizerInputs: (captured) => probes.push(captured) })
    return probes
  }

  it('reports the dollars the executor committed, not the dollars the request asked for', () => {
    const { plan, taxableId } = actedTaxablePlan()
    const probes: OptimizerYearProbe[] = []
    const ledger = simulatePlan(plan, {
      ...opts,
      captureOptimizerInputs: (captured) => probes.push(captured),
    })

    // The ledger's own answer, which the probe has to be able to reconstruct.
    expect(ledger.years[0]!.balances[taxableId]).toBeCloseTo(
      TAXABLE_BUCKET_READINGS[ACCEPTED_TAXABLE_BUCKET],
      6,
    )
    expect(probes[0]!.committedActionAccountMovement).toEqual([
      { accountId: taxableId, amount: -50_000 },
    ])
    // The proceeds are the other half: a withdrawal REALLOCATES, so the debit
    // without its cash credit would make the solver poorer than the household.
    expect(probes[0]!.committedActionProceeds).toBeCloseTo(50_000, 6)
    // Partially blind, which is the dangerous part: the realized gain is
    // already priced, so only the dollars were missing.
    expect(probes[0]!.capitalGainsBase).toBeCloseTo(16_666.67, 2)
    // Every later year committed nothing and must stay byte-identical.
    for (const probe of probes.slice(1)) {
      expect(probe.committedActionAccountMovement).toEqual([])
      expect(probe.committedActionProceeds).toBe(0)
    }
  })

  it('reports an exact-cent amount for endpoints that do not subtract exactly', () => {
    // The discriminator, stated before the plan exists. $100,000.02 and
    // $50,000.02 each round-trip through `ledgerCentsToPlanDollars` on their
    // own — that is all that function promises — but neither is exact in
    // binary, and their dollar difference lands a ULP off the cent:
    //   50000.02 − 100000.02 === −50000.00000000001
    // Differencing in CENTS and converting once gives exactly −50,000. This
    // assertion is here so the fixture cannot quietly stop discriminating.
    expect(5_000_002 / 100 - 10_000_002 / 100).not.toBe(-50_000)

    const draft = tradHeavyPlan()
    const taxable = draft.accounts.find((account) => account.type === 'taxable')!
    if (taxable.type !== 'taxable') throw new Error('fixture lost its taxable account')
    taxable.ownerPersonId = 'p1'
    taxable.balance = 100_000.02
    taxable.costBasis = 100_000.02
    draft.strategies.retirementActions = [
      committedWithdrawal('drifting-taxable', taxable.id, 2026, 50_000),
    ]
    const plan = validate(draft)
    const probe = probesFor(plan)[0]!

    // Object.is equality, not a tolerance. A sub-cent residue is not a rounding
    // nicety here: it rides into the LP's own coefficients, so the solver would
    // be handed a balance recursion the exact ledger never produced.
    expect(probe.committedActionAccountMovement).toHaveLength(1)
    const moved = probe.committedActionAccountMovement[0]!
    expect(moved.accountId).toBe(taxable.id)
    expect(moved.amount).toBe(-50_000)

    // And it survives the bridge into the bucket scalar the LP actually reads.
    const buckets = optimizerOpeningBuckets(plan)
    expect(committedActionMovementForYear(buckets.bucketByAccountId, probe)).toEqual({
      trad: 0,
      inheritedTrad: 0,
      other: 0,
      taxable: -50_000,
      proceeds: 50_000,
    })
  })

  it('lands the solver’s taxable bucket where the exact ledger lands it', async () => {
    const { plan, taxableId, actionFree } = actedTaxablePlan()
    const solverOpts = { ...opts, solver: { maxConversionPerYear: 0 } }
    const ledger = simulatePlan(plan, opts)
    const probes = probesFor(plan)

    // Every field but the movement comes from the real bridge, run on the
    // action-free twin (the precondition throw still refuses the acted plan —
    // slice 1's gate is untouched). The movement is the real bridge too:
    // `committedActionMovementForYear` is the exact function
    // `buildOptimizerInput` calls, fed the acted run's own probe.
    const bridged = buildOptimizerInput(actionFree, solverOpts)
    const buckets = optimizerOpeningBuckets(plan)
    const movement = committedActionMovementForYear(buckets.bucketByAccountId, probes[0]!)
    const preAction = { ...bridged, years: [bridged.years[0]!] }
    const postAction = {
      ...preAction,
      years: [{ ...preAction.years[0]!, committedActionMovement: movement }],
    }

    // The constraint text is the reading in the LP's own words: 1.04 × −50,000
    // leaves the taxable bucket, and the $50,000 of proceeds land in the cash
    // row beside `exogenousCash`.
    const lp = buildOptimizerModel(postAction).lp
    expect(lp).toContain(' taxable0: + 1 taxable1 - 1.04 taxable0 + 1.04 wtax0 = -52000')
    // The cash row: spendingNeed less the $50,000 of proceeds, so the surplus
    // routes to `save` and lands in the tax-free bucket the way it does in the
    // exact ledger, instead of vanishing along with the debited dollars.
    expect(lp).toMatch(/^ cash0: .* = -2565\.2$/m)
    expect(buildOptimizerModel(preAction).lp).toMatch(/^ cash0: .* = 47434\.8$/m)
    expect(buildOptimizerModel(preAction).lp).toContain(
      ' taxable0: + 1 taxable1 - 1.04 taxable0 + 1.04 wtax0 = 0',
    )

    const solvedPost = await optimizeSchedule(postAction)
    const solvedPre = await optimizeSchedule(preAction)
    expect(solvedPost.status).toBe('optimal')
    expect(solvedPre.status).toBe('optimal')
    // The whole point: the two readings predict different balances, and the
    // accepted one is the ledger's.
    expect(solvedPre.schedule[0]!.endTaxable).toBeCloseTo(
      TAXABLE_BUCKET_READINGS.preActionPlanSnapshot,
      2,
    )
    expect(solvedPost.schedule[0]!.endTaxable).toBeCloseTo(
      TAXABLE_BUCKET_READINGS[ACCEPTED_TAXABLE_BUCKET],
      2,
    )
    expect(solvedPost.schedule[0]!.endTaxable).toBeCloseTo(
      ledger.years[0]!.balances[taxableId]!,
      2,
    )
  })

  it('leaves every bucket scalar unchanged when plan.accounts is reordered', () => {
    const { plan, taxableId } = actedTaxablePlan()
    const probe = probesFor(plan)[0]!
    const canonicalBuckets = optimizerOpeningBuckets(plan)
    const canonicalMovement = committedActionMovementForYear(
      canonicalBuckets.bucketByAccountId,
      probe,
    )

    const permutations = (accounts: Plan['accounts']): Plan['accounts'][] =>
      accounts.length <= 1
        ? [accounts]
        : accounts.flatMap((account, index) =>
          permutations([...accounts.slice(0, index), ...accounts.slice(index + 1)])
            .map((rest) => [account, ...rest]),
        )

    const orders = permutations(plan.accounts)
    expect(orders).toHaveLength(24)
    for (const accounts of orders) {
      const reordered = validate({ ...structuredClone(plan), accounts: structuredClone(accounts) })
      const buckets = optimizerOpeningBuckets(reordered)
      // The pre-action bug is invisible to order — both readings sum the same
      // way — so this fixture exists to catch the OTHER failure: a fix that
      // reaches the source account by position instead of by id.
      expect({
        openingTrad: buckets.openingTrad,
        openingInheritedTrad: buckets.openingInheritedTrad,
        openingOther: buckets.openingOther,
        openingTaxable: buckets.openingTaxable,
        taxableBasisRatio: buckets.taxableBasisRatio,
        buckets: [...buckets.bucketByAccountId].sort(),
      }).toEqual({
        openingTrad: canonicalBuckets.openingTrad,
        openingInheritedTrad: canonicalBuckets.openingInheritedTrad,
        openingOther: canonicalBuckets.openingOther,
        openingTaxable: canonicalBuckets.openingTaxable,
        taxableBasisRatio: canonicalBuckets.taxableBasisRatio,
        buckets: [...canonicalBuckets.bucketByAccountId].sort(),
      })
      expect(committedActionMovementForYear(buckets.bucketByAccountId, probe))
        .toEqual(canonicalMovement)
      // The ledger side is order-free too: the executor sorts its sources by
      // account id, so the probe never reports a different debit for the same
      // recorded action.
      expect(probesFor(reordered)[0]!.committedActionAccountMovement).toEqual([
        { accountId: taxableId, amount: -50_000 },
      ])
    }
  })

  it('moves only the acting household member’s account in a two-person plan', () => {
    const draft = tradHeavyPlan()
    draft.household.filingStatus = 'marriedFilingJointly'
    draft.household.people = [
      draft.household.people[0]!,
      {
        id: 'p2',
        name: 'Sam',
        dob: '1960-04-02',
        sex: 'average',
        retirementAge: 65,
        longevity: { planningAge: 85, source: 'manual' },
      },
    ]
    draft.accounts = [
      { type: 'traditional', id: 'pat-ira', name: 'Pat IRA', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 400_000, annualContribution: 0 },
      { type: 'taxable', id: 'pat-brokerage', name: 'Pat brokerage', ownerPersonId: 'p1', annualReturnPct: null, balance: 150_000, costBasis: 100_000, annualContribution: 0 },
      { type: 'traditional', id: 'sam-ira', name: 'Sam IRA', ownerPersonId: 'p2', annualReturnPct: null, kind: 'ira', balance: 400_000, annualContribution: 0 },
      { type: 'taxable', id: 'sam-brokerage', name: 'Sam brokerage', ownerPersonId: 'p2', annualReturnPct: null, balance: 150_000, costBasis: 100_000, annualContribution: 0 },
      { type: 'cash', id: 'joint-cash', name: 'Cash', ownerPersonId: 'p1', annualReturnPct: null, balance: 60_000, annualContribution: 0 },
    ]
    draft.strategies.retirementActions = [
      committedWithdrawal('pat-draw', 'pat-brokerage', 2026, 50_000),
    ]
    const plan = validate(draft)
    const buckets = optimizerOpeningBuckets(plan)
    const probe = probesFor(plan)[0]!
    const movement = committedActionMovementForYear(buckets.bucketByAccountId, probe)

    // Only Pat's brokerage moved. Sam's accounts are absent from the movement
    // entirely — not netted to zero, not merged into an aggregate.
    expect(probe.committedActionAccountMovement).toEqual([
      { accountId: 'pat-brokerage', amount: -50_000 },
    ])
    expect(movement).toEqual({
      trad: 0,
      inheritedTrad: 0,
      other: 0,
      taxable: -50_000,
      proceeds: 50_000,
    })
    // Sam's untouched dollars are still all there in the openings — the LP
    // aggregates the household, so an over-eager debit would show up here.
    expect(buckets.openingTrad).toBe(800_000)
    expect(buckets.openingTaxable).toBe(300_000)
    expect(buckets.openingOther).toBe(60_000)
    const ledger = simulatePlan(plan, opts).years[0]!
    expect(ledger.balances['sam-brokerage']).toBeCloseTo(156_000, 6)
    expect(ledger.balances['pat-brokerage']).toBeCloseTo(104_000, 6)
  })

  it('anchors the basis ratio (and the ACA bound it feeds) on the opening, not the remainder', () => {
    const raw = acaBridgePlan()
    raw.expenses.baseAnnual = 80_000
    raw.accounts = [
      { type: 'taxable', id: 'full-basis', name: 'Full-basis', ownerPersonId: 'p1', annualReturnPct: 0, balance: 50_000, costBasis: 50_000, annualContribution: 0 },
      { type: 'taxable', id: 'zero-basis', name: 'Zero-basis', ownerPersonId: 'p1', annualReturnPct: 0, balance: 50_000, costBasis: 0, annualContribution: 0 },
      { type: 'traditional', id: 'aca-ira', name: 'IRA', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 500_000, annualContribution: 0 },
      { type: 'roth', id: 'aca-roth', name: 'Roth', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 0, annualContribution: 0 },
    ]
    const actionFree = validate(structuredClone(raw))
    raw.strategies.retirementActions = [
      committedWithdrawal('zero-basis-draw', 'zero-basis', 2026, 25_000),
    ]
    const plan = validate(raw)
    const buckets = optimizerOpeningBuckets(plan)

    // Heterogeneous basis is what makes the readings differ: draining the
    // zero-basis account alone lifts the remaining aggregate ratio.
    expect(buckets.taxableBasisRatio).toBeCloseTo(
      TAXABLE_BASIS_RATIO_READINGS[ACCEPTED_TAXABLE_BASIS_RATIO],
      6,
    )
    expect(buckets.taxableBasisRatio).not.toBeCloseTo(
      TAXABLE_BASIS_RATIO_READINGS.postActionRemaining,
      3,
    )
    const probe = probesFor(plan)[0]!
    expect(probe.committedActionAccountMovement).toEqual([
      { accountId: 'zero-basis', amount: -25_000 },
    ])

    // The ACA bound the ratio feeds. Its gain weight applies to the LP's OWN
    // re-decided taxable draws (`incumbentTaxableWithdrawal`), which the ledger
    // keeps disjoint from action movement — so there is no double count with
    // the action's realized gain already inside the MAGI base.
    const gainWeight = 1 - buckets.taxableBasisRatio
    expect(gainWeight).toBeCloseTo(0.5, 6)
    // The action does not move the anchor: the opening precedes it, so the
    // acted plan and its action-free twin hand the LP the same ratio.
    expect(optimizerOpeningBuckets(actionFree).taxableBasisRatio)
      .toBe(buckets.taxableBasisRatio)
    // And that is the weight the real bridge puts on the ACA bound. Note what
    // the weight multiplies: `incumbentTaxableWithdrawal`, the LP's OWN
    // re-decided draws, which the ledger keeps disjoint from action movement.
    // The action's realized gain is already exact inside the MAGI base, so it
    // is not counted a second time here.
    const freeProbe = probesFor(actionFree)[0]!
    expect(freeProbe.incumbentTaxableWithdrawal).toBeGreaterThan(0)
    expect(buildOptimizerInput(actionFree, opts).years[0]!.acaMagiMax).toBeCloseTo(
      freeProbe.incumbentModeledMagiBeforeTaxableWithdrawalGains +
        gainWeight * freeProbe.incumbentTaxableWithdrawal +
        freeProbe.acaConversionMagiHeadroom!,
      6,
    )
  })

  it('refuses to drop movement it cannot place in a bucket', () => {
    const { plan } = actedTaxablePlan()
    const probe = probesFor(plan)[0]!

    // Silently dropping the entry is the defect itself, so the bridge fails
    // loudly instead of handing the solver dollars the ledger already moved.
    expect(() => committedActionMovementForYear(new Map(), probe)).toThrow(
      /carries in no balance bucket/,
    )
  })

  it('emits a byte-identical LP for an action-free plan', () => {
    const input = buildOptimizerInput(validate(tradHeavyPlan()), opts)

    expect(input.years.every((year) => year.committedActionMovement === undefined)).toBe(true)
    const withoutTheField = {
      ...input,
      years: input.years.map((modeled) => {
        const stripped = { ...modeled }
        delete stripped.committedActionMovement
        return stripped
      }),
    }
    expect(buildOptimizerModel(input).lp).toBe(buildOptimizerModel(withoutTheField).lp)
  })
})

describe('optimizePlan end-to-end', () => {
  it('fails closed while identity-bearing retirement actions are unsupported', () => {
    const plan = tradHeavyPlan()
    const action = parseRetirementActionRequest({
      actionId: 'optimizer-cash-action',
      kind: 'legacyAggregateWithdrawal',
      year: 2026,
      requestedAmount: 1_000,
      legacyCategory: 'cash',
      provenance: { source: 'migration' },
    })
    if (!action.ok) throw new Error(action.issues.join('; '))
    plan.strategies.retirementActions = [action.request]

    expect(() => buildOptimizerInput(validate(plan), opts)).toThrow(
      'optimizer does not yet support identity-bearing retirement actions',
    )
  })

  it('improves the after-tax estate vs the no-conversion baseline', async () => {
    const plan = validate(tradHeavyPlan())

    const baseline = summarizeProjection(plan, simulatePlan(plan, opts))

    const { schedule } = await optimizePlan(plan, opts)
    expect(schedule.status).toBe('optimal')
    const totalConversions = schedule.conversions.reduce((a, c) => a + c.amount, 0)
    expect(totalConversions).toBeGreaterThan(0)
    const rmdStartYear = 1958 + 73
    const bridgeConversions = schedule.conversions
      .filter((c) => c.year < rmdStartYear)
      .reduce((sum, c) => sum + c.amount, 0)
    expect(bridgeConversions).toBeGreaterThan(0)

    const optimizedPlan = validate(withOptimizedConversions(plan, schedule.conversions, '2026-06-17T00:00:00.000Z'))
    const exactLedger = simulatePlan(optimizedPlan, opts)
    const optimized = summarizeProjection(optimizedPlan, exactLedger)
    const validation = evaluateExactLedgerSchedule(plan, schedule.conversions, simulatePlan(plan, opts), exactLedger)

    // The optimizer's own objective is the after-tax estate; on the exact ledger
    // it must not trail the baseline (a tiny tolerance covers LP linearisation).
    expect(optimized.endingAfterTaxEstate).toBeGreaterThanOrEqual(baseline.endingAfterTaxEstate - 1)
    // And on this trad-heavy plan it should genuinely win.
    expect(optimized.endingAfterTaxEstate).toBeGreaterThan(baseline.endingAfterTaxEstate)
    expect(validation.recommendationState).toBe('identityIncomplete')
    // The real ledger, not the linear model, is the authority for the accepted
    // schedule. Spending withdrawals and RMDs can consume traditional balance
    // before a later LP-requested conversion, so the exact ledger may execute
    // less than the raw optimizer schedule, but never more.
    expect(optimized.lifetimeRothConversions).toBeGreaterThan(0)
    expect(optimized.lifetimeRothConversions).toBeLessThanOrEqual(totalConversions + 0.01)
    for (const conversion of schedule.conversions) {
      expect(exactLedger.years.find((y) => y.year === conversion.year)?.rothConversion ?? 0).toBeLessThanOrEqual(
        conversion.amount + 0.01,
      )
    }
  })

  it('does not regress when there is nothing to optimize (no traditional)', async () => {
    const plan = tradHeavyPlan()
    // Replace the traditional balance with Roth: no conversion can help.
    plan.accounts = plan.accounts.map((a) =>
      a.type === 'traditional' ? { ...a, type: 'roth' as const } : a,
    )
    const valid = validate(plan)
    const { schedule } = await optimizePlan(valid, opts)
    expect(schedule.status).toBe('optimal')
    expect(schedule.conversions.reduce((a, c) => a + c.amount, 0)).toBeCloseTo(0, 0)

    const baseline = summarizeProjection(valid, simulatePlan(valid, opts))
    const optimizedPlan = validate(withOptimizedConversions(valid, schedule.conversions, '2026-06-17T00:00:00.000Z'))
    const exact = summarizeProjection(optimizedPlan, simulatePlan(optimizedPlan, opts))
    expect(exact).toEqual(baseline)
  })

  it('reruns optimizer schedules through exact ACA healthcare costs', async () => {
    const plan = validate(acaBridgePlan())

    const { schedule } = await optimizePlan(plan, { ...opts, liquidationRatePct: 50 })
    expect(schedule.status).toBe('optimal')
    expect(schedule.conversions.reduce((sum, c) => sum + c.amount, 0)).toBeGreaterThan(0)

    const optimizedPlan = validate(withOptimizedConversions(plan, schedule.conversions, '2026-06-17T00:00:00.000Z'))
    const exact = simulatePlan(optimizedPlan, opts)

    expect(exact.warnings.some((w) => w.includes('400% of the federal poverty line'))).toBe(false)
    expect(exact.years.find((y) => y.year === 2026)!.aca?.readiness).toBe('actionable')
    expect(schedule.conversions[0]!.amount).toBeLessThanOrEqual(12_600.01)
    expect(exact.years.find((y) => y.year === 2026)!.expenses.healthcare).toBeLessThanOrEqual(12_000)
  })

  it('reconstructs a modeled ACA MAGI ceiling when re-probing an incumbent schedule', () => {
    const plan = validate(acaBridgePlan())
    const incumbent = withOptimizedConversions(plan, [{ year: 2026, amount: 5_000 }])
    const input = buildOptimizerInput(plan, opts, incumbent)
    const bound = input.years[0]!.acaMagiMax

    // Single-person 2025 HHS FPL ($15,650) × 400% minus the $50k
    // non-conversion income. Re-linearization translates the exact ledger's
    // remaining headroom onto the optimizer's modeled total-MAGI expression.
    expect(bound).toBeCloseTo(62_600, 0)
  })

  it('keeps a traditional-only ACA spending baseline feasible under the modeled MAGI cap', async () => {
    const plan = validate(acaTraditionalSpendingPlan())
    let probe: OptimizerYearProbe | undefined
    const baseline = simulatePlan(plan, {
      ...opts,
      captureOptimizerInputs: (captured) => {
        if (captured.year === 2026) probe = captured
      },
    }).years[0]!
    const input = buildOptimizerInput(plan, opts)
    const modeledYear = input.years[0]!
    const cap = modeledYear.acaMagiMax

    expect(baseline.aca?.readiness).toBe('actionable')
    expect(baseline.aca?.modeledAllowablePtc).toBeGreaterThan(0)
    expect(probe).toBeDefined()
    expect(probe!.incumbentModeledMagiBeforeTaxableWithdrawalGains).toBeCloseTo(
      baseline.withdrawals.traditional,
      2,
    )
    expect(cap).toBeCloseTo(62_600, 0)
    expect(cap).toBeCloseTo(
      probe!.incumbentModeledMagiBeforeTaxableWithdrawalGains +
        probe!.acaConversionMagiHeadroom!,
      6,
    )
    expect(buildOptimizerModel(input).lp).toContain(
      ' acamagi0: + 1 conv0 + 1 wt0 + 1 wi0 <= 62600',
    )

    const optimized = await optimizeSchedule(input)
    expect(optimized.status).toBe('optimal')
    const schedule = optimized.schedule[0]!
    const modeledMagi =
      modeledYear.ordinaryIncomeBase +
      (modeledYear.capitalGainsBase ?? 0) +
      schedule.conversion +
      schedule.withdrawTraditional +
      schedule.withdrawInheritedTraditional +
      schedule.taxableGainRealized
    expect(modeledMagi).toBeGreaterThan(0)
    expect(modeledMagi).toBeLessThanOrEqual(cap! + 0.01)
    expect(cap! - modeledMagi).toBeGreaterThanOrEqual(-0.01)
  })

  it('anchors ACA MAGI with the LP aggregate gain weight for heterogeneous taxable basis', async () => {
    const raw = acaBridgePlan()
    raw.expenses.baseAnnual = 80_000
    raw.accounts = [
      {
        type: 'taxable',
        id: testIds(),
        name: 'Full-basis first',
        ownerPersonId: null,
        annualReturnPct: 0,
        balance: 50_000,
        costBasis: 50_000,
        annualContribution: 0,
      },
      {
        type: 'taxable',
        id: testIds(),
        name: 'Zero-basis second',
        ownerPersonId: null,
        annualReturnPct: 0,
        balance: 50_000,
        costBasis: 0,
        annualContribution: 0,
      },
      {
        type: 'traditional',
        id: testIds(),
        name: 'IRA',
        ownerPersonId: 'p1',
        annualReturnPct: 0,
        kind: 'ira',
        balance: 500_000,
        annualContribution: 0,
      },
      {
        type: 'roth',
        id: testIds(),
        name: 'Roth',
        ownerPersonId: 'p1',
        annualReturnPct: 0,
        kind: 'ira',
        balance: 0,
        annualContribution: 0,
      },
    ]
    const plan = validate(raw)
    let probe: OptimizerYearProbe | undefined
    const baseline = simulatePlan(plan, {
      ...opts,
      captureOptimizerInputs: (captured) => {
        if (captured.year === 2026) probe = captured
      },
    }).years[0]!
    const input = buildOptimizerInput(plan, opts)
    const modeledYear = input.years[0]!

    expect(baseline.aca?.readiness).toBe('actionable')
    expect(baseline.aca?.modeledAllowablePtc).toBeGreaterThan(0)
    expect(baseline.realizedGains).toBeCloseTo(0, 2)
    expect(probe).toBeDefined()
    expect(probe!.incumbentTaxableWithdrawal).toBeGreaterThan(0)
    expect(input.taxableBasisRatio).toBeCloseTo(0.5, 6)
    expect(modeledYear.acaMagiMax).toBeCloseTo(
      probe!.incumbentModeledMagiBeforeTaxableWithdrawalGains +
        0.5 * probe!.incumbentTaxableWithdrawal +
        probe!.acaConversionMagiHeadroom!,
      6,
    )

    const optimized = await optimizeSchedule(input)
    expect(optimized.status).toBe('optimal')
    const schedule = optimized.schedule[0]!
    const modeledMagi =
      modeledYear.ordinaryIncomeBase +
      (modeledYear.capitalGainsBase ?? 0) +
      schedule.conversion +
      schedule.withdrawTraditional +
      schedule.withdrawInheritedTraditional +
      schedule.taxableGainRealized
    expect(modeledMagi).toBeLessThanOrEqual(modeledYear.acaMagiMax! + 0.01)
  })

  it('calibrates taxable Social Security with ACA provisional-income addbacks', async () => {
    const raw = acaBridgePlan()
    raw.expenses.baseAnnual = 20_000
    raw.incomes = [socialSecurityIncome('ss', 3_572, 62)]
    raw.assumptions.ssCola = { mode: 'fixed', annualPct: 0 }
    raw.assumptions.ssHaircut = null
    raw.expenses.healthcare.acaYears![0]!.taxExemptInterest = {
      state: 'known',
      amount: 25_000,
    }
    const plan = validate(raw)
    let probe: OptimizerYearProbe | undefined
    const baseline = simulatePlan(plan, {
      ...opts,
      captureOptimizerInputs: (captured) => {
        if (captured.year === 2026) probe = captured
      },
    }).years[0]!
    const input = buildOptimizerInput(plan, opts)
    const modeledYear = input.years[0]!

    expect(baseline.incomes.socialSecurity).toBeCloseTo(30_004.8, 2)
    expect(baseline.aca?.readiness).toBe('actionable')
    expect(baseline.aca?.householdMagi).toBeCloseTo(55_004.8, 2)
    expect(baseline.aca?.modeledAllowablePtc).toBeGreaterThan(0)
    expect(probe).toBeDefined()
    expect(probe!.taxableSsBase).toBeCloseTo(9_602.04, 2)
    expect(probe!.ssProvisionalIncomeAddbacks).toBeCloseTo(25_000, 2)
    expect(probe!.acaConversionMagiHeadroom).toBeCloseTo(7_595.2, 2)
    expect(modeledYear.ssTaxability?.provisionalIncomeAddbacks).toBeCloseTo(25_000, 2)

    const optimized = await optimizeSchedule(input)
    expect(optimized.status).toBe('optimal')
    expect(optimized.schedule[0]!.conversion).toBeLessThanOrEqual(7_595.21)
    const exact = simulatePlan(
      validate(withOptimizedConversions(plan, optimized.conversions)),
      opts,
    ).years[0]!
    expect(exact.aca?.readiness).toBe('actionable')
    expect(exact.aca?.modeledAllowablePtc).toBeGreaterThan(0)
    expect(exact.aca?.householdMagi).toBeLessThanOrEqual(62_600.01)
  })

  it.each([
    {
      name: 'above the cliff',
      mutate: (plan: Plan) => {
        const income = plan.incomes[0]
        if (income?.type !== 'recurring') throw new Error('ACA fixture income missing')
        income.annualAmount = 70_000
      },
    },
    {
      name: 'below the cliff with zero modeled PTC',
      mutate: (plan: Plan) => {
        const contract = plan.expenses.healthcare.acaYears![0]!
        for (const member of contract.coveredMembers) {
          member.enrollmentPremiumByMonth.fill(100)
          member.slcspBenchmarkPremiumByMonth.fill(100)
        }
      },
    },
  ])('does not emit a compressed ACA conversion cap when actionable ACA is $name', ({ mutate }) => {
    const plan = validate(acaBridgePlan())
    mutate(plan)
    const exact = simulatePlan(plan, opts).years[0]!
    expect(exact.aca?.readiness).toBe('actionable')
    expect(exact.aca?.modeledAllowablePtc).toBe(0)

    const input = buildOptimizerInput(plan, opts)
    expect(input.years[0]!.acaMagiMax).toBeUndefined()
    expect(buildOptimizerModel(input).lp).not.toContain('0 <= conv0 <= 0')
  })

  it('does not manufacture conversions from inherited-only traditional balances', async () => {
    const plan = validate(inheritedTraditionalPlan())
    const { schedule } = await optimizePlan(plan, opts)

    expect(schedule.conversions.reduce((sum, c) => sum + c.amount, 0)).toBeCloseTo(0, 0)
  })
})

describe('exact-ledger convergence loop (Step 1)', () => {
  const exactEstate = (plan: Plan, conversions: { year: number; amount: number }[]): number => {
    const withConv = validate(withOptimizedConversions(plan, conversions))
    return summarizeProjection(withConv, simulatePlan(withConv, opts)).endingAfterTaxEstate
  }

  const postProcessedForConvergence = (options: {
    delta: number
    stabilized?: boolean
    total?: number
    minimum?: number
    recommendationSchedule?: 'cleaned' | 'none'
    recommendationState?: 'beneficial' | 'neutral' | 'rejected' | 'unexecutable' | 'identityIncomplete'
  }) => ({
    cleanedSchedule: { conversions: [{ year: 2026, amount: options.total ?? 50_000 }] },
    cleanedValidation: {
      afterTaxEstateDelta: options.delta,
      recommendationState: options.recommendationState ?? 'beneficial',
    },
    stabilized: options.stabilized ?? true,
    minimumRequestedConversionDollars: options.minimum ?? 1,
    recommendationSchedule: options.recommendationSchedule ?? 'cleaned',
  }) as never

  it('compares only calculation-eligible post-processed convergence schedules', () => {
    const validConverged = postProcessedForConvergence({ delta: 10_000 })
    const invalidFirst = postProcessedForConvergence({
      delta: 50_000,
      stabilized: false,
      recommendationSchedule: 'none',
    })
    expect(selectConvergencePostProcessing(invalidFirst, validConverged)).toBe('converged')

    const validFirst = postProcessedForConvergence({ delta: 5_000 })
    const invalidConverged = postProcessedForConvergence({
      delta: 40_000,
      total: 0,
      minimum: 1,
      recommendationSchedule: 'none',
      recommendationState: 'unexecutable',
    })
    expect(selectConvergencePostProcessing(validFirst, invalidConverged)).toBe('first-solve')
  })

  it('loop disabled reproduces the pre-convergence schedule exactly', async () => {
    const plan = validate(ssTorpedoPlan())
    const base = await optimizePlan(plan, opts)
    const oneIteration = await optimizePlan(plan, { ...opts, convergence: { maxIterations: 1 } })

    // Default and a one-iteration cap are the single-solve path: byte-identical
    // schedule and a disabled-diagnostics stamp.
    expect(base.convergence.enabled).toBe(false)
    expect(oneIteration.convergence.enabled).toBe(false)
    // Schedule content is identical (solveMs is a wall-clock field, not output).
    expect(oneIteration.schedule.status).toEqual(base.schedule.status)
    expect(oneIteration.schedule.conversions).toEqual(base.schedule.conversions)
    expect(oneIteration.schedule.schedule).toEqual(base.schedule.schedule)
    expect(oneIteration.tournament.winnerConversions).toEqual(base.tournament.winnerConversions)
  })

  it('converges to a stable schedule under the exact-ledger loop', async () => {
    const plan = validate(ssTorpedoPlan())
    const { schedule, convergence } = await optimizePlan(plan, { ...opts, convergence: { maxIterations: 5 } })

    expect(schedule.status).toBe('optimal')
    expect(convergence.enabled).toBe(true)
    expect(convergence.iterations).toBeGreaterThanOrEqual(2)
    expect(convergence.iterations).toBeLessThanOrEqual(5)
    // The monotone guard never adopts a step the exact ledger prices worse, so
    // the loop can only raise the exact after-tax estate over the first solve.
    expect(convergence.estateGainOverFirstSolveDollars).toBeGreaterThanOrEqual(-0.01)
  })

  it('taxable-SS modeling prices the torpedo: PWL solve beats fixed-base, loop never regresses it', async () => {
    const plan = validate(ssTorpedoPlan())

    // Fixed-base control: the same input with the in-solve taxable-SS PWL
    // stripped, i.e. the historical LP that holds the probe-time taxable-SS
    // constant. It under-prices the torpedo and over-converts past break-even
    // given the modest 10% heir haircut.
    const input = buildOptimizerInput(plan, opts)
    const fixedBaseInput = { ...input, years: input.years.map((y) => ({ ...y, ssTaxability: undefined })) }
    const [pwlSolve, fixedSolve] = await Promise.all([
      optimizeSchedule(input),
      optimizeSchedule(fixedBaseInput),
    ])
    const pwlEstate = exactEstate(plan, pwlSolve.conversions)
    const fixedEstate = exactEstate(plan, fixedSolve.conversions)
    // The in-solve PWL sees the marginal torpedo (each conversion dollar drags
    // 50–85¢ of SS into taxability) and re-sizes; the fixed-base LP cannot
    // (~+$19k of exact estate on this fixture at the time of writing).
    expect(pwlEstate).toBeGreaterThan(fixedEstate + 1_000)

    // And the convergence loop can only sharpen the PWL solve, never regress it.
    const converged = await optimizePlan(plan, { ...opts, convergence: { maxIterations: 5 } })
    const convergedEstate = exactEstate(plan, converged.schedule.conversions)
    expect(convergedEstate).toBeGreaterThanOrEqual(pwlEstate - 0.01)
  })

  it('treats a fractional or sub-2 iteration cap as disabled (no false enabled stamp)', async () => {
    const plan = validate(ssTorpedoPlan())
    // 1.5 floors to a single solve: the guard must agree with the loop and not
    // report enabled: true while running zero iterations.
    const fractional = await optimizePlan(plan, { ...opts, convergence: { maxIterations: 1.5 } })
    expect(fractional.convergence.enabled).toBe(false)
    const base = await optimizePlan(plan, opts)
    expect(fractional.schedule.conversions).toEqual(base.schedule.conversions)
  })

  it('does not run convergence under a non-estate objective policy', async () => {
    // The loop's guard is after-tax estate, so re-linearizing toward estate
    // could remove the schedule a lifetime-tax/durability policy would prefer.
    // Under a non-default policy the loop must stay off (today's single solve).
    const plan = validate(ssTorpedoPlan())
    const requested = await optimizePlan(plan, {
      ...opts,
      policy: minimizeLifetimeTaxWithEstateFloor,
      convergence: { maxIterations: 5 },
    })
    const single = await optimizePlan(plan, { ...opts, policy: minimizeLifetimeTaxWithEstateFloor })

    expect(requested.convergence.enabled).toBe(false)
    expect(requested.schedule.conversions).toEqual(single.schedule.conversions)
    expect(requested.schedule.schedule).toEqual(single.schedule.schedule)
  })

  it('keeps the converged schedule gated by the exact-ledger tournament', async () => {
    // Heir tax 0 and a one-year horizon: conversions carry current tax with no
    // estate offset, so nothing the loop produces may be priced worse than the
    // no-conversion baseline once the tournament has gated it.
    const plan = validate(taxableConversionCostPlan())
    const { tournament } = await optimizePlan(plan, { ...opts, convergence: { maxIterations: 5 } })

    const baselineEstate = exactEstate(plan, [])
    const recommendedEstate = exactEstate(plan, tournament.winnerConversions)
    expect(recommendedEstate).toBeGreaterThanOrEqual(baselineEstate - 1)
    // A recommended schedule is never one the exact ledger rejects/can't execute.
    if (tournament.winnerValidation) {
      expect(['beneficial', 'neutral']).toContain(tournament.winnerValidation.recommendationState)
    }
  })
})

describe('co-optimized SS claim age (Step 5)', () => {
  /**
   * Single retiree at 62 currently claiming SS immediately, with a big
   * traditional balance and cash to bridge. Delaying the claim to 70 opens a
   * long window of low-income years where conversions fill cheap brackets — a
   * case where the joint (claim, conversion) optimum can beat either lever alone.
   */
  function bridgeClaimPlan(): Plan {
    const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
    plan.household.people[0] = {
      id: 'p1',
      name: 'Pat',
      dob: '1964-01-01', // age 62 in 2026
      sex: 'average',
      retirementAge: 62,
      longevity: { planningAge: 92, source: 'manual' },
    }
    plan.assumptions.inflationPct = 0
    plan.assumptions.defaultReturnPct = 4
    plan.assumptions.stateEffectiveTaxPct = 0
    plan.assumptions.heirTaxRatePct = 30
    plan.expenses.baseAnnual = 45_000
    plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
    plan.incomes = [socialSecurityIncome('ss', 2_600, 62)] // currently claims at 62
    plan.accounts = [
      { type: 'traditional', id: testIds(), name: 'IRA', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 1_000_000, annualContribution: 0 },
      { type: 'roth', id: testIds(), name: 'Roth', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 0, annualContribution: 0 },
      { type: 'cash', id: testIds(), name: 'Cash', ownerPersonId: null, annualReturnPct: null, balance: 300_000, annualContribution: 0 },
    ]
    return plan
  }

  it('withholds a claim patch whose winning joint schedule is not actionable', async () => {
    const plan = validate(bridgeClaimPlan())
    const joint = await optimizePlanCoOptimizingClaimAge(plan, { ...opts, convergence: { maxIterations: 4 } })

    // Bounded grid actually ran, but aggregate conversion schedules are
    // identity-incomplete. The claim and schedule are a joint recommendation,
    // so the public result must not expose the claim change by itself.
    expect(joint.claimAge.enabled).toBe(true)
    expect(joint.claimAge.combinationsEvaluated).toBeGreaterThan(1)
    expect(joint.claimAge.jointExactEstate).toBeGreaterThanOrEqual(joint.claimAge.currentClaimExactEstate - 1)
    expect(joint.claimAge.winningClaimLabel).toBeNull()
    expect(joint.claimAge.winningClaimPatch).toBeNull()
    expect(joint.optimizedPlan.incomes).toEqual(plan.incomes)
    expect(joint.tournament.retirementActionReadinessVeto).not.toBeNull()
  })
})

describe('optimizer regression fixtures', () => {
  it('trims Coast FIRE conversions the exact ledger cannot execute and recommends only the cleaned schedule', async () => {
    const plan = validate(coastFireGapPlan())
    const baseline = simulatePlan(plan, opts)
    expect(baseline.depletionYear).toBeNull() // the plan itself is solvent

    const { schedule, postProcessed } = await optimizePlan(plan, opts)
    expect(schedule.status).toBe('optimal')
    expect(postProcessed).not.toBeNull()
    const processed = postProcessed!

    // The regression: the LP's blended-growth traditional keeps compounding, so
    // it requests far more conversion than the $300k that ever exists. The
    // exact ledger executes at most the real balance before spending drains it.
    const requestedTotal = schedule.conversions.reduce((sum, c) => sum + c.amount, 0)
    expect(requestedTotal).toBeGreaterThan(400_000)
    expect(processed.rawValidation.executedConversionTotal).toBeLessThanOrEqual(300_000 + 1)
    expect(processed.rawValidation.executedConversionRatio).toBeLessThan(0.75)
    expect(processed.rawValidation.firstMateriallyUnexecutedYear).not.toBeNull()
    expect(processed.rawValidation.traditionalDepletionYear).not.toBeNull()
    expect(processed.rawValidation.firstMateriallyUnexecutedYear).toBeGreaterThanOrEqual(
      processed.rawValidation.traditionalDepletionYear!,
    )

    // Post-processing must drop the impossible late years (recorded as
    // adjustments) and produce a schedule the ledger executes in full.
    expect(processed.adjustments.some((a) => a.reason === 'dropped-zero')).toBe(true)
    expect(processed.stabilized).toBe(true)
    const cleanedTotal = processed.cleanedSchedule.conversions.reduce((sum, c) => sum + c.amount, 0)
    expect(cleanedTotal).toBeLessThan(requestedTotal)
    expect(processed.cleanedValidation.executedConversionRatio).toBeCloseTo(1, 6)

    // Dropping unexecutable years preserves the beneficial exact calculation,
    // but the cleaned aggregate schedule is still not recommendable.
    expect(processed.cleanedValidation.afterTaxEstateDelta).toBeGreaterThan(0)
    expect(processed.cleanedValidation.recommendationState).toBe('identityIncomplete')
    expect(processed.recommendationSchedule).toBe('none')
  })

  it('does not mark contribution-funded exact plans infeasible', async () => {
    const plan = validate(contributionAccumulatorPlan())
    const baseline = simulatePlan(plan, opts)
    expect(baseline.depletionYear).toBeNull() // the exact ledger lasts to the end

    // The probe folds the scheduled contribution (the 60k request,
    // ledger-capped to the 401k limit with catch-up, ~32.5k) into spending
    // AND reports it as a traditional-bucket inflow, so the compressed
    // balances receive the same deposits the exact ledger applies.
    const input = buildOptimizerInput(plan, opts)
    expect(input.openingTrad).toBe(50_000)
    const y2026 = input.years.find((year) => year.year === 2026)!
    expect(y2026.spendingNeed).toBeGreaterThan(50_000 + 25_000)
    expect(y2026.tradInflow).toBeCloseTo(y2026.spendingNeed - 50_000, 2)
    expect(y2026.otherInflow).toBe(0)
    // Contributions stop at retirement (62 in 2033): no phantom late inflows.
    const y2035 = input.years.find((year) => year.year === 2035)!
    expect(y2035.tradInflow).toBe(0)

    // The formerly false-infeasible solve now succeeds: the low-income bridge
    // years (retirement at 62 to SS at 67) plus the 25% heir haircut make
    // conversions worth requesting, so post-processing runs — deterministic
    // for a fixed model — and the recommendation flows through the
    // exact-ledger gate like any other schedule.
    const { schedule, postProcessed } = await optimizePlan(plan, opts)
    expect(schedule.status).toBe('optimal')
    expect(schedule.conversions.reduce((sum, c) => sum + c.amount, 0)).toBeGreaterThan(0)
    expect(postProcessed).not.toBeNull()
    expect(postProcessed!.cleanedValidation.recommendationState).toBe('identityIncomplete')
    expect(postProcessed!.cleanedValidation.moneyLastsYearsDelta).toBeGreaterThanOrEqual(0)
    expect(postProcessed!.recommendationSchedule).toBe('none')
    expect(postProcessed!.cleanedValidation.afterTaxEstateDelta).toBeGreaterThanOrEqual(-1)
  })
})

/**
 * Parameterized single-retiree fixture for the account-mix / income-timing /
 * liquidity-source matrix (validation plan tables). Retired at start (1960,
 * planning age 90), 3% blended return unless overridden.
 */
function matrixPlan(shape: {
  heir?: number
  spending?: number
  trad?: number
  cash?: number
  taxable?: { balance: number; basis: number }
  ssPia?: number
  ssClaim?: number
}): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1960-01-01',
    sex: 'average',
    retirementAge: null,
    longevity: { planningAge: 90, source: 'manual' },
  }
  plan.assumptions.inflationPct = 0
  plan.assumptions.defaultReturnPct = 3
  plan.assumptions.stateEffectiveTaxPct = 0
  plan.assumptions.heirTaxRatePct = shape.heir ?? 25
  plan.expenses.baseAnnual = shape.spending ?? 50_000
  plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
  plan.accounts = [
    { type: 'traditional', id: testIds(), name: 'IRA', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: shape.trad ?? 0, annualContribution: 0 },
    { type: 'roth', id: testIds(), name: 'Roth', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 0, annualContribution: 0 },
    { type: 'cash', id: testIds(), name: 'Cash', ownerPersonId: null, annualReturnPct: null, balance: shape.cash ?? 0, annualContribution: 0 },
  ]
  if (shape.taxable) {
    plan.accounts.push({ type: 'taxable', id: testIds(), name: 'Brokerage', ownerPersonId: null, annualReturnPct: null, balance: shape.taxable.balance, costBasis: shape.taxable.basis, annualContribution: 0 })
  }
  if (shape.ssPia) {
    plan.incomes = [
      { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: shape.ssPia, earnings: null, claimAge: { years: shape.ssClaim ?? 67, months: 0 } },
    ]
  }
  return plan
}

describe('fixture matrix (account mix, income timing, liquidity source)', () => {
  it('keeps minimal-traditional recommendations small and exact-ledger beneficial', async () => {
    const plan = validate(matrixPlan({ trad: 25_000, cash: 400_000, spending: 30_000, ssPia: 2_000 }))
    const { schedule, postProcessed } = await optimizePlan(plan, opts)

    expect(schedule.status).toBe('optimal')
    expect(postProcessed).not.toBeNull()
    expect(postProcessed!.cleanedValidation.recommendationState).toBe('identityIncomplete')
    expect(postProcessed!.cleanedValidation.afterTaxEstateDelta).toBeGreaterThan(0)
    // A tiny IRA cannot justify a big schedule: conversions stay near the balance.
    expect(postProcessed!.cleanedValidation.executedConversionTotal).toBeLessThan(50_000)
  })

  it('scales conversion appetite with the heir tax rate', async () => {
    const heir0 = await optimizePlan(validate(matrixPlan({ heir: 0, trad: 700_000, cash: 300_000, ssPia: 2_500 })), opts)
    const heir37 = await optimizePlan(validate(matrixPlan({ heir: 37, trad: 700_000, cash: 300_000, ssPia: 2_500 })), opts)

    const requested = (r: typeof heir0) => r.schedule.conversions.reduce((sum, c) => sum + c.amount, 0)
    // With no heir haircut there is no estate arbitrage: only cheap low-bracket
    // conversions survive (they still cut lifetime tax by shrinking RMDs).
    expect(requested(heir0)).toBeGreaterThan(0)
    expect(requested(heir37)).toBeGreaterThan(2 * requested(heir0))
    expect(heir0.postProcessed!.cleanedValidation.recommendationState).toBe('identityIncomplete')
    expect(heir0.postProcessed!.cleanedValidation.lifetimeTaxDelta).toBeLessThan(0)
    expect(heir37.postProcessed!.cleanedValidation.recommendationState).toBe('identityIncomplete')
  })

  it('handles a household that works straight into Social Security (no bridge window)', async () => {
    const plan = matrixPlan({ trad: 600_000, cash: 150_000, ssPia: 2_800 })
    plan.household.people[0] = {
      id: 'p1',
      name: 'Pat',
      dob: '1961-01-01', // 65 in 2026, works to 67 then claims SS immediately
      sex: 'average',
      retirementAge: 67,
      longevity: { planningAge: 90, source: 'manual' },
    }
    plan.incomes.push({ type: 'wages', id: testIds(), personId: 'p1', annualGross: 120_000, endAge: null, realGrowthPct: 0 })
    const { schedule, postProcessed } = await optimizePlan(validate(plan), opts)

    // No low-income gap exists, so any recommendation must still clear the
    // exact-ledger gate rather than assume empty brackets.
    expect(schedule.status).toBe('optimal')
    expect(postProcessed!.cleanedValidation.recommendationState).toBe('identityIncomplete')
    expect(postProcessed!.cleanedValidation.executedConversionRatio).toBeGreaterThan(0.9)
  })

  it('keeps a mostly-traditional no-bridge household executable and beneficial', async () => {
    const plan = validate(matrixPlan({ trad: 800_000, cash: 20_000, ssPia: 2_500 }))
    const { postProcessed } = await optimizePlan(plan, opts)

    // Historically the raw schedule over-requested badly here (spending drains
    // traditional for living costs) and the trim+prune pipeline had to repair
    // it; with the in-solve taxable-SS PWL and unscaled-deduction fidelity the
    // raw solve now sizes executably on its own. Either way, the cleaned
    // schedule must be fully executed, preserve its exact calculation, and
    // never request more than the raw solve did.
    expect(postProcessed!.cleanedValidation.executedConversionRatio).toBeCloseTo(1, 6)
    expect(postProcessed!.cleanedValidation.recommendationState).toBe('identityIncomplete')
    expect(postProcessed!.cleanedValidation.executedConversionTotal).toBeLessThanOrEqual(
      postProcessed!.rawValidation.requestedConversionTotal + 1,
    )
  })

  it('prices taxable-bridge basis through the exact ledger', async () => {
    const high = await optimizePlan(
      validate(matrixPlan({ trad: 500_000, cash: 20_000, taxable: { balance: 500_000, basis: 480_000 }, ssPia: 2_500, ssClaim: 70 })),
      opts,
    )
    const low = await optimizePlan(
      validate(matrixPlan({ trad: 500_000, cash: 20_000, taxable: { balance: 500_000, basis: 100_000 }, ssPia: 2_500, ssClaim: 70 })),
      opts,
    )

    // Same conversions either way, but the low-basis bridge realizes capital
    // gains to fund spending and conversion taxes — the exact ledger prices
    // that, shrinking the estate win and raising lifetime tax.
    expect(high.postProcessed!.cleanedValidation.recommendationState).toBe('identityIncomplete')
    expect(low.postProcessed!.cleanedValidation.recommendationState).toBe('identityIncomplete')
    expect(high.postProcessed!.cleanedValidation.afterTaxEstateDelta).toBeGreaterThan(
      low.postProcessed!.cleanedValidation.afterTaxEstateDelta + 20_000,
    )
    expect(low.postProcessed!.cleanedValidation.lifetimeTaxDelta).toBeGreaterThan(
      high.postProcessed!.cleanedValidation.lifetimeTaxDelta,
    )
  })

  it('finds pre-death conversions for the survivor phase and prices the filing-status flip', async () => {
    const plan = matrixPlan({ trad: 900_000, cash: 200_000 })
    plan.household.filingStatus = 'marriedFilingJointly'
    plan.household.people = [
      plan.household.people[0]!,
      { id: 'p2', name: 'Sam', dob: '1960-01-01', sex: 'average', retirementAge: null, longevity: { planningAge: 70, source: 'manual' } },
    ]
    plan.incomes = [
      { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 2_000, earnings: null, claimAge: { years: 67, months: 0 } },
      { type: 'socialSecurity', id: testIds(), personId: 'p2', piaMonthly: 2_800, earnings: null, claimAge: { years: 67, months: 0 } },
    ]
    const { postProcessed } = await optimizePlan(validate(plan), opts)

    // Converting in cheap MFJ years before the survivor's single brackets is
    // the classic widow's-penalty play; the exact ledger confirms it here.
    expect(postProcessed!.cleanedValidation.recommendationState).toBe('identityIncomplete')
    expect(postProcessed!.cleanedValidation.executedConversionTotal).toBeGreaterThan(500_000)
    expect(postProcessed!.cleanedValidation.afterTaxEstateDelta).toBeGreaterThan(50_000)
  })

  it('carries employer match into optimizer balances end-to-end', async () => {
    const plan = matrixPlan({ trad: 60_000, cash: 30_000, spending: 55_000, ssPia: 2_500 })
    plan.household.people[0] = {
      id: 'p1',
      name: 'Pat',
      dob: '1971-01-01',
      sex: 'average',
      retirementAge: 62,
      longevity: { planningAge: 82, source: 'manual' },
    }
    plan.accounts = plan.accounts.map((a) =>
      a.type === 'traditional'
        ? { ...a, kind: 'employer' as const, annualContribution: 20_000, employerMatch: { matchPct: 50, capPctOfPay: 6 } }
        : a,
    )
    plan.incomes.push({ type: 'wages', id: testIds(), personId: 'p1', annualGross: 140_000, endAge: null, realGrowthPct: 0 })
    const valid = validate(plan)

    const baseline = simulatePlan(valid, opts)
    expect(baseline.depletionYear).toBeNull()
    // 20k employee contribution + 50% match on the first 6% of 140k wages
    // (4.2k) both land in the traditional bucket inflow.
    const input = buildOptimizerInput(valid, opts)
    const y2026 = input.years.find((year) => year.year === 2026)!
    expect(y2026.tradInflow).toBeGreaterThan(21_000)
    expect(y2026.tradInflow).toBeLessThan(30_000)

    const { schedule, postProcessed } = await optimizePlan(valid, opts)
    expect(schedule.status).toBe('optimal')
    expect(postProcessed!.cleanedValidation.recommendationState).toBe('identityIncomplete')
  })
})

describe('exact-ledger candidate tournament', () => {
  it('keeps simple bracket-fill calculations but does not recommend an aggregate winner', async () => {
    const plan = validate(tradHeavyPlan())
    const { postProcessed, tournament } = await optimizePlan(plan, opts)

    // The regression the tournament exists for: the LP's linearisation
    // over-converts on this mainstream trad-heavy household, while a plain
    // 10%-bracket fill roughly doubles the exact-ledger estate gain — and the
    // windowed 12%-fill (stop when reserves deplete) does better still.
    const bracket10 = tournament.candidates.find((c) => c.id === 'bracket-10')!
    expect(bracket10.afterTaxEstateDelta).toBeGreaterThan(
      postProcessed!.cleanedValidation.afterTaxEstateDelta + 10_000,
    )
    expect(tournament.winnerSource).toBe('none')
    expect(tournament.winnerCandidateId).toBeNull()
    expect(tournament.winnerValidation).toBeNull()
    expect(tournament.winnerConversions).toEqual([])
  })

  it('withholds a calculated MILP schedule and a shorter-lasting candidate', async () => {
    const plan = validate(tradHeavyPlan())
    const baseline = simulatePlan(plan, opts)
    const { postProcessed } = await optimizePlan(plan, opts)
    const processed = postProcessed!
    const longerLastingMilp = {
      ...processed,
      cleanedResult: {
        ...processed.cleanedResult,
        depletionYear: null,
        endYear: processed.cleanedResult.endYear + 1,
      },
    }

    const tournament = runExactLedgerTournament(plan, baseline, longerLastingMilp, opts)

    // The candidate still has the better exact-estate delta; only the
    // money-lasts guardrail against the recommendable MILP keeps it from
    // displacing that schedule.
    expect(Math.max(...tournament.candidates.map((c) => c.afterTaxEstateDelta))).toBeGreaterThan(
      processed.cleanedValidation.afterTaxEstateDelta + 10_000,
    )
    expect(tournament.winnerSource).toBe('none')
    expect(tournament.winnerConversions).toEqual([])
  })

  it('withholds the MILP schedule when every simple candidate is exact-ledger worse', async () => {
    const plan = validate(coastFireGapPlan())
    const baseline = simulatePlan(plan, opts)
    const { tournament } = await optimizePlan(plan, opts)

    // Blanket fills drain the flat-return traditional into taxed conversions
    // this household never benefits from; the trimmed MILP schedule wins.
    const candidates = evaluateSimpleConversionCandidates(plan, baseline, opts)
    for (const candidate of candidates) expect(candidate.afterTaxEstateDelta).toBeLessThanOrEqual(0)
    expect(candidates.some((candidate) => candidate.afterTaxEstateDelta < 0)).toBe(true)
    expect(tournament.winnerSource).toBe('none')
    expect(tournament.winnerConversions).toEqual([])
  })

  it('keeps every ACA-sensitive tournament winner behind actionable exact-ledger evidence', async () => {
    const plan = validate(acaBridgePlan())
    const { tournament } = await optimizePlan(plan, { ...opts, liquidationRatePct: 50 })

    // Here the best simple candidate lands within a few hundred dollars of the
    // cleaned MILP schedule — inside the switch margin, so the MILP holds.
    const winning = simulatePlan(withOptimizedConversions(plan, tournament.winnerConversions), opts)
    expect(
      winning.years.filter((year) => year.aca).every((year) => year.aca?.readiness === 'actionable'),
    ).toBe(true)
  })

  it('cannot rank or apply a candidate whose exact ACA ledger is non-actionable', () => {
    const raw = acaBridgePlan()
    for (const contract of raw.expenses.healthcare.acaYears ?? []) {
      contract.taxExemptInterest = { state: 'unknown', amount: null }
    }
    const plan = validate(raw)
    const baseline = simulatePlan(plan, opts)
    const conversions = [{ year: 2026, amount: 5_000 }]
    const candidate = simulatePlan(withOptimizedConversions(plan, conversions), opts)
    const validation = evaluateExactLedgerSchedule(plan, conversions, baseline, candidate)

    expect(['diagnostic', 'unexecutable']).toContain(validation.recommendationState)
    expect(candidate.years.some((year) => year.aca?.readiness === 'nonActionable')).toBe(true)

    const tournament = runExactLedgerTournament(plan, baseline, null, opts)
    expect(tournament.winnerConversions).toEqual([])
    expect(['incumbent', 'none']).toContain(tournament.winnerSource)

    // The fallback explains itself: the veto diagnostic names the years whose
    // ACA evidence blocked every schedule and the codes that said so.
    const veto = tournament.acaActionabilityVeto
    expect(veto).not.toBeNull()
    expect(veto!.baselineNonActionableYears).toContain(2026)
    expect(veto!.supportCodes.length).toBeGreaterThan(0)
    // Structured-clone safe: the diagnostic crosses the worker boundary as-is.
    expect(() => structuredClone(tournament)).not.toThrow()
  })

  describe('buildAcaActionabilityVeto', () => {
    // Only `years[].aca` and `years[].year` are read; everything else on a
    // YearResult is irrelevant to the veto evidence.
    const acaResult = (
      years: { year: number; aca?: { readiness: 'actionable' | 'nonActionable'; supportCodes: string[] } }[],
    ): ProjectionResult => ({ years }) as unknown as ProjectionResult
    const actionable = (year: number) => ({ year, aca: { readiness: 'actionable' as const, supportCodes: [] } })
    const unsourced = (year: number) => ({
      year,
      aca: { readiness: 'nonActionable' as const, supportCodes: ['tax-year-parameters-unsupported'] },
    })

    it('returns null when no evaluated projection has a non-actionable ACA year', () => {
      const veto = buildAcaActionabilityVeto(
        acaResult([actionable(2026)]),
        [{ id: 'bracket-10', improves: true, result: acaResult([actionable(2026)]) }],
        null,
      )
      expect(veto).toBeNull()
    })

    it('suppresses a candidate-only veto when an improving actionable row was blocked by something else', () => {
      // The non-actionable best candidate was ACA-vetoed, but an actionable
      // improving row also lost — claiming "nothing was actionable" is false.
      const veto = buildAcaActionabilityVeto(
        acaResult([actionable(2026)]),
        [
          { id: 'bracket-22', improves: true, result: acaResult([actionable(2026), unsourced(2027)]) },
          { id: 'bracket-10', improves: true, result: acaResult([actionable(2026)]) },
        ],
        null,
      )
      expect(veto).toBeNull()
    })

    it('reports a candidate-only veto when it covers every improving row', () => {
      const veto = buildAcaActionabilityVeto(
        acaResult([actionable(2026)]),
        [
          { id: 'bracket-22', improves: true, result: acaResult([actionable(2026), unsourced(2027)]) },
          { id: 'bracket-10', improves: false, result: acaResult([actionable(2026)]) },
        ],
        null,
      )
      expect(veto).not.toBeNull()
      expect(veto!.baselineNonActionableYears).toEqual([])
      expect(veto!.candidateNonActionableYears).toEqual([2027])
      expect(veto!.supportCodes).toEqual(['tax-year-parameters-unsupported'])
      expect(veto!.vetoedCandidateIds).toEqual(['bracket-22'])
      expect(veto!.vetoedMilp).toBe(false)
    })

    it("reports the solver's schedule when it alone was ACA-vetoed", () => {
      // Baseline and simple candidates are actionable and non-improving; the
      // cleaned MILP projection alone goes non-actionable while its raw delta
      // is positive — the fallback must still explain itself.
      const veto = buildAcaActionabilityVeto(
        acaResult([actionable(2026)]),
        [{ id: 'bracket-10', improves: false, result: acaResult([actionable(2026)]) }],
        { improves: true, result: acaResult([actionable(2026), unsourced(2027)]) },
      )
      expect(veto).not.toBeNull()
      expect(veto!.vetoedMilp).toBe(true)
      expect(veto!.vetoedCandidateIds).toEqual([])
      expect(veto!.candidateNonActionableYears).toEqual([2027])
    })

    it('ignores a non-improving vetoed solver schedule', () => {
      // ACA blocked a schedule that would have been rejected anyway — the
      // fallback is an ordinary "nothing improved the plan".
      const veto = buildAcaActionabilityVeto(
        acaResult([actionable(2026)]),
        [{ id: 'bracket-10', improves: false, result: acaResult([actionable(2026)]) }],
        { improves: false, result: acaResult([actionable(2026), unsourced(2027)]) },
      )
      expect(veto).toBeNull()
    })

    it('sorts years and codes and keeps baseline years out of the schedule-only list', () => {
      const veto = buildAcaActionabilityVeto(
        acaResult([
          unsourced(2028),
          { year: 2026, aca: { readiness: 'nonActionable', supportCodes: ['other-material-facts-unsupported'] } },
        ]),
        [
          { id: 'bracket-10', improves: true, result: acaResult([unsourced(2028), unsourced(2029), unsourced(2026)]) },
          { id: 'bracket-12', improves: false, result: acaResult([unsourced(2028)]) },
        ],
        null,
      )
      expect(veto).not.toBeNull()
      expect(veto!.baselineNonActionableYears).toEqual([2026, 2028])
      expect(veto!.candidateNonActionableYears).toEqual([2029])
      expect(veto!.supportCodes).toEqual(['other-material-facts-unsupported', 'tax-year-parameters-unsupported'])
      expect(veto!.vetoedCandidateIds).toEqual(['bracket-10'])
    })
  })

  it('does not let an aggregate candidate win when the MILP has nothing to recommend', () => {
    // Force the no-MILP path directly: same trad-heavy plan, no post-processing.
    const plan = validate(tradHeavyPlan())
    const baseline = simulatePlan(plan, opts)
    const tournament = runExactLedgerTournament(plan, baseline, null, opts, {
      switchMarginDollars: Number.MAX_SAFE_INTEGER,
    })

    expect(tournament.winnerSource).toBe('none')
    expect(tournament.winnerCandidateId).toBeNull()
    expect(tournament.marginOverMilpDollars).toBe(0)
    expect(tournament.winnerValidation).toBeNull()
    expect(tournament.retirementActionReadinessVeto).toMatchObject({
      reason: 'identityIncomplete',
      vetoedWinnerSource: 'candidate',
      vetoedValidation: { recommendationState: 'identityIncomplete' },
    })
    expect(tournament.retirementActionReadinessVeto?.vetoedConversions.length).toBeGreaterThan(0)
    expect(calculatedConversions(tournament.retirementActionReadinessVeto!.vetoedResult))
      .toEqual(tournament.retirementActionReadinessVeto!.vetoedConversions)
  })

  it('holds an explicitly applied incumbent schedule when nothing beats it', () => {
    // Install an explicit schedule and run against that baseline: when no
    // candidate improves on it, the tournament reports the incumbent.
    const plan = validate(tradHeavyPlan())
    const appliedPlan = withOptimizedConversions(plan, [{ year: 2026, amount: 20_000 }])
    const appliedBaseline = simulatePlan(appliedPlan, opts)
    const rerun = runExactLedgerTournament(appliedPlan, appliedBaseline, null, opts)

    expect(rerun.winnerSource).toBe('incumbent')
    expect(rerun.winnerLabel).toBe('your applied optimizer schedule')
    expect(rerun.winnerValidation).toBeNull()
    // An ordinary "nothing beats the incumbent" fallback carries no ACA veto
    // diagnostic — the field must not cry wolf on non-ACA plans.
    expect(rerun.acaActionabilityVeto).toBeNull()
    // The reported schedule is the plan's own exact-executed conversions.
    const executedTotal = appliedBaseline.years.reduce((sum, y) => sum + y.rothConversion, 0)
    expect(rerun.winnerConversions.reduce((sum, c) => sum + c.amount, 0)).toBeCloseTo(executedTotal, 0)
  })

  it('does not report an incumbent for plans that never convert', () => {
    const plan = validate(pruneHopelessPlan()) // 0% heir rate: every conversion is pure cost
    const baseline = simulatePlan(plan, opts)
    const tournament = runExactLedgerTournament(plan, baseline, null, opts)
    expect(tournament.winnerSource).toBe('none')
    expect(tournament.winnerConversions).toEqual([])
  })
})

describe('objective-mode tournament (sustainable-spending plan, Step 5)', () => {
  it('stamps the default policy id while withholding aggregate winners', () => {
    const plan = validate(tradHeavyPlan())
    const baseline = simulatePlan(plan, opts)
    const tournament = runExactLedgerTournament(plan, baseline, null, opts)
    expect(tournament.policyId).toBe('max-after-tax-estate')
    expect(tournament.winnerSource).toBe('none')
    expect(tournament.winnerCandidateId).toBeNull()
    expect(tournament.retirementActionReadinessVeto).not.toBeNull()
  })

  it('re-ranks the same candidates under a different objective', () => {
    const plan = validate(tradHeavyPlan())
    const baseline = simulatePlan(plan, opts)

    // The estate objective calculates the same bracket-fill field, but cannot
    // publish an aggregate winner.
    const estate = runExactLedgerTournament(plan, baseline, null, opts)
    expect(estate.winnerSource).toBe('none')

    // …but conversions cannot make the money last longer here (it never
    // depletes either way), so the durability objective recommends nothing —
    // a different outcome from ranking the very same evaluations.
    const durability = runExactLedgerTournament(plan, baseline, null, opts, {
      policy: maximizeSpendingDurability,
    })
    expect(durability.policyId).toBe('max-spending-durability')
    expect(durability.winnerSource).toBe('none')
    expect(durability.candidates.map((c) => c.id)).toEqual(estate.candidates.map((c) => c.id))
  })

  it('preserves the identity-withholding reason when a policy-ranked winner falls back', () => {
    const plan = validate(tradHeavyPlan())
    const baseline = simulatePlan(plan, opts)
    const policy = {
      ...maximizeAfterTaxEstate,
      id: 'min-lifetime-tax-estate-floor' as const,
      label: 'Test policy-ranked estate objective',
    }

    const tournament = runExactLedgerTournament(plan, baseline, null, opts, { policy })

    expect(tournament.winnerSource).toBe('none')
    expect(tournament.retirementActionReadinessVeto).toMatchObject({
      reason: 'identityIncomplete',
      vetoedWinnerSource: 'candidate',
    })
    expect(tournament.retirementActionReadinessVeto?.vetoedCandidateId).not.toBeNull()
    expect(tournament.retirementActionReadinessVeto?.vetoedConversions.length).toBeGreaterThan(0)
    expect(tournament.retirementActionReadinessVeto?.vetoedValidation).toMatchObject({
      recommendationState: 'identityIncomplete',
    })
    const vetoedRow = tournament.candidates.find(
      (candidate) =>
        candidate.id === tournament.retirementActionReadinessVeto?.vetoedCandidateId,
    )
    expect(tournament.retirementActionReadinessVeto?.vetoedValidation.afterTaxEstateDelta)
      .toBeCloseTo(vetoedRow!.afterTaxEstateDelta, 6)
  })

  it('withholds a nonempty aggregate policy winner even when estate validation rejects it', () => {
    const plan = validate(coastFireGapPlan())
    const baseline = simulatePlan(plan, opts)
    const policy = {
      ...maximizeAfterTaxEstate,
      id: 'min-lifetime-tax-estate-floor' as const,
      label: 'Force a rejected aggregate row for the readiness regression',
      primaryMetric: (evaluation: ExactDecisionEvaluation) =>
        evaluation.candidate.id === 'bracket-10' ? 1_000_000 : 0,
      constraintViolations: () => [],
    }

    const tournament = runExactLedgerTournament(plan, baseline, null, opts, { policy })

    expect(tournament.winnerSource).toBe('none')
    expect(tournament.retirementActionReadinessVeto).toMatchObject({
      reason: 'identityIncomplete',
      vetoedWinnerSource: 'candidate',
      vetoedCandidateId: 'bracket-10',
      vetoedValidation: { recommendationState: 'rejected' },
    })
    expect(tournament.retirementActionReadinessVeto?.vetoedConversions.length).toBeGreaterThan(0)
  })

  it('updates every displayed winner metric after local search refinement', () => {
    const plan = validate(tradHeavyPlan())
    const baseline = simulatePlan(plan, opts)
    const unrefined = runExactLedgerTournament(plan, baseline, null, opts)
    const refined = runExactLedgerTournament(plan, baseline, null, opts, {
      search: { maxSimulations: 100 },
    })
    const veto = refined.retirementActionReadinessVeto!
    const row = refined.candidates.find((candidate) => candidate.id === veto.vetoedCandidateId)!
    const seedRow = unrefined.candidates.find((candidate) => candidate.id === veto.vetoedCandidateId)!

    expect(refined.searchRefined).toBe(true)
    expect(refined.searchSimulations).toBeGreaterThan(0)
    expect(veto.vetoedValidation.afterTaxEstateDelta).toBeGreaterThan(seedRow.afterTaxEstateDelta)
    expect(calculatedConversions(veto.vetoedResult)).toEqual(veto.vetoedConversions)
    expect(row).toMatchObject({
      executedConversionTotal: veto.vetoedValidation.executedConversionTotal,
      afterTaxEstateDelta: veto.vetoedValidation.afterTaxEstateDelta,
      lifetimeTaxDelta: veto.vetoedValidation.lifetimeTaxDelta,
      moneyLastsYearsDelta: veto.vetoedValidation.moneyLastsYearsDelta,
    })
    // Runs a full tournament plus local-search refinement, which is the
    // slowest single case in this suite. It fits comfortably in the default
    // 5s locally but exceeds it on a cold CI runner under coverage
    // instrumentation, so it gets explicit headroom rather than being made to
    // measure less.
  }, 15_000)

  it('keeps an identity-withheld MILP schedule in policy ranking and preserves its diagnostics', async () => {
    const plan = validate(tradHeavyPlan())
    const baseline = simulatePlan(plan, opts)
    const optimized = await optimizePlan(plan, opts)
    expect(optimized.postProcessed?.cleanedValidation.recommendationState)
      .toBe('identityIncomplete')
    const policy = {
      ...maximizeAfterTaxEstate,
      id: 'min-lifetime-tax-estate-floor' as const,
      label: 'Prefer the calculated MILP row for this regression',
      primaryMetricLabel: 'MILP-row score',
      primaryMetric: (evaluation: ExactDecisionEvaluation) =>
        evaluation.candidate.source === 'milp' ? 1_000_000 : 0,
    }

    const tournament = runExactLedgerTournament(
      plan,
      baseline,
      optimized.postProcessed,
      opts,
      { policy },
    )

    expect(tournament.winnerSource).toBe('none')
    expect(tournament.retirementActionReadinessVeto).toMatchObject({
      vetoedWinnerSource: 'milp',
      vetoedCandidateId: null,
      vetoedValidation: { recommendationState: 'identityIncomplete' },
    })
    expect(tournament.retirementActionReadinessVeto?.vetoedConversions)
      .toEqual(optimized.postProcessed?.cleanedSchedule.conversions)
    expect(tournament.retirementActionReadinessVeto?.vetoedResult)
      .toBe(optimized.postProcessed?.cleanedResult)

    for (const recommendationState of ['neutral', 'rejected'] as const) {
      const policyValidButEstateNonbeneficial = {
        ...optimized.postProcessed!,
        recommendationSchedule: 'none' as const,
        cleanedValidation: {
          ...optimized.postProcessed!.cleanedValidation,
          recommendationState,
        },
      }
      const defaultTournament = runExactLedgerTournament(
        plan,
        baseline,
        policyValidButEstateNonbeneficial,
        opts,
      )
      const defaultWithoutMilp = runExactLedgerTournament(
        plan,
        baseline,
        null,
        opts,
      )
      expect(defaultTournament).toEqual(defaultWithoutMilp)

      const ranked = runExactLedgerTournament(
        plan,
        baseline,
        policyValidButEstateNonbeneficial,
        opts,
        { policy },
      )
      expect(ranked.winnerSource).toBe('none')
      expect(ranked.retirementActionReadinessVeto).toMatchObject({
        vetoedWinnerSource: 'milp',
        vetoedCandidateId: null,
        vetoedValidation: { recommendationState },
      })
      expect(ranked.retirementActionReadinessVeto?.vetoedConversions)
        .toEqual(optimized.postProcessed?.cleanedSchedule.conversions)
      expect(ranked.retirementActionReadinessVeto?.vetoedResult)
        .toBe(optimized.postProcessed?.cleanedResult)
    }

    const cleanedTotal = optimized.postProcessed!.cleanedSchedule.conversions
      .reduce((sum, conversion) => sum + conversion.amount, 0)
    const belowConfiguredMinimum = {
      ...optimized.postProcessed!,
      minimumRequestedConversionDollars: cleanedTotal + 1,
      recommendationSchedule: 'none' as const,
    }
    const thresholded = runExactLedgerTournament(
      plan,
      baseline,
      belowConfiguredMinimum,
      opts,
      { policy },
    )
    expect(thresholded.winnerSource).not.toBe('milp')
    expect(thresholded.retirementActionReadinessVeto?.vetoedWinnerSource).not.toBe('milp')
  })

  it('the tax-with-estate-floor objective can pick a different winner than the estate objective', () => {
    const plan = validate(tradHeavyPlan())
    const baseline = simulatePlan(plan, opts)
    const estate = runExactLedgerTournament(plan, baseline, null, opts)
    const taxFloor = runExactLedgerTournament(plan, baseline, null, opts, {
      policy: minimizeLifetimeTaxWithEstateFloor,
    })
    expect(taxFloor.policyId).toBe('min-lifetime-tax-estate-floor')
    expect(taxFloor.winnerSource).toBe('none')
    // Whoever wins, the winner must save lifetime tax without shrinking the
    // estate — and the ranking ran over the same candidate field.
    expect(taxFloor.candidates.map((c) => c.id)).toEqual(estate.candidates.map((c) => c.id))
    if (taxFloor.winnerSource === 'candidate') {
      const winner = taxFloor.candidates.find((c) => c.id === taxFloor.winnerCandidateId)!
      expect(winner.lifetimeTaxDelta).toBeLessThan(0)
      expect(winner.afterTaxEstateDelta).toBeGreaterThanOrEqual(-1)
    }
  })
})
