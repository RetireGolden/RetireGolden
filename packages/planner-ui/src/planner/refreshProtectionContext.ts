/**
 * Refresh-protection seam for the "Update balances from a broker CSV" panel.
 * The WS4 refresh engine (`../import/refresh`) accepts a caller-supplied
 * `protectedTargets` set of *positional* plan paths (`accounts[i]` /
 * `accounts[i].costBasis`) it must never overwrite, but the embedded
 * `UpdateBalancesPanel` takes no props — so a host has no way to feed protection
 * into the panel it mounts. This context is that seam.
 *
 * **Why the seam speaks account IDs, not positions.** A host protects *accounts*,
 * but plan-array indices are not stable: adding or removing an account in the
 * workspace shifts every later `accounts[i]`, so a positional path stored by the
 * host would silently start protecting the wrong account the moment the array
 * moves. Account IDs are stable for the life of the account. So the host supplies
 * IDs (or `<accountId>.<field>`), the professional host resolves its stored
 * draft-relative paths to IDs once at approve time — instead of re-reconciling
 * indices forever — and `UpdateBalancesPanel` maps each protected ID to that
 * account's CURRENT index fresh on every render before handing the derived
 * positional set to the engine. The engine's `accounts[i]` contract is unchanged;
 * the index translation lives entirely in the panel, against live plan order.
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
   * Account IDs the broker refresh must not write, each either a whole-account
   * id (`'acct-123'` — protect balance and cost basis) or an
   * `<accountId>.<field>` entry (`'acct-123.costBasis'` — protect one field). IDs
   * are stable across plan-array reordering; the panel resolves them to the
   * current `accounts[i]` positions itself. An empty set (the default) protects
   * nothing.
   */
  protectedAccounts: ReadonlySet<string>
}

export const RefreshProtectionContext = createContext<RefreshProtectionValue>({ protectedAccounts: EMPTY_PROTECTED })

/**
 * Reads the ambient set of refresh-protected account IDs, defaulting to an empty
 * set when no provider is mounted. `UpdateBalancesPanel` maps these stable IDs to
 * the current `accounts[i]` positions (minus any row-scoped release) before
 * handing the derived positional set to `classifyRefresh` / `buildRefreshDelta` /
 * `applyRefresh`.
 */
export function useRefreshProtection(): ReadonlySet<string> {
  return useContext(RefreshProtectionContext).protectedAccounts
}
