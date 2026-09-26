import { expect, it } from 'vitest'

import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import { cashAccount, productionTaxCalculator, singlePersonPlan, validatePlan } from '../testing/planFixtures.js'
import {
  inflationFactor,
  nominalForDisplay,
  planDollarBasis,
  projectionDollarBasis,
  toNominalDollars,
  toTodayDollars,
  todayForDisplay,
} from './dollarBasis.js'
import { simulatePlan } from './simulate.js'
import type { ProjectionResult } from './types.js'

/**
 * The worksheet's worked plan: a single filer born 1963 with one 1,000 cash
 * account and 2.5% general inflation, run 2026 to 2066 (41 rows). Nothing in
 * it moves the factor; it exists so the ledger publishes inflationScale.
 */
function workedRun(inflationPct: number, startYear: number, endYear: number): ProjectionResult {
  const plan = singlePersonPlan({ dob: '1963-01-01', planningAge: 95 })
  plan.accounts = [cashAccount('cash', 1_000)]
  plan.assumptions.inflationPct = inflationPct
  return simulatePlan(validatePlan(plan), {
    startYear,
    horizonEndYear: endYear,
    taxCalculator: productionTaxCalculator(),
  })
}

describeCalculation(
  'display-dollar-basis-conversion',
  {
    example: {
      inputs: {
        inflationPct: 2.5,
        startYear: 2026,
        endYear: 2066,
        amount: 1_000_000,
        fiNumber: 1_234_567.89,
        chartYear: 2036,
        healthcareExtraInflationPct: 2,
      },
      expected: {
        factor2026: 1,
        factor2036Exact: Number('1.28008454419635782241'),
        factor2066Exact: Number('2.68506383838997273151'),
        today2036: Number('781198.401725726627'),
        today2031: Number('883854.287609516904'),
        fiTargetNominal2036: Number('1580351.2747501092'),
        fiTargetToday: 1_234_567.89,
        firstPowerDifferenceYearsFromStart: 3,
        powerYearsThatDiffer: 21,
        wrongHealthcareFactor2036: 1.5530,
        wrongOffByOneToday2036: 762_144.78,
        wrongDirectionFiNominal2036: 964_442.46,
      },
      tolerance: { abs: 0.000001 },
    },
    worksheet: 'DOCS/calculations/cash-flow-and-summary/display-dollar-basis-conversion.md',
    mutation: 'DOCS/calculations/cash-flow-and-summary/display-dollar-basis-conversion.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number>
    const expected = example.expected as Record<string, number>
    const startYear = inputs.startYear!
    const endYear = inputs.endYear!
    const rate = inputs.inflationPct!
    const relTight = { rel: 1e-12 }

    it('reads the ledger factor bit for bit, and planDollarBasis runs the same recurrence', () => {
      const result = workedRun(rate, startYear, endYear)
      expect(result.years).toHaveLength(endYear - startYear + 1)
      const fromLedger = projectionDollarBasis(result)
      const fromPlan = planDollarBasis(rate, startYear, endYear)
      result.years.forEach((row, index) => {
        expect(Object.is(fromLedger.factors[index], row.inflationScale), `${row.year} ledger factor`).toBe(true)
        expect(Object.is(fromPlan.factors[index], row.inflationScale), `${row.year} plan recurrence`).toBe(true)
      })
      expect(inflationFactor(fromLedger, startYear)).toBe(expected.factor2026)
    })

    it('matches the exact powers of 41/40 within 1e-12 relative', () => {
      const basis = planDollarBasis(rate, startYear, endYear)
      expect(withinTolerance(inflationFactor(basis, 2036), expected.factor2036Exact!, relTight)).toBe(true)
      expect(withinTolerance(inflationFactor(basis, 2066), expected.factor2066Exact!, relTight)).toBe(true)
      // R19: the retired Math.pow differs from the ledger's product in the last
      // binary digit in some years, first three years out, never by more.
      const differing: number[] = []
      for (let n = 0; n <= endYear - startYear; n++) {
        const power = Math.pow(1 + rate / 100, n)
        const product = basis.factors[n]!
        if (power !== product) differing.push(n)
        expect(Math.abs(power - product) / product).toBeLessThan(3e-16)
      }
      expect(differing[0]).toBe(expected.firstPowerDifferenceYearsFromStart)
      expect(differing).toHaveLength(expected.powerYearsThatDiffer!)
    })

    it('converts 1,000,000 to start-year dollars and back', () => {
      const basis = planDollarBasis(rate, startYear, endYear)
      const amount = inputs.amount!
      const today2036 = toTodayDollars(basis, 2036, amount)
      expect(withinTolerance(today2036, expected.today2036!, example.tolerance)).toBe(true)
      expect(withinTolerance(toTodayDollars(basis, 2031, amount), expected.today2031!, example.tolerance)).toBe(true)
      expect(Math.abs(toNominalDollars(basis, 2036, today2036) - amount)).toBeLessThanOrEqual(amount * Number.EPSILON)
      // The worksheet's wrong readings: the healthcare rate as the basis, and
      // an exponent one year too many.
      const healthcare = planDollarBasis(rate + inputs.healthcareExtraInflationPct!, startYear, endYear)
      expect(inflationFactor(healthcare, 2036)).toBeCloseTo(expected.wrongHealthcareFactor2036!, 4)
      expect(withinTolerance(today2036, amount / inflationFactor(healthcare, 2036), example.tolerance)).toBe(false)
      expect(amount / inflationFactor(basis, 2037)).toBeCloseTo(expected.wrongOffByOneToday2036!, 1)
      expect(withinTolerance(today2036, expected.wrongOffByOneToday2036!, { abs: 0.01 })).toBe(false)
    })

    it('never converts a figure into the basis it is already in', () => {
      const basis = planDollarBasis(rate, startYear, endYear)
      expect(Object.is(nominalForDisplay(basis, 'nominal', 2036, inputs.amount!), inputs.amount)).toBe(true)
      expect(Object.is(todayForDisplay(basis, 'today', 2036, inputs.fiNumber!), inputs.fiNumber)).toBe(true)
      expect(Object.is(nominalForDisplay(basis, 'today', 2036, inputs.amount!), toTodayDollars(basis, 2036, inputs.amount!))).toBe(true)
    })

    it('places the FI target: fiNumber in today mode in every year, fiNumber times f(y) in nominal mode', () => {
      const basis = planDollarBasis(rate, startYear, endYear)
      const fiNumber = inputs.fiNumber!
      const nominal = todayForDisplay(basis, 'nominal', inputs.chartYear!, fiNumber)
      expect(withinTolerance(nominal, expected.fiTargetNominal2036!, example.tolerance)).toBe(true)
      for (let year = startYear; year <= endYear; year++) {
        expect(Object.is(todayForDisplay(basis, 'today', year, fiNumber), expected.fiTargetToday)).toBe(true)
      }
      // Wrong direction in nominal mode.
      expect(withinTolerance(nominal, expected.wrongDirectionFiNominal2036!, { abs: 0.01 })).toBe(false)
      expect(fiNumber / inflationFactor(basis, 2036)).toBeCloseTo(expected.wrongDirectionFiNominal2036!, 1)
    })

    it('refuses years outside the projection and rows without a factor', () => {
      const basis = planDollarBasis(rate, startYear, endYear)
      expect(() => inflationFactor(basis, startYear - 1)).toThrow(RangeError)
      expect(() => inflationFactor(basis, endYear + 1)).toThrow(RangeError)
      expect(() => inflationFactor(basis, 2030.5)).toThrow(RangeError)
      expect(() => nominalForDisplay(basis, 'nominal', endYear + 1, 1)).toThrow(RangeError)
      expect(() => todayForDisplay(basis, 'today', startYear - 1, 1)).toThrow(RangeError)
      const result = workedRun(rate, startYear, startYear + 5)
      const rows = result.years.map((row, index) => (index === 3 ? { ...row, inflationScale: undefined } : row))
      expect(() => projectionDollarBasis({ ...result, years: rows })).toThrow(/2029 publishes no usable inflationScale/u)
      expect(() => planDollarBasis(-100, startYear, endYear)).toThrow(RangeError)
      // A projection with no rows gives a basis in which every year is refused.
      const empty = projectionDollarBasis({ startYear, endYear: startYear - 1, years: [] })
      expect(empty.factors).toEqual([])
      expect(() => inflationFactor(empty, startYear)).toThrow(RangeError)
    })
  },
)
