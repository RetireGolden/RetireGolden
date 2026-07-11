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
