/**
 * A distribution paid because of the owner's death is not an early
 * distribution (RetireGolden #825).
 *
 * IRC 72(t)(2)(A)(ii): the 10 percent additional tax "shall not apply to" a
 * distribution "made to a beneficiary (or to the estate of the employee) on or
 * after the death of the employee", at any age; the payer reports it with Form
 * 1099-R code 4. Delaware's 2025 PIT-RES instructions, line 6, deny the
 * pension exclusion only to a code 1 distribution or one assessed the federal
 * early-withdrawal penalty, so an inherited 401(k) paid to a 45-year-old
 * beneficiary keeps the under-60 exclusion of 30 Del. C. 1106(b)(3):
 * min($2,000, pension) = $2,000 on a $10,000 distribution.
 *
 * Expected amounts are hand calculations from those sources and the 2026
 * Delaware figures, not copies of helper output.
 */
import { describe, expect, it } from 'vitest'

import { createEmptyPlan, type Account, type Plan } from '../model/plan.js'
import { stateRetirementEventsFromAccountAmounts } from '../projection/internal/annualStateRetirementEvents.js'
import { characterizePensionDistribution, retirementDistributionFactsForYear } from '../projection/internal/stateRetirementFactsAdapter.js'
import type { TaxYearInput } from '../projection/types.js'
import { describeRule } from '../rules/describeRule.js'
import { runPlan, validatePlan } from '../testing/planFixtures.js'
import { computeStateTaxYearResult, createStateTaxCalculator } from './stateTax.js'
import { scMilitaryDeduction, scSection1170Deduction } from './stateSouthCarolinaRetirement.js'
import { mapStateIncomeComponent, type StateHouseholdTaxFacts, type StateRetirementDistributionFact } from './stateRetirementFacts.js'

type TraditionalAccount = Extract<Account, { type: 'traditional' }>

/** An inherited 401(k) as the plan schema takes it: an employer account with the inherited block. */
function inherited401k(inheritedFacts: Partial<NonNullable<TraditionalAccount['inherited']>> = {}): TraditionalAccount {
  return {
    type: 'traditional', kind: 'employer', employerPlanType: '401k', id: 'inh401k', name: 'Inherited 401(k)',
    ownerPersonId: 'p1', annualReturnPct: 0, balance: 100_000, annualContribution: 0,
    inherited: { decedentId: 'p0', ownerDeathYear: 2022, decedentHadStartedRmds: true, ...inheritedFacts },
  }
}

/** The issue's plan: p1, born March 1, 1981 (45 in 2026), a Delaware resident. */
function delawarePlan(account: Account = inherited401k()): Plan {
  const plan = createEmptyPlan({ newId: () => 'p1', now: () => new Date('2026-01-01') })
  plan.household.state = 'DE'
  plan.household.filingStatus = 'single'
  plan.household.people[0]!.dob = '1981-03-01'
  plan.accounts = [account]
  return plan
}

/**
 * An inherited IRA whose surviving-spouse beneficiary elected to treat it as
 * her own from 2026 (Treas. Reg. 1.408-8(c)); the plan still carries the
 * inherited block, as it does after the election.
 */
function treatAsOwnIra(): TraditionalAccount {
  return {
    type: 'traditional', kind: 'ira', id: 'spouseIra', name: 'Inherited IRA', ownerPersonId: 'p1',
    annualReturnPct: 0, balance: 100_000, annualContribution: 0,
    inherited: {
      decedentId: 'p0', ownerDeathYear: 2024, decedentHadStartedRmds: false,
      beneficiary: {
        beneficiaryClass: 'designated-individual', edbCategory: 'surviving-spouse', beneficiaryBirthYear: 1981,
        soleBeneficiary: true, ownerBirthYear: 1979, spouseUnlimitedWithdrawalRight: true,
        election: 'treat-as-own', treatAsOwnElectionYear: 2026,
        provenance: { source: 'test', asOf: '2026-01-01' },
      },
    },
  } as TraditionalAccount
}

const inheritedEvent = {
  eventId: 'forced:2026:inh401k', accountId: 'inh401k', recipientPersonId: 'p1',
  sourceOwnerPersonId: 'p0', source: 'employerPlan' as const, federallyIncludedAmount: 10_000,
  paidToBeneficiaryAfterDeath: true,
}

const input = (change: Partial<TaxYearInput> = {}): TaxYearInput => ({
  year: 2026, state: 'DE', filingStatus: 'single', ordinaryIncome: 50_000,
  capitalGains: 0, ssBenefits: 0, peopleAged65Plus: 0, agesAlive: [45], ...change,
})
const household: StateHouseholdTaxFacts = {
  stateFilingStatus: 'single', federalAgi: 50_000, federallyIncludedSocialSecurity: 0,
  householdGrossSocialSecurity: 0, householdGrossRailroadBenefits: 0,
}
function delawareYear(rows: readonly StateRetirementDistributionFact[]) {
  return computeStateTaxYearResult(input(), {
    retirementDistributions: [...rows], hsaAccounts: [], qcdEvents: [], householdFacts: household,
  })
}
/** How much the rows take off Delaware taxable income. */
function excluded(rows: readonly StateRetirementDistributionFact[]): number {
  return delawareYear([]).taxableIncome - delawareYear(rows).taxableIncome
}
const warningCodes = (rows: readonly StateRetirementDistributionFact[]) => delawareYear(rows).warnings.map((warning) => warning.code)

it('builds its fixtures as plans the schema accepts', () => {
  expect(() => validatePlan(delawarePlan())).not.toThrow()
  expect(() => validatePlan(delawarePlan(inherited401k({ decedentId: undefined })))).not.toThrow()
  expect(() => validatePlan(delawarePlan(treatAsOwnIra()))).not.toThrow()
})

describeRule('de-early-distribution-gate', {
  note: 'inherited 401(k) under 60',
  readings: { deathExceptionNotPremature: 2_000, unknownWithheld: 0 },
  accepted: 'deathExceptionNotPremature',
}, ({ accepted }) => {
  it('marks the inherited-account row death and not premature', () => {
    const [row] = retirementDistributionFactsForYear(delawarePlan(), 2026, [inheritedEvent])
    expect(row!.cause).toBe('death')
    expect(row!.earlyDistributionDisqualifier).toBe('false')
  })

  it('gives the $2,000 line 6 exclusion with no unknown-status warning', () => {
    const rows = retirementDistributionFactsForYear(delawarePlan(), 2026, [inheritedEvent])
    expect(excluded(rows)).toBe(accepted)
    expect(warningCodes(rows)).not.toContain('de-pension-early-unknown')
    expect(delawareYear(rows).status).toBe('complete')
  })

  it('reaches the row built from the account itself, its source owner the decedent', () => {
    const rows = stateRetirementEventsFromAccountAmounts(delawarePlan(), 2026, new Map([['inh401k', 10_000]]), 'forced')
    expect(rows[0]).toMatchObject({ sourceOwnerPersonId: 'p0', cause: 'death', earlyDistributionDisqualifier: 'false' })
    expect(excluded(rows)).toBe(accepted)
  })

  it('reads the inherited marker, so an account that does not name its decedent is a death distribution too', () => {
    // inherited.decedentId is optional; the source owner then defaults to the
    // recipient, and the two ids no longer differ.
    const plan = delawarePlan(inherited401k({ decedentId: undefined }))
    const rows = stateRetirementEventsFromAccountAmounts(plan, 2026, new Map([['inh401k', 10_000]]), 'forced')
    expect(rows[0]).toMatchObject({ sourceOwnerPersonId: 'p1', cause: 'death', earlyDistributionDisqualifier: 'false' })
    expect(excluded(rows)).toBe(accepted)
  })

  it('prices the projected year: the inherited 401(k) row the simulation emits takes the exclusion', () => {
    // A schema-valid plan, run through simulatePlan: the forced inherited
    // distribution of 2026 reaches the state input as a death row. The plan
    // pays for nothing else, so that row is the year's only retirement row.
    // The decedent had begun distributions, so 2026 forces a life-expectancy
    // amount from the inherited account, more than $2,000 of it.
    const plan = delawarePlan()
    plan.household.people[0]!.longevity = { planningAge: 60, source: 'manual' }
    plan.assumptions.inflationPct = 0
    plan.assumptions.defaultReturnPct = 0
    plan.expenses.baseAnnual = 0
    plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
    plan.accounts.push({ type: 'cash', id: 'cash', name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 100_000, annualContribution: 0 })
    // Wages keep Delaware taxable income above zero, so the exclusion shows.
    plan.household.people[0]!.retirementAge = 65
    plan.incomes = [{ type: 'wages', id: 'job', personId: 'p1', annualGross: 50_000, endAge: null, realGrowthPct: 0 }]
    const year = runPlan(plan, createStateTaxCalculator(), 2026).years.find((entry) => entry.year === 2026)!
    const taxInput = year.acceptedTaxInput!
    const rows = taxInput.stateRetirementDistributions!.filter((row) => row.accountId === 'inh401k')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ cause: 'death', earlyDistributionDisqualifier: 'false', ownerPersonId: 'p1' })
    const included = rows[0]!.federallyIncludedAmount
    expect(included).toBeGreaterThan(2_000)
    const calculator = createStateTaxCalculator()
    const priceYear = (yearInput: TaxYearInput) => calculator.computeResult(yearInput)
    const priced = priceYear(taxInput)
    // The same year with the row's status unknown, as before 2026-11-03.
    const withheld = priceYear({
      ...taxInput,
      stateRetirementDistributions: taxInput.stateRetirementDistributions!.map((row) => row.accountId === 'inh401k'
        ? { ...row, cause: 'unknown' as const, earlyDistributionDisqualifier: 'unknown' as const } : row),
    })
    // Delaware taxable income is about $49,200 (wages, the distribution, less
    // the $3,250 standard deduction), inside the 5.55% band of 30 Del. C.
    // 1102(a)(14), so the $2,000 exclusion is 2,000 x 5.55% = $111.00 of tax.
    expect(withheld.amount - priced.amount).toBeCloseTo(accepted * 0.0555, 6)
    expect(priced.issues.map((issue) => issue.code)).not.toContain('de-pension-early-unknown')
    expect(withheld.issues.map((issue) => issue.code)).toContain('de-pension-early-unknown')
  })

  it('lets an explicit true disqualifier win over the death cause', () => {
    const rows = retirementDistributionFactsForYear(delawarePlan(), 2026, [{ ...inheritedEvent, eligibility: { earlyDistributionDisqualifier: 'true' } }])
    expect(rows[0]).toMatchObject({ cause: 'death', earlyDistributionDisqualifier: 'true' })
    expect(excluded(rows)).toBe(0)
    expect(warningCodes(rows)).not.toContain('de-pension-early-unknown')
  })
})

describe('the other producers of the death cause', () => {
  it('resolves a shared-contract death or survivor component the same way, and keeps code 1 premature', () => {
    const component = { id: 'c', ownerId: 'p1', recipient: 'primary', kind: 'qualifiedPlan401', amount: 10_000, federalIncludedAmount: 10_000, ageAtYearEnd: 45 } as const
    expect(mapStateIncomeComponent({ ...component, distributionReason: 'death' }).earlyDistributionDisqualifier).toBe('false')
    expect(mapStateIncomeComponent({ ...component, distributionReason: 'survivor' }).earlyDistributionDisqualifier).toBe('false')
    expect(mapStateIncomeComponent({ ...component, distributionReason: 'death', jurisdictionalFacts: { earlyDistributionCode: '1' } }).earlyDistributionDisqualifier).toBe('true')
  })

  it('marks a survivor pension paid to a 45-year-old not premature, unless the plan asserts it is', () => {
    const pension = (stateEligibility?: Record<string, unknown>) => ({
      type: 'pension', id: 'pension', source: 'private', ...(stateEligibility === undefined ? {} : { stateEligibility }),
    }) as unknown as Extract<Account, { type: 'pension' }>
    const survivor = (account: Extract<Account, { type: 'pension' }>) => characterizePensionDistribution({
      account, sourceOwnerPersonId: 'p0', payeePersonId: 'p1', federallyIncludedAmount: 10_000,
      recipientAgeYears: 45, taxYear: 2026, payeeDateOfBirth: '1981-03-01',
    }).fact
    expect(survivor(pension())).toMatchObject({ cause: 'death', earlyDistributionDisqualifier: 'false' })
    expect(survivor(pension({ earlyDistributionDisqualifier: 'true' })).earlyDistributionDisqualifier).toBe('true')
  })

  it('resolves a caller\'s own death row left unknown, and leaves an unknown ordinary row withheld', () => {
    const base = retirementDistributionFactsForYear(delawarePlan(), 2026, [inheritedEvent])[0]!
    expect(excluded([{ ...base, earlyDistributionDisqualifier: 'unknown' }])).toBe(2_000)
    expect(excluded([{ ...base, cause: 'ordinary', earlyDistributionDisqualifier: 'unknown' }])).toBe(0)
    expect(warningCodes([{ ...base, cause: 'ordinary', earlyDistributionDisqualifier: 'unknown' }])).toContain('de-pension-early-unknown')
  })

  it('leaves South Carolina\'s result for a death row left unknown the same through the calculator', () => {
    // The shared resolution gives the row false first, and South Carolina's
    // own death test agrees, so a caller's death row left unknown prices as
    // one marked false.
    const survivorPay: StateRetirementDistributionFact = {
      accountId: 'sbp', ownerPersonId: 'p1', sourceKind: 'militarySurvivor', federallyIncludedAmount: 20_000,
      grossDistribution: 20_000, recipientAgeYears: 45, recipientAgeKnown: true, cause: 'death',
      earlyDistributionDisqualifier: 'unknown', survivorSpouse: true,
    }
    const southCarolina = (rows: readonly StateRetirementDistributionFact[]) => computeStateTaxYearResult(input({ state: 'SC' }), {
      retirementDistributions: [...rows], hsaAccounts: [], qcdEvents: [], householdFacts: household,
    })
    const unknown = southCarolina([survivorPay])
    expect(unknown.taxableIncome).toBe(southCarolina([{ ...survivorPay, earlyDistributionDisqualifier: 'false' }]).taxableIncome)
    expect(unknown.warnings.map((warning) => warning.code)).not.toContain('sc-military-premature-unknown')
    // 12-6-1171 deducts the included military survivor pay in full.
    expect(southCarolina([]).taxableIncome - unknown.taxableIncome).toBe(20_000)
  })
})

describe('a surviving spouse\'s treat-as-own election', () => {
  // From the election year the account is the spouse's own IRA (Treas. Reg.
  // 1.408-8(c)), so IRC 72(t) applies to its distributions normally and the
  // death exception does not; the plan still carries the inherited block.
  const plan = delawarePlan(treatAsOwnIra())
  const rowsWith = (isTreatAsOwnEffective?: () => boolean) =>
    stateRetirementEventsFromAccountAmounts(plan, 2026, new Map([['spouseIra', 10_000]]), 'voluntary', undefined, undefined,
      isTreatAsOwnEffective)

  it('does not make an owner-treated withdrawal a death distribution', () => {
    const rows = rowsWith(() => true)
    expect(rows[0]).toMatchObject({ cause: 'unknown', earlyDistributionDisqualifier: 'unknown' })
    // A 45-year-old's own IRA withdrawal: no under-60 exclusion (an IRA is
    // not a pension from an employer), and its status stays unknown.
    expect(excluded(rows)).toBe(0)
  })

  it('keeps a withdrawal the election does not yet reach a death distribution', () => {
    expect(rowsWith(() => false)[0]).toMatchObject({ cause: 'death', earlyDistributionDisqualifier: 'false' })
  })

  it('leaves the cause unknown when the year\'s owner treatment is not supplied', () => {
    expect(rowsWith()[0]).toMatchObject({ cause: 'unknown', earlyDistributionDisqualifier: 'unknown' })
  })

  it('withholds South Carolina\'s 12-6-1170 deduction from the spouse\'s own early withdrawal', () => {
    const rows = rowsWith(() => true)
    const result = scSection1170Deduction({ facts: rows as StateRetirementDistributionFact[], recipientAgeYears: 45 })
    expect(result.taxableIncomeDelta).toBe(-0)
    expect(result.warnings.map((warning) => warning.code)).toContain('sc-1170-premature-unknown')
  })
})

describe('the exported South Carolina leaves, called directly', () => {
  // A caller's row that leaves a death distribution unknown, passed straight
  // to the leaf with no calculator normalization in between.
  const deathRow = (change: Partial<StateRetirementDistributionFact> = {}): StateRetirementDistributionFact => ({
    accountId: 'a', ownerPersonId: 'p1', sourceKind: 'employerPlan', federallyIncludedAmount: 10_000,
    grossDistribution: 10_000, recipientAgeYears: 45, recipientAgeKnown: true, cause: 'death',
    earlyDistributionDisqualifier: 'unknown', ...change,
  })

  it('gives 12-6-1170 its $3,000 under-65 tier for a death row left unknown, and none for code 1', () => {
    // 12-6-1170(A): min($3,000, eligible) under 65.
    const unknown = scSection1170Deduction({ facts: [deathRow()], recipientAgeYears: 45 })
    expect(unknown.taxableIncomeDelta).toBe(-3_000)
    expect(unknown.warnings).toEqual([])
    expect(scSection1170Deduction({ facts: [deathRow({ earlyDistributionDisqualifier: 'true' })], recipientAgeYears: 45 }).taxableIncomeDelta).toBe(-0)
    const ordinary = scSection1170Deduction({ facts: [deathRow({ cause: 'unknown' })], recipientAgeYears: 45 })
    expect(ordinary.taxableIncomeDelta).toBe(-0)
    expect(ordinary.warnings.map((warning) => warning.code)).toContain('sc-1170-premature-unknown')
  })

  it('gives 12-6-1171 the whole military survivor payment for a death row left unknown, with no warning', () => {
    const military = scMilitaryDeduction([deathRow({ sourceKind: 'militarySurvivor', federallyIncludedAmount: 20_000, grossDistribution: 20_000 })])
    expect(military.taxableIncomeDelta).toBe(-20_000)
    expect(military.warnings).toEqual([])
  })
})
