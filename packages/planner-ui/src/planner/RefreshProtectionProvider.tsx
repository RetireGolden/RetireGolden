import type { ReactNode } from 'react'

import { RefreshProtectionContext } from './refreshProtectionContext'

/**
 * Supplies the set of refresh-protected account IDs to the embedded
 * `UpdateBalancesPanel`. The Pro/Advisor host wraps the mounted planner
 * workspace and passes the accounts frozen by its intake decisions — by stable
 * account id (or `<accountId>.<field>`), never by array position, since indices
 * shift as accounts are added or removed. The public app renders no provider and
 * the panel gets the empty default (unchanged behaviour).
 *
 * ```tsx
 * <RefreshProtectionProvider protectedAccounts={new Set(['acct-123', 'acct-456.costBasis'])}>
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
  protectedAccounts: ReadonlySet<string>
  children: ReactNode
}) {
  return <RefreshProtectionContext.Provider value={{ protectedAccounts }}>{children}</RefreshProtectionContext.Provider>
}
