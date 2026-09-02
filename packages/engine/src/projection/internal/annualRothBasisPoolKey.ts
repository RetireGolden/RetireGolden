import type { Account } from '../../model/plan.js'

/** Resolve the annual Roth-basis pool shared by conversion and withdrawal phases. */
export function annualRothBasisPoolKey(
  account: Readonly<Extract<Account, { type: 'roth' }>>,
  defaultOwnerPersonId: string,
): string {
  return account.kind === 'ira'
    ? `rothira:${account.ownerPersonId ?? defaultOwnerPersonId}`
    : `roth:${account.id}`
}
