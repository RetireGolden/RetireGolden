/**
 * Refresh-protection seam for the "Update balances from a broker CSV" panel.
 * The WS4 refresh engine (`../import/refresh`) already accepts a caller-supplied
 * `protectedTargets` set of plan paths (`accounts[i]` / `accounts[i].costBasis`)
 * it must never overwrite, but the embedded `UpdateBalancesPanel` takes no props
 * — so a host has no way to feed protection into the panel it mounts. This
 * context is that seam: the Pro/Advisor host derives the set from its WS2 intake
 * decisions (the accounts an advisor reconciled by hand and froze) and wraps the
 * planner workspace with `<RefreshProtectionProvider>`; the panel reads it and
 * threads it into all three engine calls.
 *
 * The default (no provider) is an empty set, so the public web app — which
 * renders no provider — behaves exactly as before: every updatable account is
 * fair game. This module never invents a protected set of its own; the seam is
 * the value the host supplies, mirroring how `refresh.ts` treats the argument.
 *
 * This mirrors the sibling edition seam: the context, hook, and type live here
 * (`refreshProtectionContext.ts`) and the provider component in
 * `RefreshProtectionProvider.tsx`, exactly as `editionContext.ts` pairs with
 * `PlannerEditionProvider.tsx`.
 */
import { createContext, useContext } from 'react'

/** The default protected set for the free web edition: nothing is off-limits. */
const EMPTY_PROTECTED: ReadonlySet<string> = new Set()

export interface RefreshProtectionValue {
  /**
   * Plan paths (`accounts[i]` or a field like `accounts[i].costBasis`) the
   * broker refresh must not write. An empty set (the default) protects nothing.
   */
  protectedTargets: ReadonlySet<string>
}

export const RefreshProtectionContext = createContext<RefreshProtectionValue>({ protectedTargets: EMPTY_PROTECTED })

/**
 * Reads the ambient refresh-protected path set, defaulting to an empty set when
 * no provider is mounted. The panel subtracts its own transiently-released paths
 * before handing the result to `classifyRefresh` / `buildRefreshDelta` /
 * `applyRefresh`.
 */
export function useRefreshProtection(): ReadonlySet<string> {
  return useContext(RefreshProtectionContext).protectedTargets
}
