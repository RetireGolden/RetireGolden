import { describe, expect, it, vi } from 'vitest'

import type { Account } from '../../model/plan.js'
import { packForYear } from '../../params/index.js'
import type { TaxCalculator, TaxYearInput, YearWithdrawals } from '../types.js'
import {
  annualFundingCandidateEvaluation,
  type AnnualFundingCandidateEvaluationInput,
  type AnnualFundingCandidateWithdrawalPlan,
} from './annualFundingCandidateEvaluation.js'
import type { AnnualFundingWithdrawalEffectAccount } from './annualFundingWithdrawalEffects.js'

interface TestWithdrawalPlan extends AnnualFundingCandidateWithdrawalPlan {
  readonly marker: string
}

const withdrawals = (
  values: Partial<YearWithdrawals> = {},
): YearWithdrawals => ({
  cash: 0,
  taxable: 0,
  traditional: 0,
  roth: 0,
  hsa: 0,
  total: 0,
  ...values,
})

const withdrawalPlan = (
  byCategory: YearWithdrawals = withdrawals(),
  byAccountId: ReadonlyMap<string, number> = new Map(),
  realizedGains = 0,
): TestWithdrawalPlan => ({
  marker: 'caller-plan',
  byCategory,
  byAccountId,
  realizedGains,
  shortfall: 0,
})

const traditionalAccount = (): Extract<Account, { type: 'traditional' }> => ({
  type: 'traditional',
  id: 'traditional',
  name: 'Traditional IRA',
  ownerPersonId: 'p1',
  annualReturnPct: 0,
  kind: 'ira',
  balance: 1_000,
  annualContribution: 0,
})

const pack = packForYear(2026).pack

const baseInput = (
  plan: TestWithdrawalPlan,
  taxCalculator: TaxCalculator,
): AnnualFundingCandidateEvaluationInput<TestWithdrawalPlan> => ({
  request: { need: 0, forceGrossAca: false, cashInflows: 0 },
  withdrawalPlan: plan,
  iraCharacter: {
    nontaxable: 0,
    taxableBySourceAccountId: new Map(),
  },
  withdrawalEffectAccounts: [],
  hsaEffectAccounts: [],
  rothBasisByPool: new Map(),
  taxCalculator,
  taxInputBase: {
    year: 2026,
    filingStatus: 'single',
    ssBenefits: 0,
    peopleAged65Plus: 0,
  },
  ordinaryIncomeBase: 0,
  privateRetirementIncomeBase: 0,
  preWithdrawalCapitalResult: 0,
  capitalLossCarryforward: 0,
  capitalLossOrdinaryOffsetLimit:
    pack.federalTax.capitalLossOrdinaryOffsetLimit,
  currentHealthcare: 0,
  aca: {
    active: false,
    contract: null,
    initialSupportCodes: [],
    generatedTaxExemptInterest: 0,
    planDerivedTaxExemptInterest: false,
    grossEnrollmentPremium: 0,
    enrollmentPremiums: [],
    slcspBenchmarkPremiums: [],
    healthcareExcludingEnrollment: 0,
    pricingInflationScale: 1,
  },
  hsa: {
    initialQualifiedCap: 0,
    qualifiedExpenseCap: 0,
  },
  parameterPack: pack,
  spendingAndContributions: 0,
  rmdShortfallExciseTax: 0,
  tolerancePlanDollars: 0.005,
})

describe('annualFundingCandidateEvaluation', () => {
  it('pairs Form 8606 character, capital-loss netting, tax, and traditional penalty without replacing the withdrawal plan', () => {
    // Independent worksheet for the coordinator boundary:
    // $100 IRA draw - $20 basis return = $80 taxable ordinary. With the $10
    // ordinary base, ordinary income is $90. A $40 opening loss absorbs the
    // $30 current gain, then puts the remaining $10 deduction on Schedule D,
    // so the test double prices $90 + (-$10) = $80 tax. IRC 72(t)(1)'s 10%
    // additional tax applies to the $80 includible share = $8. Adding the $2
    // upstream RMD-shortfall excise gives $10 penalties. Required cash is $50
    // spending + $80 tax + $10 penalties - $30 inflow = $110.
    const plan = withdrawalPlan(
      withdrawals({ traditional: 100, total: 100 }),
      new Map([['traditional', 100]]),
      25,
    )
    const taxInputs: TaxYearInput[] = []
    const taxCalculator: TaxCalculator = {
      compute(input) {
        taxInputs.push(structuredClone(input))
        return input.ordinaryIncome + input.capitalGains
      },
    }
    const account: AnnualFundingWithdrawalEffectAccount = {
      kind: 'traditional',
      sourceAccountId: 'traditional',
      account: traditionalAccount(),
      ownerAgeAttained: 50,
      ownerRetirementAge: null,
      treatAsOwnEffective: false,
    }
    const input = baseInput(plan, taxCalculator)

    const result = annualFundingCandidateEvaluation({
      ...input,
      request: { need: 100, forceGrossAca: false, cashInflows: 30 },
      iraCharacter: {
        nontaxable: 20,
        taxableBySourceAccountId: new Map([['traditional', 80]]),
      },
      withdrawalEffectAccounts: [account],
      ordinaryIncomeBase: 10,
      privateRetirementIncomeBase: 15,
      preWithdrawalCapitalResult: 5,
      capitalLossCarryforward: 40,
      spendingAndContributions: 50,
      rmdShortfallExciseTax: 2,
    })

    expect(result.withdrawalPlan).toBe(plan)
    expect(result.tax).toBe(80)
    expect(result.penalties).toBe(10)
    expect(result.requiredNeed).toBe(110)
    expect(result.traditionalEarlyWithdrawalPenaltyCharged).toBe(true)
    expect(taxInputs).toEqual([
      expect.objectContaining({
        ordinaryIncome: 90,
        capitalGains: -10,
        realizedCapitalGainsBeforeCarryforward: 30,
        privateRetirementIncome: 95,
      }),
    ])
  })

  it('recharacterizes only HSA effects against the supported qualified-expense cap', () => {
    // Projection convention worksheet: a $100 cap-by-medical HSA draw against
    // $60 supported expenses leaves $40 non-qualified. The flat tax double sees
    // $40 ordinary, and IRC 223(f)(4)(A)'s 20% additional tax is $8.
    const plan = withdrawalPlan(
      withdrawals({ hsa: 100, total: 100 }),
      new Map([['hsa', 100]]),
    )
    const ordinaryInputs: number[] = []
    const taxCalculator: TaxCalculator = {
      compute(input) {
        ordinaryInputs.push(input.ordinaryIncome)
        return input.ordinaryIncome
      },
    }
    const account: AnnualFundingWithdrawalEffectAccount = {
      kind: 'hsa',
      sourceAccountId: 'hsa',
      withdrawalTreatment: 'capByMedicalExpenses',
      ownerAgeAttained: 50,
    }
    const input = baseInput(plan, taxCalculator)

    const result = annualFundingCandidateEvaluation({
      ...input,
      withdrawalEffectAccounts: [account],
      hsaEffectAccounts: [account],
      hsa: { initialQualifiedCap: 0, qualifiedExpenseCap: 60 },
    })

    expect(ordinaryInputs).toEqual([100, 40])
    expect(result.tax).toBe(40)
    expect(result.penalties).toBe(8)
    expect(result.requiredNeed).toBe(48)
    expect(result.hsaQualifiedCap).toBe(60)
    expect(result.traditionalEarlyWithdrawalPenaltyCharged).toBe(false)
  })

  it('uses plan-derived tax-exempt interest without making its provenance code block ACA pricing', () => {
    const plan = withdrawalPlan()
    const input = baseInput(plan, { compute: () => 0 })
    const monthlyPremiums = new Array<number>(12).fill(1_000)

    const result = annualFundingCandidateEvaluation({
      ...input,
      ordinaryIncomeBase: 30_000,
      currentHealthcare: 12_000,
      spendingAndContributions: 12_000,
      taxInputBase: {
        ...input.taxInputBase,
        taxExemptInterest: 1_000,
      },
      aca: {
        active: true,
        contract: {
          taxFamilySize: 1,
          fplRegion: 'contiguous',
          taxExemptInterest: { state: 'unknown', amount: null },
          foreignExclusionAddback: { state: 'known', amount: 0 },
          dependents: [],
        },
        initialSupportCodes: [],
        generatedTaxExemptInterest: 1_000,
        planDerivedTaxExemptInterest: true,
        grossEnrollmentPremium: 12_000,
        enrollmentPremiums: monthlyPremiums,
        slcspBenchmarkPremiums: monthlyPremiums,
        healthcareExcludingEnrollment: 0,
        pricingInflationScale: 1,
      },
    })

    expect(result.acaSupportCodes).toContain(
      'tax-exempt-interest-plan-derived',
    )
    expect(result.acaMagiProbe?.magi).toBe(31_000)
    expect(result.acaQuote).not.toBeNull()
    expect(result.healthcare).toBeLessThan(12_000)
    expect(result.requiredNeed).toBe(result.healthcare)
  })

  it('takes the greater of known attested and generated tax-exempt interest for ACA MAGI', () => {
    const plan = withdrawalPlan()
    const input = baseInput(plan, { compute: () => 0 })
    const monthlyPremiums = new Array<number>(12).fill(1_000)

    const result = annualFundingCandidateEvaluation({
      ...input,
      ordinaryIncomeBase: 30_000,
      taxInputBase: {
        ...input.taxInputBase,
        taxExemptInterest: 2_000,
      },
      aca: {
        active: true,
        contract: {
          taxFamilySize: 1,
          fplRegion: 'contiguous',
          taxExemptInterest: { state: 'known', amount: 1_000 },
          foreignExclusionAddback: { state: 'known', amount: 0 },
          dependents: [],
        },
        initialSupportCodes: [],
        generatedTaxExemptInterest: 2_000,
        planDerivedTaxExemptInterest: true,
        grossEnrollmentPremium: 12_000,
        enrollmentPremiums: monthlyPremiums,
        slcspBenchmarkPremiums: monthlyPremiums,
        healthcareExcludingEnrollment: 0,
        pricingInflationScale: 1,
      },
    })

    expect(result.acaMagiProbe?.components.taxExemptInterest).toBe(2_000)
    expect(result.acaMagiProbe?.magi).toBe(32_000)
    expect(result.acaQuote).not.toBeNull()

    const attestedDominant = annualFundingCandidateEvaluation({
      ...input,
      ordinaryIncomeBase: 30_000,
      taxInputBase: {
        ...input.taxInputBase,
        taxExemptInterest: 2_000,
      },
      aca: {
        active: true,
        contract: {
          taxFamilySize: 1,
          fplRegion: 'contiguous',
          taxExemptInterest: { state: 'known', amount: 3_000 },
          foreignExclusionAddback: { state: 'known', amount: 0 },
          dependents: [],
        },
        initialSupportCodes: [],
        generatedTaxExemptInterest: 2_000,
        planDerivedTaxExemptInterest: true,
        grossEnrollmentPremium: 12_000,
        enrollmentPremiums: monthlyPremiums,
        slcspBenchmarkPremiums: monthlyPremiums,
        healthcareExcludingEnrollment: 0,
        pricingInflationScale: 1,
      },
    })

    expect(attestedDominant.acaMagiProbe?.components.taxExemptInterest).toBe(3_000)
    expect(attestedDominant.acaMagiProbe?.magi).toBe(33_000)
    expect(attestedDominant.acaQuote).not.toBeNull()
  })

  it('annotates a contradicted not-applicable attestation without blocking ACA pricing', () => {
    const plan = withdrawalPlan()
    const input = baseInput(plan, { compute: () => 0 })
    const monthlyPremiums = new Array<number>(12).fill(1_000)

    const result = annualFundingCandidateEvaluation({
      ...input,
      ordinaryIncomeBase: 30_000,
      taxInputBase: {
        ...input.taxInputBase,
        taxExemptInterest: 1_000,
      },
      aca: {
        active: true,
        contract: {
          taxFamilySize: 1,
          fplRegion: 'contiguous',
          taxExemptInterest: { state: 'notApplicable', amount: null },
          foreignExclusionAddback: { state: 'known', amount: 0 },
          dependents: [],
        },
        initialSupportCodes: [],
        generatedTaxExemptInterest: 1_000,
        planDerivedTaxExemptInterest: true,
        grossEnrollmentPremium: 12_000,
        enrollmentPremiums: monthlyPremiums,
        slcspBenchmarkPremiums: monthlyPremiums,
        healthcareExcludingEnrollment: 0,
        pricingInflationScale: 1,
      },
    })

    expect(result.acaSupportCodes).toContain(
      'tax-exempt-interest-contract-contradicted',
    )
    expect(result.acaMagiProbe?.magi).toBe(31_000)
    expect(result.acaQuote).not.toBeNull()
  })

  it('honors a gross-premium basin request while retaining ACA MAGI evidence', () => {
    const plan = withdrawalPlan()
    const input = baseInput(plan, { compute: () => 0 })
    const monthlyPremiums = new Array<number>(12).fill(1_000)

    const result = annualFundingCandidateEvaluation({
      ...input,
      request: { need: 0, forceGrossAca: true, cashInflows: 0 },
      ordinaryIncomeBase: 30_000,
      currentHealthcare: 12_000,
      spendingAndContributions: 12_000,
      aca: {
        active: true,
        contract: {
          taxFamilySize: 1,
          fplRegion: 'contiguous',
          taxExemptInterest: { state: 'known', amount: 0 },
          foreignExclusionAddback: { state: 'known', amount: 0 },
          dependents: [],
        },
        initialSupportCodes: [],
        generatedTaxExemptInterest: 0,
        planDerivedTaxExemptInterest: false,
        grossEnrollmentPremium: 12_000,
        enrollmentPremiums: monthlyPremiums,
        slcspBenchmarkPremiums: monthlyPremiums,
        healthcareExcludingEnrollment: 0,
        pricingInflationScale: 1,
      },
    })

    expect(result.acaMagiProbe?.magi).toBe(30_000)
    expect(result.acaQuote).toBeNull()
    expect(result.healthcare).toBe(12_000)
    expect(result.requiredNeed).toBe(12_000)
  })

  it('does not mutate caller-owned maps or arrays', () => {
    const withdrawalsByAccountId = new Map([['hsa', 10]])
    const supportCodes = ['missing-year-contract'] as const
    const plan = withdrawalPlan(
      withdrawals({ hsa: 10, total: 10 }),
      withdrawalsByAccountId,
    )
    const taxCalculator: TaxCalculator = { compute: vi.fn(() => 0) }
    const input = baseInput(plan, taxCalculator)

    annualFundingCandidateEvaluation({
      ...input,
      aca: { ...input.aca, initialSupportCodes: supportCodes },
    })

    expect([...withdrawalsByAccountId]).toEqual([['hsa', 10]])
    expect(supportCodes).toEqual(['missing-year-contract'])
  })
})
