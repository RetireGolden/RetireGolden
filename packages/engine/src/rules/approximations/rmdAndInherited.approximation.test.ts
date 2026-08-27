/**
 * Pins the remaining `approximated` registry records that govern required
 * minimum distributions and inherited traditional accounts, plus settled
 * fixtures that share this file (the §4974 reclassification and the first-year
 * April 1 deferral default, whose elected receipt-year companion lives under
 * irc-402-a-employer-plan-distribution-receipt-year-taxability).
 *
 * An approximated record is a claim about a figure this engine knowingly gets
 * wrong. Nothing watched those claims until now, and two of them rotted into
 * describing gaps that had already been closed. Each approximation fixture
 * below therefore names the reading the authority supports and the different
 * reading the engine returns. Settled fixtures in this file assert the accepted
 * reading directly.
 *
 * Every fixture calls the real engine entry point named in the record's
 * `implementedBy`, at the narrowest level that exhibits the gap. Where the
 * claim is about which YEAR income is recognised in, or about a plan-level fact
 * the narrow function never sees, the entry point has to be `simulatePlan` —
 * `requiredMinimumDistribution` takes neither a deferral election nor an
 * employment status, so calling it alone could not tell the readings apart.
 */
import { expect, it } from 'vitest'

import { describeRule } from '../describeRule.js'

import { packForYear } from '../../params/index.js'
import { createFlatTaxCalculator } from '../../projection/flatTax.js'
import { inheritedForcedAmount } from '../../strategies/inheritedIra.js'
import { requiredMinimumDistribution } from '../../rmd/rmd.js'
import type { Account, Plan } from '../../model/plan.js'
import {
  cashAccount,
  runPlan,
  singlePersonPlan,
  traditionalAccount,
} from '../../testing/planFixtures.js'

const { pack } = packForYear(2026)
const noTax = createFlatTaxCalculator(0)

/**
 * Born 1953, so the applicable age is 73 under IRC 401(a)(9)(C)(v) and the
 * attainment year is 2026 — the projection's first year. Uniform Lifetime
 * Table entries from Treas. Reg. 1.401(a)(9)-9(c): 26.5 at 73, 25.5 at 74.
 */
const OWNER_DOB = '1953-01-01'
const OWNER_PLANNING_AGE = 95
const START_BALANCE = 500_000
const UNIFORM_LIFETIME_AT_73 = 26.5
/** The whole first distribution calendar year's required amount. */
const FIRST_YEAR_AMOUNT = START_BALANCE / UNIFORM_LIFETIME_AT_73

// --- 1. First-year April 1 deferral -----------------------------------------

/**
 * The amount for the attainment year is settled and correct (see
 * treas-reg-1-401-a-9-5-a-3-first-distribution-calendar-year). The engine now
 * offers an opt-in `rmdFirstYearDeferrals` election; this fixture pins the
 * DEFAULT path, which books the first-year amount in the attainment year.
 * Elected April 1 receipt-year income recognition is covered by
 * irc-402-a-employer-plan-distribution-receipt-year-taxability.
 */
describeRule('irc-401-a-9-C-i-first-year-april-1-deferral', {
  readings: {
    defaultBooksInAttainmentYear: FIRST_YEAR_AMOUNT,
    rejectedLeavesAttainmentYearEmpty: 0,
  },
  accepted: 'defaultBooksInAttainmentYear',
  note: 'default books attainment-year without election',
}, ({ accepted, readings }) => {
  function ownedIraPlan(): Plan {
    const plan = singlePersonPlan({ dob: OWNER_DOB, planningAge: OWNER_PLANNING_AGE })
    plan.accounts = [traditionalAccount('ira', START_BALANCE)]
    return plan
  }

  it('books the first-year amount in the attainment year when no deferral is elected', () => {
    const years = runPlan(ownedIraPlan(), noTax).years
    const attainmentYear = years[0]!
    expect(attainmentYear.year).toBe(2026)
    expect(attainmentYear.rmd).toBeCloseTo(accepted, 6)
    expect(attainmentYear.rmd).not.toBeCloseTo(readings.rejectedLeavesAttainmentYearEmpty, 6)
  })

  it('leaves the following year carrying one distribution rather than two under the default', () => {
    const years = runPlan(ownedIraPlan(), noTax).years
    const attainmentYear = years[0]!
    const followingYear = years[1]!
    expect(followingYear.year).toBe(2027)
    // Under an elected deferral the 2027 row would carry the 2026 amount as
    // well; the default does not invent that spike.
    expect(followingYear.rmd).toBeLessThan(attainmentYear.rmd * 1.5)
  })
})

// --- 2. Still-working exception ---------------------------------------------

/**
 * The plan schema already carries `retirementAge`, which is the fact the rule
 * turns on, so the discriminating input is a participant past the applicable
 * age whose retirement age is still ahead of them. `followsOwnerRmds` in
 * strategies/accountEligibility.ts admits the employer plan on account shape
 * alone and simulate.ts never consults the person, so the projection forces a
 * distribution the statute does not require.
 */
describeRule('irc-401-a-9-C-i-II-still-working-exception', {
  readings: {
    // Non-5-percent owner, aged 73, still employed by the plan sponsor: the
    // required beginning date has not arrived, so no amount is required.
    statuteDefersUntilTheRetirementYear: 0,
    engineForcesTheEmployerPlanFromTheApplicableAgeAlone: FIRST_YEAR_AMOUNT,
  },
  accepted: 'statuteDefersUntilTheRetirementYear',
  produced: 'engineForcesTheEmployerPlanFromTheApplicableAgeAlone',
}, ({ accepted, produced }) => {
  it('forces an employer-plan distribution from a participant still seven years from retiring', () => {
    const plan = singlePersonPlan({
      dob: OWNER_DOB,
      planningAge: OWNER_PLANNING_AGE,
      retirementAge: 80, // attained age is 73 in 2026 — still working
    })
    plan.accounts = [traditionalAccount('employer-plan', START_BALANCE, 'p1', 'employer')]

    const first = runPlan(plan, noTax).years[0]!
    expect(first.year).toBe(2026)
    expect(first.rmd).toBeCloseTo(produced, 6)
    expect(first.rmd).not.toBeCloseTo(accepted, 6)
  })
})

// --- 3. Greater of the employee and beneficiary life expectancy -------------

/**
 * The Single Life Table divisor itself is settled and correct now; what is
 * still absent is the greater-of arm of Treas. Reg. 1.401(a)(9)-5(d)(1)(ii).
 * The engine cannot compute the employee side at all: `inheritedAccountSchema`
 * in model/plan.ts carries only `ownerDeathYear` and `decedentHadStartedRmds`,
 * so no decedent age or birth year reaches
 * `beneficiaryRemainingLifeExpectancy`, which reads the table at the
 * beneficiary's age and nothing else.
 *
 * The gap bites when the beneficiary is OLDER than the decedent, because then
 * the beneficiary's short expectancy is the one displacing the longer employee
 * expectancy. Decedent died in 2026 at age 75, on or after the required
 * beginning date; Single Life Table at 75 is 14.8, read at the age on the
 * birthday in the year of death and reduced by one for 2027 → 13.8. The
 * beneficiary reaches 85 in 2027, the first distribution calendar year, so
 * their fixed expectancy is the entry at 85 → 8.1.
 */
const INHERITED_BALANCE = 300_000
const EMPLOYEE_EXPECTANCY_IN_2027 = 14.8 - 1
const BENEFICIARY_EXPECTANCY_IN_2027 = 8.1

describeRule('treas-reg-1-401-a-9-5-d-1-ii-greater-of-employee-life-expectancy', {
  readings: {
    statuteDividesByTheGreaterEmployeeExpectancy: INHERITED_BALANCE / EMPLOYEE_EXPECTANCY_IN_2027,
    engineDividesByTheBeneficiaryExpectancyAlone: INHERITED_BALANCE / BENEFICIARY_EXPECTANCY_IN_2027,
  },
  accepted: 'statuteDividesByTheGreaterEmployeeExpectancy',
  produced: 'engineDividesByTheBeneficiaryExpectancyAlone',
}, ({ accepted, produced }) => {
  it('divides by the beneficiary expectancy where the employee expectancy is the greater', () => {
    const forced = inheritedForcedAmount({
      pack,
      year: 2027,
      ownerDeathYear: 2026,
      decedentHadStartedRmds: true, // the at-least-as-rapidly case (d)(1)(ii) governs
      balance: INHERITED_BALANCE,
      startBalance: INHERITED_BALANCE,
      beneficiaryAge: 85,
    })

    expect(forced).toBeCloseTo(produced, 6)
    expect(forced).not.toBeCloseTo(accepted, 6)
    // One-sided, as the record states: a greater-of can only raise a
    // denominator, so omitting it can only make the distribution too large.
    expect(forced).toBeGreaterThan(accepted)
  })
})

// --- 4. Eligible designated beneficiary --------------------------------------

/**
 * The owner died in 2026 BEFORE their required beginning date and the
 * beneficiary is five years younger than the decedent, so they are an eligible
 * designated beneficiary under IRC 401(a)(9)(E)(ii)(V) and the life-expectancy
 * rule of 401(a)(9)(B)(iii) applies instead of the ten-year rule. Choosing the
 * before-RBD case keeps the greater-of question of record 3 out of the
 * accepted value entirely: the denominator is the beneficiary's own expectancy.
 *
 * The beneficiary reaches 71 in 2027, the first distribution calendar year, so
 * the fixed Single Life Table entry is 18.0; by 2036 nine calendar years have
 * elapsed, leaving 9.0. 2036 is also `ownerDeathYear + 10`, where the engine
 * sweeps the entire remaining balance because it holds no beneficiary-status
 * fact that could exempt the account.
 */
const EDB_EXPECTANCY_IN_2036 = 18.0 - 9

describeRule('irc-401-a-9-E-ii-eligible-designated-beneficiary', {
  readings: {
    statuteStretchesOverTheBeneficiaryLifeExpectancy: INHERITED_BALANCE / EDB_EXPECTANCY_IN_2036,
    engineSweepsTheWholeBalanceInYearTen: INHERITED_BALANCE,
  },
  accepted: 'statuteStretchesOverTheBeneficiaryLifeExpectancy',
  produced: 'engineSweepsTheWholeBalanceInYearTen',
}, ({ accepted, produced }) => {
  const edbAccount = {
    pack,
    ownerDeathYear: 2026,
    decedentHadStartedRmds: false, // died before the required beginning date
    balance: INHERITED_BALANCE,
    startBalance: INHERITED_BALANCE,
  }

  it('empties an eligible designated beneficiary\'s account in the tenth year', () => {
    const forced = inheritedForcedAmount({
      ...edbAccount,
      year: 2036, // ownerDeathYear + 10
      beneficiaryAge: 80,
    })

    expect(forced).toBeCloseTo(produced, 6)
    expect(forced).not.toBeCloseTo(accepted, 6)
  })

  it('requires nothing inside the window that the life-expectancy rule would require', () => {
    // The same misreading in the other half of the window: an eligible
    // designated beneficiary owes an annual life-expectancy amount every year,
    // and the engine forces nothing until the sweep.
    const forced = inheritedForcedAmount({
      ...edbAccount,
      year: 2030,
      beneficiaryAge: 74,
    })

    expect(forced).toBe(0)
  })
})

// --- 5. IRC 4974 excise tax on a shortfall -----------------------------------

/**
 * Nothing in the engine prices a missed distribution, so the discriminating
 * input has to be a year in which a required amount genuinely goes
 * undistributed. The simulator produces one: an annuity purchase funds its
 * premium out of the traditional IRA before the RMD block runs, while the
 * required amount was already fixed on the start-of-year balance. The owner is
 * therefore short the WHOLE year's required minimum distribution — the engine
 * computes that shortfall and carries it into the Roth-conversion evidence —
 * and the projection now charges it on `penalties`, the year row's
 * distribution-rule channel, without putting the excise into MAGI.
 */
const SHORTFALL_EXCISE_RATE = 0.25

describeRule('irc-4974-rmd-shortfall-excise-tax', {
  readings: {
    statuteImposes25PercentOfTheShortfall: FIRST_YEAR_AMOUNT * SHORTFALL_EXCISE_RATE,
    rejectedZeroPenaltyReading: 0,
  },
  accepted: 'statuteImposes25PercentOfTheShortfall',
}, ({ accepted, readings }) => {
  it('charges 25 percent when the whole required amount goes undistributed', () => {
    const plan = singlePersonPlan({ dob: OWNER_DOB, planningAge: OWNER_PLANNING_AGE })
    const annuity: Account = {
      type: 'annuity',
      id: 'qualified-annuity',
      name: 'qualified-annuity',
      ownerPersonId: 'p1',
      annualReturnPct: 0,
      // `monthlyAmount` is 0, so the contract never pays whatever this says. 74
      // rather than a deferred age because a qualified purchase that is not a
      // QLAC may not defer past the owner's required beginning date, which for
      // this 1953 birth is the year they turn 74.
      startAge: 74,
      monthlyAmount: 0,
      colaPct: 0,
      taxablePct: 100,
      purchase: {
        year: 2026,
        premium: START_BALANCE, // the entire IRA, paid before the RMD block
        fundingAccountId: 'ira',
        taxQualification: 'qualified',
      },
    }
    plan.accounts = [traditionalAccount('ira', START_BALANCE), annuity]

    const first = runPlan(plan, noTax).years[0]!
    expect(first.year).toBe(2026)
    // A real shortfall: the required amount was fixed at the start-of-year
    // balance, and not a dollar of it came out.
    expect(FIRST_YEAR_AMOUNT).toBeGreaterThan(0)
    expect(first.rmd).toBe(0)

    expect(first.penalties).toBeCloseTo(accepted, 6)
    expect(first.penalties).not.toBe(readings.rejectedZeroPenaltyReading)
  })
})

// --- 6. Sub-cent required distribution ---------------------------------------

/**
 * The requirement is computed correctly and then not distributed, so only a
 * projection row can show the gap: `requiredMinimumDistribution` returns the
 * regulation's amount whatever the engine later does with it, and the whole
 * question here is what the engine does with it.
 *
 * The balance is the residue an exact-cent movement leaves in a Plan float
 * account after the last whole cent has come out, which is the only way an
 * owned IRA reaches this state.
 * `packages/engine/src/projection/simulate.subCentForcedDistribution.test.ts`
 * carries the end-to-end consequences; this fixture carries the disclosure.
 */
const SUB_CENT_RESIDUE = 0.007679324895434547
const SUB_CENT_OWNER_DOB = '1950-03-01'
/** The residue's own required amount for 2026, at an attained age of 76. */
const SUB_CENT_REQUIRED_AMOUNT = requiredMinimumDistribution(
  pack, 1950, 76, SUB_CENT_RESIDUE, { ownerSex: 'average' },
)

describeRule('treas-reg-1-408-8-projection-sub-cent-distribution-discharge', {
  readings: {
    // 1.408-8(e)(1)(i): the separately calculated amount is what must come out,
    // and the regulation sets no floor below which it need not.
    regulationRequiresTheSeparatelyCalculatedAmount: SUB_CENT_REQUIRED_AMOUNT,
    engineDistributesNothingAndDischargesTheRemainder: 0,
  },
  accepted: 'regulationRequiresTheSeparatelyCalculatedAmount',
  produced: 'engineDistributesNothingAndDischargesTheRemainder',
}, ({ accepted, produced }) => {
  function subCentPlan(): Plan {
    const plan = singlePersonPlan({ dob: SUB_CENT_OWNER_DOB, planningAge: 77 })
    // Cash covers the household's own spending, so nothing but the forced
    // distribution has any reason to reach the IRA.
    plan.accounts = [{
      ...traditionalAccount('ira', SUB_CENT_RESIDUE),
      annualReturnPct: 0,
    } as Account, cashAccount('cash', 200_000)]
    return plan
  }

  it('distributes nothing where the required amount rounds to zero cents', () => {
    // The premise, checked rather than assumed: the regulation really does
    // require a positive amount from this account, and it really is one no
    // exact-cent ledger can express. The figure is written out because it is
    // the whole disclosure -- three ten-thousandths of a dollar is what the
    // record means by "bounded by one cent per owned account per year", and a
    // reader should be able to see the size of it without running anything.
    expect(accepted).toBe(0.0003240221474866898)
    expect(accepted).toBeGreaterThan(0)
    expect(accepted).toBeLessThan(0.005)

    const first = runPlan(subCentPlan(), noTax).years[0]!
    expect(first.year).toBe(2026)
    expect(first.rmd).toBe(produced)
    expect(first.rmd).not.toBe(accepted)
    // Nothing moved, so the residue is exactly where it started.
    expect(first.balances.ira).toBe(SUB_CENT_RESIDUE)
  })

  it('leaves the residue inert rather than working it down year by year', () => {
    // The bound in the record is "per owned account per year", and it holds
    // only because the residue never shrinks: an engine that distributed some
    // fraction each year would accumulate a different deviation than the one
    // registered.
    const years = runPlan(subCentPlan(), noTax).years
    expect(years.length).toBeGreaterThan(1)
    for (const year of years) {
      expect(year.rmd).toBe(produced)
      expect(year.balances.ira).toBe(SUB_CENT_RESIDUE)
    }
  })
})
