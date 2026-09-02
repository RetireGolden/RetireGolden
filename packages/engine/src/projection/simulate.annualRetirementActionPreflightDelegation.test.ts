/**
 * Hostile delegation proof for annual retirement-action preflight.
 *
 * The wrapper drops the coordinator's ordinary execution route while leaving
 * the authored Plan unchanged. The named withdrawal must stop moving; a
 * simulator that merely called the helper and rebuilt routing inline would
 * keep the original result.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  AnnualRetirementActionPreflightInput,
  AnnualRetirementActionPreflightResult,
} from './internal/annualRetirementActionPreflight.js'

interface PreflightCall {
  readonly input: AnnualRetirementActionPreflightInput
  readonly original: AnnualRetirementActionPreflightResult
  readonly output: AnnualRetirementActionPreflightResult
}

const seam = vi.hoisted(() => ({
  dropOrdinaryExecution: false,
  calls: [] as PreflightCall[],
}))

vi.mock('./internal/annualRetirementActionPreflight.js', async (importOriginal) => {
  const original = await importOriginal<
    typeof import('./internal/annualRetirementActionPreflight.js')
  >()
  return {
    ...original,
    annualRetirementActionPreflight: (
      input: AnnualRetirementActionPreflightInput,
    ): AnnualRetirementActionPreflightResult => {
      const production = original.annualRetirementActionPreflight(input)
      const output = seam.dropOrdinaryExecution
        ? { ...production, ordinaryExecutionActions: [] }
        : production
      seam.calls.push({ input, original: production, output })
      return output
    },
  }
})

import type { Account, Plan } from '../model/plan.js'
import { parseRetirementActionRequest } from '../actions/index.js'
import { singlePersonPlan, validatePlan } from '../testing/planFixtures.js'
import { simulatePlan } from './simulate.js'

const YEAR = 2026
const ACTION_ID = 'delegated-ordinary-withdrawal'

function plan(): Plan {
  const target = singlePersonPlan({ planningAge: 60, dob: '1970-01-01' })
  target.id = 'retirement-action-preflight-delegation'
  target.expenses.baseAnnual = 0
  target.accounts = [{
    type: 'cash',
    id: 'cash',
    name: 'cash',
    ownerPersonId: 'p1',
    annualReturnPct: 0,
    balance: 1_000,
    annualContribution: 0,
  } satisfies Account]
  const parsed = parseRetirementActionRequest({
    actionId: ACTION_ID,
    kind: 'ordinaryWithdrawal',
    personId: 'p1',
    year: YEAR,
    executionDate: `${YEAR}-06-01`,
    executionSequence: 1,
    requestedAmount: 10_000,
    allocations: [{
      allocationId: `${ACTION_ID}-allocation`,
      sourceAccountId: 'cash',
      requestedAmount: 10_000,
    }],
    purpose: { kind: 'spending' },
    provenance: { source: 'manual' },
  })
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  target.strategies.retirementActions = [parsed.request]
  return validatePlan(target)
}

function run(dropOrdinaryExecution: boolean) {
  seam.dropOrdinaryExecution = dropOrdinaryExecution
  seam.calls.length = 0
  return simulatePlan(plan(), {
    startYear: YEAR,
    horizonEndYear: YEAR,
    taxCalculator: { compute: () => 0 },
  }).years[0]!
}

beforeEach(() => {
  seam.dropOrdinaryExecution = false
  seam.calls.length = 0
})

describe('simulatePlan annual retirement-action preflight delegation', () => {
  it('consumes the coordinator execution route as the action movement authority', () => {
    const production = run(false)
    expect(production.retirementActionExecution?.committed).toBe(true)
    expect(production.withdrawals.cash).toBe(100)
    expect(seam.calls.some((call) =>
      call.original.ordinaryExecutionActions.some(
        (request) => request.actionId === ACTION_ID,
      ))).toBe(true)

    const delegated = run(true)
    expect(seam.calls.length).toBeGreaterThan(0)
    expect(seam.calls.every(
      (call) => call.output.ordinaryExecutionActions.length === 0,
    )).toBe(true)
    expect(delegated.retirementActionExecution).toBeUndefined()
    expect(delegated.withdrawals.cash).toBe(0)
  })
})
