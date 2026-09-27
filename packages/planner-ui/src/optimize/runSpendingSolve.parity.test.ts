/**
 * B2-P1 slice 2 parity for the spending solver page on every library
 * example: the worker passes the engine's published answer, slack and
 * withdrawal rate through, and they equal what the page used to compute
 * from the level that passed (owner decision R4); the spending-shape rows are
 * built by the engine on the plans the page used to build, and their
 * differences are taken between the amounts shown (R5).
 */
import { describe, expect, it } from 'vitest'

import type { Plan } from '@retiregolden/engine/model/plan'
import { startingInvestableOf } from '@retiregolden/engine/montecarlo/riskBasedGuardrails'
import { spendingShapePhases } from '@retiregolden/engine/spending/shapePresets'
import { planWithSpendingShape, spendingShapeRows, SPENDING_SHAPE_COMPARISON } from '@retiregolden/engine/decisions/spendingShapes'
import { compareSwrRules } from '@retiregolden/engine/decisions/swrComparator'
import { planDollarBasis, toTodayDollars } from '@retiregolden/engine/projection/dollarBasis'
import { taxCalculatorFor } from '../planTaxCalculator'
import { EXAMPLE_FIXED_YEAR } from '../planner/examples/buildContext'
import { EXAMPLE_PLANS } from '../planner/examples/registry'
import { runSpendingSolveRequest } from './runSpendingSolve'

/** The plan the page built for one shape until slice 2. */
function retiredVariant(plan: Plan, shape: 'flat' | 'smile' | 'smirk'): Plan {
  const retirementAge = plan.household.people[0]?.retirementAge ?? 65
  return {
    ...plan,
    expenses: {
      ...plan.expenses,
      phases: spendingShapePhases(shape, retirementAge),
      ...(plan.expenses.spendingPolicy?.mode === 'abw' ? { spendingPolicy: undefined } : {}),
    },
  }
}

const floor100 = (x: number) => Math.floor(x / 100) * 100

/** The page's retired conversion (todayDollarsOf): the plan's rate from the solve's start year, by the ledger's recurrence. */
function retiredTodayDollars(inflationPct: number, startYear: number, year: number, amount: number): number | null {
  if (year < startYear) return null
  return toTodayDollars(planDollarBasis(inflationPct, startYear, year), year, amount)
}

describe("the spending page's today's-dollar estates", () => {
  it("equal the retired conversion bit for bit, and are not the nominal figures, on every answering example", () => {
    let evidenceChecked = 0
    let swrChecked = 0
    for (const example of EXAMPLE_PLANS) {
      const plan = example.build()
      const solved = runSpendingSolveRequest({ plan, startYear: EXAMPLE_FIXED_YEAR })
      const evidence = solved.evidence
      if (evidence !== null) {
        evidenceChecked++
        const retired = retiredTodayDollars(plan.assumptions.inflationPct, EXAMPLE_FIXED_YEAR, evidence.endYear, evidence.endingAfterTaxEstate)
        expect(Object.is(evidence.endingAfterTaxEstateTodayDollars, retired), `${example.id} evidence`).toBe(true)
        expect(evidence.endingAfterTaxEstateTodayDollars, `${example.id} evidence`).not.toBe(evidence.endingAfterTaxEstate)
      }
      for (const row of compareSwrRules(plan, { startYear: EXAMPLE_FIXED_YEAR, taxCalculator: taxCalculatorFor(plan) })) {
        if (row.depletionYear !== null) continue
        swrChecked++
        const retired = retiredTodayDollars(plan.assumptions.inflationPct, EXAMPLE_FIXED_YEAR, row.endYear, row.endingAfterTaxEstate)
        expect(Object.is(row.endingAfterTaxEstateTodayDollars, retired), `${example.id} ${row.id}`).toBe(true)
      }
    }
    expect(evidenceChecked).toBe(27)
    expect(swrChecked).toBeGreaterThan(0)
  }, 600_000)
})

describe('the spending solver page reads the engine on every example', () => {
  it('publishes the retired floor, slack and rate; builds the retired shape plans; shows R5 differences', () => {
    let answered = 0
    let shapeRows = 0
    let deltaChanges = 0
    for (const example of EXAMPLE_PLANS) {
      const plan = example.build()
      const solved = runSpendingSolveRequest({ plan, startYear: EXAMPLE_FIXED_YEAR })
      if (solved.feasibleBaseAnnual === null || solved.feasibleBaseAnnual === undefined) {
        expect(solved.maxBaseAnnual, example.id).toBeNull()
        expect(solved.initialWithdrawalRatePct, example.id).toBeNull()
      } else {
        answered++
        // No example with an answer spends under guardrails, so every answer is the rounded one.
        expect(solved.maxBaseAnnualRounding, example.id).toBe('down-to-hundred')
        expect(solved.maxBaseAnnual, example.id).toBe(floor100(solved.feasibleBaseAnnual))
        expect(Object.is(solved.spendingSlackDollars, solved.maxBaseAnnual! - plan.expenses.baseAnnual), example.id).toBe(true)
        const investable = startingInvestableOf(plan)
        expect(Object.is(solved.initialWithdrawalRatePct, (floor100(solved.feasibleBaseAnnual) / investable) * 100), example.id).toBe(true)
      }

      const solves = SPENDING_SHAPE_COMPARISON.map((shape) => {
        const variant = planWithSpendingShape(plan, shape)
        // The engine's plan is the page's retired construction (an ABW policy
        // is left out rather than set to undefined, which toEqual treats alike).
        expect(variant, `${example.id} ${shape}`).toEqual(retiredVariant(plan, shape as 'flat' | 'smile' | 'smirk'))
        const result = runSpendingSolveRequest({ plan: variant, startYear: EXAMPLE_FIXED_YEAR })
        return { shape, result }
      })
      const rows = spendingShapeRows(
        solves.map(({ shape, result }) => ({ shape, maxBaseAnnual: result.maxBaseAnnual, maxBaseAnnualRounding: result.maxBaseAnnualRounding ?? null })),
      )
      const flat = solves[0]!.result
      rows.forEach((row, index) => {
        const result = solves[index]!.result
        expect(row.maxBaseAnnual).toBe(result.maxBaseAnnual)
        if (row.shape === 'flat' || row.deltaVsFlatDollars === null) return
        shapeRows++
        expect(row.deltaVsFlatDollars).toBe(row.maxBaseAnnual! - flat.maxBaseAnnual!)
        const retiredDelta = result.feasibleBaseAnnual! - flat.feasibleBaseAnnual!
        if (retiredDelta !== row.deltaVsFlatDollars) deltaChanges++
        expect(Math.abs(retiredDelta - row.deltaVsFlatDollars)).toBeLessThanOrEqual(99)
      })
      if (example.id === 'under-saved-single') {
        const smile = rows.find((row) => row.shape === 'smile')!
        // R5: the table printed "+$5,063/yr" beside a $5,100 gap; it now prints the gap.
        expect(smile.deltaVsFlatDollars).toBe(5_100)
        expect(solves[1]!.result.feasibleBaseAnnual! - solves[0]!.result.feasibleBaseAnnual!).toBe(5_063)
      }
    }
    // Re-measured after #748 and #750 (the slice 2 addendum).
    expect({ answered, shapeRows, deltaChanges }).toEqual({ answered: 27, shapeRows: 54, deltaChanges: 48 })
  }, 600_000)
})
