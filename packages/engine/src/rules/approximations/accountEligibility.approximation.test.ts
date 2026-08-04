/**
 * Approximation fixtures for `strategies/accountEligibility.ts`.
 *
 * Every suite here pins a registered `approximated` record: the engine's
 * answer is asserted to be the WRONG one, so the day the gap closes the
 * assertion fails and names the record that has to be reclassified.
 *
 * The three records covered all live in the annual need-based withdrawal path,
 * which carries a calendar-year attained age (`year - birthYear`, simulate.ts)
 * and no distribution date. The statutory boundaries they stand in for are
 * civil dates, computed here with the same arithmetic the filing-grade paths
 * use — `addCalendarMonths(dob, 714)` for 72(t)(2)(A)(i) and
 * `addCalendarMonths(dob, 780)` for 223(f)(4)(C) — so each fixture can show the
 * distribution it describes falling on the far side of the real boundary.
 *
 * Each suite asserts the approximated figure through the real exported helper
 * AND through a real `simulatePlan` run, because the proxy is two things at
 * once: the threshold comparison in the helper, and the calendar-year age the
 * projection feeds it. A control year in which the two readings happen to agree
 * is asserted in every suite, so a fixture cannot pass by producing nothing.
 */

import { expect, it } from 'vitest'

import { addCalendarMonths } from '../../actions/civilDate.js'
import { createEmptyPlan, parsePlan, type Account, type Plan } from '../../model/plan.js'
import { createFlatTaxCalculator } from '../../projection/flatTax.js'
import { simulatePlan } from '../../projection/simulate.js'
import type { YearResult } from '../../projection/types.js'
import {
  hsaNonQualifiedPenaltyRate,
  traditionalWithdrawalPenaltyRate,
  type TraditionalAccount,
} from '../../strategies/accountEligibility.js'
import { describeRule } from '../describeRule.js'

let counter = 0
const nextId = () => `approx-${++counter}`
const noTax = createFlatTaxCalculator(0)

/**
 * One retired owner whose ONLY liquid asset is the account under test, so every
 * dollar of spending is funded from it and the year's penalty figure is that
 * account's penalty and nothing else.
 */
function singleAccountPlan(options: {
  dob: string
  retirementAge: number
  account: (ownerPersonId: string, id: string) => Account
}): Plan {
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
  plan.accounts = [options.account('p1', nextId())]
  return plan
}

function run(plan: Plan, startYear: number): readonly YearResult[] {
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return simulatePlan(parsed.plan, { startYear, taxCalculator: noTax }).years
}

function yearOf(years: readonly YearResult[], year: number): YearResult {
  const found = years.find((entry) => entry.year === year)
  if (found === undefined) throw new RangeError(`No projected year ${year}`)
  return found
}

/**
 * The penalty rate the projection actually charged on the year's draw. The
 * penalty is itself a cash cost, so the draw grosses up to cover it; dividing
 * the charge by the draw recovers the rate the engine applied.
 */
function chargedPenaltyRate(year: YearResult, source: 'traditional' | 'hsa'): number {
  const withdrawn = year.withdrawals[source]
  if (withdrawn <= 0) throw new RangeError(`Year ${year.year} drew nothing from ${source}`)
  return year.penalties / withdrawn
}

/**
 * `produced` is nullable on the fixture context because most classifications
 * have no produced reading. Every suite in this file covers an `approximated`
 * record, where `describeRule` has already refused a missing one.
 */
function approximatedRate(produced: number | null): number {
  if (produced === null) {
    throw new RangeError('an approximated fixture always names the reading it produces')
  }
  return produced
}

function ownedIra(ownerPersonId: string, id: string): TraditionalAccount {
  return {
    type: 'traditional',
    id,
    name: 'Rollover IRA',
    ownerPersonId,
    annualReturnPct: null,
    kind: 'ira',
    balance: 900_000,
    annualContribution: 0,
  }
}

function employerPlan(
  ownerPersonId: string,
  id: string,
  name = 'Former employer 401(k)',
): TraditionalAccount {
  return {
    type: 'traditional',
    id,
    name,
    ownerPersonId,
    annualReturnPct: null,
    kind: 'employer',
    balance: 900_000,
    annualContribution: 0,
  }
}

function legacyHsa(ownerPersonId: string, id: string): Account {
  // Treatment omitted: the v1 simplification, where every withdrawal is
  // penalized pre-65. Nothing about the age test differs across treatments —
  // this one just makes the whole draw penalizable, so the charged rate is the
  // rate under test rather than a blend.
  return {
    type: 'hsa',
    id,
    name: 'HSA',
    ownerPersonId,
    annualReturnPct: null,
    balance: 900_000,
    annualContribution: 0,
  }
}

// ---------------------------------------------------------------------------
// IRC 72(t)(2)(A)(i) — age 59½ modelled as an annual attained-age-60 threshold
// ---------------------------------------------------------------------------

/**
 * December birthday: the statutory boundary falls at the END of June in the
 * year the owner attains 60, so the proxy waives roughly six months early and
 * UNDER-penalizes. Born 1967-12-31 → 59½ on 2027-06-30, attained age 60
 * throughout 2027.
 */
describeRule(
  'irc-72-t-2-A-i-age-59-half-annual-proxy',
  {
    readings: { statute: 0.1, engineWaivesTheWholeAttainedAge60Year: 0 },
    accepted: 'statute',
    produced: 'engineWaivesTheWholeAttainedAge60Year',
    note: 'December birthday — a January draw six months before 59½',
  },
  ({ accepted, produced: producedReading }) => {
    const produced = approximatedRate(producedReading)
    const DOB = '1967-12-31'

    it('places the statutory boundary at 2027-06-30, so a January 2027 draw precedes it', () => {
      expect(addCalendarMonths(DOB, 714)).toBe('2027-06-30')
    })

    it('waives the penalty on an owned IRA from attained age 60, not from 59½', () => {
      const rate = traditionalWithdrawalPenaltyRate(ownedIra('p1', 'a1'), {
        ownerAgeAttained: 2027 - 1967,
        ownerRetirementAge: 55,
      })
      expect(rate).toBe(produced)
      expect(rate).not.toBe(accepted)
    })

    it('charges nothing on the projected 2027 draw, which the statute penalizes until June 30', () => {
      const years = run(
        singleAccountPlan({ dob: DOB, retirementAge: 55, account: ownedIra }),
        2026,
      )
      expect(chargedPenaltyRate(yearOf(years, 2027), 'traditional')).toBeCloseTo(produced, 10)
      expect(yearOf(years, 2027).penalties).toBe(0)
    })

    it('does charge the statutory rate in 2026, where the two readings agree', () => {
      const years = run(
        singleAccountPlan({ dob: DOB, retirementAge: 55, account: ownedIra }),
        2026,
      )
      expect(chargedPenaltyRate(yearOf(years, 2026), 'traditional')).toBeCloseTo(accepted, 10)
    })
  },
)

/**
 * January birthday: the statutory boundary falls at the START of July in the
 * year the owner attains 59, so the proxy withholds the waiver for roughly six
 * months and OVER-penalizes. Born 1968-01-01 → 59½ on 2027-07-01, attained age
 * 59 throughout 2027. Registered separately because the record's
 * `errorDirection` is `bothDirections`: one fixture cannot hold both signs, the
 * readings would collide on a value.
 */
describeRule(
  'irc-72-t-2-A-i-age-59-half-annual-proxy',
  {
    readings: { statute: 0, engineWithholdsTheWaiverUntilTheAttainedAge60Year: 0.1 },
    accepted: 'statute',
    produced: 'engineWithholdsTheWaiverUntilTheAttainedAge60Year',
    note: 'January birthday — a December draw six months after 59½',
  },
  ({ accepted, produced: producedReading }) => {
    const produced = approximatedRate(producedReading)
    const DOB = '1968-01-01'

    it('places the statutory boundary at 2027-07-01, so a December 2027 draw follows it', () => {
      expect(addCalendarMonths(DOB, 714)).toBe('2027-07-01')
    })

    it('still penalizes an owned IRA in the year the owner passes 59½', () => {
      const rate = traditionalWithdrawalPenaltyRate(ownedIra('p1', 'a1'), {
        ownerAgeAttained: 2027 - 1968,
        ownerRetirementAge: 55,
      })
      expect(rate).toBe(produced)
      expect(rate).not.toBe(accepted)
    })

    it('charges 10% on the projected 2027 draw, which the statute waives from July 1', () => {
      const years = run(
        singleAccountPlan({ dob: DOB, retirementAge: 55, account: ownedIra }),
        2026,
      )
      expect(chargedPenaltyRate(yearOf(years, 2027), 'traditional')).toBeCloseTo(produced, 10)
    })

    it('does reach the statutory rate in 2028, where the two readings agree', () => {
      const years = run(
        singleAccountPlan({ dob: DOB, retirementAge: 55, account: ownedIra }),
        2026,
      )
      expect(chargedPenaltyRate(yearOf(years, 2028), 'traditional')).toBeCloseTo(accepted, 10)
    })
  },
)

// ---------------------------------------------------------------------------
// IRC 223(f)(4)(C) — HSA age-65 waiver modelled as a whole attained-age year
// ---------------------------------------------------------------------------

/**
 * Born 1962-12-31: the account beneficiary attains 65 on 2027-12-31, and
 * 223(f)(4)(C) lifts the 20% only for a distribution AFTER that date — the
 * convention `actions/annualHsaPenaltyEvaluation.ts` implements as
 * `evaluationDate > age65Date`. So every 2027 distribution is statutorily
 * penalized, and the proxy waives all twelve months of it. One direction only.
 */
describeRule(
  'irc-223-f-4-C-hsa-age-65-annual-proxy',
  {
    readings: { statute: 0.2, engineWaivesTheWholeAttainedAge65Year: 0 },
    accepted: 'statute',
    produced: 'engineWaivesTheWholeAttainedAge65Year',
    note: 'December birthday — the whole year before the 65th birthday',
  },
  ({ accepted, produced: producedReading }) => {
    const produced = approximatedRate(producedReading)
    const DOB = '1962-12-31'

    it('places the 65th birthday at 2027-12-31, so no 2027 distribution is after it', () => {
      expect(addCalendarMonths(DOB, 780)).toBe('2027-12-31')
    })

    it('waives the non-qualified penalty from attained age 65, not from the day after the birthday', () => {
      const rate = hsaNonQualifiedPenaltyRate(2027 - 1962)
      expect(rate).toBe(produced)
      expect(rate).not.toBe(accepted)
    })

    it('charges nothing on the projected 2027 draw, which the statute penalizes in full', () => {
      const years = run(
        singleAccountPlan({ dob: DOB, retirementAge: 55, account: legacyHsa }),
        2026,
      )
      expect(chargedPenaltyRate(yearOf(years, 2027), 'hsa')).toBeCloseTo(produced, 10)
      expect(yearOf(years, 2027).penalties).toBe(0)
    })

    it('does charge the statutory rate in 2026, where the two readings agree', () => {
      const years = run(
        singleAccountPlan({ dob: DOB, retirementAge: 55, account: legacyHsa }),
        2026,
      )
      expect(chargedPenaltyRate(yearOf(years, 2026), 'hsa')).toBeCloseTo(accepted, 10)
    })
  },
)

// ---------------------------------------------------------------------------
// IRC 72(t)(2)(A)(v) — Rule of 55 modelled from the plan retirement age
// ---------------------------------------------------------------------------

/**
 * The waiver reaches only the plan of the employer separated from. The engine
 * has no employer identity and no separation event, so it waives every employer
 * plan the owner holds once the household's single modelled retirement age is
 * reached — including a 401(k) left behind at 40, which the statute does not
 * reach at all.
 *
 * The discriminating fact — WHICH employer maintained the plan — has no field
 * on `Account` and no field on `EarlyWithdrawalContext`, which is the gap
 * itself. The fixture pins it the only way it can be pinned from outside: two
 * plans the statute treats differently are handed to the engine and come back
 * with the same rate.
 */
describeRule(
  'irc-72-t-2-A-v-rule-of-55-separation-proxy',
  {
    readings: { statute: 0.1, engineWaivesEveryEmployerPlanAtTheRetirementAge: 0 },
    accepted: 'statute',
    produced: 'engineWaivesEveryEmployerPlanAtTheRetirementAge',
    note: 'a plan left behind at 40, waived like the plan retired from',
  },
  ({ accepted, produced: producedReading }) => {
    const produced = approximatedRate(producedReading)
    // Born 1970, retires at the modelled retirement age of 57 (calendar year
    // 2027). The employer plan below is the one left behind in 2010 at attained
    // age 40 — a separation the statute requires to have happened after 55.
    const ctx = { ownerAgeAttained: 2027 - 1970, ownerRetirementAge: 57 }

    it('waives the plan the owner left at 40, which 72(t)(2)(A)(v) does not reach', () => {
      const rate = traditionalWithdrawalPenaltyRate(employerPlan('p1', 'left-at-40'), ctx)
      expect(rate).toBe(produced)
      expect(rate).not.toBe(accepted)
    })

    it('cannot tell that plan from the plan actually separated from at 57', () => {
      const abandoned = traditionalWithdrawalPenaltyRate(
        employerPlan('p1', 'left-at-40', 'Job one 401(k), left in 2010'),
        ctx,
      )
      const separatedFrom = traditionalWithdrawalPenaltyRate(
        employerPlan('p1', 'retired-from-at-57', 'Final employer 401(k)'),
        ctx,
      )
      expect(abandoned).toBe(separatedFrom)
    })

    it('does return the statutory rate for an IRA, where the two readings agree', () => {
      expect(traditionalWithdrawalPenaltyRate(ownedIra('p1', 'ira'), ctx)).toBe(accepted)
    })

    it('charges nothing on the projected employer-plan draw at 57', () => {
      const years = run(
        singleAccountPlan({ dob: '1970-06-15', retirementAge: 57, account: employerPlan }),
        2027,
      )
      expect(chargedPenaltyRate(yearOf(years, 2027), 'traditional')).toBeCloseTo(produced, 10)
    })
  },
)

/**
 * The other direction. The engine reads the household retirement age as the
 * separation date, so an owner who left an employer at 56 and kept working
 * elsewhere until 62 is charged the 10% on that former employer's plan at 58,
 * where 72(t)(2)(A)(v) — separation from THAT employer after attaining 55 —
 * waives it. Separation before the modelled retirement age has no field either,
 * so again the pin is that the engine answers from the retirement age alone.
 */
describeRule(
  'irc-72-t-2-A-v-rule-of-55-separation-proxy',
  {
    readings: { statute: 0, engineWithholdsTheWaiverUntilTheRetirementAge: 0.1 },
    accepted: 'statute',
    produced: 'engineWithholdsTheWaiverUntilTheRetirementAge',
    note: 'separated from the plan at 56 but still working elsewhere',
  },
  ({ accepted, produced: producedReading }) => {
    const produced = approximatedRate(producedReading)
    // Left this employer at attained 56; still employed elsewhere, so the
    // household retirement age is 62. Distribution taken at attained 58.
    const ctx = { ownerAgeAttained: 58, ownerRetirementAge: 62 }

    it('penalizes a plan separated from after 55 because the owner has not reached the modelled retirement age', () => {
      const rate = traditionalWithdrawalPenaltyRate(employerPlan('p1', 'left-at-56'), ctx)
      expect(rate).toBe(produced)
      expect(rate).not.toBe(accepted)
    })

    it('does waive once the retirement age is reached, where the two readings agree', () => {
      expect(
        traditionalWithdrawalPenaltyRate(employerPlan('p1', 'left-at-56'), {
          ownerAgeAttained: 62,
          ownerRetirementAge: 62,
        }),
      ).toBe(accepted)
    })

    it('charges 10% on the projected draw at 58 from a plan the statute has already released', () => {
      const years = run(
        singleAccountPlan({ dob: '1969-06-15', retirementAge: 62, account: employerPlan }),
        2027,
      )
      expect(chargedPenaltyRate(yearOf(years, 2027), 'traditional')).toBeCloseTo(produced, 10)
    })
  },
)
