import type { ReactNode } from 'react'

import { PlannerEditionContext, type PlannerEditionConfig } from './editionContext'

/**
 * Supplies edition-specific content to hosts that mount the exported route
 * groups (`plannerContentRoutes` &c.) directly instead of `<PlannerApp/>`. Wrap
 * the mounted routes to override the planner-home label and the two
 * host-specific Disclaimer sections; omit the provider (or any individual
 * field) and the content pages keep the free web app's copy.
 *
 * ```tsx
 * <PlannerEditionProvider
 *   edition={{
 *     homeLabel: 'Client library',
 *     disclaimerDataSection: <MyDataSection />,
 *     disclaimerLicenseSection: <MyLicenseSection />,
 *   }}
 * >
 *   {routes}
 * </PlannerEditionProvider>
 * ```
 *
 * `<PlannerApp/>` deliberately exposes no matching prop: it renders the web
 * plans-management home ("Your plans") and the AGPL web app, so the defaults are
 * always correct there. Overriding edition content is a route-group-host
 * concern.
 */
export function PlannerEditionProvider({
  edition,
  children,
}: {
  edition?: PlannerEditionConfig
  children: ReactNode
}) {
  return <PlannerEditionContext.Provider value={edition ?? null}>{children}</PlannerEditionContext.Provider>
}
