import type { Account } from '../model/plan.js'
import type { RmdApplicablePlan } from './rmdShortfallExcise.js'

type RetirementAccount = Extract<
  Account,
  { type: 'traditional' | 'roth' }
>

/**
 * Identify the §54.4974-1(a)(2)(iv) applicable plan without inferring facts the
 * Plan does not carry. This is the single identity boundary for both owner and
 * inherited RMD obligations: callers must not reproduce its grouping rules.
 *
 * Owned traditional IRAs aggregate per owner; explicitly typed 403(b)s
 * aggregate per owner; an ordinary employer plan is its own plan. Inherited
 * IRAs aggregate only when an explicit decedentId proves the same decedent,
 * and traditional and Roth pools remain separate. An inherited employer
 * account remains particular to its plan. Missing inherited identity fails
 * closed per account instead of grouping accounts whose demographic facts
 * merely happen to match.
 */
export function rmdApplicablePlanForAccount(
  account: Readonly<RetirementAccount>,
  primaryPersonId: string,
): RmdApplicablePlan {
  const payeePersonId = account.ownerPersonId ?? primaryPersonId
  if (account.inherited !== undefined) {
    if (account.kind === 'employer') {
      return {
        kind: 'inheritedEmployerPlan',
        payeePersonId,
        accountId: account.id,
      }
    }
    return account.inherited.decedentId === undefined
      ? { kind: 'inheritedIraAccount', payeePersonId, accountId: account.id }
      : {
          kind: 'inheritedIras',
          payeePersonId,
          decedentId: account.inherited.decedentId,
          iraType: account.type,
        }
  }
  if (account.type === 'traditional' && account.kind === 'ira') {
    return { kind: 'ownedTraditionalIras', payeePersonId }
  }
  if (
    account.type === 'traditional' &&
    account.kind === 'employer' &&
    account.employerPlanType === '403b'
  ) {
    return { kind: 'aggregable403bPlans', payeePersonId }
  }
  return { kind: 'employerPlan', accountId: account.id }
}
