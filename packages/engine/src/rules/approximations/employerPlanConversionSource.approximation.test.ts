/**
 * Approximation fixture for the conversion SOURCE gate.
 *
 * The destination question -- which account a conversion may land in -- is
 * settled and lives in `projection/conversionDestinationVehicle.test.ts`. This
 * one asks the opposite half: whether the dollars could lawfully have left the
 * account they were drawn from. `isConvertibleToRoth` admits every owned
 * traditional account, employer plans included, and asks nothing about
 * distributability, so an unseparated participant under 59½ is modelled
 * converting a 401(k) balance IRC 401(k)(2)(B)(i) does not let the plan pay out.
 *
 * Both suites run through `simulatePlan` rather than through the predicate
 * alone, because the predicate is only half the behaviour: the aggregate
 * conversion path uses it twice, once to weight an owner's slice of the
 * household target and once to decide which balances the drain loop may take
 * from. A fixture on the predicate would pin the answer without pinning the
 * dollars that move because of it.
 */

import { expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Account, type Plan } from '../../model/plan.js'
import { createFlatTaxCalculator } from '../../projection/flatTax.js'
import { simulatePlan } from '../../projection/simulate.js'
import type { YearResult } from '../../projection/types.js'
import { isConvertibleToRoth } from '../../strategies/accountEligibility.js'
import { describeRule } from '../describeRule.js'

let counter = 0
const nextId = (): string => `src-${++counter}`
const noTax = createFlatTaxCalculator(0)

const CONVERSION_YEAR = 2026
const REQUESTED_CONVERSION = 50_000
const EMPLOYER_BALANCE = 400_000

/**
 * One person whose only convertible account is an employer plan, so the year's
 * conversion figure is that account's and nothing else. `retirementAge` sits
 * above the projected age on purpose in the suite below: the person is still
 * working, which with an age under 59½ is the fact pattern the statutory
 * restriction actually bites on.
 */
function employerPlanPlan(options: { dob: string, retirementAge: number }): Plan {
  const plan = createEmptyPlan({
    newId: nextId,
    now: () => new Date('2026-06-11T00:00:00.000Z'),
  })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: options.dob,
    sex: 'average',
    retirementAge: options.retirementAge,
    longevity: { planningAge: 80, source: 'manual' },
  }
  plan.assumptions.inflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  plan.expenses.baseAnnual = 40_000
  plan.expenses.healthcare = {
    pre65MonthlyPremiumPerPerson: 0,
    applyAcaCredit: false,
    medicareExtrasMonthlyPerPerson: 0,
  }
  plan.strategies.rothConversion = {
    mode: 'manual',
    conversions: [{ year: CONVERSION_YEAR, amount: REQUESTED_CONVERSION }],
  }
  plan.accounts = [
    {
      type: 'cash',
      id: 'cash',
      name: 'Cash',
      ownerPersonId: 'p1',
      annualReturnPct: null,
      balance: 500_000,
      annualContribution: 0,
    },
    {
      type: 'roth',
      id: 'rothIra',
      name: 'Pat Roth IRA',
      ownerPersonId: 'p1',
      annualReturnPct: null,
      kind: 'ira',
      balance: 0,
      annualContribution: 0,
    },
    {
      type: 'traditional',
      id: 'plan401k',
      name: 'Pat 401(k)',
      ownerPersonId: 'p1',
      annualReturnPct: null,
      kind: 'employer',
      balance: EMPLOYER_BALANCE,
      annualContribution: 0,
    },
  ]
  return plan
}

function yearOf(plan: Plan): Readonly<YearResult> {
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  const result = simulatePlan(parsed.plan, {
    startYear: CONVERSION_YEAR,
    taxCalculator: noTax,
  })
  return result.years.find((row) => row.year === CONVERSION_YEAR)!
}

const employerAccount = (plan: Plan): Account =>
  plan.accounts.find((account) => account.id === 'plan401k')!

describeRule('irc-401-k-2-B-i-employer-plan-conversion-source-not-gated-by-distributability', {
  readings: {
    // The plan may not pay these dollars to a participant who has not separated
    // and has not reached 59½, and a rollover the plan cannot make is not a
    // qualified rollover contribution, so the statutory answer is that nothing
    // converts.
    statuteGatesAnUndistributableBalance: 0,
    engineConvertsAnyOwnedTraditional: REQUESTED_CONVERSION,
  },
  accepted: 'statuteGatesAnUndistributableBalance',
  produced: 'engineConvertsAnyOwnedTraditional',
}, ({ accepted, produced }) => {
  /** Age 46 in the conversion year, retiring at 65: still working, well under 59½. */
  const unseparatedUnder59 = (): Plan =>
    employerPlanPlan({ dob: '1980-04-02', retirementAge: 65 })

  it('converts a 401(k) balance the plan may not distribute', () => {
    const year = yearOf(unseparatedUnder59())

    expect(year.rothConversion).toBeCloseTo(produced, 6)
    expect(year.rothConversion).not.toBeCloseTo(accepted, 6)
    // Where the dollars came from, not merely how many moved: the record is
    // about the source account, so the drained balance is named.
    expect(year.balances['plan401k']).toBeCloseTo(EMPLOYER_BALANCE - produced, 6)
    expect(year.balances['rothIra']).toBeCloseTo(produced, 6)
  })

  it('raises no warning about the account it drew from', () => {
    // Silence is what makes this survivable-looking: the same path names its
    // other refusals, so a reader has every reason to read silence as assent.
    // Pinned to the movement it failed to mention, because an absence of
    // warnings is the weakest shape an assertion can take.
    //
    // Filtered rather than compared whole. This household outlives its cash and
    // funds later spending from the 401(k) before 59½, which raises a genuine
    // early-withdrawal warning that has nothing to do with the conversion. An
    // equality on the whole list would have been asserting that instead.
    const parsed = parsePlan(unseparatedUnder59())
    if (!parsed.ok) throw new Error(parsed.issues.join('; '))
    const result = simulatePlan(parsed.plan, {
      startYear: CONVERSION_YEAR,
      taxCalculator: noTax,
    })
    const year = result.years.find((row) => row.year === CONVERSION_YEAR)!

    expect(year.rothConversion).toBeCloseTo(produced, 6)
    expect(result.warnings.filter((warning) => warning.includes('convers'))).toEqual([])
  })

  it('admits the account through the predicate that carries no gate', () => {
    // The predicate reading, so a later reader can see the gap is one missing
    // condition rather than something buried in the conversion path.
    expect(isConvertibleToRoth(employerAccount(unseparatedUnder59()))).toBe(true)
  })

  it('agrees with the statute for a separated participant past 59½', () => {
    // The control, and the reason the record is an approximation rather than a
    // flat defect: 401(k)(2)(B)(i)(I) and (III) let this same balance out, so
    // here the engine's answer is the statute's. Without it the fixture would
    // only be pinning "a conversion happened".
    const year = yearOf(employerPlanPlan({ dob: '1958-04-02', retirementAge: 62 }))

    expect(year.rothConversion).toBeCloseTo(REQUESTED_CONVERSION, 6)
    expect(year.balances['plan401k'])
      .toBeCloseTo(EMPLOYER_BALANCE - REQUESTED_CONVERSION, 6)
  })
})
