import type { ReactNode } from 'react'

import { RefreshProtectionContext } from './refreshProtectionContext'

/**
 * Supplies the set of refresh-protected plan paths to the embedded
 * `UpdateBalancesPanel`. The Pro/Advisor host wraps the mounted planner
 * workspace and passes the accounts frozen by its intake decisions; the public
 * app renders no provider and the panel gets the empty default (unchanged
 * behaviour).
 *
 * ```tsx
 * <RefreshProtectionProvider protectedTargets={new Set(['accounts[2]'])}>
 *   {workspace}
 * </RefreshProtectionProvider>
 * ```
 *
 * Like `PlannerEditionProvider`, this is a route-group-host concern: `<PlannerApp/>`
 * exposes no matching prop — the web edition freezes nothing.
 */
export function RefreshProtectionProvider({
  protectedTargets,
  children,
}: {
  protectedTargets: ReadonlySet<string>
  children: ReactNode
}) {
  return <RefreshProtectionContext.Provider value={{ protectedTargets }}>{children}</RefreshProtectionContext.Provider>
}
