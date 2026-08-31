/**
 * Delegation guard for the permanent-life annual transition extraction.
 *
 * Differential projection equivalence cannot distinguish a real extraction
 * from an orphaned helper left beside the old inline implementation. This
 * suite wraps the helper, tracks it against a stable phase marker across
 * re-entrant annual-pass evaluations, and injects independent sentinel values
 * to prove the caller consumes every part of the result.
 *
 * Unlike phases whose record object is published directly, the caller adapts a
 * transition into a richer cash-flow source line (destination and identities
 * are caller-owned). Object identity therefore cannot cross this seam and is
 * deliberately not claimed here. The injected values are the load-bearing
 * guard: an orphaned helper, a half-orphaned inline payout, or a caller that
 * ignores either returned field changes a named assertion below.
 */
import { describe, expect, it, vi } from 'vitest'

import type {
  AnnualPermanentLifeTransition,
  AnnualPermanentLifeTransitionsInput,
  AnnualPermanentLifeTransitionsResult,
} from './internal/annualPermanentLifeTransitions.js'

type PassEvent =
  | { readonly kind: 'propertyPhase'; readonly year: number }
  | {
      readonly kind: 'insurancePhase'
      readonly input: AnnualPermanentLifeTransitionsInput
      readonly output: AnnualPermanentLifeTransitionsResult
      readonly cashValuesAtCall: ReadonlyMap<string, number>
    }

interface SentinelResult {
  readonly transitions: readonly AnnualPermanentLifeTransition[]
  readonly deathBenefitPaid: number
}

const seam = vi.hoisted(() => ({
  events: [] as PassEvent[],
  sentinel: null as SentinelResult | null,
  snapshotCashValues: [] as ReadonlyMap<string, number>[],
}))

// `propertyEventsAndGrowth` gives this test a stable observable phase marker
// without assuming that one projected year is evaluated only once; owned-IRA
// settlement can and does re-enter the pass. The instrumentation below proves
// relative ordering and matching call counts, not literal source adjacency.
vi.mock('./internal/propertyEventsAndGrowth.js', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('./internal/propertyEventsAndGrowth.js')>()
  return {
    ...original,
    propertyEventsAndGrowth: (
      input: Parameters<typeof original.propertyEventsAndGrowth>[0],
    ) => {
      const rows = original.propertyEventsAndGrowth(input)
      seam.events.push({ kind: 'propertyPhase', year: input.year })
      return rows
    },
  }
})

vi.mock(
  './internal/annualPermanentLifeTransitions.js',
  async (importOriginal) => {
    const original =
      await importOriginal<
        typeof import('./internal/annualPermanentLifeTransitions.js')
      >()
    return {
      ...original,
      annualPermanentLifeTransitions: (
        input: Parameters<
          typeof original.annualPermanentLifeTransitions
        >[0],
      ) => {
        const configured = seam.sentinel
        const output = configured === null
          ? original.annualPermanentLifeTransitions(input)
          : {
              transitions: configured.transitions,
              deathBenefitPaid: configured.deathBenefitPaid,
            }
        seam.events.push({
          kind: 'insurancePhase',
          input,
          output,
          cashValuesAtCall: new Map(input.insuranceCashValues),
        })
        return output
      },
    }
  },
)

// Snapshotting is the next observable consumer of the insurance cash-value
// map. Capture a copy at that boundary so sentinel ids can differ from the
// plan's ids: this proves both ordered writes happened without relying on the
// plan fixture to make those injected ids visible in the published aggregate.
vi.mock('./internal/annualSnapshot.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('./internal/annualSnapshot.js')>()
  return {
    ...original,
    annualSnapshot: (input: Parameters<typeof original.annualSnapshot>[0]) => {
      seam.snapshotCashValues.push(new Map(input.insuranceCashValues))
      return original.annualSnapshot(input)
    },
  }
})

import type { Account, InsurancePolicy, Plan } from '../model/plan.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import {
  cashAccount,
  singlePersonPlan,
  traditionalAccount,
  validatePlan,
} from '../testing/planFixtures.js'
import { simulatePlan } from './simulate.js'

const YEAR = 2026
const POLICY_ID = 'whole-life'
const CASH_ACCOUNT_ID = 'cash-1'
const OPENING_CASH_VALUE = 8_000
const ORIGINAL_PAYOUT = 8_000

const noTax = createFlatTaxCalculator(0)

function permanentLife(): Extract<InsurancePolicy, { kind: 'permanentLife' }> {
  return {
    kind: 'permanentLife',
    id: POLICY_ID,
    name: 'Whole life',
    insured: 'p1',
    beneficiary: 'estate',
    annualPremium: 0,
    premiumMode: 'paidUp',
    deathBenefit: 5_000,
    cashValue: OPENING_CASH_VALUE,
    cashValueMode: 'flatRate',
    cashValueGrowthPct: 0,
  }
}

/**
 * One final-year settlement plus a basis-bearing IRA withdrawal. The latter
 * makes the owned-IRA settlement driver evaluate the annual pass more than
 * once, so the call-count guard exercises real transaction rollback rather
 * than encoding the false global rule "one helper call per projected year".
 */
function plan(
  insurance: readonly InsurancePolicy[] = [permanentLife()],
): Plan {
  const value = singlePersonPlan({ dob: '1966-01-01', planningAge: 60 })
  value.accounts = [
    cashAccount(CASH_ACCOUNT_ID, 0),
    {
      ...traditionalAccount('ira-1', 10_000),
      nondeductibleBasis: 4_000,
    } as Account,
  ]
  value.expenses.baseAnnual = 1_000
  value.insurance = [...insurance]
  return validatePlan(value)
}

function run(options: {
  readonly sentinel?: SentinelResult
  readonly capture?: boolean
  readonly insurance?: readonly InsurancePolicy[]
} = {}) {
  seam.events.length = 0
  seam.snapshotCashValues.length = 0
  seam.sentinel = options.sentinel ?? null
  const input = plan(options.insurance)
  const result = simulatePlan(input, {
    startYear: YEAR,
    horizonEndYear: YEAR,
    taxCalculator: noTax,
    ...(options.capture === true ? { captureAnnualCashFlow: true } : {}),
  })
  const propertyPhases = seam.events.filter(
    (event): event is Extract<PassEvent, { kind: 'propertyPhase' }> =>
      event.kind === 'propertyPhase',
  )
  const insurancePhases = seam.events.filter(
    (event): event is Extract<PassEvent, { kind: 'insurancePhase' }> =>
      event.kind === 'insurancePhase',
  )
  return { input, result, propertyPhases, insurancePhases }
}

describe('simulatePlan delegates permanent-life annual transitions', () => {
  it('matches property-phase calls across transactional re-entry', () => {
    const { input, result, propertyPhases, insurancePhases } = run()

    expect(result.years).toHaveLength(1)
    expect(insurancePhases.length).toBeGreaterThan(result.years.length)
    expect(insurancePhases).toHaveLength(propertyPhases.length)
    expect(propertyPhases.every((phase) => phase.year === YEAR)).toBe(true)

    // Among the two instrumented functions, calls alternate property then
    // insurance with a one-to-one count. Uninstrumented work may occur between
    // them, so this deliberately makes no claim of literal adjacency.
    expect(seam.events).toHaveLength(propertyPhases.length * 2)
    for (let index = 0; index < seam.events.length; index += 2) {
      expect(seam.events[index]).toEqual({ kind: 'propertyPhase', year: YEAR })
      expect(seam.events[index + 1]?.kind).toBe('insurancePhase')
    }

    for (const phase of insurancePhases) {
      expect(phase.input.policies).toBe(input.insurance)
      expect(phase.input.policies.map((policy) => policy.id)).toEqual([
        POLICY_ID,
      ])
      expect(phase.cashValuesAtCall.get(POLICY_ID)).toBe(OPENING_CASH_VALUE)
      expect(phase.output.deathBenefitPaid).toBe(ORIGINAL_PAYOUT)
    }
  })

  it('applies transition writes and payout deposits, and reports the returned fold', () => {
    const sentinel: SentinelResult = {
      transitions: [
        {
          policyId: 'sentinel-life-a',
          insuredPersonId: 'sentinel-person-a',
          cashValue: 975.31,
          payout: 24_681.25,
        },
        {
          policyId: 'sentinel-life-b',
          insuredPersonId: 'sentinel-person-b',
          cashValue: 864.2,
          payout: 3_579.75,
        },
      ],
      // Intentionally distinct from the payout sum: the caller must consume
      // the aggregate result channel rather than re-deriving it from rows.
      deathBenefitPaid: 13_579.5,
    }
    const { result, insurancePhases } = run({ sentinel, capture: true })
    const year = result.years[0]!

    expect(insurancePhases.length).toBeGreaterThan(1)
    expect(year.deathBenefit).toBe(sentinel.deathBenefitPaid)
    expect(year.balances[CASH_ACCOUNT_ID]).toBe(
      sentinel.transitions[0]!.payout! + sentinel.transitions[1]!.payout!,
    )

    // Every pass reaches the snapshot with both writes applied in transition
    // order; re-entered attempts are later rolled back by the simulator.
    expect(seam.snapshotCashValues).toHaveLength(insurancePhases.length)
    for (const cashValues of seam.snapshotCashValues) {
      expect([...cashValues.entries()].slice(-2)).toEqual([
        ['sentinel-life-a', sentinel.transitions[0]!.cashValue],
        ['sentinel-life-b', sentinel.transitions[1]!.cashValue],
      ])
    }

    const benefitLines = (year.cashFlow?.sourceLines ?? []).filter(
      (line) => line.kind === 'lifeInsuranceDeathBenefit',
    )
    expect(benefitLines).toHaveLength(2)
    expect(benefitLines.map((line) => line.amountPlanDollars)).toEqual([
      sentinel.transitions[0]!.payout,
      sentinel.transitions[1]!.payout,
    ])
    expect(benefitLines[0]!.identities).toEqual([
      { entityKind: 'insurancePolicy', policyId: 'sentinel-life-a' },
      { entityKind: 'person', personId: 'sentinel-person-a' },
    ])
    expect(benefitLines[1]!.identities).toEqual([
      { entityKind: 'insurancePolicy', policyId: 'sentinel-life-b' },
      { entityKind: 'person', personId: 'sentinel-person-b' },
    ])
    for (const line of benefitLines) {
      expect(line.role).toBe('postSolveDeposit')
      if (line.role !== 'postSolveDeposit') {
        throw new Error('expected a post-solve death-benefit deposit')
      }
      expect(line.postSolveDestination).toEqual({
        entityKind: 'account',
        accountId: CASH_ACCOUNT_ID,
      })
    }

    // Re-entered attempts are rolled back: the sentinel payout commits once,
    // not once for every helper invocation.
    expect(year.cashFlow?.reconciliation.status).toBe('reconciled')
  })

  it('preserves both policy rows from a multi-policy fixture', () => {
    const secondPolicy: InsurancePolicy = {
      ...permanentLife(),
      id: 'whole-life-2',
      name: 'Second whole life',
      deathBenefit: 6_000,
      cashValue: 1_500,
    }
    const { result, insurancePhases } = run({
      capture: true,
      insurance: [permanentLife(), secondPolicy],
    })
    const year = result.years[0]!
    const finalPhase = insurancePhases.at(-1)!

    expect(finalPhase.output.transitions.map((row) => row.policyId)).toEqual([
      POLICY_ID,
      secondPolicy.id,
    ])
    expect(finalPhase.output.transitions.map((row) => row.payout)).toEqual([
      ORIGINAL_PAYOUT,
      secondPolicy.deathBenefit,
    ])
    expect(finalPhase.output.deathBenefitPaid).toBe(
      ORIGINAL_PAYOUT + secondPolicy.deathBenefit,
    )
    expect(year.deathBenefit).toBe(finalPhase.output.deathBenefitPaid)
    expect(year.balances[CASH_ACCOUNT_ID]).toBe(
      ORIGINAL_PAYOUT + secondPolicy.deathBenefit,
    )

    const benefitLines = (year.cashFlow?.sourceLines ?? []).filter(
      (line) => line.kind === 'lifeInsuranceDeathBenefit',
    )
    expect(benefitLines.map((line) => line.identities[0])).toEqual([
      { entityKind: 'insurancePolicy', policyId: POLICY_ID },
      { entityKind: 'insurancePolicy', policyId: secondPolicy.id },
    ])
  })

  it('settles at max(face, cash value), deposits once, and zeros the policy balance', () => {
    const { result, insurancePhases } = run({ capture: true })
    const year = result.years[0]!
    const finalPhase = insurancePhases.at(-1)!
    const transition = finalPhase.output.transitions[0]!

    expect(transition.payout).toBe(ORIGINAL_PAYOUT)
    expect(transition.cashValue).toBe(0)
    expect(finalPhase.output.deathBenefitPaid).toBe(ORIGINAL_PAYOUT)
    expect(year.deathBenefit).toBe(finalPhase.output.deathBenefitPaid)
    expect(year.insuranceCashValue).toBe(transition.cashValue)
    expect(year.balances[CASH_ACCOUNT_ID]).toBe(transition.payout)

    const benefitLines = (year.cashFlow?.sourceLines ?? []).filter(
      (line) => line.kind === 'lifeInsuranceDeathBenefit',
    )
    expect(benefitLines).toHaveLength(1)
    expect(benefitLines[0]!.amountPlanDollars).toBe(ORIGINAL_PAYOUT)
  })
})
