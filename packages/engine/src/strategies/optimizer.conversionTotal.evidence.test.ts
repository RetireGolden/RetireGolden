import { expect, it } from 'vitest'

import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import { createEmptyPlan, parsePlan, type Plan } from '../model/plan.js'
import { packForYear } from '../params/index.js'
import type { FilingStatus } from '../params/types.js'
import { postProcessExactLedgerSchedule, runExactLedgerTournament } from '../projection/optimizePlan.js'
import { simulatePlan } from '../projection/simulate.js'
import { createFederalTaxCalculator } from '../tax/federalTax.js'
import { conversionScheduleTotal, optimizeSchedule, type OptimizedSchedule, type OptimizerYear } from './optimizer.js'

/** The 64-bit pattern of a double, so a last-bit difference shows. */
function bits(x: number): string {
  const view = new DataView(new ArrayBuffer(8))
  view.setFloat64(0, x)
  return view.getBigUint64(0).toString(16).padStart(16, '0')
}

const PACK = packForYear(2026).pack

/** One solver year with nothing but a year number: the solve itself is stubbed. */
function solverYear(year: number): OptimizerYear {
  return {
    year,
    pack: PACK,
    filingStatus: 'single' as FilingStatus,
    ordinaryIncomeBase: 0,
    spendingNeed: 0,
    exogenousCash: 0,
    rmdDivisor: null,
    inheritedDistribution: 0,
    inheritedDistributionDivisor: null,
    peopleAged65Plus: 0,
    inflationScale: 1,
    growth: 0,
    stateRate: 0,
    tradInflow: 0,
    otherInflow: 0,
  }
}

/**
 * One person with $20,000 in an owned traditional IRA and nothing that grows,
 * so a raw request of $15,000 in each of two years can only execute $15,000
 * and then $5,000: the cleaned schedule differs from the raw one.
 */
function limitedTraditionalPlan(): Plan {
  let counter = 0
  const plan = createEmptyPlan({
    newId: () => `conversion-total-${++counter}`,
    now: () => new Date('2026-06-11T00:00:00.000Z'),
  })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1960-01-01',
    sex: 'average',
    retirementAge: 65,
    longevity: { planningAge: 67, source: 'manual' },
  }
  plan.assumptions.inflationPct = 0
  plan.assumptions.healthcareExtraInflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  plan.assumptions.stateEffectiveTaxPct = 0
  plan.assumptions.heirTaxRatePct = 0
  plan.expenses.baseAnnual = 0
  plan.accounts = [
    { type: 'traditional', id: 'own-trad', name: 'own-trad', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 20_000, annualContribution: 0 },
    { type: 'roth', id: 'own-roth', name: 'own-roth', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 0, annualContribution: 0 },
    { type: 'cash', id: 'cash', name: 'cash', ownerPersonId: null, annualReturnPct: 0, balance: 10_000, annualContribution: 0 },
  ]
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

/** A raw solver schedule carrying only its conversions and their published total. */
function rawSchedule(conversions: { year: number; amount: number }[]): OptimizedSchedule {
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
    conversionTotal: conversionScheduleTotal(conversions),
    solveMs: 0,
  }
}

describeCalculation(
  'conversion-schedule-total',
  {
    example: {
      inputs: {
        caseU: [10_000.25, 20_000.5, 30_000.75],
        caseV: [0.1, 0.2, 0.3],
        caseW: [],
        caseX: [48_123.46, 51_234.57, 0.51],
        caseXSolverColumns: [48_123.456, 51_234.567, 0.51],
        caseY: { status: 'Infeasible' },
        cleaned: { raw: [15_000, 15_000], years: [2026, 2027] },
      },
      expected: {
        caseU: 60_001.5,
        caseV: 0.6000000000000001,
        caseVBits: '3fe3333333333334',
        caseVOtherAssociation: 0.6,
        caseW: 0,
        caseX: 99_358.54,
        caseY: 0,
        cleanedTotal: 20_000,
        rawTotal: 30_000,
      },
      tolerance: { abs: 0 },
    },
    worksheet: 'DOCS/calculations/roth/optimizer-schedule-conversion-total.md',
    mutation: 'DOCS/calculations/roth/optimizer-schedule-conversion-total.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, unknown>
    const expected = example.expected as Record<string, number | string>
    const entries = (amounts: number[]) => amounts.map((amount, index) => ({ year: 2026 + index, amount }))
    const same = (actual: number, want: number, label: string) =>
      expect(withinTolerance(actual, want, example.tolerance), `${label}: actual ${actual}, worksheet ${want}`).toBe(true)

    it('cases U, W and X: the amounts added left to right from 0', () => {
      same(conversionScheduleTotal(entries(inputs.caseU as number[])), expected.caseU as number, 'caseU')
      same(conversionScheduleTotal(entries(inputs.caseW as number[])), expected.caseW as number, 'caseW')
      same(conversionScheduleTotal(entries(inputs.caseX as number[])), expected.caseX as number, 'caseX')
    })

    it('case V: one association, left to right; the other gives a different last bit', () => {
      const amounts = inputs.caseV as number[]
      const total = conversionScheduleTotal(entries(amounts))
      same(total, expected.caseV as number, 'caseV')
      expect(bits(total)).toBe(expected.caseVBits)
      expect(amounts[0]! + (amounts[1]! + amounts[2]!)).toBe(expected.caseVOtherAssociation)
      expect(total).not.toBe(expected.caseVOtherAssociation)
    })

    it('refuses a non-finite amount', () => {
      expect(() => conversionScheduleTotal([{ amount: Number.NaN }])).toThrow(RangeError)
      expect(() => conversionScheduleTotal([{ amount: Number.POSITIVE_INFINITY }])).toThrow(RangeError)
    })

    it('cases X and Y: the raw solve publishes the total of the conversions it emits, whatever its status', async () => {
      const columns = inputs.caseXSolverColumns as number[]
      const years = columns.map((_, index) => solverYear(2026 + index))
      const solved = await optimizeSchedule({
        years,
        openingTrad: 200_000,
        openingInheritedTrad: 0,
        openingOther: 0,
        liquidationRate: 0.24,
        options: {
          solve: () => ({
            Status: 'Optimal',
            ObjectiveValue: 1,
            Columns: Object.fromEntries(columns.map((amount, index) => [`conv${index}`, { Primal: amount }])),
          }),
        },
      })
      expect(solved.conversions.map((conversion) => conversion.amount)).toEqual(inputs.caseX)
      same(solved.conversionTotal, expected.caseX as number, 'raw solve total')

      const infeasible = await optimizeSchedule({
        years: [solverYear(2026)],
        openingTrad: 200_000,
        openingInheritedTrad: 0,
        openingOther: 0,
        liquidationRate: 0.24,
        options: { solve: () => ({ Status: (inputs.caseY as { status: string }).status }) },
      })
      expect(infeasible.status).toBe('infeasible')
      expect(infeasible.conversions).toEqual([])
      same(infeasible.conversionTotal, expected.caseY as number, 'caseY')
    })

    it('a cleaned schedule publishes its own total, not the raw schedule\'s carried through a spread', () => {
      const cleaned = inputs.cleaned as { raw: number[]; years: number[] }
      const plan = limitedTraditionalPlan()
      const options = { startYear: 2026, taxCalculator: createFederalTaxCalculator() }
      const baselineResult = simulatePlan(plan, options)
      const raw = rawSchedule(cleaned.raw.map((amount, index) => ({ year: cleaned.years[index]!, amount })))
      same(raw.conversionTotal, expected.rawTotal as number, 'raw total')
      const processed = postProcessExactLedgerSchedule(plan, raw, baselineResult, options)
      same(processed.cleanedSchedule.conversionTotal, expected.cleanedTotal as number, 'cleaned total')
      expect(processed.cleanedSchedule.conversionTotal).toBe(conversionScheduleTotal(processed.cleanedSchedule.conversions))
      expect(processed.cleanedSchedule.conversionTotal).not.toBe(raw.conversionTotal)
      // The requested total the exact validation publishes is the same sum.
      expect(processed.cleanedValidation.requestedConversionTotal).toBe(processed.cleanedSchedule.conversionTotal)

      const tournament = runExactLedgerTournament(plan, baselineResult, processed, options)
      expect(tournament.winnerConversionTotal).toBe(conversionScheduleTotal(tournament.winnerConversions))
    })

    it('the tournament publishes the winner total on a winner with conversions (review F6)', () => {
      // The same plan already converting the raw request: $15,000 in 2026 and
      // $15,000 in 2027 against $20,000 of traditional balance, so its ledger
      // executes $15,000 and $5,000. Nothing beats that schedule here, so the
      // plan's own executed conversions hold as the incumbent winner.
      const cleaned = inputs.cleaned as { raw: number[]; years: number[] }
      const requested = cleaned.raw.map((amount, index) => ({ year: cleaned.years[index]!, amount }))
      const plan = limitedTraditionalPlan()
      plan.strategies.rothConversion = { mode: 'manual', conversions: requested }
      const options = { startYear: 2026, taxCalculator: createFederalTaxCalculator() }
      const baselineResult = simulatePlan(plan, options)
      const processed = postProcessExactLedgerSchedule(plan, rawSchedule(requested), baselineResult, options)
      const tournament = runExactLedgerTournament(plan, baselineResult, processed, options)
      expect(tournament.winnerSource).toBe('incumbent')
      expect(tournament.winnerConversions).toEqual([
        { year: 2026, amount: 15_000 },
        { year: 2027, amount: 5_000 },
      ])
      same(tournament.winnerConversionTotal, expected.cleanedTotal as number, 'incumbent winner total')
      expect(tournament.winnerConversionTotal).toBe(conversionScheduleTotal(tournament.winnerConversions))
    })
  },
)
