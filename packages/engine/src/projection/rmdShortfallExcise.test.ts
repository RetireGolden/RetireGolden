import { describe, expect, it } from 'vitest'
import type { Account, Plan } from '../model/plan.js'
import { parsePlan } from '../model/plan.js'
import {
  rmdShortfallObligationId,
  type RmdApplicablePlan,
} from '../rmd/rmdShortfallExcise.js'
import { describeRule } from '../rules/describeRule.js'
import {
  cashAccount,
  singlePersonPlan,
  traditionalAccount,
} from '../testing/planFixtures.js'
import { createFlatTaxCalculator } from './flatTax.js'
import { simulatePlan, type SimulateOptions } from './simulate.js'

const noTax = createFlatTaxCalculator(0)
const OWNER_DOB = '1953-01-01'
const START_BALANCE = 500_000
const FIRST_YEAR_AMOUNT = START_BALANCE / 26.5
const SECOND_YEAR_AMOUNT = START_BALANCE / 25.5
const OWNER_IRAS: RmdApplicablePlan = {
  kind: 'ownedTraditionalIras',
  payeePersonId: 'p1',
}

function qualifiedAnnuity(
  fundingAccountId: string,
  premium: number,
  year = 2026,
): Account {
  return {
    type: 'annuity',
    id: `annuity-${fundingAccountId}-${year}`,
    name: 'Qualified annuity',
    ownerPersonId: 'p1',
    annualReturnPct: 0,
    startAge: year === 2026 ? 73 : 74,
    monthlyAmount: 0,
    colaPct: 0,
    taxablePct: 100,
    purchase: {
      year,
      premium,
      fundingAccountId,
      taxQualification: 'qualified',
    },
  }
}

function run(plan: Plan, options: Partial<SimulateOptions> = {}) {
  const parsed = parsePlan(plan)
  expect(parsed.ok, parsed.ok ? '' : parsed.issues.join('\n')).toBe(true)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return simulatePlan(parsed.plan, {
    startYear: 2026,
    taxCalculator: noTax,
    ...options,
  })
}

function wholeMissPlan(purchaseYear = 2026): Plan {
  const plan = singlePersonPlan({ dob: OWNER_DOB, planningAge: 95 })
  plan.accounts = [
    cashAccount('cash', 100_000),
    traditionalAccount('ira', START_BALANCE),
    qualifiedAnnuity('ira', START_BALANCE, purchaseYear),
  ]
  return plan
}

describe('§4974 integration in the annual ledger', () => {
  it('charges 25 percent of a partial shortfall and keeps the excise out of tax and MAGI', () => {
    // Independent worksheet (IRC §4974(a)):
    // required = 500,000 / 26.5 = 18,867.924528...
    // annuity premium leaves 8,000 available and timely distributed
    // shortfall = 10,867.924528...; excise = 25% = 2,716.981132...
    const plan = singlePersonPlan({ dob: OWNER_DOB, planningAge: 95 })
    plan.accounts = [
      traditionalAccount('ira', START_BALANCE),
      qualifiedAnnuity('ira', 492_000),
    ]

    const first = run(plan).years[0]!
    expect(first.rmd).toBeCloseTo(8_000, 8)
    expect(first.rmdShortfallExciseTax).toBeCloseTo((FIRST_YEAR_AMOUNT - 8_000) * 0.25, 8)
    expect(first.penalties).toBeCloseTo((FIRST_YEAR_AMOUNT - 8_000) * 0.25, 8)
    expect(first.tax).toBe(0)
    expect(first.magi).toBeCloseTo(8_000, 8)
  })

  it('integrates an explicit 10 percent correction election without inventing income', () => {
    const obligationId = rmdShortfallObligationId(OWNER_IRAS, 2026)
    const first = run(wholeMissPlan(), {
      rmdShortfallReliefElections: [{
        obligationId,
        correctiveDistribution: {
          amount: FIRST_YEAR_AMOUNT,
          receivedOn: '2027-03-01',
          sourceApplicablePlan: OWNER_IRAS,
          form5329FiledOn: '2027-04-15',
          returnReflectsReducedTax: true,
        },
      }],
    }).years[0]!

    expect(first.rmdShortfallExciseTax).toBeCloseTo(FIRST_YEAR_AMOUNT * 0.10, 8)
    expect(first.penalties).toBeCloseTo(FIRST_YEAR_AMOUNT * 0.10, 8)
    // Relief evidence prices Form 5329 only; it cannot synthesize a future
    // account movement or ordinary income into this year.
    expect(first.magi).toBe(0)
  })

  it('does not default a requested or denied reasonable-error waiver to zero', () => {
    const obligationId = rmdShortfallObligationId(OWNER_IRAS, 2026)
    for (const discretionaryWaiver of ['requested', 'denied'] as const) {
      const first = run(wholeMissPlan(), {
        rmdShortfallReliefElections: [{ obligationId, discretionaryWaiver }],
      }).years[0]!
      expect(first.penalties).toBeCloseTo(FIRST_YEAR_AMOUNT * 0.25, 8)
    }
    const granted = run(wholeMissPlan(), {
      rmdShortfallReliefElections: [{
        obligationId,
        discretionaryWaiver: 'granted',
      }],
    }).years[0]!
    expect(granted.penalties).toBe(0)
  })
})

describeRule('irc-4974-rmd-shortfall-excise-tax', {
  readings: {
    regulationTaxesNeitherAmountIn2026AndBothMissesIn2027: {
      tax2026: 0,
      tax2027: (FIRST_YEAR_AMOUNT + SECOND_YEAR_AMOUNT) * 0.25,
    },
    rejectedAttainmentYearExciseOnTheDeferredAmount: {
      tax2026: FIRST_YEAR_AMOUNT * 0.25,
      tax2027: SECOND_YEAR_AMOUNT * 0.25,
    },
  },
  accepted: 'regulationTaxesNeitherAmountIn2026AndBothMissesIn2027',
  note: 'April 1 excise in the RBD year',
}, ({ accepted, readings }) => {
  it('books a missed deferred first amount in the RBD year beside the separate current RMD', () => {
    // Treas. Reg. §54.4974-1(f), 1953 owner:
    // 2026 amount = 500,000 / 26.5, due 2027-04-01 after election.
    // 2027 amount = 500,000 / 25.5, due 2027-12-31.
    // The 2027 annuity purchase empties the IRA before either deadline's
    // distribution block, so both shortfalls are taxed in 2027.
    const result = run(wholeMissPlan(2027), {
      rmdFirstYearDeferrals: [{
        distributionCalendarYear: 2026,
        applicablePlan: OWNER_IRAS,
      }],
    })
    const y2026 = result.years.find((year) => year.year === 2026)!
    const y2027 = result.years.find((year) => year.year === 2027)!

    expect(y2026.rmd).toBe(0)
    expect(y2026.rmdShortfallExciseTax).toBe(accepted.tax2026)
    expect(y2026.rmdShortfallExciseTax).not.toBeCloseTo(
      readings.rejectedAttainmentYearExciseOnTheDeferredAmount.tax2026,
      8,
    )
    expect(y2027.rmd).toBe(0)
    expect(y2027.rmdShortfallExciseTax).toBeCloseTo(accepted.tax2027, 8)
    expect(y2027.rmdShortfallExciseDetails?.map((detail) => ({
      distributionCalendarYear: detail.distributionCalendarYear,
      taxYear: detail.taxYear,
    }))).toEqual([
      { distributionCalendarYear: 2026, taxYear: 2027 },
      { distributionCalendarYear: 2027, taxYear: 2027 },
    ])
  })
})

describe('applicable-plan boundaries and Roth scope', () => {
  it('does not cure an employer-plan shortfall from an IRA', () => {
    const plan = singlePersonPlan({ dob: OWNER_DOB, planningAge: 95 })
    const employer = traditionalAccount('employer', 100_000, 'p1', 'employer')
    if (employer.type !== 'traditional') throw new Error('fixture account mismatch')
    employer.employerPlanType = '401k'
    plan.accounts = [
      employer,
      traditionalAccount('ira', START_BALANCE),
      qualifiedAnnuity('employer', 100_000),
    ]

    const first = run(plan).years[0]!
    expect(first.rmd).toBeCloseTo(FIRST_YEAR_AMOUNT, 8)
    expect(first.rmdShortfallExciseTax).toBeCloseTo((100_000 / 26.5) * 0.25, 8)
  })

  it('sweeps an explicit 403(b) shortfall across the owner’s other 403(b)', () => {
    const plan = singlePersonPlan({ dob: OWNER_DOB, planningAge: 95 })
    const first403b = traditionalAccount('403b-a', 100_000, 'p1', 'employer')
    const second403b = traditionalAccount('403b-b', START_BALANCE, 'p1', 'employer')
    if (first403b.type !== 'traditional' || second403b.type !== 'traditional') {
      throw new Error('fixture account mismatch')
    }
    first403b.employerPlanType = '403b'
    second403b.employerPlanType = '403b'
    plan.accounts = [
      first403b,
      second403b,
      qualifiedAnnuity('403b-a', 100_000),
    ]

    const first = run(plan).years[0]!
    expect(first.rmd).toBeCloseTo(600_000 / 26.5, 8)
    expect(first.rmdShortfallExciseTax).toBe(0)
  })

  it('never creates a lifetime §4974 obligation for a living Roth IRA owner', () => {
    const plan = singlePersonPlan({ dob: OWNER_DOB, planningAge: 95 })
    plan.accounts = [{
      type: 'roth',
      kind: 'ira',
      id: 'roth',
      name: 'Roth IRA',
      ownerPersonId: 'p1',
      annualReturnPct: 0,
      balance: START_BALANCE,
      annualContribution: 0,
    }]

    const first = run(plan).years[0]!
    expect(first.rmd).toBe(0)
    expect(first.rmdShortfallExciseDetails).toEqual([])
    expect(first.penalties).toBe(0)
  })

  it('taxes an inherited Roth residue in the emptying year and every later year', () => {
    const plan = singlePersonPlan({ dob: '1980-06-15', planningAge: 60 })
    plan.household.people[0]!.id = 'beneficiary'
    plan.accounts = [{
      type: 'roth',
      kind: 'ira',
      id: 'inherited-roth',
      name: 'Inherited Roth IRA',
      ownerPersonId: 'beneficiary',
      annualReturnPct: 0,
      balance: 0.004,
      annualContribution: 0,
      inherited: {
        decedentId: 'decedent',
        ownerDeathYear: 2022,
        decedentHadStartedRmds: false,
        beneficiary: {
          beneficiaryClass: 'designated-individual',
          edbCategory: 'none',
          beneficiaryBirthYear: 1980,
          soleBeneficiary: true,
          ownerBirthYear: 1970,
          roth5YearStartYear: 2010,
          provenance: { source: 'test fixture', asOf: '2026-01-01' },
        },
      },
    }]

    const result = run(plan, { horizonEndYear: 2033 })
    for (const calendarYear of [2032, 2033]) {
      const year = result.years.find((candidate) => candidate.year === calendarYear)!
      expect(year.inheritedAccounts?.[0]?.requirementKind).toBe('final-sweep')
      expect(year.inheritedAccounts?.[0]?.requiredAmount).toBeCloseTo(0.004, 12)
      expect(year.inheritedDistribution).toBe(0)
      expect(year.rmdShortfallExciseTax).toBeCloseTo(0.001, 12)
    }
  })
})
