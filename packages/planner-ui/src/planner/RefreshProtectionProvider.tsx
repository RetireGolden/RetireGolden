import type { ReactNode } from 'react'

import { RefreshProtectionContext, type RefreshProtectionEntry } from './refreshProtectionContext'

/**
 * Supplies the list of refresh-protected accounts to the embedded
 * `UpdateBalancesPanel`. The Pro/Advisor host wraps the mounted planner
 * workspace and passes the accounts frozen by its intake decisions as STRUCTURED
 * entries (a stable `accountId`, optionally narrowed to a `field`), never by array
 * position, since indices shift as accounts are added or removed. The public app
 * renders no provider and the panel gets the empty default (unchanged behaviour).
 *
 * ```tsx
 * <RefreshProtectionProvider
 *   protectedAccounts={[{ accountId: 'acct-123' }, { accountId: 'acct-456', field: 'costBasis' }]}
 * >
 *   {workspace}
 * </RefreshProtectionProvider>
 * ```
 *
 * Like `PlannerEditionProvider`, this is a route-group-host concern: `<PlannerApp/>`
 * exposes no matching prop — the web edition freezes nothing.
 */
export function RefreshProtectionProvider({
  protectedAccounts,
  children,
}: {
  protectedAccounts: readonly RefreshProtectionEntry[]
  children: ReactNode
}) {
  return <RefreshProtectionContext.Provider value={{ protectedAccounts }}>{children}</RefreshProtectionContext.Provider>
}
