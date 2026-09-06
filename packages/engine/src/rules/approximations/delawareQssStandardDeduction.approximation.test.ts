/**
 * Delaware 2026 PIT-EST line 3: widow(er) basic $3,250; one age-65 allowance
 * adds $2,500, so the independent legal vector is [3,250, 5,750]. Production
 * characterization of the QSS joint-row mapping yields [6,500, 9,000]; that
 * vector is engine output evidence, not the legal oracle.
 */
import { expect, it } from 'vitest'

import { packForYear } from '../../params/index.js'
import { conformStateStandardDeduction, stateParamsFor } from '../../params/state/index.js'
import type { TaxYearInput } from '../../projection/types.js'
import { computeStateTaxableIncome } from '../../tax/stateTax.js'
import { describeRule } from '../describeRule.js'

const TAX_YEAR = 2026
const WAGES = 60_000

function qssDeductionVector(): readonly [number, number] {
  const raw = stateParamsFor('DE', TAX_YEAR)
  if (raw === undefined) throw new Error(`no ${TAX_YEAR} state pack for DE`)
  const params = conformStateStandardDeduction(
    raw,
    packForYear(TAX_YEAR).pack.federalTax.age65Addition,
    1,
  )
  const cases = [
    { peopleAged65Plus: 0, agesAlive: [64] },
    { peopleAged65Plus: 1, agesAlive: [65] },
  ] as const
  return cases.map((c) => {
    const input: TaxYearInput = {
      year: TAX_YEAR,
      state: 'DE',
      filingStatus: 'qualifyingSurvivingSpouse',
      ordinaryIncome: WAGES,
      capitalGains: 0,
      ssBenefits: 0,
      inflationScale: 1,
      peopleAged65Plus: c.peopleAged65Plus,
      agesAlive: [...c.agesAlive],
    }
    return WAGES - computeStateTaxableIncome(params, input)
  }) as [number, number]
}

describeRule('de-pit-est-2026-qss-standard-deduction-joint-mapper', {
  readings: {
    pitEstWidowerBasicPlusAge: [3_250, 5_750],
    qssMappedToJointRow: [6_500, 9_000],
    correctedQssBasicWithoutAgeAllowance: [3_250, 3_250],
  },
  accepted: 'pitEstWidowerBasicPlusAge',
  produced: 'qssMappedToJointRow',
}, ({ accepted, produced, readings }) => {
  it('pins the QSS joint-row approximation before and after age 65', () => {
    const actual = qssDeductionVector()
    expect(actual).toEqual(produced)
    expect(actual).not.toEqual(accepted)
    expect(actual).not.toEqual(readings.correctedQssBasicWithoutAgeAllowance)
  })
})
