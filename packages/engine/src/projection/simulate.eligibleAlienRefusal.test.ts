/**
 * Refusal fixture for the 2027 eligible-alien `outOfScope` record.
 *
 * From 2027, Pub. L. 119-21 section 71301 brings a lawfully present tax-family
 * member who is not an eligible alien under IRC 36B(e). The engine has no
 * immigration-status fact and does not compute 36B(e); the ACA year
 * contract's coverageEligibility assertion is the only place the fact can
 * enter. 'unsupported' must fail the 2027 credit closed rather than price it,
 * and 'supported' (every lawfully present member is an eligible alien) must
 * leave the same 2027 year priced, so the refusal is the assertion and not the
 * year. Both run the real projection on a 2027 contract, the first year the
 * amendment reaches.
 */
import { describe, expect, it } from 'vitest'

import { describeRefusal } from '../rules/describeRefusal.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import {
  cashAccount,
  recurringOrdinaryIncome,
  setAcaYearContract,
  singlePersonPlan,
  validatePlan,
} from '../testing/planFixtures.js'
import { simulatePlan } from './simulate.js'

const YEAR = 2027

function acaYear(coverageEligibility: 'supported' | 'unsupported') {
  const plan = singlePersonPlan({ dob: '1965-01-01', planningAge: 90 })
  plan.accounts = [cashAccount('cash', 200_000)]
  // Income well above 100% of the 2027 poverty line (15,960), so the year is
  // not refused for the eligibility floor instead.
  plan.incomes = [recurringOrdinaryIncome('consulting', 40_000, YEAR)]
  setAcaYearContract(plan, { year: YEAR, monthlyEnrollment: 1_000 })
  const contract = plan.expenses.healthcare.acaYears?.[0]
  if (contract === undefined) throw new Error('fixture lost its ACA year contract')
  contract.assertions = { ...contract.assertions, coverageEligibility }
  const result = simulatePlan(validatePlan(plan), {
    startYear: YEAR,
    horizonEndYear: YEAR,
    taxCalculator: createFlatTaxCalculator(0),
  })
  const aca = result.years[0]?.aca
  if (aca === undefined) throw new Error('fixture produced no ACA result')
  return aca
}

describe('outOfScope refusals reached through simulatePlan', () => {
  describeRefusal('irc-36B-e-eligible-alien-2027-coverage-eligibility-not-modeled', {
    entryPoint: 'packages/engine/src/projection/simulate.ts#simulatePlan',
    outOfScopeInput:
      "a 2027 ACA year contract whose coverageEligibility assertion is 'unsupported', the only way to tell the engine a tax-family member may be a lawfully present alien who is not an eligible alien",
    refusal:
      "ACA support code 'coverage-eligibility-unsupported' with readiness 'nonActionable', so the 2027 premium tax credit fails closed and no 36B(e) figure is produced",
  }, () => {
    it('fails the 2027 credit closed instead of computing a 36B(e) adjustment', () => {
      const aca = acaYear('unsupported')

      expect(aca.supportCodes).toContain('coverage-eligibility-unsupported')
      expect(aca.readiness).toBe('nonActionable')
      expect(aca.modeledAllowablePtc).toBeNull()
      expect(aca.householdMagi).toBeNull()
      expect(aca.convergence.grossPremiumFallback).toBe(true)
      expect(aca.economicNetPremium).toBe(aca.grossEnrollmentPremium)
    })

    it('prices the same 2027 year once the assertion is supported, so the refusal is the eligibility claim', () => {
      const aca = acaYear('supported')

      expect(aca.supportCodes).not.toContain('coverage-eligibility-unsupported')
      expect(aca.readiness).toBe('actionable')
      expect(aca.modeledAllowablePtc).not.toBeNull()
      expect(aca.householdMagi).toBe(40_000)
    })
  })
})
