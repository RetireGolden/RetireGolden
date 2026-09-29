/**
 * The spending-shape comparison the "How much can I spend?" page shows: the
 * plan solved once per spending shape, and each shape's published answer
 * beside its difference from the constant-real (flat) shape's.
 *
 * Owner decision R5 (2026-09-25): the "vs constant-real" difference is taken
 * between the two published amounts the table shows, so it always equals
 * their visible gap. The page used to subtract the exact passing probes and
 * print the result beside amounts rounded down to $100, so a $100 gap could
 * print as "+$99" and no gap as "+$99".
 *
 * @see DOCS/calculations/spending-and-withdrawals/spending-shape-delta-vs-flat.md
 */

import type { Plan } from '../model/plan.js'
import { spendingShapePhases, type SpendingShapeId } from '../spending/shapePresets.js'
import { SOLVED_SPENDING_STEP_DOLLARS, type SustainableSpendingResult } from './spendingSolver.js'

/** The shapes the comparison solves, in the order the table lists them. */
export const SPENDING_SHAPE_COMPARISON = Object.freeze(['flat', 'smile', 'smirk'] as const) satisfies readonly SpendingShapeId[]

/** A shape the comparison solves (front-loaded is a preset, not one of them). */
export type ComparedSpendingShape = (typeof SPENDING_SHAPE_COMPARISON)[number]

/**
 * The plan solved for one shape: the plan's own spending phases replaced by
 * the shape's rows (`spendingShapePhases`, on the retirement age of the person
 * the phases follow, `expenses.phasesAgeOf` or the only person, 65 when it is
 * unset), and an amortized (ABW) spending policy removed,
 * since ABW ignores the base amount the solver moves. Every other field,
 * including a guardrail policy, is unchanged. The removed policy is left out
 * of the returned expenses, not set to undefined.
 */
export function planWithSpendingShape(plan: Plan, shape: SpendingShapeId): Plan {
  // A two-person plan that names no one yet (one built without loading)
  // names the person listed first, and says so by writing the field.
  const phasesAgeOf = plan.expenses.phasesAgeOf ?? (plan.household.people.length > 1 ? plan.household.people[0]?.id : undefined)
  const person = plan.household.people.find((p) => p.id === phasesAgeOf) ?? (plan.household.people.length === 1 ? plan.household.people[0] : undefined)
  const retirementAge = person?.retirementAge ?? 65
  const { spendingPolicy, ...withoutPolicy } = plan.expenses
  const expenses = spendingPolicy?.mode === 'abw' ? withoutPolicy : plan.expenses
  return {
    ...plan,
    expenses: {
      ...expenses,
      phases: spendingShapePhases(shape, retirementAge),
      ...(phasesAgeOf !== undefined ? { phasesAgeOf } : {}),
    },
  }
}

/** One shape's solve, as the comparison reads it. */
export interface SolvedSpendingShape {
  shape: SpendingShapeId
  /** The shape solve's published `maxBaseAnnual`, or null when it found no answer. */
  maxBaseAnnual: number | null
  /** The shape solve's `maxBaseAnnualRounding`. */
  maxBaseAnnualRounding: SustainableSpendingResult['maxBaseAnnualRounding']
}

export interface SpendingShapeRow {
  shape: SpendingShapeId
  /** The shape solve's published `maxBaseAnnual` (today's dollars a year), or null. */
  maxBaseAnnual: number | null
  /**
   * `maxBaseAnnual` minus the flat row's `maxBaseAnnual` (today's dollars a
   * year): the difference of the two amounts the table shows. Null on the flat
   * row and when either amount is null.
   */
  deltaVsFlatDollars: number | null
}

/**
 * The comparison rows, in input order. Refuses (RangeError) input without
 * exactly one flat row, a shape listed twice, and any row that is not a
 * published answer: an amount that is negative or not finite, an amount
 * without its rounding (or a rounding without an amount), or an amount marked
 * as rounded down that is not a whole multiple of SOLVED_SPENDING_STEP_DOLLARS.
 */
export function spendingShapeRows(solved: readonly SolvedSpendingShape[]): SpendingShapeRow[] {
  const seen = new Set<SpendingShapeId>()
  for (const row of solved) {
    if (seen.has(row.shape)) throw new RangeError(`The spending-shape comparison lists ${row.shape} twice.`)
    seen.add(row.shape)
    const amount = row.maxBaseAnnual
    if (amount === null) {
      if (row.maxBaseAnnualRounding !== null) {
        throw new RangeError(`The ${row.shape} row has a rounding but no amount; pass the solver's published answer.`)
      }
      continue
    }
    if (!Number.isFinite(amount) || amount < 0) {
      throw new RangeError(`The ${row.shape} row's amount must be a finite number of dollars at or above 0; got ${amount}.`)
    }
    if (row.maxBaseAnnualRounding === null) {
      throw new RangeError(`The ${row.shape} row has an amount but no rounding; pass the solver's published answer.`)
    }
    if (row.maxBaseAnnualRounding === 'down-to-hundred' && amount % SOLVED_SPENDING_STEP_DOLLARS !== 0) {
      throw new RangeError(
        `The ${row.shape} row's amount ${amount} is marked as rounded down to $${SOLVED_SPENDING_STEP_DOLLARS} but is not a whole multiple of it; pass the solver's published answer, not the passing probe.`,
      )
    }
  }
  if (!seen.has('flat')) throw new RangeError('The spending-shape comparison needs a flat (constant-real) row.')
  const flat = solved.find((row) => row.shape === 'flat')!.maxBaseAnnual
  return solved.map((row) => ({
    shape: row.shape,
    maxBaseAnnual: row.maxBaseAnnual,
    deltaVsFlatDollars:
      row.shape === 'flat' || row.maxBaseAnnual === null || flat === null ? null : row.maxBaseAnnual - flat,
  }))
}
