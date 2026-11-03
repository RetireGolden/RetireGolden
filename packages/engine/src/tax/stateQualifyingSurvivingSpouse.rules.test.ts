/**
 * Which state filing row a federal qualifying surviving spouse (IRC 2(a))
 * files under. The federal mapper sends QSS to the joint tables; a state's
 * return decides its own row, declared per pack in
 * `qualifyingSurvivingSpouseFilesAs` and read through `stateFilingRowFor`.
 *
 * Every expected value is worked by hand from the cited return instructions and
 * statute, never from the engine's output:
 *
 * - Georgia, 2026 (IT-511 Schedule 3 line 10 groups QSS with single; DOR's 2026
 *   amounts are $15,000 and $30,000): $80,000 of Georgia income, under 65.
 *   80,000 − 15,000 = 65,000 at 4.99% = $3,243.50. The joint row gives
 *   80,000 − 30,000 = 50,000 at 4.99% = $2,495.00.
 * - Virginia, 2026 (a federal Qualifying Widow(er) uses Filing Status 1; Va.
 *   Code 58.1-322.03(1)(b)(v) $8,750 single): $60,000, under 65, two $930
 *   exemptions (the survivor and the dependent child IRC 2(a)(1)(B) requires).
 *   60,000 − 8,750 − 1,860 = 49,390; tax 60 + 60 + 600 + 5.75% × 32,390
 *   = $2,582.425. The joint row: 60,000 − 17,500 − 1,860 = 40,640, tax
 *   720 + 5.75% × 23,640 = $2,079.30, $503.125 less (the $8,750 at 5.75%).
 * - Kansas, 2026 (K-40: a federal Qualifying Widow(er) checks Head of
 *   Household; K.S.A. 79-32,119(c)(2) $6,180; 79-32,110(a)(2) "All other
 *   individuals" schedule): $66,180 of Kansas AGI. 66,180 − 6,180 = 60,000;
 *   1,196 + 5.58% × 37,000 = $3,260.60. The joint row: 66,180 − 8,240 =
 *   57,940; 2,392 + 5.58% × 11,940 = $3,058.252.
 */
import { describe, expect, it } from 'vitest'

import { stateFilingRowFor, stateParamsFor, STATE_ENACTED_YEARS } from '../params/state/index.js'
import { stateYear2026 } from '../params/state/data/year2026.js'
import type { StateTaxParams } from '../params/state/types.js'
import type { TaxYearInput } from '../projection/types.js'
import { describeRule } from '../rules/describeRule.js'
import { computeStateTaxDetail, computeStateTaxDetailResult, computeStateTaxYearTotal, computeStateTaxableIncome, createStateTaxCalculator } from './stateTax.js'
import { simulatePlan } from '../projection/simulate.js'
import { basePlan, cash, testIds, validate } from '../projection/simulate.test-support.js'
import type { Plan } from '../model/plan.js'

const TAX_YEAR = 2026

function pack(code: string): StateTaxParams {
  const params = stateParamsFor(code, TAX_YEAR)
  if (params === undefined) throw new Error(`no ${TAX_YEAR} state pack for ${code}`)
  return params
}

function qss(state: string, ordinaryIncome: number): TaxYearInput {
  return {
    year: TAX_YEAR,
    state,
    filingStatus: 'qualifyingSurvivingSpouse',
    ordinaryIncome,
    capitalGains: 0,
    ssBenefits: 0,
    inflationScale: 1,
    peopleAged65Plus: 0,
    agesAlive: [50],
  }
}

/** The same pack with the federal QSS-to-joint mapping, the competing reading. */
function jointMapped(params: StateTaxParams): StateTaxParams {
  return { ...params, qualifyingSurvivingSpouseFilesAs: 'marriedFilingJointly' }
}

describeRule('ga-it511-2026-qss-standard-deduction-single', {
  readings: {
    it511SingleRow: { taxableIncome: 65_000, stateTax: 3_243.5 },
    federalJointRow: { taxableIncome: 50_000, stateTax: 2_495 },
  },
  accepted: 'it511SingleRow',
}, ({ accepted, readings }) => {
  it('gives a qualifying surviving spouse the $15,000 single deduction', () => {
    const input = qss('GA', 80_000)
    expect(computeStateTaxableIncome(pack('GA'), input)).toBe(accepted.taxableIncome)
    expect(computeStateTaxDetail(pack('GA'), input).stateTax).toBeCloseTo(accepted.stateTax, 6)
    expect(computeStateTaxYearTotal(input)).toBeCloseTo(accepted.stateTax, 6)
    const joint = computeStateTaxDetail(jointMapped(pack('GA')), input)
    expect(joint.taxableIncome).toBe(readings.federalJointRow.taxableIncome)
    expect(joint.stateTax).toBeCloseTo(readings.federalJointRow.stateTax, 6)
  })
})

describeRule('va-760-2026-qss-files-single', {
  readings: {
    // Filing Status 1, two federal exemptions (survivor and dependent child).
    filingStatusOne: { taxableIncome: 49_390, stateTax: 2_582.425 },
    federalJointRow: { taxableIncome: 40_640, stateTax: 2_079.3 },
    // Filing Status 1 read as one exemption, as a single filer with no child.
    filingStatusOneOneExemption: { taxableIncome: 50_320, stateTax: 2_635.9 },
  },
  accepted: 'filingStatusOne',
}, ({ accepted, readings }) => {
  it('takes the $8,750 Status 1 deduction and keeps both personal exemptions', () => {
    const input = qss('VA', 60_000)
    const detail = computeStateTaxDetail(pack('VA'), input)
    expect(detail.taxableIncome).toBe(accepted.taxableIncome)
    expect(detail.stateTax).toBeCloseTo(accepted.stateTax, 6)
    expect(detail.taxableIncome).not.toBe(readings.filingStatusOneOneExemption.taxableIncome)
    expect(computeStateTaxYearTotal(input)).toBeCloseTo(accepted.stateTax, 6)
    const joint = computeStateTaxDetail(jointMapped(pack('VA')), input)
    expect(joint.taxableIncome).toBe(readings.federalJointRow.taxableIncome)
    expect(joint.stateTax).toBeCloseTo(readings.federalJointRow.stateTax, 6)
  })

  it('holds for the enacted 2027 deduction ($9,200 single)', () => {
    // 60,000 − 9,200 − 1,860 = 48,940.
    const params = stateParamsFor('VA', 2027)!
    expect(computeStateTaxableIncome(params, { ...qss('VA', 60_000), year: 2027 })).toBe(48_940)
  })

  it('adds the dependents to the taxpayers when the plan gives both counts', () => {
    // 58.1-322.03(2)(a): $930 for each federal exemption. One taxpayer and one
    // dependent are two: 60,000 − 8,750 − 2 × 930 = 49,390, the default.
    // Reading the taxpayer count alone gives one: 60,000 − 8,750 − 930 = 50,320.
    const facts = { exemptionTaxpayerCount: 1, exemptionDependentCount: 1 }
    const input = qss('VA', 60_000)
    expect(computeStateTaxableIncome(pack('VA'), input, { householdFacts: facts })).toBe(accepted.taxableIncome)
    expect(computeStateTaxableIncome(pack('VA'), input, { householdFacts: facts })).not.toBe(readings.filingStatusOneOneExemption.taxableIncome)
    // A survivor with two dependents: 60,000 − 8,750 − 3 × 930 = 48,460.
    expect(computeStateTaxableIncome(pack('VA'), input, { householdFacts: { exemptionTaxpayerCount: 1, exemptionDependentCount: 2 } })).toBe(48_460)
  })
})

describe('Virginia dependent exemptions on every filing row (58.1-322.03(2)(a))', () => {
  it('counts a single filer’s and a joint couple’s dependents', () => {
    const single: TaxYearInput = { ...qss('VA', 60_000), filingStatus: 'single' }
    // 60,000 − 8,750 − 930 = 50,320 with no dependent; one dependent takes 930 more.
    expect(computeStateTaxableIncome(pack('VA'), single, { householdFacts: { exemptionTaxpayerCount: 1, exemptionDependentCount: 0 } })).toBe(50_320)
    expect(computeStateTaxableIncome(pack('VA'), single, { householdFacts: { exemptionTaxpayerCount: 1, exemptionDependentCount: 1 } })).toBe(49_390)
    // Joint, two taxpayers and two dependents: 60,000 − 17,500 − 4 × 930 = 38,780.
    const joint: TaxYearInput = { ...qss('VA', 60_000), filingStatus: 'marriedFilingJointly', agesAlive: [50, 50] }
    expect(computeStateTaxableIncome(pack('VA'), joint, { householdFacts: { exemptionTaxpayerCount: 2, exemptionDependentCount: 2 } })).toBe(38_780)
  })
})

describe('Vermont dependent exemptions (IN-111 lines 5a to 5e)', () => {
  const vtFacts = {
    federalAgi: 100_000,
    stateFilingStatus: 'single' as const,
    federallyIncludedSocialSecurity: 0,
    exemptionTaxpayerCount: 1,
    section63fQualificationCount: 0,
    vermontUsObligationAdjustment: 0,
  }
  const input: TaxYearInput = { ...qss('VT', 100_000), filingStatus: 'single' }

  it('multiplies the $5,400 exemption by the taxpayers and the dependents together', () => {
    // 100,000 − 7,850 − 5,400 × (1 + 2) = 75,950; the taxpayer alone gives 86,750.
    const withTwo = computeStateTaxDetailResult(pack('VT'), input, { householdFacts: { ...vtFacts, exemptionDependentCount: 2 } })
    expect(withTwo.taxableIncome).toBe(75_950)
    expect(withTwo.warnings.some((w) => w.code === 'vt-deduction-exemption-incomplete')).toBe(false)
    const withNone = computeStateTaxDetailResult(pack('VT'), input, { householdFacts: { ...vtFacts, exemptionDependentCount: 0 } })
    expect(withNone.taxableIncome).toBe(86_750)
  })

  it('asks for the dependent count rather than assuming none', () => {
    const missing = computeStateTaxDetailResult(pack('VT'), input, { householdFacts: vtFacts })
    const warning = missing.warnings.find((w) => w.code === 'vt-deduction-exemption-incomplete')
    expect(warning?.missingFacts).toContain('exemptionDependentCount')
    expect(missing.status).toBe('incomplete')
  })
})

describeRule('ks-k40-2026-qss-head-of-household', {
  readings: {
    headOfHouseholdRow: { taxableIncome: 60_000, stateTax: 3_260.6 },
    federalJointRow: { taxableIncome: 57_940, stateTax: 3_058.252 },
    // Head-of-household deduction on the joint schedule.
    headOfHouseholdDeductionJointSchedule: { taxableIncome: 60_000, stateTax: 3_173.2 },
    // The single row throughout.
    singleRow: { taxableIncome: 62_575, stateTax: 3_404.285 },
  },
  accepted: 'headOfHouseholdRow',
}, ({ accepted, readings }) => {
  it('files as head of household: $6,180 and the all-other-individuals schedule', () => {
    const input = qss('KS', 66_180)
    const detail = computeStateTaxDetail(pack('KS'), input)
    expect(detail.taxableIncome).toBe(accepted.taxableIncome)
    expect(detail.stateTax).toBeCloseTo(accepted.stateTax, 6)
    expect(detail.stateTax).not.toBeCloseTo(readings.headOfHouseholdDeductionJointSchedule.stateTax, 2)
    expect(computeStateTaxYearTotal(input)).toBeCloseTo(accepted.stateTax, 6)
    const joint = computeStateTaxDetail(jointMapped(pack('KS')), input)
    expect(joint.taxableIncome).toBe(readings.federalJointRow.taxableIncome)
    expect(joint.stateTax).toBeCloseTo(readings.federalJointRow.stateTax, 6)
    const single = computeStateTaxDetail({ ...pack('KS'), qualifyingSurvivingSpouseFilesAs: 'single' }, input)
    expect(single.taxableIncome).toBe(readings.singleRow.taxableIncome)
    expect(single.stateTax).toBeCloseTo(readings.singleRow.stateTax, 6)
  })
})

describe('state qualifying-surviving-spouse row declarations', () => {
  it('declares the rows the registered records name, and Delaware keeps its disclosed joint mapping', () => {
    const declared = Object.fromEntries(
      Object.entries(stateYear2026.states)
        .filter(([, params]) => params.qualifyingSurvivingSpouseFilesAs !== undefined)
        .map(([code, params]) => [code, params.qualifyingSurvivingSpouseFilesAs]),
    )
    expect(declared).toEqual({ DE: 'marriedFilingJointly', GA: 'single', KS: 'headOfHousehold', VA: 'single' })
  })

  it('every pack that files a survivor as head of household carries that row and no single/MFJ-only deduction field', () => {
    const packs = [
      ...Object.values(stateYear2026.states),
      ...STATE_ENACTED_YEARS.flatMap((enacted) => Object.keys(enacted.states).map((code) => stateParamsFor(code, enacted.year)!)),
    ]
    for (const params of packs) {
      if (params.qualifyingSurvivingSpouseFilesAs !== 'headOfHousehold') continue
      expect(params.standardDeductionHeadOfHousehold, params.code).toBeTypeOf('number')
      expect(params.bracketsHeadOfHousehold, params.code).toBeDefined()
      expect(params.standardDeductionAge65Addition, params.code).toBeUndefined()
      expect(params.standardDeductionPhaseout, params.code).toBeUndefined()
      expect(params.standardDeductionConformity, params.code).toBeUndefined()
      expect(params.standardDeductionAge65AdditionConformity, params.code).toBeUndefined()
    }
  })

  it('leaves single and joint returns on their own rows', () => {
    for (const code of ['DE', 'GA', 'KS', 'VA']) {
      const params = pack(code)
      expect(stateFilingRowFor(params, 'single').standardDeduction).toBe(params.standardDeduction.single)
      expect(stateFilingRowFor(params, 'marriedFilingJointly').standardDeduction).toBe(params.standardDeduction.marriedFilingJointly)
      expect(stateFilingRowFor(params, 'marriedFilingJointly').brackets).toBe(params.brackets.marriedFilingJointly)
    }
  })

  it('fails closed on a head-of-household declaration without the row', () => {
    const broken: StateTaxParams = { ...pack('GA'), qualifyingSurvivingSpouseFilesAs: 'headOfHousehold' }
    expect(() => stateFilingRowFor(broken, 'qualifyingSurvivingSpouse')).toThrow(/head of household/)
  })
})

describe('qualifying-surviving-spouse state row through the projection ledger', () => {
  /** Joint couple; Sam dies in 2026, so 2027 and 2028 file as QSS and 2029 as single. */
  function survivorPlan(state: string): Plan {
    const plan = basePlan()
    plan.household.filingStatus = 'marriedFilingJointly'
    plan.household.hasQualifyingDependent = true
    plan.household.state = state
    plan.household.people = [
      { id: 'p1', name: 'Pat', dob: '1966-01-01', sex: 'average', retirementAge: null, longevity: { planningAge: 70, source: 'manual' } },
      { id: 'p2', name: 'Sam', dob: '1966-01-01', sex: 'average', retirementAge: null, longevity: { planningAge: 60, source: 'manual' } },
    ]
    plan.incomes = [
      { type: 'recurring', id: testIds(), label: 'Consulting', annualAmount: 80_000, startYear: null, endYear: null, inflationAdjusted: false, taxTreatment: 'ordinary' },
    ]
    plan.accounts = [cash(1_000_000)]
    return plan
  }

  it('prices a Georgia QSS year on the single row, as the single year after it', () => {
    const result = simulatePlan(validate(survivorPlan('GA')), { startYear: 2026, taxCalculator: createStateTaxCalculator() })
    const qssYear = result.years.find((y) => y.year === 2027)!
    const singleYear = result.years.find((y) => y.year === 2029)!
    expect(qssYear.filingStatus).toBe('qualifyingSurvivingSpouse')
    expect(singleYear.filingStatus).toBe('single')
    expect(qssYear.tax).toBeCloseTo(3_243.5, 6)
    expect(qssYear.tax).toBeCloseTo(singleYear.tax, 6)
  })
})
