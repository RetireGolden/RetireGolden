/**
 * Primary product export of @retiregolden/planner-ui.
 *
 * `PlannerApp` is the whole planner — chrome (header/nav/footer/theme
 * toggle), route table, and error boundary — everything that lives inside
 * the router. The host owns the router: mount `<PlannerApp />` under its own
 * `<BrowserRouter>` (or any react-router v7 router) and import
 * `@retiregolden/planner-ui/index.css` for the design tokens and base styles.
 *
 * The full published surface is package.json `exports`: it additionally
 * names 23 unpromised deep subpaths, one by one, for the upstream repo's own
 * harnesses and for RetireGolden-Pro and RetireGolden-MCP. Those deep paths
 * carry no stability promise — see README "Published API surface".
 */
export { App as PlannerApp, type PlannerAppProps } from './App.tsx'
export type { ReportBranding } from './report/reportHtml'

// Stale-deployment recovery: call before render so a deploy that replaces
// the hashed chunks under an open tab auto-reloads once instead of surfacing
// "Failed to fetch dynamically imported module". `RouteErrorBoundary` also
// backstops this for hosts that skip the call — see staleChunkReload.ts.
export { installStaleChunkReloadHandler } from './staleChunkReload.ts'

// The plan-persistence seam: implement `PlanStore` and wrap the planner in
// `<PlanStoreProvider>` (or pass `planStore` to `<PlannerApp/>`) to supply
// host storage; omit both and plans persist in the browser via IndexedDB.
export { PlanStoreProvider } from './data/PlanStoreProvider.tsx'
export {
  indexedDbPlanStore,
  type PlanStore,
  type PlanSummary,
} from './data/planStoreContext.ts'

// Generic, edition-neutral read-only capability: set `readOnly` on
// `<PlanStoreProvider>` (or `<PlannerApp/>`) to render the plan-editing
// surfaces read-only; `useWorkspaceReadOnly()` reads it inside custom chrome.
export { useWorkspaceReadOnly } from './data/workspaceReadOnly.ts'

// Generic emergency boundary for file-backed imports. PlannerApp hosts can use
// the prop; hosts composing route groups directly wrap them with this provider.
export { ImportAvailabilityProvider } from './import/ImportAvailabilityProvider.tsx'
export { useImportAvailability, useImportEnabled } from './import/importAvailability.ts'

// Route-level exports: mount a subset of the planner under the host's own
// router (react-router v7 route-object arrays). `<PlannerApp/>` remains the
// batteries-included composition of all three groups plus the web chrome.
export {
  plannerContentRoutes,
  plannerHomeRoutes,
  plannerNotFoundRoute,
  plannerWorkspaceRoutes,
} from './routes/groups.tsx'

// Report branding for hosts that mount route groups directly; `<PlannerApp/>`
// hosts use the `reportBranding` prop instead.
export { ReportBrandingProvider } from './report/ReportBrandingProvider.tsx'

// Edition content for hosts that mount route groups directly: override the
// planner-home label and the two host-specific Disclaimer sections (data-storage
// story, software license). Omit it and the content pages keep the web copy.
export { PlannerEditionProvider } from './planner/PlannerEditionProvider.tsx'
export { usePlannerEdition, type PlannerEditionConfig } from './planner/editionContext.ts'

// Refresh-protection seam for the embedded "Update balances" panel: a host feeds
// the accounts its intake decisions have frozen as structured entries (a stable
// `accountId`, optionally narrowed to a `field`), and the panel resolves them to
// the current `accounts[i]` positions and threads them into the broker-refresh
// engine. A host still loading that set passes `pending`, and the panel refuses
// both the file chooser and Apply until it clears — an empty list would otherwise
// read as "nothing is protected". Omit the provider and the panel protects
// nothing and is never pending (public web behaviour).
export { RefreshProtectionProvider } from './planner/RefreshProtectionProvider.tsx'
export {
  useRefreshProtection,
  useRefreshProtectionPending,
  type RefreshProtectionEntry,
  type RefreshProtectionValue,
} from './planner/refreshProtectionContext.ts'

// The import-provenance contract (also published at the `./import-provenance`
// subpath): the vocabulary and export envelope that record where every imported
// value came from, how confident the mapper was, and a reviewer's verdict.
export {
  IMPORT_PROVENANCE_KIND,
  IMPORT_PROVENANCE_VERSION,
  csvRowLocator,
  describeSourceLocator,
  form1040Locator,
  jsonPathLocator,
  parseImportProvenance,
  serializeImportProvenance,
} from './import/provenance.ts'
export { reviewToProvenance, type ImportReviewItem, type ImportItemStatus } from './import/reviewChecklist.ts'

// The broker-refresh engine (also published at the `./import-refresh` subpath):
// match a parsed broker file to plan accounts, preview the exact before→after
// balance/cost-basis writes, and apply them without disturbing strategy fields.
// Browser-free; its names and signatures change only with a semver-major release.
export {
  applyRefresh,
  buildRefreshDelta,
  classifyRefresh,
  type ClassifyRefreshOptions,
  type RefreshCandidate,
  type RefreshClassification,
  type RefreshDelta,
  type RefreshDuplicateGroup,
  type RefreshFieldDelta,
  type RefreshMatchKind,
} from './import/refresh.ts'

// The existing-plan intake-refresh contract (also published at the
// `./intake-refresh` subpath): provenance-gated semantic matching and exact
// previews for a deliberately narrow income/MAGI leaf allowlist. Browser-free;
// it never adds/deletes records or copies whole intake objects into a plan.
export {
  applyIntakeRefresh,
  buildIntakeRefreshDelta,
  classifyIntakeRefresh,
  defaultIntakeRefreshSelection,
  type ClassifyIntakeRefreshOptions,
  type IntakeRefreshCandidate,
  type IntakeRefreshClassification,
  type IntakeRefreshDelta,
  type IntakeRefreshDuplicateGroup,
  type IntakeRefreshExcludedItem,
  type IntakeRefreshExclusionReason,
  type IntakeRefreshField,
  type IntakeRefreshFieldDelta,
  type IntakeRefreshMatchKind,
  type IntakeRefreshSource,
  type IntakeRefreshTargetBinding,
} from './import/intakeRefresh.ts'
export type {
  DecisionState,
  ImportConfidence,
  ImportProvenanceExport,
  ImportProvenanceEntry,
  ImportProvenanceInput,
  ImportSourceRef,
  ParseImportProvenanceResult,
  ReviewerDecision,
  SourceLocator,
} from './import/provenance.ts'
