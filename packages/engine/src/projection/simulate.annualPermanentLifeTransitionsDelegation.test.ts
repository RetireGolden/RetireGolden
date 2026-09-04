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
 *
 * Scaffolding and the policy behind it live in
 * `simulate.seamGuard.test-support.ts`; the sentinels stay here.
 */
import { describe, expect, it, vi } from 'vitest'

import type {
  AnnualPermanentLifeTransition,
  AnnualPermanentLifeTransitionsInput,
  AnnualPermanentLifeTransitionsResult,
} from './internal/annualPermanentLifeTransitions.js'

/**
 * Ordered marker log across the two instrumented phases. The insurance marker
 * is pushed from the injector, which the recorder runs after the real helper,
 * so it lands exactly where the hand-written wrapper used to push it. The
 * insurance call's own input, result, and cash-value snapshot live on the
 * recorder.
 */
type PassEvent =
  | { readonly kind: 'propertyPhase'; readonly year: number }
  | { readonly kind: 'insurancePhase' }

interface SentinelResult {
  readonly transitions: readonly AnnualPermanentLifeTransition[]
  readonly deathBenefitPaid: number
}

const hostile = vi.hoisted(() => ({
  events: [] as PassEvent[],
  sentinel: null as SentinelResult | null,
  snapshotCashValues: [] as ReadonlyMap<string, number>[],
}))

const seam = await vi.hoisted(
  async () =>
    (
      await import('./simulate.seamGuard.test-support.js')
    ).createSeamRecorder<
      AnnualPermanentLifeTransitionsInput,
      AnnualPermanentLifeTransitionsResult,
      ReadonlyMap<string, number>
    >(),
)

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
      hostile.events.push({ kind: 'propertyPhase', year: input.year })
      return rows
    },
  }
})

vi.mock('./internal/annualPermanentLifeTransitions.js', async (importOriginal) =>
  seam.through(
    await importOriginal<
      typeof import('./internal/annualPermanentLifeTransitions.js')
    >(),
    'annualPermanentLifeTransitions',
    (natural): AnnualPermanentLifeTransitionsResult => {
      const configured = hostile.sentinel
      hostile.events.push({ kind: 'insurancePhase' })
      return configured === null
        ? natural
        : {
            transitions: configured.transitions,
            deathBenefitPaid: configured.deathBenefitPaid,
          }
    },
    { capture: (input) => new Map(input.insuranceCashValues) },
  ),
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
      hostile.snapshotCashValues.push(new Map(input.insuranceCashValues))
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
  hostile.events.length = 0
  hostile.snapshotCashValues.length = 0
  seam.reset()
  hostile.sentinel = options.sentinel ?? null
  const input = plan(options.insurance)
  const result = simulatePlan(input, {
    startYear: YEAR,
    horizonEndYear: YEAR,
    taxCalculator: noTax,
    ...(options.capture === true ? { captureAnnualCashFlow: true } : {}),
  })
  const propertyPhases = hostile.events.filter(
    (event): event is Extract<PassEvent, { kind: 'propertyPhase' }> =>
      event.kind === 'propertyPhase',
  )
  return { input, result, propertyPhases, insurancePhases: [...seam.calls] }
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
    expect(hostile.events).toHaveLength(propertyPhases.length * 2)
    for (let index = 0; index < hostile.events.length; index += 2) {
      expect(hostile.events[index]).toEqual({ kind: 'propertyPhase', year: YEAR })
      expect(hostile.events[index + 1]?.kind).toBe('insurancePhase')
    }

    for (const phase of insurancePhases) {
      expect(phase.input.policies).toBe(input.insurance)
      expect(phase.input.policies.map((policy) => policy.id)).toEqual([
        POLICY_ID,
      ])
      expect(phase.captured.get(POLICY_ID)).toBe(OPENING_CASH_VALUE)
      expect(phase.injected.deathBenefitPaid).toBe(ORIGINAL_PAYOUT)
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
    expect(hostile.snapshotCashValues).toHaveLength(insurancePhases.length)
    for (const cashValues of hostile.snapshotCashValues) {
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

    expect(finalPhase.injected.transitions.map((row) => row.policyId)).toEqual([
      POLICY_ID,
      secondPolicy.id,
    ])
    expect(finalPhase.injected.transitions.map((row) => row.payout)).toEqual([
      ORIGINAL_PAYOUT,
      secondPolicy.deathBenefit,
    ])
    expect(finalPhase.injected.deathBenefitPaid).toBe(
      ORIGINAL_PAYOUT + secondPolicy.deathBenefit,
    )
    expect(year.deathBenefit).toBe(finalPhase.injected.deathBenefitPaid)
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
    const transition = finalPhase.injected.transitions[0]!

    expect(transition.payout).toBe(ORIGINAL_PAYOUT)
    expect(transition.cashValue).toBe(0)
    expect(finalPhase.injected.deathBenefitPaid).toBe(ORIGINAL_PAYOUT)
    expect(year.deathBenefit).toBe(finalPhase.injected.deathBenefitPaid)
    expect(year.insuranceCashValue).toBe(transition.cashValue)
    expect(year.balances[CASH_ACCOUNT_ID]).toBe(transition.payout)

    const benefitLines = (year.cashFlow?.sourceLines ?? []).filter(
      (line) => line.kind === 'lifeInsuranceDeathBenefit',
    )
    expect(benefitLines).toHaveLength(1)
    expect(benefitLines[0]!.amountPlanDollars).toBe(ORIGINAL_PAYOUT)
  })
})
