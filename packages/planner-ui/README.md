# @retiregolden/planner-ui

The [RetireGolden](https://retiregolden.app/) planner React UI — the complete
planner a host application composes inside its own router: plan picker and
workspace, results/Monte Carlo/scenarios/survivor/relocation pages, the
Roth & Tax / spending / Social Security optimizers, the import wizard, the
Learning Center, report export, and browser persistence (IndexedDB +
localStorage). All money math lives in
[`@retiregolden/engine`](https://www.npmjs.com/package/@retiregolden/engine)
(a dependency of this package, not re-exported by it); this package is the UI
and persistence around it.

Source of truth: [github.com/RetireGolden/RetireGolden](https://github.com/RetireGolden/RetireGolden)
(`packages/planner-ui`). Engineering docs live in the repo's `DOCS/`.

## What ships, and the bundler contract

This package publishes its **TypeScript source** (`src/`, referenced directly
by `exports` and `types`) and requires a **Vite-class bundler** — it is not
consumable from plain Node or from bundlers that don't implement Vite
semantics. The planner tree relies on features only a Vite-style build
provides:

- `new Worker(new URL('./x.worker.ts', import.meta.url), { type: 'module' })`
  for the Monte Carlo pool, the optimizers, and relocation compare;
- `import wasmUrl from 'highs/runtime?url'` for the HiGHS LP-solver wasm;
- `import.meta.glob`, `import.meta.env.DEV`, CSS and image imports.

Compiling to plain ESM would not remove any of those requirements, so the
package doesn't pretend otherwise. Known-good consumers: Vite ≥ 8 and
electron-vite, with React 19 and react-router v7 (peers).

### Required Vite config

Dependency pre-bundling must skip this package (esbuild/rolldown pre-bundles
break the Vite-only constructs above) while still pre-bundling its
CommonJS-flavoured dependencies for dev:

```ts
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['@retiregolden/planner-ui'],
    include: ['@retiregolden/planner-ui > highs', '@retiregolden/planner-ui > recharts'],
  },
})
```

Production builds work without this; dev mode does not — leave it in place.
TypeScript consumers should use `"moduleResolution": "bundler"` and include
`vite/client` types (standard in Vite templates), since type checking reads
this package's source.

## Usage

```bash
npm install @retiregolden/planner-ui react react-dom react-router-dom
```

The host owns the router and mounts the planner under it:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@retiregolden/planner-ui/index.css'
import { PlannerApp } from '@retiregolden/planner-ui'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <PlannerApp />
    </BrowserRouter>
  </StrictMode>,
)
```

`<PlannerApp />` is everything inside the router: the app chrome (header,
nav, theme toggle, footer), the route table, and the route error boundary.
Use `BrowserRouter`, `HashRouter` (Electron `file://` hosts), or
`MemoryRouter` as the host requires; a `basename` on the host's router is
respected because the planner only uses relative react-router APIs.

### CSS and theming

- `@retiregolden/planner-ui/index.css` — required: the design-token layer
  (CSS custom properties for both light and dark themes) plus base styles.
  Import it once in the host.
- Component styles (`planner.css`, `learn.css`) are imported by the
  components themselves; no extra import is needed.

Theming hook: the token layer is plain CSS custom properties on `:root` (and
`[data-theme]` variants), so a host can re-brand by loading its own
stylesheet after `index.css` and overriding tokens. Keep overrides
WCAG-AA-honest — the upstream palette is contrast-guarded by tests.

### Host-served static assets (required)

The planner references a small set of **root-absolute URLs that the host must
serve** — they are deliberately not bundled, because several are
host-specific by nature. `app/public/` in the upstream repo is the reference
tree to copy from:

| Path | Used by | Notes |
|------|---------|-------|
| `/favicon.svg` | Header brand mark (mobile), logo fallback | |
| `/brand/retiregolden-logo-lockup.png`, `/brand/retiregolden-logo-lockup-light.png` | Header logo (dark/light) | Missing files degrade to `/favicon.svg` |
| `/learn/images/*.webp` | Learning Center article illustrations (~5 MB total) | Copy from `app/public/learn/images/` |
| `/THIRD-PARTY-NOTICES.txt` | Disclaimer page's third-party attribution link | **Must describe the host's own bundle** — generate it from your dependency tree (the upstream generator is `app/scripts/generate-third-party-notices.mjs`); do not copy the web app's file verbatim |

Electron hosts loading over `file://` should use `HashRouter` and a protocol
handler (or serve the app over a local scheme) so these root-absolute URLs
resolve against the app bundle, not the filesystem root.

### Published API surface

The supported product API is:

- the **root export** — `PlannerApp`, the plan-persistence seam
  (`PlanStore`, `PlanSummary`, `PlanStoreProvider`, `indexedDbPlanStore`),
  the route groups (`plannerWorkspaceRoutes`, `plannerContentRoutes`,
  `plannerHomeRoutes`), and `ReportBrandingProvider` — see "Hosting the
  workspace" below;
- the **`./plan-format` subpath** — `serializeV2Backup`, `parseV2Backup`,
  the envelope types, and the kind/version constants. This is the plan
  interchange format (the same file the web app's backup download produces);
  its exported names, signatures, and envelope contract only change with a
  semver-major release. The parser ignores unknown envelope fields, so hosts
  may extend the envelope with their own top-level keys and the file still
  imports everywhere. The module is browser-free (no IndexedDB/DOM) and safe
  to run in Node — e.g. an Electron main process assembling backups;
- `./index.css`.

The exports map also exposes wildcard `./*.ts` subpaths
(e.g. `./report/reportHtml`) — these exist for the upstream repo's own test
and case-runner harnesses, are not covered by any stability promise, and may
move or change in any release. If a host needs one of them long-term, open an
upstream issue so it can be promoted to a real export instead.

## Hosting the workspace

`<PlannerApp/>` is the batteries-included web composition: chrome, all
routes, browser storage. A host with its own plans-management surface (its
own library UI, its own chrome) instead mounts *parts* of the planner and
supplies storage. Three hooks make that possible; none of them involve any
capability detection — they are plain props, context, and route arrays.

### Plan storage: the `PlanStore` seam

The workspace, Compare, the optimizers, and the import wizard read and write
plans through a provider interface:

```ts
import type { PlanStore, PlanSummary } from '@retiregolden/planner-ui'

interface PlanStore {
  listPlans(): Promise<PlanSummary[]>   // { id, name, updatedAtIso }
  loadPlan(id: string): Promise<unknown> // stored plan JSON verbatim; null/undefined when absent
  savePlan(plan: Plan): Promise<void>    // already validated + stamped; the autosave path
  deletePlan(id: string): Promise<void>
}
```

Implementations are storage-dumb by design: `loadPlan` returns the stored
document as-is (any schema version) and planner-ui runs schema migration and
Zod validation on it — the same single code path the web app has always used
— while `savePlan` receives a plan that already passed validation and got its
`updatedAtIso` stamp. A store never re-implements plan semantics.

Supply a store with the provider (or the `planStore` prop on
`<PlannerApp/>`); keep the instance stable — the planner reloads when the
store's identity changes:

```tsx
import { PlanStoreProvider } from '@retiregolden/planner-ui'

<PlanStoreProvider store={myStore}>{/* planner routes */}</PlanStoreProvider>
```

Omit the provider and the browser IndexedDB implementation applies — it is
also exported as `indexedDbPlanStore` for hosts that want to wrap it.

Deliberate boundaries of the seam:

- **Plan-scoped.** No client/household-grouping concepts; a host that keeps
  per-client libraries maps plan ids to its own structure in its adapter.
- **No change feed.** Planner list views refetch after their own mutations,
  so the interface carries no subscription mechanism.
- **Example demo records never cross it.** The example library's editable
  demo slots (`example:*` ids) are per-device preview UX and stay in the
  browser store regardless of provider; "Save to my plans" converts a demo
  into a user plan and writes *that* through the seam. Small conveniences
  (theme, dismissed banners) likewise stay in `localStorage`.

### Route groups

The route table is exported as three react-router v7 `RouteObject[]` arrays
that spread into `useRoutes`, nest under a host's route config, or feed
`createBrowserRouter`. Paths are relative, so the groups mount at the router
root or under a host path, and deep links (e.g. `/plan/<id>/results`) work
with only the workspace group mounted:

| Export | Routes | Notes |
|--------|--------|-------|
| `plannerWorkspaceRoutes` | `plan/:planId/*` (sections, results, Monte Carlo, scenarios, survivor, relocation, optimizers, report) + `compare` | The plan workspace a host wraps in its own chrome |
| `plannerContentRoutes` | `examples`, `learn/*`, `disclaimer`, `how-tested` | Storage-independent content; workspace pages link into it, so mount it (or redirect those paths) |
| `plannerHomeRoutes` | `` (index), `import`, retired-route redirects | The web plans-management home — omit it if the host owns plan management |

```tsx
import { useRoutes } from 'react-router-dom'
import { plannerWorkspaceRoutes, plannerContentRoutes } from '@retiregolden/planner-ui'

function PlannerRoutes() {
  return useRoutes([...plannerWorkspaceRoutes, ...plannerContentRoutes])
}
```

The groups are chrome-free: no header/nav/footer, no theme toggle, and no
`document.title` management for non-plan routes (plan routes retitle
themselves). Workspace pages render links to `/` ("Your plans") — point that
path at your own library surface. Hosts mounting groups directly brand
downloaded reports with `ReportBrandingProvider` (the component form of the
`reportBranding` prop below); `<PlannerApp/>` remains exactly the composition
of all three groups plus the web chrome.

### Plan interchange

Use the `./plan-format` subpath (see "Published API surface") for import/
export that speaks the same envelope as the web app's backup files:

```ts
import { serializeV2Backup, parseV2Backup } from '@retiregolden/planner-ui/plan-format'
```

### Report branding

Downloaded HTML reports (Results, Report, and Optimizer pages) can carry the
host's identity via the optional `reportBranding` prop — a generic hook, with
RetireGolden defaults when omitted:

```tsx
<PlannerApp
  reportBranding={{
    productName: 'Acme Wealth Planner',        // report title, header line, filename
    logoDataUri: 'data:image/png;base64,...',  // letterhead logo (data: URI only — reports stay self-contained)
    logoAlt: 'Acme Wealth',
    accentColor: '#1a3a5c',                    // letterhead rule color
    footerNote: 'Prepared by Acme Wealth Advisors LLC.',
  }}
/>
```

`buildStandaloneReportHtml` (deep subpath `./report/reportHtml` — the
stability caveat under "Published API surface" applies) accepts the same
`branding` object directly for hosts that generate reports outside the
planner pages. Values are sanitized — the logo must be a base64
`data:image/...` URI, the accent must parse as a real CSS color (hex,
`rgb()`/`hsl()`, or a named color; anything else falls back to the default
gold), and text fields are escaped-and-kept — so the report's no-script
guarantee holds regardless of input. This branding
applies to downloaded reports only; the in-app chrome is themed via the CSS
tokens (above).

### Storage

By default, plans persist in the browser profile via IndexedDB (`idb`) with
localStorage for small preferences, exactly as on retiregolden.app. Hosts
that need a different persistence story implement the `PlanStore` seam (see
"Hosting the workspace") — anything the seam doesn't cover should be an
upstream conversation, not a fork point.

## Relationship to the web app

`app/` in the upstream repo is the reference host: it adds the PWA service
worker, SEO/meta, sitemap and prerender tooling, and static-hosting config,
then mounts `<PlannerApp />` exactly as in the snippet above. This package
contains no host-specific behavior — composition points are generic React
props/slots and CSS tokens, nothing keyed to any particular product.

## License

**AGPL-3.0-only** (see [LICENSE](LICENSE)). The planner UI is free and
un-gutted — the full feature set ships in the free web app.

RetireGolden, LLC also ships a commercial desktop edition built from this
same UI under a separate commercial license, which funds the free one. That
dual-license arrangement is why contributions to the
[upstream repo](https://github.com/RetireGolden/RetireGolden) require a
one-time [Contributor License Agreement](https://github.com/RetireGolden/RetireGolden/blob/main/CLA.md)
— you keep your copyright; the CLA lets the LLC also ship your contribution
in the commercial edition. See
[CONTRIBUTING.md](https://github.com/RetireGolden/RetireGolden/blob/main/CONTRIBUTING.md).
