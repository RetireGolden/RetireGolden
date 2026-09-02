/** Pure assembly of the annual ACA evidence/result published by the ledger. */
import type { ParameterPack } from '../../params/types.js'
import {
  acaFederalPovertyLine,
  type AcaHouseholdMagiResult,
  type AcaResult,
} from '../../tax/aca.js'
import type {
  AcaSupportCode,
  YearAcaResult,
} from '../types.js'

export interface AnnualAcaTaxFamilyMemberSnapshot {
  readonly personId: string
  readonly relationship: 'primary' | 'spouse' | 'dependent'
  readonly requiredToFile: 'required' | 'notRequired' | 'unknown'
  readonly magi: number
}

export interface AnnualAcaCoveredMemberSnapshot {
  readonly personId: string
  readonly enrollmentPremiumByMonth: readonly number[]
  readonly slcspBenchmarkPremiumByMonth: readonly number[]
}

export interface AnnualAcaContractSnapshot {
  readonly fplRegion: 'contiguous' | 'alaska' | 'hawaii'
  readonly taxFamilyMembers: readonly AnnualAcaTaxFamilyMemberSnapshot[]
  readonly coveredMembers: readonly AnnualAcaCoveredMemberSnapshot[]
}

export interface AnnualAcaPersonSnapshot {
  readonly personId: string
  readonly alive: boolean
}

export interface AnnualAcaPublicationEvaluationSnapshot {
  readonly requiredNeed: number
  readonly withdrawalTotal: number
  readonly withdrawalShortfall: number
  readonly acaSupportCodes: readonly AcaSupportCode[]
  readonly acaQuote: Readonly<AcaResult> | null
  readonly acaMagiProbe: Readonly<{
    readonly magi: AcaHouseholdMagiResult['magi']
    readonly components: Readonly<AcaHouseholdMagiResult['components']>
    readonly dependents: readonly Readonly<
      AcaHouseholdMagiResult['dependents'][number]
    >[]
  }> | null
}

export interface AnnualAcaResultPublicationInput {
  readonly active: boolean
  readonly evaluation: Readonly<AnnualAcaPublicationEvaluationSnapshot>
  readonly fixedPointFailed: boolean
  readonly converged: boolean
  readonly conflictingCliffBasins: boolean
  readonly evaluationCount: number
  readonly maxEvaluationCount: number
  readonly contract: Readonly<AnnualAcaContractSnapshot> | null
  readonly contractCount: number
  readonly exampleContractInputMismatch: boolean
  readonly isStandIn: boolean
  readonly people: readonly AnnualAcaPersonSnapshot[]
  readonly marketplaceMonthsByPersonPosition: readonly number[]
  readonly pre65MonthlyPremiumPerPerson: number
  readonly healthInflationScale: number
  readonly parameterPack: ParameterPack
  readonly fplInflationScale: number
  readonly federalAgi: number
  readonly grossSocialSecurity: number
  readonly taxableSocialSecurity: number
  readonly taxExemptInterest: number
  readonly foreignExclusionAddback: number
  readonly grossEnrollmentPremium: number
  readonly slcspBenchmarkPremiums: readonly number[]
  readonly healthcare: number
  readonly healthcareExcludingAcaEnrollment: number
}

export interface AnnualAcaResultPublicationResult {
  readonly yearAcaResult: YearAcaResult | undefined
  readonly warnings: readonly string[]
}

/**
 * WHAT IT TAKES: the accepted fixed-point ACA quote/MAGI evidence plus detached
 * annual contract, coverage, tax, premium, and convergence snapshots.
 *
 * WHAT IT PRODUCES: one fresh `YearAcaResult` and its ordered warning intents.
 *
 * WHAT IT REFUSES: fixed-point evaluation, healthcare or ledger mutation,
 * warning insertion, MAGI-history writes, and final year publication remain
 * caller-owned orchestration.
 */
export function annualAcaResultPublication(
  input: AnnualAcaResultPublicationInput,
): AnnualAcaResultPublicationResult {
  if (!input.active) return { yearAcaResult: undefined, warnings: [] }

  const supportCodes = [...input.evaluation.acaSupportCodes]
  if (input.fixedPointFailed || !input.converged) {
    supportCodes.push('fixed-point-nonconvergent')
  }
  if (input.conflictingCliffBasins) {
    supportCodes.push('conflicting-cliff-fixed-points')
  }
  const uniqueSupportCodes = [...new Set(supportCodes)]
  const informationalAcaCodes = uniqueSupportCodes.filter(
    (code) =>
      code === 'tax-exempt-interest-plan-derived' ||
      code === 'tax-exempt-interest-contract-contradicted',
  )
  const actionable =
    uniqueSupportCodes.filter(
      (code) =>
        code !== 'tax-exempt-interest-plan-derived' &&
        code !== 'tax-exempt-interest-contract-contradicted',
    ).length === 0 && input.evaluation.acaQuote !== null
  const pricedQuote = input.evaluation.acaQuote
  const quote = actionable ? pricedQuote : null
  const warnings: string[] = []
  if (quote?.overCliff) {
    warnings.push(
      'Some pre-65 years exceed 400% of the federal poverty line: no ACA credit (the cliff).',
    )
  }

  const dependentEvidence = new Map(
    (input.evaluation.acaMagiProbe?.dependents ?? []).map((dependent) => [
      dependent.personId,
      dependent,
    ]),
  )
  const taxFamilyMembers =
    input.contract?.taxFamilyMembers.map((member) => ({
      ...member,
      includedMagi:
        member.relationship === 'dependent'
          ? (dependentEvidence.get(member.personId)?.includedMagi ?? 0)
          : 0,
    })) ?? []
  const coveredMembers = input.contract && !input.exampleContractInputMismatch
    ? input.contract.coveredMembers.map((member) => ({
        personId: member.personId,
        coveredMonths: member.enrollmentPremiumByMonth
          .map((premium, month) => (premium > 0 ? month + 1 : 0))
          .filter((month) => month > 0),
        grossEnrollmentPremium: member.enrollmentPremiumByMonth.reduce(
          (sum, premium) => sum + premium,
          0,
        ),
        applicableSlcspPremium: member.slcspBenchmarkPremiumByMonth.reduce(
          (sum, premium, month) =>
            sum + ((member.enrollmentPremiumByMonth[month] ?? 0) > 0 ? premium : 0),
          0,
        ),
      }))
    : input.contractCount > 1
      ? []
      : input.people
        .map((person, position) => ({
          person,
          months: input.marketplaceMonthsByPersonPosition[position]!,
        }))
        .filter(({ person, months }) =>
          person.alive && months > 0 && input.pre65MonthlyPremiumPerPerson > 0)
        .map(({ person, months }) => {
          const premium =
            input.pre65MonthlyPremiumPerPerson * input.healthInflationScale
          return {
            personId: person.personId,
            coveredMonths: Array.from(
              { length: months },
              (_, month) => month + 1,
            ),
            grossEnrollmentPremium: premium * months,
            applicableSlcspPremium: premium * months,
          }
        })
  const fpl =
    input.contract &&
    !input.isStandIn &&
    input.contract.taxFamilyMembers.length > 0
      ? acaFederalPovertyLine(
          input.parameterPack,
          input.contract.taxFamilyMembers.length,
          input.contract.fplRegion,
          input.fplInflationScale,
        )
      : null
  const fplPct = pricedQuote?.fplPct ?? null
  const cliffState: YearAcaResult['cliffState'] =
    uniqueSupportCodes.includes('below-100-fpl-exception-unsupported')
      ? 'below-eligibility-floor'
      : !actionable || fplPct === null
        ? 'unsupported'
        : quote!.overCliff
          ? 'above-cliff'
          : Math.abs(fplPct - input.parameterPack.aca.maxFplPctForCredit) <= 1e-9
            ? 'at-cliff'
            : 'below-cliff'

  const yearAcaResult: YearAcaResult = {
    readiness: actionable ? 'actionable' : 'nonActionable',
    supportCodes: actionable
      ? ['actionable', ...informationalAcaCodes]
      : uniqueSupportCodes,
    householdMagi: actionable
      ? (input.evaluation.acaMagiProbe?.magi ?? null)
      : null,
    magiComponents: input.evaluation.acaMagiProbe?.components ?? {
      federalAgi: input.federalAgi,
      nontaxableSocialSecurity: Math.max(
        0,
        input.grossSocialSecurity - input.taxableSocialSecurity,
      ),
      taxExemptInterest: input.taxExemptInterest,
      foreignExclusionAddback: input.foreignExclusionAddback,
      requiredFilerDependentMagi: 0,
    },
    fplRegion: input.contract?.fplRegion ?? null,
    federalPovertyLine: fpl,
    fplPct,
    taxFamilySize: input.contract?.taxFamilyMembers.length ?? null,
    taxFamilyMembers,
    coveredMembers,
    grossEnrollmentPremium: input.grossEnrollmentPremium,
    applicableSlcspPremium:
      input.contract && !input.exampleContractInputMismatch
        ? input.slcspBenchmarkPremiums.reduce(
            (sum, premium) => sum + premium,
            0,
          )
        : null,
    modeledAllowablePtc: quote?.modeledAllowablePtc ?? null,
    economicNetPremium:
      input.healthcare - input.healthcareExcludingAcaEnrollment,
    aptcModeled: false,
    form8962ReconciliationSupported: false,
    cliffState,
    convergence: {
      converged:
        actionable && input.converged && !input.fixedPointFailed,
      iterations: Math.min(input.evaluationCount, input.maxEvaluationCount),
      maxIterations: input.maxEvaluationCount,
      residualDollars: Math.abs(
        input.evaluation.requiredNeed -
          (input.evaluation.withdrawalTotal +
            input.evaluation.withdrawalShortfall),
      ),
      grossPremiumFallback: !actionable,
    },
  }
  if (!actionable) {
    warnings.push(
      'Some Marketplace years use gross enrollment premium because required ACA reconciliation facts are missing or unsupported.',
    )
  }

  return { yearAcaResult, warnings }
}
