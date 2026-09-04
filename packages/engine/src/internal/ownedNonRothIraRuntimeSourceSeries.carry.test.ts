import { describe, expect, it } from 'vitest'

import { asAccountId } from '../actions/identity.js'
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
 * distributions off both accounts and a manual conversion off one of them. The
 * point is a carry that actually moves: each year's chain has to advance the
 * opening balances it was handed, which is exactly the writing this suite
 * refuses to let reach the previous year's value.
 */
function rmdPlan(): Plan {
  const plan = singlePersonPlan({ dob: '1950-01-01', planningAge: 80 })
  plan.id = 'runtime-source-series-carry'
  plan.accounts = [
    traditional('ira-a', 400_000),
    traditional('ira-b', 150_000),
    roth('roth-1'),
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
      advanced.push(step.year.evidenceId)
      carry = step.carry
    }

    // Not a vacuous pass: the chain has to have moved money every year, or an
    // untouched carry would prove nothing.
    expect(snapshot(initialYearCarry(plan))).not.toBe(snapshot(carry))
    expect(carry.openingRawBalances.get(asAccountId('ira-a'))).toBeLessThan(400_000)

    // And hand-stepping reproduces exactly what the series entry point builds,
    // so the step this suite guards is the one the replay actually runs.
    const series = validateOwnedNonRothIraRuntimeSourceSeries(plan, TAX_YEAR, years)
    expect(series.status).toBe('ownedNonRothIraRuntimeSourceSeriesComplete')
    if (series.status !== 'ownedNonRothIraRuntimeSourceSeriesComplete') return
    expect(series.years.map((year) => year.evidenceId)).toEqual(advanced)
  })
})
