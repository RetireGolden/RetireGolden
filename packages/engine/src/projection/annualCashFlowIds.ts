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
  metadataPropertySaleCapitalGain: (propertyAccountId: string) =>
    `metadata:capitalGain:propertySale:${encodeCashFlowSegment(propertyAccountId)}`,
  metadataPropertySaleOrdinaryIncome: (propertyAccountId: string) =>
    `metadata:ordinaryIncome:propertySale:${encodeCashFlowSegment(propertyAccountId)}`,
} as const

/**
 * JavaScript UTF-16 code-unit order. Emission sorts each reporting array by
 * `id` with this comparator; array position, execution order, amounts,
 * locale, and calendar year are not disambiguators.
 */
export function compareCashFlowLineId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * Plan identities that become dynamic `E(value)` cash-flow segments.
 * Distinct raw IDs that encode to the same segment are a projection-wide
 * `duplicateLineId` collision, including when the producers are active in
 * different years.
 */
export interface CashFlowProducerIdSource {
  readonly household: { readonly people: readonly { readonly id: string }[] }
  readonly accounts: readonly { readonly id: string }[]
  readonly incomes: readonly { readonly id: string }[]
  readonly expenses: { readonly oneTimeGoals: readonly { readonly id: string }[] }
  readonly insurance: readonly { readonly id: string }[]
  readonly careEvents: readonly { readonly id: string }[]
  readonly incomeFloor?: { readonly ladders: readonly { readonly id: string }[] } | null
  /**
   * Named retirement actions and their allocations. Both `actionId` and each
   * `allocationId` are `E(value)` segments (`retirementActionWithdrawal`,
   * named conversion, named QCD). QCD requests carry a singular `allocation`.
   */
  readonly strategies?: {
    readonly retirementActions: readonly {
      readonly actionId: string
      readonly allocations?: readonly { readonly allocationId: string }[]
      readonly allocation?: { readonly allocationId: string }
    }[]
  }
}

/** Account, income-stream, goal, policy, ladder, care-event, person, action, and allocation ids. */
export function collectPlanCashFlowProducerIds(
  plan: CashFlowProducerIdSource,
): readonly string[] {
  const ids: string[] = []
  for (const person of plan.household.people) ids.push(person.id)
  for (const account of plan.accounts) ids.push(account.id)
  for (const stream of plan.incomes) ids.push(stream.id)
  for (const goal of plan.expenses.oneTimeGoals) ids.push(goal.id)
  for (const policy of plan.insurance) ids.push(policy.id)
  for (const event of plan.careEvents) ids.push(event.id)
  for (const ladder of plan.incomeFloor?.ladders ?? []) ids.push(ladder.id)
  for (const action of plan.strategies?.retirementActions ?? []) {
    ids.push(action.actionId)
    if (action.allocations !== undefined) {
      for (const allocation of action.allocations) ids.push(allocation.allocationId)
    }
    if (action.allocation !== undefined) ids.push(action.allocation.allocationId)
  }
  return ids
}

/**
 * Encoded segments that two or more distinct raw producer IDs map onto via
 * `encodeCashFlowSegment`. Empty when every distinct raw ID encodes uniquely.
 */
export function collidingEncodedCashFlowSegments(
  rawIds: Iterable<string>,
): readonly string[] {
  const unique = new Set<string>()
  for (const id of rawIds) unique.add(id)
  const firstRawByEncoded = new Map<string, string>()
  const colliding: string[] = []
  for (const raw of unique) {
    const encoded = encodeCashFlowSegment(raw)
    const first = firstRawByEncoded.get(encoded)
    if (first === undefined) {
      firstRawByEncoded.set(encoded, raw)
      continue
    }
    if (!colliding.includes(encoded)) colliding.push(encoded)
  }
  colliding.sort(compareCashFlowLineId)
  return colliding
}
