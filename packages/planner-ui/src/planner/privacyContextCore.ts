/**
 * Workspace-level privacy state (context + hook; the provider lives in
 * privacyContext.tsx, split so the provider file only exports a component —
 * same shape as PlanContext/planContextCore).
 *
 * While a page (today the Household map) has "Hide amounts" active, every
 * dollar value the surrounding workspace chrome renders — the KPI bar's net
 * worth, taxes, conversions — must be masked too, or the screen-share promise
 * is broken by the chrome above the page. The setting page is responsible for
 * resetting the flag when it unmounts, so navigating away always restores the
 * workspace.
 */

import { createContext, useContext } from 'react'

export interface PrivacyState {
  /** True while dollar amounts should be hidden across the workspace. */
  hideAmounts: boolean
  setHideAmounts: (hide: boolean) => void
}

export const PrivacyCtx = createContext<PrivacyState>({ hideAmounts: false, setHideAmounts: () => undefined })

export function usePrivacy(): PrivacyState {
  return useContext(PrivacyCtx)
}
