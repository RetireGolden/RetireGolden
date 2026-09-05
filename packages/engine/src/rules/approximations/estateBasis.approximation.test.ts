/**
 * Pins irc-408-d-2-estate-household-basis-allocation against
 * estateTraditionalTaxableBase, the helper that actually allocates remaining
 * household nondeductible IRA basis across traditional accounts.
 *
 * The public path is createEmptyPlan (via couplePlan) -> parsePlan
 * (via validatePlan) -> simulatePlan -> summarizeProjection. Ending basis and
 * closings are read from that run; per-account taxable pretax bases and heir
 * taxes are observed from summary.estateBreakdown, which transitively calls
 * estateTraditionalTaxableBase — the sole pinned helper. The produced vector
 * was observed on this path, not predicted from the helper in isolation.
 *
 * Independent authority worksheet (assumed future income-tax exposure, not
 * death-year filing tax):
 *   p1 IRA 120,000 with 90,000 basis staying with that owner's IRA -> taxable
 *     30,000; haircut at 25 percent 7,500
 *   p2 IRA 120,000, separate Form 8606, basis 0 -> taxable 120,000; haircut
 *     30,000
 *   p1 401(k) 120,000, not an individual retirement plan under 7701(a)(37) ->
 *     taxable 120,000; haircut 30,000
 *   aggregate haircut 67,500
 *
 * Engine household allocation: 90,000 basis / 360,000 traditional = 0.25 of
 * each 120,000 -> taxable 90,000 / 90,000 / 90,000; haircuts 22,500 each;
 * aggregate 67,500.
 *
 * IRA-only cross-owner: 90,000 / 240,000 IRAs, employer none -> taxable
 * 75,000 / 75,000 / 120,000.
 * Ignore basis: 120,000 / 120,000 / 120,000.
 *
 * Per-account errors both directions. Under this fixture's common 25 percent
 * heir rate and common non-spouse destination the haircuts cancel in the
 * aggregate. This fixture does not claim an aggregate error.
 */
import { expect, it } from 'vitest'

import { describeRule } from '../describeRule.js'
import { summarizeProjection } from '../../projection/compare.js'
import { simulatePlan } from '../../projection/simulate.js'
import { createFlatTaxCalculator } from '../../testing/flatTax.js'
import {
  couplePlan,
  traditionalAccount,
  validatePlan,
} from '../../testing/planFixtures.js'
import type { Account } from '../../model/plan.js'

const noTax = createFlatTaxCalculator(0)
const NON_SPOUSE = { destination: 'nonSpouse' as const }
const ACCOUNT_IDS = ['p1-ira', 'p2-ira', 'p1-employer'] as const
const HEIR_RATE = 0.25

function householdTraditionalEstatePlan(): ReturnType<typeof couplePlan> {
  const plan = couplePlan({
    p1Dob: '1966-01-01',
    p2Dob: '1966-01-01',
    p1PlanningAge: 60,
    p2PlanningAge: 60,
  })
  plan.assumptions.heirTaxRatePct = 25
  const p1Ira = traditionalAccount('p1-ira', 120_000, 'p1', 'ira') as Extract<Account, { type: 'traditional' }>
  const p2Ira = traditionalAccount('p2-ira', 120_000, 'p2', 'ira') as Extract<Account, { type: 'traditional' }>
  const p1Employer = traditionalAccount('p1-employer', 120_000, 'p1', 'employer') as Extract<Account, { type: 'traditional' }>
  plan.accounts = [
    { ...p1Ira, nondeductibleBasis: 90_000, estateBeneficiary: NON_SPOUSE },
    { ...p2Ira, nondeductibleBasis: 0, estateBeneficiary: NON_SPOUSE },
    { ...p1Employer, employerPlanType: '401k', estateBeneficiary: NON_SPOUSE },
  ]
  return plan
}

describeRule('irc-408-d-2-estate-household-basis-allocation', {
  readings: {
    ownerIraBasisStaysPut: [30_000, 120_000, 120_000],
    householdGrossAllocation: [90_000, 90_000, 90_000],
    iraOnlyCrossOwner: [75_000, 75_000, 120_000],
    ignoreBasis: [120_000, 120_000, 120_000],
  },
  accepted: 'ownerIraBasisStaysPut',
  produced: 'householdGrossAllocation',
  note: 'per-account assumed future tax exposure on a couple IRA-plus-401(k) household',
}, ({ accepted, produced, readings }) => {
  it('spreads the household remaining-basis scalar across every traditional gross', () => {
    const parsed = validatePlan(householdTraditionalEstatePlan())
    const result = simulatePlan(parsed, { startYear: 2026, taxCalculator: noTax })
    const summary = summarizeProjection(parsed, result)
    const last = result.years[result.years.length - 1]!

    expect(result.endingNondeductibleIraBasis).toBe(90_000)
    expect(last.balances['p1-ira']).toBe(120_000)
    expect(last.balances['p2-ira']).toBe(120_000)
    expect(last.balances['p1-employer']).toBe(120_000)
    expect(summary.endingByCategory.traditional).toBe(360_000)

    const rows = ACCOUNT_IDS.map((id) => {
      const row = summary.estateBreakdown.find((entry) => entry.accountId === id)
      expect(row, `expected estateBreakdown row for ${id}`).toBeDefined()
      return row!
    })
    const taxableBases = rows.map((row) => row.taxablePretaxBase)

    expect(summary.endingEstateHeirTax).toBe(67_500)
    expect(taxableBases).toEqual(produced)
    expect(taxableBases).not.toEqual(accepted)
    expect(taxableBases).not.toEqual(readings.iraOnlyCrossOwner)
    expect(taxableBases).not.toEqual(readings.ignoreBasis)

    // Per-account assumed-future-tax-exposure errors run both ways. Under this
    // fixture's common 25 percent heir rate and common non-spouse destination
    // the haircuts cancel in the aggregate; that cancellation is not an
    // aggregate error and this fixture does not claim one.
    expect(taxableBases[0]).toBeGreaterThan(accepted[0])
    expect(taxableBases[1]).toBeLessThan(accepted[1])
    expect(taxableBases[2]).toBeLessThan(accepted[2])
    const producedHaircuts = rows.map((row) => row.heirTax)
    const acceptedHaircuts = accepted.map((base) => base * HEIR_RATE)
    expect(producedHaircuts).toEqual([22_500, 22_500, 22_500])
    expect(acceptedHaircuts).toEqual([7_500, 30_000, 30_000])
    expect(producedHaircuts.reduce((sum, haircut) => sum + haircut, 0)).toBe(67_500)
    expect(acceptedHaircuts.reduce((sum, haircut) => sum + haircut, 0)).toBe(67_500)
  })
})
