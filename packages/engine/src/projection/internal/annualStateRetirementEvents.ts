import type { Plan } from '../../model/plan.js'
import { retirementDistributionFactsForYear, type AnnualStateRetirementEvent } from './stateRetirementFactsAdapter.js'

/** IRC 72(t)(2)(A)(i) and the state rules that borrow it: the age a Roth conversion is tested at. */
const AGE_FIFTY_NINE_AND_A_HALF = 59.5

/**
 * The Roth conversion part of each account's event, so a state rule can tell a
 * conversion from a withdrawal without splitting the event.
 *
 * - `wholeEvent`: every dollar of the event is a conversion (the aggregate
 *   strategy's conversions). The owner's age at the conversion is the event's
 *   own date when evidence gives one, else January 1 of the year, the earliest
 *   the conversion could have happened.
 * - per account: the taxable conversion dollars inside a larger event (a named
 *   conversion that shares the account's `forced` event with its RMD), and the
 *   part of them converted when the owner was 59 and a half or older.
 */
export type StateRothConversionAmounts =
  | 'wholeEvent'
  | {
      readonly taxableByAccount: ReadonlyMap<string, number>
      readonly atAge59HalfOrOlderByAccount: ReadonlyMap<string, number>
    }

/** Actual federal character, not gross balance debits, supplies the state distribution base. */
export function stateRetirementEventsFromAccountAmounts(plan: Readonly<Plan>, year: number,
  amounts: ReadonlyMap<string, number>, eventPrefix: string, grossAmounts: ReadonlyMap<string, number> = amounts,
  conversions?: StateRothConversionAmounts) {
  const events: AnnualStateRetirementEvent[] = []
  for (const [accountId, amount] of amounts) {
    const account = plan.accounts.find((item) => item.id === accountId)
    if (account === undefined || (account.type !== 'traditional' && account.type !== 'roth') || (amount <= 0 && (grossAmounts.get(accountId) ?? 0) <= 0)) continue
    const recipientPersonId = account.ownerPersonId ?? plan.household.people[0]!.id
    events.push({
      eventId: `${eventPrefix}:${year}:${accountId}`, accountId, recipientPersonId,
      sourceOwnerPersonId: account.inherited?.decedentId ?? recipientPersonId,
      source: account.kind === 'ira' ? 'ira' : 'employerPlan',
      federallyIncludedAmount: amount,
    })
  }
  return retirementDistributionFactsForYear(plan, year, events).map((fact) => {
    const conversion = conversionPart(fact, conversions)
    const account = plan.accounts.find((item) => item.id === fact.accountId)
    // The account's declared employer-plan class is the row's plan type when
    // the state evidence gives none, as the annuity path does.
    const employerPlanType = account?.type === 'traditional' ? account.employerPlanType : undefined
    return { ...fact,
      ...(fact.sourceKind === 'employerPlan' && fact.qualifiedPlanType === undefined && employerPlanType !== undefined
        ? { qualifiedPlanType: employerPlanType } : {}),
      grossDistribution: grossAmounts.get(fact.accountId ?? '') ?? fact.federallyIncludedAmount,
      accountTaxTreatment: account?.type === 'roth' ? 'roth' as const : 'traditional' as const,
      ...(conversion === undefined ? {} : {
        rothConversionAmount: conversion.amount,
        rothConversionAmountAtAge59HalfOrOlder: conversion.atAge59HalfOrOlder,
      }),
    }
  })
}

function conversionPart(
  fact: { accountId?: string; federallyIncludedAmount: number; ageAtDistributionYears?: number; minimumAgeAtDistributionYears?: number },
  conversions: StateRothConversionAmounts | undefined,
): { amount: number; atAge59HalfOrOlder: number } | undefined {
  if (conversions === undefined) return undefined
  const included = Math.max(0, fact.federallyIncludedAmount)
  if (conversions === 'wholeEvent') {
    if (included <= 0) return undefined
    const age = fact.ageAtDistributionYears ?? fact.minimumAgeAtDistributionYears
    return { amount: included, atAge59HalfOrOlder: age !== undefined && age >= AGE_FIFTY_NINE_AND_A_HALF ? included : 0 }
  }
  const accountId = fact.accountId ?? ''
  const amount = Math.min(included, Math.max(0, conversions.taxableByAccount.get(accountId) ?? 0))
  if (amount <= 0) return undefined
  const atAge59HalfOrOlder = Math.min(amount, Math.max(0, conversions.atAge59HalfOrOlderByAccount.get(accountId) ?? 0))
  return { amount, atAge59HalfOrOlder }
}
