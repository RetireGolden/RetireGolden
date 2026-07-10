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

import { maximizeSpendingDurability, minimizeLifetimeTaxWithEstateFloor, socialSecurityClaimGenerator } from '../decisions'
import { createEmptyPlan, parsePlan, type Account, type Plan } from '../model/plan'
import { applyScenarioPatch } from '../scenarios/scenarios'
import { socialSecurityIncome } from '../../testSupport/planFixtures'
import { optimizeSchedule, type OptimizedSchedule } from '../strategies/optimizer'
import { createFederalTaxCalculator } from '../tax/federalTax'
import { summarizeProjection } from './compare'
import {
  buildOptimizerInput,
  evaluateExactLedgerSchedule,
  evaluateSimpleConversionCandidates,
  optimizePlan,
  optimizePlanCoOptimizingClaimAge,
  postProcessExactLedgerSchedule,
  runExactLedgerTournament,
  withOptimizedConversions,
} from './optimizePlan'
import { simulatePlan } from './simulate'

let counter = 0
const testIds = () => `optp-${++counter}`
const fixedNow = () => new Date('2026-06-11T00:00:00.000Z')

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
    longevity: { planningAge: 65, source: 'manual' },
  }
  plan.assumptions.inflationPct = 0
  plan.assumptions.healthcareExtraInflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  plan.assumptions.stateEffectiveTaxPct = 0
  plan.assumptions.heirTaxRatePct = 50
  plan.assumptions.recentAnnualMagi = 50_000
  plan.expenses.baseAnnual = 20_000
  plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 1_000, applyAcaCredit: true, medicareExtrasMonthlyPerPerson: 0 }
  plan.accounts = [
    { type: 'traditional', id: testIds(), name: 'IRA', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 500_000, annualContribution: 0 },
    { type: 'roth', id: testIds(), name: 'Roth', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 0, annualContribution: 0 },
    { type: 'cash', id: testIds(), name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 150_000, annualContribution: 0 },
  ]
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
    expect(processed.recommendationSchedule).toBe('cleaned')
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

    // The prune pass drops the harmful trailing year and adopts the result
    // only because the exact ledger prices the remainder beneficial.
    expect(processed.pruneIterationCount).toBeGreaterThanOrEqual(1)
    expect(processed.cleanedSchedule.conversions).toEqual([{ year: 2026, amount: 20_000 }])
    expect(processed.cleanedValidation.recommendationState).toBe('beneficial')
    expect(processed.cleanedValidation.afterTaxEstateDelta).toBeGreaterThan(0)
    expect(processed.adjustments).toContainEqual({
      year: 2027,
      requested: 500_000,
      executed: 500_000,
      cleaned: 0,
      reason: 'estate-pruned',
    })
    expect(processed.recommendationSchedule).toBe('cleaned')
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

describe('optimizePlan end-to-end', () => {
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
    expect(validation.recommendationState).toBe('beneficial')
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

    expect(exact.warnings.some((w) => w.includes('400% of the federal poverty line'))).toBe(true)
    expect(exact.years.find((y) => y.year === 2026)!.expenses.healthcare).toBeCloseTo(4_980, 2)
    expect(exact.years.find((y) => y.year === 2027)!.expenses.healthcare).toBeCloseTo(12_000, 2)
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

  it('the joint optimum beats the separate claim sweep and the separate conversion optimize', async () => {
    const plan = validate(bridgeClaimPlan())
    const joint = await optimizePlanCoOptimizingClaimAge(plan, { ...opts, convergence: { maxIterations: 4 } })

    // Bounded grid actually ran, and the joint optimum is at least the
    // current-claim conversion optimum (the floor it is compared against).
    expect(joint.claimAge.enabled).toBe(true)
    expect(joint.claimAge.combinationsEvaluated).toBeGreaterThan(1)
    expect(joint.claimAge.jointExactEstate).toBeGreaterThanOrEqual(joint.claimAge.currentClaimExactEstate - 1)
    // On this bridge fixture delaying to 70 opens cheap-conversion years, so a
    // claim change wins and materially beats the current-claim optimum
    // (~+$118k of exact estate at the time of writing).
    expect(joint.claimAge.winningClaimLabel).toContain('70')
    expect(joint.claimAge.jointExactEstate).toBeGreaterThan(joint.claimAge.currentClaimExactEstate + 10_000)

    // Separate claim sweep: best exact estate from a claim change alone (no
    // conversions). The joint optimum co-optimizes conversions on top, so it can
    // never be worse than the best claim-only outcome.
    let bestClaimOnly = summarizeProjection(plan, simulatePlan(plan, opts)).endingAfterTaxEstate
    const ctx = {
      plan,
      baselineResult: simulatePlan(plan, opts),
      baselineSummary: summarizeProjection(plan, simulatePlan(plan, opts)),
      simulateOptions: opts,
    }
    for (const candidate of socialSecurityClaimGenerator.generate(ctx)) {
      if (!candidate.planPatch) continue
      const applied = applyScenarioPatch(plan, candidate.planPatch)
      if (!applied.ok) continue
      bestClaimOnly = Math.max(
        bestClaimOnly,
        summarizeProjection(applied.plan, simulatePlan(applied.plan, opts)).endingAfterTaxEstate,
      )
    }
    expect(joint.claimAge.jointExactEstate).toBeGreaterThanOrEqual(bestClaimOnly - 1)

    // The returned plan/result are self-consistent: the recommended schedule
    // priced on the winning plan reproduces the reported joint estate.
    const finalPlan = withOptimizedConversions(joint.optimizedPlan, joint.tournament.winnerConversions)
    const finalEstate = summarizeProjection(finalPlan, simulatePlan(finalPlan, opts)).endingAfterTaxEstate
    expect(finalEstate).toBeCloseTo(joint.claimAge.jointExactEstate, 0)
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

    // The rescue outcome: dropping unexecutable years keeps the schedule
    // beneficial on the exact ledger, and only the cleaned schedule is
    // recommendable — never the raw over-request.
    expect(processed.cleanedValidation.afterTaxEstateDelta).toBeGreaterThan(0)
    expect(processed.cleanedValidation.recommendationState).toBe('beneficial')
    expect(processed.recommendationSchedule).toBe('cleaned')
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
    expect(postProcessed!.cleanedValidation.recommendationState).not.toBe('unexecutable')
    expect(postProcessed!.cleanedValidation.moneyLastsYearsDelta).toBeGreaterThanOrEqual(0)
    if (postProcessed!.recommendationSchedule === 'cleaned') {
      expect(postProcessed!.cleanedValidation.afterTaxEstateDelta).toBeGreaterThanOrEqual(-1)
    }
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
    expect(postProcessed!.cleanedValidation.recommendationState).toBe('beneficial')
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
    expect(heir0.postProcessed!.cleanedValidation.recommendationState).toBe('beneficial')
    expect(heir0.postProcessed!.cleanedValidation.lifetimeTaxDelta).toBeLessThan(0)
    expect(heir37.postProcessed!.cleanedValidation.recommendationState).toBe('beneficial')
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
    expect(postProcessed!.cleanedValidation.recommendationState).toBe('beneficial')
    expect(postProcessed!.cleanedValidation.executedConversionRatio).toBeGreaterThan(0.9)
  })

  it('keeps a mostly-traditional no-bridge household executable and beneficial', async () => {
    const plan = validate(matrixPlan({ trad: 800_000, cash: 20_000, ssPia: 2_500 }))
    const { postProcessed } = await optimizePlan(plan, opts)

    // Historically the raw schedule over-requested badly here (spending drains
    // traditional for living costs) and the trim+prune pipeline had to repair
    // it; with the in-solve taxable-SS PWL and unscaled-deduction fidelity the
    // raw solve now sizes executably on its own. Either way, the cleaned
    // schedule must be fully executable, beneficial, and never request more
    // than the raw solve did.
    expect(postProcessed!.cleanedValidation.executedConversionRatio).toBeCloseTo(1, 6)
    expect(postProcessed!.cleanedValidation.recommendationState).toBe('beneficial')
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
    expect(high.postProcessed!.cleanedValidation.recommendationState).toBe('beneficial')
    expect(low.postProcessed!.cleanedValidation.recommendationState).toBe('beneficial')
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
    expect(postProcessed!.cleanedValidation.recommendationState).toBe('beneficial')
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
    expect(postProcessed!.cleanedValidation.recommendationState).toBe('beneficial')
  })
})

describe('exact-ledger candidate tournament', () => {
  it('recommends a simple bracket fill when it beats the MILP on the exact ledger', async () => {
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
    expect(tournament.winnerSource).toBe('candidate')
    expect(tournament.winnerCandidateId).toBe('bracket-12-until-2030')
    const winnerRow = tournament.candidates.find((c) => c.id === tournament.winnerCandidateId)!
    expect(winnerRow.afterTaxEstateDelta).toBeGreaterThanOrEqual(bracket10.afterTaxEstateDelta)
    expect(tournament.marginOverMilpDollars).toBeGreaterThan(10_000)
    expect(tournament.winnerValidation!.recommendationState).toBe('beneficial')
    // The winner's schedule is exact-ledger executed amounts by construction.
    expect(tournament.winnerValidation!.executedConversionRatio).toBeCloseTo(1, 6)
    expect(tournament.winnerConversions.reduce((sum, c) => sum + c.amount, 0)).toBeGreaterThan(150_000)
  })

  it('does not replace a recommendable MILP schedule with a shorter-lasting candidate', async () => {
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
    expect(tournament.winnerSource).toBe('milp')
    expect(tournament.winnerConversions).toEqual(processed.cleanedSchedule.conversions)
  })

  it('keeps the MILP schedule when every simple candidate is exact-ledger worse', async () => {
    const plan = validate(coastFireGapPlan())
    const baseline = simulatePlan(plan, opts)
    const { postProcessed, tournament } = await optimizePlan(plan, opts)

    // Blanket fills drain the flat-return traditional into taxed conversions
    // this household never benefits from; the trimmed MILP schedule wins.
    const candidates = evaluateSimpleConversionCandidates(plan, baseline, opts)
    for (const candidate of candidates) expect(candidate.afterTaxEstateDelta).toBeLessThan(0)
    expect(tournament.winnerSource).toBe('milp')
    expect(tournament.winnerConversions).toEqual(postProcessed!.cleanedSchedule.conversions)
  })

  it('does not churn the recommendation over immaterial margins', async () => {
    const plan = validate(acaBridgePlan())
    const { postProcessed, tournament } = await optimizePlan(plan, { ...opts, liquidationRatePct: 50 })

    // Here the best simple candidate lands within a few hundred dollars of the
    // cleaned MILP schedule — inside the switch margin, so the MILP holds.
    const bestCandidateDelta = Math.max(...tournament.candidates.map((c) => c.afterTaxEstateDelta))
    expect(Math.abs(bestCandidateDelta - postProcessed!.cleanedValidation.afterTaxEstateDelta)).toBeLessThan(5_000)
    expect(tournament.winnerSource).toBe('milp')
  })

  it('lets a candidate win outright when the MILP has nothing to recommend', () => {
    // Force the no-MILP path directly: same trad-heavy plan, no post-processing.
    const plan = validate(tradHeavyPlan())
    const baseline = simulatePlan(plan, opts)
    const tournament = runExactLedgerTournament(plan, baseline, null, opts, {
      switchMarginDollars: Number.MAX_SAFE_INTEGER,
    })

    expect(tournament.winnerSource).toBe('candidate')
    expect(tournament.winnerCandidateId).toBe('bracket-12-until-2030')
    expect(tournament.marginOverMilpDollars).toBe(0)
    expect(tournament.winnerValidation!.afterTaxEstateDelta).toBeGreaterThan(0)
  })

  it('holds the incumbent applied schedule when nothing beats it', () => {
    // Win a tournament, apply the winner, and re-run: the baseline now includes
    // the winning conversions, so no candidate improves on it — the tournament
    // must report the incumbent, not a scary "nothing recommended" diagnostic.
    const plan = validate(tradHeavyPlan())
    const baseline = simulatePlan(plan, opts)
    const firstRun = runExactLedgerTournament(plan, baseline, null, opts)
    expect(firstRun.winnerSource).toBe('candidate')

    const appliedPlan = withOptimizedConversions(plan, firstRun.winnerConversions)
    const appliedBaseline = simulatePlan(appliedPlan, opts)
    const rerun = runExactLedgerTournament(appliedPlan, appliedBaseline, null, opts)

    expect(rerun.winnerSource).toBe('incumbent')
    expect(rerun.winnerLabel).toBe('your applied optimizer schedule')
    expect(rerun.winnerValidation).toBeNull()
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
  it('stamps the default policy id without changing behavior', () => {
    const plan = validate(tradHeavyPlan())
    const baseline = simulatePlan(plan, opts)
    const tournament = runExactLedgerTournament(plan, baseline, null, opts)
    expect(tournament.policyId).toBe('max-after-tax-estate')
    expect(tournament.winnerSource).toBe('candidate')
    expect(tournament.winnerCandidateId).toBe('bracket-12-until-2030')
  })

  it('re-ranks the same candidates under a different objective', () => {
    const plan = validate(tradHeavyPlan())
    const baseline = simulatePlan(plan, opts)

    // The estate objective recommends a bracket fill on this fixture…
    const estate = runExactLedgerTournament(plan, baseline, null, opts)
    expect(estate.winnerSource).toBe('candidate')

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

  it('the tax-with-estate-floor objective can pick a different winner than the estate objective', () => {
    const plan = validate(tradHeavyPlan())
    const baseline = simulatePlan(plan, opts)
    const estate = runExactLedgerTournament(plan, baseline, null, opts)
    const taxFloor = runExactLedgerTournament(plan, baseline, null, opts, {
      policy: minimizeLifetimeTaxWithEstateFloor,
    })
    expect(taxFloor.policyId).toBe('min-lifetime-tax-estate-floor')
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
