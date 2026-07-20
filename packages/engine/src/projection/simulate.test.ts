import { describe, expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Account, type IncomeStream, type Plan } from '../model/plan.js'
import { computePiaFromEarnings, isPiaFromEarningsError } from '../socialSecurity/piaFromEarnings.js'
import { combineTaxCalculators, computeFederalTax, createFederalTaxCalculator } from '../tax/federalTax.js'
import { createStateTaxCalculator } from '../tax/stateTax.js'
import { createFlatTaxCalculator } from './flatTax.js'
import { simulatePlan } from './simulate.js'
import { claimFactor } from '../socialSecurity/claimFactor.js'

let counter = 0
const testIds = () => `sim-${++counter}`
const fixedNow = () => new Date('2026-06-11T00:00:00.000Z')

const noTax = createFlatTaxCalculator(0)

/** Single person born 1966, retiring at 67 (2033), planning to 90 (2056). */
function basePlan(): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1966-06-15',
    sex: 'average',
    retirementAge: 67,
    longevity: { planningAge: 90, source: 'manual' },
  }
  plan.assumptions.inflationPct = 0 // most tests reason in flat dollars
  plan.assumptions.defaultReturnPct = 0
  return plan
}

function cash(balance: number, contribution = 0): Account {
  return { type: 'cash', id: testIds(), name: 'Cash', ownerPersonId: null, annualReturnPct: null, balance, annualContribution: contribution }
}

function taxable(balance: number, costBasis: number): Extract<Account, { type: 'taxable' }> {
  return {
    type: 'taxable',
    id: testIds(),
    name: 'Brokerage',
    ownerPersonId: null,
    annualReturnPct: null,
    balance,
    costBasis,
    interestYieldPct: 0,
    dividendYieldPct: 0,
    qualifiedRatio: 0.85,
    reinvestDividends: true,
    annualContribution: 0,
  }
}

function traditional(balance: number, contribution = 0, owner = 'p1'): Account {
  return { type: 'traditional', id: testIds(), name: '401k', ownerPersonId: owner, annualReturnPct: null, kind: 'employer', balance, annualContribution: contribution }
}

function wages(annualGross: number, personId = 'p1'): IncomeStream {
  return { type: 'wages', id: testIds(), personId, annualGross, endAge: null, realGrowthPct: 0 }
}

function validate(plan: Plan): Plan {
  const r = parsePlan(plan)
  if (!r.ok) throw new Error(r.issues.join('; '))
  return r.plan
}

describe('horizon and wages', () => {
  it('runs from startYear through the planning-age year', () => {
    const plan = basePlan()
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
    expect(result.startYear).toBe(2026)
    expect(result.endYear).toBe(1966 + 90)
    expect(result.years).toHaveLength(2056 - 2026 + 1)
  })

  it('pays wages until the retirement-age year, then stops', () => {
    const plan = basePlan()
    plan.incomes = [wages(100_000)]
    plan.accounts = [cash(10_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const y2032 = result.years.find((y) => y.year === 2032)! // age 66
    const y2033 = result.years.find((y) => y.year === 2033)! // age 67 = retirement
    expect(y2032.incomes.wages).toBe(100_000)
    expect(y2033.incomes.wages).toBe(0)
  })

  it('applies real salary growth on top of inflation', () => {
    const plan = basePlan()
    plan.assumptions.inflationPct = 2
    const wageStream = wages(100_000)
    if (wageStream.type !== 'wages') throw new Error('expected wages stream')
    plan.incomes = [{ ...wageStream, realGrowthPct: 3 }]
    plan.accounts = [cash(10_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    expect(result.years.find((y) => y.year === 2026)!.incomes.wages).toBeCloseTo(100_000, 6)
    expect(result.years.find((y) => y.year === 2027)!.incomes.wages).toBeCloseTo(100_000 * 1.03 * 1.02, 6)
  })
})

describe('social security', () => {
  it('starts at the claim-age year with the claiming factor applied', () => {
    const plan = basePlan()
    plan.incomes = [
      { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 2000, earnings: null, claimAge: { years: 70, months: 0 } },
    ]
    plan.accounts = [cash(2_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const beforeClaim = result.years.find((y) => y.year === 2035)! // age 69
    const atClaim = result.years.find((y) => y.year === 2036)! // age 70
    expect(beforeClaim.incomes.socialSecurity).toBe(0)
    // Born 1966 -> FRA 67 -> claiming at 70 = 36 months of DRC at 2/3%/mo = 1.24.
    expect(atClaim.incomes.socialSecurity).toBeCloseTo(2000 * 12 * 1.24, 6)
  })

  it('reduces early claims and prorates the first calendar year by claim months', () => {
    const plan = basePlan()
    plan.incomes = [
      { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 2000, earnings: null, claimAge: { years: 62, months: 6 } },
    ]
    plan.accounts = [cash(2_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const first = result.years.find((y) => y.year === 2028)! // age 62
    const second = result.years.find((y) => y.year === 2029)!
    // 54 months early: 36×5/9% + 18×5/12% = 27.5% reduction.
    const fullYear = 2000 * 12 * 0.725
    expect(second.incomes.socialSecurity).toBeCloseTo(fullYear, 6)
    expect(first.incomes.socialSecurity).toBeCloseTo(fullYear * (6 / 12), 6)
  })

  it('pays a divorced-spousal benefit when it beats the own benefit (single, 10-yr marriage)', () => {
    const plan = basePlan() // single, born 1966, FRA 67
    plan.incomes = [
      {
        type: 'socialSecurity',
        id: testIds(),
        personId: 'p1',
        piaMonthly: 1_000,
        earnings: null,
        claimAge: { years: 67, months: 0 },
        formerSpouses: [
          { id: 'ex1', relationship: 'divorced', dob: '1958-01-01', piaMonthly: 3_000, marriageYears: 12, remarriedAtAge: null },
        ],
      },
    ]
    plan.accounts = [cash(2_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const atClaim = result.years.find((y) => y.year === 2033)! // age 67, factor 1
    // max(own 1000×12, divorced-spousal 0.5×3000×12) = 18,000.
    expect(atClaim.incomes.socialSecurity).toBeCloseTo(18_000, 6)
  })

  it('does not pay divorced-spousal under a 10-year marriage', () => {
    const plan = basePlan()
    plan.incomes = [
      {
        type: 'socialSecurity',
        id: testIds(),
        personId: 'p1',
        piaMonthly: 1_000,
        earnings: null,
        claimAge: { years: 67, months: 0 },
        formerSpouses: [
          { id: 'ex1', relationship: 'divorced', dob: '1958-01-01', piaMonthly: 3_000, marriageYears: 9, remarriedAtAge: null },
        ],
      },
    ]
    plan.accounts = [cash(2_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
    expect(result.years.find((y) => y.year === 2033)!.incomes.socialSecurity).toBeCloseTo(12_000, 6)
  })

  it('pays survivor on a deceased former spouse but forfeits it after remarriage before 60', () => {
    const deceased = (remarriedAtAge: number | null): IncomeStream => ({
      type: 'socialSecurity',
      id: 'ss-surv',
      personId: 'p1',
      piaMonthly: 1_000,
      earnings: null,
      claimAge: { years: 67, months: 0 },
      formerSpouses: [{ id: 'late', relationship: 'deceased', dob: '1955-01-01', piaMonthly: 2_400, marriageYears: 20, remarriedAtAge }],
    })

    const preserved = basePlan()
    preserved.incomes = [deceased(null)]
    preserved.accounts = [cash(2_000_000)]
    const survivorIncome = simulatePlan(validate(preserved), { startYear: 2026, taxCalculator: noTax }).years.find(
      (y) => y.year === 2033,
    )!.incomes.socialSecurity
    expect(survivorIncome).toBeCloseTo(28_800, 6) // 2400×12, beats own 12,000

    const forfeited = basePlan()
    forfeited.incomes = [deceased(55)]
    forfeited.accounts = [cash(2_000_000)]
    const ownOnly = simulatePlan(validate(forfeited), { startYear: 2026, taxCalculator: noTax }).years.find(
      (y) => y.year === 2033,
    )!.incomes.socialSecurity
    expect(ownOnly).toBeCloseTo(12_000, 6)
  })

  it('withholds benefits under the earnings test while working before FRA', () => {
    const plan = basePlan()
    plan.household.people[0]! = {
      ...plan.household.people[0]!,
      dob: '1964-06-15', // 62 in 2026, FRA 67
      retirementAge: 68,
    }
    plan.incomes = [
      wages(60_000),
      { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 2_000, earnings: null, claimAge: { years: 62, months: 0 } },
    ]
    plan.accounts = [cash(2_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    // Claim at 62 -> 70% of PIA = 16,800/yr. Below FRA: withhold (60k−24,480)/2
    // = 17,760, which exceeds the benefit -> fully withheld.
    const age62 = result.years.find((y) => y.year === 2026)!
    expect(age62.incomes.socialSecurity).toBe(0)
    expect(age62.ssEarningsTestWithheld).toBeCloseTo(16_800, 6)

    const age66 = result.years.find((y) => y.year === 2030)!
    expect(age66.incomes.socialSecurity).toBe(0)

    // FRA year (67): exempt amount 65,160 > wages -> no withholding. All 60
    // months (62-66) were fully withheld, so the benefit is recomputed as if
    // claimed at FRA -> full PIA = 24,000.
    const age67 = result.years.find((y) => y.year === 2031)!
    expect(age67.incomes.socialSecurity).toBeCloseTo(24_000, 6)
    expect(age67.ssEarningsTestWithheld).toBe(0)

    expect(result.warnings.join(' ')).toContain('earnings test')
  })

  it('credits withheld earnings-test months back at full retirement age', () => {
    // Born 1964 (62 in 2026, FRA 67), claims at 62, high wages fully withhold the
    // benefit through 66 (60 months), then stops working at FRA.
    const plan = basePlan()
    plan.household.people[0]! = { ...plan.household.people[0]!, dob: '1964-06-15', retirementAge: 67 }
    plan.incomes = [
      wages(200_000),
      { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 2_000, earnings: null, claimAge: { years: 62, months: 0 } },
    ]
    plan.accounts = [cash(2_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    // 62-66: fully withheld.
    expect(result.years.find((y) => y.year === 2026)!.incomes.socialSecurity).toBe(0)
    expect(result.years.find((y) => y.year === 2030)!.incomes.socialSecurity).toBe(0)
    // 67+: 60 withheld months credit the claim from 62 up to FRA -> full PIA.
    expect(result.years.find((y) => y.year === 2031)!.incomes.socialSecurity).toBeCloseTo(24_000, 6)
    expect(result.years.find((y) => y.year === 2032)!.incomes.socialSecurity).toBeCloseTo(24_000, 6)
  })

  it('applies the earnings test to a marital-history benefit (not just own)', () => {
    // Single divorced person, 62, big wages: the divorced-spousal benefit beats
    // own but must also be withheld by the earnings test.
    const plan = basePlan()
    plan.household.people[0]! = { ...plan.household.people[0]!, dob: '1964-07-01', retirementAge: 67 }
    plan.incomes = [
      wages(200_000),
      {
        type: 'socialSecurity',
        id: testIds(),
        personId: 'p1',
        piaMonthly: 800,
        earnings: null,
        claimAge: { years: 62, months: 0 },
        formerSpouses: [{ id: 'ex', relationship: 'divorced', dob: '1958-01-01', piaMonthly: 4_000, marriageYears: 15, remarriedAtAge: null }],
      },
    ]
    plan.accounts = [cash(2_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
    // Divorced-spousal (~$15.6k) lifts the benefit, but high wages fully withhold it.
    expect(result.years.find((y) => y.year === 2026)!.incomes.socialSecurity).toBe(0)
  })

  it('credits a mid-year first claim only for its payable months', () => {
    // Claim 62y6m, work (and be fully withheld) only the partial first year,
    // retiring at 63. Just 6 payable months are withheld, so the FRA credit moves
    // the claim from 62y6m to 63y0m (0.75 PIA), not 63y6m.
    const plan = basePlan()
    plan.household.people[0]! = { ...plan.household.people[0]!, dob: '1964-07-01', retirementAge: 63 }
    plan.incomes = [
      wages(200_000),
      { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 2_000, earnings: null, claimAge: { years: 62, months: 6 } },
    ]
    plan.accounts = [cash(2_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
    // 67+: credited claim 62y6m + 6mo = 63y0m -> 48 months early -> 0.75 × PIA.
    expect(result.years.find((y) => y.year === 2031)!.incomes.socialSecurity).toBeCloseTo(18_000, 6)
  })

  it('credits only the months actually withheld (partial)', () => {
    // Works (and is withheld) only at 62-63, retiring at 64 -> 24 months credited,
    // so the FRA-recomputed claim age is 64, not 67.
    const plan = basePlan()
    plan.household.people[0]! = { ...plan.household.people[0]!, dob: '1964-06-15', retirementAge: 64 }
    plan.incomes = [
      wages(200_000),
      { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 2_000, earnings: null, claimAge: { years: 62, months: 0 } },
    ]
    plan.accounts = [cash(2_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    // 64-66 (before FRA, no wages): the original reduced 62 benefit, 0.70 × PIA.
    expect(result.years.find((y) => y.year === 2028)!.incomes.socialSecurity).toBeCloseTo(16_800, 6)
    // 67+: claim credited 62 -> 64 (24 months), 36 months early -> 0.80 × PIA.
    expect(result.years.find((y) => y.year === 2031)!.incomes.socialSecurity).toBeCloseTo(19_200, 6)
  })

  it('steps the survivor up to the deceased spouse’s larger benefit', () => {
    const plan = basePlan()
    plan.household.filingStatus = 'marriedFilingJointly'
    plan.household.people = [
      { id: 'p1', name: 'Low', dob: '1962-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 95, source: 'manual' } },
      { id: 'p2', name: 'High', dob: '1960-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 75, source: 'manual' } },
    ]
    plan.incomes = [
      { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 1_000, earnings: null, claimAge: { years: 67, months: 0 } },
      { type: 'socialSecurity', id: testIds(), personId: 'p2', piaMonthly: 3_000, earnings: null, claimAge: { years: 67, months: 0 } },
    ]
    plan.accounts = [cash(5_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    // Both claimed at FRA (factor 1), COLA 0. Low earner's own is 12,000 but the
    // spousal top-up lifts it to 50% of the high PIA = 18,000; high earner 36,000.
    const bothAlive = result.years.find((y) => y.year === 2035)! // p2's last year (75)
    expect(bothAlive.incomes.socialSecurity).toBeCloseTo(54_000, 6)

    // p2 dies after 2035: p1 steps up to p2's 36,000 (survivor supersedes spousal).
    const survivorYear = result.years.find((y) => y.year === 2036)!
    expect(survivorYear.incomes.socialSecurity).toBeCloseTo(36_000, 6)
  })

  it('floors the survivor step-up at 82.5% of PIA (RIB-LIM) when the deceased claimed early', () => {
    // Both born 1960 (survivor FRA 66y8m). p2 PIA 3,000 claimed at 62 (70% = 25,200/yr)
    // and dies at 67. p1 PIA 1,000 claims at 67 (FRA ⇒ no widow reduction). After p2
    // dies, p1 steps up to max(p2 actual, 82.5% × PIA) = 29,700 (the RIB-LIM floor
    // lifts the survivor above p2's reduced 25,200, but below 100% of PIA).
    const plan = basePlan()
    plan.household.filingStatus = 'marriedFilingJointly'
    plan.household.people = [
      { id: 'p1', name: 'Low', dob: '1960-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 95, source: 'manual' } },
      { id: 'p2', name: 'High', dob: '1960-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 66, source: 'manual' } },
    ]
    plan.incomes = [
      { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 1_000, earnings: null, claimAge: { years: 67, months: 0 } },
      { type: 'socialSecurity', id: testIds(), personId: 'p2', piaMonthly: 3_000, earnings: null, claimAge: { years: 62, months: 0 } },
    ]
    plan.accounts = [cash(5_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    // 2027: p2 (age 67) is dead; p1 (age 67) steps up to the RIB-LIM floor.
    const y2027 = result.years.find((y) => y.year === 2027)!
    expect(y2027.incomes.socialSecurity).toBeCloseTo(0.825 * 3_000 * 12, 6)
    expect(y2027.incomes.socialSecurity).toBeGreaterThan(3_000 * 0.70 * 12) // above p2's reduced benefit
    expect(y2027.incomes.socialSecurity).toBeLessThan(3_000 * 12) // below 100% of PIA
  })

  it('reduces the survivor step-up for an early-claim widow before survivor FRA', () => {
    // Both born 1960 (survivor FRA 66y8m = 800 months). p2 PIA 3,000 claimed at 62,
    // dies at 67. p1 PIA 1,000 claims at 62 ⇒ survivor reduction at 62 (744 months):
    // frac = (744-720)/(800-720) = 0.3 ⇒ factor = 1 - 0.285×0.7 = 0.8005.
    // RIB-LIM base = max(2,100, 2,475) = 2,475; payable = 2,475 × 0.8005 × 12.
    const plan = basePlan()
    plan.household.filingStatus = 'marriedFilingJointly'
    plan.household.people = [
      { id: 'p1', name: 'Low', dob: '1960-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 95, source: 'manual' } },
      { id: 'p2', name: 'High', dob: '1960-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 66, source: 'manual' } },
    ]
    plan.incomes = [
      { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 1_000, earnings: null, claimAge: { years: 62, months: 0 } },
      { type: 'socialSecurity', id: testIds(), personId: 'p2', piaMonthly: 3_000, earnings: null, claimAge: { years: 62, months: 0 } },
    ]
    plan.accounts = [cash(5_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const y2027 = result.years.find((y) => y.year === 2027)!
    const expectedSurvivor = 0.825 * 3_000 * (1 - 0.285 * 0.7) * 12
    expect(y2027.incomes.socialSecurity).toBeCloseTo(expectedSurvivor, 4)
    expect(y2027.incomes.socialSecurity).toBeLessThan(0.825 * 3_000 * 12) // reduced below the FRA-claim amount
  })

  it('survivor step-up: deceased claimed at FRA ⇒ 100% of PIA at the survivor FRA', () => {
    // Feature-off-style default: deceased (p2) claimed at FRA and p1 is past survivor
    // FRA ⇒ no RIB-LIM floor binds and no widow reduction ⇒ p1 gets 100% of p2's PIA
    // (matches the pre-precision behaviour for the common at-FRA case).
    const plan = basePlan()
    plan.household.filingStatus = 'marriedFilingJointly'
    plan.household.people = [
      { id: 'p1', name: 'Low', dob: '1960-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 95, source: 'manual' } },
      { id: 'p2', name: 'High', dob: '1960-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 66, source: 'manual' } },
    ]
    plan.incomes = [
      { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 1_000, earnings: null, claimAge: { years: 67, months: 0 } },
      { type: 'socialSecurity', id: testIds(), personId: 'p2', piaMonthly: 3_000, earnings: null, claimAge: { years: 67, months: 0 } },
    ]
    plan.accounts = [cash(5_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const y2027 = result.years.find((y) => y.year === 2027)!
    expect(y2027.incomes.socialSecurity).toBeCloseTo(3_000 * 12, 6)
  })

  it('SSDI pays the full PIA (no early reduction) before 62 and converts at FRA', () => {
    // Born 1960 (FRA 67); PIA 2,000; disability onset at 55 (well before 62). No
    // wages ⇒ no SGA suspension. SSDI = full PIA from onset, continuous through FRA.
    const plan = basePlan()
    plan.household.people[0]! = { ...plan.household.people[0]!, dob: '1960-06-15', retirementAge: 67 }
    plan.incomes = [
      {
        type: 'socialSecurity',
        id: testIds(),
        personId: 'p1',
        piaMonthly: 2_000,
        earnings: null,
        claimAge: { years: 67, months: 0 },
        disability: { onsetAge: 55 },
      },
    ]
    plan.accounts = [cash(2_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    // Age 66 (2026, SSDI window) and age 67 (2027, FRA conversion): full PIA.
    const y2026 = result.years.find((y) => y.year === 2026)!
    const y2027 = result.years.find((y) => y.year === 2027)!
    expect(y2026.incomes.socialSecurity).toBeCloseTo(2_000 * 12, 6)
    expect(y2026.ssdiPaid).toBeCloseTo(2_000 * 12, 6)
    expect(y2027.incomes.socialSecurity).toBeCloseTo(2_000 * 12, 6)
    expect(y2027.ssdiPaid).toBeCloseTo(2_000 * 12, 6)
  })

  it('SSDI is suspended when wages exceed Substantial Gainful Activity (SGA)', () => {
    // Same worker, now earning $60k (above the 2026 SGA × 12 = $19,440) while in
    // the SSDI window. Benefits resume at FRA once wages stop (retirementAge 67).
    const plan = basePlan()
    plan.household.people[0]! = { ...plan.household.people[0]!, dob: '1960-06-15', retirementAge: 67 }
    plan.incomes = [
      wages(60_000),
      {
        type: 'socialSecurity',
        id: testIds(),
        personId: 'p1',
        piaMonthly: 2_000,
        earnings: null,
        claimAge: { years: 67, months: 0 },
        disability: { onsetAge: 55 },
      },
    ]
    plan.accounts = [cash(2_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    // Age 66 (working, in window): SGA suspends SSDI. Age 67 (FRA, wages stop): resumes.
    const y2026 = result.years.find((y) => y.year === 2026)!
    const y2027 = result.years.find((y) => y.year === 2027)!
    expect(y2026.incomes.socialSecurity).toBe(0)
    expect(y2026.ssdiPaid).toBe(0)
    expect(y2027.incomes.socialSecurity).toBeCloseTo(2_000 * 12, 6)
    expect(y2027.ssdiPaid).toBeCloseTo(2_000 * 12, 6)
    expect(result.warnings.join(' ')).toContain('SGA')
  })

  it('SSDI is off by default: a normal plan pays no SSDI anywhere (feature-off regression)', () => {
    const plan = basePlan()
    plan.incomes = [
      { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 2_000, earnings: null, claimAge: { years: 67, months: 0 } },
    ]
    plan.accounts = [cash(2_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
    expect(result.years.every((y) => y.ssdiPaid === 0)).toBe(true)
  })

  it('SSDI onset at/after FRA is ignored — falls through to normal retirement', () => {
    // Born 1960 (FRA 67); PIA 2,000; claimAge 67; disability onsetAge 70 (>= FRA).
    // SSDI can't start post-FRA, so the normal retirement path should apply: at 67
    // the person claims retirement (full PIA at FRA), NOT zero from 67–69.
    const plan = basePlan()
    plan.household.people[0]! = { ...plan.household.people[0]!, dob: '1960-06-15', retirementAge: 67 }
    plan.incomes = [
      {
        type: 'socialSecurity',
        id: testIds(),
        personId: 'p1',
        piaMonthly: 2_000,
        earnings: null,
        claimAge: { years: 67, months: 0 },
        disability: { onsetAge: 70 },
      },
    ]
    plan.accounts = [cash(2_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    // Age 67 (2027): the person claimed retirement at FRA → full PIA (not SSDI, not 0).
    const y2027 = result.years.find((y) => y.year === 2027)!
    expect(y2027.incomes.socialSecurity).toBeCloseTo(2_000 * 12, 6)
    expect(y2027.ssdiPaid).toBe(0)
  })

  it('tops the lower earner up to the spousal benefit while both are alive', () => {
    const plan = basePlan()
    plan.household.filingStatus = 'marriedFilingJointly'
    plan.household.people = [
      { id: 'p1', name: 'Low', dob: '1962-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 95, source: 'manual' } },
      { id: 'p2', name: 'High', dob: '1962-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 95, source: 'manual' } },
    ]
    plan.incomes = [
      // Low earner's own (800/mo) is below half the high PIA (4000/mo); both claim at FRA 67.
      { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 800, earnings: null, claimAge: { years: 67, months: 0 } },
      { type: 'socialSecurity', id: testIds(), personId: 'p2', piaMonthly: 4_000, earnings: null, claimAge: { years: 67, months: 0 } },
    ]
    plan.accounts = [cash(5_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    // Both at FRA (factor 1), COLA 0. Low own = 9,600; spousal = 50% × 48,000 = 24,000.
    // High = 48,000. Household = 24,000 + 48,000.
    const y2030 = result.years.find((y) => y.year === 2030)! // both 68
    expect(y2030.incomes.socialSecurity).toBeCloseTo(72_000, 6)
  })

  it('does not pay spousal before the higher earner has claimed', () => {
    const plan = basePlan()
    plan.household.filingStatus = 'marriedFilingJointly'
    plan.household.people = [
      { id: 'p1', name: 'Low', dob: '1962-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 95, source: 'manual' } },
      { id: 'p2', name: 'High', dob: '1962-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 95, source: 'manual' } },
    ]
    plan.incomes = [
      { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 800, earnings: null, claimAge: { years: 67, months: 0 } },
      { type: 'socialSecurity', id: testIds(), personId: 'p2', piaMonthly: 4_000, earnings: null, claimAge: { years: 70, months: 0 } },
    ]
    plan.accounts = [cash(5_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    // Low earner claimed (67), high earner has not (claims 70). No spousal yet:
    // only the low earner's own 9,600.
    const y2030 = result.years.find((y) => y.year === 2030)! // both 68
    expect(y2030.incomes.socialSecurity).toBeCloseTo(9_600, 6)
  })

  it('prorates former-spouse marital benefits by the claim month in the first year', () => {
    const plan = basePlan()
    plan.household.people[0]! = { ...plan.household.people[0]!, dob: '1964-07-01', retirementAge: null }
    plan.incomes = [
      {
        type: 'socialSecurity',
        id: testIds(),
        personId: 'p1',
        piaMonthly: 800,
        earnings: null,
        claimAge: { years: 62, months: 6 },
        formerSpouses: [{ id: 'ex', relationship: 'divorced', dob: '1958-01-01', piaMonthly: 4_000, marriageYears: 15, remarriedAtAge: null }],
      },
    ]
    plan.accounts = [cash(2_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    // Born 1964 -> FRA 67. Divorced-spousal at 62y6m is 67.5% of half the ex PIA,
    // and only the six payable months after the claim month are paid in 2026.
    expect(result.years.find((y) => y.year === 2026)!.incomes.socialSecurity).toBeCloseTo(4_000 * 0.5 * 0.675 * 6, 6)
  })

  it('withholds current-spouse spousal benefits before FRA and credits them at FRA', () => {
    const plan = basePlan()
    plan.household.filingStatus = 'marriedFilingJointly'
    plan.household.people = [
      { id: 'p1', name: 'Low', dob: '1964-06-15', sex: 'average', retirementAge: 67, longevity: { planningAge: 95, source: 'manual' } },
      { id: 'p2', name: 'High', dob: '1959-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 95, source: 'manual' } },
    ]
    plan.incomes = [
      wages(200_000, 'p1'),
      { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 800, earnings: null, claimAge: { years: 62, months: 0 } },
      { type: 'socialSecurity', id: testIds(), personId: 'p2', piaMonthly: 4_000, earnings: null, claimAge: { years: 62, months: 0 } },
    ]
    plan.accounts = [cash(5_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
    const highAnnual = 4_000 * 12 * claimFactor(1959, 6, 15, { years: 62, months: 0 })

    // Low earner's spousal benefit beats their own benefit at 62, but their wages
    // fully withhold it. The household still receives the high earner's benefit.
    const y2026 = result.years.find((y) => y.year === 2026)!
    expect(y2026.incomes.socialSecurity).toBeCloseTo(highAnnual, 6)
    expect(y2026.ssEarningsTestWithheld).toBeGreaterThan(15_000)

    // At FRA, all 60 withheld months credit the low earner's spousal factor to 1.0.
    const y2031 = result.years.find((y) => y.year === 2031)!
    expect(y2031.incomes.socialSecurity).toBeCloseTo(highAnnual + 0.5 * 4_000 * 12, 6)
  })

  it('caps current-spouse spousal benefits with the worker family maximum', () => {
    const plan = basePlan()
    plan.household.filingStatus = 'marriedFilingJointly'
    plan.household.people = [
      { id: 'p1', name: 'Low', dob: '1960-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 95, source: 'manual' } },
      { id: 'p2', name: 'High', dob: '1960-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 95, source: 'manual' } },
    ]
    plan.incomes = [
      { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 100, earnings: null, claimAge: { years: 70, months: 0 } },
      { type: 'socialSecurity', id: testIds(), personId: 'p2', piaMonthly: 1_000, earnings: null, claimAge: { years: 70, months: 0 } },
    ]
    plan.accounts = [cash(5_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    // PIA 1,000 is below the first 2022 family-max bend point, so MFB = 150% PIA.
    // The worker delayed to 124% PIA (1,240), leaving $260/mo of auxiliary room on
    // that record. The low earner keeps their own $124/mo (100 PIA × 1.24 at 70) and
    // adds the capped $260 excess ⇒ $384/mo, not just the $260 auxiliary room.
    const y2030 = result.years.find((y) => y.year === 2030)!
    expect(y2030.incomes.socialSecurity).toBeCloseTo((1_240 + 124 + 260) * 12, 6)
  })

  it('prorates current-spouse spousal benefits by both claim months', () => {
    const plan = basePlan()
    plan.household.filingStatus = 'marriedFilingJointly'
    plan.household.people = [
      { id: 'p1', name: 'Low', dob: '1962-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 95, source: 'manual' } },
      { id: 'p2', name: 'High', dob: '1962-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 95, source: 'manual' } },
    ]
    plan.incomes = [
      { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 800, earnings: null, claimAge: { years: 67, months: 6 } },
      { type: 'socialSecurity', id: testIds(), personId: 'p2', piaMonthly: 4_000, earnings: null, claimAge: { years: 67, months: 6 } },
    ]
    plan.accounts = [cash(5_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const highHalfYear = 4_000 * claimFactor(1962, 6, 15, { years: 67, months: 6 }) * 6
    const lowSpousalHalfYear = 0.5 * 4_000 * 6
    expect(result.years.find((y) => y.year === 2029)!.incomes.socialSecurity).toBeCloseTo(
      highHalfYear + lowSpousalHalfYear,
      6,
    )
  })

  it('withholds current-spouse survivor benefits before FRA and credits them at survivor FRA', () => {
    const plan = basePlan()
    plan.household.filingStatus = 'marriedFilingJointly'
    plan.household.people = [
      { id: 'p1', name: 'Survivor', dob: '1964-06-15', sex: 'average', retirementAge: 67, longevity: { planningAge: 95, source: 'manual' } },
      { id: 'p2', name: 'Deceased', dob: '1959-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 66, source: 'manual' } },
    ]
    plan.incomes = [
      wages(200_000, 'p1'),
      { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 1_000, earnings: null, claimAge: { years: 62, months: 0 } },
      { type: 'socialSecurity', id: testIds(), personId: 'p2', piaMonthly: 3_000, earnings: null, claimAge: { years: 62, months: 0 } },
    ]
    plan.accounts = [cash(5_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const y2026 = result.years.find((y) => y.year === 2026)!
    expect(y2026.incomes.socialSecurity).toBe(0)
    expect(y2026.ssEarningsTestWithheld).toBeGreaterThan(20_000)

    // The deceased claimed early, so RIB-LIM floors the survivor base at 82.5%
    // of PIA. Withheld months credit the survivor reduction away by FRA.
    const y2031 = result.years.find((y) => y.year === 2031)!
    expect(y2031.incomes.socialSecurity).toBeCloseTo(0.825 * 3_000 * 12, 6)
  })

  it('applies the trust-fund haircut from its start year', () => {
    const plan = basePlan()
    plan.incomes = [
      { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 2000, earnings: null, claimAge: { years: 62, months: 0 } },
    ]
    plan.accounts = [cash(2_000_000)]
    plan.assumptions.ssHaircut = { fromYear: 2034, cutPct: 19 }
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const y2033 = result.years.find((y) => y.year === 2033)!
    const y2034 = result.years.find((y) => y.year === 2034)!
    expect(y2034.incomes.socialSecurity).toBeCloseTo(y2033.incomes.socialSecurity * 0.81, 6)
  })

  it('warns and skips when neither PIA nor earnings are provided', () => {
    const plan = basePlan()
    plan.incomes = [
      { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: null, earnings: null, claimAge: { years: 67, months: 0 } },
    ]
    plan.accounts = [cash(2_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
    expect(result.years.every((y) => y.incomes.socialSecurity === 0)).toBe(true)
    expect(result.warnings.join(' ')).toContain('no PIA')
  })

  it('derives PIA from an earnings history (AIME → bend points)', () => {
    const plan = basePlan()
    plan.household.people[0]!.dob = '1962-06-15' // eligibility 2024: published tables
    const earnings = []
    for (let y = 1984; y <= 2023; y++) earnings.push({ year: y, amount: 60_000 })
    plan.incomes = [
      { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: null, earnings, claimAge: { years: 67, months: 0 } },
    ]
    plan.accounts = [cash(2_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const expected = computePiaFromEarnings({
      dobYear: 1962,
      dobMonth: 6,
      dobDay: 15,
      earnings,
      lastEarningsYear: 2023,
    })
    if (isPiaFromEarningsError(expected)) throw new Error(expected.code)
    expect(expected.piaMonthly).toBeGreaterThan(1_000)

    const claimYear = result.years.find((y) => y.year === 2029)! // age 67 = FRA: factor 1
    expect(claimYear.incomes.socialSecurity).toBeCloseTo(expected.piaMonthly * 12, 6)
  })
})

describe('spending, withdrawals, and depletion', () => {
  it('drains cash before taxable before traditional before roth', () => {
    const plan = basePlan()
    plan.expenses.baseAnnual = 50_000
    plan.accounts = [
      { type: 'roth', id: 'roth1', name: 'Roth', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 60_000, annualContribution: 0 },
      traditional(60_000),
      taxable(60_000, 60_000),
      cash(60_000),
    ]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const y1 = result.years[0]!
    expect(y1.withdrawals.cash).toBe(50_000)
    expect(y1.withdrawals.taxable).toBe(0)

    const y2 = result.years[1]!
    expect(y2.withdrawals.cash).toBe(10_000)
    expect(y2.withdrawals.taxable).toBe(40_000)

    const y3 = result.years[2]!
    expect(y3.withdrawals.taxable).toBe(20_000)
    expect(y3.withdrawals.traditional).toBe(30_000)

    const y4 = result.years[3]!
    expect(y4.withdrawals.traditional).toBe(30_000)
    expect(y4.withdrawals.roth).toBe(20_000)
  })

  it('keeps cliff-vesting equity compensation out of withdrawals until the vest year', () => {
    const plan = basePlan()
    plan.assumptions.defaultReturnPct = 0
    plan.expenses.baseAnnual = 50_000
    plan.accounts = [
      { type: 'equityComp', id: 'rsu1', name: 'RSUs', ownerPersonId: 'p1', annualReturnPct: 0, balance: 100_000, costBasis: 70_000, annualContribution: 0, vestingMode: 'cliff', vestDate: '2028-03-15' },
    ]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    expect(result.years[0]!.withdrawals.taxable).toBe(0)
    expect(result.years[0]!.shortfall).toBe(50_000)
    expect(result.years[0]!.netWorth).toBe(100_000)
    expect(result.years.find((y) => y.year === 2028)!.withdrawals.taxable).toBe(50_000)
  })

  it('treats final equity compensation as taxable brokerage for gains', () => {
    const plan = basePlan()
    plan.expenses.baseAnnual = 40_000
    plan.accounts = [
      { type: 'equityComp', id: 'espp1', name: 'ESPP', ownerPersonId: 'p1', annualReturnPct: null, balance: 100_000, costBasis: 25_000, annualContribution: 0, vestingMode: 'final', vestDate: null },
    ]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    expect(result.years[0]!.withdrawals.taxable).toBe(40_000)
    expect(result.years[0]!.realizedGains).toBeCloseTo(30_000, 6)
  })

  it('realizes gains via the basis ratio on taxable withdrawals', () => {
    const plan = basePlan()
    plan.expenses.baseAnnual = 40_000
    plan.accounts = [taxable(100_000, 25_000)] // 75% of every dollar is gain
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const y1 = result.years[0]!
    expect(y1.withdrawals.taxable).toBe(40_000)
    expect(y1.realizedGains).toBeCloseTo(30_000, 6)
  })

  it('records the first shortfall year as depletion', () => {
    const plan = basePlan()
    plan.expenses.baseAnnual = 100_000
    plan.accounts = [cash(250_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    expect(result.depletionYear).toBe(2028) // 100k×2 covered, third year partial
    const depletion = result.years.find((y) => y.year === 2028)!
    expect(depletion.shortfall).toBeCloseTo(50_000, 6)
    expect(result.endingInvestable).toBe(0)
  })

  it('applies spending phases on the primary age axis', () => {
    const plan = basePlan()
    plan.expenses.baseAnnual = 100_000
    plan.expenses.phases = [
      { fromAge: 75, multiplier: 0.8 },
      { fromAge: 85, multiplier: 0.6 },
    ]
    plan.accounts = [cash(10_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    expect(result.years.find((y) => y.year === 2040)!.expenses.baseSpending).toBe(100_000) // age 74
    expect(result.years.find((y) => y.year === 2041)!.expenses.baseSpending).toBe(80_000) // age 75
    expect(result.years.find((y) => y.year === 2051)!.expenses.baseSpending).toBe(60_000) // age 85
  })

  it('inflates base spending and goals', () => {
    const plan = basePlan()
    plan.assumptions.inflationPct = 3
    plan.expenses.baseAnnual = 100_000
    plan.expenses.oneTimeGoals = [{ id: testIds(), label: 'New roof', year: 2028, amount: 30_000 }]
    plan.accounts = [cash(10_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const y2028 = result.years.find((y) => y.year === 2028)!
    expect(y2028.expenses.baseSpending).toBeCloseTo(100_000 * 1.03 ** 2, 4)
    expect(y2028.expenses.oneTimeGoals).toBeCloseTo(30_000 * 1.03 ** 2, 4)
  })
})

describe('taxes (flat placeholder)', () => {
  it('grosses up traditional withdrawals to cover the tax on them', () => {
    const plan = basePlan()
    plan.expenses.baseAnnual = 80_000
    plan.accounts = [traditional(5_000_000)]
    const flat20 = createFlatTaxCalculator(20)
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: flat20 })

    const y1 = result.years[0]!
    // Need w such that w = 80k + 0.2w -> w = 100k.
    expect(y1.withdrawals.traditional).toBeCloseTo(100_000, 0)
    expect(y1.tax).toBeCloseTo(20_000, 0)
    expect(y1.shortfall).toBe(0)
  })

  it('taxes wages and invests the after-tax surplus', () => {
    const plan = basePlan()
    plan.incomes = [wages(100_000)]
    plan.expenses.baseAnnual = 50_000
    plan.accounts = [cash(0)]
    const flat25 = createFlatTaxCalculator(25)
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: flat25 })

    const y1 = result.years[0]!
    expect(y1.tax).toBeCloseTo(25_000, 6)
    expect(y1.surplusInvested).toBeCloseTo(25_000, 6)
    expect(y1.balances[plan.accounts[0]!.id]).toBeCloseTo(25_000, 6)
  })
})

describe('contributions', () => {
  it('caps employer-plan contributions, with the 60–63 super catch-up', () => {
    const plan = basePlan()
    plan.household.people[0]!.dob = '1965-06-15' // age 61 in 2026
    plan.incomes = [wages(300_000)]
    plan.accounts = [cash(0), traditional(0, 60_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const y1 = result.years[0]!
    // 2026: 24,500 + 11,250 super catch-up = 35,750.
    expect(y1.contributions).toBeCloseTo(35_750, 6)
    expect(result.warnings.join(' ')).toContain('IRS annual limits')
  })

  it('stops contributions when wages stop', () => {
    const plan = basePlan()
    plan.incomes = [wages(100_000)]
    plan.accounts = [cash(1_000_000), traditional(0, 10_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const working = result.years.find((y) => y.year === 2032)! // age 66
    const retired = result.years.find((y) => y.year === 2033)! // age 67
    expect(working.contributions).toBe(10_000)
    expect(retired.contributions).toBe(0)
  })

  it('treats traditional contributions as pre-tax', () => {
    const plan = basePlan()
    plan.incomes = [wages(100_000)]
    plan.expenses.baseAnnual = 0
    plan.accounts = [cash(0), traditional(0, 20_000)]
    const flat10 = createFlatTaxCalculator(10)
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: flat10 })

    expect(result.years[0]!.tax).toBeCloseTo(8_000, 6) // 10% of (100k − 20k)
  })
  it('uses scheduled contributions with age windows and escalation for non-employer accounts without wages', () => {
    const plan = basePlan()
    plan.household.people[0]!.dob = '1996-06-15' // age 30 in 2026
    plan.incomes = []
    const brokerage = taxable(0, 0)
    if (brokerage.type !== 'taxable') throw new Error('expected taxable account')
    plan.accounts = [
      cash(50_000),
      {
        ...brokerage,
        contributionSchedule: [{ annualAmount: 1_000, fromAge: 30, toAge: 31, escalationPct: 10 }],
      },
    ]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    expect(result.years.find((y) => y.year === 2026)!.contributions).toBeCloseTo(1_000, 6)
    expect(result.years.find((y) => y.year === 2027)!.contributions).toBeCloseTo(1_100, 6)
    expect(result.years.find((y) => y.year === 2028)!.contributions).toBe(0)
  })

  it('keeps scheduled employer-plan contributions wage-gated', () => {
    const plan = basePlan()
    plan.incomes = []
    const employerPlan = traditional(0, 0)
    if (employerPlan.type !== 'traditional') throw new Error('expected traditional account')
    plan.accounts = [
      cash(50_000),
      {
        ...employerPlan,
        contributionSchedule: [{ annualAmount: 10_000, fromAge: null, toAge: null, escalationPct: 0 }],
      },
    ]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    expect(result.years[0]!.contributions).toBe(0)
  })

  it('adds employer match without using the employee elective-deferral limit', () => {
    const plan = basePlan()
    plan.incomes = [wages(100_000)]
    const employerPlan = traditional(0, 10_000)
    if (employerPlan.type !== 'traditional') throw new Error('expected traditional account')
    plan.accounts = [
      cash(0),
      {
        ...employerPlan,
        employerMatch: { matchPct: 50, capPctOfPay: 6 },
      },
    ]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const y1 = result.years[0]!
    expect(y1.contributions).toBeCloseTo(10_000, 6)
    expect(y1.employerMatch).toBeCloseTo(3_000, 6)
    expect(y1.balances[plan.accounts[1]!.id]).toBeCloseTo(13_000, 6)
  })

  it('caps employer match by the section 415(c) total-additions limit', () => {
    const plan = basePlan()
    plan.household.people[0]!.dob = '1990-06-15' // no catch-up
    plan.incomes = [wages(2_000_000)]
    const employerPlan = traditional(0, 24_500)
    if (employerPlan.type !== 'traditional') throw new Error('expected traditional account')
    plan.accounts = [
      cash(0),
      {
        ...employerPlan,
        employerMatch: { matchPct: 500, capPctOfPay: 100 },
      },
    ]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const y1 = result.years[0]!
    expect(y1.contributions).toBeCloseTo(24_500, 6)
    expect(y1.employerMatch).toBeCloseTo(72_000 - 24_500, 6)
  })
})

describe('growth, pensions, property, debt', () => {
  it('applies per-account and default growth after flows', () => {
    const plan = basePlan()
    plan.assumptions.defaultReturnPct = 10
    plan.accounts = [cash(100_000), { ...taxable(100_000, 100_000), annualReturnPct: 5 }]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const y1 = result.years[0]!
    expect(y1.balances[plan.accounts[0]!.id]).toBeCloseTo(110_000, 6)
    expect(y1.balances[plan.accounts[1]!.id]).toBeCloseTo(105_000, 6)
  })

  it('pays pension survivor percentage after the owner dies', () => {
    const plan = basePlan()
    plan.household.filingStatus = 'marriedFilingJointly'
    plan.household.people = [
      plan.household.people[0]!,
      { id: 'p2', name: 'Sam', dob: '1966-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 80, source: 'manual' } },
    ]
    plan.accounts = [
      cash(5_000_000),
      { type: 'pension', id: 'pen1', name: 'Pension', ownerPersonId: 'p2', annualReturnPct: null, startAge: 65, monthlyAmount: 3000, colaPct: 0, survivorPct: 50 },
    ]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const whileAlive = result.years.find((y) => y.year === 2046)! // p2 age 80 (last alive year)
    const afterDeath = result.years.find((y) => y.year === 2047)!
    expect(whileAlive.incomes.pension).toBeCloseTo(36_000, 6)
    expect(afterDeath.incomes.pension).toBeCloseTo(18_000, 6)
  })

  it('sells property in the planned year and deposits proceeds', () => {
    const plan = basePlan()
    plan.accounts = [
      cash(0),
      { type: 'property', id: 'home', name: 'Home', ownerPersonId: null, annualReturnPct: null, value: 500_000, plannedSaleYear: 2030, expectedNetProceeds: 450_000 },
    ]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const saleYear = result.years.find((y) => y.year === 2030)!
    expect(saleYear.balances['home']).toBe(0)
    expect(saleYear.balances[plan.accounts[0]!.id]).toBeCloseTo(450_000, 6)
  })

  it('amortizes debt and counts payments as expenses until payoff', () => {
    const plan = basePlan()
    plan.accounts = [
      cash(1_000_000),
      { type: 'debt', id: 'mort', name: 'Mortgage', ownerPersonId: null, annualReturnPct: null, balance: 100_000, interestPct: 4, monthlyPayment: 2_000 },
    ]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const y1 = result.years[0]!
    expect(y1.expenses.debtService).toBe(24_000)
    expect(y1.balances['mort']).toBeCloseTo(100_000 * 1.04 - 24_000, 6)

    const payoffReached = result.years.find((y) => y.balances['mort'] === 0)
    expect(payoffReached).toBeDefined()
    const after = result.years.find((y) => y.year === payoffReached!.year + 1)!
    expect(after.expenses.debtService).toBe(0)
    // Net worth reflects debt while outstanding.
    expect(y1.netWorth).toBeCloseTo(y1.investableTotal - y1.balances['mort']!, 6)
  })
})

describe('RMDs', () => {
  /** Born 1953 -> RMD start age 73 -> first RMD in 2026 in these tests. */
  function rmdPlan(): Plan {
    const plan = basePlan()
    plan.household.people[0]!.dob = '1953-06-15'
    plan.household.people[0]!.retirementAge = null
    plan.accounts = [cash(0), traditional(265_000)]
    return plan
  }

  it('forces distributions from the prior-year balance and reinvests the excess', () => {
    const plan = rmdPlan()
    const cashId = plan.accounts[0]!.id
    const traditionalId = plan.accounts[1]!.id
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const y2026 = result.years.find((y) => y.year === 2026)! // age 73
    expect(y2026.rmd).toBeCloseTo(265_000 / 26.5, 6) // 10,000
    expect(y2026.withdrawals.traditional).toBeCloseTo(10_000, 6)
    expect(y2026.balances[traditionalId]).toBeCloseTo(255_000, 6)
    // 65+: standard Part B is charged automatically; the rest of the RMD lands in cash.
    expect(y2026.expenses.healthcare).toBeCloseTo(202.9 * 12, 6)
    expect(y2026.surplusInvested).toBeCloseTo(10_000 - 202.9 * 12, 6)
    expect(y2026.balances[cashId]).toBeCloseTo(10_000 - 202.9 * 12, 6)

    const y2027 = result.years.find((y) => y.year === 2027)! // age 74, divisor 25.5
    expect(y2027.rmd).toBeCloseTo(255_000 / 25.5, 6) // exactly 10,000 again
  })

  it('does not force distributions before the start age (born 1960 -> 75)', () => {
    const plan = rmdPlan()
    plan.household.people[0]!.dob = '1960-06-15'
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    expect(result.years.find((y) => y.year === 2034)!.rmd).toBe(0) // age 74
    expect(result.years.find((y) => y.year === 2035)!.rmd).toBeGreaterThan(0) // age 75
  })

  it('uses the joint-life divisor only when the spouse is flagged sole beneficiary', () => {
    const make = (soleBeneficiary: boolean): Plan => {
      const plan = basePlan()
      plan.household.filingStatus = 'marriedFilingJointly'
      plan.household.people = [
        { id: 'p1', name: 'A', dob: '1953-06-15', sex: 'male', retirementAge: null, longevity: { planningAge: 95, source: 'manual' } },
        { id: 'p2', name: 'B', dob: '1970-06-15', sex: 'female', retirementAge: null, longevity: { planningAge: 95, source: 'manual' } }, // 17 yrs younger
      ]
      plan.accounts = [cash(0), { ...(traditional(265_000, 0, 'p1') as Extract<Account, { type: 'traditional' }>), spouseSoleBeneficiary: soleBeneficiary }]
      return validate(plan)
    }
    const flagged = simulatePlan(make(true), { startYear: 2026, taxCalculator: noTax }).years.find((y) => y.year === 2026)!.rmd
    const unflagged = simulatePlan(make(false), { startYear: 2026, taxCalculator: noTax }).years.find((y) => y.year === 2026)!.rmd
    expect(unflagged).toBeCloseTo(265_000 / 26.5, 6) // Uniform Lifetime Table
    expect(flagged).toBeGreaterThan(0)
    expect(flagged).toBeLessThan(unflagged) // joint-life divisor is larger → smaller RMD
  })

  it('skips one-time goals once everyone has died on an extended horizon', () => {
    const plan = basePlan() // single person p1, born 1966
    plan.expenses.baseAnnual = 0
    plan.expenses.oneTimeGoals = [{ id: 'g', label: 'Post-death goal', year: 2056, amount: 100_000 }] // age 90
    plan.accounts = [cash(500_000)]
    const result = simulatePlan(validate(plan), {
      startYear: 2026,
      taxCalculator: noTax,
      deathAgeByPersonId: { p1: 80 }, // dies at 80 (2046)
      horizonEndYear: 2066, // run to age 100
    })
    expect(result.years.find((y) => y.year === 2056)!.expenses.oneTimeGoals).toBe(0) // post-death: not charged
  })

  it('treats RMD income as taxable ordinary income', () => {
    const flat10 = createFlatTaxCalculator(10)
    const result = simulatePlan(validate(rmdPlan()), { startYear: 2026, taxCalculator: flat10 })

    const y2026 = result.years.find((y) => y.year === 2026)!
    expect(y2026.tax).toBeCloseTo(1_000, 6) // 10% of the 10,000 RMD
    expect(y2026.surplusInvested).toBeCloseTo(9_000 - y2026.expenses.healthcare, 6)
  })

  it('routes QCD dollars out of the RMD, untaxed', () => {
    const plan = rmdPlan()
    plan.strategies.qcdAnnual = 4_000
    const flat10 = createFlatTaxCalculator(10)
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: flat10 })

    const y2026 = result.years.find((y) => y.year === 2026)! // age 73 ≥ 71: eligible
    expect(y2026.rmd).toBeCloseTo(10_000, 6)
    expect(y2026.qcd).toBeCloseTo(4_000, 6)
    expect(y2026.tax).toBeCloseTo(600, 6) // 10% of the remaining 6,000
    expect(y2026.magi).toBeCloseTo(6_000, 6)
  })
})

describe('federal tax integration', () => {
  it('keeps taxable-exhausted traditional funding self-consistent after the quick tax loop would miss it', () => {
    const plan = basePlan()
    plan.expenses.baseAnnual = 100_000
    plan.accounts = [traditional(2_000_000)]
    // A 50% marginal rate needs more than eight simple fixed-point iterations
    // from zero to settle this $100k traditional-only spending draw.
    const flat50 = createFlatTaxCalculator(50)
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: flat50 })

    const y1 = result.years[0]!
    const recomputedTax = flat50.compute({
      year: y1.year,
      filingStatus: 'single',
      ordinaryIncome: y1.withdrawals.traditional,
      capitalGains: 0,
      ssBenefits: 0,
      peopleAged65Plus: 0,
    })
    expect(Math.abs(y1.tax - recomputedTax)).toBeLessThan(0.005)
    expect(Math.abs(y1.withdrawals.traditional - (y1.expenses.total + y1.tax))).toBeLessThan(0.005)
  })

  it('self-consistently grosses up traditional withdrawals under real brackets', () => {
    const plan = basePlan()
    plan.household.people[0]!.dob = '1960-06-15' // 66 in 2026
    plan.household.people[0]!.retirementAge = null
    plan.expenses.baseAnnual = 60_000
    plan.accounts = [traditional(2_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: createFederalTaxCalculator() })

    const y1 = result.years[0]!
    expect(y1.shortfall).toBe(0)
    // Spending now includes the automatic Part B premium at 66.
    expect(y1.withdrawals.traditional).toBeCloseTo(y1.expenses.total + y1.tax, 1)
    expect(y1.expenses.healthcare).toBeCloseTo(202.9 * 12, 6)
    // The converged tax matches the detailed engine for the income actually realized.
    const check = computeFederalTax({
      year: 2026,
      filingStatus: 'single',
      ordinaryIncome: y1.withdrawals.traditional,
      capitalGains: 0,
      ssBenefits: 0,
      peopleAged65Plus: 1,
    })
    expect(Math.abs(y1.tax - check.totalTax)).toBeLessThan(0.005)
    // ~$4.6k: 12% bracket after standard + 65 addition + senior deduction.
    expect(y1.tax).toBeGreaterThan(3_000)
    expect(y1.tax).toBeLessThan(8_000)
  })

  it('keeps low-income retirees with SS at zero federal tax', () => {
    const plan = basePlan()
    plan.household.people[0]!.dob = '1958-06-15' // 68 in 2026, FRA cohort 66+8mo
    plan.household.people[0]!.retirementAge = null
    plan.expenses.baseAnnual = 30_000
    plan.incomes = [
      { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 2000, earnings: null, claimAge: { years: 67, months: 0 } },
    ]
    plan.accounts = [cash(500_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: createFederalTaxCalculator() })

    // SS ≈ 24k+ and small cash top-ups -> provisional income below the threshold.
    expect(result.years[0]!.tax).toBe(0)
  })
})

describe('healthcare and penalties', () => {
  it('uses the default healthcare spread of inflation plus 3 percentage points', () => {
    const plan = basePlan()
    plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 1_000, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
    plan.accounts = [cash(2_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const y2028 = result.years.find((y) => y.year === 2028)!
    expect(plan.assumptions.healthcareExtraInflationPct).toBe(3)
    expect(y2028.expenses.healthcare).toBeCloseTo(12_000 * Math.pow(1.03, 2), 6)
  })

  it('applies the ACA credit against prior-year MAGI before 65', () => {
    const plan = basePlan() // born 1966 -> 60 in 2026
    plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 1_000, applyAcaCredit: true, medicareExtrasMonthlyPerPerson: 0 }
    plan.assumptions.recentAnnualMagi = 30_000
    plan.accounts = [cash(2_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const y1 = result.years[0]!
    // ~192% FPL -> expected contribution ≈ 6.2% of 30k; net premium = contribution.
    expect(y1.expenses.healthcare).toBeGreaterThan(1_500)
    expect(y1.expenses.healthcare).toBeLessThan(2_500)
  })

  it('subtracts the household ACA expected contribution once for a couple both under 65', () => {
    const plan = basePlan() // p1 born 1966 -> 60 in 2026
    plan.household.people.push({
      id: 'p2',
      name: 'Sam',
      dob: '1966-06-15',
      sex: 'average',
      retirementAge: 67,
      longevity: { planningAge: 90, source: 'manual' },
    })
    plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 1_000, applyAcaCredit: true, medicareExtrasMonthlyPerPerson: 0 }
    plan.assumptions.recentAnnualMagi = 30_000
    plan.accounts = [cash(2_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const y1 = result.years[0]!
    // Household of 2: 30k MAGI vs 21,150 FPL ≈ 142% -> applicable pct ≈ 3.7%,
    // expected contribution ≈ $1.1k. The net household premium equals that
    // contribution once; charging it per covered spouse would double it (≈ $2.2k).
    expect(y1.expenses.healthcare).toBeGreaterThan(900)
    expect(y1.expenses.healthcare).toBeLessThan(1_400)
  })

  it('charges the full premium over the 400% FPL cliff, with a warning', () => {
    const plan = basePlan()
    plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 1_000, applyAcaCredit: true, medicareExtrasMonthlyPerPerson: 0 }
    plan.assumptions.recentAnnualMagi = 70_000 // 447% FPL
    plan.accounts = [cash(2_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    expect(result.years[0]!.expenses.healthcare).toBeCloseTo(12_000, 6)
    expect(result.warnings.join(' ')).toContain('400%')
  })

  it('prorates ACA and Medicare by birth month in the year a person turns 65', () => {
    const plan = basePlan()
    plan.household.people[0]!.dob = '1961-06-15' // turns 65 in June 2026
    plan.household.people[0]!.retirementAge = null
    plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 1_000, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 100 }
    plan.accounts = [cash(2_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    // June birthday: 5 marketplace months (Jan–May), 7 Medicare months.
    // Base Part B is 202.90/mo with no IRMAA (MAGI lookback ≈ 0).
    const y2026 = result.years.find((y) => y.year === 2026)!
    expect(y2026.expenses.healthcare).toBeCloseTo(5 * 1_000 + 202.9 * 7 + 100 * 7, 4)
    // The year after is all Medicare — no marketplace months left.
    const y2027 = result.years.find((y) => y.year === 2027)!
    expect(y2027.expenses.healthcare).toBeCloseTo((202.9 * 12 + 100 * 12) * 1.03, 4)
  })

  it('prorates the ACA expected contribution to covered months in the transition year', () => {
    const plan = basePlan()
    plan.household.people[0]!.dob = '1961-06-15' // turns 65 in June 2026: 5 marketplace months
    plan.household.people[0]!.retirementAge = null
    plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 1_000, applyAcaCredit: true, medicareExtrasMonthlyPerPerson: 0 }
    plan.assumptions.recentAnnualMagi = 30_000
    plan.accounts = [cash(2_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    // 30k MAGI ≈ 192% FPL -> expected contribution ≈ $1.86k/yr ≈ $155/mo. The
    // PTC is monthly, so five covered months net ≈ 5 × $155 ≈ $775 — NOT the
    // full-year ≈ $1.86k contribution — plus seven Medicare months (≈ $1.42k).
    const y2026 = result.years[0]!
    expect(y2026.expenses.healthcare).toBeGreaterThan(2_100)
    expect(y2026.expenses.healthcare).toBeLessThan(2_300)
  })

  it('keeps a January-born 65th year entirely on Medicare', () => {
    const plan = basePlan()
    plan.household.people[0]!.dob = '1961-01-15' // turns 65 in January 2026
    plan.household.people[0]!.retirementAge = null
    plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 1_000, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
    plan.accounts = [cash(2_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    // January birth month -> 0 marketplace months; identical to the old
    // full-year Medicare switch.
    expect(result.years.find((y) => y.year === 2026)!.expenses.healthcare).toBeCloseTo(202.9 * 12, 4)
  })

  it('raises Medicare premiums two years after an income spike (IRMAA lookback)', () => {
    const plan = basePlan()
    plan.household.people[0]!.dob = '1960-06-15' // 66 in 2026, on Medicare
    plan.household.people[0]!.retirementAge = null
    plan.incomes = [
      { type: 'oneTime', id: testIds(), label: 'Windfall', year: 2027, amount: 300_000, taxTreatment: 'ordinary' },
    ]
    plan.accounts = [cash(3_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    expect(result.years.find((y) => y.year === 2027)!.magi).toBeGreaterThanOrEqual(300_000)
    const baselineYear = result.years.find((y) => y.year === 2028)! // looks back at 2026 MAGI ≈ 0
    const spikeYear = result.years.find((y) => y.year === 2029)! // looks back at 2027 MAGI = 300k
    const healthInfl = (y: number) => Math.pow(1.03, y - 2026) // inflation 0 + 3% healthcare extra
    expect(baselineYear.expenses.healthcare).toBeCloseTo(202.9 * 12 * healthInfl(2028), 4)
    // 300k (vs thresholds unscaled at 0% inflation) -> tier 4 = 3.2× Part B + $83.30/mo Part D.
    expect(spikeYear.expenses.healthcare).toBeCloseTo((202.9 * 3.2 + 83.3) * 12 * healthInfl(2029), 4)
  })

  it('grosses up the 10% early-withdrawal penalty on pre-59½ traditional draws', () => {
    const plan = basePlan()
    plan.household.people[0]!.dob = '1976-06-15' // 50 in 2026
    plan.expenses.baseAnnual = 50_000
    plan.accounts = [traditional(1_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const y1 = result.years[0]!
    // w = 50,000 + 0.1w -> w = 55,555.56
    expect(y1.withdrawals.traditional).toBeCloseTo(55_555.56, 1)
    expect(y1.penalties).toBeCloseTo(5_555.56, 1)
    expect(y1.shortfall).toBe(0)
    expect(result.warnings.join(' ')).toContain('penalties')

    // Penalties stop once the owner reaches 60 (2036).
    expect(result.years.find((y) => y.year === 2036)!.penalties).toBe(0)
  })
})

describe('Roth conversions', () => {
  function roth(balance: number): Account {
    return { type: 'roth', id: testIds(), name: 'Roth', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance, annualContribution: 0 }
  }

  function retireePlan(): Plan {
    const plan = basePlan()
    plan.household.people[0]! = {
      ...plan.household.people[0]!,
      dob: '1960-06-15', // 66 in 2026; RMDs not until 75
      retirementAge: null,
    }
    return plan
  }

  it('executes manual conversions: balances move, income is taxed, no penalty', () => {
    const plan = retireePlan()
    plan.accounts = [cash(200_000), traditional(500_000), roth(0)]
    plan.strategies.rothConversion = { mode: 'manual', conversions: [{ year: 2027, amount: 50_000 }] }
    const flat20 = createFlatTaxCalculator(20)
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: flat20 })

    const y2027 = result.years.find((y) => y.year === 2027)!
    expect(y2027.rothConversion).toBe(50_000)
    expect(y2027.balances[plan.accounts[1]!.id]).toBeCloseTo(450_000, 6)
    expect(y2027.balances[plan.accounts[2]!.id]).toBeCloseTo(50_000, 6)
    expect(y2027.tax).toBeCloseTo(10_000, 6)
    expect(y2027.penalties).toBe(0)
    expect(y2027.magi).toBeCloseTo(50_000, 6)
    // Conversion tax + Medicare premiums came out of cash, not the conversion.
    expect(y2027.withdrawals.traditional).toBe(0)
  })

  it('skips conversions with a warning when no Roth account exists', () => {
    const plan = retireePlan()
    plan.accounts = [cash(200_000), traditional(500_000)]
    plan.strategies.rothConversion = { mode: 'manual', conversions: [{ year: 2026, amount: 50_000 }] }
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    expect(result.years[0]!.rothConversion).toBe(0)
    expect(result.warnings.join(' ')).toContain('no Roth account')
  })

  it('fills to the top of the 12% bracket under the federal engine', () => {
    const plan = retireePlan()
    plan.accounts = [cash(300_000), traditional(1_000_000), roth(0)]
    plan.strategies.rothConversion = {
      mode: 'fillToTarget',
      target: 'topOfBracket',
      targetValue: 12,
      startYear: 2026,
      endYear: 2026,
    }
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: createFederalTaxCalculator() })

    const y1 = result.years[0]!
    // Deductions at 66: 16,100 + 2,050 + 6,000 senior = 24,150; top of 12% = 50,400.
    expect(y1.rothConversion).toBeCloseTo(74_550, 0)
    expect(y1.magi).toBeCloseTo(74_550, 0)
    // Outside the window: nothing converts.
    expect(result.years.find((y) => y.year === 2027)!.rothConversion).toBe(0)
  })

  it('fills to the ACA cliff for a pre-65 retiree', () => {
    const plan = basePlan() // born 1966 -> 60 in 2026
    plan.accounts = [cash(300_000), traditional(1_000_000), roth(0)]
    plan.strategies.rothConversion = {
      mode: 'fillToTarget',
      target: 'acaCliff',
      targetValue: null,
      startYear: 2026,
      endYear: 2026,
    }
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: createFederalTaxCalculator() })

    expect(result.years[0]!.rothConversion).toBeCloseTo(15_650 * 4, 0)
  })

  it('warns when spending withdrawals push income past the conversion target', () => {
    const plan = retireePlan()
    plan.expenses.baseAnnual = 100_000
    plan.accounts = [traditional(1_000_000), roth(0)]
    plan.strategies.rothConversion = {
      mode: 'fillToTarget',
      target: 'topOfBracket',
      targetValue: 12,
      startYear: 2026,
      endYear: 2030,
    }
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: createFederalTaxCalculator() })

    expect(result.years[0]!.rothConversion).toBeGreaterThan(0)
    expect(result.years[0]!.withdrawals.traditional).toBeGreaterThan(0)
    expect(result.warnings.join(' ')).toContain('above the Roth-conversion target')
  })
})

describe('withdrawal strategies', () => {
  it('proportional draws pro-rata across cash, taxable, and traditional', () => {
    const plan = basePlan() // age 60: no early-withdrawal penalty at >= 60
    plan.expenses.baseAnnual = 40_000
    plan.strategies.withdrawalOrder = { mode: 'proportional' }
    plan.accounts = [cash(100_000), taxable(100_000, 100_000), traditional(200_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const y1 = result.years[0]!
    expect(y1.withdrawals.cash).toBeCloseTo(10_000, 4)
    expect(y1.withdrawals.taxable).toBeCloseTo(10_000, 4)
    expect(y1.withdrawals.traditional).toBeCloseTo(20_000, 4)
    expect(y1.withdrawals.total).toBeCloseTo(40_000, 4)
    expect(y1.shortfall).toBe(0)
  })

  it('proportional drains the whole pool and reports the shortfall when insufficient', () => {
    const plan = basePlan()
    plan.expenses.baseAnnual = 250_000
    plan.strategies.withdrawalOrder = { mode: 'proportional' }
    plan.accounts = [cash(10_000), traditional(190_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const y1 = result.years[0]!
    expect(y1.withdrawals.cash).toBeCloseTo(10_000, 2)
    expect(y1.withdrawals.traditional).toBeCloseTo(190_000, 2)
    expect(y1.shortfall).toBeCloseTo(50_000, 2)
    expect(result.depletionYear).toBe(2026)
  })

  it('bracket-targeted fills traditional to the bracket top, remainder from taxable', () => {
    const plan = basePlan()
    plan.household.people[0]! = { ...plan.household.people[0]!, dob: '1960-06-15', retirementAge: null } // 66
    plan.expenses.baseAnnual = 90_000
    plan.strategies.withdrawalOrder = { mode: 'bracketTargeted', bracketPct: 12 }
    plan.accounts = [traditional(1_000_000), taxable(500_000, 500_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: createFederalTaxCalculator() })

    const y1 = result.years[0]!
    // Headroom: deductions 24,150 + 50,400 bracket top = 74,550 from traditional.
    expect(y1.withdrawals.traditional).toBeCloseTo(74_550, 0)
    expect(y1.magi).toBeCloseTo(74_550, 0)
    // Remainder (spending + Part B + tax − traditional) from taxable, gains-free here.
    expect(y1.withdrawals.taxable).toBeCloseTo(90_000 + y1.expenses.healthcare + y1.tax - 74_550, 0)
    expect(y1.tax).toBeCloseTo(5_800, 0) // brackets on exactly 50,400
    expect(y1.shortfall).toBe(0)
  })

  it('bracket-targeted uses available equity compensation before returning to traditional', () => {
    const plan = basePlan()
    plan.household.people[0]! = { ...plan.household.people[0]!, dob: '1960-06-15', retirementAge: null }
    plan.expenses.baseAnnual = 100_000
    plan.strategies.withdrawalOrder = { mode: 'bracketTargeted', bracketPct: 10 }
    plan.accounts = [
      traditional(1_000_000),
      { type: 'equityComp', id: 'rsu1', name: 'RSUs', ownerPersonId: 'p1', annualReturnPct: 0, balance: 80_000, costBasis: 80_000, annualContribution: 0, vestingMode: 'final', vestDate: null },
    ]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: createFederalTaxCalculator() })

    const y1 = result.years[0]!
    expect(y1.withdrawals.traditional).toBeGreaterThan(0)
    expect(y1.withdrawals.taxable).toBeGreaterThan(0)
    expect(y1.withdrawals.taxable).toBeLessThanOrEqual(80_000)
    expect(y1.shortfall).toBe(0)
  })

  it('bracket-targeted leaves traditional for last once the bracket is full', () => {
    const plan = basePlan()
    plan.household.people[0]! = { ...plan.household.people[0]!, dob: '1960-06-15', retirementAge: null }
    plan.expenses.baseAnnual = 120_000
    plan.strategies.withdrawalOrder = { mode: 'bracketTargeted', bracketPct: 12 }
    plan.incomes = [
      { type: 'recurring', id: testIds(), label: 'Pension-like', annualAmount: 100_000, startYear: null, endYear: null, inflationAdjusted: false, taxTreatment: 'ordinary' },
    ]
    plan.accounts = [traditional(1_000_000), cash(500_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: createFederalTaxCalculator() })

    const y1 = result.years[0]!
    // 100k ordinary income already exceeds the 12% top: no traditional draws.
    expect(y1.withdrawals.traditional).toBe(0)
    expect(y1.withdrawals.cash).toBeGreaterThan(0)
  })
})

describe('determinism', () => {
  it('produces identical results on repeated runs', () => {
    const plan = basePlan()
    plan.assumptions.inflationPct = 2.5
    plan.assumptions.defaultReturnPct = 6
    plan.incomes = [
      wages(120_000),
      { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 2500, earnings: null, claimAge: { years: 67, months: 0 } },
    ]
    plan.expenses.baseAnnual = 70_000
    plan.accounts = [cash(50_000), taxable(300_000, 200_000), traditional(800_000, 15_000)]
    const validated = validate(plan)
    const tax = createFlatTaxCalculator(18)

    const a = simulatePlan(validated, { startYear: 2026, taxCalculator: tax })
    const b = simulatePlan(validated, { startYear: 2026, taxCalculator: tax })
    expect(a).toEqual(b)
    expect(a.years.length).toBeGreaterThan(25)
  })
})

describe('taxable brokerage yield tax drag', () => {
  it('taxes annual qualified dividends and makes same-return taxable growth more conservative', () => {
    const dividendPlan = basePlan()
    dividendPlan.accounts = [
      {
        ...taxable(1_000_000, 1_000_000),
        annualReturnPct: 7,
        dividendYieldPct: 10,
        qualifiedRatio: 1,
        reinvestDividends: true,
      },
    ]

    const noYieldPlan = basePlan()
    noYieldPlan.accounts = [{ ...taxable(1_000_000, 1_000_000), annualReturnPct: 7 }]

    const withYield = simulatePlan(validate(dividendPlan), { startYear: 2026, taxCalculator: createFederalTaxCalculator() }).years[0]!
    const withoutYield = simulatePlan(validate(noYieldPlan), { startYear: 2026, taxCalculator: createFederalTaxCalculator() }).years[0]!

    expect(withYield.incomes.qualifiedDividends).toBeCloseTo(100_000, 6)
    expect(withYield.taxableYield).toBeCloseTo(100_000, 6)
    expect(withYield.tax).toBeGreaterThan(withoutYield.tax)
    expect(withYield.magi).toBeGreaterThan(99_000)
    expect(withYield.investableTotal).toBeLessThan(withoutYield.investableTotal)
  })

  it('adds reinvested dividends to basis before future taxable withdrawals', () => {
    const plan = basePlan()
    plan.household.people[0]!.longevity.planningAge = 61
    plan.accounts = [
      {
        ...taxable(1_000_000, 1_000_000),
        annualReturnPct: 10,
        dividendYieldPct: 10,
        qualifiedRatio: 1,
        reinvestDividends: true,
      },
    ]
    plan.expenses.oneTimeGoals = [{ id: 'goal', label: 'Spend', year: 2027, amount: 50_000 }]

    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
    expect(result.years.find((y) => y.year === 2026)!.balances[plan.accounts[0]!.id]).toBeCloseTo(1_100_000, 6)
    const y2027 = result.years.find((y) => y.year === 2027)!
    expect(y2027.withdrawals.taxable).toBeCloseTo(50_000, 6)
    expect(y2027.realizedGains).toBeCloseTo(0, 6)
  })
})

describe('state tax integration', () => {
  /** Retiree drawing from a traditional account to fund spending (taxable income). */
  function stateRetiree(state: string): Plan {
    const plan = basePlan()
    plan.household.people[0]!.dob = '1958-06-15' // 68 in 2026
    plan.household.people[0]!.retirementAge = null
    plan.household.state = state
    plan.expenses.baseAnnual = 60_000
    plan.accounts = [traditional(1_500_000)]
    return plan
  }

  const stateStack = combineTaxCalculators(createFederalTaxCalculator(), createStateTaxCalculator())

  it('charges state tax in a taxing state and none in a no-tax state', () => {
    const ky = simulatePlan(validate(stateRetiree('KY')), { startYear: 2026, taxCalculator: stateStack })
    const fl = simulatePlan(validate(stateRetiree('FL')), { startYear: 2026, taxCalculator: stateStack })
    const kyTax = ky.years[0]!.tax
    const flTax = fl.years[0]!.tax
    expect(kyTax).toBeGreaterThan(flTax)
    // FL has no income tax, so its first-year tax is purely federal.
    const federalOnly = simulatePlan(validate(stateRetiree('FL')), { startYear: 2026, taxCalculator: createFederalTaxCalculator() })
    expect(flTax).toBeCloseTo(federalOnly.years[0]!.tax, 6)
  })

  it('switches state rules at a relocation year', () => {
    const plan = stateRetiree('FL')
    plan.household.stateMoves = [{ fromYear: 2030, fromMonth: 7, state: 'KY' }]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: stateStack })
    const before = result.years.find((y) => y.year === 2029)!
    const after = result.years.find((y) => y.year === 2031)!
    // FL years pay no state tax; KY years (post-move) do, so tax rises.
    expect(after.tax).toBeGreaterThan(before.tax)
  })

  it('warns when the residence state is not modeled and there is no override', () => {
    const plan = stateRetiree('ZZ') // unknown code (all 50 + DC are modeled), override 0
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: stateStack })
    expect(result.warnings.some((w) => w.includes('ZZ') && w.includes("isn't modeled"))).toBe(true)
    // No warning for a modeled state.
    const ky = simulatePlan(validate(stateRetiree('KY')), { startYear: 2026, taxCalculator: stateStack })
    expect(ky.warnings.some((w) => w.includes("isn't modeled"))).toBe(false)
  })

  it('does not warn about an unmodeled state when a flat override is set', () => {
    const plan = stateRetiree('ZZ')
    plan.assumptions.stateEffectiveTaxPct = 5
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: stateStack })
    expect(result.warnings.some((w) => w.includes("isn't modeled"))).toBe(false)
  })

  it('honors the flat override regardless of modeled state', () => {
    const overrideStack = combineTaxCalculators(createFederalTaxCalculator(), createStateTaxCalculator({ overridePct: 6 }))
    const fl = simulatePlan(validate(stateRetiree('FL')), { startYear: 2026, taxCalculator: overrideStack })
    // Even no-tax FL pays the explicit override on top of federal.
    const federalOnly = simulatePlan(validate(stateRetiree('FL')), { startYear: 2026, taxCalculator: createFederalTaxCalculator() })
    expect(fl.years[0]!.tax).toBeGreaterThan(federalOnly.years[0]!.tax)
  })

  it('adds the optional local income tax rate through the standard tax stack', () => {
    const plan = stateRetiree('KY')
    const noLocal = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: stateStack })
    plan.assumptions.localIncomeTaxPct = 3
    const withLocalStack = combineTaxCalculators(
      createFederalTaxCalculator(),
      createStateTaxCalculator({ localPct: plan.assumptions.localIncomeTaxPct }),
    )
    const withLocal = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: withLocalStack })
    expect(withLocal.years[0]!.tax).toBeGreaterThan(noLocal.years[0]!.tax)
  })
})

describe('survivor filing-status transitions', () => {
  function filingTransitionPlan(hasQualifyingDependent: boolean): Plan {
    const plan = basePlan()
    plan.household.filingStatus = 'marriedFilingJointly'
    plan.household.hasQualifyingDependent = hasQualifyingDependent
    plan.household.people = [
      { id: 'p1', name: 'Pat', dob: '1960-01-01', sex: 'average', retirementAge: null, longevity: { planningAge: 70, source: 'manual' } },
      { id: 'p2', name: 'Sam', dob: '1960-01-01', sex: 'average', retirementAge: null, longevity: { planningAge: 66, source: 'manual' } },
    ]
    plan.incomes = [
      { type: 'recurring', id: testIds(), label: 'Consulting', annualAmount: 120_000, startYear: null, endYear: null, inflationAdjusted: false, taxTreatment: 'ordinary' },
    ]
    plan.accounts = [cash(1_000_000)]
    return plan
  }

  it('keeps the death year joint, then uses single without the QSS opt-in', () => {
    const result = simulatePlan(validate(filingTransitionPlan(false)), { startYear: 2026, taxCalculator: createFederalTaxCalculator() })
    expect(result.years.find((y) => y.year === 2026)!.filingStatus).toBe('marriedFilingJointly')
    expect(result.years.find((y) => y.year === 2027)!.filingStatus).toBe('single')
  })

  it('uses qualifying surviving spouse for the two years after death when opted in', () => {
    const result = simulatePlan(validate(filingTransitionPlan(true)), { startYear: 2026, taxCalculator: createFederalTaxCalculator() })
    expect(result.years.find((y) => y.year === 2026)!.filingStatus).toBe('marriedFilingJointly')
    expect(result.years.find((y) => y.year === 2027)!.filingStatus).toBe('qualifyingSurvivingSpouse')
    expect(result.years.find((y) => y.year === 2028)!.filingStatus).toBe('qualifyingSurvivingSpouse')
    expect(result.years.find((y) => y.year === 2029)!.filingStatus).toBe('single')
  })
})

describe('stateMoves back-compat', () => {
  it('parses a plan with no stateMoves and defaults to an empty list', () => {
    const plan = createEmptyPlan({ newId: testIds, now: fixedNow }) as unknown as Record<string, unknown>
    const household = plan.household as Record<string, unknown>
    delete household.stateMoves
    const parsed = parsePlan(plan)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.plan.household.stateMoves).toEqual([])
  })
})

describe('tax-depth review fixes (PR #38)', () => {
  it('never converts an inherited account (it follows the 10-year rule)', () => {
    const plan = basePlan()
    plan.accounts = [
      { type: 'traditional', id: 'inh', name: 'Inherited', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 300_000, annualContribution: 0, inherited: { ownerDeathYear: 2024, decedentHadStartedRmds: false } } as Account,
      { type: 'roth', id: 'r', name: 'Roth', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 0, annualContribution: 0 } as Account,
      cash(100_000),
    ]
    plan.strategies.rothConversion = { mode: 'manual', conversions: [{ year: 2027, amount: 50_000 }] }
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
    const y2027 = result.years.find((y) => y.year === 2027)!
    expect(y2027.rothConversion).toBe(0) // inherited can't be a conversion source
    expect(y2027.balances['inh']).toBe(300_000) // untouched (no forced dist, no conversion)
  })

  it('sizes fill-to-target conversions against itemized deductions when larger', () => {
    const make = (itemize: boolean): Plan => {
      const plan = basePlan()
      plan.accounts = [
        { type: 'traditional', id: 't', name: 'IRA', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 1_000_000, annualContribution: 0 } as Account,
        { type: 'roth', id: 'r', name: 'Roth', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 0, annualContribution: 0 } as Account,
        cash(200_000),
      ]
      plan.strategies.rothConversion = { mode: 'fillToTarget', target: 'topOfBracket', targetValue: 12, startYear: 2026, endYear: 2026 }
      if (itemize) plan.strategies.itemizedDeductions = { stateAndLocalTaxes: 30_000, mortgageInterest: 20_000, charitable: 10_000 }
      return validate(plan)
    }
    const opts = { startYear: 2026, taxCalculator: createFederalTaxCalculator() }
    const withItemized = simulatePlan(make(true), opts).years.find((y) => y.year === 2026)!.rothConversion
    const standard = simulatePlan(make(false), opts).years.find((y) => y.year === 2026)!.rothConversion
    // A larger deduction leaves more room under the 12% bracket top, so more converts.
    expect(withItemized).toBeGreaterThan(standard + 1_000)
  })

  it('does not over-trim a fill-to-target conversion when surplus inflows can pay its tax (PR #144)', () => {
    // Big pension inflow ($80k) far exceeds spending ($10k), so ~$70k of surplus
    // cash is available to pay a conversion's tax without touching the $50k cash
    // floor. The floor should barely trim the conversion; before the fix the
    // surplus inflow was clamped out of the headroom and the conversion was
    // trimmed to almost nothing.
    const make = (floor: number): Plan => {
      const plan = basePlan()
      plan.strategies.taxableSafetyNetFloor = floor
      plan.expenses.baseAnnual = 10_000
      plan.incomes = [
        { type: 'recurring', id: testIds(), label: 'Pension', annualAmount: 80_000, startYear: 2026, endYear: null, inflationAdjusted: false, taxTreatment: 'ordinary' },
      ]
      plan.accounts = [
        { type: 'traditional', id: 't', name: 'IRA', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 1_000_000, annualContribution: 0 } as Account,
        { type: 'roth', id: 'r', name: 'Roth', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 0, annualContribution: 0 } as Account,
        cash(50_000),
      ]
      plan.strategies.rothConversion = { mode: 'fillToTarget', target: 'topOfBracket', targetValue: 24, startYear: 2026, endYear: 2026 }
      return validate(plan)
    }
    const opts = { startYear: 2026, taxCalculator: createFederalTaxCalculator() }
    const noFloor = simulatePlan(make(0), opts).years.find((y) => y.year === 2026)!.rothConversion
    const withFloor = simulatePlan(make(50_000), opts).years.find((y) => y.year === 2026)!.rothConversion
    expect(noFloor).toBeGreaterThan(50_000)
    expect(withFloor).toBeGreaterThan(noFloor * 0.9)
  })
})

describe('capital loss carryforward', () => {
  const fed = createFederalTaxCalculator()

  /** Pre-65 single filer: $120k ordinary pension + a one-time $50k long-term gain
   *  in 2026. Income covers low spending from cash, so the only realized gain is
   *  the one-time sale (no withdrawal gains) — keeps the assertions deterministic. */
  function carryforwardPlan(carryforward: number): Plan {
    const plan = basePlan()
    plan.household.people[0] = {
      id: 'p1', name: 'Pat', dob: '1962-06-15', sex: 'average',
      retirementAge: 64, longevity: { planningAge: 90, source: 'manual' },
    }
    plan.household.capitalLossCarryforward = carryforward
    plan.expenses.baseAnnual = 40_000
    plan.incomes = [
      { type: 'recurring', id: testIds(), label: 'Pension', annualAmount: 120_000, startYear: 2026, endYear: null, inflationAdjusted: false, taxTreatment: 'ordinary' },
      { type: 'oneTime', id: testIds(), label: 'Stock sale', year: 2026, amount: 50_000, taxTreatment: 'capitalGain' },
    ]
    plan.accounts = [cash(500_000)]
    return plan
  }

  const yearOf = (plan: Plan, year: number) =>
    simulatePlan(validate(plan), { startYear: 2026, taxCalculator: fed }).years.find((y) => y.year === year)!

  it('absorbs realized gains and trims ordinary income, cutting year-one tax and MAGI', () => {
    const withCf = yearOf(carryforwardPlan(60_000), 2026)
    const without = yearOf(carryforwardPlan(0), 2026)
    // The $50k gain otherwise stacks at 15% (ordinary fills past the 0% threshold);
    // the $3k ordinary offset lands in the 22% bracket.
    expect(without.tax - withCf.tax).toBeCloseTo(50_000 * 0.15 + 3_000 * 0.22, 0)
    // Cascade: MAGI falls by the absorbed gain plus the ordinary offset.
    expect(without.magi - withCf.magi).toBeCloseTo(53_000, 0)
    expect(withCf.capitalLossUsedAgainstGains).toBe(50_000)
    expect(withCf.capitalLossUsedAgainstOrdinary).toBe(3_000)
    expect(withCf.capitalLossCarryforwardRemaining).toBe(7_000)
  })

  it('depletes the remaining pool by $3k/yr against ordinary income', () => {
    const plan = carryforwardPlan(60_000)
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: fed })
    const remaining = (yr: number) => result.years.find((y) => y.year === yr)!.capitalLossCarryforwardRemaining
    expect(remaining(2026)).toBe(7_000) // 60k − 50k gain − 3k ordinary
    expect(remaining(2027)).toBe(4_000)
    expect(remaining(2028)).toBe(1_000)
    expect(remaining(2029)).toBe(0)
  })

  it('is inert when there is no carryforward (regression)', () => {
    const result = simulatePlan(validate(carryforwardPlan(0)), { startYear: 2026, taxCalculator: fed })
    for (const y of result.years) {
      expect(y.capitalLossUsedAgainstGains).toBe(0)
      expect(y.capitalLossUsedAgainstOrdinary).toBe(0)
      expect(y.capitalLossCarryforwardRemaining).toBe(0)
    }
  })
})

describe('survivor spending percentage', () => {
  /** Couple where Sam's earlier planning age (75, dies 2041) leaves Pat alone through 2056. */
  function couplePlan(): Plan {
    const plan = basePlan()
    plan.household.filingStatus = 'marriedFilingJointly'
    plan.household.people.push({
      id: 'p2',
      name: 'Sam',
      dob: '1966-06-15',
      sex: 'average',
      retirementAge: 67,
      longevity: { planningAge: 75, source: 'manual' },
    })
    plan.expenses.baseAnnual = 40_000
    plan.accounts = [cash(3_000_000)]
    return plan
  }

  const run = (plan: Plan) => simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

  it('defaults to 100% — absent field changes nothing in survivor years', () => {
    const result = run(couplePlan())
    const jointYear = result.years.find((y) => y.year === 2035)!
    const survivorYear = result.years.find((y) => y.year === 2050)!
    expect(survivorYear.people.filter((p) => p.alive)).toHaveLength(1)
    expect(jointYear.expenses.baseSpending).toBe(40_000)
    expect(survivorYear.expenses.baseSpending).toBe(40_000)
  })

  it('scales base + phase spending in survivor years only', () => {
    const plan = couplePlan()
    plan.expenses.survivorSpendingPct = 70
    plan.expenses.phases = [{ fromAge: 75, multiplier: 0.9 }]
    const result = run(plan)

    // Both alive, before the phase: unscaled.
    expect(result.years.find((y) => y.year === 2035)!.expenses.baseSpending).toBe(40_000)
    // Survivor year with the 0.9 phase active (Pat is 84 in 2050): both factors compose.
    expect(result.years.find((y) => y.year === 2050)!.expenses.baseSpending).toBeCloseTo(40_000 * 0.9 * 0.7, 6)
  })

  it('leaves one-time goals unscaled in survivor years', () => {
    const plan = couplePlan()
    plan.expenses.survivorSpendingPct = 70
    plan.expenses.oneTimeGoals = [{ id: testIds(), label: 'Roof', year: 2050, amount: 25_000 }]
    const result = run(plan)
    expect(result.years.find((y) => y.year === 2050)!.expenses.oneTimeGoals).toBe(25_000)
  })

  it('never applies to single households', () => {
    const plan = basePlan()
    plan.expenses.baseAnnual = 40_000
    plan.expenses.survivorSpendingPct = 70
    plan.accounts = [cash(3_000_000)]
    const result = run(plan)
    // A one-person household has no "survivor" years — spending stays level.
    expect(result.years.find((y) => y.year === 2050)!.expenses.baseSpending).toBe(40_000)
  })
})

describe('SSA-44 IRMAA redetermination', () => {
  function roth(balance: number, owner = 'p1'): Account {
    return { type: 'roth', id: testIds(), name: 'Roth', ownerPersonId: owner, annualReturnPct: null, kind: 'ira', balance, annualContribution: 0 }
  }

  /**
   * Retired couple both on Medicare (born 1953, RMDs running). p1 dies at the
   * end of 2030; manual Roth conversions through 2029 keep the joint-year MAGI
   * over the single-filer tier-1 threshold, so under the plain lookback the
   * survivor's 2031 premium is priced on joint-era income.
   */
  function survivorIrmaaPlan(): Plan {
    const plan = basePlan()
    plan.household.filingStatus = 'marriedFilingJointly'
    plan.household.people = [
      { id: 'p1', name: 'Pat', dob: '1953-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 77, source: 'manual' } }, // last year alive: 2030
      { id: 'p2', name: 'Sam', dob: '1953-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 90, source: 'manual' } },
    ]
    plan.assumptions.healthcareExtraInflationPct = 0 // level premiums keep the dollar assertions exact
    plan.accounts = [cash(500_000), traditional(1_000_000), roth(0)]
    plan.strategies.rothConversion = {
      mode: 'manual',
      conversions: [2026, 2027, 2028, 2029].map((year) => ({ year, amount: 150_000 })),
    }
    return plan
  }

  it('prices the two survivor years on the lower recent MAGI when opted in', () => {
    const off = simulatePlan(validate(survivorIrmaaPlan()), { startYear: 2026, taxCalculator: noTax })
    const onPlan = survivorIrmaaPlan()
    onPlan.expenses.healthcare.ssa44 = { survivorYears: true, retirementYears: false }
    const on = simulatePlan(validate(onPlan), { startYear: 2026, taxCalculator: noTax })

    // 2031, the first survivor year: the lookback references 2029 (150k joint
    // conversion + RMD > 109k single threshold) → surcharge. The
    // redetermination prices it on 2030's survivor-level MAGI (RMD only).
    const off2031 = off.years.find((y) => y.year === 2031)!
    const on2031 = on.years.find((y) => y.year === 2031)!
    expect(off2031.filingStatus).toBe('single')
    expect(off2031.irmaaTier).toBeGreaterThanOrEqual(1)
    expect(on2031.irmaaTier).toBe(0)
    expect(on2031.medicarePremiums).toBeLessThan(off2031.medicarePremiums)
    expect(on2031.medicarePremiums).toBeCloseTo(202.9 * 12, 4) // standard Part B, one person

    // Joint years are untouched — the window opens only after the event year
    // (2030's premium is priced identically in both runs).
    for (const year of [2026, 2027, 2028, 2029, 2030]) {
      expect(on.years.find((y) => y.year === year)!.medicarePremiums).toBeCloseTo(
        off.years.find((y) => y.year === year)!.medicarePremiums,
        6,
      )
      expect(on.years.find((y) => y.year === year)!.irmaaTier).toBe(off.years.find((y) => y.year === year)!.irmaaTier)
    }
  })

  it('never raises a premium: the redetermination takes the lower of lookback and recent MAGI', () => {
    const off = simulatePlan(validate(survivorIrmaaPlan()), { startYear: 2026, taxCalculator: noTax })
    const onPlan = survivorIrmaaPlan()
    onPlan.expenses.healthcare.ssa44 = { survivorYears: true, retirementYears: false }
    const on = simulatePlan(validate(onPlan), { startYear: 2026, taxCalculator: noTax })
    for (const year of on.years) {
      const other = off.years.find((y) => y.year === year.year)!
      expect(year.medicarePremiums).toBeLessThanOrEqual(other.medicarePremiums + 1e-9)
    }
  })

  it('is unchanged with the field absent or fully off (feature-off regression)', () => {
    const absentPlan = survivorIrmaaPlan()
    const offPlan = structuredClone(absentPlan) // identical ids; only the flag differs
    offPlan.expenses.healthcare.ssa44 = { survivorYears: false, retirementYears: false }
    const absent = simulatePlan(validate(absentPlan), { startYear: 2026, taxCalculator: noTax })
    const off = simulatePlan(validate(offPlan), { startYear: 2026, taxCalculator: noTax })
    expect(JSON.stringify(off.years)).toBe(JSON.stringify(absent.years))
  })

  it('treats each retirement year as a qualifying event only when opted in', () => {
    // Single retiree on Medicare from 2026 (born 1961), work stoppage in 2027
    // (retirementAge 66). A single large 2026 conversion lifts the 2028
    // premium's lookback; the 2027 estimate year is quiet.
    const make = (): Plan => {
      const plan = basePlan()
      plan.household.people[0]! = {
        ...plan.household.people[0]!,
        dob: '1961-06-15',
        retirementAge: 66,
      }
      plan.accounts = [cash(500_000), traditional(1_000_000), roth(0)]
      plan.strategies.rothConversion = { mode: 'manual', conversions: [{ year: 2026, amount: 150_000 }] }
      return plan
    }
    const offPlan = make()
    const survivorOnly = structuredClone(offPlan) // identical ids; only the flag differs
    survivorOnly.expenses.healthcare.ssa44 = { survivorYears: true, retirementYears: false }
    const onPlan = structuredClone(offPlan)
    onPlan.expenses.healthcare.ssa44 = { survivorYears: false, retirementYears: true }
    const off = simulatePlan(validate(offPlan), { startYear: 2026, taxCalculator: noTax })
    const survivorOnlyRun = simulatePlan(validate(survivorOnly), { startYear: 2026, taxCalculator: noTax })
    const on = simulatePlan(validate(onPlan), { startYear: 2026, taxCalculator: noTax })

    const off2028 = off.years.find((y) => y.year === 2028)!
    const on2028 = on.years.find((y) => y.year === 2028)!
    expect(off2028.irmaaTier).toBeGreaterThanOrEqual(1) // lookback = 2026's 150k conversion
    expect(on2028.irmaaTier).toBe(0) // min(2026, 2027 estimate) = quiet 2027
    // The survivor-years toggle alone never applies to a single household.
    expect(JSON.stringify(survivorOnlyRun.years)).toBe(JSON.stringify(off.years))
  })

  it('ignores a retirement the person does not live to reach (no phantom window)', () => {
    // p1 would retire at 78 (2031) but a scenario override kills them at 75
    // (2028): with retirementYears on, no work-stoppage window may open in
    // 2032–2033 — the survivor's 2032 premium must still see 2030's conversion
    // through the plain lookback.
    const make = (): Plan => {
      const plan = basePlan()
      plan.household.filingStatus = 'marriedFilingJointly'
      plan.household.people = [
        { id: 'p1', name: 'Pat', dob: '1953-06-15', sex: 'average', retirementAge: 78, longevity: { planningAge: 95, source: 'manual' } },
        { id: 'p2', name: 'Sam', dob: '1953-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 95, source: 'manual' } },
      ]
      plan.assumptions.healthcareExtraInflationPct = 0
      plan.accounts = [cash(500_000), traditional(1_000_000, 0, 'p2'), roth(0, 'p2')]
      plan.strategies.rothConversion = { mode: 'manual', conversions: [{ year: 2030, amount: 150_000 }] }
      return plan
    }
    const offPlan = make()
    const onPlan = structuredClone(offPlan)
    onPlan.expenses.healthcare.ssa44 = { survivorYears: false, retirementYears: true }
    const simOpts = { startYear: 2026, taxCalculator: noTax, deathAgeByPersonId: { p1: 75 } }
    const off = simulatePlan(validate(offPlan), simOpts)
    const on = simulatePlan(validate(onPlan), simOpts)
    expect(on.years.find((y) => y.year === 2032)!.irmaaTier).toBeGreaterThanOrEqual(1)
    expect(JSON.stringify(on.years)).toBe(JSON.stringify(off.years))
  })

  it('prices QSS survivor years on the single IRMAA table (POMS HI 01101.020)', () => {
    // Same fixture with the QSS opt-in: 2031–2032 file as qualifying surviving
    // spouse (joint tax tables), but SSA's IRMAA categories group QSS with
    // individual filers — 2029's ~150k joint MAGI is under the joint threshold
    // (218k) yet over the single one (109k), so the surcharge tier must hit.
    const plan = survivorIrmaaPlan()
    plan.household.hasQualifyingDependent = true
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
    const y2031 = result.years.find((y) => y.year === 2031)!
    expect(y2031.filingStatus).toBe('qualifyingSurvivingSpouse')
    expect(y2031.irmaaTier).toBeGreaterThanOrEqual(1)
  })

  it('flags the redetermination years in the optimizer probe', () => {
    const plan = survivorIrmaaPlan()
    plan.expenses.healthcare.ssa44 = { survivorYears: true, retirementYears: false }
    const flagged: number[] = []
    simulatePlan(validate(plan), {
      startYear: 2026,
      taxCalculator: noTax,
      captureOptimizerInputs: (p) => {
        if (p.ssa44IrmaaRedetermination) flagged.push(p.year)
      },
    })
    expect(flagged).toEqual([2031, 2032]) // the two years after the 2030 death
  })
})
