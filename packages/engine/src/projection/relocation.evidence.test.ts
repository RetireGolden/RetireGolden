import { expect, it, vi } from 'vitest'
import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import { createEmptyPlan, parsePlan, type Plan } from '../model/plan.js'
import { stateParamsFor, type StateTaxParams } from '../params/state/index.js'
import * as stateTax from '../tax/stateTax.js'
import type { TaxCalculator } from './types.js'
import { compareRelocationCandidates } from './relocation.js'

/**
 * A destination state with a modeled pack that neither taxes Social Security
 * nor folds public pensions into one shared retirement rule, so every driver
 * the worksheet names is attributable rather than short-circuited to zero.
 */
const DESTINATION = 'AL'
const START_YEAR = 2026

/** A validated plan: `parsePlan` is the production gate every real plan passes. */
function evidencePlan(dob: string, planningAge: number): Plan {
  let counter = 0
  const plan = createEmptyPlan({
    newId: () => `reloc-${++counter}`,
    now: () => new Date('2026-06-11T00:00:00.000Z'),
  })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob,
    sex: 'average',
    retirementAge: 65,
    longevity: { planningAge, source: 'manual' },
  }
  plan.assumptions.inflationPct = 0
  plan.assumptions.healthcareExtraInflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  plan.assumptions.stateEffectiveTaxPct = 0
  plan.assumptions.localIncomeTaxPct = 0
  plan.expenses.baseAnnual = 40_000
  plan.accounts = [
    {
      type: 'cash',
      id: 'cash-1',
      name: 'Cash',
      ownerPersonId: null,
      annualReturnPct: 0,
      balance: 1_000_000,
      annualContribution: 0,
    },
  ]
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

/**
 * Which neutralization a `mapParams` transform performs, read off the
 * destination state's own resolved params. `computeDrivers` scopes each
 * transform to the row's destination state, so a transform that leaves the
 * destination pack untouched is the as-modeled replay. Anything else is a
 * probe the worksheet does not describe, and it throws rather than inventing
 * a figure.
 */
type Neutralization = 'actual' | 'ss' | 'retirement' | 'publicPension' | 'capitalGains'

function neutralizationOf(mapParams: ((p: StateTaxParams) => StateTaxParams) | undefined): Neutralization {
  if (mapParams === undefined) return 'actual'
  const probe = stateParamsFor(DESTINATION, START_YEAR)
  if (!probe) throw new Error('No modeled pack for ' + DESTINATION)
  const mapped = mapParams(probe)
  if (mapped === probe) return 'actual'
  if (mapped.taxesSocialSecurity !== probe.taxesSocialSecurity) return 'ss'
  if (mapped.capitalGainsTaxablePct === 100 && mapped.capitalLossCarryforwardConformity === 'federal') {
    return 'capitalGains'
  }
  const privateNeutralized = mapped.retirementPrivate.kind === 'none' && probe.retirementPrivate.kind !== 'none'
  const publicNeutralized = mapped.retirementPublic.kind === 'none' && probe.retirementPublic.kind !== 'none'
  if (privateNeutralized && publicNeutralized) return 'retirement'
  if (publicNeutralized) return 'publicPension'
  throw new Error('Probe outside the worksheet neutralization table')
}

/**
 * The worksheet's recorded state-tax lines, injected at the
 * `createStateTaxCalculator` seam: the recording wrapper, the ledger run, the
 * reconciliation guard, the row assembly and the sums are all the real code
 * path. A year the worksheet does not list fails closed.
 */
function injectStateTaxTable(table: Readonly<Record<Neutralization, Readonly<Record<number, number>>>>) {
  return vi
    .spyOn(stateTax, 'createStateTaxCalculator')
    .mockImplementation((opts = {}): ReturnType<typeof stateTax.createStateTaxCalculator> => {
      const neutralization = neutralizationOf(opts.mapParams)
      const calculator: TaxCalculator = {
        compute(input) {
          const amount = table[neutralization][input.year]
          if (amount === undefined) {
            throw new Error(`Year ${input.year} is outside the worksheet state-tax table`)
          }
          return amount
        },
      }
      return calculator as ReturnType<typeof stateTax.createStateTaxCalculator>
    })
}

describeCalculation(
  'relocation-lifetime-state-local-tax',
  {
    example: {
      inputs: {
        lines: [
          { year: 2026, tax: 4_250.0 },
          { year: 2027, tax: 5_100.25 },
          { year: 2028, tax: 3_900.0 },
        ],
      },
      expected: { lifetimeStateLocalTax: 13_250.25 },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/taxes/relocation-lifetime-state-local-tax.md',
    mutation: 'DOCS/calculations/taxes/relocation-lifetime-state-local-tax.mutation.md',
  },
  ({ example }) => {
    it('sums the three recorded annual lines to 13250.25', () => {
      const lines = (example.inputs as Record<string, unknown>).lines as { year: number; tax: number }[]
      const byYear: Record<number, number> = {}
      for (const line of lines) byYear[line.year] = line.tax
      const table = {
        actual: byYear,
        ss: byYear,
        retirement: byYear,
        publicPension: byYear,
        capitalGains: byYear,
      }
      const spy = injectStateTaxTable(table)
      try {
        // Planning age 60 on a 1968 birth year ends the run in 2028, so the
        // ledger records exactly the worksheet's three years.
        const comparison = compareRelocationCandidates(
          evidencePlan('1968-01-01', 60),
          [{ state: DESTINATION }],
          { startYear: START_YEAR },
        )
        const row = comparison.rows.find((candidate) => candidate.candidate !== null)!
        expect(row.error).toBe(null)
        expect(row.stateTaxByYear).toEqual(lines)
        const expected = example.expected.lifetimeStateLocalTax as number
        expect(
          withinTolerance(row.lifetimeStateLocalTax, expected, example.tolerance),
          `lifetimeStateLocalTax: actual ${row.lifetimeStateLocalTax}, worksheet ${expected}`,
        ).toBe(true)
        // The wrong readings: post-move years only, and a real-dollar discount.
        expect(row.lifetimeStateLocalTax).not.toBe(lines[1]!.tax + lines[2]!.tax)
      } finally {
        spy.mockRestore()
      }
    })
  },
)

describeCalculation(
  'relocation-state-tax-driver-savings',
  {
    example: {
      inputs: {
        years: [
          { year: 2026, actual: 5_000, ss: 5_600, retirement: 5_900, publicPension: 5_250, capitalGains: 4_900 },
          { year: 2027, actual: 6_000, ss: 6_700, retirement: 6_900, publicPension: 6_300, capitalGains: 5_950 },
        ],
      },
      expected: {
        ssTreatmentSavings: 1_300.0,
        retirementExclusionSavings: 1_800.0,
        publicPensionExclusionSavings: 550.0,
        capitalGainsTreatmentSavings: -150.0,
        totalStateLocalTax: 11_000.0,
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/taxes/relocation-state-tax-driver-savings.md',
    mutation: 'DOCS/calculations/taxes/relocation-state-tax-driver-savings.mutation.md',
  },
  ({ example }) => {
    it('attributes 1300, 1800, 550 and -150 from the one-at-a-time recomputations', () => {
      const rows = (example.inputs as Record<string, unknown>).years as {
        year: number
        actual: number
        ss: number
        retirement: number
        publicPension: number
        capitalGains: number
      }[]
      const column = (pick: (row: (typeof rows)[number]) => number): Record<number, number> => {
        const out: Record<number, number> = {}
        for (const row of rows) out[row.year] = pick(row)
        return out
      }
      const spy = injectStateTaxTable({
        actual: column((row) => row.actual),
        ss: column((row) => row.ss),
        retirement: column((row) => row.retirement),
        publicPension: column((row) => row.publicPension),
        capitalGains: column((row) => row.capitalGains),
      })
      try {
        // Planning age 60 on a 1967 birth year ends the run in 2027, so the
        // ledger records exactly the worksheet's two years.
        const comparison = compareRelocationCandidates(
          evidencePlan('1967-01-01', 60),
          [{ state: DESTINATION }],
          { startYear: START_YEAR },
        )
        const row = comparison.rows.find((candidate) => candidate.candidate !== null)!
        expect(row.error).toBe(null)
        const drivers = row.drivers!
        expect(drivers.facts?.state).toBe(DESTINATION)
        const expected = example.expected as Record<string, number>
        const checks: [keyof typeof drivers, number][] = [
          ['totalStateLocalTax', expected.totalStateLocalTax!],
          ['ssTreatmentSavings', expected.ssTreatmentSavings!],
          ['retirementExclusionSavings', expected.retirementExclusionSavings!],
          ['publicPensionExclusionSavings', expected.publicPensionExclusionSavings!],
          ['capitalGainsTreatmentSavings', expected.capitalGainsTreatmentSavings!],
        ]
        for (const [field, worksheet] of checks) {
          const actual = drivers[field] as number
          expect(
            withinTolerance(actual, worksheet, example.tolerance),
            `${String(field)}: actual ${actual}, worksheet ${worksheet}`,
          ).toBe(true)
        }
        // The wrong reading: reversing the counterfactual subtraction.
        expect(drivers.ssTreatmentSavings).not.toBe(-expected.ssTreatmentSavings!)
      } finally {
        spy.mockRestore()
      }
    })
  },
)
