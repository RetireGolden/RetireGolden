import { describe, expect, it } from 'vitest'

import type { Account, Plan } from '../model/plan.js'
import {
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
): Extract<Account, { type: 'traditional' }> {
  const account = traditionalAccount(id, balance, 'p1', 'ira')
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

  it('publishes nothing when legacy QCD blocks exact replay', () => {
    const plan = singlePersonPlan({ dob: '1950-01-01', planningAge: 76 })
    plan.id = 'published-qcd-block'
    plan.accounts = [ira('ira', 100_000, 20_000)]
    plan.strategies.qcdAnnual = 1_000

    const years = run(plan, TAX_YEAR + 1)

    expect(years.every((year) =>
      !Object.hasOwn(year, 'ownedNonRothIraAnnualReplay'))).toBe(true)
    expect(years[0]!.qcd).toBeGreaterThan(0)
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
