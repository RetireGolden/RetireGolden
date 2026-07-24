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
  the read-only capability (`readOnly` prop + `useWorkspaceReadOnly`), the
  route groups (`plannerWorkspaceRoutes`, `plannerContentRoutes`,
  `plannerHomeRoutes`), `ReportBrandingProvider`,
  `PlannerEditionProvider` (with `usePlannerEdition` /
  `PlannerEditionConfig`), and `RefreshProtectionProvider` (with
  `useRefreshProtection` / `RefreshProtectionValue`) — see "Hosting the
  workspace" below;
- the **`./plan-format` subpath** — `serializeV2Backup`, `parseV2Backup`,
  the envelope types, and the kind/version constants. This is the plan
  interchange format (the same file the web app's backup download produces);
  its exported names, signatures, and envelope contract only change with a
  semver-major release. The parser ignores unknown envelope fields, so hosts
  may extend the envelope with their own top-level keys and the file still
  imports everywhere. The module is browser-free (no IndexedDB/DOM) and safe
  to run in Node — e.g. an Electron main process assembling backups;
- the **`./report-model` subpath** — the edition-neutral report data model:
  `ReportModel` and its block types, `buildReportModel`, the stable
  `REPORT_BLOCK_IDS`, `serializeReportModel` (deterministic JSON), and the
  CSV table helpers (`chartDataCsv`, `yearLedgerCsv`, `accountsCsv`). See
  "Report model" under "Hosting the workspace". Like `./plan-format`, its
  exported names, signatures, and block ids only change with a semver-major
  release (new blocks/fields may be added in minors), and the module is
  browser-free and safe to run in Node;
- the **`./import-refresh` subpath** — the broker-refresh engine
  (`classifyRefresh`, `buildRefreshDelta`, `applyRefresh` and their types) that
  matches a parsed broker file to plan accounts, previews the exact
  before→after balance/cost-basis writes, and applies them without disturbing
  a returning user's strategy fields. Like `./import-provenance`, its exported
  names and signatures only change with a semver-major release, and the module
  is browser-free and safe to run in Node (a caller supplies the protected-path
  set; the web planner passes none);
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

Supply a store with the provider or the `planStore` prop on `<PlannerApp/>`
(the prop wins when both are present); keep the instance stable — the
planner reloads when the store's identity changes:

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

### Read-only mode

The workspace can render read-only: pass `readOnly` to `<PlanStoreProvider>`
(or `<PlannerApp/>`). It defaults to `false`, so omitting it leaves behavior
exactly as before — the public web app is unchanged.

```tsx
<PlanStoreProvider store={myStore} readOnly={!canEdit}>{/* planner routes */}</PlanStoreProvider>
```

When `readOnly` is `true`:

- **the plan cannot mutate** — the shared `update` path is a no-op, so an edit
  changes nothing on screen and no `savePlan` is attempted (the store's own
  throw, below, is never reached). Read-only means no mutation, not merely no
  autosave, so nothing can silently persist on a later re-enable;
- **plan-editing controls disable** — the entry sections (Household, Accounts,
  Income, …) and the plan-name field render disabled;
- **the discrete write actions hide** — duplicate, delete, "Save to my plans",
  import, and new-plan are unavailable;
- **the explore-page apply/add actions disable** — the "Apply", "Add as
  scenario", "Use", and similar plan-mutating controls on the optimizer,
  Scenarios, Relocation, Survivor, and Insights pages disable, so those tools
  stay read/compute-only;
- **read/explore/export keep working** — Results, Report, Compare, Monte Carlo,
  the optimizers' compute + report downloads, and every download/backup path
  are untouched.

This is a **generic, edition-neutral capability**: planner-ui knows nothing
about *why* writes are disallowed (entitlements, sign-in, a lapsed
subscription). The host decides when to set `readOnly` and renders its own
banner explaining the reason — keep any planner-side text generic. `readOnly`
is the *cooperative* half of the gate: it stops the planner from attempting
writes. The authoritative gate stays the host `PlanStore` — `savePlan` is free
to throw, and that throw is the backstop if a write is ever attempted anyway.

`useWorkspaceReadOnly()` reads the same signal inside a host's own chrome
mounted under the provider (e.g. to disable a custom toolbar button):

```tsx
import { useWorkspaceReadOnly } from '@retiregolden/planner-ui'

const readOnly = useWorkspaceReadOnly() // false unless a provider sets it
```

### Route groups

The route table is exported as three react-router v7 `RouteObject[]` arrays
that spread into `useRoutes` or feed `createBrowserRouter`. Mount them at
the host router's **root**; to serve the planner under a URL prefix, put the
prefix in the router's `basename`
(e.g. `<BrowserRouter basename="/planner">`) — planner pages navigate with
root-absolute paths, which react-router resolves against the basename. Do
not nest the groups under a parent route path (`path: 'planner/*'`): the
initial deep link would render, but the first in-app navigation would escape
the prefix. Deep links (e.g. `/plan/<id>/results`) work with only the
workspace group mounted:

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

The content-group pages are layout-robust standalone — the Examples page
centers its own 52rem column (matching the web shell) so it renders correctly
in a bare host, not just inside `.app-shell`.

### Edition content

A few strings are written for the free web app and are wrong in a
differently-configured host — the planner-home label ("Your plans", used by the
content pages and the workspace breadcrumb/rail/recovery links), the workspace
save-indicator tooltip ("Plans live only in this browser…"), the Disclaimer's
"Your data stays with you" section (no accounts, browser storage), and its
"Software license & third-party notices" section (AGPL, free and open
source). `PlannerEditionProvider` overrides just those, leaving
the shared disclaimer substance (educational-use, model limitations,
rules-change, provenance, no-warranty) single-sourced. Omit the provider (or
any field) and every page keeps today's web copy exactly — `<PlannerApp/>` and
existing hosts are unchanged.

```tsx
import { PlannerEditionProvider } from '@retiregolden/planner-ui'

<PlannerEditionProvider
  edition={{
    homeLabel: 'Client library',            // home links + example persistence copy; default 'Your plans'
    storageTooltip: 'Plans live in your encrypted local library — nothing is sent to a server.',
    disclaimerDataSection: <MyDataSection />,      // replaces the whole "Your data stays with you" block
    disclaimerLicenseSection: <MyLicenseSection />, // replaces the whole license block
  }}
>
  {/* plannerContentRoutes / plannerWorkspaceRoutes */}
</PlannerEditionProvider>
```

`PlannerEditionConfig` is the `edition` shape; all fields are optional.
`usePlannerEdition()` reads the resolved values (defaults applied) inside a
host's own chrome mounted under the provider. This is a route-group-host
concern, so — unlike `reportBranding` — `<PlannerApp/>` exposes no matching
prop: it renders the web plans-management home and the AGPL web app, where the
defaults are always correct.

### Refresh protection

The embedded "Update balances from a broker CSV" panel refreshes balances from a
broker file. A professional host can freeze accounts it has reconciled by hand so
the refresh cannot overwrite them. The panel takes no props, so protection is
supplied through the ambient `RefreshProtectionProvider` (mirroring
`PlannerEditionProvider`): pass **structured entries** — a `RefreshProtectionEntry`
is `{ accountId, field? }`, where a bare `accountId` protects the whole account and
`field: 'costBasis'` records cost-basis-scoped intent — and the panel resolves each
`accountId` to that account's current `accounts[i]` position before threading it
into the refresh engine. IDs (not array positions) are the contract because
plan-array indices shift as accounts are added or removed. Entries are **structured
rather than `<id>.<field>` strings** because account ids are arbitrary nonempty
strings that may contain dots (`'broker.acct-123'` is valid) and an id can equal
another id's field path — so a flat string like `'a.costBasis'` is genuinely
ambiguous (whole account `'a.costBasis'` vs field `costBasis` of `'a'`) and no
longest-match guess can resolve it safely. The `accountId` names the account
verbatim; there is nothing to parse, and nested or dotted ids are unambiguous. Omit
the provider and the panel protects nothing — the public web behaviour.

**Field-scoped entries are conservative today.** A `{ accountId, field: 'costBasis' }`
entry currently blocks that account's **whole** refresh, not just the named field:
the engine's `applyBrokerBalance` writes balance and cost basis as a unit and cannot
skip one field, so a protected field locks the entire account's refresh write
(protection errs toward overwriting *less*). So `{ accountId: 'acct-456', field: 'costBasis' }`
protects `acct-456`'s balance too. The `field` form is accepted so a host can record
the intended granularity; finer per-field application is future engine work and will
not change what hosts pass. (There is no `'balance'` field — a whole-account entry
already covers a balance lock under these conservative semantics.)

```tsx
import { RefreshProtectionProvider } from '@retiregolden/planner-ui'

<RefreshProtectionProvider
  protectedAccounts={[{ accountId: 'acct-123' }, { accountId: 'acct-456', field: 'costBasis' }]}
>
  {/* plannerWorkspaceRoutes */}
</RefreshProtectionProvider>
```

Protected accounts stay **selectable** in every row (marked "(protected)");
selecting one **blocks** that row — a "Protected — advisor override" note and a
transient "Allow this refresh" control — rather than being refused, so even an
unmatched row has a path to deliberately refresh a frozen account. A blocked row
contributes nothing to the preview/apply until released. "Allow this refresh"
releases the account for that panel instance only, and only for the row that asked
— a sibling row still cannot reach it (one releasing row per account), the release
is revoked if that row re-targets, and it never mutates the host's stored decision.
The panel also fully resets whenever the workspace navigates to a different plan
(keyed on `plan.id`), so no parsed file or release survives across plans.
`useRefreshProtection()` reads the ambient list; `RefreshProtectionValue`
(`{ protectedAccounts }`, a `readonly RefreshProtectionEntry[]`) is the context
value shape.

### Plan interchange

Use the `./plan-format` subpath (see "Published API surface") for import/
export that speaks the same envelope as the web app's backup files:

```ts
import { serializeV2Backup, parseV2Backup } from '@retiregolden/planner-ui/plan-format'
```

### Report model

Reports are data before they are documents. The stable `./report-model`
subpath exposes the edition-neutral `ReportModel`: everything a report needs
— headline metrics, household snapshot, accounts, income sources,
assumptions, modeled findings with their evidence, the year-by-year ledger,
chart series, parameter sources, disclosures, and provenance (parameter pack
years, data vintage, generation timestamp) — assembled from an
already-computed projection, independent of any DOM, theme, or layout:

```ts
import { buildReportModel, serializeReportModel } from '@retiregolden/planner-ui/report-model'

const model = buildReportModel({ plan, result, summary, startYear })
const json = serializeReportModel(model) // deterministic: same input, same bytes
```

Engine-computed dollar figures are carried as **whole nominal dollars** — the
precision every report presents, and the same whole-dollar discipline as the
repo's case-runner manifests. (Raw engine floats can differ in the last digit
across platforms' math libraries, which would make serialized models and
golden fixtures machine-dependent.)

Every block carries a stable id from `REPORT_BLOCK_IDS`; hosts building their
own renderers or packet templates should key layout off those ids and warn on
ids they don't recognize rather than dropping content. The web app's own
downloaded report is rendered from this same model
(`buildStandaloneReportHtml` assembles it internally), so a host renderer and
the standard report can never disagree about the underlying numbers. Golden
JSON fixtures for the reference cases are committed under
`src/report/goldens/` and gate changes to the serialized contract.

Boundary notes for hosts (see the decision-support posture in the upstream
repo): the `modeled-findings` block is calculation evidence attributed to the
user's selected objective — render it as modeled results, not as advice
authored by the software. The `advisor-recommendations` block is
host-authored professional content: `buildReportModel` copies it verbatim
from its input and never populates it on its own, and renderers must keep it
visibly attributed to the professional. The `disclosures` block and the
household `incompleteData` flag are caveats a rendering must keep visible:
`incompleteData` marks a plan that cannot fund spending yet (no income
sources, nothing funded), and renderers should surface it as a missing-data
warning instead of presenting depletion as a funded plan's failure — the
standard report renders this caveat, and the in-app Results page suppresses
verdict framing for such plans.

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
