import { describe, expect, it } from 'vitest'

import type { Account, Plan } from '../model/plan.js'
import {
  couplePlan,
  singlePersonPlan,
  traditionalAccount,
  validatePlan,
} from '../testing/planFixtures.js'
import { replayOwnedNonRothIraContiguousYears } from
  '../internal/ownedNonRothIraContiguousReplay.js'
import { createFlatTaxCalculator } from './flatTax.js'
import { simulatePlan } from './simulate.js'
import type { YearResult } from './types.js'

const TAX_YEAR = 2026

function ira(
  id: string,
  balance: number,
  basis = 0,
  ownerPersonId = 'p1',
): Extract<Account, { type: 'traditional' }> {
  const account = traditionalAccount(id, balance, ownerPersonId, 'ira')
  if (account.type !== 'traditional') throw new Error('expected IRA')
  return {
    ...account,
    annualReturnPct: 0,
    ...(basis === 0 ? {} : { nondeductibleBasis: basis }),
  }
}

function roth(): Extract<Account, { type: 'roth' }> {
  return {
    type: 'roth',
    id: 'roth',
    name: 'Roth IRA',
    ownerPersonId: 'p1',
    kind: 'ira',
    balance: 0,
    annualReturnPct: 0,
    annualContribution: 0,
  }
}

function run(plan: Plan, endYear = TAX_YEAR): YearResult[] {
  return simulatePlan(validatePlan(plan), {
    startYear: TAX_YEAR,
    horizonEndYear: endYear,
    taxCalculator: createFlatTaxCalculator(0),
  }).years
}

describe('simulator committed owned non-Roth IRA annual replay publication', () => {
  it('publishes nothing when no owned IRA can enter settlement', () => {
    const plan = singlePersonPlan({ planningAge: 60 })
    plan.id = 'published-no-owned-ira'

    const years = run(plan, TAX_YEAR + 1)

    expect(years).toHaveLength(2)
    expect(years.every((year) =>
      !Object.hasOwn(year, 'ownedNonRothIraAnnualReplay'))).toBe(true)
  })

  it('publishes only the frozen committed replay without private controller state', () => {
    const plan = singlePersonPlan({ planningAge: 60 })
    plan.id = 'published-line8-half-cent'
    plan.accounts = [ira('ira', 0.06, 0.01), roth()]
    plan.strategies.rothConversion = {
      mode: 'manual',
      conversions: [{ year: TAX_YEAR, amount: 0.03 }],
    }

    const year = run(plan)[0]!
    const publication = year.ownedNonRothIraAnnualReplay
    const owner = publication?.annualReplay.ownerReplays[0]

    expect(publication).toMatchObject({
      status: 'committedOwnedNonRothIraAnnualReplay',
      settlement: 'exactReplayEffectsMatched',
      planId: 'published-line8-half-cent',
      projectionStartTaxYear: TAX_YEAR,
      taxYear: TAX_YEAR,
    })
    expect(owner?.line8AllocationEvidence).toMatchObject({
      annualGrossAmount: 3,
      annualNontaxableBasisAmount: 1,
      annualTaxableAmount: 2,
    })
    const canonicalReplay = replayOwnedNonRothIraContiguousYears(
      validatePlan(plan), TAX_YEAR, [year],
    )
    expect(canonicalReplay.status)
      .toBe('ownedNonRothIraContiguousReplayComplete')
    if (canonicalReplay.status !==
        'ownedNonRothIraContiguousReplayComplete') {
      throw new Error('expected complete committed replay')
    }
    expect(publication?.sourceSeriesEvidenceId)
      .toBe(canonicalReplay.sourceSeriesEvidenceId)
    expect(publication?.contiguousReplayEvidenceId)
      .toBe(canonicalReplay.replayEvidenceId)
    expect(publication?.annualReplay.evidenceId)
      .toBe(canonicalReplay.annualReplays[0]?.evidenceId)
    expect(Object.isFrozen(publication)).toBe(true)
    expect(Object.isFrozen(owner)).toBe(true)
    expect(JSON.stringify(publication)).not.toMatch(
      /pendingSettlement|attemptCount|committedCarryforwards|rollback|issue/,
    )
  })

  // The inverse of what this fixture asserted until 2026-08-07, and the reason
  // it is worth keeping in that form. A gift routed out of a required
  // distribution used to mint an overlay carrying no owner, the source series
  // refused the year, and the household published nothing for it; the overlay
  // now carries the 408(d)(8)(D) attribution the ledger already settled, so the
  // year replays and publishes like any other.
  it('publishes a settled replay for a legacy QCD routed out of a requirement', () => {
    const plan = singlePersonPlan({ dob: '1950-01-01', planningAge: 76 })
    plan.id = 'published-qcd-block'
    plan.accounts = [ira('ira', 100_000, 20_000)]
    plan.strategies.qcdAnnual = 1_000

    const years = run(plan, TAX_YEAR + 1)

    expect(years[0]!.qcd).toBeGreaterThan(0)
    expect(years.every((year) =>
      Object.hasOwn(year, 'ownedNonRothIraAnnualReplay'))).toBe(true)
  })

  // THE LATCH, which is what made the old refusal cost more than the gift year.
  // A rollback that names no owner is household-wide and permanent, so the
  // first gift year used to take the settlement away from every year after it
  // as well -- including years with no gift at all, which had nothing wrong
  // with them. A recurring gift is the ordinary case, so the shape to pin is a
  // gift in every year, and then the mixed one: gift, then no gift.
  it('keeps settling the years after a gift year', () => {
    const plan = singlePersonPlan({ dob: '1950-01-01', planningAge: 82 })
    plan.id = 'published-qcd-latch'
    plan.accounts = [ira('ira', 400_000, 40_000)]
    plan.strategies.qcdAnnual = 5_000

    const years = run(plan, TAX_YEAR + 5)

    expect(years).toHaveLength(6)
    expect(years.every((year) => year.qcd > 0)).toBe(true)
    expect(years.every((year) =>
      Object.hasOwn(year, 'ownedNonRothIraAnnualReplay'))).toBe(true)
  })

  // The mixed shape, which is the one the old latch punished hardest: the gift
  // ends and the years after it were still denied a settlement they had nothing
  // wrong with. The aggregate arm has no year-scoped gift, so the gift is ended
  // the way a real household ends it -- the only eligible donor dies -- and the
  // surviving spouse's own pool has to keep settling afterwards.
  it('keeps the settlement in the non-gift years that follow a gift year', () => {
    const plan = couplePlan({
      p1Dob: '1965-01-01', p1PlanningAge: 75,
      p2Dob: '1950-01-01', p2PlanningAge: 77,
    })
    plan.id = 'published-qcd-latch-mixed'
    plan.accounts = [
      ira('p1-ira', 300_000, 30_000, 'p1'),
      ira('p2-ira', 300_000, 30_000, 'p2'),
    ]
    plan.strategies.qcdAnnual = 5_000

    const years = run(plan, TAX_YEAR + 4)

    // The shape: a gift year, then years with no eligible donor left.
    expect(years[0]!.qcd).toBeGreaterThan(0)
    expect(years.at(-1)!.qcd).toBe(0)
    expect(years.every((year) =>
      Object.hasOwn(year, 'ownedNonRothIraAnnualReplay'))).toBe(true)
    // And the donor's settled basis carries FORWARD across the gift year rather
    // than being reseeded: a latched household would have kept publishing the
    // stale opening figure the gift year's own distributions had already spent.
    const donorOpening = (year: YearResult): number =>
      year.ownedNonRothIraAnnualReplay!.annualReplay.ownerReplays
        .find((owner) => owner.ownerPersonId === 'p2')!.openingBasisAmount
    expect(donorOpening(years[0]!)).toBe(3_000_000)
    expect(donorOpening(years[1]!)).toBeLessThan(donorOpening(years[0]!))
    // The survivor's own pool is untouched by any of it, in every year.
    expect(years.every((year) =>
      year.ownedNonRothIraAnnualReplay!.annualReplay.ownerReplays
        .some((owner) => owner.ownerPersonId === 'p1'))).toBe(true)
  })

  it('keeps a prior publication but never publishes a blocked suffix', () => {
    const plan = singlePersonPlan({ planningAge: 62 })
    plan.id = 'published-no-suffix-reseed'
    plan.accounts = [
      ira('ira', 100, 10),
      {
        type: 'annuity',
        id: 'qualified-annuity',
        name: 'Qualified annuity',
        ownerPersonId: 'p1',
        annualReturnPct: null,
        startAge: 61,
        monthlyAmount: 0,
        colaPct: 0,
        taxablePct: 100,
        purchase: {
          year: TAX_YEAR + 1,
          premium: 5,
          fundingAccountId: 'ira',
          taxQualification: 'qualified',
        },
      },
    ]

    const years = run(plan, TAX_YEAR + 2)

    expect(years[0]!.ownedNonRothIraAnnualReplay).toBeDefined()
    expect(years[1]!).not.toHaveProperty('ownedNonRothIraAnnualReplay')
    expect(years[2]!).not.toHaveProperty('ownedNonRothIraAnnualReplay')
    expect(years[1]!.balances.ira).toBeCloseTo(95, 12)
  })

  it('publishes the depletion commit but not later no-settlement years', () => {
    const plan = singlePersonPlan({ planningAge: 60 })
    plan.id = 'published-zero-basis-shutdown'
    plan.accounts = [ira('ira', 0.01, 0.01)]
    plan.expenses.baseAnnual = 0.01

    const years = run(plan, TAX_YEAR + 1)

    expect(years[0]!.ownedNonRothIraAnnualReplay).toMatchObject({
      status: 'committedOwnedNonRothIraAnnualReplay',
      taxYear: TAX_YEAR,
    })
    expect(years[1]!).not.toHaveProperty('ownedNonRothIraAnnualReplay')
  })
})
