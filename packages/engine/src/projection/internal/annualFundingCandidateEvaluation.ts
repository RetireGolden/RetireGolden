import type { ParameterPack } from '../../params/types.js'
import type { RothBasisState } from '../../strategies/rothBasis.js'
import {
  acaEconomicPremiumByMonth,
  buildAcaHouseholdMagi,
  type AcaFplRegion,
  type AcaHouseholdMagiInput,
  type AcaHouseholdMagiResult,
  type AcaResult,
} from '../../tax/aca.js'
import {
  applyCapitalLossCarryforward,
  computeFederalTax,
} from '../../tax/federalTax.js'
import type {
  AcaSupportCode,
  TaxCalculator,
  TaxYearInput,
  YearWithdrawals,
} from '../types.js'
import type { AnnualFundingFixedPointEvaluationRequest } from './annualFundingFixedPoint.js'
import {
  annualFundingWithdrawalEffects,
  recharacterizeAnnualFundingWithdrawalHsaCap,
  type AnnualFundingWithdrawalEffectAccount,
  type AnnualHsaWithdrawalEffectAccount,
} from './annualFundingWithdrawalEffects.js'

type CharacterizedAcaAmount = Readonly<
  AcaHouseholdMagiInput['taxExemptInterest']
>

export interface AnnualFundingCandidateWithdrawalPlan {
  readonly byCategory: Readonly<YearWithdrawals>
  readonly byAccountId: ReadonlyMap<string, number>
  readonly realizedGains: number
  readonly shortfall: number
}

export interface AnnualFundingCandidateIraCharacter {
  readonly nontaxable: number
  readonly taxableBySourceAccountId: ReadonlyMap<string, number>
}

export type AnnualFundingCandidateTaxInputBase = Readonly<
  Pick<
    TaxYearInput,
    | 'year'
    | 'filingStatus'
    | 'taxableInterestIncome'
    | 'taxExemptInterest'
    | 'foreignExclusionAddback'
    | 'usGovernmentInterest'
    | 'ordinaryDividends'
    | 'qualifiedDividends'
    | 'ssBenefits'
    | 'peopleAged65Plus'
    | 'inflationScale'
    | 'state'
    | 'stateResidency'
    | 'publicPensionIncome'
    | 'agesAlive'
    | 'itemizedDeductions'
  >
>

export interface AnnualFundingCandidateAcaContract {
  readonly taxFamilySize: number
  readonly fplRegion: AcaFplRegion
  readonly taxExemptInterest: CharacterizedAcaAmount
  readonly foreignExclusionAddback: CharacterizedAcaAmount
  readonly dependents: readonly Readonly<{
    personId: string
    requiredToFile: 'required' | 'notRequired' | 'unknown'
    magi: number
  }>[]
}

export interface AnnualFundingCandidateAcaInput {
  readonly active: boolean
  readonly contract: Readonly<AnnualFundingCandidateAcaContract> | null
  readonly initialSupportCodes: readonly AcaSupportCode[]
  readonly generatedTaxExemptInterest: number
  readonly planDerivedTaxExemptInterest: boolean
  readonly grossEnrollmentPremium: number
  readonly enrollmentPremiums: readonly number[]
  readonly slcspBenchmarkPremiums: readonly number[]
  readonly healthcareExcludingEnrollment: number
  readonly pricingInflationScale: number
}

export interface AnnualFundingCandidateHsaInput {
  readonly initialQualifiedCap: number
  /** Supported medical expenses after excluding Marketplace premiums. */
  readonly qualifiedExpenseCap: number
}

export interface AnnualFundingCandidateEvaluationContext {
  readonly withdrawalEffectAccounts:
    readonly AnnualFundingWithdrawalEffectAccount[]
  readonly hsaEffectAccounts: readonly AnnualHsaWithdrawalEffectAccount[]
  readonly rothBasisByPool: ReadonlyMap<string, RothBasisState>
  readonly taxCalculator: TaxCalculator
  readonly taxInputBase: AnnualFundingCandidateTaxInputBase
  readonly ordinaryIncomeBase: number
  readonly privateRetirementIncomeBase: number
  readonly preWithdrawalCapitalResult: number
  readonly capitalLossCarryforward: number
  readonly capitalLossOrdinaryOffsetLimit: number
  readonly currentHealthcare: number
  readonly aca: Readonly<AnnualFundingCandidateAcaInput>
  readonly hsa: Readonly<AnnualFundingCandidateHsaInput>
  readonly parameterPack: ParameterPack
  readonly spendingAndContributions: number
  readonly rmdShortfallExciseTax: number
  readonly tolerancePlanDollars: number
}

export interface AnnualFundingCandidateEvaluationInput<
  WithdrawalPlan extends AnnualFundingCandidateWithdrawalPlan,
> extends AnnualFundingCandidateEvaluationContext {
  readonly request: Readonly<AnnualFundingFixedPointEvaluationRequest>
  readonly withdrawalPlan: WithdrawalPlan
  readonly iraCharacter: Readonly<AnnualFundingCandidateIraCharacter>
}

export interface AnnualFundingCandidateEvaluationResult<
  WithdrawalPlan extends AnnualFundingCandidateWithdrawalPlan,
> {
  /** Exact caller-owned withdrawal plan selected for this candidate. */
  readonly withdrawalPlan: WithdrawalPlan
  readonly tax: number
  readonly penalties: number
  readonly requiredNeed: number
  readonly acaMagiProbe: AcaHouseholdMagiResult | null
  readonly acaQuote: AcaResult | null
  readonly acaSupportCodes: readonly AcaSupportCode[]
  readonly healthcare: number
  readonly hsaQualifiedCap: number
  /** Preserves the caller's pre-existing traditional-only warning gate. */
  readonly traditionalEarlyWithdrawalPenaltyCharged: boolean
}

/**
 * Price one already-planned annual withdrawal candidate without committing any
 * account, basis, warning, cash-flow, healthcare, or ledger state.
 *
 * WHAT IT TAKES: an identity-bearing withdrawal plan, its caller-derived Form
 * 8606 character, immutable annual tax/ACA/HSA facts, and the candidate funding
 * request chosen by the outer fixed-point coordinator.
 *
 * WHAT IT PRODUCES: the same withdrawal plan by identity, paired with its tax,
 * penalties, reconciled ACA premium/MAGI evidence, HSA qualified cap, and the
 * total cash need that the outer fixed point must fund.
 *
 * WHAT IT REFUSES: strategy selection, Form 8606 allocation, warning insertion,
 * accepted Roth/HSA basis mutation, and every irreversible ledger write remain
 * caller-owned orchestration.
 */
export function annualFundingCandidateEvaluation<
  WithdrawalPlan extends AnnualFundingCandidateWithdrawalPlan,
>(
  input: AnnualFundingCandidateEvaluationInput<WithdrawalPlan>,
): AnnualFundingCandidateEvaluationResult<WithdrawalPlan> {
  const { request, withdrawalPlan, iraCharacter, aca } = input
  let candidateHsaCap = input.hsa.initialQualifiedCap
  let withdrawalEffectsProbe = annualFundingWithdrawalEffects({
    accounts: input.withdrawalEffectAccounts,
    withdrawalsByAccountId: withdrawalPlan.byAccountId,
    traditionalTaxableByAccountId:
      iraCharacter.taxableBySourceAccountId,
    rothBasisByPool: input.rothBasisByPool,
    year: input.taxInputBase.year,
    hsaQualifiedCap: candidateHsaCap,
  })

  let tax = 0
  let acaMagiProbe: AcaHouseholdMagiResult | null = null
  let acaQuote: AcaResult | null = null
  let acaSupportCodes: AcaSupportCode[] = [...aca.initialSupportCodes]
  let candidateHealthcare = input.currentHealthcare
  let hsaCapConverged = false

  // Reconcile HSA taxability explicitly. Marketplace enrollment premiums are
  // excluded from the qualified-expense cap, so this is normally stable after
  // one refresh; the bounded loop retains the prior defensive behavior.
  for (let hsaPass = 0; hsaPass < 16; hsaPass++) {
    const realizedCapitalResult =
      input.preWithdrawalCapitalResult + withdrawalPlan.realizedGains
    const nettedProbe = applyCapitalLossCarryforward(
      input.capitalLossCarryforward,
      input.ordinaryIncomeBase +
        withdrawalPlan.byCategory.traditional -
        iraCharacter.nontaxable +
        withdrawalEffectsProbe.roth.taxableOrdinary +
        withdrawalEffectsProbe.hsa.taxableOrdinary,
      realizedCapitalResult,
      input.capitalLossOrdinaryOffsetLimit,
    )
    const taxInputBase = input.taxInputBase
    const taxInput: TaxYearInput = {
      year: taxInputBase.year,
      filingStatus: taxInputBase.filingStatus,
      ordinaryIncome: nettedProbe.ordinaryAfter,
      capitalGains: nettedProbe.netCapitalGain,
      realizedCapitalGainsBeforeCarryforward: realizedCapitalResult,
      taxableInterestIncome: taxInputBase.taxableInterestIncome,
      taxExemptInterest: taxInputBase.taxExemptInterest,
      foreignExclusionAddback: taxInputBase.foreignExclusionAddback,
      usGovernmentInterest: taxInputBase.usGovernmentInterest,
      ordinaryDividends: taxInputBase.ordinaryDividends,
      qualifiedDividends: taxInputBase.qualifiedDividends,
      ssBenefits: taxInputBase.ssBenefits,
      peopleAged65Plus: taxInputBase.peopleAged65Plus,
      inflationScale: taxInputBase.inflationScale,
      state: taxInputBase.state,
      stateResidency: taxInputBase.stateResidency,
      privateRetirementIncome:
        input.privateRetirementIncomeBase +
        withdrawalPlan.byCategory.traditional -
        iraCharacter.nontaxable,
      publicPensionIncome: taxInputBase.publicPensionIncome,
      agesAlive: taxInputBase.agesAlive,
      itemizedDeductions: taxInputBase.itemizedDeductions,
    }
    tax = input.taxCalculator.compute(taxInput)
    acaMagiProbe = null
    acaQuote = null
    acaSupportCodes = [...aca.initialSupportCodes]
    candidateHealthcare =
      aca.healthcareExcludingEnrollment + aca.grossEnrollmentPremium

    if (aca.active && aca.contract !== null) {
      const federalProbe = computeFederalTax(taxInput)
      let acaMagiTaxExemptInterest = aca.contract.taxExemptInterest
      if (aca.contract.taxExemptInterest.state === 'known') {
        acaMagiTaxExemptInterest = {
          state: 'known',
          amount: Math.max(
            Math.max(0, aca.contract.taxExemptInterest.amount ?? 0),
            aca.generatedTaxExemptInterest,
          ),
        }
      } else if (aca.planDerivedTaxExemptInterest) {
        if (aca.contract.taxExemptInterest.state === 'unknown') {
          acaMagiTaxExemptInterest = {
            state: 'known',
            amount: aca.generatedTaxExemptInterest,
          }
          acaSupportCodes.push('tax-exempt-interest-plan-derived')
        } else if (aca.contract.taxExemptInterest.state === 'notApplicable') {
          acaMagiTaxExemptInterest = {
            state: 'known',
            amount: aca.generatedTaxExemptInterest,
          }
          acaSupportCodes.push('tax-exempt-interest-contract-contradicted')
        }
      }
      acaMagiProbe = buildAcaHouseholdMagi({
        federalAgi: federalProbe.agiBeforeFloor,
        grossSocialSecurity: input.taxInputBase.ssBenefits,
        taxableSocialSecurity: federalProbe.taxableSocialSecurity,
        taxExemptInterest: acaMagiTaxExemptInterest,
        foreignExclusionAddback: aca.contract.foreignExclusionAddback,
        dependents: aca.contract.dependents,
      })
      acaSupportCodes.push(...acaMagiProbe.blockers)
      const blockingAcaCodes = acaSupportCodes.filter(
        (code) =>
          code !== 'tax-exempt-interest-plan-derived' &&
          code !== 'tax-exempt-interest-contract-contradicted',
      )
      if (
        blockingAcaCodes.length === 0 &&
        acaMagiProbe.magi !== null &&
        !request.forceGrossAca
      ) {
        const priced = acaEconomicPremiumByMonth(
          input.parameterPack,
          aca.contract.taxFamilySize,
          acaMagiProbe.magi,
          aca.enrollmentPremiums,
          aca.slcspBenchmarkPremiums,
          aca.contract.fplRegion,
          aca.pricingInflationScale,
        )
        if (priced.belowEligibilityFloor) {
          acaQuote = priced
          acaSupportCodes.push('below-100-fpl-exception-unsupported')
        } else {
          acaQuote = priced
          candidateHealthcare =
            aca.healthcareExcludingEnrollment + priced.economicNetPremium
        }
      }
    }

    const nextHsaCap = input.hsa.qualifiedExpenseCap
    if (
      Math.abs(nextHsaCap - candidateHsaCap) <=
      input.tolerancePlanDollars
    ) {
      hsaCapConverged = true
      break
    }
    candidateHsaCap = nextHsaCap
    // Traditional and Roth character are invariant across this cap loop.
    withdrawalEffectsProbe = recharacterizeAnnualFundingWithdrawalHsaCap(
      withdrawalEffectsProbe,
      {
        accounts: input.hsaEffectAccounts,
        withdrawalsByAccountId: withdrawalPlan.byAccountId,
        hsaQualifiedCap: candidateHsaCap,
      },
    )
  }

  if (!hsaCapConverged && aca.active) {
    acaSupportCodes.push('hsa-cap-fixed-point-nonconvergent')
    candidateHealthcare =
      aca.healthcareExcludingEnrollment + aca.grossEnrollmentPremium
  }
  const penalties =
    withdrawalEffectsProbe.penaltyExcludingRmdShortfallExcise +
    input.rmdShortfallExciseTax

  return {
    withdrawalPlan,
    tax,
    penalties,
    requiredNeed: Math.max(
      0,
      input.spendingAndContributions +
        (candidateHealthcare - input.currentHealthcare) +
        tax +
        penalties -
        request.cashInflows,
    ),
    acaMagiProbe,
    acaQuote,
    acaSupportCodes: [...new Set(acaSupportCodes)],
    healthcare: candidateHealthcare,
    hsaQualifiedCap: candidateHsaCap,
    traditionalEarlyWithdrawalPenaltyCharged:
      withdrawalEffectsProbe.traditional.penalty > 0,
  }
}
