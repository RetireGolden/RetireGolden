/**
 * Boundary and characterization coverage for the aggregate Roth-conversion phase.
 *
 * **These are characterization / boundary tests, not oracle tests**
 * ([DOCS/testing.md](../../../../../DOCS/testing.md) taxonomy). No expected
 * value here is derived from statute, an IRS worksheet, or `DOCS/domain`, and
 * nothing here may be read as proof that a dollar figure the engine produces is
 * correct. Every assertion is structural — a count, an empty container, a zero
 * on a path where the phase has nothing to act on, or an identity between two
 * things the phase itself relates.
 *
 * **How the inputs are built.** The phase takes a ~40-field `facts` bundle, the
 * previous phase's whole result as `prior`, live ledger containers, and
 * callbacks closed over `simulatePlan`'s locals. Building that by hand would be
 * inventing a plausible-looking annual context rather than a real one, so these
 * tests capture a **real** input at the seam during an actual `simulatePlan`
 * run — the same `vi.mock` interception the `simulate.*Delegation.test.ts`
 * files use — and assert on the input and the real result. Boundaries are
 * reached by choosing the plan (a dead year, zero balances, no accounts, no
 * Roth destination) rather than by fabricating facts; one test additionally
 * re-invokes the exported function directly with cloned ledger containers to
 * show the phase is callable standalone and repeats its structural verdict.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Account, Plan } from '../../model/plan.js'
import type {
  AnnualAggregateRothConversionPhaseInput,
  AnnualAggregateRothConversionPhaseResult,
} from './annualAggregateRothConversionPhase.js'

interface AggregateCall {
  readonly input: AnnualAggregateRothConversionPhaseInput
  readonly result: AnnualAggregateRothConversionPhaseResult
}

const seam = vi.hoisted(() => ({ calls: [] as AggregateCall[] }))

vi.mock('./annualAggregateRothConversionPhase.js', async (importOriginal) => {
  const original = await importOriginal<
    typeof import('./annualAggregateRothConversionPhase.js')
  >()
  return {
    ...original,
    annualAggregateRothConversionPhase: (
      input: AnnualAggregateRothConversionPhaseInput,
    ): AnnualAggregateRothConversionPhaseResult => {
      const result = original.annualAggregateRothConversionPhase(input)
      seam.calls.push({ input, result })
      return result
    },
  }
})

import { annualAggregateRothConversionPhase } from './annualAggregateRothConversionPhase.js'
import { createFlatTaxCalculator } from '../../testing/flatTax.js'
import {
  cashAccount,
  couplePlan,
  singlePersonPlan,
  traditionalAccount,
  validatePlan,
} from '../../testing/planFixtures.js'
import { simulatePlan } from '../simulate.js'

const START_YEAR = 2026

function run(plan: Plan, horizonEndYear = START_YEAR): void {
  simulatePlan(validatePlan(plan), {
    startYear: START_YEAR,
    horizonEndYear,
    taxCalculator: createFlatTaxCalculator(0),
  })
}

function rothAccount(id: string, ownerPersonId = 'p1'): Account {
  return {
    type: 'roth',
    kind: 'ira',
    id,
    name: id,
    ownerPersonId,
    annualReturnPct: 0,
    balance: 0,
    annualContribution: 0,
  }
}

function fillToTopOfBracket(plan: Plan): Plan {
  plan.strategies.rothConversion = {
    mode: 'fillToTarget',
    target: 'topOfBracket',
    targetValue: 22,
    startYear: START_YEAR,
    endYear: START_YEAR,
  }
  return plan
}

/** A copy whose mutable ledger containers are fresh, so a re-invocation cannot
 *  write into the finished run's state. */
function withClonedLedger(
  captured: AnnualAggregateRothConversionPhaseInput,
): AnnualAggregateRothConversionPhaseInput {
  return {
    ...captured,
    ledger: {
      balances: captured.ledger.balances.map((state) => ({ ...state })),
      annualIdKeyedBalances: captured.ledger.annualIdKeyedBalances
        .map((state) => ({ ...state })),
      iraProRata: new Map(captured.ledger.iraProRata),
      rothBasis: new Map(captured.ledger.rothBasis),
      warnings: new Set(captured.ledger.warnings),
    },
    capture: null,
  }
}

beforeEach(() => {
  seam.calls.length = 0
})

describe('annualAggregateRothConversionPhase boundaries', () => {
  it('converts nothing and reports no ages in a year after every person has died', () => {
    // The single person's last full year alive is 2026 (planning age 60), so
    // 2027 and 2028 are genuine `anyAlive === false` years of a real run.
    const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 60 })
    plan.expenses.baseAnnual = 0
    plan.accounts = [
      cashAccount('cash', 10_000),
      traditionalAccount('trad', 100_000),
      rothAccount('roth'),
    ]
    run(fillToTopOfBracket(plan), 2028)

    const dead = seam.calls.filter((call) => !call.input.facts.anyAlive)
    expect(dead.map((call) => call.input.facts.year)).toEqual([2027, 2028])
    for (const { input, result } of dead) {
      expect(input.facts.aliveCount).toBe(0)
      // The documented terminal shape: nobody alive means no ages, nobody
      // aged 65+, no income to size a conversion against, and no conversion.
      expect(result.agesAlive).toEqual([])
      expect(result.peopleAged65Plus).toBe(0)
      expect(result.incomeBeforeConversion).toBe(0)
      expect(result.rothConversion).toBe(0)
      expect(result.conversionNontaxable).toBe(0)
      expect(result.totalRothConversion).toBe(0)
      expect(result.totalRothConversionTaxable).toBe(0)
      // `annualAggregateRothConversionTargetPlan` refuses outright when
      // `anyAlive` is false, so the policy never even names a desired amount.
      expect(result.aggregateRothConversionTarget.desiredPlanDollars).toBe(0)
      // `fillToTargetSelected` echoes the configured strategy mode, not the
      // outcome, so it stays true through the refusal. Locking that in keeps a
      // reader from treating it as "a conversion was sized".
      expect(result.aggregateRothConversionTarget.fillToTargetSelected).toBe(true)
      expect(result.aggregateRothConversionAllocationBalances).toBeUndefined()
      expect(result.aggregateRothConversionAllocationDesired).toBeUndefined()
    }
  })

  it('reports one age per living person, and one fewer after a survivor year begins', () => {
    const plan = couplePlan({ p1PlanningAge: 60, p2PlanningAge: 62 })
    plan.expenses.baseAnnual = 0
    plan.accounts = [cashAccount('cash', 1_000)]
    run(plan, 2028)

    // `agesAlive` is the phase's own restatement of the household's survival
    // for the year, so it must agree with the `aliveCount` fact it was given
    // — in every year, including the survivor year and the dead years.
    for (const { input, result } of seam.calls) {
      expect(result.agesAlive).toHaveLength(input.facts.aliveCount)
    }
    expect(seam.calls.map((call) => call.input.facts.aliveCount)).toEqual([2, 1, 1])

    seam.calls.length = 0
    const single = singlePersonPlan({ dob: '1966-01-01', planningAge: 61 })
    single.expenses.baseAnnual = 0
    single.accounts = [cashAccount('cash', 1_000)]
    run(single)
    expect(seam.calls[0]!.input.facts.aliveCount).toBe(1)
    expect(seam.calls[0]!.result.agesAlive).toHaveLength(1)
  })

  it('converts nothing when the strategy is "none", the empty candidate set', () => {
    const plan = singlePersonPlan({ dob: '1960-01-01', planningAge: 90 })
    plan.expenses.baseAnnual = 0
    plan.accounts = [
      cashAccount('cash', 50_000),
      traditionalAccount('trad', 400_000),
      rothAccount('roth'),
    ]
    // `singlePersonPlan` already defaults to `{ mode: 'none' }`; naming it here
    // is what the test is about.
    plan.strategies.rothConversion = { mode: 'none' }
    run(plan)

    const { result } = seam.calls[0]!
    expect(result.aggregateRothConversionTarget.desiredPlanDollars).toBe(0)
    expect(result.aggregateRothConversionTarget.fillToTargetSelected).toBe(false)
    expect(result.rothConversion).toBe(0)
    expect(result.totalRothConversion).toBe(0)
    expect(result.conversionNontaxable).toBe(0)
  })

  it('converts nothing when policy wants a conversion but no Roth destination exists', () => {
    const plan = singlePersonPlan({ dob: '1960-01-01', planningAge: 90 })
    plan.expenses.baseAnnual = 0
    plan.accounts = [cashAccount('cash', 50_000), traditionalAccount('trad', 400_000)]
    run(fillToTopOfBracket(plan))

    const { result } = seam.calls[0]!
    // The policy sizes a real target — asserting only that it is positive, not
    // what it is; the amount is not derived from any source here.
    expect(result.aggregateRothConversionTarget.desiredPlanDollars).toBeGreaterThan(0)
    expect(result.aggregateRothConversionTarget.fillToTargetSelected).toBe(true)
    // With nowhere to convert to, the executed total is zero. Nothing is
    // published as converted that no account received.
    expect(result.rothConversion).toBe(0)
    expect(result.totalRothConversion).toBe(0)
    expect(result.totalRothConversionTaxable).toBe(0)
    expect(result.conversionNontaxable).toBe(0)
  })

  it('converts nothing from zero-balance accounts even when policy wants a conversion', () => {
    const plan = singlePersonPlan({ dob: '1960-01-01', planningAge: 90 })
    plan.expenses.baseAnnual = 0
    plan.accounts = [
      cashAccount('cash', 0),
      traditionalAccount('trad', 0),
      rothAccount('roth'),
    ]
    run(fillToTopOfBracket(plan))

    const { input, result } = seam.calls[0]!
    expect(input.ledger.balances.every((state) => state.balance === 0)).toBe(true)
    expect(result.rothConversion).toBe(0)
    expect(result.totalRothConversion).toBe(0)
    expect(result.conversionNontaxable).toBe(0)
    expect(input.ledger.balances.every((state) => state.balance === 0)).toBe(true)
  })

  it('reaches the phase with an empty balance set when the household holds no accounts', () => {
    const plan = singlePersonPlan({ dob: '1960-01-01', planningAge: 90 })
    plan.expenses.baseAnnual = 0
    plan.accounts = []
    run(fillToTopOfBracket(plan))

    const { input, result } = seam.calls[0]!
    expect(input.ledger.balances).toHaveLength(0)
    expect(input.ledger.annualIdKeyedBalances).toHaveLength(0)
    expect(result.rothConversion).toBe(0)
    expect(result.totalRothConversion).toBe(0)
    // The allocation snapshot is published (the policy ran) but names no
    // source account, because there are none.
    expect(Object.keys(result.aggregateRothConversionAllocationBalances ?? {}))
      .toEqual([])
  })

  it('exposes convertibility and taxable-fraction channels that stay in range at every boundary', () => {
    const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 60 })
    plan.expenses.baseAnnual = 0
    plan.accounts = [cashAccount('cash', 1_000), traditionalAccount('trad', 1_000)]
    run(plan, 2027)

    for (const { result } of seam.calls) {
      // A cash account is never a Roth-conversion source, alive or not.
      expect(result.yearConvertibleToRoth(cashAccount('probe', 1_000))).toBe(false)
      const fraction = result.ownedIraConversionTaxableFraction('p1')
      expect(fraction).toBeGreaterThanOrEqual(0)
      expect(fraction).toBeLessThanOrEqual(1)
      // An owner the projection never seeded basis for has no nontaxable
      // share to claim, so the whole conversion would be taxable.
      expect(result.ownedIraConversionTaxableFraction('not-a-person')).toBe(1)
    }
  })
})

describe('annualAggregateRothConversionPhase re-invoked directly', () => {
  it('repeats its zero-conversion verdict for a dead year against a cloned ledger', () => {
    const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 60 })
    plan.expenses.baseAnnual = 0
    plan.accounts = [
      cashAccount('cash', 10_000),
      traditionalAccount('trad', 100_000),
      rothAccount('roth'),
    ]
    run(fillToTopOfBracket(plan), 2027)

    const captured = seam.calls.find((call) => !call.input.facts.anyAlive)!
    const input = withClonedLedger(captured.input)
    const openingBalances = input.ledger.balances.map((state) => state.balance)

    const result = annualAggregateRothConversionPhase(input)

    expect(result.agesAlive).toEqual([])
    expect(result.rothConversion).toBe(0)
    expect(result.totalRothConversion).toBe(0)
    expect(result.aggregateRothConversionTarget.desiredPlanDollars).toBe(0)
    // A phase that converts nothing moves no source balance and seeds no
    // Roth basis pool.
    expect(input.ledger.balances.map((state) => state.balance)).toEqual(openingBalances)
    expect([...input.ledger.rothBasis.keys()])
      .toEqual([...captured.input.ledger.rothBasis.keys()])
  })

  it('repeats its zero-conversion verdict for a zero-balance household', () => {
    const plan = singlePersonPlan({ dob: '1960-01-01', planningAge: 90 })
    plan.expenses.baseAnnual = 0
    plan.accounts = [
      cashAccount('cash', 0),
      traditionalAccount('trad', 0),
      rothAccount('roth'),
    ]
    run(fillToTopOfBracket(plan))

    const input = withClonedLedger(seam.calls[0]!.input)
    const result = annualAggregateRothConversionPhase(input)

    expect(result.rothConversion).toBe(0)
    expect(result.totalRothConversion).toBe(0)
    expect(result.conversionNontaxable).toBe(0)
    expect(input.ledger.balances.every((state) => state.balance === 0)).toBe(true)
  })
})
