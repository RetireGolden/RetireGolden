import type { ReactNode } from 'react'

import { PlanStoreContext, type PlanStore } from './planStoreContext'

/**
 * Supplies a host `PlanStore` (see data/planStoreContext.ts) to the planner
 * tree. Without it — or via `<PlannerApp/>` with no `planStore` prop — the
 * browser IndexedDB store applies. Keep the instance stable (module constant
 * or memoized): the planner reloads when the store changes identity.
 */
export function PlanStoreProvider({ store, children }: { store: PlanStore; children: ReactNode }) {
  return <PlanStoreContext.Provider value={store}>{children}</PlanStoreContext.Provider>
}
