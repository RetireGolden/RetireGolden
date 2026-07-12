/**
 * Workspace read-only capability — a generic, edition-neutral signal that the
 * planner should render its plan-editing surfaces read-only while keeping
 * read/explore/export paths working.
 *
 * planner-ui knows nothing about *why* (entitlements, accounts, sign-in): a
 * host sets `readOnly` on `<PlanStoreProvider>` (or `<PlannerApp/>`) when its
 * own policy says writes are disallowed, and renders its own banner explaining
 * the reason. The default is `false`, so the public web app is unchanged.
 *
 * This is the cooperative half of a two-part gate: it stops the planner from
 * *attempting* writes (autosave, the discrete write actions). The authoritative
 * gate stays the host `PlanStore` — `savePlan` remains free to throw, which is
 * the backstop if a write is ever attempted anyway.
 */

import { createContext, useContext } from 'react'

export const WorkspaceReadOnlyContext = createContext(false)

/** True when the workspace is in read-only mode (see WorkspaceReadOnlyContext). */
export function useWorkspaceReadOnly(): boolean {
  return useContext(WorkspaceReadOnlyContext)
}
