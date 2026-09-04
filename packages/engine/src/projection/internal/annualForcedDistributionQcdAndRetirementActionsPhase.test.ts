/**
 * Boundary and characterization coverage for the forced-distribution, QCD and
 * retirement-action phase.
 *
 * **These are characterization / boundary tests, not oracle tests**
 * ([DOCS/testing.md](../../../../../DOCS/testing.md) taxonomy). No expected
 * value here comes from statute, an IRS worksheet, or `DOCS/domain`, and
 * nothing here may be read as proof that a dollar figure the engine produces is
 * correct. The RMD divisors, QCD limits and shortfall excise this phase
 * composes have their own oracle tests beside their own producers
 * (`src/rmd/`, `src/tax/`); what is asserted here is only structure — counts,
 * empty containers, absent executions, and the zero a phase must publish when
 * it was handed nothing to act on.
 *
 * **How the inputs are built.** The phase takes a 17-field `facts` bundle, a
 * 16-field live `ledger`, and callbacks closed over `simulatePlan`'s locals
 * (`splitWithAssumedCharacter`, the runtime-journal recorders, the annual
 * liability baseline). Hand-building that would be inventing an annual context
 * rather than observing one, so these tests capture a **real** input at the
 * seam during an actual `simulatePlan` run — the same `vi.mock` interception
 * the `simulate.*Delegation.test.ts` files use — and assert on that input and
 * its real result. Boundaries come from the plan (no accounts, zero balances,
 * a dead year, one person versus two); one test re-invokes the exported
 * function directly against cloned ledger containers to show it is callable
 * standalone and repeats the same structural verdict.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Plan } from '../../model/plan.js'
import type {
  AnnualForcedDistributionQcdAndRetirementActionsPhaseInput,
  AnnualForcedDistributionQcdAndRetirementActionsPhaseResult,
} from './annualForcedDistributionQcdAndRetirementActionsPhase.js'

interface ForcedCall {
  readonly input: AnnualForcedDistributionQcdAndRetirementActionsPhaseInput
  readonly result: AnnualForcedDistributionQcdAndRetirementActionsPhaseResult
}

const seam = vi.hoisted(() => ({ calls: [] as ForcedCall[] }))

vi.mock('./annualForcedDistributionQcdAndRetirementActionsPhase.js', async (importOriginal) => {
  const original = await importOriginal<
    typeof import('./annualForcedDistributionQcdAndRetirementActionsPhase.js')
  >()
  return {
    ...original,
    annualForcedDistributionQcdAndRetirementActionsPhase: (
      input: AnnualForcedDistributionQcdAndRetirementActionsPhaseInput,
    ): AnnualForcedDistributionQcdAndRetirementActionsPhaseResult => {
      const result = original.annualForcedDistributionQcdAndRetirementActionsPhase(input)
      seam.calls.push({ input, result })
      return result
    },
  }
})

import { annualForcedDistributionQcdAndRetirementActionsPhase } from './annualForcedDistributionQcdAndRetirementActionsPhase.js'
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
/** Attains age 78 in 2026, so the owner is past every SECURE 2.0 RMD start cohort. */
const RMD_AGE_DOB = '1948-01-01'

function run(plan: Plan, horizonEndYear = START_YEAR): void {
  simulatePlan(validatePlan(plan), {
    startYear: START_YEAR,
    horizonEndYear,
    taxCalculator: createFlatTaxCalculator(0),
  })
}

/** Every forced-distribution channel is idle. */
function expectNothingForced(
  result: AnnualForcedDistributionQcdAndRetirementActionsPhaseResult,
): void {
  expect(result.rmdTotal).toBe(0)
  expect(result.rmdNontaxable).toBe(0)
  expect(result.ownedIraRmdTotal).toBe(0)
  expect(result.seppTotal).toBe(0)
  expect(result.seppNontaxable).toBe(0)
  expect(result.inheritedTotal).toBe(0)
  expect(result.inheritedOrdinaryIncome).toBe(0)
  expect(result.inheritedRothForced).toBe(0)
  expect(result.inheritedYearEvidenceDraft).toEqual([])
  expect(result.qcd).toBe(0)
  expect(result.qcdIncomeOffset).toBe(0)
  expect(result.qcdFromRmd).toBe(0)
  expect(result.namedQcdExecuted).toBe(0)
  expect(result.annuityPaymentNontaxable).toBe(0)
  expect(result.rmdShortfallObligations).toEqual([])
  expect(result.rmdShortfallExciseResults).toEqual([])
  expect(result.rmdShortfallExciseTax).toBe(0)
  expect([...result.iraRmdRequiredByOwner]).toEqual([])
  expect([...result.iraRmdUnsatisfiedByOwner]).toEqual([])
  expect([...result.rmdObligationByAccount]).toEqual([])
  expect([...result.rmdTakeByAccount]).toEqual([])
  expect([...result.ownedIraRmdGrossByOwner]).toEqual([])
  expect([...result.qcdGrossByOwner]).toEqual([])
}

/** No retirement action of any kind executed this year. */
function expectNoRetirementActions(
  result: AnnualForcedDistributionQcdAndRetirementActionsPhaseResult,
): void {
  expect(result.retirementActionExecution).toBeUndefined()
  expect(result.rothConversionActionExecution).toBeUndefined()
  expect(result.qcdActionExecution).toBeUndefined()
  expect(result.currentYearConversionActions).toEqual([])
  expect(result.mixedKindScheduleBlocked).toBe(false)
  expect(result.retirementActionCash).toBe(0)
  expect(result.retirementActionProceeds).toBe(0)
  expect(result.retirementActionTaxableProceeds).toBe(0)
  expect(result.retirementActionCapitalGainOrLoss).toBe(0)
  expect(result.retirementActionOrdinaryIncome).toBe(0)
  expect(result.retirementActionEquityCompensation).toBe(0)
  expect(result.namedRothConversionExecuted).toBe(0)
  expect(result.namedRothConversionNontaxable).toBe(0)
  expect(result.effectiveLinkedWithdrawalGroups.groups).toEqual([])
  expect(result.observedLinkedWithdrawalGroups.groups).toEqual([])
  expect(result.conversionLinkedWithdrawalGroups.groups).toEqual([])
  expect(result.linkedGroupAssessmentRequests).toEqual([])
  expect(result.deferredLegacyQcdDistributions).toEqual([])
  expect(result.legacyQcdCharacterizations).toEqual([])
}

/** A copy whose mutable ledger containers are fresh, so a re-invocation cannot
 *  write into the finished run's state. */
function withClonedLedger(
  captured: AnnualForcedDistributionQcdAndRetirementActionsPhaseInput,
): AnnualForcedDistributionQcdAndRetirementActionsPhaseInput {
  return {
    ...captured,
    ledger: {
      ...captured.ledger,
      balances: captured.ledger.balances.map((state) => ({ ...state })),
      annualIdKeyedBalances: captured.ledger.annualIdKeyedBalances
        .map((state) => ({ ...state })),
      ownersWithOmittedNondeductibleBasis:
        new Set(captured.ledger.ownersWithOmittedNondeductibleBasis),
      iraProRata: new Map(captured.ledger.iraProRata),
      deferredFirstRmdByApplicablePlan:
        new Map(captured.ledger.deferredFirstRmdByApplicablePlan),
      seppAmortAmount: new Map(captured.ledger.seppAmortAmount),
      namedQcdOffsetConsumedByDonor:
        new Map(captured.ledger.namedQcdOffsetConsumedByDonor),
      namedQcdOffsetHistoryUnprovable:
        new Set(captured.ledger.namedQcdOffsetHistoryUnprovable),
      rothBasis: new Map(captured.ledger.rothBasis),
      warnings: new Set(captured.ledger.warnings),
    },
    capture: null,
  }
}

beforeEach(() => {
  seam.calls.length = 0
})

describe('annualForcedDistributionQcdAndRetirementActionsPhase boundaries', () => {
  it('publishes nothing for a household with no accounts and no scheduled actions', () => {
    const plan = singlePersonPlan({ dob: RMD_AGE_DOB, planningAge: 90 })
    plan.expenses.baseAnnual = 0
    plan.accounts = []
    run(plan)

    expect(seam.calls).toHaveLength(1)
    const { input, result } = seam.calls[0]!
    expect(input.facts.passRetirementActions).toEqual([])
    expect(input.ledger.balances).toHaveLength(0)
    expect(result.rmdBalances).toHaveLength(0)
    expectNothingForced(result)
    expectNoRetirementActions(result)
  })

  it('takes no RMD from a zero-balance IRA whose owner is well past the RMD start age', () => {
    const plan = singlePersonPlan({ dob: RMD_AGE_DOB, planningAge: 90 })
    plan.expenses.baseAnnual = 0
    plan.accounts = [cashAccount('cash', 0), traditionalAccount('trad', 0)]
    run(plan)

    const { input, result } = seam.calls[0]!
    // The owner is age-eligible and the account is in the aggregation pool —
    // it is the zero balance alone that leaves the obligation empty.
    expect(input.facts.peopleStates[0]!.ageAttained).toBeGreaterThanOrEqual(75)
    expect(result.isAggregatedIraThisYear(input.facts.plan.accounts[1]!)).toBe(true)
    expect(result.rmdBalances).toHaveLength(2)
    expectNothingForced(result)
  })

  it('does take an RMD once that same account is funded — the discriminating contrast', () => {
    const plan = singlePersonPlan({ dob: RMD_AGE_DOB, planningAge: 90 })
    plan.expenses.baseAnnual = 0
    plan.accounts = [cashAccount('cash', 0), traditionalAccount('trad', 100_000)]
    run(plan)

    const { result } = seam.calls[0]!
    // Only the sign and the shape are asserted. The amount is the engine's own
    // output; `src/rmd/rmd.golden.test.ts` is where the divisor is proved.
    expect(result.rmdTotal).toBeGreaterThan(0)
    expect(result.ownedIraRmdTotal).toBe(result.rmdTotal)
    expect([...result.rmdObligationByAccount.keys()]).toEqual(['trad'])
    expect([...result.rmdTakeByAccount.keys()]).toEqual(['trad'])
    expect([...result.iraRmdRequiredByOwner.keys()]).toEqual(['p1'])
    expect([...result.iraRmdUnsatisfiedByOwner]).toEqual([])
    // The obligation is always recorded; what makes it excise-free is that it
    // was met. Asserting the two figures against each other, rather than
    // against a number, keeps this a conservation check and not an oracle.
    expect(result.rmdShortfallObligations).toHaveLength(1)
    const obligation = result.rmdShortfallObligations[0]!
    expect(obligation.distributedByDeadline).toBe(obligation.requiredAmount)
    expect(obligation.requiredAmount).toBe(result.rmdTotal)
    expect(result.rmdShortfallExciseResults.every((excise) =>
      excise.shortfall === 0 && excise.tax === 0)).toBe(true)
    expect(result.rmdShortfallExciseTax).toBe(0)
  })

  it('forces no distribution in a year after every person has died', () => {
    const plan = singlePersonPlan({ dob: RMD_AGE_DOB, planningAge: 78 })
    plan.expenses.baseAnnual = 0
    plan.accounts = [cashAccount('cash', 0), traditionalAccount('trad', 100_000)]
    run(plan, 2028)

    expect(seam.calls.map((call) => call.input.facts.year)).toEqual([2026, 2027, 2028])
    // This phase carries no `anyAlive` fact of its own — survival reaches it
    // only through `peopleStates`. Recording that keeps a future reader from
    // looking for a guard that is not there.
    expect('anyAlive' in seam.calls[0]!.input.facts).toBe(false)

    const dead = seam.calls.filter((call) =>
      call.input.facts.peopleStates.every((state) => !state.alive))
    expect(dead.map((call) => call.input.facts.year)).toEqual([2027, 2028])
    for (const { result } of dead) {
      // The account is still funded; it is the empty living-owner set that
      // leaves every forced channel idle.
      expect(result.rmdBalances.length).toBeGreaterThan(0)
      expectNothingForced(result)
      expectNoRetirementActions(result)
    }
  })

  it('sees a one-person household as one person and a couple as two', () => {
    const single = singlePersonPlan({ dob: RMD_AGE_DOB, planningAge: 90 })
    single.expenses.baseAnnual = 0
    single.accounts = [cashAccount('cash', 1_000)]
    run(single)
    expect(seam.calls[0]!.input.facts.people).toHaveLength(1)
    expect(seam.calls[0]!.input.facts.peopleStates).toHaveLength(1)
    expect(seam.calls[0]!.input.facts.personById.size).toBe(1)
    expect(seam.calls[0]!.input.facts.primary.id).toBe('p1')

    seam.calls.length = 0
    const couple = couplePlan({ p1PlanningAge: 90, p2PlanningAge: 90 })
    couple.expenses.baseAnnual = 0
    couple.accounts = [cashAccount('cash', 1_000)]
    run(couple)
    expect(seam.calls[0]!.input.facts.people).toHaveLength(2)
    expect(seam.calls[0]!.input.facts.peopleStates).toHaveLength(2)
    expect(seam.calls[0]!.input.facts.personById.size).toBe(2)
  })

  it('classifies only owned traditional IRAs into the year aggregation pool', () => {
    const plan = singlePersonPlan({ dob: RMD_AGE_DOB, planningAge: 90 })
    plan.expenses.baseAnnual = 0
    plan.accounts = [
      cashAccount('cash', 1_000),
      traditionalAccount('ira', 1_000),
      traditionalAccount('employer', 1_000, 'p1', 'employer'),
    ]
    run(plan)

    const { input, result } = seam.calls[0]!
    const byId = new Map(input.facts.plan.accounts.map((account) => [account.id, account]))
    expect(result.isAggregatedIraThisYear(byId.get('ira')!)).toBe(true)
    // An employer plan is not aggregated with the owner's IRAs, and cash is
    // not a retirement account at all.
    expect(result.isAggregatedIraThisYear(byId.get('employer')!)).toBe(false)
    expect(result.isAggregatedIraThisYear(byId.get('cash')!)).toBe(false)
  })
})

describe('annualForcedDistributionQcdAndRetirementActionsPhase re-invoked directly', () => {
  it('repeats its idle verdict for an account-free household against a cloned ledger', () => {
    const plan = singlePersonPlan({ dob: RMD_AGE_DOB, planningAge: 90 })
    plan.expenses.baseAnnual = 0
    plan.accounts = []
    run(plan)

    const input = withClonedLedger(seam.calls[0]!.input)
    const result = annualForcedDistributionQcdAndRetirementActionsPhase(input)

    expectNothingForced(result)
    expectNoRetirementActions(result)
    expect(result.rmdBalances).toHaveLength(0)
  })

  it('repeats its idle verdict for a zero-balance IRA and moves no balance', () => {
    const plan = singlePersonPlan({ dob: RMD_AGE_DOB, planningAge: 90 })
    plan.expenses.baseAnnual = 0
    plan.accounts = [cashAccount('cash', 0), traditionalAccount('trad', 0)]
    run(plan)

    const input = withClonedLedger(seam.calls[0]!.input)
    const result = annualForcedDistributionQcdAndRetirementActionsPhase(input)

    expectNothingForced(result)
    expect(input.ledger.balances.every((state) => state.balance === 0)).toBe(true)
    expect(input.ledger.warnings.size)
      .toBe(seam.calls[0]!.input.ledger.warnings.size)
  })

  it('repeats its idle verdict for a dead year that still holds a funded IRA', () => {
    const plan = singlePersonPlan({ dob: RMD_AGE_DOB, planningAge: 78 })
    plan.expenses.baseAnnual = 0
    plan.accounts = [cashAccount('cash', 0), traditionalAccount('trad', 100_000)]
    run(plan, 2027)

    const captured = seam.calls.find((call) =>
      call.input.facts.peopleStates.every((state) => !state.alive))!
    const input = withClonedLedger(captured.input)
    const openingBalances = input.ledger.balances.map((state) => state.balance)

    const result = annualForcedDistributionQcdAndRetirementActionsPhase(input)

    expectNothingForced(result)
    expect(input.ledger.balances.map((state) => state.balance)).toEqual(openingBalances)
  })
})
