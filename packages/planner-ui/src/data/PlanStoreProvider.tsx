import type { ReactNode } from 'react'

import { PlanStoreContext, type PlanStore } from './planStoreContext'
import { WorkspaceReadOnlyContext } from './workspaceReadOnly'

/**
 * Supplies a host `PlanStore` (see data/planStoreContext.ts) to the planner
 * tree. Without it — or via `<PlannerApp/>` with no `planStore` prop — the
 * browser IndexedDB store applies. Keep the instance stable (module constant
 * or memoized): the planner reloads when the store changes identity.
 *
 * `readOnly` (default `false`) is the generic capability that renders the
 * workspace read-only: editing controls disable and autosave never runs, while
 * read/explore/export paths keep working. The host decides when to set it and
 * renders its own explanatory banner — see data/workspaceReadOnly.ts.
 */
export function PlanStoreProvider({
  store,
  readOnly = false,
  children,
}: {
  store: PlanStore
  readOnly?: boolean
  children: ReactNode
}) {
  return (
    <PlanStoreContext.Provider value={store}>
      <WorkspaceReadOnlyContext.Provider value={readOnly}>{children}</WorkspaceReadOnlyContext.Provider>
    </PlanStoreContext.Provider>
  )
}
