import { useMemo, type ReactNode } from 'react'

import { RefreshProtectionContext, type RefreshProtectionEntry } from './refreshProtectionContext'

/**
 * Supplies the list of refresh-protected accounts to the embedded
 * `UpdateBalancesPanel`. The Pro/Advisor host wraps the mounted planner
 * workspace and passes the accounts frozen by its intake decisions as STRUCTURED
 * entries (a stable `accountId`, optionally narrowed to a `field`), never by array
 * position, since indices shift as accounts are added or removed. The public app
 * renders no provider and the panel gets the empty default (unchanged behaviour).
 *
 * A host that loads its protected set asynchronously passes `pending` while the
 * answer is outstanding: an empty `protectedAccounts` otherwise reads as "nothing
 * is protected", and the panel would happily refresh a frozen account in that
 * window. While `pending`, the panel refuses both the file and the apply. It
 * defaults to `false`, so an existing host that passes only `protectedAccounts`
 * is unchanged.
 *
 * ```tsx
 * <RefreshProtectionProvider
 *   protectedAccounts={overrides ?? []}
 *   pending={overrides === null} // still loading — don't let a refresh through yet
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
  pending = false,
  children,
}: {
  protectedAccounts: readonly RefreshProtectionEntry[]
  /** `true` while the host is still resolving `protectedAccounts`. Defaults to `false`. */
  pending?: boolean
  children: ReactNode
}) {
  // Memoized so an unrelated re-render of the host does not hand every consumer
  // a fresh context identity (the value was constructed inline before, which
  // re-ran the panel's `protectedAccounts`-keyed memos on every host render).
  const value = useMemo(() => ({ protectedAccounts, pending }), [protectedAccounts, pending])
  return <RefreshProtectionContext.Provider value={value}>{children}</RefreshProtectionContext.Provider>
}
