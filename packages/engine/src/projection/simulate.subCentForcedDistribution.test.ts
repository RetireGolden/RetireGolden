import { describe, expect, it } from 'vitest'

import { validateOwnedNonRothIraRuntimeSourceSeries } from '../internal/ownedNonRothIraRuntimeSourceSeries.js'
import type { Account, Plan } from '../model/plan.js'
import {
  cashAccount,
  singlePersonPlan,
  traditionalAccount,
  validatePlan,
} from '../testing/planFixtures.js'
import { createFlatTaxCalculator } from './flatTax.js'
import { simulatePlan } from './simulate.js'
import type { YearResult } from './types.js'

/**
 * An owned IRA holding less than one cent.
 *
 * The exact-cent ledger has no way to express a fraction of a cent, and a
 * balance below one is not distributable in currency at all: no custodian can
 * move three hundredths of a cent, and no ledger this engine publishes can
 * record that it did. The engine's answer is that the year's forced
 * distribution produces no movement and no occurrence, and that its sub-cent
 * remainder is DISCHARGED rather than carried as an unsatisfied requirement.
 *
 * Both halves are load-bearing. Without the first, the simulator recorded an
 * `ownedIraRmd` occurrence for a gross that rounds to zero cents, and the
 * runtime source series -- which admits no zero-cent occurrence -- refused the
 * whole year, which silently rolled the annual exact-basis settlement back.
 * The residue never emptied, because each year's required distribution is a
 * fraction of the fraction that is left, so the refusal was permanent. Without
 * the second, the undistributed fraction would reach the RMD-shortfall seams,
 * where an unsatisfied remainder is read as proof that every one of the owner's
 * IRAs was exhausted -- and a sub-cent quantum is not that proof.
 */

const TAX_YEAR = 2026
/** Born 1950-03-01: age 76 in 2026, so a required distribution is due. */
const RMD_AGE_DOB = '1950-03-01'
/**
 * Born 1955-03-01: age 71 in 2026, so 70½ has passed and a qualified
 * charitable distribution is available, while the SECURE 2.0 applicable age of
 * 73 is still two years away and no distribution is required yet.
 */
const PRE_RMD_WINDOW_DOB = '1955-03-01'
/**
 * Less than one cent, and not a round fraction of one: the residue a draining
 * exact-cent movement leaves behind is whatever the float held after the last
 * whole cent came out.
 */
const SUB_CENT_BALANCE = 0.007679324895434547
/**
 * A residue below HALF a cent, which is a different case and needs saying.
 *
 * `SUB_CENT_BALANCE` above rounds to one cent, so an arm that sweeps a whole
 * balance journals a one-cent occurrence for it and the ledger accepts that --
 * the balance chain closes on a residual the normalizer already tolerates.
 * What no arm may journal is a gross that rounds to ZERO, and only a balance
 * under half a cent produces one. Both residues are reachable: a drain leaves
 * whatever the float held after the last whole cent came out.
 *
 * The forced-distribution case does not need the distinction, because a
 * required amount is a small fraction of the balance it is computed from -- a
 * sub-cent IRA's requirement is well under half a cent either way.
 */
const HALF_CENT_RESIDUE = 0.0034196624477172734

function ira(id: string, balance: number): Extract<Account, { type: 'traditional' }> {
  const account = traditionalAccount(id, balance, 'p1', 'ira')
  if (account.type !== 'traditional') throw new Error('expected IRA')
  return { ...account, annualReturnPct: 0 }
}

function subCentPlan(
  id: string,
  balance = SUB_CENT_BALANCE,
  dob = RMD_AGE_DOB,
): Plan {
  const plan = singlePersonPlan({ dob, planningAge: 95 })
  plan.id = id
  plan.accounts = [ira('ira', balance), cashAccount('cash', 200_000)]
  return plan
}

function project(plan: Plan, endYear: number): YearResult[] {
  return simulatePlan(validatePlan(plan), {
    startYear: TAX_YEAR,
    horizonEndYear: endYear,
    taxCalculator: createFlatTaxCalculator(0),
  }).years
}

/**
 * The whole projection's series, validated the way its consumer validates it.
 *
 * The seed opening balance is the Plan's own, so a later year handed over on
 * its own would be measured against a balance from before the projection
 * started. Every year is passed together, which is what makes a later year's
 * assertion about the engine rather than about the fixture.
 */
function seriesStatus(plan: Plan, years: readonly YearResult[]): string {
  return validateOwnedNonRothIraRuntimeSourceSeries(
    validatePlan(plan), TAX_YEAR, years,
  ).status
}

describe('an owned IRA whose balance is below one cent', () => {
  it('discharges the forced distribution rather than recording a non-event', () => {
    const years = project(subCentPlan('sub-cent-discharge'), TAX_YEAR + 1)

    expect(years.map((year) => year.year)).toEqual([TAX_YEAR, TAX_YEAR + 1])
    for (const year of years) {
      // Nothing moved, so nothing is published as having moved. `year.rmd`
      // reports the dollars the year actually distributed, which is what every
      // other figure in the aggregate ledger reports, and an RMD figure
      // carrying an undistributable fraction would be a claim about a movement
      // no ledger can hold.
      expect(year.rmd).toBe(0)
      expect(year.balances.ira).toBe(SUB_CENT_BALANCE)
      expect(
        (year.retirementRuntimeSource?.runtimeOccurrences ?? [])
          .map((occurrence) => occurrence.kind),
      ).toEqual([])
    }
  })

  it('keeps the source series complete in every year the residue survives', () => {
    const plan = subCentPlan('sub-cent-series')
    const years = project(plan, TAX_YEAR + 1)

    expect(seriesStatus(plan, years)).toBe('ownedNonRothIraRuntimeSourceSeriesComplete')
    // And the opening year on its own, which is the shape the defect was
    // reported in: one year, one household, one refusal.
    expect(seriesStatus(plan, years.slice(0, 1)))
      .toBe('ownedNonRothIraRuntimeSourceSeriesComplete')
  })

  it('still distributes a balance that can fund a whole cent', () => {
    // The discharge reaches exactly the amounts the ledger cannot express and
    // no further. A balance whose required distribution rounds to a cent still
    // distributes one, so the guard above cannot be passing by suppressing
    // required distributions generally.
    const plan = subCentPlan('sub-cent-boundary', 1)
    const years = project(plan, TAX_YEAR)

    expect(years[0]!.rmd).toBeGreaterThan(0)
    expect(years[0]!.balances.ira).toBeLessThan(1)
    expect(
      (years[0]!.retirementRuntimeSource?.runtimeOccurrences ?? [])
        .map((occurrence) => occurrence.kind),
    ).toEqual(['ownedIraRmd'])
    expect(seriesStatus(plan, years)).toBe('ownedNonRothIraRuntimeSourceSeriesComplete')
  })
})

describe('an aggregate QCD in the pre-RMD window', () => {
  /**
   * The donor is inside the 70½-to-applicable-age window on purpose. A scalar
   * gift routed out of a required distribution requires a source-allocation
   * stage this replay does not have, and refuses the year for that separate
   * registered reason; a donor with no requirement yet gives entirely beyond
   * the RMD, which is the arm under test here.
   */
  function giftingPlan(id: string, balance: number): Plan {
    const plan = subCentPlan(id, balance, PRE_RMD_WINDOW_DOB)
    plan.strategies.qcdAnnual = 10_000
    return plan
  }

  it('gives nothing it cannot fund and records no zero-cent gift', () => {
    const plan = giftingPlan('sub-cent-aggregate-qcd', SUB_CENT_BALANCE)
    const years = project(plan, TAX_YEAR + 1)

    for (const year of years) {
      expect(year.qcd).toBe(0)
      expect(year.balances.ira).toBe(SUB_CENT_BALANCE)
      expect(
        (year.retirementRuntimeSource?.runtimeOccurrences ?? [])
          .map((occurrence) => occurrence.kind),
      ).toEqual([])
    }
    expect(seriesStatus(plan, years)).toBe('ownedNonRothIraRuntimeSourceSeriesComplete')
  })

  it('drains a beyond-RMD gift to whole fundable cents and leaves the residue inert', () => {
    // The scalar gift is more than twice the account, so the beyond-RMD sweep
    // takes everything the IRA can fund. What it must not do is take the
    // fraction of a cent it cannot -- nor come back in a later year and
    // journal a second gift of nothing against what is left.
    const plan = giftingPlan('sub-cent-aggregate-qcd-drain', 4_321.987654321)
    const years = project(plan, TAX_YEAR + 2)

    expect(years[0]!.qcd).toBe(4_321.98)
    expect(years[0]!.balances.ira).toBeGreaterThanOrEqual(0)
    expect(years[0]!.balances.ira).toBeLessThan(0.01)
    for (const year of years.slice(1)) {
      expect(year.qcd).toBe(0)
      expect(year.rmd).toBe(0)
      expect(year.balances.ira).toBe(years[0]!.balances.ira)
      expect(
        (year.retirementRuntimeSource?.runtimeOccurrences ?? [])
          .map((occurrence) => occurrence.kind),
      ).toEqual([])
    }
    expect(seriesStatus(plan, years)).toBe('ownedNonRothIraRuntimeSourceSeriesComplete')
  })
})

describe('an aggregate Roth conversion against a sub-cent owned IRA', () => {
  it('converts nothing and journals no zero-cent debit', () => {
    // The aggregate sweep takes `min(balance, ownerRemaining)` from every
    // convertible account, so a source holding a residue too small to express
    // in cents was converted anyway and the debit was journalled as a movement
    // the exact-cent ledger cannot hold. A conversion of nothing also leaves no
    // destination credit for the replay to reconcile against a debit, which is
    // the other half of what it would have been asked to close over.
    const plan = subCentPlan('sub-cent-aggregate-conversion')
    plan.accounts = [
      ira('ira', HALF_CENT_RESIDUE),
      {
        type: 'roth',
        id: 'roth',
        name: 'roth',
        ownerPersonId: 'p1',
        annualReturnPct: 0,
        kind: 'ira',
        balance: 0,
        annualContribution: 0,
      },
      cashAccount('cash', 200_000),
    ]
    plan.strategies.rothConversion = {
      mode: 'manual',
      conversions: [
        { year: TAX_YEAR, amount: 10_000 },
        { year: TAX_YEAR + 1, amount: 10_000 },
      ],
    }
    const years = project(plan, TAX_YEAR + 1)

    for (const year of years) {
      expect(year.rothConversion).toBe(0)
      expect(year.balances.ira).toBe(HALF_CENT_RESIDUE)
      expect(year.balances.roth).toBe(0)
      expect(
        (year.retirementRuntimeSource?.runtimeOccurrences ?? [])
          .map((occurrence) => occurrence.kind),
      ).toEqual([])
    }
    expect(seriesStatus(plan, years)).toBe('ownedNonRothIraRuntimeSourceSeriesComplete')
  })
})

describe('a need-based withdrawal against a sub-cent owned IRA', () => {
  it('draws nothing and journals no zero-cent withdrawal', () => {
    // Spending the household cannot meet reaches the IRA, and the withdrawal
    // planner allocates whatever is there -- including a residue below a cent,
    // which was then journalled as a `legacyNeedBasedWithdrawal` for a gross
    // that rounds to zero. The household is short either way: a fraction of a
    // cent was never going to fund anything.
    const plan = subCentPlan('sub-cent-need-based')
    plan.accounts = [ira('ira', HALF_CENT_RESIDUE), cashAccount('cash', 0)]
    plan.expenses.baseAnnual = 30_000
    const years = project(plan, TAX_YEAR + 1)

    for (const year of years) {
      expect(year.balances.ira).toBe(HALF_CENT_RESIDUE)
      expect(
        (year.retirementRuntimeSource?.runtimeOccurrences ?? [])
          .map((occurrence) => occurrence.kind),
      ).toEqual([])
    }
    expect(seriesStatus(plan, years)).toBe('ownedNonRothIraRuntimeSourceSeriesComplete')
  })
})
