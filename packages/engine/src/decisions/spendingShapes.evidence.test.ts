import { expect, it } from 'vitest'

import { describeCalculation } from '../rules/describeCalculation.js'
import { singlePersonPlan, validatePlan } from '../testing/planFixtures.js'
import type { SpendingShapeId } from '../spending/shapePresets.js'
import { planWithSpendingShape, spendingShapeRows, SPENDING_SHAPE_COMPARISON, type SolvedSpendingShape } from './spendingShapes.js'
import { roundSolvedSpending } from './spendingSolver.js'

/** A flat row and one shape row as the solver publishes them: each passing probe rounded down to $100. */
function published(flatProbe: number | null, shape: SpendingShapeId, shapeProbe: number | null): SolvedSpendingShape[] {
  const row = (s: SpendingShapeId, probe: number | null): SolvedSpendingShape => ({
    shape: s,
    maxBaseAnnual: probe === null ? null : roundSolvedSpending(probe),
    maxBaseAnnualRounding: probe === null ? null : 'down-to-hundred',
  })
  return [row('flat', flatProbe), row(shape, shapeProbe)]
}

describeCalculation(
  'spending-shape-comparison',
  {
    example: {
      inputs: {
        caseA: { flat: 50_050, shape: 50_149 },
        caseB: { flat: 50_099, shape: 50_100 },
        caseC: { flat: 50_000, shape: 50_099 },
        caseD: { flat: 50_100, shape: 50_001 },
        caseE: { flat: 62_813, shape: 67_109 },
        caseF: { flat: null, shape: 55_000 },
        caseG: { flat: 48_000, shape: 48_000 },
        caseH: { retirementAge: 65, ownPhases: [{ fromAge: 70, multiplier: 1.2 }] },
        caseI: { flat: 50_000, shapeExact: 50_149 },
      },
      expected: {
        caseA: { maxBaseAnnual: 50_100, delta: 100, retired: 99, printed: '+$100/yr' },
        caseB: { maxBaseAnnual: 50_100, delta: 100, retired: 1, printed: '+$100/yr' },
        caseC: { maxBaseAnnual: 50_000, delta: 0, retired: 99, printed: '+$0/yr' },
        caseD: { maxBaseAnnual: 50_000, delta: -100, retired: -99, printed: '-$100/yr' },
        caseE: { maxBaseAnnual: 67_100, delta: 4_300, retired: 4_296, printed: '+$4,300/yr' },
        caseF: { maxBaseAnnual: 55_000, delta: null },
        caseG: { maxBaseAnnual: 48_000, delta: 0, retired: 0, printed: '+$0/yr' },
        caseH: {
          flat: [],
          smile: [
            { fromAge: 75, multiplier: 0.9 },
            { fromAge: 85, multiplier: 0.8 },
          ],
          smirk: [
            { fromAge: 70, multiplier: 0.95 },
            { fromAge: 75, multiplier: 0.9 },
            { fromAge: 80, multiplier: 0.86 },
            { fromAge: 85, multiplier: 0.82 },
            { fromAge: 90, multiplier: 0.78 },
            { fromAge: 95, multiplier: 0.74 },
            { fromAge: 100, multiplier: 0.7 },
          ],
        },
        caseI: { delta: 149 },
        largestResidueGap: 99,
      },
      tolerance: { abs: 0 },
    },
    worksheet: 'DOCS/calculations/spending-and-withdrawals/spending-shape-delta-vs-flat.md',
    mutation: 'DOCS/calculations/spending-and-withdrawals/spending-shape-delta-vs-flat.mutation.md',
  },
  ({ example }) => {
    type Pair = { flat: number | null; shape: number | null }
    const inputs = example.inputs as Record<string, unknown>
    const expected = example.expected as Record<string, Record<string, unknown>>
    const printed = (delta: number) => `${delta >= 0 ? '+' : '-'}$${Math.abs(delta).toLocaleString('en-US')}/yr`

    it('cases A to G: each difference is taken between the two published amounts (R5)', () => {
      for (const key of ['caseA', 'caseB', 'caseC', 'caseD', 'caseE', 'caseF', 'caseG'] as const) {
        const c = inputs[key] as Pair
        const e = expected[key]!
        const rows = spendingShapeRows(published(c.flat, 'smile', c.shape))
        expect(rows[0]!.deltaVsFlatDollars, `${key} flat row`).toBeNull()
        expect(rows[1]!.maxBaseAnnual, key).toBe(e.maxBaseAnnual)
        expect(rows[1]!.deltaVsFlatDollars, key).toBe(e.delta)
        if (e.delta !== null) {
          expect(printed(rows[1]!.deltaVsFlatDollars!), key).toBe(e.printed)
          // The retired page subtracted the passing probes.
          expect(c.shape! - c.flat!, `${key} retired`).toBe(e.retired)
        }
      }
    })

    it('never differs from the retired exact difference by more than $99', () => {
      let largest = 0
      for (let r = 0; r < 100; r++) {
        for (let s = 0; s < 100; s++) {
          const flat = 50_000 + r
          const shape = 60_000 + s
          const rows = spendingShapeRows(published(flat, 'smirk', shape))
          largest = Math.max(largest, Math.abs(rows[1]!.deltaVsFlatDollars! - (shape - flat)))
        }
      }
      expect(largest).toBe(expected.largestResidueGap)
    })

    it('case I: a guardrail row published at its exact amount differs by its own shown amount', () => {
      const c = inputs.caseI as { flat: number; shapeExact: number }
      const rows = spendingShapeRows([
        { shape: 'flat', maxBaseAnnual: c.flat, maxBaseAnnualRounding: 'down-to-hundred' },
        { shape: 'smile', maxBaseAnnual: c.shapeExact, maxBaseAnnualRounding: 'none' },
      ])
      expect(rows[1]!.deltaVsFlatDollars).toBe(expected.caseI!.delta)
    })

    it('refuses what is not the solver published answer, and a comparison without exactly one flat row', () => {
      expect(() =>
        spendingShapeRows([
          { shape: 'flat', maxBaseAnnual: 50_000, maxBaseAnnualRounding: 'down-to-hundred' },
          { shape: 'smile', maxBaseAnnual: 50_149, maxBaseAnnualRounding: 'down-to-hundred' },
        ]),
      ).toThrow(RangeError)
      expect(() => spendingShapeRows([{ shape: 'smile', maxBaseAnnual: 50_100, maxBaseAnnualRounding: 'down-to-hundred' }])).toThrow(RangeError)
      expect(() =>
        spendingShapeRows([
          { shape: 'flat', maxBaseAnnual: 50_000, maxBaseAnnualRounding: 'down-to-hundred' },
          { shape: 'flat', maxBaseAnnual: 50_000, maxBaseAnnualRounding: 'down-to-hundred' },
        ]),
      ).toThrow(RangeError)
      expect(() => spendingShapeRows([{ shape: 'flat', maxBaseAnnual: 50_000, maxBaseAnnualRounding: null }])).toThrow(RangeError)
      expect(() => spendingShapeRows([{ shape: 'flat', maxBaseAnnual: null, maxBaseAnnualRounding: 'none' }])).toThrow(RangeError)
      expect(() => spendingShapeRows([{ shape: 'flat', maxBaseAnnual: -100, maxBaseAnnualRounding: 'none' }])).toThrow(RangeError)
    })

    it('case H: each shape replaces the plan phases; amortized spending is removed, guardrails kept', () => {
      const h = inputs.caseH as { retirementAge: number; ownPhases: { fromAge: number; multiplier: number }[] }
      const plan = singlePersonPlan({ dob: '1961-06-15', retirementAge: h.retirementAge, planningAge: 95 })
      plan.expenses.phases = h.ownPhases
      plan.expenses.spendingPolicy = { mode: 'abw' }
      const abwPlan = validatePlan(plan)
      expect(SPENDING_SHAPE_COMPARISON).toEqual(['flat', 'smile', 'smirk'])
      for (const shape of SPENDING_SHAPE_COMPARISON) {
        const variant = planWithSpendingShape(abwPlan, shape)
        expect(variant.expenses.phases, shape).toEqual(expected.caseH![shape])
        expect('spendingPolicy' in variant.expenses, shape).toBe(false)
        expect(variant.accounts).toBe(abwPlan.accounts)
      }
      const guarded = { ...abwPlan, expenses: { ...abwPlan.expenses, spendingPolicy: { mode: 'withdrawalRateGuardrails' as const } } }
      expect(planWithSpendingShape(guarded, 'smile').expenses.spendingPolicy).toEqual({ mode: 'withdrawalRateGuardrails' })
    })

    it('case H without a retirement age: the shapes step from 65', () => {
      const plan = validatePlan(singlePersonPlan({ dob: '1961-06-15', planningAge: 95 }))
      expect(plan.household.people[0]!.retirementAge).toBeNull()
      expect(planWithSpendingShape(plan, 'smirk').expenses.phases).toEqual(expected.caseH!.smirk)
    })
  },
)
