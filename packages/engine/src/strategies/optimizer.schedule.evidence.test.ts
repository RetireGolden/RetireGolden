import { expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Plan } from '../model/plan.js'
import { packForYear } from '../params/index.js'
import { summarizeProjection } from '../projection/compare.js'
import { planDollarBasis, projectionDollarBasis } from '../projection/dollarBasis.js'
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
 * rmd-irmaa's facts, without its qualified charitable distribution, entered as
 * a one-year solve, and varied to two years for the branches one year does not
 * reach; and two inputs no schedule funds.
 *
 * Every figure is read from HiGHS's raw solution through the highs package the
 * engine pins, and every one the worksheets state is compared here with the
 * stated value: a figure more than half a cent from the stated value fails
 * these cases, whatever moved it (another optimal solution after a solver
 * upgrade, or a change to the model or the readout).
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
  readonly inflationPct: number
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
  inflationPct: 2.5,
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
  inflationPct: 2.5,
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
  inflationPct: 2.5,
  irmaaLookback: true,
}
const CASE_4: CaseInputs = { ...CASE_3, years: [{ year: 2026, ...UNFUNDED_YEAR }] }

function solverInput(inputs: CaseInputs): OptimizerInput {
  const years = inputs.years.map((year) => rmdIrmaaYear(year))
  const basis = planDollarBasis(inputs.inflationPct, years[0]!.year, years[years.length - 1]!.year)
  return {
    years,
    openingTrad: inputs.openingTrad,
    openingInheritedTrad: inputs.openingInheritedTrad,
    openingOther: inputs.openingOther,
    openingTaxable: inputs.openingTaxable,
    taxableBasisRatio: inputs.taxableBasisRatio,
    ltcgRate: inputs.ltcgRate,
    irmaaLookback: inputs.irmaaLookback,
    liquidationRate: inputs.liquidationRate,
    // As projection/optimizePlan.ts#buildOptimizerInput deflates: by the last
    // plan year's general-inflation factor on the engine's basis.
    realDollarFactor: 1 / basis.factors[years.length - 1]!,
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
/** A case the worksheet says publishes no rows ("no rows" in its first cell). */
function yearCaseHasNoRows(caseLabel: 'Case 3' | 'Case 4'): boolean {
  return yearRows.get(caseLabel)?.[0] === 'no rows'
}

describeCalculation(
  'optimizer-schedule-year-solution',
  {
    example: {
      inputs: { example: 'rmd-irmaa', case1: CASE_1, case2: CASE_2, case3: CASE_3, case4: CASE_4 },
      expected: {
        case1: yearCase('Case 1'),
        case2: yearCase('Case 2'),
        case3NoRows: yearCaseHasNoRows('Case 3'),
        case4NoRows: yearCaseHasNoRows('Case 4'),
      },
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

    it('case 1 converts through the 24% bracket, draws the floor and pays the tax from the tax-free bucket: conversion 107028.88', async () => {
      const schedule = await optimizeSchedule(solverInput(example.inputs.case1 as CaseInputs))
      expect(schedule.status).toBe('optimal')
      expectYears(schedule, example.expected.case1 as ReturnType<typeof yearCase>)
    })

    it('case 2 draws both floors, sells to fund 2026 and saves in 2027: sale 59245.18, tiers 2 and 1', async () => {
      const schedule = await optimizeSchedule(solverInput(example.inputs.case2 as CaseInputs))
      expect(schedule.status).toBe('optimal')
      expectYears(schedule, example.expected.case2 as ReturnType<typeof yearCase>)
    })

    it('cases 3 and 4 have no solution and publish no rows and no conversions', async () => {
      for (const [inputs, noRows] of [
        [example.inputs.case3, example.expected.case3NoRows],
        [example.inputs.case4, example.expected.case4NoRows],
      ] as const) {
        expect(noRows).toBe(true)
        const schedule = await optimizeSchedule(solverInput(inputs as CaseInputs))
        expect(schedule.status).toBe('infeasible')
        expect(schedule.schedule).toEqual([])
        expect(schedule.conversions).toEqual([])
      }
    })
  },
)

const TOTALS_WORKSHEET = 'DOCS/calculations/optimizer-and-comparisons/optimizer-schedule-objective-and-lifetime-tax.md'
const totalsRows = worksheetExpectedRows(TOTALS_WORKSHEET)
/** One worksheet row: status, and the two figures ("none" is a null figure, a solve with no solution). */
function totalsCase(caseLabel: string): { status: string; endingAfterTax: number | null; lifetimeTax: number | null } {
  const [status, endingAfterTax, lifetimeTax] = totalsRows.get(caseLabel)!
  return {
    status: status!,
    endingAfterTax: endingAfterTax === 'none' ? null : worksheetNumber(endingAfterTax!),
    lifetimeTax: lifetimeTax === 'none' ? null : worksheetNumber(lifetimeTax!),
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
        libraryExample: { id: 'bracket-fill-roth', startYear: 2026, years: 24, inflationPct: 2.5, heirRate: 0.25 },
      },
      expected: {
        case1: totalsCase('Case 1'),
        case2: totalsCase('Case 2'),
        case3: totalsCase('Case 3'),
        case4: totalsCase('Case 4'),
        libraryGapAtLeast: 1_000,
        // Measured, not derived (the worksheet's "Measured on a library
        // example"), and pinned so the dollars the record publishes cannot go
        // stale while the gaps above still hold.
        libraryMeasured: {
          endingAfterTax: 282_266.26,
          projectionEstateNominal: 470_194.78,
          projectionEstateToday: 266_458.08,
          lifetimeTax: 181_976.47,
          projectionLifetimeTax: 251_819.64,
        },
        // The worksheet's written weights for the 24-year solve, deflated over 23 years.
        libraryWeights: { full: 0.56669724, haircut: 0.42502293 },
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: TOTALS_WORKSHEET,
    mutation: 'DOCS/calculations/optimizer-and-comparisons/optimizer-schedule-objective-and-lifetime-tax.mutation.md',
  },
  ({ example }) => {
    type Totals = ReturnType<typeof totalsCase>
    function same(actual: number | null, want: number | null, label: string): void {
      if (want === null) {
        expect(actual, label).toBeNull()
        return
      }
      expect(actual, label).not.toBeNull()
      expect(withinTolerance(actual!, want, example.tolerance), `${label}: actual ${actual}, worksheet ${want}`).toBe(true)
    }
    async function expectTotals(inputs: CaseInputs, want: Totals): Promise<OptimizedSchedule> {
      const schedule = await optimizeSchedule(solverInput(inputs))
      expect(schedule.status).toBe(want.status)
      same(schedule.endingAfterTax, want.endingAfterTax, 'endingAfterTax')
      same(schedule.lifetimeTax, want.lifetimeTax, 'lifetimeTax')
      return schedule
    }

    it('case 1 does not deflate a one-year plan, haircuts the traditional bucket and adds the conversion reward: 1813328.33, tax 41024', async () => {
      await expectTotals(example.inputs.case1 as CaseInputs, example.expected.case1 as Totals)
    })

    it('case 2 deflates over one year, haircuts the inherited bucket, and taxes the published income, tiers and gain: 1871227.85, tax 47663.94', async () => {
      await expectTotals(example.inputs.case2 as CaseInputs, example.expected.case2 as Totals)
    })

    it('case 3, infeasible with tier binaries to decide, publishes no figures and no schedule', async () => {
      const schedule = await expectTotals(example.inputs.case3 as CaseInputs, example.expected.case3 as Totals)
      expect(schedule.schedule).toEqual([])
      expect(schedule.conversionTotal).toBe(0)
    })

    it('case 4, infeasible with no binaries, publishes no figures and no schedule', async () => {
      const schedule = await expectTotals(example.inputs.case4 as CaseInputs, example.expected.case4 as Totals)
      expect(schedule.schedule).toEqual([])
      expect(schedule.conversionTotal).toBe(0)
    })

    it('bracket-fill-roth: the solver\'s own figures, not the projection of the same schedule', async () => {
      const library = example.inputs.libraryExample as { startYear: number; years: number; inflationPct: number; heirRate: number }
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
      // text writes (eight decimal places) for the deflator over the 23 years
      // from the first plan year to the last, agrees with endingAfterTax to
      // the cent the row is published in.
      const deflator = 1 / planDollarBasis(library.inflationPct, library.startYear, library.startYear + library.years - 1).factors[library.years - 1]!
      expect(input.realDollarFactor).toBe(deflator)
      const weightFull = Number(deflator.toFixed(8))
      const weightHaircut = Number((deflator * (1 - library.heirRate)).toFixed(8))
      const weights = example.expected.libraryWeights as { full: number; haircut: number }
      expect(weightFull).toBe(weights.full)
      expect(weightHaircut).toBe(weights.haircut)
      const endingAfterTax = schedule.endingAfterTax!
      const lifetimeTax = schedule.lifetimeTax!
      const last = schedule.schedule[schedule.schedule.length - 1]!
      const conversions = schedule.schedule.map((row) => row.conversion)
      const objective =
        weightFull * (last.endOther + last.endTaxable) +
        weightHaircut * (last.endTrad + last.endInheritedTrad) +
        0.000001 * conversions.reduce((sum, amount) => sum + amount, 0)
      const centSlack =
        weightFull * 0.01 + weightHaircut * 0.01 + 0.000001 * conversions.length * 0.005 + 0.005
      expect(
        Math.abs(endingAfterTax - objective),
        `endingAfterTax ${endingAfterTax} against the objective at the published last row ${objective}`,
      ).toBeLessThanOrEqual(centSlack)

      // The projection of the same schedule: its conversions installed in the plan.
      const installed = withOptimizedConversions(plan, schedule.conversions)
      const projection = simulatePlan(installed, options)
      const summary = summarizeProjection(installed, projection, { conversionFreeRun: null })
      const basis = projectionDollarBasis(projection)
      const estateToday = summary.endingAfterTaxEstate / basis.factors[basis.factors.length - 1]!
      // The solver's deflator is the projection's own last-year factor.
      expect(basis.factors[basis.factors.length - 1]!).toBe(1 / deflator)
      expect(endingAfterTax - estateToday, `solver ${endingAfterTax}, projection in today's dollars ${estateToday}`).toBeGreaterThan(gapAtLeast)
      expect(
        summary.lifetimeTaxesAndPenalties - lifetimeTax,
        `projection ${summary.lifetimeTaxesAndPenalties}, solver ${lifetimeTax}`,
      ).toBeGreaterThan(gapAtLeast)

      const measured = example.expected.libraryMeasured as {
        endingAfterTax: number
        projectionEstateNominal: number
        projectionEstateToday: number
        lifetimeTax: number
        projectionLifetimeTax: number
      }
      const pinned: [string, number, number][] = [
        ['endingAfterTax', endingAfterTax, measured.endingAfterTax],
        ["projection's estate, nominal", summary.endingAfterTaxEstate, measured.projectionEstateNominal],
        ["projection's estate in today's dollars", estateToday, measured.projectionEstateToday],
        ['lifetimeTax', lifetimeTax, measured.lifetimeTax],
        ["projection's lifetime taxes and penalties", summary.lifetimeTaxesAndPenalties, measured.projectionLifetimeTax],
      ]
      for (const [label, actual, want] of pinned) {
        expect(withinTolerance(actual, want, example.tolerance), `${label}: actual ${actual}, measured ${want}`).toBe(true)
      }
    })
  },
)
