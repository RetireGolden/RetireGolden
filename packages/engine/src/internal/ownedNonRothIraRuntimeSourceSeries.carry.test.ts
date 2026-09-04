import { describe, expect, it } from 'vitest'

import { asAccountId } from '../actions/identity.js'
import type { AccountId } from '../actions/identity.js'
import type { Account, Plan } from '../model/plan.js'
import { simulatePlan } from '../projection/simulate.js'
import type { YearResult } from '../projection/types.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import {
  singlePersonPlan,
  traditionalAccount,
  validatePlan,
} from '../testing/planFixtures.js'
import {
  initialYearCarry,
  seriesFacts,
  stepYear,
  validateOwnedNonRothIraRuntimeSourceSeries,
  type YearCarry,
} from './ownedNonRothIraRuntimeSourceSeries.js'

const TAX_YEAR = 2026
const noTax = createFlatTaxCalculator(0)

function traditional(id: string, balance: number): Account {
  return traditionalAccount(id, balance)
}

function roth(id: string): Extract<Account, { type: 'roth' }> {
  return {
    type: 'roth', id, name: id, ownerPersonId: 'p1', kind: 'ira', balance: 0,
    annualReturnPct: 0, annualContribution: 0,
  }
}

/**
 * Two owned IRAs held by a 76-year-old, so every year carries required
 * distributions off both accounts and a manual conversion off one of them,
 * plus a qualified annuity purchased off `ira-b` so the fourth carried map --
 * the contract-value channel -- is genuinely populated rather than
 * perpetually empty. The point is a carry that actually moves: each year's
 * chain has to advance the opening balances and contract values it was
 * handed, which is exactly the writing this suite refuses to let reach the
 * previous year's value.
 */
function rmdPlan(): Plan {
  const plan = singlePersonPlan({ dob: '1950-01-01', planningAge: 80 })
  plan.id = 'runtime-source-series-carry'
  plan.accounts = [
    traditional('ira-a', 400_000),
    traditional('ira-b', 150_000),
    roth('roth-1'),
    {
      type: 'annuity', id: 'annuity-1', name: 'annuity-1', ownerPersonId: 'p1',
      // Immediate, because a qualified purchase that is not a QLAC may not
      // defer past the owner's required beginning date; `monthlyAmount` is 0
      // either way, so the contract pays nothing and only the premium moves.
      annualReturnPct: null, startAge: 76, monthlyAmount: 0, colaPct: 0,
      taxablePct: 100,
      purchase: {
        year: TAX_YEAR, premium: 10_000, fundingAccountId: 'ira-b',
        taxQualification: 'qualified',
      },
    },
  ]
  plan.strategies.rothConversion = {
    mode: 'manual',
    conversions: [
      { year: TAX_YEAR, amount: 10_000 },
      { year: TAX_YEAR + 1, amount: 10_000 },
      { year: TAX_YEAR + 2, amount: 10_000 },
    ],
  }
  return validatePlan(plan)
}

function project(plan: Plan, endYear: number): YearResult[] {
  return simulatePlan(plan, {
    startYear: TAX_YEAR,
    horizonEndYear: endYear,
    taxCalculator: noTax,
  }).years
}

/**
 * A map that reads normally and throws on every write.
 *
 * `Object.freeze` cannot express this: a frozen `Map` still accepts `set`,
 * because its entries do not live in own properties. So the guard shadows the
 * three mutators with own properties of its own, which is enough — a copy
 * (`new Map(guarded)`) calls `set` on the NEW map, never on this one.
 */
function guarded<K, V>(source: ReadonlyMap<K, V>): ReadonlyMap<K, V> {
  const map = new Map(source)
  const refuse = (name: string) => (): never => {
    throw new Error(`stepYear wrote through its incoming carry: Map.${name}`)
  }
  const shadowed = map as unknown as Record<string, unknown>
  shadowed.set = refuse('set')
  shadowed.delete = refuse('delete')
  shadowed.clear = refuse('clear')
  return map
}

function guardedCarry(carry: YearCarry): YearCarry {
  return {
    openingBalances: guarded(carry.openingBalances),
    openingRawBalances: guarded(carry.openingRawBalances),
    openingPhysicalRawBalances: guarded(carry.openingPhysicalRawBalances),
    openingContractRawValues: carry.openingContractRawValues === null
      ? null
      : guarded(carry.openingContractRawValues),
  }
}

function snapshot(carry: YearCarry): string {
  return JSON.stringify({
    openingBalances: [...carry.openingBalances],
    openingRawBalances: [...carry.openingRawBalances],
    openingPhysicalRawBalances: [...carry.openingPhysicalRawBalances],
    openingContractRawValues: carry.openingContractRawValues === null
      ? null
      : [...carry.openingContractRawValues],
  })
}

describe('owned-IRA runtime source-series year carry', () => {
  it('leaves the carry it was handed untouched and returns the next one as a value', () => {
    const plan = rmdPlan()
    const years = project(plan, TAX_YEAR + 2)
    expect(years).toHaveLength(3)

    const facts = seriesFacts(plan)
    let carry = initialYearCarry(plan)
    const advanced: string[] = []

    for (const yearResult of years) {
      const incoming = guardedCarry(carry)
      const before = snapshot(incoming)

      // Throws through the guard above if the step writes to any incoming map,
      // and fails the comparison below if it changed one some other way.
      const step = stepYear(incoming, yearResult, facts)

      expect(snapshot(incoming)).toBe(before)
      expect(step.carry.openingBalances).not.toBe(incoming.openingBalances)
      expect(step.carry.openingRawBalances).not.toBe(incoming.openingRawBalances)
      expect(step.carry.openingPhysicalRawBalances)
        .not.toBe(incoming.openingPhysicalRawBalances)
      // `initialYearCarry` hands the very first step `null` here; every step
      // after that carries the prior year's settled contract map, which the
      // guard above wraps and this compares by identity like the other three.
      if (incoming.openingContractRawValues !== null) {
        expect(step.carry.openingContractRawValues)
          .not.toBe(incoming.openingContractRawValues)
      }
      advanced.push(step.year.evidenceId)
      carry = step.carry
    }

    // Not a vacuous pass: the chain has to have moved money every year, or an
    // untouched carry would prove nothing.
    expect(snapshot(initialYearCarry(plan))).not.toBe(snapshot(carry))
    expect(carry.openingRawBalances.get(asAccountId('ira-a'))).toBeLessThan(400_000)
    // And the fourth map is not perpetually empty either: the annuity's
    // premium landed in it and stayed there across every later year.
    expect(carry.openingContractRawValues?.get(asAccountId('annuity-1'))).toBe(10_000)

    // And hand-stepping reproduces exactly what the series entry point builds,
    // so the step this suite guards is the one the replay actually runs.
    const series = validateOwnedNonRothIraRuntimeSourceSeries(plan, TAX_YEAR, years)
    expect(series.status).toBe('ownedNonRothIraRuntimeSourceSeriesComplete')
    if (series.status !== 'ownedNonRothIraRuntimeSourceSeriesComplete') return
    expect(series.years.map((year) => year.evidenceId)).toEqual(advanced)
  })

  it('guarded() throws on every mutator the boundary must not reach', () => {
    // Self-test for the harness above: if `guarded()` stopped throwing --
    // swapped for `Object.freeze`, say, which a `Map` silently ignores -- the
    // main test would keep passing for the wrong reason, no longer proving
    // the incoming carry survives the year untouched.
    const map = guarded(new Map([[asAccountId('ira-a'), 1]])) as unknown as
      Map<AccountId, number>
    expect(() => map.set(asAccountId('ira-b'), 2))
      .toThrow('stepYear wrote through its incoming carry: Map.set')
    expect(() => map.delete(asAccountId('ira-a')))
      .toThrow('stepYear wrote through its incoming carry: Map.delete')
    expect(() => map.clear())
      .toThrow('stepYear wrote through its incoming carry: Map.clear')
    // And reads still work: the guard shadows only the three mutators.
    expect(map.get(asAccountId('ira-a'))).toBe(1)
    expect(map.size).toBe(1)
  })
})
