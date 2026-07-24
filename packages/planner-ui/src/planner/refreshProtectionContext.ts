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
 * STRUCTURED entries (an `accountId`, optionally narrowed to a `field`), the
 * professional host resolves its stored draft-relative paths to IDs once at
 * approve time — instead of re-reconciling indices forever — and
 * `UpdateBalancesPanel` maps each entry's `accountId` to that account's CURRENT
 * index fresh on every render before handing the derived positional set to the
 * engine. The engine's `accounts[i]` contract is unchanged; the index translation
 * lives entirely in the panel, against live plan order.
 *
 * **Why entries are structured, not `<id>.<field>` strings.** Account ids are
 * arbitrary nonempty strings that may themselves contain dots (`'broker.acct-123'`
 * is a valid id), and an account id and one of its field paths can BOTH be valid
 * (`'a'` and `'a.costBasis'`). A flat string like `'a.costBasis'` is therefore
 * genuinely ambiguous — the whole-account id `'a.costBasis'` versus field
 * `costBasis` of account `'a'` — and no amount of longest-match guessing can
 * resolve that safely; guessing wrong protects the wrong account. Structured
 * entries carry the split the host already knew, so there is nothing to parse: the
 * `accountId` names the account verbatim and `field` (when present) names the
 * scope. Nested or dotted ids are trivially unambiguous.
 *
 * The default (no provider) is an empty list, so the public web app — which
 * renders no provider — behaves exactly as before: every updatable account is
 * fair game. This module never invents a protected set of its own; the seam is
 * the value the host supplies, mirroring how `refresh.ts` treats the argument.
 *
 * This mirrors the sibling edition seam: the context, hook, and types live here
 * (`refreshProtectionContext.ts`) and the provider component in
 * `RefreshProtectionProvider.tsx`, exactly as `editionContext.ts` pairs with
 * `PlannerEditionProvider.tsx`.
 */
import { createContext, useContext } from 'react'

/** The default protected list for the free web edition: nothing is off-limits. */
const EMPTY_PROTECTED: readonly RefreshProtectionEntry[] = []

/**
 * One account the broker refresh must not overwrite, named by STABLE account id.
 *
 * - `field` absent → the WHOLE account is protected (balance and cost basis).
 * - `field: 'costBasis'` → the host recorded cost-basis-scoped intent.
 *
 * **Field-scoped entries are conservative today: they block the account's whole
 * refresh, not just the named field.** The engine's `applyBrokerBalance` writes
 * balance and cost basis as a unit and cannot skip one field, so `isProtectedPath`
 * treats a protected field of an account as locking the ENTIRE account's refresh
 * write — protection deliberately errs toward overwriting *less*. So
 * `{ accountId: 'a', field: 'costBasis' }` protects `a`'s balance too, for now.
 * The `field` form is accepted so hosts can record the intended granularity;
 * finer per-field application is future engine work, and honouring it will not
 * require hosts to change what they pass. (There is no `'balance'` field because a
 * balance-only lock would be indistinguishable from a whole-account lock under the
 * conservative semantics — a whole-account entry, `field` absent, already covers
 * it.)
 */
export interface RefreshProtectionEntry {
  /** The stable id of the account to protect (matched verbatim; may contain dots). */
  accountId: string
  /** Narrow the recorded intent to cost basis; absent protects the whole account. */
  field?: 'costBasis'
}

export interface RefreshProtectionValue {
  /**
   * The accounts the broker refresh must not write, as structured entries. IDs are
   * stable across plan-array reordering; the panel resolves each `accountId` to the
   * current `accounts[i]` position itself. An empty list (the default) protects
   * nothing. Entries are matched by exact `accountId`, so nested or dotted ids
   * carry no ambiguity — there is no parsing.
   */
  protectedAccounts: readonly RefreshProtectionEntry[]
}

export const RefreshProtectionContext = createContext<RefreshProtectionValue>({ protectedAccounts: EMPTY_PROTECTED })

/**
 * Reads the ambient list of refresh-protected account entries, defaulting to an
 * empty list when no provider is mounted. `UpdateBalancesPanel` maps these stable
 * `accountId`s to the current `accounts[i]` positions (minus any row-scoped
 * release) before handing the derived positional set to `classifyRefresh` /
 * `buildRefreshDelta` / `applyRefresh`.
 */
export function useRefreshProtection(): readonly RefreshProtectionEntry[] {
  return useContext(RefreshProtectionContext).protectedAccounts
}
