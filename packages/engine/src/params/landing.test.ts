/**
 * One publisher's 2027 figures, landed end to end through the component table
 * (decision D-2027-ROLLOVER; review L10, 2026-09-29).
 *
 * The review found that every reader added for the split was equivalent to
 * the whole-pack reading it replaced while every publisher's latest year is
 * 2026, so no test could tell them apart: its mutants G09 to G14, H04, H06 and
 * H07 survived. Here one publisher at a time lands an illustrative 2027
 * record (`testing/parameterLanding.ts`: its 2026 figures copied, the QCD
 * limit raised) through the test seam `withParameterComponents`, and each
 * reader is held to reading its OWN publisher's year:
 *
 * - the named-QCD gate and its evidence read the retirement-plan limits
 *   (H04, H07), and so does the stand-in warning (H06);
 * - `isStandIn` is the income-tax component's flag (G09);
 * - Social Security's figures grow from SSA's year (G10);
 * - the Medicare readers see CMS's year (G11, G14);
 * - the HUD opening gate waits on HUD's publication (G12) is held by
 *   `hecmHudValidatedOpeningAdapter`'s own tests at the lookup level below.
 *
 * Authority: none; this pins the mechanism the decision chose, not a figure.
 * The landed values are illustrative.
 */
import { describe, expect, it } from 'vitest'

import { asAccountId, asActionId, asAllocationId, asPersonId } from '../actions/identity.js'
import { asPositiveUsdCents, asUsdCents } from '../actions/money.js'
import type { QualifiedCharitableDistributionRequest } from '../actions/contract.js'
import type { Plan } from '../model/plan.js'
import { simulatePlan } from '../projection/simulate.js'
import { landedComponents } from '../testing/parameterLanding.js'
import {
  cashAccount,
  productionTaxCalculator,
  singlePersonPlan,
  socialSecurityIncome,
  traditionalAccount,
  validatePlan,
} from '../testing/planFixtures.js'
import { componentPackView, packForYear, withParameterComponents } from './index.js'

const QCD_LIMIT_2027 = 114_000

describe('the test seam', () => {
  it('puts a landed table in force for the readers, and the real one back after', () => {
    const table = landedComponents(['irsRetirementPlanLimits'], 2027)
    withParameterComponents(table, () => {
      expect(packForYear(2027).components.irsRetirementPlanLimits).toMatchObject({ baseYear: 2027, standIn: false })
      expect(packForYear(2027).components.irsIncomeTax).toMatchObject({ baseYear: 2026, standIn: true })
    })
    expect(packForYear(2027).components.irsRetirementPlanLimits).toMatchObject({ baseYear: 2026, standIn: true })
  })
})

describe('each reader reads its own publisher', () => {
  it('isStandIn is the income-tax figures’ flag, not another publisher’s (G09)', () => {
    withParameterComponents(landedComponents(['irsIncomeTax'], 2027), () => {
      expect(packForYear(2027).isStandIn).toBe(false)
    })
    withParameterComponents(landedComponents(['ssaProgram'], 2027), () => {
      expect(packForYear(2027).isStandIn).toBe(true)
    })
  })

  it('the Medicare view carries CMS’s own year (G14)', () => {
    withParameterComponents(landedComponents(['cmsMedicare'], 2027), () => {
      expect(componentPackView(packForYear(2027), 'cmsMedicare').year).toBe(2027)
    })
    expect(componentPackView(packForYear(2027), 'cmsMedicare').year).toBe(2026)
  })

  function medicarePlan(): Plan {
    const plan = singlePersonPlan({ dob: '1960-03-01', planningAge: 90, retirementAge: 65 })
    plan.id = 'landing-medicare'
    plan.assumptions.inflationPct = 2.5
    plan.assumptions.healthcareExtraInflationPct = 3
    plan.accounts = [cashAccount('cash', 2_000_000)]
    return validatePlan(plan)
  }
  const healthcare2027 = () =>
    simulatePlan(medicarePlan(), { startYear: 2026, horizonEndYear: 2027, taxCalculator: productionTaxCalculator() })
      .years.find((row) => row.year === 2027)!.expenses.healthcare

  it('Medicare premiums in a year CMS has published are not grown from 2026 (G11)', () => {
    const projected = healthcare2027()
    const published = withParameterComponents(landedComponents(['cmsMedicare'], 2027), healthcare2027)
    // The same 2026 figures, read as 2027's own: nothing grows them.
    expect(published).toBeLessThan(projected)
    // Landing another publisher leaves Medicare projected.
    expect(withParameterComponents(landedComponents(['irsIncomeTax'], 2027), healthcare2027)).toBeCloseTo(projected, 6)
  })

  function earningsTestPlan(): Plan {
    // Born mid-1965: 62 in 2027, claiming then with $35,000 of wages, so the
    // earnings test withholds some months and its exempt amount (an SSA
    // figure) decides how many. At 10% inflation the projected exempt amount
    // is a month of benefits away from the 2026 one.
    const plan = singlePersonPlan({ dob: '1965-06-15', planningAge: 90 })
    plan.id = 'landing-earnings-test'
    plan.assumptions.inflationPct = 10
    plan.accounts = [cashAccount('cash', 500_000)]
    plan.incomes = [
      { type: 'wages', id: 'w1', personId: 'p1', annualGross: 35_000, endAge: null, realGrowthPct: 0 } as Plan['incomes'][number],
      socialSecurityIncome('ss', 2_000, 62),
    ]
    return validatePlan(plan)
  }
  const socialSecurity2027 = () =>
    simulatePlan(earningsTestPlan(), { startYear: 2026, horizonEndYear: 2027, taxCalculator: productionTaxCalculator() })
      .years.find((row) => row.year === 2027)!.incomes.socialSecurity

  it('Social Security’s figures grow from SSA’s year, not the income-tax figures’ (G10)', () => {
    const projected = socialSecurity2027()
    expect(projected).toBeGreaterThan(0)
    // Landing the income-tax figures changes no SSA figure.
    expect(withParameterComponents(landedComponents(['irsIncomeTax'], 2027), socialSecurity2027)).toBeCloseTo(projected, 6)
    // Landing SSA's own (the 2026 figures, not grown) changes the withholding.
    expect(withParameterComponents(landedComponents(['ssaProgram'], 2027), socialSecurity2027)).not.toBeCloseTo(projected, 2)
  })
})

describe('the named-QCD gate waits only on the retirement-plan limits (H04, H06)', () => {
  const YEAR = 2027
  function namedQcd(): QualifiedCharitableDistributionRequest {
    const amount = asPositiveUsdCents(20_000 * 100)
    return {
      actionId: asActionId('qcd-2027'),
      kind: 'qcd',
      year: YEAR,
      executionDate: `${YEAR}-08-01`,
      executionSequence: 1,
      requestedAmount: amount,
      provenance: { source: 'manual' },
      donorPersonId: asPersonId('p1'),
      allocation: { allocationId: asAllocationId('qcd-2027-allocation'), sourceAccountId: asAccountId('ira'), requestedAmount: amount },
      charity: {
        designationId: 'charity-1',
        name: 'Public charity',
        designationKind: 'eligiblePublicCharity',
        directFromCustodianAttested: true,
        eligibleOrganizationAttested: true,
        notDonorAdvisedFundOrSupportingOrganizationAttested: true,
        notSplitInterestEntityAttested: true,
        entireDistributionOtherwiseDeductibleAttested: true,
      },
    }
  }
  function donorPlan(): Plan {
    const plan = singlePersonPlan({ dob: '1950-03-01', planningAge: 95 })
    plan.id = 'landing-named-qcd'
    const ira = traditionalAccount('ira', 500_000, 'p1', 'ira')
    plan.accounts = [{ ...ira, annualReturnPct: 0 } as Plan['accounts'][number], cashAccount('cash', 200_000)]
    plan.strategies.retirementActions = [namedQcd()]
    const years: number[] = []
    for (let taxYear = 2020; taxYear <= YEAR; taxYear += 1) years.push(taxYear)
    plan.retirementActionEligibilityFacts = {
      iraClassifications: [{ sourceAccountId: 'ira', subtype: 'traditional', evidenceId: 'classification-ira', provenance: { source: 'manual' } }],
      sepSimpleActivities: [],
      deductibleIraContributions: years.map((taxYear) => ({
        donorPersonId: 'p1',
        taxYear,
        amountCents: asUsdCents(0),
        evidenceId: `contribution-${taxYear}`,
        provenance: { source: 'manual', sourceId: `ledger-${taxYear}` },
      })),
    }
    return validatePlan(plan)
  }
  const run = () => simulatePlan(donorPlan(), { startYear: YEAR, horizonEndYear: YEAR, taxCalculator: productionTaxCalculator() })
  const standInWarning = (warnings: readonly string[]) => warnings.some((warning) => warning.includes('no sourced QCD limit'))

  it('holds the gift while the limit is projected', () => {
    const result = run()
    expect(result.years[0]!.qcd).toBe(0)
    expect(standInWarning(result.warnings)).toBe(true)
  })

  it('executes it once the retirement-plan limits land, while the income-tax figures are still projected', () => {
    const result = withParameterComponents(
      landedComponents(['irsRetirementPlanLimits'], YEAR, { 'rmd.qcdAnnualLimit': QCD_LIMIT_2027 }),
      () => {
        expect(packForYear(YEAR).isStandIn).toBe(true)
        return run()
      },
    )
    expect(result.years[0]!.qcd).toBeCloseTo(20_000, 6)
    expect(standInWarning(result.warnings)).toBe(false)
  })

  it('still holds it when only the income-tax figures land', () => {
    const result = withParameterComponents(landedComponents(['irsIncomeTax'], YEAR), run)
    expect(result.years[0]!.qcd).toBe(0)
    expect(standInWarning(result.warnings)).toBe(true)
  })
})
