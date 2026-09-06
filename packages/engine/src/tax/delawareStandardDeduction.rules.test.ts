/**
 * Delaware § 1108 standard deduction — discriminating vector through the shared
 * state-taxable-income enforcer.
 *
 * Worksheet (30 Del. C. §§ 1107–1108; 2026 PIT-EST line 3):
 * https://delcode.delaware.gov/title30/c011/sc02/index.html
 * https://revenuefiles.delaware.gov/2025/PITForms_Instructions/Instructions/PIT-EST_Instructions_2026-01.pdf
 *
 * At $60,000 wages with no other state-base adjustments, deduction =
 * wages − computeStateTaxableIncome. Five coordinates: single age 64, single 65,
 * MFJ both 64, MFJ one 65, MFJ both 65. Scope is projected single and MFJ
 * only; QSS, blindness, and itemization are outside this record.
 */

import { expect, it } from 'vitest'

import { describeRule } from '../rules/describeRule.js'
import { packForYear } from '../params/index.js'
import { conformStateStandardDeduction, stateParamsFor } from '../params/state/index.js'
import type { StateTaxParams } from '../params/state/types.js'
import type { TaxYearInput } from '../projection/types.js'
import { computeStateTaxableIncome } from './stateTax.js'

const TAX_YEAR = 2026
const WAGES = 60_000
const FEDERAL_AGE65_ADDITION = packForYear(TAX_YEAR).pack.federalTax.age65Addition

type DeductionCase = {
  filingStatus: 'single' | 'marriedFilingJointly'
  peopleAged65Plus: number
  agesAlive: number[]
}

const DEDUCTION_CASES: DeductionCase[] = [
  { filingStatus: 'single', peopleAged65Plus: 0, agesAlive: [64] },
  { filingStatus: 'single', peopleAged65Plus: 1, agesAlive: [65] },
  { filingStatus: 'marriedFilingJointly', peopleAged65Plus: 0, agesAlive: [64, 64] },
  { filingStatus: 'marriedFilingJointly', peopleAged65Plus: 1, agesAlive: [65, 64] },
  { filingStatus: 'marriedFilingJointly', peopleAged65Plus: 2, agesAlive: [65, 65] },
]

function input(over: Partial<TaxYearInput> = {}): TaxYearInput {
  return {
    year: TAX_YEAR,
    filingStatus: 'single',
    ordinaryIncome: 0,
    capitalGains: 0,
    ssBenefits: 0,
    peopleAged65Plus: 0,
    ...over,
  }
}

function publishedDeParams(): StateTaxParams {
  const raw = stateParamsFor('DE', TAX_YEAR)
  if (raw === undefined) throw new Error(`no ${TAX_YEAR} state pack for DE`)
  return conformStateStandardDeduction(raw, FEDERAL_AGE65_ADDITION, 1)
}

function withoutAgeAddition(params: StateTaxParams): StateTaxParams {
  const clone = { ...params }
  delete clone.standardDeductionAge65Addition
  return clone
}

/** Deduction component at WAGES through the production resolver and enforcer. */
function deductionVector(params: StateTaxParams): number[] {
  const resolved = conformStateStandardDeduction(params, FEDERAL_AGE65_ADDITION, 1)
  return DEDUCTION_CASES.map((c) => {
    const scenario = input({
      state: 'DE',
      filingStatus: c.filingStatus,
      ordinaryIncome: WAGES,
      peopleAged65Plus: c.peopleAged65Plus,
      agesAlive: c.agesAlive,
    })
    return WAGES - computeStateTaxableIncome(resolved, scenario)
  })
}

describeRule('de-code-30-1108-standard-deduction', {
  readings: {
    statuteBasicAndAge65: [3_250, 5_750, 6_500, 9_000, 11_500],
    hb89BasicNoAgeAddition: [5_700, 5_700, 11_400, 11_400, 11_400],
    correctedBasicWithoutAge: [3_250, 3_250, 6_500, 6_500, 6_500],
    federalAgeAmounts: [3_250, 5_300, 6_500, 8_150, 9_800],
  },
  accepted: 'statuteBasicAndAge65',
}, ({ accepted, readings }) => {
  it('subtracts the § 1108 basic and age-65 amounts through the published Delaware pack', () => {
    const published = deductionVector(publishedDeParams())
    const hb89BasicNoAge = deductionVector(withoutAgeAddition({
      ...publishedDeParams(),
      standardDeduction: { single: 5_700, marriedFilingJointly: 11_400 },
    }))
    const correctedBasicWithoutAge = deductionVector(withoutAgeAddition({
      ...publishedDeParams(),
      standardDeduction: { single: 3_250, marriedFilingJointly: 6_500 },
    }))
    const federalAge = deductionVector({
      ...withoutAgeAddition(publishedDeParams()),
      standardDeduction: { single: 3_250, marriedFilingJointly: 6_500 },
      standardDeductionAge65Addition: FEDERAL_AGE65_ADDITION,
    })

    expect(hb89BasicNoAge).toEqual(readings.hb89BasicNoAgeAddition)
    expect(correctedBasicWithoutAge).toEqual(readings.correctedBasicWithoutAge)
    expect(federalAge).toEqual(readings.federalAgeAmounts)
    expect(published).toEqual(accepted)
  })
})
