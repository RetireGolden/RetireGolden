/**
 * Threads the host's `reportBranding` prop (see `PlannerApp`) from the app
 * shell down to the pages with "Download HTML report" buttons, so a host can
 * brand downloaded reports without touching the planner tree. Null means "no
 * branding supplied" — the report renders its RetireGolden defaults.
 */
import { createContext, useContext } from 'react'

import type { ReportBranding } from './reportHtml'

export const ReportBrandingContext = createContext<ReportBranding | null>(null)

export function useReportBranding(): ReportBranding | null {
  return useContext(ReportBrandingContext)
}
