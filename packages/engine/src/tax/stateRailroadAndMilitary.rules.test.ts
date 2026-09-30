/**
 * Railroad Retirement Act annuities in every state with an income tax, with
 * the seven states whose instructions the registry quotes (Alabama, New York,
 * Oregon, Rhode Island, South Carolina, Virginia and Wisconsin), and Rhode
 * Island's military service pension modification.
 *
 * 45 U.S.C. 231m(a) forbids any state tax on an annuity or supplemental annuity
 * under the Railroad Retirement Act (usc-45-231m-state-tax-bar); the seven
 * states' instructions subtract it too. A pension tagged Railroad Tier I, Railroad Tier II
 * or Railroad Retirement Act (other) is such an annuity. R.I. Gen. Laws
 * 44-30-12(c)(11) subtracts a military service pension in full, with no age or
 * income test, survivors included (Division of Taxation Publication 2026-01).
 *
 * Each worked case is a single filer in 2026. The two readings are the state
 * tax with the subtraction and without it, where "without" is how the engine
 * priced these pensions before 2026-09-30: as ordinary income, outside every
 * retirement exclusion. Expected amounts are hand calculations from the 2026
 * brackets and deductions the state records register, not copies of helper
 * output; every monetary assertion enters the annual state calculator.
 */
import { describe, expect, it } from 'vitest'

import { stateParamsFor } from '../params/state/index.js'
import { describeRule } from '../rules/describeRule.js'
import { US_STATE_CODES } from '../rules/taxRuleRegistry.js'
import type { TaxYearInput } from '../projection/types.js'
import { computeStateTaxYearResult } from './stateTax.js'
import type { StateHouseholdTaxFacts, StateRetirementDistributionFact } from './stateRetirementFacts.js'

const RAILROAD_SOURCES = ['railroadTier1', 'railroadTier2', 'railroadRetirementAct'] as const

const input = (state: string, change: Partial<TaxYearInput> = {}): TaxYearInput => ({
  year: 2026, state, filingStatus: 'single', ordinaryIncome: 100_000,
  capitalGains: 0, ssBenefits: 0, peopleAged65Plus: 0, agesAlive: [60], ...change,
})
/** A 20,000 dollar tier II annuity, fully included federally, paid to a 60-year-old. */
const fact = (change: Partial<StateRetirementDistributionFact> = {}): StateRetirementDistributionFact => ({
  accountId: 'annuity', ownerPersonId: 'owner', sourceKind: 'railroadTier2',
  federallyIncludedAmount: 20_000, grossDistribution: 20_000, recipientAgeYears: 60,
  recipientAgeKnown: true, cause: 'ordinary', earlyDistributionDisqualifier: 'false',
  ...change,
})
const household = (change: Partial<StateHouseholdTaxFacts> = {}): StateHouseholdTaxFacts => ({
  stateFilingStatus: 'single', federalAgi: 100_000, federallyIncludedSocialSecurity: 0,
  householdGrossSocialSecurity: 0, householdGrossRailroadBenefits: 0,
  exemptionTaxpayerCount: 1, exemptionDependentCount: 0, age65EligibleCount: 0,
  section63fQualificationCount: 0, federalExemptionCount: { known: true, value: 1 },
  claimedAsDependent: false, ...change,
})

/**
 * The state result for a single filer whose ordinary income (federal AGI) is
 * `income`, with `rows` characterized. Rows are part of `income`, as the
 * projection writes them: the pension's gross enters ordinary income and the
 * same amount is its characterized row.
 */
function stateYear(
  state: string,
  income: number,
  rows: readonly StateRetirementDistributionFact[],
  options: { readonly age?: number, readonly facts?: Partial<StateHouseholdTaxFacts> } = {},
) {
  const age = options.age ?? 60
  return computeStateTaxYearResult(input(state, { ordinaryIncome: income, agesAlive: [age] }), {
    retirementDistributions: [...rows], hsaAccounts: [], qcdEvents: [],
    householdFacts: household({ federalAgi: income, ...options.facts }),
  })
}

/** How much the rows take off state taxable income. */
function subtracted(state: string, income: number, rows: readonly StateRetirementDistributionFact[], age = 60): number {
  return stateYear(state, income, [], { age }).taxableIncome - stateYear(state, income, rows, { age }).taxableIncome
}

/**
 * Every railroad source comes off in full, and a railroad employer's own plan,
 * tagged as a private pension, gets only what any private pension gets at 55
 * (South Carolina's 3,000 dollar retirement deduction; nothing elsewhere).
 */
function expectRailroadSourcesSubtracted(state: string, privateAt55: number): void {
  for (const sourceKind of RAILROAD_SOURCES) {
    expect(subtracted(state, 100_000, [fact({ sourceKind })]), sourceKind).toBe(20_000)
  }
  expect(subtracted(state, 100_000, [fact({ sourceKind: 'ordinaryPrivatePension', recipientAgeYears: 55 })], 55)).toBe(privateAt55)
}

describe('Railroad Retirement Act annuities (45 U.S.C. 231m)', () => {
  describeRule('wi-schedule-sb-15-railroad-benefits-not-modeled', {
    readings: { subtractedOnLine15: 6_779.36, taxedAsAPension: 7_839.36 },
    accepted: 'subtractedOnLine15',
  }, ({ accepted, readings }) => {
    it('takes a 20,000 dollar tier II annuity off a 160,000 dollar Wisconsin return', () => {
      // Wisconsin income for the standard deduction is 140,000 after line 15,
      // above the 136,453 single zero point, so no deduction; exemption 700.
      // Taxable 139,300: 3.5% x 15,110 = 528.85; 4.4% x 36,840 = 1,620.96;
      // 5.3% x 87,350 = 4,629.55; total 6,779.36. Without the subtraction the
      // taxable income is 159,300, 20,000 more at 5.3%: 7,839.36.
      const withSubtraction = stateYear('WI', 160_000, [fact()], { facts: { wisconsinIncomeForStandardDeduction: 140_000 } })
      const withoutSubtraction = stateYear('WI', 160_000, [], { facts: { wisconsinIncomeForStandardDeduction: 160_000 } })
      expect(withSubtraction.status).toBe('complete')
      expect(withSubtraction.taxableIncome).toBe(139_300)
      expect(withSubtraction.amount).toBeCloseTo(accepted, 6)
      expect(withoutSubtraction.amount).toBeCloseTo(readings.taxedAsAPension, 6)
    })
    it('subtracts tier I, tier II and the other annuities in full, and not a railroad employer’s own plan', () => {
      expectRailroadSourcesSubtracted('WI', 0)
    })
  })

  describeRule('ny-it225-s122-non-ss-railroad-benefits-not-modeled', {
    readings: { subtracted: 3_723, taxedAsAPension: 4_859.75 },
    accepted: 'subtracted',
  }, ({ accepted, readings }) => {
    it('takes a 20,000 dollar tier II annuity off a 100,000 dollar New York return', () => {
      // Taxable 72,000 after the 8,000 standard deduction: 3.9% x 8,500 = 331.50;
      // 4.4% x 3,200 = 140.80; 5.15% x 2,200 = 113.30; 5.4% x 58,100 = 3,137.40;
      // total 3,723.00. Without: 92,000, adding 5.4% x 8,650 = 467.10 to reach
      // 80,650 and 5.9% x 11,350 = 669.65 above it: 4,859.75.
      const withSubtraction = stateYear('NY', 100_000, [fact()])
      expect(withSubtraction.status).toBe('complete')
      expect(withSubtraction.taxableIncome).toBe(72_000)
      expect(withSubtraction.amount).toBeCloseTo(accepted, 6)
      expect(stateYear('NY', 100_000, []).amount).toBeCloseTo(readings.taxedAsAPension, 6)
    })
    it('subtracts tier I, tier II and the other annuities in full, outside the 20,000 dollar pension exclusion', () => {
      expectRailroadSourcesSubtracted('NY', 0)
      // At 60 a private pension takes the section 612(c)(3-a) exclusion; the
      // annuity beside it does not use that room.
      expect(subtracted('NY', 100_000, [fact(), fact({ accountId: 'private', sourceKind: 'ordinaryPrivatePension' })])).toBe(40_000)
    })
  })

  describeRule('ri-schedule-m-1d-railroad-benefits-not-modeled', {
    readings: { subtractedOnLine1d: 2_580, taxedAsAPension: 3_397.5 },
    accepted: 'subtractedOnLine1d',
  }, ({ accepted, readings }) => {
    it('takes a 20,000 dollar tier II annuity off a 100,000 dollar Rhode Island return', () => {
      // Taxable 68,800 after the 11,200 standard deduction, all at 3.75%:
      // 2,580.00. Without: 88,800, 3.75% x 82,050 = 3,076.875 plus 4.75% x
      // 6,750 = 320.625: 3,397.50.
      const withSubtraction = stateYear('RI', 100_000, [fact()])
      expect(withSubtraction.status).toBe('complete')
      expect(withSubtraction.taxableIncome).toBe(68_800)
      expect(withSubtraction.amount).toBeCloseTo(accepted, 6)
      expect(stateYear('RI', 100_000, []).amount).toBeCloseTo(readings.taxedAsAPension, 6)
    })
    it('subtracts every railroad source at any age and above the pension modification’s AGI limit', () => {
      expectRailroadSourcesSubtracted('RI', 0)
      // 150,000 is above the 107,000 single limit that ends the (c)(9) modification.
      expect(subtracted('RI', 150_000, [fact({ recipientAgeYears: 70 })], 70)).toBe(20_000)
    })
  })

  describeRule('sc-45-usc-231m-railroad-annuities-not-modeled', {
    readings: { exemptUnder231m: 6_328, taxedAsAPension: 7_370 },
    accepted: 'exemptUnder231m',
  }, ({ accepted, readings }) => {
    it('takes a 20,000 dollar tier II annuity off a 160,000 dollar South Carolina return', () => {
      // At 160,000 of federal AGI the SCIAD deduction is fully phased out.
      // Taxable 140,000: 1.99% x 30,000 = 597; 5.21% x 110,000 = 5,731; total
      // 6,328.00. Without: 160,000, 20,000 more at 5.21%: 7,370.00.
      const withSubtraction = stateYear('SC', 160_000, [fact()])
      expect(withSubtraction.status).toBe('complete')
      expect(withSubtraction.taxableIncome).toBe(140_000)
      expect(withSubtraction.amount).toBeCloseTo(accepted, 6)
      expect(stateYear('SC', 160_000, []).amount).toBeCloseTo(readings.taxedAsAPension, 6)
    })
    it('subtracts tier I, tier II and the other annuities in full, and not a railroad employer’s own plan', () => {
      expectRailroadSourcesSubtracted('SC', 3_000)
    })
  })

  describeRule('sc-form1040-line-o-railroad-benefits-not-modeled', {
    readings: { lineOAndRetirementDeduction: 6_171.7, retirementDeductionOnly: 7_213.7 },
    accepted: 'lineOAndRetirementDeduction',
  }, ({ accepted, readings }) => {
    it('subtracts the annuity on line o and leaves the under-65 retirement deduction for an IRA', () => {
      // Age 64: 160,000 of income, of which a 20,000 tier II annuity and a
      // 10,000 IRA distribution. Line o 20,000; retirement deduction
      // min(10,000, 3,000) = 3,000. Taxable 137,000: 597 + 5.21% x 107,000 =
      // 5,574.70; total 6,171.70. Without line o: 157,000, 597 + 5.21% x
      // 127,000 = 6,616.70; total 7,213.70.
      const annuity = fact({ recipientAgeYears: 64 })
      const ira = fact({ accountId: 'ira', sourceKind: 'ira', federallyIncludedAmount: 10_000, grossDistribution: 10_000, recipientAgeYears: 64 })
      const result = stateYear('SC', 160_000, [annuity, ira], { age: 64 })
      expect(result.status).toBe('complete')
      expect(result.taxableIncome).toBe(137_000)
      expect(result.amount).toBeCloseTo(accepted, 6)
      expect(stateYear('SC', 160_000, [ira], { age: 64 }).amount).toBeCloseTo(readings.retirementDeductionOnly, 6)
    })
  })

  describeRule('va-railroad-retirement-and-unemployment-benefits-not-modeled', {
    readings: { subtracted: 3_785.9, taxedAsAPension: 4_935.9 },
    accepted: 'subtracted',
  }, ({ accepted, readings }) => {
    it('takes a 20,000 dollar tier II annuity off a 100,000 dollar Virginia return', () => {
      // Taxable 70,320 after the 8,750 standard deduction and a 930 exemption:
      // 2% x 3,000 = 60; 3% x 2,000 = 60; 5% x 12,000 = 600; 5.75% x 53,320 =
      // 3,065.90; total 3,785.90. Without: 90,320, 20,000 more at 5.75%: 4,935.90.
      const withSubtraction = stateYear('VA', 100_000, [fact()])
      expect(withSubtraction.status).toBe('complete')
      expect(withSubtraction.taxableIncome).toBe(70_320)
      expect(withSubtraction.amount).toBeCloseTo(accepted, 6)
      expect(stateYear('VA', 100_000, []).amount).toBeCloseTo(readings.taxedAsAPension, 6)
    })
    it('subtracts tier II and the other annuities in full, and tier I once, beside its own paragraph (3) subtraction', () => {
      expectRailroadSourcesSubtracted('VA', 0)
      expect(subtracted('VA', 100_000, RAILROAD_SOURCES.map((sourceKind) => fact({ accountId: sourceKind, sourceKind })))).toBe(60_000)
    })
  })

  describeRule('al-form40-railroad-retirement-not-modeled', {
    readings: { notReported: 3_810, taxedAsAPension: 4_810 },
    accepted: 'notReported',
  }, ({ accepted, readings }) => {
    it('takes a 20,000 dollar tier II annuity off a 100,000 dollar Alabama return', () => {
      // Taxable 77,000 after the 3,000 standard deduction the engine carries:
      // 2% x 500 = 10; 4% x 2,500 = 100; 5% x 74,000 = 3,700; total 3,810.00.
      // Without: 97,000, 20,000 more at 5%: 4,810.00.
      const withSubtraction = stateYear('AL', 100_000, [fact()])
      expect(withSubtraction.status).toBe('complete')
      expect(withSubtraction.taxableIncome).toBe(77_000)
      expect(withSubtraction.amount).toBeCloseTo(accepted, 6)
      expect(stateYear('AL', 100_000, []).amount).toBeCloseTo(readings.taxedAsAPension, 6)
    })
    it('subtracts tier I, tier II and the other annuities in full, outside the age-65 exclusion', () => {
      expectRailroadSourcesSubtracted('AL', 0)
      // At 66 a private pension takes the 6,000 dollar exclusion; the annuity
      // beside it does not use that room.
      expect(subtracted('AL', 100_000, [fact({ recipientAgeYears: 66 }), fact({ accountId: 'private', sourceKind: 'ordinaryPrivatePension', recipientAgeYears: 66 })], 66)).toBe(26_000)
    })
  })

  describeRule('or-oar-150-316-0065-railroad-benefits-not-modeled', {
    readings: { subtracted: 6_426.375, taxedAsAPension: 8_176.375 },
    accepted: 'subtracted',
  }, ({ accepted, readings }) => {
    it('takes a 20,000 dollar tier II annuity off a 100,000 dollar Oregon return', () => {
      // Taxable 77,090 after the 2,910 standard deduction: 4.75% x 4,550 =
      // 216.125; 6.75% x 6,850 = 462.375; 8.75% x 65,690 = 5,747.875; total
      // 6,426.375. Without: 97,090, 20,000 more at 8.75%: 8,176.375.
      const withSubtraction = stateYear('OR', 100_000, [fact()])
      expect(withSubtraction.status).toBe('complete')
      expect(withSubtraction.taxableIncome).toBe(77_090)
      expect(withSubtraction.amount).toBeCloseTo(accepted, 6)
      expect(stateYear('OR', 100_000, []).amount).toBeCloseTo(readings.taxedAsAPension, 6)
    })
    it('subtracts tier I, tier II and the other annuities in full, and not a railroad employer’s own plan', () => {
      expectRailroadSourcesSubtracted('OR', 0)
    })
  })
})

describe('45 U.S.C. 231m in every state with an income tax', () => {
  /** Every jurisdiction that taxes wages or pensions in 2026. */
  const incomeTaxStates = US_STATE_CODES.filter((state) => stateParamsFor(state, 2026)?.hasIncomeTax === true)

  describeRule('usc-45-231m-state-tax-bar', {
    note: 'exactly once in every state',
    readings: { subtractedOnce: 20_000, taxedLikeAPension: 0 },
    accepted: 'subtractedOnce',
  }, ({ accepted }) => {
    it('covers every state that taxes wages or pensions, and no other', () => {
      expect(incomeTaxStates).toHaveLength(42)
      for (const state of ['AK', 'FL', 'NH', 'NV', 'SD', 'TN', 'TX', 'WA', 'WY']) {
        expect(incomeTaxStates, state).not.toContain(state)
      }
    })
    it.each([60, 70])('takes each railroad source off once at %i, and leaves every retirement pool to other income', (age) => {
      for (const state of incomeTaxStates) {
        for (const sourceKind of RAILROAD_SOURCES) {
          expect(subtracted(state, 100_000, [fact({ sourceKind, recipientAgeYears: age })], age), `${state} ${sourceKind}`).toBe(accepted)
        }
        // A private pension beside the annuity keeps whatever exclusion it
        // gets alone: the annuity is in no pool.
        const privatePension = fact({ accountId: 'private', sourceKind: 'ordinaryPrivatePension', recipientAgeYears: age })
        expect(subtracted(state, 100_000, [fact({ recipientAgeYears: age }), privatePension], age), state)
          .toBeCloseTo(accepted + subtracted(state, 100_000, [privatePension], age), 6)
      }
    })
  })

  describeRule('usc-45-231m-state-tax-bar', {
    note: 'worked dollar cases',
    readings: {
      subtractedOnce: { PA: 2_456, DE: 4_049, WV: 2_774.9 },
      beforeTheFederalRule: { PA: 3_070, DE: 4_544, WV: 3_690.9 },
    },
    accepted: 'subtractedOnce',
  }, ({ accepted, readings }) => {
    it('prices a 20,000 dollar tier II annuity on a 100,000 dollar return in Pennsylvania, Delaware and West Virginia', () => {
      // Pennsylvania, flat 3.07% with no deduction: 80,000 x 3.07% = 2,456.00;
      // before, the annuity was taxed: 100,000 x 3.07% = 3,070.00.
      // Delaware, 3,250 standard deduction; 0% to 2,000, 2.2% to 5,000, 3.9% to
      // 10,000, 4.8% to 20,000, 5.2% to 25,000, 5.55% to 60,000, 6.6% above.
      // Taxable 76,750: 66 + 195 + 480 + 260 + 1,942.50 + 6.6% x 16,750 =
      // 1,105.50; total 4,049.00. Before, the annuity used the 12,500 pension
      // exclusion at 60, leaving 7,500 more at 6.6%: 4,544.00.
      // West Virginia, 2,000 exemption, no standard deduction; 2.11% to
      // 10,000, 2.81% to 25,000, 3.16% to 40,000, 4.22% to 60,000, 4.58%
      // above. Taxable 78,000: 211 + 421.50 + 474 + 844 + 4.58% x 18,000 =
      // 824.40; total 2,774.90. Before, only tier I came off, so 98,000:
      // 20,000 more at 4.58%: 3,690.90.
      for (const state of ['PA', 'DE', 'WV'] as const) {
        const result = stateYear(state, 100_000, [fact()])
        expect(result.status, state).toBe('complete')
        expect(result.amount, state).toBeCloseTo(accepted[state], 6)
        expect(result.amount, state).not.toBeCloseTo(readings.beforeTheFederalRule[state], 6)
      }
      expect(stateYear('PA', 100_000, []).amount).toBeCloseTo(readings.beforeTheFederalRule.PA, 6)
    })
  })
})

describe('Rhode Island military service pension modification (44-30-12(c)(11))', () => {
  const military = (age: number, change: Partial<StateRetirementDistributionFact> = {}) =>
    fact({ accountId: 'military', sourceKind: 'militaryRetirement', federallyIncludedAmount: 40_000, grossDistribution: 40_000, recipientAgeYears: age, ...change })

  describeRule('ri-code-44-30-12-c-11-military-pension-not-modeled', {
    readings: { subtractedInFull: 1_830, pensionModificationOnly: 3_397.5 },
    accepted: 'subtractedInFull',
  }, ({ accepted, readings }) => {
    it('takes a 40,000 dollar military pension off a 100,000 dollar return at 62, before full retirement age', () => {
      // Taxable 48,800 after the 11,200 standard deduction, at 3.75%: 1,830.00.
      // Under (c)(9) alone nothing comes off before 67: 88,800, 3.75% x 82,050
      // = 3,076.875 plus 4.75% x 6,750 = 320.625: 3,397.50.
      const result = stateYear('RI', 100_000, [military(62)], { age: 62 })
      expect(result.status).toBe('complete')
      expect(result.taxableIncome).toBe(48_800)
      expect(result.amount).toBeCloseTo(accepted, 6)
      expect(stateYear('RI', 100_000, [], { age: 62 }).amount).toBeCloseTo(readings.pensionModificationOnly, 6)
      expect(stateYear('RI', 100_000, [military(62, { sourceKind: 'militarySurvivor' })], { age: 62 }).amount).toBeCloseTo(accepted, 6)
    })
    it('holds above the (c)(9) AGI limit, and leaves the (c)(9) room to other pensions', () => {
      // 68, 150,000: taxable 98,800, 3,076.875 + 4.75% x 16,750 = 795.625:
      // 3,872.50 (the engine charged 5,772.50 on 138,800 before).
      expect(stateYear('RI', 150_000, [military(68)], { age: 68 }).amount).toBeCloseTo(3_872.5, 6)
      // 68, 100,000 with a 30,000 private pension: 40,000 under (c)(11) and
      // 30,000 under (c)(9) leave 18,800 at 3.75% = 705.00 (the shared
      // 50,000 cap left 38,800, 1,455.00).
      const both = [military(68), fact({ accountId: 'private', sourceKind: 'ordinaryPrivatePension', federallyIncludedAmount: 30_000, grossDistribution: 30_000, recipientAgeYears: 68 })]
      expect(stateYear('RI', 100_000, both, { age: 68 }).amount).toBeCloseTo(705, 6)
    })
  })
})
