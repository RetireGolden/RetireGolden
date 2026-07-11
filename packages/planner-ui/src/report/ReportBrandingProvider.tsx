import type { ReactNode } from 'react'

import { ReportBrandingContext } from './brandingContext'
import type { ReportBranding } from './reportHtml'

/**
 * Supplies report branding to hosts that mount the exported route groups
 * directly instead of `<PlannerApp/>` (whose `reportBranding` prop does the
 * same thing). Omit `branding` (or the provider) and downloaded reports keep
 * the RetireGolden defaults.
 */
export function ReportBrandingProvider({ branding, children }: { branding?: ReportBranding; children: ReactNode }) {
  return <ReportBrandingContext.Provider value={branding ?? null}>{children}</ReportBrandingContext.Provider>
}
