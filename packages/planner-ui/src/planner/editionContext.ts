/**
 * Edition content for hosts that mount the exported route groups directly
 * (their own chrome, their own plans-management home) instead of
 * `<PlannerApp/>`. The route-group content pages carry free-web-only wording by
 * default — the planner-home label ("Your plans"), the "Your data stays with
 * you" disclaimer section (no accounts, browser storage), and the AGPL software
 * license section — which is wrong in a differently-licensed host edition (e.g.
 * an account-backed, EULA-licensed desktop app). This context lets such a host
 * override just those host-specific strings/blocks while the shared disclaimer
 * substance stays single-sourced.
 *
 * The default (no provider) reproduces today's web copy exactly, so
 * `<PlannerApp/>` and every existing host render byte-identically. This mirrors
 * the report-branding seam (`report/brandingContext.ts`): a plain React context
 * with a defaults-applying hook, no capability detection.
 */
import { createContext, useContext, type ReactNode } from 'react'

/** Default label for the planner-home destination in the free web edition. */
export const DEFAULT_HOME_LABEL = 'Your plans'

export interface PlannerEditionConfig {
  /**
   * Label of the planner-home destination the content pages link back to.
   * Defaults to `'Your plans'`; a host whose home is, say, a client library
   * passes its own label. Consumed by the Examples page back link and the
   * example-preview persistence copy.
   */
  homeLabel?: string
  /**
   * Tooltip on the workspace save indicator for the user's own (non-example)
   * plans. The default describes the free web app's persistence ("Plans live
   * only in this browser — nothing is sent to a server…"), which is false for a
   * host with its own store behind the PlanStore seam — such a host supplies an
   * accurate sentence (e.g. an encrypted local library). The indicator label
   * itself ("Stored on this device") stays shared: it is true wherever the
   * seam stores locally.
   */
  storageTooltip?: string
  /**
   * Replaces the entire "Your data stays with you" section (heading + body) on
   * the Disclaimer page. The default describes the free web app's storage story
   * (no accounts, browser IndexedDB/localStorage, "Clear all data"); a host with
   * a different persistence/account model supplies its own accurate block.
   */
  disclaimerDataSection?: ReactNode
  /**
   * Replaces the entire "Software license & third-party notices" section
   * (heading + body) on the Disclaimer page. The default states the AGPL,
   * free-and-open-source license of the web app; a differently-licensed host
   * (e.g. an EULA-licensed edition) supplies its own block.
   */
  disclaimerLicenseSection?: ReactNode
}

/** Default save-indicator tooltip for the free web edition's own plans. */
export const DEFAULT_STORAGE_TOOLTIP =
  "Plans live only in this browser — nothing is sent to a server. Use 'Download plan backup' on the planner home to keep a copy."

/** Resolved edition content — defaults applied, so consumers never branch. */
export interface ResolvedPlannerEdition {
  homeLabel: string
  storageTooltip: string
  disclaimerDataSection: ReactNode | null
  disclaimerLicenseSection: ReactNode | null
}

export const PlannerEditionContext = createContext<PlannerEditionConfig | null>(null)

/**
 * Reads the ambient edition content, applying the web defaults. Returns the
 * resolved `homeLabel` (never empty) and the two optional disclaimer overrides
 * (`null` when the host did not supply them — the caller renders its default
 * block).
 */
export function usePlannerEdition(): ResolvedPlannerEdition {
  const config = useContext(PlannerEditionContext)
  // Normalize so "never empty" holds even against `homeLabel: ''` or
  // whitespace — the label lands mid-sentence ("stay out of …") and after the
  // back arrow, where an empty string reads as broken copy.
  const homeLabel = config?.homeLabel?.trim()
  const storageTooltip = config?.storageTooltip?.trim()
  return {
    homeLabel: homeLabel || DEFAULT_HOME_LABEL,
    storageTooltip: storageTooltip || DEFAULT_STORAGE_TOOLTIP,
    disclaimerDataSection: config?.disclaimerDataSection ?? null,
    disclaimerLicenseSection: config?.disclaimerLicenseSection ?? null,
  }
}
