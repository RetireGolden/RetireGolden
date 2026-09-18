import { expect, it } from 'vitest'
import type { ExpensePhase } from '../model/plan.js'
import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import { annualDeltaPhases, SMIRK_ANNUAL_REAL_DELTA_PCT, spendingShapePhases } from './shapePresets.js'

/** The worksheet's first rows against the engine's, age by toBe and multiplier under the fixture tolerance. */
function expectFirstRows(actual: readonly ExpensePhase[], expected: readonly ExpensePhase[], tolerance: { abs: number }): void {
  expect(actual.length).toBeGreaterThanOrEqual(expected.length)
  expected.forEach((row, index) => {
    expect(actual[index]!.fromAge).toBe(row.fromAge)
    expect(
      withinTolerance(actual[index]!.multiplier, row.multiplier, tolerance),
      `row ${index} multiplier ${actual[index]!.multiplier} is not within ${JSON.stringify(tolerance)} of the worksheet's ${row.multiplier}`,
    ).toBe(true)
  })
}

describeCalculation(
  'spending-shape-annual-delta-phases',
  {
    example: {
      inputs: { annualRealDeltaPct: -2, retirementAge: 65 },
      expected: {
        firstRows: [
          { fromAge: 70, multiplier: 0.9 },
          { fromAge: 75, multiplier: 0.82 },
        ],
      },
      // The worksheet: "exact to the declared two-decimal rounding". The
      // helper's 'exact' keyword is reserved for integers, so the same
      // predicate is written as an absolute bound of 0: each row is
      // Math.round(x * 100) / 100, the same double as the two-decimal literal.
      tolerance: { abs: 0 },
    },
    worksheet: 'DOCS/calculations/spending-and-withdrawals/spending-shape-annual-delta-phases.md',
    mutation: 'DOCS/calculations/spending-and-withdrawals/spending-shape-annual-delta-phases.mutation.md',
  },
  ({ example }) => {
    const deltaPct = example.inputs.annualRealDeltaPct as number
    const retirementAge = example.inputs.retirementAge as number
    const phases = annualDeltaPhases(deltaPct, retirementAge)

    it('compiles -2%/yr from 65 into (70, 0.90) and (75, 0.82) as its first two rows', () => {
      expectFirstRows(phases, example.expected.firstRows as ExpensePhase[], example.tolerance as { abs: number })
    })

    it('steps every five years from 70 to 100, each row a two-decimal multiplier inside the phase schema', () => {
      expect(phases.map((row) => row.fromAge)).toEqual([70, 75, 80, 85, 90, 95, 100])
      for (const row of phases) {
        expect(Math.round(row.multiplier * 100) / 100).toBe(row.multiplier)
        expect(row.multiplier).toBeGreaterThanOrEqual(0)
        expect(row.multiplier).toBeLessThanOrEqual(3)
      }
    })

    it('a zero delta compiles to no phases', () => {
      expect(annualDeltaPhases(0, retirementAge)).toEqual([])
    })
  },
)

describeCalculation(
  'spending-shape-preset-compilation',
  {
    example: {
      inputs: { shape: 'smirk', retirementAge: 65, smirkAnnualDeltaPct: -1 },
      expected: {
        firstRows: [
          { fromAge: 70, multiplier: 0.95 },
          { fromAge: 75, multiplier: 0.9 },
        ],
        flatRows: [],
      },
      // As above: the worksheet's values are exact after two-decimal rounding.
      tolerance: { abs: 0 },
    },
    worksheet: 'DOCS/calculations/spending-and-withdrawals/spending-shape-preset-compilation.md',
    mutation: 'DOCS/calculations/spending-and-withdrawals/spending-shape-preset-compilation.mutation.md',
  },
  ({ example }) => {
    const retirementAge = example.inputs.retirementAge as number
    const smirk = spendingShapePhases('smirk', retirementAge)

    it('reads the -1%/yr smirk constant the worksheet states', () => {
      expect(SMIRK_ANNUAL_REAL_DELTA_PCT).toBe(example.inputs.smirkAnnualDeltaPct)
    })

    it('compiles smirk from 65 into (70, 0.95) and (75, 0.90) as its first rows', () => {
      expectFirstRows(smirk, example.expected.firstRows as ExpensePhase[], example.tolerance as { abs: number })
    })

    it('flat compiles to no phases', () => {
      expect(spendingShapePhases('flat', retirementAge)).toEqual(example.expected.flatRows)
    })

    it('smirk delegates to the annual-delta compilation at -1%/yr', () => {
      expect(smirk).toEqual(annualDeltaPhases(SMIRK_ANNUAL_REAL_DELTA_PCT, retirementAge))
    })
  },
)
