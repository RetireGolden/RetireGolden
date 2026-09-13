import type { Plan } from '../../model/plan.js'
import { retirementDistributionFactsForYear, type AnnualStateRetirementEvent } from './stateRetirementFactsAdapter.js'

/** Actual federal character, not gross balance debits, supplies the state distribution base. */
export function stateRetirementEventsFromAccountAmounts(plan: Readonly<Plan>, year: number,
  amounts: ReadonlyMap<string, number>, eventPrefix: string, grossAmounts: ReadonlyMap<string, number> = amounts) {
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
  return retirementDistributionFactsForYear(plan, year, events).map((fact) => ({ ...fact,
    grossDistribution: grossAmounts.get(fact.accountId ?? '') ?? fact.federallyIncludedAmount,
    accountTaxTreatment: plan.accounts.find((account) => account.id === fact.accountId)?.type === 'roth' ? 'roth' as const : 'traditional' as const,
  }))
}
