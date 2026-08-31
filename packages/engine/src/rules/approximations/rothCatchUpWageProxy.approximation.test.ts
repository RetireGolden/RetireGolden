import { expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Account, type IncomeStream, type Plan } from '../../model/plan.js'
import { packForYear } from '../../params/index.js'
import { createFlatTaxCalculator } from '../../testing/flatTax.js'
import { simulatePlan } from '../../projection/simulate.js'
import { describeRule } from '../describeRule.js'

const pack2026 = packForYear(2026).pack
const BASE_402G = pack2026.contributionLimits.employee401k
const CATCH_UP_50 = pack2026.contributionLimits.catchUp50

let counter = 0
const testIds = (): string => `fica-proxy-${++counter}`
const fixedNow = (): Date => new Date('2026-01-01T00:00:00.000Z')
const noTax = createFlatTaxCalculator(0)

function plan(): Plan {
  const raw = createEmptyPlan({ newId: testIds, now: fixedNow })
  raw.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1976-06-15', // 50 in 2026
    sex: 'average',
    retirementAge: 70,
    longevity: { planningAge: 90, source: 'manual' },
  }
  raw.assumptions.inflationPct = 0
  raw.assumptions.defaultReturnPct = 0
  raw.expenses.baseAnnual = 0
  const wages: IncomeStream = {
    type: 'wages',
    id: testIds(),
    personId: 'p1',
    annualGross: 200_000,
    endAge: null,
    realGrowthPct: 0,
  }
  const trad: Account = {
    type: 'traditional',
    id: 'trad',
    name: '401k',
    ownerPersonId: 'p1',
    annualReturnPct: 0,
    kind: 'employer',
    balance: 0,
    annualContribution: BASE_402G + CATCH_UP_50,
    // Field omitted: parse defaults it to 0.
  }
  const roth: Account = {
    type: 'roth',
    id: 'roth',
    name: 'Roth 401k',
    ownerPersonId: 'p1',
    annualReturnPct: 0,
    kind: 'employer',
    balance: 0,
    annualContribution: 0,
  }
  raw.incomes = [wages]
  raw.accounts = [
    {
      type: 'cash',
      id: testIds(),
      name: 'Cash',
      ownerPersonId: null,
      annualReturnPct: 0,
      balance: 1_000_000,
      annualContribution: 0,
    },
    trad,
    roth,
  ]
  const parsed = parsePlan(raw)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

// If the omitted Box 3 were the 200,000 of current-year wages, 414(v)(7)(A)
// would Roth-mandate the 8,000 catch-up. The engine does not invent that
// Box 3 from wages, MAGI, or the HCE test; omitted defaults to 0 and the
// catch-up stays pre-tax. That is the understatement this record pins.
describeRule('irc-414-v-7-A-prior-year-fica-wage-proxy', {
  readings: {
    statuteIfOmittedBox3WereCurrentWages: { traditional: 24_500, roth: 8_000 },
    omittedFieldTreatedAsZero: { traditional: 32_500, roth: 0 },
  },
  accepted: 'statuteIfOmittedBox3WereCurrentWages',
  produced: 'omittedFieldTreatedAsZero',
  note: 'omitted prior-year FICA fails closed to not subject',
}, ({ accepted, produced }) => {
  it('does not infer Box 3 from current-year wages when the field is omitted', () => {
    const year = simulatePlan(plan(), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: noTax,
    }).years[0]!
    expect(year.balances.trad).toBeCloseTo(produced.traditional, 6)
    expect(year.balances.roth).toBeCloseTo(produced.roth, 6)
    expect(year.balances.trad).not.toBeCloseTo(accepted.traditional, 6)
    expect(year.balances.roth).not.toBeCloseTo(accepted.roth, 6)
  })
})
