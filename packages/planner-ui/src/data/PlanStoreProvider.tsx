import type { ReactNode } from 'react'

import { PlanStoreContext, type PlanStore } from './planStoreContext'
import { WorkspaceReadOnlyContext, useWorkspaceReadOnly } from './workspaceReadOnly'

/**
 * Supplies a host `PlanStore` (see data/planStoreContext.ts) to the planner
 * tree. Without it — or via `<PlannerApp/>` with no `planStore` prop — the
 * browser IndexedDB store applies. Keep the instance stable (module constant
 * or memoized): the planner reloads when the store changes identity.
 *
 * `readOnly` is the generic capability that renders the workspace read-only:
 * editing controls disable and autosave never runs, while read/explore/export
 * paths keep working. The host decides when to set it and renders its own
 * explanatory banner — see data/workspaceReadOnly.ts. Omitting it inherits the
 * ambient value (a parent provider's, else the context default `false`), just
 * as an omitted store falls back to the ambient/default one — so nesting
 * providers doesn't accidentally clear a read-only signal set higher up.
 */
export function PlanStoreProvider({
  store,
  readOnly,
  children,
}: {
  store: PlanStore
  readOnly?: boolean
  children: ReactNode
}) {
  const ambientReadOnly = useWorkspaceReadOnly()
  const effectiveReadOnly = readOnly ?? ambientReadOnly
  return (
    <PlanStoreContext.Provider value={store}>
      <WorkspaceReadOnlyContext.Provider value={effectiveReadOnly}>{children}</WorkspaceReadOnlyContext.Provider>
    </PlanStoreContext.Provider>
  )
}
