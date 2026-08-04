import { expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Account, type IncomeStream, type Plan } from '../../model/plan.js'
import { packForYear } from '../../params/index.js'
import { createFlatTaxCalculator } from '../../projection/flatTax.js'
import { simulatePlan } from '../../projection/simulate.js'
import { describeRule } from '../describeRule.js'

/**
 * Fixtures for the three approximated records that had gone stale on main,
 * after each was retargeted onto the gap that is still real.
 *
 * All three described behaviour a parallel branch had already fixed — the
 * QCD/RMD conditioning gate, the calendar-age 71 QCD gate, and the undivided
 * spousal HSA family limit — and none failed anything on the way, because
 * until now no `approximated` record carried a fixture at all.
 *
 * Two of the three were closed by the same commit, which is the shape to
 * expect: one change closes several recorded gaps at once, and the records it
 * silently falsifies are the ones nobody thought to re-read.
 */

let counter = 0
const testIds = (): string => `approx-${++counter}`
const fixedNow = (): Date => new Date('2026-06-11T00:00:00.000Z')

/** Age 73 in 2026, still working, so a post-70.5 deductible IRA contribution is live. */
function workingSeptuagenarian(): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1953-03-15',
    sex: 'average',
    retirementAge: 80,
    longevity: { planningAge: 90, source: 'manual' },
  }
  plan.assumptions.inflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  return plan
}

function cash(balance: number): Account {
  return {
    type: 'cash',
    id: testIds(),
    name: 'Cash',
    ownerPersonId: null,
    annualReturnPct: null,
    balance,
    annualContribution: 0,
  }
}

function traditionalIra(balance: number, contribution = 0): Account {
  return {
    type: 'traditional',
    id: testIds(),
    name: 'IRA',
    ownerPersonId: 'p1',
    annualReturnPct: null,
    kind: 'ira',
    balance,
    annualContribution: contribution,
  }
}

function hsa(balance: number, contribution: number): Account {
  return {
    type: 'hsa',
    id: testIds(),
    name: 'HSA',
    ownerPersonId: 'p1',
    annualReturnPct: null,
    balance,
    annualContribution: contribution,
  }
}

function wages(annualGross: number): IncomeStream {
  return { type: 'wages', id: testIds(), personId: 'p1', annualGross, endAge: null, realGrowthPct: 0 }
}

function validate(plan: Plan): Plan {
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

const noTax = createFlatTaxCalculator(0)
const pack2026 = packForYear(2026).pack

// The deductible IRA contribution the donor makes in the same year as the gift.
// Larger than the gift, so the statutory reduction swallows the exclusion whole
// and the two readings cannot be confused for a rounding difference.
const DEDUCTIBLE_IRA_CONTRIBUTION = pack2026.contributionLimits.ira
  + pack2026.contributionLimits.iraCatchUp50
const GIFT = 4_000

describeRule('irc-408-d-8-A-projection-post-70-half-contribution-offset', {
  readings: {
    // 408(d)(8)(A) second sentence: the exclusion is reduced, but not below
    // zero, by post-70.5 deductible section 219 contributions. The contribution
    // here exceeds the gift, so the whole exclusion is swept.
    statuteSweepsTheWholeExclusion: 0,
    engineExcludesTheGiftRegardless: GIFT,
  },
  accepted: 'statuteSweepsTheWholeExclusion',
  produced: 'engineExcludesTheGiftRegardless',
}, ({ accepted, produced }) => {
  it('excludes a gift the statute would have offset to nothing', () => {
    const plan = workingSeptuagenarian()
    plan.accounts = [cash(0), traditionalIra(265_000, DEDUCTIBLE_IRA_CONTRIBUTION), hsa(0, 0)]
    plan.incomes = [wages(120_000)]
    plan.strategies.qcdAnnual = GIFT

    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
    const year = result.years.find((y) => y.year === 2026)!

    // The setup only discriminates if the contribution actually happened; a
    // year in which the engine refused the contribution would produce the same
    // exclusion for an entirely different reason.
    expect(year.contributions).toBeGreaterThanOrEqual(DEDUCTIBLE_IRA_CONTRIBUTION)
    expect(year.qcd).toBeCloseTo(produced, 6)
    expect(year.qcd).not.toBeCloseTo(accepted, 6)
  })
})

/** Crosses 70.5 on 30 December 2026, with two days of the year left. */
function crossesSeventyAndAHalfAtYearEnd(): Plan {
  const plan = workingSeptuagenarian()
  plan.household.people[0]!.dob = '1956-06-30'
  return plan
}

describeRule('irc-408-d-8-B-ii-projection-annual-age-proxy', {
  readings: {
    // The ledger holds one number for the year and no gift date, so the
    // statutory reading has to be stated for a gift the donor actually makes:
    // one dated before 30 December 2026 is not a QCD, and nothing about it is
    // excludable. That is the whole of the gift here.
    statuteExcludesNothingBeforeTheHalfBirthday: 0,
    engineExcludesTheWholeCrossingYear: GIFT,
  },
  accepted: 'statuteExcludesNothingBeforeTheHalfBirthday',
  produced: 'engineExcludesTheWholeCrossingYear',
  note: 'when in the crossing year eligibility starts',
}, ({ accepted, produced }) => {
  it('admits a donor from 1 January of the year they cross 70.5 in December', () => {
    const plan = crossesSeventyAndAHalfAtYearEnd()
    plan.accounts = [cash(0), traditionalIra(500_000)]
    plan.strategies.qcdAnnual = GIFT

    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
    const year = result.years.find((y) => y.year === 2026)!

    // Age 70, so no RMD is due: the gift is funded entirely out of the
    // pre-RMD window, which is the arm that used to be closed altogether.
    expect(year.rmd).toBe(0)
    expect(year.qcd).toBeCloseTo(produced, 6)
    expect(year.qcd).not.toBeCloseTo(accepted, 6)
  })

  it('refuses a donor whose half-birthday falls in the following year', () => {
    // The control the permissive reading needs: eligibility is granted from 1
    // January of the crossing year and not before, so a July birth — 70.5 in
    // January 2027 — gets nothing in 2026. Without this the fixture could pass
    // on an engine that simply admitted everyone.
    const plan = crossesSeventyAndAHalfAtYearEnd()
    plan.household.people[0]!.dob = '1956-07-01'
    plan.accounts = [cash(0), traditionalIra(500_000)]
    plan.strategies.qcdAnnual = GIFT

    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
    expect(result.years.find((y) => y.year === 2026)!.qcd).toBe(0)
  })
})

describeRule('irc-223-b-2-7-projection-coverage-proration-and-medicare', {
  readings: {
    // 223(b)(7) sets the monthly limitation to zero for the first month of
    // Medicare entitlement and every month after. At 73 the taxpayer has been
    // entitled for eight years, so no month of the year carries a limit.
    statuteZeroOnceEntitledToMedicare: 0,
    engineAllowsAWholeSelfOnlyLimitPlusCatchUp:
      pack2026.contributionLimits.hsaSelfOnly + pack2026.contributionLimits.hsaCatchUp55,
  },
  accepted: 'statuteZeroOnceEntitledToMedicare',
  produced: 'engineAllowsAWholeSelfOnlyLimitPlusCatchUp',
  note: 'Medicare entitlement',
}, ({ accepted, produced }) => {
  it('allows a whole HSA limit to a taxpayer eight years into Medicare', () => {
    const plan = workingSeptuagenarian()
    // One person, so the coverage tier is self-only and 223(b)(5) division —
    // which IS implemented — never enters. This fixture is about (b)(7) alone.
    plan.accounts = [cash(0), hsa(0, 20_000)]
    plan.incomes = [wages(120_000)]

    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
    const year = result.years.find((y) => y.year === 2026)!

    expect(year.contributions).toBeCloseTo(produced, 6)
    expect(year.contributions).not.toBeCloseTo(accepted, 6)
  })
})
