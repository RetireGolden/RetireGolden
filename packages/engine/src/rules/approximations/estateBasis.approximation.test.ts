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
 *
 * Three-account cell (all non-spouse, 90,000 basis on p1 IRA only):
 *   p1 IRA 120,000 with basis staying with that owner's IRA -> taxable 30,000;
 *     haircut at 25 percent 7,500
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
 * Mixed-destination two-IRA cells (p1 non-spouse, p2 spouse; 90,000 basis on
 * p1 only or p2 only; 240,000 traditional total):
 *   basis on p1: authority aggregate haircut 7,500; after-tax estate 232,500
 *   basis on p2: authority aggregate haircut 30,000; after-tax estate 210,000
 *   engine household spread: taxable 75,000 / 75,000; aggregate haircut 18,750;
 *     after-tax estate 221,250 in both cells
 *
 * IRA-only cross-owner: 90,000 / 240,000 IRAs, employer none -> taxable
 * 75,000 / 75,000 / 120,000.
 * Ignore basis: 120,000 / 120,000 / 120,000.
 *
 * Per-account errors both directions on the three-account cell. Under that
 * cell's common 25 percent heir rate and common non-spouse destination the
 * haircuts cancel in the aggregate. The mixed-destination cells show aggregate
 * assumed future exposure can run over or under the authority worksheet.
 * A spouse destination's zero haircut is the terminal metric's existing
 * valuation convention, not an automatic statutory rollover or tax exemption.
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
const SPOUSE = { destination: 'spouse' as const }
const ACCOUNT_IDS = ['p1-ira', 'p2-ira', 'p1-employer'] as const
const HEIR_RATE = 0.25
const MIXED_CELL_TRADITIONAL_TOTAL = 240_000

type BasisOwner = 'p1' | 'p2'

function coupleEstateFixtureBase() {
  return couplePlan({
    p1Dob: '1966-01-01',
    p2Dob: '1966-01-01',
    p1PlanningAge: 60,
    p2PlanningAge: 60,
  })
}

function threeAccountHouseholdTraditionalEstatePlan(): ReturnType<typeof couplePlan> {
  const plan = coupleEstateFixtureBase()
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

function mixedDestinationCoupleEstatePlan(basisOwner: BasisOwner): ReturnType<typeof couplePlan> {
  const plan = coupleEstateFixtureBase()
  plan.assumptions.heirTaxRatePct = 25
  const p1Ira = traditionalAccount('p1-ira', 120_000, 'p1', 'ira') as Extract<Account, { type: 'traditional' }>
  const p2Ira = traditionalAccount('p2-ira', 120_000, 'p2', 'ira') as Extract<Account, { type: 'traditional' }>
  plan.accounts = [
    {
      ...p1Ira,
      nondeductibleBasis: basisOwner === 'p1' ? 90_000 : 0,
      estateBeneficiary: NON_SPOUSE,
    },
    {
      ...p2Ira,
      nondeductibleBasis: basisOwner === 'p2' ? 90_000 : 0,
      estateBeneficiary: SPOUSE,
    },
  ]
  return plan
}

function observeEstateSummary(plan: ReturnType<typeof couplePlan>) {
  const parsed = validatePlan(plan)
  const result = simulatePlan(parsed, { startYear: 2026, taxCalculator: noTax })
  const summary = summarizeProjection(parsed, result)
  const last = result.years[result.years.length - 1]!
  return { parsed, result, summary, last }
}

describeRule('irc-408-d-2-estate-household-basis-allocation', {
  readings: {
    ownerIraBasisStaysPut: [30_000, 120_000, 120_000, 7_500, 30_000],
    householdGrossAllocation: [90_000, 90_000, 90_000, 18_750, 18_750],
    iraOnlyCrossOwner: [75_000, 75_000, 120_000, 18_750, 18_750],
    ignoreBasis: [120_000, 120_000, 120_000, 30_000, 30_000],
  },
  accepted: 'ownerIraBasisStaysPut',
  produced: 'householdGrossAllocation',
  note: 'owned cross-owner IRA-plus-401(k) household and mixed-destination IRA cells',
}, ({ accepted, produced, readings }) => {
  it('returns the household-spread vector, not the owner-retained or alternative-allocation readings', () => {
    const { result, summary, last } = observeEstateSummary(threeAccountHouseholdTraditionalEstatePlan())

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

    const mixedP1Basis = observeEstateSummary(mixedDestinationCoupleEstatePlan('p1'))
    const mixedP2Basis = observeEstateSummary(mixedDestinationCoupleEstatePlan('p2'))

    const observed = [
      ...taxableBases,
      mixedP1Basis.summary.endingEstateHeirTax,
      mixedP2Basis.summary.endingEstateHeirTax,
    ]

    expect(observed).toEqual(produced)
    expect(observed).not.toEqual(accepted)
    expect(observed).not.toEqual(readings.iraOnlyCrossOwner)
    expect(observed).not.toEqual(readings.ignoreBasis)

    // Per-account assumed-future-tax-exposure errors run both ways. Under this
    // three-account cell's common 25 percent heir rate and common non-spouse
    // destination the haircuts cancel in the aggregate; that cancellation is
    // not an aggregate error and applies only to this cell.
    expect(taxableBases[0]).toBeGreaterThan(accepted[0])
    expect(taxableBases[1]).toBeLessThan(accepted[1])
    expect(taxableBases[2]).toBeLessThan(accepted[2])
    const producedHaircuts = rows.map((row) => row.heirTax)
    const acceptedHaircuts = [accepted[0], accepted[1], accepted[2]].map((base) => base * HEIR_RATE)
    expect(producedHaircuts).toEqual([22_500, 22_500, 22_500])
    expect(acceptedHaircuts).toEqual([7_500, 30_000, 30_000])
    expect(producedHaircuts.reduce((sum, haircut) => sum + haircut, 0)).toBe(67_500)
    expect(acceptedHaircuts.reduce((sum, haircut) => sum + haircut, 0)).toBe(67_500)
    expect(summary.endingEstateHeirTax).toBe(67_500)

    expect(mixedP1Basis.result.endingNondeductibleIraBasis).toBe(90_000)
    expect(mixedP1Basis.summary.endingByCategory.traditional).toBe(MIXED_CELL_TRADITIONAL_TOTAL)
    expect(mixedP1Basis.summary.endingEstateHeirTax).toBeGreaterThan(accepted[3])
    expect(mixedP1Basis.summary.endingAfterTaxEstate).toBe(221_250)
    expect(MIXED_CELL_TRADITIONAL_TOTAL - accepted[3]).toBe(232_500)

    expect(mixedP2Basis.result.endingNondeductibleIraBasis).toBe(90_000)
    expect(mixedP2Basis.summary.endingByCategory.traditional).toBe(MIXED_CELL_TRADITIONAL_TOTAL)
    expect(mixedP2Basis.summary.endingEstateHeirTax).toBeLessThan(accepted[4])
    expect(mixedP2Basis.summary.endingAfterTaxEstate).toBe(221_250)
    expect(MIXED_CELL_TRADITIONAL_TOTAL - accepted[4]).toBe(210_000)
  })
})
