/**
 * Public API of @retiregolden/planner-ui.
 *
 * `PlannerApp` is the whole planner — chrome (header/nav/footer/theme
 * toggle), route table, and error boundary — everything that lives inside
 * the router. The host owns the router: mount `<PlannerApp />` under its own
 * `<BrowserRouter>` (or any react-router v7 router) and import
 * `@retiregolden/planner-ui/index.css` for the design tokens and base styles.
 */
export { App as PlannerApp } from './App.tsx'
