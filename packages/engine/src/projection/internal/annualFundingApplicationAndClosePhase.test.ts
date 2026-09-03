/**
 * Boundary and characterization coverage for the funding, application and
 * close phase.
 *
 * **These are characterization / boundary tests, not oracle tests**
 * ([DOCS/testing.md](../../../../../DOCS/testing.md) taxonomy). No expected
 * value here comes from statute, an IRS worksheet, or `DOCS/domain`, and
 * nothing here may be read as proof that a dollar figure the engine produces is
 * correct. The tax, ACA, IRMAA, HECM and withdrawal-character producers this
 * phase composes carry their own oracle tests beside their own modules; what is
 * asserted here is structure — zero on a path with nothing to fund from, the
 * documented terminal shape of a year in which nobody is alive, and the
 * shortfall conservation that must hold whatever the arithmetic is.
 *
 * **How the inputs are built.** The phase takes a ~70-field `facts` bundle, the
 * two preceding phases' whole results as `prior`, a ~24-container live
 * `ledger` (including ten bound money scalars that write straight through to
 * `simulatePlan`'s own locals), and callbacks closed over those locals. Hand
 * building that would be inventing an annual context rather than observing one,
 * so these tests capture a **real** input at the seam during an actual
 * `simulatePlan` run — the same `vi.mock` interception the
 * `simulate.*Delegation.test.ts` files use — and assert on that input and its
 * real result. Boundaries come from the plan (no accounts, zero balances, a
 * dead year, one person versus two); two tests re-invoke the exported function
 * directly against cloned ledger containers and detached scalar cells, to show
 * it is callable standalone and repeats the same structural verdict.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Plan } from '../../model/plan.js'
import type {
  AnnualFundingApplicationAndClosePhaseInput,
  AnnualFundingApplicationAndClosePhaseResult,
  AnnualFundingApplicationAndClosePhaseScalars,
} from './annualFundingApplicationAndClosePhase.js'
import type { PhaseLedgerScalarBindings } from './phaseLedgerScalars.js'
import type { YearResult } from '../types.js'

interface FundingCall {
  readonly input: AnnualFundingApplicationAndClosePhaseInput
  readonly result: AnnualFundingApplicationAndClosePhaseResult
}

const seam = vi.hoisted(() => ({ calls: [] as FundingCall[] }))

vi.mock('./annualFundingApplicationAndClosePhase.js', async (importOriginal) => {
  const original = await importOriginal<
    typeof import('./annualFundingApplicationAndClosePhase.js')
  >()
  return {
    ...original,
    annualFundingApplicationAndClosePhase: (
      input: AnnualFundingApplicationAndClosePhaseInput,
    ): AnnualFundingApplicationAndClosePhaseResult => {
      const result = original.annualFundingApplicationAndClosePhase(input)
      seam.calls.push({ input, result })
      return result
    },
  }
})

import { annualFundingApplicationAndClosePhase } from './annualFundingApplicationAndClosePhase.js'
import { readPhaseLedgerScalars } from './phaseLedgerScalars.js'
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

function expectNoWithdrawals(yearResult: YearResult): void {
  expect(yearResult.withdrawals.cash).toBe(0)
  expect(yearResult.withdrawals.taxable).toBe(0)
  expect(yearResult.withdrawals.traditional).toBe(0)
  expect(yearResult.withdrawals.roth).toBe(0)
  expect(yearResult.withdrawals.hsa).toBe(0)
  expect(yearResult.withdrawals.total).toBe(0)
}

/**
 * A copy whose mutable ledger containers are fresh and whose ten bound money
 * scalars are detached cells seeded from the captured bindings, so a
 * re-invocation reads the same opening values but cannot write back into the
 * finished run's locals.
 */
function withDetachedLedger(
  captured: AnnualFundingApplicationAndClosePhaseInput,
): {
  readonly input: AnnualFundingApplicationAndClosePhaseInput
  readonly readScalars: () => AnnualFundingApplicationAndClosePhaseScalars
} {
  const cells = readPhaseLedgerScalars(captured.ledger.scalars)
  const keys = Object.keys(captured.ledger.scalars) as
    (keyof AnnualFundingApplicationAndClosePhaseScalars)[]
  const scalars = Object.fromEntries(keys.map((key) => [key, {
    read: () => cells[key],
    write: (value: AnnualFundingApplicationAndClosePhaseScalars[typeof key]) => {
      // Assigning through the record keeps the union of value types honest
      // without an `any`: each key's cell only ever receives its own type.
      Object.assign(cells, { [key]: value })
    },
  }])) as unknown as
    PhaseLedgerScalarBindings<AnnualFundingApplicationAndClosePhaseScalars>

  return {
    input: {
      ...captured,
      ledger: {
        ...captured.ledger,
        balances: captured.ledger.balances.map((state) => ({ ...state })),
        annualIdKeyedBalances: captured.ledger.annualIdKeyedBalances
          .map((state) => ({ ...state })),
        iraProRata: new Map(captured.ledger.iraProRata),
        iraBasisByOwner: new Map(captured.ledger.iraBasisByOwner),
        rothBasis: new Map(captured.ledger.rothBasis),
        rothAssumedContributionRemaining:
          new Map(captured.ledger.rothAssumedContributionRemaining),
        rothCounterfactualFreeCoverConsumed:
          new Map(captured.ledger.rothCounterfactualFreeCoverConsumed),
        ownedRothAssumedBasisConsequentialByOwner:
          new Map(captured.ledger.ownedRothAssumedBasisConsequentialByOwner),
        employerRothAssumedBasisConsequentialByAccount:
          new Map(captured.ledger.employerRothAssumedBasisConsequentialByAccount),
        form8606ConsequentialByOwner:
          new Map(captured.ledger.form8606ConsequentialByOwner),
        warnings: new Set(captured.ledger.warnings),
        hecmStates: new Map(captured.ledger.hecmStates),
        propertyValues: new Map(captured.ledger.propertyValues),
        debtBalances: new Map(captured.ledger.debtBalances),
        insuranceCashValues: new Map(captured.ledger.insuranceCashValues),
        magiHistory: new Map(captured.ledger.magiHistory),
        inheritedYearEvidenceDraft: [...captured.ledger.inheritedYearEvidenceDraft],
        annualRetirementRuntimeOccurrences:
          [...captured.ledger.annualRetirementRuntimeOccurrences],
        annualRetirementRuntimeApplications:
          [...captured.ledger.annualRetirementRuntimeApplications],
        annuityContractValue: new Map(captured.ledger.annuityContractValue),
        expenses: { ...captured.ledger.expenses },
        scalars,
      },
      capture: null,
    },
    readScalars: () => ({ ...cells }),
  }
}

beforeEach(() => {
  seam.calls.length = 0
})

describe('annualFundingApplicationAndClosePhase boundaries', () => {
  it('publishes an idle year with balances carried forward when nobody is alive', () => {
    // Planning age 60 makes 2026 the last full year alive, so 2027 and 2028
    // are genuine `anyAlive === false` years of a real run.
    const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 60 })
    plan.expenses.baseAnnual = 12_000
    plan.accounts = [cashAccount('cash', 50_000), traditionalAccount('trad', 100_000)]
    run(plan, 2028)

    const dead = seam.calls.filter((call) => !call.input.facts.anyAlive)
    expect(dead.map((call) => call.input.facts.year)).toEqual([2027, 2028])
    for (const { input, result } of dead) {
      const { yearResult } = result
      expect(input.facts.aliveCount).toBe(0)
      // The documented terminal shape: no spending is planned for a household
      // that no longer exists, so nothing is funded and nothing is withdrawn.
      expect(yearResult.expenses.total).toBe(0)
      expect(yearResult.expenses.requiredSpending).toBe(0)
      expect(yearResult.expenses.targetSpending).toBe(0)
      expect(yearResult.expenses.healthcare).toBe(0)
      expect(yearResult.expenses.intendedSpending).toBe(0)
      expectNoWithdrawals(yearResult)
      expect(yearResult.contributions).toBe(0)
      expect(yearResult.incomes.total).toBe(0)
      expect(yearResult.tax).toBe(0)
      expect(yearResult.shortfall).toBe(0)
      // Balances are carried, not swept: an unspent portfolio survives the
      // household into the estate rows.
      for (const [accountId, balance] of Object.entries(yearResult.balances)) {
        expect(balance).toBe(input.facts.startOfYearBalance.get(accountId))
      }
    }
  })

  it('funds nothing from zero-balance accounts and books the whole need as shortfall', () => {
    const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 70 })
    plan.expenses.baseAnnual = 5_000
    plan.accounts = [cashAccount('cash', 0), traditionalAccount('trad', 0)]
    run(plan)

    const { input, result } = seam.calls[0]!
    const { yearResult } = result
    expect(input.ledger.balances.every((state) => state.balance === 0)).toBe(true)
    // A zero-balance account produces no withdrawal, in any channel.
    expectNoWithdrawals(yearResult)
    // Conservation, not an oracle: with no inflow and no portfolio, every
    // dollar of intended spending has to land in the shortfall.
    expect(yearResult.incomes.total).toBe(0)
    expect(yearResult.shortfall).toBe(yearResult.expenses.total)
    expect(yearResult.expenses.total).toBeGreaterThan(0)
    expect(Object.values(yearResult.balances).every((balance) => balance === 0)).toBe(true)
    // The depletion latch is a bound scalar this phase owns; an all-zero
    // portfolio latches the current year.
    expect(input.ledger.scalars.depletionYear.read()).toBe(START_YEAR)
  })

  it('publishes an empty balance map when the household holds no accounts', () => {
    const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 70 })
    plan.expenses.baseAnnual = 0
    plan.accounts = []
    run(plan)

    const { input, result } = seam.calls[0]!
    expect(input.ledger.balances).toHaveLength(0)
    expect(result.yearResult.balances).toEqual({})
    expectNoWithdrawals(result.yearResult)
    expect(result.yearResult.shortfall).toBe(0)
  })

  it('sees a one-person household as single and a couple collapsing to single', () => {
    const single = singlePersonPlan({ dob: '1966-01-01', planningAge: 70 })
    single.expenses.baseAnnual = 0
    single.accounts = [cashAccount('cash', 1_000)]
    run(single)
    expect(seam.calls[0]!.input.facts.peopleStates).toHaveLength(1)
    expect(seam.calls[0]!.input.facts.aliveCount).toBe(1)
    expect(seam.calls[0]!.input.facts.anyAlive).toBe(true)
    expect(seam.calls[0]!.input.facts.filingStatusForYear).toBe('single')

    seam.calls.length = 0
    const couple = couplePlan({ p1PlanningAge: 60, p2PlanningAge: 62 })
    couple.expenses.baseAnnual = 0
    couple.accounts = [cashAccount('cash', 1_000)]
    run(couple, 2028)
    // Two people, then the survivor year, then still the survivor.
    expect(seam.calls.map((call) => call.input.facts.aliveCount)).toEqual([2, 1, 1])
    expect(seam.calls.map((call) => call.input.facts.filingStatusForYear))
      .toEqual(['marriedFilingJointly', 'single', 'single'])
    for (const call of seam.calls) {
      expect(call.input.facts.peopleStates).toHaveLength(2)
      expect(call.input.facts.anyAlive).toBe(true)
    }
  })

  it('binds the ten money scalars through, rather than handing over copies', () => {
    const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 70 })
    plan.expenses.baseAnnual = 1_000
    plan.accounts = [cashAccount('cash', 10_000)]
    run(plan)

    const { scalars } = seam.calls[0]!.input.ledger
    const keys = Object.keys(scalars)
    expect(keys).toHaveLength(10)
    for (const key of keys as (keyof typeof scalars)[]) {
      expect(typeof scalars[key].read).toBe('function')
      expect(typeof scalars[key].write).toBe('function')
    }
  })
})

describe('annualFundingApplicationAndClosePhase re-invoked directly', () => {
  it('repeats the idle terminal shape for a dead year against a detached ledger', () => {
    const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 60 })
    plan.expenses.baseAnnual = 12_000
    plan.accounts = [cashAccount('cash', 50_000), traditionalAccount('trad', 100_000)]
    run(plan, 2027)

    const captured = seam.calls.find((call) => !call.input.facts.anyAlive)!
    const harness = withDetachedLedger(captured.input)
    const openingBalances = harness.input.ledger.balances.map((state) => state.balance)

    const { yearResult, optimizerProbe } = annualFundingApplicationAndClosePhase(
      harness.input,
    )

    expect(yearResult.year).toBe(captured.input.facts.year)
    expect(yearResult.expenses.total).toBe(0)
    expectNoWithdrawals(yearResult)
    expect(yearResult.tax).toBe(0)
    expect(yearResult.shortfall).toBe(0)
    // Nothing was funded, so no balance moved and no depletion was latched.
    expect(harness.input.ledger.balances.map((state) => state.balance))
      .toEqual(openingBalances)
    expect(harness.readScalars().depletionYear).toBeNull()
    // The probe channel is unconditional; `captureOptimizerInputs` gating lives
    // in `simulatePlan`, not here.
    expect(optimizerProbe === null || typeof optimizerProbe === 'object').toBe(true)
  })

  it('repeats the zero-withdrawal, full-shortfall verdict for a zero-balance household', () => {
    const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 70 })
    plan.expenses.baseAnnual = 5_000
    plan.accounts = [cashAccount('cash', 0), traditionalAccount('trad', 0)]
    run(plan)

    const harness = withDetachedLedger(seam.calls[0]!.input)
    const { yearResult } = annualFundingApplicationAndClosePhase(harness.input)

    expectNoWithdrawals(yearResult)
    expect(yearResult.shortfall).toBe(yearResult.expenses.total)
    expect(yearResult.expenses.total).toBeGreaterThan(0)
    expect(harness.input.ledger.balances.every((state) => state.balance === 0)).toBe(true)
  })
})
