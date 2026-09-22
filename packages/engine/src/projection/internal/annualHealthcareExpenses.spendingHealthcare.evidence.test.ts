import { expect, it } from 'vitest'

import { describeCalculation, withinTolerance } from '../../rules/describeCalculation.js'
import type { Plan } from '../../model/plan.js'
import {
  cashAccount,
  couplePlan,
  productionTaxCalculator,
  singlePersonPlan,
  validatePlan,
} from '../../testing/planFixtures.js'
import { simulatePlan } from '../simulate.js'
import type { YearResult } from '../types.js'

const START_YEAR = 2025
const ASSERTED_YEAR = 2026

/** The worksheet's two people: the first all-Medicare, the second turning 65 in May. */
const MEDICARE_PERSON_DOB = '1958-03-15'
const MARKETPLACE_PERSON_DOB = '1961-05-10'

/**
 * Shared assumptions for every plan below. The projection starts in 2025 with
 * zero general inflation and a 10% healthcare extra, so the factor from the
 * START year to 2026 is 1.10 while the factor from the PACK year (2026) to
 * 2026 is 1: the tier-priced Medicare premium is unscaled and the extras and
 * marketplace premium are scaled — the two inflation clocks the worksheet's
 * first wrong reading confuses. The IRMAA tier comes from
 * assumptions.recentAnnualMagi because the 2024 lookback year is before the
 * projection.
 */
function withHealthcareAssumptions(
  plan: Plan,
  lookbackMagi: number,
  healthcare: Plan['expenses']['healthcare'],
): Plan {
  plan.accounts = [cashAccount('cash', 200_000)]
  plan.assumptions.inflationPct = 0
  plan.assumptions.healthcareExtraInflationPct = 10
  plan.assumptions.recentAnnualMagi = lookbackMagi
  plan.expenses.healthcare = healthcare
  return plan
}

function assertedRow(plan: Plan): YearResult {
  const result = simulatePlan(validatePlan(plan), {
    startYear: START_YEAR,
    horizonEndYear: ASSERTED_YEAR,
    taxCalculator: productionTaxCalculator(),
  })
  const row = result.years.find((entry) => entry.year === ASSERTED_YEAR)
  if (row === undefined) throw new Error(`missing projection year ${ASSERTED_YEAR}`)
  return row
}

describeCalculation(
  'spending-healthcare-annual',
  {
    example: {
      inputs: {
        firstPersonMarketplaceAndMedicareMonths: [0, 12],
        filingStatus: 'single',
        lookbackMagiTier: 1,
        tierPricedAnnualPremium: 3_582.72,
        medicareExtrasMonthly: 50,
        secondPersonMarketplaceAndMedicareMonths: [4, 8],
        creditEnabled: false,
        pre65MarketplaceMonthlyPremium: 400,
        healthInflationFactor: 1.1,
        singleFilerTierOneLookbackMagi: 120_000,
        jointFilerTierOneLookbackMagi: 240_000,
      },
      expected: {
        firstPersonHealthcare: 4_242.72,
        secondPersonMarketplace: 1_760,
        secondPersonMedicare: 2_828.48,
        secondPersonHealthcare: 4_588.48,
        householdMedicarePremiums: 5_971.2,
        householdHealthcare: 8_831.2,
        inflatedMedicarePremiumWrongReading: 4_600.992,
        marketplaceWithoutHealthFactorWrongReading: 1_600,
        forgottenMedicareMonthsWrongReading: 6_002.72,
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/medicare-and-aca/spending-healthcare-annual.md',
    mutation: 'DOCS/calculations/medicare-and-aca/spending-healthcare-annual.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number | number[] | string | boolean>
    const expected = example.expected as Record<string, number>
    const extrasMonthly = inputs.medicareExtrasMonthly as number
    const marketplaceMonthly = inputs.pre65MarketplaceMonthlyPremium as number
    const healthFactor = inputs.healthInflationFactor as number
    const tierPremium = inputs.tierPricedAnnualPremium as number
    const creditEnabled = inputs.creditEnabled as boolean
    const [, firstMedicareMonths] = inputs.firstPersonMarketplaceAndMedicareMonths as number[]
    const [secondMarketplaceMonths, secondMedicareMonths] =
      inputs.secondPersonMarketplaceAndMedicareMonths as number[]

    function expectWithin(actual: number, target: number, label: string): void {
      expect(
        withinTolerance(actual, target, example.tolerance),
        `${label} ${actual} is not within ${JSON.stringify(example.tolerance)} of ${target}`,
      ).toBe(true)
    }

    /** The worksheet's household on one plan: both people, both premiums. */
    function householdRow(): YearResult {
      return assertedRow(
        withHealthcareAssumptions(
          couplePlan({
            p1Dob: MEDICARE_PERSON_DOB,
            p2Dob: MARKETPLACE_PERSON_DOB,
            p1PlanningAge: 95,
            p2PlanningAge: 95,
          }),
          inputs.jointFilerTierOneLookbackMagi as number,
          {
            pre65MonthlyPremiumPerPerson: marketplaceMonthly,
            applyAcaCredit: creditEnabled,
            medicareExtrasMonthlyPerPerson: extrasMonthly,
          },
        ),
      )
    }

    /** Either worksheet person alone, so that person's own component is the published total. */
    function personRow(dob: string): YearResult {
      return assertedRow(
        withHealthcareAssumptions(
          singlePersonPlan({ dob, planningAge: 95 }),
          inputs.singleFilerTierOneLookbackMagi as number,
          {
            pre65MonthlyPremiumPerPerson: marketplaceMonthly,
            applyAcaCredit: creditEnabled,
            medicareExtrasMonthlyPerPerson: extrasMonthly,
          },
        ),
      )
    }

    it('charges the first person 4242.72: twelve Medicare months of tier premium plus scaled extras', () => {
      // Born March 1958: 68 in 2026, so zero marketplace months and all 12
      // months are Medicare months.
      const row = personRow(MEDICARE_PERSON_DOB)
      expect(row.irmaaTier).toBe(inputs.lookbackMagiTier)
      // The constructed row really is at the worksheet's tier, with the
      // worksheet's tier-priced annual premium over twelve months.
      expectWithin(row.medicarePremiums, tierPremium, 'medicarePremiums')
      expectWithin(row.expenses.healthcare, expected.firstPersonHealthcare!, 'healthcare')
      // ... and it is the UNSCALED tier premium plus the SCALED extras.
      expectWithin(
        row.expenses.healthcare,
        tierPremium + extrasMonthly * firstMedicareMonths! * healthFactor,
        'healthcare against its own components',
      )
      // The worksheet's first wrong reading: inflating the tier-priced annual
      // premium as well as the extras.
      expect(
        withinTolerance(row.expenses.healthcare, expected.inflatedMedicarePremiumWrongReading!, example.tolerance),
      ).toBe(false)
    })

    it('charges the second person 4588.48: 1760 of marketplace beside 2828.48 of Medicare', () => {
      // Born May 1961: attains 65 in 2026, so marketplace months are
      // birthMonth - 1 = 4 and the remaining 8 are Medicare months — the two
      // counts partition that person's year.
      const row = personRow(MARKETPLACE_PERSON_DOB)
      expect(row.irmaaTier).toBe(inputs.lookbackMagiTier)
      expectWithin(
        row.medicarePremiums,
        (tierPremium * secondMedicareMonths!) / 12,
        'medicarePremiums over the eight Medicare months',
      )
      const medicareComponent = row.medicarePremiums + extrasMonthly * secondMedicareMonths! * healthFactor
      const marketplaceComponent = row.expenses.healthcare - medicareComponent
      expectWithin(medicareComponent, expected.secondPersonMedicare!, 'Medicare component')
      expectWithin(marketplaceComponent, expected.secondPersonMarketplace!, 'marketplace component')
      expectWithin(row.expenses.healthcare, expected.secondPersonHealthcare!, 'healthcare')
      // The worksheet's second wrong reading: omitting the health factor from
      // the marketplace premium.
      expect(
        withinTolerance(
          marketplaceComponent,
          expected.marketplaceWithoutHealthFactorWrongReading!,
          example.tolerance,
        ),
      ).toBe(false)
    })

    it('adds the two people to 8831.20 on one household plan', () => {
      const row = householdRow()
      expect(row.irmaaTier).toBe(inputs.lookbackMagiTier)
      // The household really carries 12 + 8 = 20 Medicare months of tier
      // premium, so the second person's eight months are in the total.
      expectWithin(
        row.medicarePremiums,
        expected.householdMedicarePremiums!,
        'household medicarePremiums',
      )
      expectWithin(
        row.medicarePremiums,
        (tierPremium * (firstMedicareMonths! + secondMedicareMonths!)) / 12,
        'household medicarePremiums against the two month counts',
      )
      expectWithin(row.expenses.healthcare, expected.householdHealthcare!, 'household healthcare')
      // ... and the composition is the plain sum of the two people's own
      // components, each asserted above on its own plan.
      expectWithin(
        row.expenses.healthcare,
        personRow(MEDICARE_PERSON_DOB).expenses.healthcare + personRow(MARKETPLACE_PERSON_DOB).expenses.healthcare,
        'household healthcare against the two per-person components',
      )
      // The worksheet's third wrong reading: forgetting the second person's
      // eight Medicare months, which leaves that person marketplace-only and
      // violates the per-person 12-month partition.
      expect(
        withinTolerance(
          row.expenses.healthcare,
          expected.forgottenMedicareMonthsWrongReading!,
          example.tolerance,
        ),
      ).toBe(false)
      expectWithin(
        expected.firstPersonHealthcare! + marketplaceMonthly * secondMarketplaceMonths! * healthFactor,
        expected.forgottenMedicareMonthsWrongReading!,
        'the forgotten-Medicare-months reading',
      )
    })
  },
)
