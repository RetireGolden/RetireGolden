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
 * exposes wildcard `./*.ts` subpaths for the upstream repo's own harnesses
 * (cases, owl-parity, docs tests). Those deep paths carry no stability
 * promise — see README "Published API surface".
 */
export { App as PlannerApp, type PlannerAppProps } from './App.tsx'
export type { ReportBranding } from './report/reportHtml'

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

// Route-level exports: mount a subset of the planner under the host's own
// router (react-router v7 route-object arrays). `<PlannerApp/>` remains the
// batteries-included composition of all three groups plus the web chrome.
export {
  plannerContentRoutes,
  plannerHomeRoutes,
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

// The import-provenance contract (also published at the `./import-provenance`
// subpath): the vocabulary and export envelope that record where every imported
// value came from, how confident the mapper was, and a reviewer's verdict.
export {
  IMPORT_PROVENANCE_KIND,
  IMPORT_PROVENANCE_VERSION,
  describeSourceLocator,
  parseImportProvenance,
  serializeImportProvenance,
} from './import/provenance.ts'
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
