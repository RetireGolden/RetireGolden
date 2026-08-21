/**
 * Stable annual cash-flow line IDs.
 *
 * Segment encoding is total over every schema-valid Plan ID: unpaired UTF-16
 * surrogates become U+FFFD, then `encodeURIComponent`. A throwing encoder
 * would abort capture; collisions that exist only through replacement surface
 * as `duplicateLineId` and the year publishes `notReconciled`. Literal colons
 * delimit grammar segments, so escaping `:` and `%` keeps the grammar
 * collision-free.
 *
 * @see DOCS/features/year-cash-flow.md (Stable line IDs)
 */

import type { YearCashFlowPenaltyClass } from './types.js'

const REPLACEMENT = '\uFFFD' // U+FFFD

/**
 * Escape one dynamic ID segment. Unpaired surrogates are replaced before
 * encoding so this never throws `URIError`.
 */
export function encodeCashFlowSegment(value: string): string {
  let out = ''
  for (let i = 0; i < value.length; i++) {
    const cu = value.charCodeAt(i)
    if (cu >= 0xd800 && cu <= 0xdbff) {
      const next = value.charCodeAt(i + 1)
      if (next >= 0xdc00 && next <= 0xdfff) {
        out += value[i] + value[i + 1]
        i++
        continue
      }
      out += REPLACEMENT
      continue
    }
    if (cu >= 0xdc00 && cu <= 0xdfff) {
      out += REPLACEMENT
      continue
    }
    out += value[i]
  }
  return encodeURIComponent(out)
}

/**
 * One builder per grammar row in `DOCS/features/year-cash-flow.md`. Dynamic
 * segments are `E(value)` (`encodeCashFlowSegment`). Household-constant rows
 * are literal strings.
 */
export const cashFlowLineIds = {
  // sources
  sourceWages: (incomeStreamId: string) =>
    `source:wages:${encodeCashFlowSegment(incomeStreamId)}`,
  sourceSocialSecurity: (incomeStreamId: string) =>
    `source:socialSecurity:${encodeCashFlowSegment(incomeStreamId)}`,
  sourceRecurringIncome: (incomeStreamId: string) =>
    `source:recurringIncome:${encodeCashFlowSegment(incomeStreamId)}`,
  sourceOneTimeIncome: (incomeStreamId: string) =>
    `source:oneTimeIncome:${encodeCashFlowSegment(incomeStreamId)}`,
  sourcePension: (accountId: string) =>
    `source:pension:${encodeCashFlowSegment(accountId)}`,
  sourceAnnuityPayment: (accountId: string) =>
    `source:annuityPayment:${encodeCashFlowSegment(accountId)}`,
  sourceTipsLadderCash: (ladderId: string) =>
    `source:tipsLadderCash:${encodeCashFlowSegment(ladderId)}`,
  sourceTaxableAccountYield: (accountId: string) =>
    `source:taxableAccountYield:${encodeCashFlowSegment(accountId)}`,
  sourceTaxExemptInterest: (accountId: string) =>
    `source:taxExemptInterest:${encodeCashFlowSegment(accountId)}`,
  sourcePropertySaleProceeds: (propertyAccountId: string) =>
    `source:propertySaleProceeds:${encodeCashFlowSegment(propertyAccountId)}`,
  sourceLegacyPropertySaleDeposit: (propertyAccountId: string) =>
    `source:legacyPropertySaleDeposit:${encodeCashFlowSegment(propertyAccountId)}`,
  sourceSeppDistribution: (sourceAccountId: string) =>
    `source:seppDistribution:${encodeCashFlowSegment(sourceAccountId)}`,
  sourceInheritedAccountDistribution: (sourceAccountId: string) =>
    `source:inheritedAccountDistribution:${encodeCashFlowSegment(sourceAccountId)}`,
  sourceNeedBasedPortfolioWithdrawal: (sourceAccountId: string) =>
    `source:needBasedPortfolioWithdrawal:${encodeCashFlowSegment(sourceAccountId)}`,
  sourceEmployerPlanRmd: (accountId: string) =>
    `source:requiredMinimumDistribution:account:${encodeCashFlowSegment(accountId)}`,
  sourceOwnedIraRmd: (personId: string) =>
    `source:requiredMinimumDistribution:ownedIraPool:${encodeCashFlowSegment(personId)}`,
  sourceRetirementActionWithdrawal: (actionId: string, allocationId: string) =>
    `source:retirementActionWithdrawal:${encodeCashFlowSegment(actionId)}:${encodeCashFlowSegment(allocationId)}`,
  sourceHecmCoordinatedDraw: (propertyAccountId: string) =>
    `source:hecmCoordinatedDraw:${encodeCashFlowSegment(propertyAccountId)}`,
  sourceHecmBackstopDraw: (propertyAccountId: string) =>
    `source:hecmBackstopDraw:${encodeCashFlowSegment(propertyAccountId)}`,
  sourceLifeInsuranceDeathBenefit: (policyId: string) =>
    `source:lifeInsuranceDeathBenefit:${encodeCashFlowSegment(policyId)}`,

  // uses
  useRequiredLifestyle: () => 'use:requiredLifestyle:household',
  useTargetLifestyle: () => 'use:targetLifestyle:household',
  useIdealLifestyle: () => 'use:idealLifestyle:household',
  useExcessLifestyle: () => 'use:excessLifestyle:household',
  useOneTimeGoal: (goalId: string) =>
    `use:oneTimeGoal:${encodeCashFlowSegment(goalId)}`,
  useDebtService: (accountId: string) =>
    `use:debtService:${encodeCashFlowSegment(accountId)}`,
  usePropertyCosts: (accountId: string) =>
    `use:propertyCosts:${encodeCashFlowSegment(accountId)}`,
  useInsurancePremium: (policyId: string) =>
    `use:insurancePremium:${encodeCashFlowSegment(policyId)}`,
  useHealthcare: () => 'use:healthcare:household',
  useLongTermCare: (personId: string) =>
    `use:longTermCare:${encodeCashFlowSegment(personId)}`,
  useSettledTax: () => 'use:settledTax:household',
  usePenaltyAccount: (sourceAccountId: string, penaltyClass: YearCashFlowPenaltyClass) =>
    `use:earlyWithdrawalPenalty:account:${encodeCashFlowSegment(sourceAccountId)}:${encodeCashFlowSegment(penaltyClass)}`,
  usePenaltyRothPool: (personId: string) =>
    `use:earlyWithdrawalPenalty:rothPool:${encodeCashFlowSegment(personId)}:rothEarly`,
  usePenaltyHousehold: (penaltyClass: YearCashFlowPenaltyClass) =>
    `use:earlyWithdrawalPenalty:household:${encodeCashFlowSegment(penaltyClass)}`,
  useContribution: (destinationAccountId: string) =>
    `use:contribution:${encodeCashFlowSegment(destinationAccountId)}`,
  useSurplusAccount: (accountId: string) =>
    `use:surplusInvestment:account:${encodeCashFlowSegment(accountId)}`,
  useSurplusUnassigned: () => 'use:surplusInvestment:unassignedCash',

  // transfers
  transferNamedRothConversion: (actionId: string, allocationId: string) =>
    `transfer:namedRothConversion:${encodeCashFlowSegment(actionId)}:${encodeCashFlowSegment(allocationId)}`,
  transferAggregateRothConversion: (sourceAccountId: string, destinationAccountId: string) =>
    `transfer:aggregateRothConversion:${encodeCashFlowSegment(sourceAccountId)}:${encodeCashFlowSegment(destinationAccountId)}`,
  transferNamedQcd: (actionId: string, allocationId: string) =>
    `transfer:qualifiedCharitableDistribution:named:${encodeCashFlowSegment(actionId)}:${encodeCashFlowSegment(allocationId)}`,
  transferBeyondRmdQcd: (personId: string, sourceAccountId: string) =>
    `transfer:qualifiedCharitableDistribution:beyondRmd:${encodeCashFlowSegment(personId)}:${encodeCashFlowSegment(sourceAccountId)}`,
  transferRmdQcd: (personId: string) =>
    `transfer:qualifiedCharitableDistribution:rmd:${encodeCashFlowSegment(personId)}`,
  transferEmployeeContribution: (destinationAccountId: string) =>
    `transfer:employeeContribution:${encodeCashFlowSegment(destinationAccountId)}`,
  transferEmployerMatch: (destinationAccountId: string) =>
    `transfer:employerMatch:${encodeCashFlowSegment(destinationAccountId)}`,
  transferReinvestedYield: (destinationAccountId: string) =>
    `transfer:reinvestedYield:${encodeCashFlowSegment(destinationAccountId)}`,
  transferAnnuityPurchase: (destinationContractId: string) =>
    `transfer:annuityPurchase:${encodeCashFlowSegment(destinationContractId)}`,
  transferTipsLadderPurchase: (ladderId: string) =>
    `transfer:tipsLadderPurchase:${encodeCashFlowSegment(ladderId)}`,
  transferPensionRollover: (pensionAccountId: string, destinationAccountId: string) =>
    `transfer:pensionRollover:${encodeCashFlowSegment(pensionAccountId)}:${encodeCashFlowSegment(destinationAccountId)}`,
  transferSurplusAccount: (accountId: string) =>
    `transfer:surplusInvestment:account:${encodeCashFlowSegment(accountId)}`,
  transferSurplusUnassigned: () => 'transfer:surplusInvestment:unassignedCash',

  // standalone metadata
  metadataTipsPhantomOid: (ladderId: string) =>
    `metadata:tipsPhantomOidIncome:${encodeCashFlowSegment(ladderId)}`,
  metadataTaxExemptInterestAttestedExcess: () =>
    'metadata:taxExemptInterestAttestedExcess:household',
  metadataForeignExclusionAddback: () =>
    'metadata:foreignExclusionAddback:household',
  metadataRothPoolOrdinaryIncome: (personId: string) =>
    `metadata:ordinaryIncome:rothPool:${encodeCashFlowSegment(personId)}`,
  metadataRebalancingCapitalGain: (accountId: string) =>
    `metadata:capitalGain:rebalancing:${encodeCashFlowSegment(accountId)}`,
} as const

/**
 * JavaScript UTF-16 code-unit order. Emission sorts each reporting array by
 * `id` with this comparator; array position, execution order, amounts,
 * locale, and calendar year are not disambiguators.
 */
export function compareCashFlowLineId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}
