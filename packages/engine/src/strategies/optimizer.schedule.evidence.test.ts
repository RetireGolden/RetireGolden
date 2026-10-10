import { expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Plan } from '../model/plan.js'
import { packForYear } from '../params/index.js'
import { summarizeProjection } from '../projection/compare.js'
import { projectionDollarBasis } from '../projection/dollarBasis.js'
import { buildOptimizerInput, optimizePlan, withOptimizedConversions } from '../projection/optimizePlan.js'
import { simulatePlan } from '../projection/simulate.js'
import { describeCalculation, withinTolerance, worksheetExpectedRows, worksheetNumber } from '../rules/describeCalculation.js'
import { combineTaxCalculators, createFederalTaxCalculator } from '../tax/federalTax.js'
import { createStateTaxCalculator } from '../tax/stateTax.js'
import { optimizeSchedule, type OptimizedSchedule, type OptimizerInput, type OptimizerYear } from './optimizer.js'

/**
 * RetireGolden-MCP's run_optimizer returns the engine's whole OptimizedSchedule
 * (`run_optimizer.schedule`): the solver's own ending after-tax wealth and
 * lifetime tax, and its per-year solution. These cases solve the real model
 * with HiGHS, as the engine's other optimizer tests do, on inputs short enough
 * for the worksheets to derive the solution by hand: the library example
 * rmd-irmaa's facts entered as a one-year solve, and varied to two years for
 * the branches one year does not reach.
 */
const PACK_2026 = packForYear(2026).pack

/** One solver year of the rmd-irmaa household: Dana, single, 73, Social Security entered, no state tax. */
function rmdIrmaaYear(overrides: Partial<OptimizerYear>): OptimizerYear {
  return {
    year: 2026,
    pack: PACK_2026,
    filingStatus: 'single',
    ordinaryIncomeBase: 43_084.8,
    spendingNeed: 114_200,
    exogenousCash: 50_688,
    rmdDivisor: 26.5,
    inheritedDistribution: 0,
    inheritedDistributionDivisor: null,
    peopleAged65Plus: 1,
    inflationScale: 1,
    growth: 0.05,
    stateRate: 0,
    tradInflow: 0,
    otherInflow: 0,
    ...overrides,
  }
}

type CaseInputs = {
  readonly years: readonly Partial<OptimizerYear>[]
  readonly openingTrad: number
  readonly openingInheritedTrad: number
  readonly openingOther: number
  readonly openingTaxable: number
  readonly taxableBasisRatio: number
  readonly ltcgRate: number
  readonly liquidationRate: number
  readonly inflation: number
  readonly irmaaLookback: boolean
}

const CASE_1: CaseInputs = {
  years: [{ year: 2026 }],
  openingTrad: 1_850_000,
  openingInheritedTrad: 0,
  openingOther: 50_000,
  openingTaxable: 400_000,
  taxableBasisRatio: 0.7,
  ltcgRate: 0.15,
  liquidationRate: 0.28,
  inflation: 0.025,
  irmaaLookback: true,
}

const CASE_2: CaseInputs = {
  years: [
    { year: 2026, spendingNeed: 174_200, rmdDivisor: 26.5, inheritedDistribution: 40_000 },
    { year: 2027, spendingNeed: 114_200, rmdDivisor: 25.5, inheritedDistribution: 40_000 },
  ],
  openingTrad: 1_325_000,
  openingInheritedTrad: 400_000,
  openingOther: 0,
  openingTaxable: 400_000,
  taxableBasisRatio: 0.7,
  ltcgRate: 0.15,
  liquidationRate: 0.1,
  inflation: 0.025,
  irmaaLookback: false,
}

/**
 * Spending nothing can fund: no balance and no income, over three years with
 * IRMAA priced two years later (as the plan-built input prices it), so the
 * third year carries tier binaries; case 4 is the same over one year, which
 * carries none.
 */
const UNFUNDED_YEAR: Partial<OptimizerYear> = { ordinaryIncomeBase: 0, exogenousCash: 0, spendingNeed: 100_000, rmdDivisor: null }
const CASE_3: CaseInputs = {
  years: [
    { year: 2026, ...UNFUNDED_YEAR },
    { year: 2027, ...UNFUNDED_YEAR },
    { year: 2028, ...UNFUNDED_YEAR },
  ],
  openingTrad: 0,
  openingInheritedTrad: 0,
  openingOther: 0,
  openingTaxable: 0,
  taxableBasisRatio: 1,
  ltcgRate: 0,
  liquidationRate: 0.28,
  inflation: 0.025,
  irmaaLookback: true,
}
const CASE_4: CaseInputs = { ...CASE_3, years: [{ year: 2026, ...UNFUNDED_YEAR }] }

function solverInput(inputs: CaseInputs): OptimizerInput {
  return {
    years: inputs.years.map((year) => rmdIrmaaYear(year)),
    openingTrad: inputs.openingTrad,
    openingInheritedTrad: inputs.openingInheritedTrad,
    openingOther: inputs.openingOther,
    openingTaxable: inputs.openingTaxable,
    taxableBasisRatio: inputs.taxableBasisRatio,
    ltcgRate: inputs.ltcgRate,
    irmaaLookback: inputs.irmaaLookback,
    liquidationRate: inputs.liquidationRate,
    realDollarFactor: 1 / Math.pow(1 + inputs.inflation, inputs.years.length),
  }
}

const YEAR_WORKSHEET = 'DOCS/calculations/optimizer-and-comparisons/optimizer-schedule-year-solution.md'
const yearRows = worksheetExpectedRows(YEAR_WORKSHEET)
const YEAR_COLUMNS = [
  'conversion',
  'withdrawTraditional',
  'withdrawInheritedTraditional',
  'withdrawOther',
  'withdrawTaxable',
  'taxableGainRealized',
  'taxableOrdinary',
  'irmaaTier',
  'endTrad',
  'endInheritedTrad',
  'endOther',
  'endTaxable',
] as const
type YearColumn = (typeof YEAR_COLUMNS)[number]
/** The worksheet's Expected rows for one case, in plan-year order, keyed by column. */
function yearCase(caseLabel: 'Case 1' | 'Case 2'): { year: number; values: Record<YearColumn, number> }[] {
  return [...yearRows]
    .filter(([label]) => label.startsWith(caseLabel + ', '))
    .map(([label, cells]) => ({
      year: Number(label.slice(caseLabel.length + 2)),
      values: Object.fromEntries(YEAR_COLUMNS.map((column, index) => [column, worksheetNumber(cells[index]!)])) as Record<
        YearColumn,
        number
      >,
    }))
}

describeCalculation(
  'optimizer-schedule-year-solution',
  {
    example: {
      inputs: { example: 'rmd-irmaa', case1: CASE_1, case2: CASE_2 },
      expected: { case1: yearCase('Case 1'), case2: yearCase('Case 2') },
      tolerance: { abs: 0.005 },
    },
    worksheet: YEAR_WORKSHEET,
    mutation: 'DOCS/calculations/optimizer-and-comparisons/optimizer-schedule-year-solution.mutation.md',
  },
  ({ example }) => {
    function expectYears(schedule: OptimizedSchedule, expected: { year: number; values: Record<YearColumn, number> }[]): void {
      expect(schedule.schedule.map((row) => row.year)).toEqual(expected.map((row) => row.year))
      for (const [index, want] of expected.entries()) {
        const row = schedule.schedule[index]!
        for (const column of YEAR_COLUMNS) {
          expect(
            withinTolerance(row[column], want.values[column], example.tolerance),
            `${want.year} ${column}: actual ${row[column]}, worksheet ${want.values[column]}`,
          ).toBe(true)
        }
      }
      // The conversions list carries the same amount for each year above $0.50.
      expect(schedule.conversions).toEqual(
        expected
          .filter((row) => row.values.conversion > 0.5)
          .map((row) => ({ year: row.year, amount: row.values.conversion })),
      )
    }

    it('case 1 converts through the 24% bracket, draws the floor and pays the tax from the tax-free bucket: conversion 107029', async () => {
      const schedule = await optimizeSchedule(solverInput(example.inputs.case1 as CaseInputs))
      expect(schedule.status).toBe('optimal')
      expectYears(schedule, example.expected.case1 as ReturnType<typeof yearCase>)
    })

    it('case 2 draws both floors, sells to fund 2026 and saves in 2027: sale 59245.2, tiers 2 and 1', async () => {
      const schedule = await optimizeSchedule(solverInput(example.inputs.case2 as CaseInputs))
      expect(schedule.status).toBe('optimal')
      expectYears(schedule, example.expected.case2 as ReturnType<typeof yearCase>)
    })
  },
)

const TOTALS_WORKSHEET = 'DOCS/calculations/optimizer-and-comparisons/optimizer-schedule-objective-and-lifetime-tax.md'
const totalsRows = worksheetExpectedRows(TOTALS_WORKSHEET)
/** One worksheet row: status, and the two figures ("infinite" is the infeasible objective). */
function totalsCase(caseLabel: string): { status: string; endingAfterTax: number; lifetimeTax: number } {
  const [status, endingAfterTax, lifetimeTax] = totalsRows.get(caseLabel)!
  return {
    status: status!,
    endingAfterTax: endingAfterTax === 'infinite' ? Number.POSITIVE_INFINITY : worksheetNumber(endingAfterTax!),
    lifetimeTax: worksheetNumber(lifetimeTax!),
  }
}

/**
 * The library example bracket-fill-roth (planner-ui
 * examples/buildBracketFillRoth.ts on the shared example baseline of
 * buildContext.ts), rebuilt here with its ids, as the engine cannot import
 * the example library.
 */
function bracketFillRothPlan(): Plan {
  const exampleId = 'bracket-fill-roth'
  const id = (suffix: string) => `${exampleId}--${suffix}`
  let sequence = 0
  const plan = createEmptyPlan({
    name: 'Bracket-fill Roth conversions',
    now: () => new Date('2026-06-29T12:00:00.000Z'),
    newId: () => id(`seq-${sequence++}`),
  })
  plan.assumptions = {
    inflationPct: 2.5,
    healthcareExtraInflationPct: 3,
    defaultReturnPct: 5,
    ssCola: { mode: 'matchInflation' },
    ssHaircut: null,
    stateEffectiveTaxPct: 0,
    localIncomeTaxPct: 0,
    recentAnnualMagi: 0,
    heirTaxRatePct: 25,
    safeWithdrawalRatePct: 4,
  }
  plan.strategies = {
    withdrawalOrder: { mode: 'sequential' },
    rothConversion: { mode: 'fillToTarget', target: 'topOfBracket', targetValue: 22, startYear: 2026, endYear: 2034 },
    qcdAnnual: 10_000,
    retirementActions: [],
  }
  const morgan = id('p1')
  const riley = id('p2')
  plan.household = {
    filingStatus: 'marriedFilingJointly',
    hasQualifyingDependent: false,
    state: 'FL',
    stateMoves: [],
    capitalLossCarryforward: 0,
    people: [
      { id: morgan, name: 'Morgan', dob: '1953-01-01', sex: 'male', retirementAge: 65, longevity: { planningAge: 92, source: 'manual' } },
      { id: riley, name: 'Riley', dob: '1955-01-01', sex: 'female', retirementAge: 65, longevity: { planningAge: 94, source: 'manual' } },
    ],
  }
  plan.accounts = [
    { type: 'cash', id: id('cash'), name: 'Cash reserve', ownerPersonId: null, annualReturnPct: 2, balance: 80_000, annualContribution: 0 },
    { type: 'traditional', id: id('ira-m'), name: 'Morgan IRA', ownerPersonId: morgan, annualReturnPct: null, kind: 'ira', balance: 700_000, annualContribution: 0 },
    { type: 'traditional', id: id('ira-r'), name: 'Riley IRA', ownerPersonId: riley, annualReturnPct: null, kind: 'ira', balance: 400_000, annualContribution: 0 },
    { type: 'roth', id: id('roth'), name: 'Morgan Roth IRA', ownerPersonId: morgan, annualReturnPct: null, kind: 'ira', balance: 50_000, annualContribution: 0 },
    { type: 'roth', id: id('roth-r'), name: 'Riley Roth IRA', ownerPersonId: riley, annualReturnPct: null, kind: 'ira', balance: 0, annualContribution: 0 },
  ]
  plan.incomes = [
    { type: 'socialSecurity', id: id('ss-m'), personId: morgan, piaMonthly: 2_500, earnings: null, claimAge: { years: 67, months: 0 } },
    { type: 'socialSecurity', id: id('ss-r'), personId: riley, piaMonthly: 1_800, earnings: null, claimAge: { years: 67, months: 0 } },
  ]
  plan.expenses = {
    baseAnnual: 90_000,
    phases: [{ fromAge: 80, multiplier: 0.85 }],
    phasesAgeOf: morgan,
    oneTimeGoals: [],
    healthcare: { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 250 },
  }
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

/** Half a unit in the sixth significant digit: how far a value read back from HiGHS can sit from the solution. */
function sixDigitHalfUnit(value: number): number {
  if (value === 0) return 0
  return 0.5 * Math.pow(10, Math.floor(Math.log10(Math.abs(value))) - 5)
}

describeCalculation(
  'optimizer-schedule-objective-and-lifetime-tax',
  {
    example: {
      inputs: {
        example: 'rmd-irmaa',
        case1: CASE_1,
        case2: CASE_2,
        case3: CASE_3,
        case4: CASE_4,
        libraryExample: { id: 'bracket-fill-roth', startYear: 2026, years: 24, inflation: 0.025, heirRate: 0.25 },
      },
      expected: {
        case1: totalsCase('Case 1'),
        case2: totalsCase('Case 2'),
        case3: totalsCase('Case 3'),
        case4: totalsCase('Case 4'),
        libraryGapAtLeast: 1_000,
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: TOTALS_WORKSHEET,
    mutation: 'DOCS/calculations/optimizer-and-comparisons/optimizer-schedule-objective-and-lifetime-tax.mutation.md',
  },
  ({ example }) => {
    type Totals = ReturnType<typeof totalsCase>
    async function expectTotals(inputs: CaseInputs, want: Totals): Promise<void> {
      const schedule = await optimizeSchedule(solverInput(inputs))
      expect(schedule.status).toBe(want.status)
      expect(
        withinTolerance(schedule.endingAfterTax, want.endingAfterTax, example.tolerance),
        `endingAfterTax: actual ${schedule.endingAfterTax}, worksheet ${want.endingAfterTax}`,
      ).toBe(true)
      expect(
        withinTolerance(schedule.lifetimeTax, want.lifetimeTax, example.tolerance),
        `lifetimeTax: actual ${schedule.lifetimeTax}, worksheet ${want.lifetimeTax}`,
      ).toBe(true)
    }

    it('case 1 weighs the end buckets at the written weights and adds the conversion reward: 1769100.80, tax 41024', async () => {
      await expectTotals(example.inputs.case1 as CaseInputs, example.expected.case1 as Totals)
    })

    it('case 2 deflates over two years, haircuts the inherited bucket, and taxes the published income, tiers and gain: 1825588.15, tax 47664.03', async () => {
      await expectTotals(example.inputs.case2 as CaseInputs, example.expected.case2 as Totals)
    })

    it('case 3, infeasible with tier binaries to decide, publishes an infinite objective and no tax', async () => {
      await expectTotals(example.inputs.case3 as CaseInputs, example.expected.case3 as Totals)
    })

    it('case 4, infeasible with no binaries, publishes an objective of 0 and no tax', async () => {
      await expectTotals(example.inputs.case4 as CaseInputs, example.expected.case4 as Totals)
    })

    it('bracket-fill-roth: the solver\'s own figures, not the projection of the same schedule', async () => {
      const library = example.inputs.libraryExample as { startYear: number; years: number; inflation: number; heirRate: number }
      const gapAtLeast = example.expected.libraryGapAtLeast as number
      const plan = bracketFillRothPlan()
      // As RetireGolden-MCP's runOptimizer calls it (its taxCalc: federal plus state).
      const options = {
        startYear: library.startYear,
        taxCalculator: combineTaxCalculators(
          createFederalTaxCalculator(),
          createStateTaxCalculator({ overridePct: plan.assumptions.stateEffectiveTaxPct, localPct: plan.assumptions.localIncomeTaxPct }),
        ),
      }
      const { schedule } = await optimizePlan(plan, options)
      expect(schedule.status).toBe('optimal')
      expect(schedule.schedule).toHaveLength(library.years)
      const input = buildOptimizerInput(plan, options)
      expect(input.liquidationRate).toBe(library.heirRate)

      // The objective at the published last row, with the weights the model
      // text writes (eight decimal places), agrees with endingAfterTax to the
      // six-significant-digit reading of that row.
      const deflator = 1 / Math.pow(1 + library.inflation, library.years)
      const weightFull = Number(deflator.toFixed(8))
      const weightHaircut = Number((deflator * (1 - library.heirRate)).toFixed(8))
      const last = schedule.schedule[schedule.schedule.length - 1]!
      const conversions = schedule.schedule.map((row) => row.conversion)
      const objective =
        weightFull * (last.endOther + last.endTaxable) +
        weightHaircut * (last.endTrad + last.endInheritedTrad) +
        0.000001 * conversions.reduce((sum, amount) => sum + amount, 0)
      const readingSlack =
        weightFull * (sixDigitHalfUnit(last.endOther) + sixDigitHalfUnit(last.endTaxable) + 0.01) +
        weightHaircut * (sixDigitHalfUnit(last.endTrad) + sixDigitHalfUnit(last.endInheritedTrad) + 0.01) +
        0.000001 * conversions.reduce((sum, amount) => sum + sixDigitHalfUnit(amount) + 0.005, 0) +
        0.005
      expect(
        Math.abs(schedule.endingAfterTax - objective),
        `endingAfterTax ${schedule.endingAfterTax} against the objective at the published last row ${objective}`,
      ).toBeLessThanOrEqual(readingSlack)

      // The projection of the same schedule: its conversions installed in the plan.
      const installed = withOptimizedConversions(plan, schedule.conversions)
      const projection = simulatePlan(installed, options)
      const summary = summarizeProjection(installed, projection, { conversionFreeRun: null })
      const basis = projectionDollarBasis(projection)
      const estateToday = summary.endingAfterTaxEstate / basis.factors[basis.factors.length - 1]!
      expect(
        schedule.endingAfterTax - estateToday,
        `solver ${schedule.endingAfterTax}, projection in today's dollars ${estateToday}`,
      ).toBeGreaterThan(gapAtLeast)
      expect(
        summary.lifetimeTaxesAndPenalties - schedule.lifetimeTax,
        `projection ${summary.lifetimeTaxesAndPenalties}, solver ${schedule.lifetimeTax}`,
      ).toBeGreaterThan(gapAtLeast)
    })
  },
)
