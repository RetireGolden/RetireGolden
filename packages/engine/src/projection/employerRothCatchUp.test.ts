import { describe, expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Account, type IncomeStream, type Plan } from '../model/plan.js'
import { packForYear } from '../params/index.js'
import { describeRule } from '../rules/describeRule.js'
import { createFederalTaxCalculator } from '../tax/federalTax.js'
import { createFlatTaxCalculator } from './flatTax.js'
import {
  allocateEmployerElectiveDeferrals,
  employerMatchElectiveBase,
  highEarnerRothCatchUpMandated,
  indexRothCatchUpWageThreshold,
} from './employerRothCatchUp.js'
import { simulatePlan } from './simulate.js'

const pack2026 = packForYear(2026).pack
const THRESHOLD = pack2026.contributionLimits.rothCatchUpWageThreshold
const BASE_402G = pack2026.contributionLimits.employee401k
const CATCH_UP_50 = pack2026.contributionLimits.catchUp50
const SUPER_CATCH_UP = pack2026.contributionLimits.superCatchUp60to63
const IRA = pack2026.contributionLimits.ira
const IRA_CATCH_UP = pack2026.contributionLimits.iraCatchUp50
const IRS_LIMIT_WARNING = 'Some contributions were reduced to stay within IRS annual limits.'

// Notice 2025-67: the 2026 wage test uses the 2025 threshold of 150,000.
// IRC 414(v)(7)(A): "exceed" — 150,000 is out; 150,000.01 is in.
const FICA_AT_THRESHOLD = 150_000
const FICA_ONE_CENT_OVER = 150_000.01

let counter = 0
const testIds = (): string => `roth-cu-${++counter}`
const fixedNow = (): Date => new Date('2026-01-01T00:00:00.000Z')
const noTax = createFlatTaxCalculator(0)

function soloPlan(dob: string): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob,
    sex: 'average',
    retirementAge: 70,
    longevity: { planningAge: 90, source: 'manual' },
  }
  plan.assumptions.inflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  plan.assumptions.ssCola = { mode: 'fixed', annualPct: 0 }
  plan.expenses.baseAnnual = 0
  return plan
}

function wages(annualGross: number): IncomeStream {
  return { type: 'wages', id: testIds(), personId: 'p1', annualGross, endAge: null, realGrowthPct: 0 }
}

function employer(
  type: 'traditional' | 'roth',
  contribution: number,
  priorFica: number,
  id = testIds(),
): Account {
  return {
    type,
    id,
    name: type === 'traditional' ? '401k' : 'Roth 401k',
    ownerPersonId: 'p1',
    annualReturnPct: 0,
    kind: 'employer',
    balance: 0,
    annualContribution: contribution,
    priorCalendarYearFicaWages: priorFica,
  }
}

function traditionalIra(contribution: number): Account {
  return {
    type: 'traditional',
    id: testIds(),
    name: 'IRA',
    ownerPersonId: 'p1',
    annualReturnPct: 0,
    kind: 'ira',
    balance: 0,
    annualContribution: contribution,
  }
}

function cash(): Account {
  return {
    type: 'cash',
    id: testIds(),
    name: 'Cash',
    ownerPersonId: null,
    annualReturnPct: 0,
    balance: 1_000_000,
    annualContribution: 0,
  }
}

function validate(plan: Plan): Plan {
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

function year2026(plan: Plan, taxCalculator = noTax) {
  return run2026(plan, taxCalculator).years[0]!
}

function run2026(plan: Plan, taxCalculator = noTax) {
  return simulatePlan(validate(plan), {
    startYear: 2026,
    horizonEndYear: 2026,
    taxCalculator,
  })
}

function limits(catchUpLimit: number) {
  return {
    contributionYear: 2026,
    baseLimit: BASE_402G,
    catchUpLimit,
    wageThreshold: THRESHOLD,
  }
}

function request(
  type: 'traditional' | 'roth',
  desired: number,
  priorFica: number,
  accountId: string = type,
): { accountId: string; type: 'traditional' | 'roth'; desired: number; priorCalendarYearFicaWages: number } {
  return { accountId, type, desired, priorCalendarYearFicaWages: priorFica }
}

// ---------------------------------------------------------------------------
// Settled indexer — IRC 414(v)(7)(E) five-thousand-dollar step
// ---------------------------------------------------------------------------

// 414(v)(7)(E): "any increase under this subparagraph which is not a multiple
// of $5,000 shall be rounded to the next lower multiple of $5,000." The 2026
// published figure is 150,000. An increase of 4,999.99 is not a multiple of
// 5,000, so it rounds to 0 and the threshold holds. Scaling 150,000 by
// limitGrowth without the step would yield 154,999.99.
describeRule('irc-414-v-7-E-roth-catch-up-wage-threshold', {
  readings: {
    roundIncreaseDownToFiveThousand: 150_000,
    scaleByLimitGrowthWithoutStep: 154_999.99,
  },
  accepted: 'roundIncreaseDownToFiveThousand',
  note: 'an increase of 4,999.99 holds the prior step',
}, ({ accepted, readings }) => {
  it('holds 150,000 when the COLA increase is 4,999.99', () => {
    const indexed = indexRothCatchUpWageThreshold(THRESHOLD, 1 + 4_999.99 / THRESHOLD)
    expect(indexed).toBe(accepted)
    expect(indexed).not.toBe(readings.scaleByLimitGrowthWithoutStep)
  })
})

// An increase of exactly 5,000 is already a multiple of 5,000, so (v)(7)(E)
// does not round it down. The threshold becomes 155,000. Holding 150,000 would
// be the reading that treats every non-zero increase as still below a step.
describeRule('irc-414-v-7-E-roth-catch-up-wage-threshold', {
  readings: {
    fiveThousandIsAWholeStep: 155_000,
    holdAtPriorStep: 150_000,
  },
  accepted: 'fiveThousandIsAWholeStep',
  note: 'an increase of 5,000 is a whole step',
}, ({ accepted, readings }) => {
  it('returns 155,000 when the COLA increase is 5,000', () => {
    const indexed = indexRothCatchUpWageThreshold(THRESHOLD, 1 + 5_000 / THRESHOLD)
    expect(indexed).toBe(accepted)
    expect(indexed).not.toBe(readings.holdAtPriorStep)
  })
})

// ---------------------------------------------------------------------------
// Settled mandate — atomic allocator fixtures
// ---------------------------------------------------------------------------

// IRC 414(v)(7)(A): paragraph (1) applies only if additional elective
// deferrals are designated Roth when prior-year 3121(a) wages from the
// sponsoring employer *exceed* the threshold. Notice 2025-67 sets that
// threshold at 150,000 for the 2026 contribution year. A figure that
// equals the threshold does not exceed it, so the catch-up may remain
// pre-tax. Treating equality as "at or above" (the HCE-style reading)
// would recharacterize 8,000 that the statute leaves pre-tax.
describeRule('irc-414-v-7-A-high-earner-roth-catch-up-mandate', {
  readings: {
    exceedNotAtOrAbove: { traditional: 32_500, roth: 0 },
    treatEqualityAsHighEarner: { traditional: 24_500, roth: 8_000 },
  },
  accepted: 'exceedNotAtOrAbove',
  note: 'exactly 150,000 is not over the threshold',
}, ({ accepted, readings }) => {
  it('leaves the catch-up pre-tax when prior-year FICA equals 150,000', () => {
    const result = allocateEmployerElectiveDeferrals(
      [
        request('traditional', BASE_402G + CATCH_UP_50, FICA_AT_THRESHOLD, 'trad'),
        request('roth', 0, FICA_AT_THRESHOLD, 'roth'),
      ],
      limits(CATCH_UP_50),
    )
    expect(result.allowed.get('trad')).toBe(accepted.traditional)
    expect(result.allowed.get('roth')).toBe(accepted.roth)
    expect(result.allowed.get('trad')).not.toBe(readings.treatEqualityAsHighEarner.traditional)
    expect(result.designatedRothCatchUp).toBe(0)
  })
})

// One cent over 150,000 exceeds. The catch-up slice (the 8,000 above the
// 24,500 §402(g) base) must be designated Roth. Leaving it pre-tax is the
// reading the engine used before this rule was wired, and it understates
// 2026 ordinary income by the catch-up amount.
describeRule('irc-414-v-7-A-high-earner-roth-catch-up-mandate', {
  readings: {
    catchUpIsDesignatedRoth: { traditional: 24_500, roth: 8_000 },
    catchUpStaysPreTax: { traditional: 32_500, roth: 0 },
  },
  accepted: 'catchUpIsDesignatedRoth',
  note: '150,000.01 forces the catch-up slice into Roth',
}, ({ accepted, readings }) => {
  it('recharacterizes the age-50 catch-up as designated Roth one cent over the threshold', () => {
    const result = allocateEmployerElectiveDeferrals(
      [
        request('traditional', BASE_402G + CATCH_UP_50, FICA_ONE_CENT_OVER, 'trad'),
        request('roth', 0, FICA_ONE_CENT_OVER, 'roth'),
      ],
      limits(CATCH_UP_50),
    )
    expect(result.allowed.get('trad')).toBe(accepted.traditional)
    expect(result.allowed.get('roth')).toBe(accepted.roth)
    expect(result.designatedRothCatchUp).toBe(CATCH_UP_50)
    expect(result.allowed.get('trad')).not.toBe(readings.catchUpStaysPreTax.traditional)
  })
})

// IRC 414(v)(2)(E) / Notice 2025-67: ages 60–63 take 11,250, not the
// ordinary 8,000. That higher figure is still "additional elective
// deferrals" under 414(v)(1), so (v)(7)(A) Roth-mandates the whole
// 11,250, not only the ordinary catch-up.
describeRule('irc-414-v-7-A-high-earner-roth-catch-up-mandate', {
  readings: {
    superCatchUpIsRothMandated: { traditional: 24_500, roth: 11_250 },
    onlyOrdinaryCatchUpIsRoth: { traditional: 27_750, roth: 8_000 },
  },
  accepted: 'superCatchUpIsRothMandated',
  note: 'ages 60-63 super catch-up is the same 414(v) dollars',
}, ({ accepted, readings }) => {
  it('Roth-mandates the 11,250 super catch-up at age 62, not only 8,000', () => {
    const result = allocateEmployerElectiveDeferrals(
      [
        request('traditional', BASE_402G + SUPER_CATCH_UP, FICA_ONE_CENT_OVER, 'trad'),
        request('roth', 0, FICA_ONE_CENT_OVER, 'roth'),
      ],
      limits(SUPER_CATCH_UP),
    )
    expect(result.allowed.get('trad')).toBe(accepted.traditional)
    expect(result.allowed.get('roth')).toBe(accepted.roth)
    expect(result.designatedRothCatchUp).toBe(SUPER_CATCH_UP)
    expect(result.allowed.get('roth')).not.toBe(readings.onlyOrdinaryCatchUpIsRoth.roth)
    expect(result.allowed.get('trad')).not.toBe(readings.onlyOrdinaryCatchUpIsRoth.traditional)
  })
})

// T.D. 10033 preamble: a participant with no FICA wages from the
// sponsoring employer for the preceding year (new hire; partner with
// only self-employment income) is not subject. Zero is not an exceed.
describeRule('irc-414-v-7-A-high-earner-roth-catch-up-mandate', {
  readings: {
    zeroFicaNotSubject: { traditional: 32_500, roth: 0 },
    treatZeroAsHighEarner: { traditional: 24_500, roth: 8_000 },
  },
  accepted: 'zeroFicaNotSubject',
  note: 'zero prior FICA is not subject',
}, ({ accepted, readings }) => {
  it('leaves the catch-up pre-tax when prior-year FICA is zero', () => {
    const result = allocateEmployerElectiveDeferrals(
      [
        request('traditional', BASE_402G + CATCH_UP_50, 0, 'trad'),
        request('roth', 0, 0, 'roth'),
      ],
      limits(CATCH_UP_50),
    )
    expect(result.allowed.get('trad')).toBe(accepted.traditional)
    expect(result.allowed.get('roth')).toBe(accepted.roth)
    expect(result.allowed.get('trad')).not.toBe(readings.treatZeroAsHighEarner.traditional)
  })
})

// T.D. 10033 §1.414(v)-2(b)(2): no qualified Roth contribution program
// ⇒ the high earner's maximum catch-up under 414(v) is $0. The rejected
// reading is the one simulate.ts used before this rule: book the catch-up
// as pre-tax anyway.
describeRule('irc-414-v-7-A-high-earner-roth-catch-up-mandate', {
  readings: {
    noRothFeatureZeroCatchUp: 24_500,
    keepPreTaxCatchUp: 32_500,
  },
  accepted: 'noRothFeatureZeroCatchUp',
  note: 'no Roth feature zeroes the high-earner catch-up',
}, ({ accepted, readings }) => {
  it('drops the catch-up rather than keeping it pre-tax when there is no Roth employer account', () => {
    const result = allocateEmployerElectiveDeferrals(
      [request('traditional', BASE_402G + CATCH_UP_50, FICA_ONE_CENT_OVER, 'trad')],
      limits(CATCH_UP_50),
    )
    expect(result.allowed.get('trad')).toBe(accepted)
    expect(result.refusedCatchUp).toBe(CATCH_UP_50)
    expect(result.allowed.get('trad')).not.toBe(readings.keepPreTaxCatchUp)
  })
})

// T.D. 10033 DATES: regulations generally apply to contributions in years
// beginning after 2026-12-31. SECURE 2.0 §603(c) applies to years after
// 2023-12-31; Notice 2023-62's transition expired 2025-12-31. Delaying
// the mandate to 2027 would leave 2026 catch-up pre-tax for a high earner.
describeRule('irc-414-v-7-A-high-earner-roth-catch-up-mandate', {
  readings: {
    mandateAppliesIn2026: { traditional: 24_500, roth: 8_000 },
    delayMandateTo2027: { traditional: 32_500, roth: 0 },
  },
  accepted: 'mandateAppliesIn2026',
  note: '2026 is statute plus good-faith, not delayed to 2027',
}, ({ accepted, readings }) => {
  it('applies the Roth mandate in 2026 rather than waiting for T.D. 10033 applicability', () => {
    expect(highEarnerRothCatchUpMandated({
      contributionYear: 2026,
      priorCalendarYearFicaWages: FICA_ONE_CENT_OVER,
      wageThreshold: THRESHOLD,
    })).toBe(true)
    const result = allocateEmployerElectiveDeferrals(
      [
        request('traditional', BASE_402G + CATCH_UP_50, FICA_ONE_CENT_OVER, 'trad'),
        request('roth', 0, FICA_ONE_CENT_OVER, 'roth'),
      ],
      limits(CATCH_UP_50),
    )
    expect(result.allowed.get('trad')).toBe(accepted.traditional)
    expect(result.allowed.get('roth')).toBe(accepted.roth)
    expect(result.allowed.get('trad')).not.toBe(readings.delayMandateTo2027.traditional)
  })
})

// ---------------------------------------------------------------------------
// Settled mandate — simulatePlan integration
// ---------------------------------------------------------------------------

describeRule('irc-414-v-7-A-high-earner-roth-catch-up-mandate', {
  readings: {
    iraCatchUpUnchanged: IRA + IRA_CATCH_UP,
    recharacterizeIraCatchUp: IRA,
  },
  accepted: 'iraCatchUpUnchanged',
  note: 'IRA catch-up is not recharacterized',
}, ({ accepted, readings }) => {
  it('does not recharacterize an IRA catch-up when the employer wage test is met', () => {
    // Age 50 in 2026. IRA catch-up is 219(b)(5), not 414(v). Even with
    // prior-year FICA over the threshold on a sibling 401(k), the IRA
    // contribution stays the full 7,500 + 1,100 pre-tax amount.
    const plan = soloPlan('1976-06-15')
    plan.incomes = [wages(200_000)]
    plan.accounts = [
      cash(),
      employer('traditional', BASE_402G, FICA_ONE_CENT_OVER, 'k'),
      traditionalIra(50_000),
    ]
    const year = year2026(plan)
    expect(year.balances[plan.accounts[2]!.id]).toBeCloseTo(accepted, 6)
    expect(year.balances[plan.accounts[2]!.id]).not.toBeCloseTo(readings.recharacterizeIraCatchUp, 6)
  })
})

describe('irc-414-v-7-A ledger integration', () => {
  it('raises MAGI by the catch-up when the wage test forces designated Roth', () => {
    // Independent worksheet (2026 single, wages 200,000, no other income):
    //   pre-tax catch-up allowed: AGI/MAGI = 200,000 − 32,500 = 167,500
    //   catch-up forced Roth:     AGI/MAGI = 200,000 − 24,500 = 175,500
    // The 8,000 difference is the ordinary-income understatement this rule
    // closes. Federal MAGI here is AGI (no tax-exempt interest).
    const plan = soloPlan('1976-06-15')
    plan.incomes = [wages(200_000)]
    plan.accounts = [
      cash(),
      employer('traditional', BASE_402G + CATCH_UP_50, FICA_ONE_CENT_OVER, 'trad'),
      employer('roth', 0, FICA_ONE_CENT_OVER, 'roth'),
    ]
    const result = run2026(plan, createFederalTaxCalculator())
    const year = result.years[0]!
    expect(year.balances.trad).toBeCloseTo(BASE_402G, 6)
    expect(year.balances.roth).toBeCloseTo(CATCH_UP_50, 6)
    expect(year.magi).toBeCloseTo(175_500, 6)
    expect(year.magi).not.toBeCloseTo(167_500, 6)
    expect(result.warnings).not.toContain(IRS_LIMIT_WARNING)
  })

  it('keeps MAGI at the pre-tax-catch-up figure when FICA is exactly 150,000', () => {
    const plan = soloPlan('1976-06-15')
    plan.incomes = [wages(200_000)]
    plan.accounts = [
      cash(),
      employer('traditional', BASE_402G + CATCH_UP_50, FICA_AT_THRESHOLD, 'trad'),
      employer('roth', 0, FICA_AT_THRESHOLD, 'roth'),
    ]
    const year = year2026(plan, createFederalTaxCalculator())
    expect(year.balances.trad).toBeCloseTo(BASE_402G + CATCH_UP_50, 6)
    expect(year.balances.roth).toBeCloseTo(0, 6)
    expect(year.magi).toBeCloseTo(167_500, 6)
  })

  it('does not change regular elective-deferral character below the 402(g) base', () => {
    // A high earner who elects only 20,000 pre-tax (under the 24,500 base)
    // keeps that 20,000 pre-tax. The mandate reaches additional elective
    // deferrals, not the base.
    const plan = soloPlan('1976-06-15')
    plan.incomes = [wages(200_000)]
    plan.accounts = [
      cash(),
      employer('traditional', 20_000, FICA_ONE_CENT_OVER, 'trad'),
      employer('roth', 0, FICA_ONE_CENT_OVER, 'roth'),
    ]
    const year = year2026(plan)
    expect(year.balances.trad).toBeCloseTo(20_000, 6)
    expect(year.balances.roth).toBeCloseTo(0, 6)
  })

  it('still warns when the high earner has no Roth feature and catch-up is refused', () => {
    const plan = soloPlan('1976-06-15')
    plan.incomes = [wages(200_000)]
    plan.accounts = [
      cash(),
      employer('traditional', BASE_402G + CATCH_UP_50, FICA_ONE_CENT_OVER, 'trad'),
    ]
    const result = run2026(plan)
    expect(result.years[0]!.balances.trad).toBeCloseTo(BASE_402G, 6)
    expect(result.warnings).toContain(IRS_LIMIT_WARNING)
  })
})

// IRC 414(v)(3)(A): a paragraph (1) catch-up "shall not ... be subject to"
// 415(c) and "shall not ... be taken into account in applying such
// limitations to other contributions". 414(v)(7) designated Roth catch-up
// is still a paragraph (1) contribution. Wages 30,000 (the 415(c) pay
// prong — current-year compensation, not Box 3), election 32,500, 200%
// match on all pay:
//   statute:            24,500 countable + 8,000 catch-up, 5,500 match left
//   catch-up countable: 24,500 + 5,500 of the Roth catch-up, match 0
describeRule('irc-414-v-3-A-catch-up-excluded-from-415c', {
  readings: {
    catchUpExcludedFromAnnualAdditions: { traditional: 24_500, roth: 8_000, match: 5_500 },
    catchUpConsumesAnnualAdditions: { traditional: 24_500, roth: 5_500, match: 0 },
  },
  accepted: 'catchUpExcludedFromAnnualAdditions',
  note: '414(v) catch-up is not an annual addition',
}, ({ accepted, readings }) => {
  it('lands the full redirected catch-up and leaves leftover 415(c) room for match', () => {
    const plan = soloPlan('1976-06-15')
    plan.incomes = [wages(30_000)]
    const trad = employer('traditional', BASE_402G + CATCH_UP_50, FICA_ONE_CENT_OVER, 'trad')
    if (trad.type !== 'traditional') throw new Error('expected traditional')
    plan.accounts = [
      cash(),
      { ...trad, employerMatch: { matchPct: 200, capPctOfPay: 100 } },
      employer('roth', 0, FICA_ONE_CENT_OVER, 'roth'),
    ]
    const year = year2026(plan)
    expect(year.balances.trad).toBeCloseTo(accepted.traditional + accepted.match, 6)
    expect(year.balances.roth).toBeCloseTo(accepted.roth, 6)
    expect(year.employerMatch).toBeCloseTo(accepted.match, 6)
    expect(year.balances.roth).not.toBeCloseTo(readings.catchUpConsumesAnnualAdditions.roth, 6)
    expect(year.employerMatch).not.toBeCloseTo(readings.catchUpConsumesAnnualAdditions.match, 6)
  })
})

// The same-owner Roth employer account is the plan's qualified Roth feature
// (T.D. 10033 §1.414(v)-2(b)(2)). Redirected catch-up is still an elective
// deferral of that plan, so the source account's match formula applies to the
// combined elective, not only the residual pre-tax base.
//
// Wages 200,000, 100% match on 100% of pay, election 32,500:
//   one plan:     min(32,500, 200,000) × 100% = 32,500
//   two plans:    min(24,500, 200,000) × 100% = 24,500
describeRule('irc-414-v-7-A-high-earner-roth-catch-up-mandate', {
  readings: {
    matchOnFullElective: 32_500,
    matchOnlyResidualPretax: 24_500,
  },
  accepted: 'matchOnFullElective',
  note: 'redirected catch-up stays elective deferral for match',
}, ({ accepted, readings }) => {
  it('applies the source match formula to the redirected catch-up', () => {
    const plan = soloPlan('1976-06-15')
    plan.incomes = [wages(200_000)]
    const trad = employer('traditional', BASE_402G + CATCH_UP_50, FICA_ONE_CENT_OVER, 'trad')
    if (trad.type !== 'traditional') throw new Error('expected traditional')
    plan.accounts = [
      cash(),
      { ...trad, employerMatch: { matchPct: 100, capPctOfPay: 100 } },
      employer('roth', 0, FICA_ONE_CENT_OVER, 'roth'),
    ]
    const year = year2026(plan)
    expect(year.employerMatch).toBeCloseTo(accepted, 6)
    expect(year.employerMatch).not.toBeCloseTo(readings.matchOnlyResidualPretax, 6)
    expect(year.balances.roth).toBeCloseTo(CATCH_UP_50, 6)
    expect(year.balances.trad).toBeCloseTo(BASE_402G + accepted, 6)
  })
})

describe('employerMatchElectiveBase', () => {
  it('adds redirected catch-up to the source and removes it from the Roth sibling', () => {
    const allocated = new Map([['trad', 24_500], ['roth', 8_000]])
    const landed = new Map([['trad', 24_500], ['roth', 8_000]])
    const redirected = new Map([['trad', 8_000]])
    expect(employerMatchElectiveBase({
      accountId: 'trad',
      employeeLandedByAccountId: landed,
      allocatedByAccountId: allocated,
      redirectedCatchUpBySource: redirected,
      catchUpRothAccountId: 'roth',
    })).toBe(32_500)
    expect(employerMatchElectiveBase({
      accountId: 'roth',
      employeeLandedByAccountId: landed,
      allocatedByAccountId: allocated,
      redirectedCatchUpBySource: redirected,
      catchUpRothAccountId: 'roth',
    })).toBe(0)
  })
})
