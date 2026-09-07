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
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { simulatePlan, type SimulateOptions } from './simulate.js'

const noTax = createFlatTaxCalculator(0)
const FIRST_YEAR_OWNER_DOB = '1953-01-01'
const GENERIC_OWNER_DOB = '1952-01-01'
const START_BALANCE = 500_000
const FIRST_YEAR_AMOUNT = START_BALANCE / 26.5
const SECOND_YEAR_AMOUNT = START_BALANCE / 25.5
const GENERIC_RMD_AMOUNT = START_BALANCE / 25.5
const PARTIAL_PAYMENT = 8_000
const WHOLE_MISS_TAX_2027 = FIRST_YEAR_AMOUNT * 0.25
const PARTIAL_MISS_SHORTFALL = FIRST_YEAR_AMOUNT - PARTIAL_PAYMENT
const PARTIAL_MISS_TAX_2027 = PARTIAL_MISS_SHORTFALL * 0.25
const PARTIAL_MISS_CORRECTED_TAX = PARTIAL_MISS_SHORTFALL * 0.10
const REJECTED_FIRST_YEAR_TAX_2026 = FIRST_YEAR_AMOUNT * 0.25
const GENERIC_WHOLE_MISS_TAX = GENERIC_RMD_AMOUNT * 0.25
const GENERIC_PARTIAL_MISS_TAX = (GENERIC_RMD_AMOUNT - PARTIAL_PAYMENT) * 0.25
const GENERIC_CORRECTED_TAX = GENERIC_RMD_AMOUNT * 0.10
const EMPLOYER_100K_MISS_TAX = (100_000 / 25.5) * 0.25
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

function wholeMissPlan(purchaseYear = 2026, dob = FIRST_YEAR_OWNER_DOB): Plan {
  const plan = singlePersonPlan({ dob, planningAge: 95 })
  plan.accounts = [
    cashAccount('cash', 100_000),
    traditionalAccount('ira', START_BALANCE),
    qualifiedAnnuity('ira', START_BALANCE, purchaseYear),
  ]
  return plan
}

function genericWholeMissPlan(): Plan {
  return wholeMissPlan(2026, GENERIC_OWNER_DOB)
}

function partialMissPlan(dob = FIRST_YEAR_OWNER_DOB): Plan {
  const plan = singlePersonPlan({ dob, planningAge: 95 })
  plan.accounts = [
    cashAccount('cash', 100_000),
    traditionalAccount('ira', START_BALANCE),
    qualifiedAnnuity('ira', 492_000),
  ]
  return plan
}

function firstYearExciseDetail(year: number) {
  return (result: ReturnType<typeof run>) =>
    result.years.find((row) => row.year === year)?.rmdShortfallExciseDetails ?? []
}

function rejectsAttainmentYearExcise(
  details: NonNullable<ReturnType<typeof run>['years'][number]['rmdShortfallExciseDetails']>,
) {
  expect(details.some(
    (detail) => detail.distributionCalendarYear === 2026 && detail.taxYear === 2026,
  )).toBe(false)
  expect(details.some(
    (detail) => detail.obligationId.endsWith(':tax-2026'),
  )).toBe(false)
}

describe('§4974 integration in the annual ledger', () => {
  it('charges 25 percent of a partial shortfall and keeps the excise out of tax and MAGI', () => {
    // Independent worksheet (IRC §4974(a)), 1952 owner age 74 in 2026:
    // required = 500,000 / 25.5 = 19,607.843137...
    // annuity premium leaves 8,000 available and timely distributed
    // shortfall = 11,607.843137...; excise = 25% = 2,901.960784...
    const plan = singlePersonPlan({ dob: GENERIC_OWNER_DOB, planningAge: 95 })
    plan.accounts = [
      traditionalAccount('ira', START_BALANCE),
      qualifiedAnnuity('ira', 492_000),
    ]

    const first = run(plan).years[0]!
    expect(first.rmd).toBeCloseTo(PARTIAL_PAYMENT, 8)
    expect(first.rmdShortfallExciseTax).toBeCloseTo(GENERIC_PARTIAL_MISS_TAX, 8)
    expect(first.penalties).toBeCloseTo(GENERIC_PARTIAL_MISS_TAX, 8)
    expect(first.tax).toBe(0)
    expect(first.magi).toBeCloseTo(PARTIAL_PAYMENT, 8)
  })

  it('integrates an explicit 10 percent correction election without inventing income', () => {
    const obligationId = rmdShortfallObligationId(OWNER_IRAS, 2026)
    const first = run(genericWholeMissPlan(), {
      rmdShortfallReliefElections: [{
        obligationId,
        correctiveDistribution: {
          amount: GENERIC_RMD_AMOUNT,
          receivedOn: '2027-03-01',
          sourceApplicablePlan: OWNER_IRAS,
          form5329FiledOn: '2027-04-15',
          returnReflectsReducedTax: true,
        },
      }],
    }).years[0]!

    expect(first.rmdShortfallExciseTax).toBeCloseTo(GENERIC_CORRECTED_TAX, 8)
    expect(first.penalties).toBeCloseTo(GENERIC_CORRECTED_TAX, 8)
    // Relief evidence prices Form 5329 only; it cannot synthesize a future
    // account movement or ordinary income into this year.
    expect(first.magi).toBe(0)
  })

  it('does not default a requested or denied reasonable-error waiver to zero', () => {
    const obligationId = rmdShortfallObligationId(OWNER_IRAS, 2026)
    for (const discretionaryWaiver of ['requested', 'denied'] as const) {
      const first = run(genericWholeMissPlan(), {
        rmdShortfallReliefElections: [{ obligationId, discretionaryWaiver }],
      }).years[0]!
      expect(first.penalties).toBeCloseTo(GENERIC_WHOLE_MISS_TAX, 8)
    }
    const granted = run(genericWholeMissPlan(), {
      rmdShortfallReliefElections: [{
        obligationId,
        discretionaryWaiver: 'granted',
      }],
    }).years[0]!
    expect(granted.penalties).toBe(0)
  })

  it('applies §4974 relief only to the April-deadline obligation id for a default first-year partial miss', () => {
    // Independent worksheet (IRC §4974(a)), 1953 owner age 73 in 2026:
    // required = 500,000 / 26.5 = 18,867.924528...
    // timely distributed in 2026 = 8,000; shortfall = 10,867.924528...
    const correctId = rmdShortfallObligationId(OWNER_IRAS, 2026, 2027)
    const oldId = rmdShortfallObligationId(OWNER_IRAS, 2026)
    const correction = {
      amount: PARTIAL_MISS_SHORTFALL,
      receivedOn: '2027-05-01',
      sourceApplicablePlan: OWNER_IRAS,
      form5329FiledOn: '2028-04-15',
      returnReflectsReducedTax: true,
    }

    const base = run(partialMissPlan(), { horizonEndYear: 2027 })
    const partial2026 = base.years.find((year) => year.year === 2026)!
    const partial2027 = base.years.find((year) => year.year === 2027)!
    expect(partial2026.rmd).toBeCloseTo(PARTIAL_PAYMENT, 8)
    expect(partial2026.magi).toBeCloseTo(PARTIAL_PAYMENT, 8)
    expect(partial2026.rmdShortfallExciseTax).toBe(0)
    expect(partial2027.magi).toBe(0)
    expect(partial2027.rmdShortfallExciseDetails).toEqual([expect.objectContaining({
      obligationId: correctId,
      distributionCalendarYear: 2026,
      taxYear: 2027,
      distributedByDeadline: PARTIAL_PAYMENT,
      shortfall: PARTIAL_MISS_SHORTFALL,
      rate: 0.25,
      tax: PARTIAL_MISS_TAX_2027,
      reason: 'default25Percent',
    })])

    const corrected = run(partialMissPlan(), {
      horizonEndYear: 2027,
      rmdShortfallReliefElections: [{ obligationId: correctId, correctiveDistribution: correction }],
    }).years.find((year) => year.year === 2027)!
    expect(corrected.rmdShortfallExciseTax).toBeCloseTo(PARTIAL_MISS_CORRECTED_TAX, 8)
    expect(corrected.rmdShortfallExciseDetails?.[0]).toMatchObject({
      rate: 0.10,
      reason: 'corrected10Percent',
    })
    expect(corrected.magi).toBe(0)

    const waived = run(partialMissPlan(), {
      horizonEndYear: 2027,
      rmdShortfallReliefElections: [{ obligationId: correctId, discretionaryWaiver: 'granted' }],
    }).years.find((year) => year.year === 2027)!
    expect(waived.rmdShortfallExciseTax).toBe(0)
    expect(waived.rmdShortfallExciseDetails?.[0]).toMatchObject({
      rate: 0,
      reason: 'discretionaryWaiverGranted',
      tax: 0,
    })

    const mismatched = run(partialMissPlan(), {
      horizonEndYear: 2027,
      rmdShortfallReliefElections: [{ obligationId: oldId, correctiveDistribution: correction }],
    }).years.find((year) => year.year === 2027)!
    expect(mismatched.rmdShortfallExciseTax).toBeCloseTo(PARTIAL_MISS_TAX_2027, 8)
    expect(mismatched.rmdShortfallExciseDetails?.[0]).toMatchObject({
      rate: 0.25,
      reason: 'default25Percent',
    })
  })
})

describeRule('treas-reg-54-4974-1-f-first-year-rbd-excise-tax', {
  readings: {
    regulationTaxesFirstYearMissInDeadlineYearNotAttainmentYear: {
      tax2026: 0,
    },
    rejectedAttainmentYearExciseOnTheDeferredAmount: {
      tax2026: REJECTED_FIRST_YEAR_TAX_2026,
    },
  },
  accepted: 'regulationTaxesFirstYearMissInDeadlineYearNotAttainmentYear',
  note: 'April 1 excise in the deadline year',
}, ({ accepted, readings }) => {
  it('covers explicit deferral, no-option whole/partial miss, and rejects attainment-year excise', () => {
    // Treas. Reg. §54.4974-1(f) / former §54.4974-2 Q&A-6, 1953 owner:
    // first distribution calendar year amount = 500,000 / 26.5 = 18,867.924528...
    // §4974 = 25% of shortfall, imposed in the calendar year containing April 1.
    // Default, elected, whole, and partial blocks below are scenario coordinates for
    // one regulation vector — not competing statutory readings.

    // Explicit full deferral control: unchanged zero tax in 2026; both amounts in 2027 if unpaid.
    const explicitDeferral = run(wholeMissPlan(2027), {
      rmdFirstYearDeferrals: [{
        distributionCalendarYear: 2026,
        applicablePlan: OWNER_IRAS,
      }],
    })
    const explicit2026 = explicitDeferral.years.find((year) => year.year === 2026)!
    const explicit2027 = explicitDeferral.years.find((year) => year.year === 2027)!
    expect(explicit2026.rmd).toBe(0)
    expect(explicit2027.rmd).toBe(0)
    expect(explicit2026.rmdShortfallExciseTax).toBe(accepted.tax2026)
    expect(explicit2026.rmdShortfallExciseTax).not.toBeCloseTo(
      readings.rejectedAttainmentYearExciseOnTheDeferredAmount.tax2026,
      8,
    )
    expect(explicit2027.rmdShortfallExciseTax).toBeCloseTo(
      (FIRST_YEAR_AMOUNT + SECOND_YEAR_AMOUNT) * 0.25,
      8,
    )
    expect(explicit2027.rmdShortfallExciseDetails?.map((detail) => ({
      distributionCalendarYear: detail.distributionCalendarYear,
      taxYear: detail.taxYear,
    }))).toEqual([
      { distributionCalendarYear: 2026, taxYear: 2027 },
      { distributionCalendarYear: 2027, taxYear: 2027 },
    ])
    rejectsAttainmentYearExcise(firstYearExciseDetail(2026)(explicitDeferral))

    // No-option whole miss: zero in 2026; 500,000 / 26.5 × 25% = 4,716.981132075472 in 2027.
    const wholeMiss = run(wholeMissPlan())
    const whole2026 = wholeMiss.years.find((year) => year.year === 2026)!
    const whole2027 = wholeMiss.years.find((year) => year.year === 2027)!
    expect(whole2026.rmdShortfallExciseTax).toBe(accepted.tax2026)
    expect(whole2026.rmdShortfallExciseTax).not.toBeCloseTo(
      readings.rejectedAttainmentYearExciseOnTheDeferredAmount.tax2026,
      8,
    )
    expect(whole2027.rmdShortfallExciseTax).toBeCloseTo(WHOLE_MISS_TAX_2027, 8)
    expect(whole2027.rmdShortfallExciseDetails).toEqual([expect.objectContaining({
      distributionCalendarYear: 2026,
      taxYear: 2027,
      requiredAmount: FIRST_YEAR_AMOUNT,
      distributedByDeadline: 0,
      shortfall: FIRST_YEAR_AMOUNT,
      tax: WHOLE_MISS_TAX_2027,
      reason: 'default25Percent',
    })])
    rejectsAttainmentYearExcise(firstYearExciseDetail(2026)(wholeMiss))

    // No-option partial payment: $8,000 paid in 2026, zero 2026 tax, then
    // (500,000 / 26.5 - 8,000) × 25% = 2,716.9811320754715 in 2027.
    const partialMiss = run(partialMissPlan())
    const partial2026 = partialMiss.years.find((year) => year.year === 2026)!
    const partial2027 = partialMiss.years.find((year) => year.year === 2027)!
    expect(partial2026.rmd).toBeCloseTo(PARTIAL_PAYMENT, 8)
    expect(partial2026.rmdShortfallExciseTax).toBe(accepted.tax2026)
    expect(partial2026.rmdShortfallExciseTax).not.toBeCloseTo(
      (FIRST_YEAR_AMOUNT - PARTIAL_PAYMENT) * 0.25,
      8,
    )
    expect(partial2027.rmdShortfallExciseTax).toBeCloseTo(PARTIAL_MISS_TAX_2027, 8)
    expect(partial2027.rmdShortfallExciseDetails).toEqual([expect.objectContaining({
      distributionCalendarYear: 2026,
      taxYear: 2027,
      requiredAmount: FIRST_YEAR_AMOUNT,
      distributedByDeadline: PARTIAL_PAYMENT,
      shortfall: FIRST_YEAR_AMOUNT - PARTIAL_PAYMENT,
      tax: PARTIAL_MISS_TAX_2027,
      reason: 'default25Percent',
    })])
    rejectsAttainmentYearExcise(firstYearExciseDetail(2026)(partialMiss))
  })
})

describe('first-year deferral boundary', () => {
  it.each(['manual', 'optimized'] as const)(
    'reserves the deferred amount from an aggregate %s Roth conversion',
    (mode) => {
      const plan = singlePersonPlan({ dob: FIRST_YEAR_OWNER_DOB, planningAge: 95 })
      plan.accounts = [
        traditionalAccount('ira', START_BALANCE),
        {
          type: 'roth',
          kind: 'ira',
          id: 'roth',
          name: 'Roth IRA',
          ownerPersonId: 'p1',
          annualReturnPct: 0,
          balance: 0,
          annualContribution: 0,
        },
      ]
      plan.strategies.rothConversion = mode === 'manual'
        ? { mode, conversions: [{ year: 2026, amount: START_BALANCE }] }
        : {
            mode,
            conversions: [{ year: 2026, amount: START_BALANCE }],
            optimizedAtIso: '2026-01-01T00:00:00.000Z',
          }

      const first = run(plan, {
        horizonEndYear: 2026,
        rmdFirstYearDeferrals: [{
          distributionCalendarYear: 2026,
          applicablePlan: OWNER_IRAS,
        }],
      }).years[0]!

      expect(first.rmd).toBe(0)
      expect(first.rothConversion).toBeCloseTo(START_BALANCE - FIRST_YEAR_AMOUNT, 8)
      expect(first.aggregateRothConversionAllocationBalances?.['ira'])
        .toBeCloseTo(START_BALANCE - FIRST_YEAR_AMOUNT, 8)
      expect(first.rmdShortfallExciseTax).toBe(0)
    },
  )

  it('refuses a deferral whose distribution year predates the projection horizon', () => {
    expect(() => run(wholeMissPlan(2027), {
      startYear: 2027,
      rmdFirstYearDeferrals: [{
        distributionCalendarYear: 2026,
        applicablePlan: OWNER_IRAS,
      }],
    })).toThrow(/cannot begin before the projection horizon/u)
  })
})

describe('applicable-plan boundaries and Roth scope', () => {
  it('does not cure an employer-plan shortfall from an IRA', () => {
    const plan = singlePersonPlan({ dob: GENERIC_OWNER_DOB, planningAge: 95 })
    const employer = traditionalAccount('employer', 100_000, 'p1', 'employer')
    if (employer.type !== 'traditional') throw new Error('fixture account mismatch')
    employer.employerPlanType = '401k'
    plan.accounts = [
      employer,
      traditionalAccount('ira', START_BALANCE),
      qualifiedAnnuity('employer', 100_000),
    ]

    const first = run(plan).years[0]!
    expect(first.rmd).toBeCloseTo(GENERIC_RMD_AMOUNT, 8)
    expect(first.rmdShortfallExciseTax).toBeCloseTo(EMPLOYER_100K_MISS_TAX, 8)
  })

  it('sweeps an explicit 403(b) shortfall across the owner’s other 403(b)', () => {
    const plan = singlePersonPlan({ dob: GENERIC_OWNER_DOB, planningAge: 95 })
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
    expect(first.rmd).toBeCloseTo(600_000 / 25.5, 8)
    expect(first.rmdShortfallExciseTax).toBe(0)
  })

  describeRule('irc-408A-c-4-roth-ira-no-lifetime-rmd', {
    readings: {
      statuteExemptsTheLivingRothIraOwner: 0,
      rejectedUniformLifetimeRmdForTheRothIra: START_BALANCE / 26.5,
    },
    accepted: 'statuteExemptsTheLivingRothIraOwner',
    note: 'living Roth IRA owner past the ordinary RMD age',
  }, ({ accepted, readings }) => {
    it('never creates a lifetime §4974 obligation for a living Roth IRA owner', () => {
      const plan = singlePersonPlan({ dob: FIRST_YEAR_OWNER_DOB, planningAge: 95 })
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
      expect(first.rmd).toBe(accepted)
      expect(first.rmd).not.toBe(readings.rejectedUniformLifetimeRmdForTheRothIra)
      expect(first.rmdShortfallExciseDetails).toEqual([])
      expect(first.penalties).toBe(0)
    })
  })

  describeRule('irc-402A-d-5-designated-roth-account-no-lifetime-rmd', {
    readings: {
      statuteExemptsTheLivingDesignatedRothOwner: 0,
      rejectedUniformLifetimeRmdForTheDesignatedRothAccount: START_BALANCE / 26.5,
    },
    accepted: 'statuteExemptsTheLivingDesignatedRothOwner',
    note: 'living designated Roth employer-account owner past the ordinary RMD age',
  }, ({ accepted, readings }) => {
    it('never creates a lifetime §4974 obligation for a living designated Roth account owner', () => {
      const plan = singlePersonPlan({ dob: FIRST_YEAR_OWNER_DOB, planningAge: 95 })
      plan.accounts = [{
        type: 'roth',
        kind: 'employer',
        id: 'roth-401k',
        name: 'Designated Roth 401(k)',
        ownerPersonId: 'p1',
        annualReturnPct: 0,
        balance: START_BALANCE,
        annualContribution: 0,
      }]

      const first = run(plan).years[0]!
      expect(first.rmd).toBe(accepted)
      expect(first.rmd).not.toBe(readings.rejectedUniformLifetimeRmdForTheDesignatedRothAccount)
      expect(first.rmdShortfallExciseDetails).toEqual([])
      expect(first.penalties).toBe(0)
    })
  })

  it('retains an inherited Roth residue that rounds to zero ledger cents as a shortfall', () => {
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
      expect(year.rmdShortfallExciseDetails).toEqual([expect.objectContaining({
        requiredAmount: 0.004,
        distributedByDeadline: 0,
        shortfall: 0.004,
        rate: 0.25,
        tax: 0.001,
        reason: 'default25Percent',
      })])
      expect(year.rmdShortfallExciseTax).toBe(0.001)
    }
  })

  it('keeps traditional and Roth inherited IRAs from the same decedent in separate §4974 pools', () => {
    const plan = singlePersonPlan({ dob: '1980-06-15', planningAge: 60 })
    plan.household.people[0]!.id = 'beneficiary'
    const beneficiary = {
      beneficiaryClass: 'designated-individual' as const,
      edbCategory: 'none' as const,
      beneficiaryBirthYear: 1980,
      soleBeneficiary: true,
      ownerBirthYear: 1970,
      provenance: { source: 'test fixture', asOf: '2026-01-01' },
    }
    plan.accounts = [
      {
        type: 'traditional',
        kind: 'ira',
        id: 'inherited-traditional',
        name: 'Inherited traditional IRA',
        ownerPersonId: 'beneficiary',
        annualReturnPct: 0,
        balance: 0.004,
        annualContribution: 0,
        inherited: {
          decedentId: 'decedent',
          ownerDeathYear: 2022,
          decedentHadStartedRmds: false,
          beneficiary,
        },
      },
      {
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
          beneficiary: { ...beneficiary, roth5YearStartYear: 2010 },
        },
      },
    ]
    const traditionalPool: RmdApplicablePlan = {
      kind: 'inheritedIras',
      payeePersonId: 'beneficiary',
      decedentId: 'decedent',
      iraType: 'traditional',
    }
    const obligationId = rmdShortfallObligationId(traditionalPool, 2032)

    const result = run(plan, {
      horizonEndYear: 2032,
      rmdShortfallReliefElections: [{
        obligationId,
        correctiveDistribution: {
          amount: 0.004,
          receivedOn: '2033-03-01',
          sourceApplicablePlan: traditionalPool,
          form5329FiledOn: '2033-04-15',
          returnReflectsReducedTax: true,
        },
      }],
    })
    const emptyingYear = result.years.find((year) => year.year === 2032)!

    expect(emptyingYear.rmdShortfallExciseDetails).toHaveLength(2)
    const rothPool: RmdApplicablePlan = {
      kind: 'inheritedIras',
      payeePersonId: 'beneficiary',
      decedentId: 'decedent',
      iraType: 'roth',
    }
    expect(emptyingYear.rmdShortfallExciseDetails?.map((detail) => detail.obligationId))
      .toEqual([
        rmdShortfallObligationId(traditionalPool, 2032),
        rmdShortfallObligationId(rothPool, 2032),
      ])
    expect(emptyingYear.rmdShortfallExciseDetails?.map((detail) => detail.reason))
      .toEqual(['corrected10Percent', 'default25Percent'])
    expect(emptyingYear.rmdShortfallExciseDetails?.map((detail) => detail.tax))
      .toEqual([0.0004, 0.001])
    expect(emptyingYear.rmdShortfallExciseTax).toBe(0.0014)
  })

  it('keeps inherited employer plans particular to each account even for one decedent', () => {
    const plan = singlePersonPlan({ dob: '1980-06-15', planningAge: 60 })
    plan.household.people[0]!.id = 'beneficiary'
    const inherited = {
      decedentId: 'decedent',
      ownerDeathYear: 2022,
      decedentHadStartedRmds: false,
      beneficiary: {
        beneficiaryClass: 'designated-individual' as const,
        edbCategory: 'none' as const,
        beneficiaryBirthYear: 1980,
        soleBeneficiary: true,
        ownerBirthYear: 1970,
        provenance: { source: 'test fixture', asOf: '2026-01-01' },
      },
    }
    const first = traditionalAccount('employer-a', 0.004, 'beneficiary', 'employer')
    const second = traditionalAccount('employer-b', 0.004, 'beneficiary', 'employer')
    if (first.type !== 'traditional' || second.type !== 'traditional') {
      throw new Error('fixture account mismatch')
    }
    first.inherited = inherited
    second.inherited = inherited
    plan.accounts = [first, second]

    const result = run(plan, { horizonEndYear: 2032 })
    const emptyingYear = result.years.find((year) => year.year === 2032)!

    expect(emptyingYear.rmdShortfallExciseDetails).toHaveLength(2)
    expect(emptyingYear.rmdShortfallExciseDetails?.map((detail) => detail.obligationId))
      .toEqual(expect.arrayContaining([
        expect.stringContaining('employer-a'),
        expect.stringContaining('employer-b'),
      ]))
  })
})
