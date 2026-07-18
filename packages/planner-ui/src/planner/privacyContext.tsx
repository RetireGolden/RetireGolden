/**
 * Provider for the workspace privacy state — see privacyContextCore.ts for
 * the contract. Mounted by PlanWorkspace around the KPI bar and the routed
 * page, so both see the same hide-amounts flag.
 */

import { useMemo, useState, type ReactNode } from 'react'

import { PrivacyCtx } from './privacyContextCore'

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [hideAmounts, setHideAmounts] = useState(false)
  const value = useMemo(() => ({ hideAmounts, setHideAmounts }), [hideAmounts])
  return <PrivacyCtx.Provider value={value}>{children}</PrivacyCtx.Provider>
}
