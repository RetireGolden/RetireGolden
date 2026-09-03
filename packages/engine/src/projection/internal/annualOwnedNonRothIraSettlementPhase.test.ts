/**
 * Boundary and characterization coverage for the owned non-Roth IRA settlement
 * coordinator.
 *
 * **These are characterization / boundary tests, not oracle tests**
 * ([DOCS/testing.md](../../../../../DOCS/testing.md) taxonomy). Nothing here
 * derives a dollar figure from statute, an IRS worksheet, or `DOCS/domain`, and
 * nothing here may be read as proof that any amount the engine produces is
 * correct. Every assertion is either structural (a call count, an identity, an
 * empty container, an absent publication) or a conservation statement that
 * holds by construction whatever the arithmetic turns out to be.
 *
 * **How the inputs are built.** This phase takes a `facts` / `state` / `ledger`
 * / `callbacks` bundle whose `state` is the live annual-pass binding record and
 * whose callbacks close over `simulatePlan`'s own locals — none of which can be
 * hand-built honestly. So the tests capture a **real** input object at the seam
 * during an actual `simulatePlan` run, using the same `vi.mock` interception
 * the `simulate.*Delegation.test.ts` files use, and then either assert on that
 * captured input and its real result, or re-invoke the exported phase directly
 * with a minimally perturbed copy (mutable ledger containers cloned, and the
 * one annual-pass callback replaced by a recording stub). Where a boundary is
 * reachable by choosing the plan rather than by perturbing a captured object,
 * the plan is chosen — a dead year, a zero-balance account, and a household
 * with no nondeductible IRA basis all come from genuine runs.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Account, Plan } from '../../model/plan.js'
import type {
  AnnualOwnedNonRothIraSettlementPhaseInput,
  AnnualOwnedNonRothIraSettlementPhaseResult,
  AnnualPostContributionPassRunner,
} from './annualOwnedNonRothIraSettlementPhase.js'

interface SettlementCall {
  readonly input: AnnualOwnedNonRothIraSettlementPhaseInput
  readonly result: AnnualOwnedNonRothIraSettlementPhaseResult
}

const seam = vi.hoisted(() => ({ calls: [] as SettlementCall[] }))

vi.mock('./annualOwnedNonRothIraSettlementPhase.js', async (importOriginal) => {
  const original = await importOriginal<
    typeof import('./annualOwnedNonRothIraSettlementPhase.js')
  >()
  return {
    ...original,
    annualOwnedNonRothIraSettlementPhase: (
      input: AnnualOwnedNonRothIraSettlementPhaseInput,
    ): AnnualOwnedNonRothIraSettlementPhaseResult => {
      const result = original.annualOwnedNonRothIraSettlementPhase(input)
      seam.calls.push({ input, result })
      return result
    },
  }
})

import { annualOwnedNonRothIraSettlementPhase } from './annualOwnedNonRothIraSettlementPhase.js'
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

function run(plan: Plan, horizonEndYear: number): void {
  simulatePlan(validatePlan(plan), {
    startYear: START_YEAR,
    horizonEndYear,
    taxCalculator: createFlatTaxCalculator(0),
  })
}

/**
 * A copy of a captured input whose mutable ledger containers are fresh, whose
 * single scalar latch records writes instead of reaching back into the
 * finished run, and whose annual pass is a recording stub. Everything else —
 * `facts`, `state`, and the remaining callbacks — is the object the live run
 * handed the phase.
 */
function reinvocable(
  captured: SettlementCall,
  overrides: {
    readonly facts?: Partial<AnnualOwnedNonRothIraSettlementPhaseInput['facts']>
    readonly settlementEnabled?: boolean
  } = {},
): {
  readonly input: AnnualOwnedNonRothIraSettlementPhaseInput
  readonly passArgs: Parameters<AnnualPostContributionPassRunner>[]
  readonly householdLatchWrites: boolean[]
  readonly passResult: ReturnType<AnnualPostContributionPassRunner>
} {
  const passArgs: Parameters<AnnualPostContributionPassRunner>[] = []
  const householdLatchWrites: boolean[] = []
  // The stub's payload is never asserted on; it exists so the coordinator has
  // an object to hand back, and so identity (`toBe`) is checkable.
  const passResult: ReturnType<AnnualPostContributionPassRunner> = {
    yearResult: { ...captured.result.yearResult },
    optimizerProbe: null,
  }
  const input: AnnualOwnedNonRothIraSettlementPhaseInput = {
    facts: { ...captured.input.facts, ...overrides.facts },
    state: captured.input.state,
    ledger: {
      iraBasisByOwner: new Map(captured.input.ledger.iraBasisByOwner),
      ownedNonRothIraSettlementRolledBackOwners: new Set(
        captured.input.ledger.ownedNonRothIraSettlementRolledBackOwners,
      ),
      scalars: {
        ownedNonRothIraSettlementRolledBackHousehold: {
          read: () => false,
          write: (value: boolean) => { householdLatchWrites.push(value) },
        },
      },
    },
    callbacks: {
      ...captured.input.callbacks,
      ownedNonRothIraSettlementEnabled: () =>
        overrides.settlementEnabled
        ?? captured.input.callbacks.ownedNonRothIraSettlementEnabled(),
      runPostContributionAnnualPass: (...args) => {
        passArgs.push(args)
        return passResult
      },
    },
  }
  return { input, passArgs, householdLatchWrites, passResult }
}

function basicPlan(accounts: Account[], planningAge = 61): Plan {
  const plan = singlePersonPlan({ dob: '1966-01-01', planningAge })
  plan.expenses.baseAnnual = 0
  plan.accounts = accounts
  return plan
}

beforeEach(() => {
  seam.calls.length = 0
})

describe('annualOwnedNonRothIraSettlementPhase boundaries', () => {
  it('leaves settlement disabled and publishes no replay for a household with no nondeductible basis', () => {
    run(basicPlan([cashAccount('cash', 0), traditionalAccount('trad', 0)]), START_YEAR)

    expect(seam.calls).toHaveLength(1)
    const { input, result } = seam.calls[0]!
    // Empty candidate set: `ownedNonRothIraSettlementEnabled` is exactly
    // "some owner still has a settleable basis pool", so an all-zero-basis
    // household has nothing to settle.
    expect(input.ledger.iraBasisByOwner.size).toBe(0)
    expect(input.callbacks.ownedNonRothIraSettlementEnabled()).toBe(false)
    expect(input.ledger.ownedNonRothIraSettlementRolledBackOwners.size).toBe(0)
    // With nothing settled there is no joined household replay to publish.
    expect(result.yearResult.ownedNonRothIraAnnualReplay).toBeUndefined()
  })

  it('zero-balance accounts still reach the phase and still settle nothing', () => {
    run(basicPlan([cashAccount('cash', 0), traditionalAccount('trad', 0)]), START_YEAR)

    const { input, result } = seam.calls[0]!
    expect(input.facts.balances.every((state) => state.balance === 0)).toBe(true)
    expect(input.facts.startOfYearPositionalBalances.every((balance) => balance === 0))
      .toBe(true)
    expect(result.yearResult.ownedNonRothIraAnnualReplay).toBeUndefined()
    expect(result.yearResult.withdrawals.total).toBe(0)
  })

  it('a household with no accounts at all reaches the phase with an empty balance set', () => {
    run(basicPlan([]), START_YEAR)

    const { input, result } = seam.calls[0]!
    expect(input.facts.balances).toHaveLength(0)
    expect(input.facts.startOfYearPositionalBalances).toHaveLength(0)
    expect(input.facts.annualLinkedGroupOmissionIds).toHaveLength(0)
    expect(result.yearResult.ownedNonRothIraAnnualReplay).toBeUndefined()
  })

  it('runs in a year after every person has died, with no anyAlive fact of its own', () => {
    // The single person's last full year alive is 2026 (planning age 60);
    // 2027 and 2028 are genuine `anyAlive === false` years of a real run.
    run(basicPlan([cashAccount('cash', 1_000), traditionalAccount('trad', 1_000)], 60), 2028)

    expect(seam.calls.map((call) => call.input.facts.year)).toEqual([2026, 2027, 2028])
    // This coordinator is deliberately not survival-aware: `anyAlive` is a fact
    // of the aggregate-conversion and funding phases, and never reaches here.
    // Recording that keeps a future reader from assuming a guard exists.
    expect('anyAlive' in seam.calls[0]!.input.facts).toBe(false)
    for (const call of seam.calls.slice(1)) {
      expect(call.result.yearResult.ownedNonRothIraAnnualReplay).toBeUndefined()
      expect(call.result.yearResult.withdrawals.total).toBe(0)
    }
  })

  it('sees a one-person household as one person and a couple as two', () => {
    run(basicPlan([cashAccount('cash', 1_000)]), START_YEAR)
    const single = seam.calls[0]!
    expect(single.input.facts.personById.size).toBe(1)
    expect(single.input.facts.primary.id).toBe('p1')

    seam.calls.length = 0
    const couple = couplePlan({ p1PlanningAge: 61, p2PlanningAge: 61 })
    couple.expenses.baseAnnual = 0
    couple.accounts = [cashAccount('cash', 1_000)]
    run(couple, START_YEAR)
    expect(seam.calls[0]!.input.facts.personById.size).toBe(2)
    expect(seam.calls[0]!.input.facts.primary.id).toBe('p1')
  })
})

describe('annualOwnedNonRothIraSettlementPhase re-invoked directly', () => {
  it('runs exactly one refused annual pass and returns its result by identity when settlement is off', () => {
    run(basicPlan([cashAccount('cash', 0), traditionalAccount('trad', 0)]), START_YEAR)
    const harness = reinvocable(seam.calls[0]!, { settlementEnabled: false })

    const result = annualOwnedNonRothIraSettlementPhase(harness.input)

    // The disabled path is one pass, with the empty assumption vector, no
    // omitted actions, no liability baseline, and the shared fail-closed
    // refusal — `annualConversionLinkedWithdrawalFunding` short-circuits to
    // `refuseAll` whenever there are no omitted linked-group action ids.
    expect(harness.passArgs).toHaveLength(1)
    const [assumedEffects, omitted, baseline, release, publishCashFlow] =
      harness.passArgs[0]!
    expect(assumedEffects).toEqual([])
    expect(omitted).toBeUndefined()
    expect(baseline).toBeNull()
    expect(release).toEqual({ kind: 'refuseAll' })
    expect(publishCashFlow).toBe(harness.input.facts.captureAnnualCashFlow)
    // The phase publishes the pass's own object, not a rebuild of it.
    expect(result).toBe(harness.passResult)
    // Nothing was settled, so no rollback latch is written and no owner's
    // carryforward basis is re-seeded.
    expect(harness.householdLatchWrites).toEqual([])
    expect(harness.input.ledger.iraBasisByOwner.size).toBe(0)
    expect(harness.input.ledger.ownedNonRothIraSettlementRolledBackOwners.size).toBe(0)
  })

  it('is unchanged by emptying the balance set on the disabled path', () => {
    run(basicPlan([cashAccount('cash', 0), traditionalAccount('trad', 0)]), START_YEAR)
    const captured = seam.calls[0]!

    const asCaptured = reinvocable(captured, { settlementEnabled: false })
    annualOwnedNonRothIraSettlementPhase(asCaptured.input)

    const emptied = reinvocable(captured, {
      settlementEnabled: false,
      facts: { balances: [], startOfYearPositionalBalances: [] },
    })
    annualOwnedNonRothIraSettlementPhase(emptied.input)

    // The opening-balance seeding this phase does before an attempt is only
    // read by the settlement driver, so removing every balance cannot change
    // the disabled path's single refused pass.
    expect(emptied.passArgs).toHaveLength(1)
    expect(emptied.passArgs[0]).toEqual(asCaptured.passArgs[0])
    expect(emptied.householdLatchWrites).toEqual([])
  })

  it('takes the same disabled path in a year when nobody is alive', () => {
    run(basicPlan([cashAccount('cash', 1_000), traditionalAccount('trad', 1_000)], 60), 2028)
    const deadYear = seam.calls.find((call) => call.input.facts.year === 2028)!
    const harness = reinvocable(deadYear, { settlementEnabled: false })

    const result = annualOwnedNonRothIraSettlementPhase(harness.input)

    expect(harness.passArgs).toHaveLength(1)
    expect(harness.passArgs[0]![0]).toEqual([])
    expect(result).toBe(harness.passResult)
    expect(harness.householdLatchWrites).toEqual([])
  })
})
