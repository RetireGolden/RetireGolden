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

The Results Flow selector opens cash-flow and transfer Sankeys, a complete
accessible detail table, and a selected-year detail CSV from the engine's
`YearResult.cashFlow`; it never recomputes money math. See the
[annual cash-flow reporting contract](../../DOCS/features/year-cash-flow.md).

Source of truth: [github.com/RetireGolden/RetireGolden](https://github.com/RetireGolden/RetireGolden)
(`packages/planner-ui`). Engineering docs live in the repo's `DOCS/`.

## What ships, and the bundler contract

This package publishes its **TypeScript source** (`src/`, referenced directly
by `exports` and `types`) and requires a **Vite-class bundler** — it is not
consumable from plain Node or from bundlers that don't implement Vite
semantics. The planner tree relies on features only a Vite-style build
provides:

- `new Worker(new URL('./planner.worker.ts', import.meta.url), { type: 'module' })`
  — one worker entry serving the Monte Carlo pool, the optimizers, and
  relocation compare, dispatched by the request's `channel` tag. Bundlers give
  each worker *entry* its own build, so one entry is what keeps the shared
  engine simulation core out of the output several times over;
- `import wasmUrl from 'highs/runtime?url'` for the HiGHS LP-solver wasm;
- `import.meta.glob`, `import.meta.env.DEV`, CSS and image imports.

Compiling to plain ESM would not remove any of those requirements, so the
package doesn't pretend otherwise. Known-good consumers: Vite ≥ 8 and
electron-vite, with React 19 and react-router v8 (peers).

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
npm install @retiregolden/planner-ui react react-dom react-router
```

The host owns the router and mounts the planner under it:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
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
| `/favicon.svg` | Header brand mark | Paired with a real-text wordmark; the lockup PNGs are not the header identity | |
| `/brand/retiregolden-logo-lockup.png`, `/brand/retiregolden-logo-lockup-light.png` | Open Graph / social lockup | Not used as in-app chrome (baked-in tagline is unreadably small) |
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
  file-import capability (`importEnabled` prop +
  `ImportAvailabilityProvider` / `useImportEnabled`), the
  route groups (`plannerWorkspaceRoutes`, `plannerContentRoutes`,
  `plannerHomeRoutes`), `ReportBrandingProvider`,
  `PlannerEditionProvider` (with `usePlannerEdition` /
  `PlannerEditionConfig`), `RefreshProtectionProvider` (with
  `useRefreshProtection` / `useRefreshProtectionPending` /
  `RefreshProtectionValue`), and `installStaleChunkReloadHandler` (call once
  before render in web hosts that deploy hashed assets: when a new deploy
  removes a lazy route chunk under an open tab, the app reloads once —
  guarded against loops — instead of surfacing "Failed to fetch dynamically
  imported module"; the exported route groups carry the same one-shot
  recovery in their per-route error boundary, so hosts that skip the call
  still recover) — see "Hosting the workspace" below;
- the **`./plan-format` subpath** — `serializeV2Backup`, `parseV2Backup`,
  the envelope types, and the kind/version constants. This is the plan
  interchange format (the same file the web app's backup download produces);
  its exported names, signatures, and envelope contract only change with a
  semver-major release. The parser ignores unknown envelope fields, so hosts
  may extend the envelope with their own top-level keys and the file still
  imports everywhere. The module is browser-free (no IndexedDB/DOM) and safe
  to run in Node — e.g. an Electron main process assembling backups;
- the **`./complete-export` subpath** — the public read/verify contract for
  the `retiregolden.complete-export` planning-record container (`.rgcomplete`)
  produced by RetireGolden-Pro: the manifest types and kind/version constants,
  `parseCompleteExportManifest` (liberal on producer labels, strict on paths,
  hashes, counts, totals equations, and the manifest's own declared limits),
  the exact `manifest.sha256` sidecar grammar, and Web Crypto helpers
  (`verifyManifestText`, `verifyComponentBytes`) that fail loud when hashing
  is unavailable. There is deliberately no writer here — the producer lives in
  Pro. Browser-free; the format itself is documented in
  `DOCS/features/planning-record.md` in the repository;
- the **`./plan-tax-calculator` subpath** — `taxCalculatorFor(plan)`, the
  edition-neutral adapter that constructs the same federal, state-override,
  and local-income-tax stack used by planner projections and solvers. Hosts
  running shared engine comparisons can use it without importing React or
  planner screens;
- the **`./projection` subpath** — `projectPlan`, `currentStartYear`, and
  `ProjectionView`, the React-free deterministic projection seam. Hosts
  capturing evidence should pass an explicit `startYear`, then persist the
  returned result and summary without depending on the clock or recomputing;
- the **`./spending-solve` subpath** — `runSpendingSolve` plus
  `SpendingSolveRequest`, `SpendingSolveRunOptions`, `SpendingSolveResult`,
  `SpendingSolveEvidence`, and `SpendingSolveResponse`. It runs the exact-ledger
  sustainable-spending solve in a Vite-emitted Worker when available and falls
  back to the identical synchronous solver where `Worker` is unavailable,
  while retaining a Promise result in both environments. A host may pass an
  `AbortSignal` in the runner options to terminate active worker work; an
  already-aborted signal rejects with an `AbortError` before a worker is
  spawned;
- the **`./report-model` subpath** — the edition-neutral report data model:
  `ReportModel` and its block types, `buildReportModel`, the stable
  `REPORT_BLOCK_IDS`, `serializeReportModel` (deterministic JSON),
  `parseReportModel` (validates the envelope — kind, supported version
  1..current, field types, block structure — and returns a `ParsedReportModel`
  with structurally validated but untyped `provenance` and `blocks`
  (`Record<string, unknown>`); rejects oversized payloads; hosts re-rendering
  persisted models must handle absent or unknown blocks and warn rather than
  drop silently), and the CSV table helpers (`chartDataCsv`, `yearLedgerCsv`,
  `accountsCsv`).
  See "Report model" under "Hosting the workspace". Like `./plan-format`, its
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
- the **`./intake-refresh` subpath** — the existing-plan intake refresh
  contract (`classifyIntakeRefresh`, `defaultIntakeRefreshSelection`,
  `buildIntakeRefreshDelta`, `applyIntakeRefresh` and their types). It compares
  a mapped intake plan plus its review/provenance checklist with a current plan,
  using generated-id-independent, Unicode-aware semantic matches, and can write
  only wages, recurring-income and one-time-income amount leaves plus recent
  annual MAGI. A selected current income is bound to its stable id and
  identity-bearing fields from classification through apply, so a reorder,
  insertion, deletion, or semantic edit requires reclassification.
  It reports unmatched/ambiguous source facts, stale addressed income, excluded
  mappings, exact before-to-after deltas, duplicate collisions, and protected
  targets. It never adds/deletes records or changes Social Security, accounts,
  household/filing facts, historical MAGI, timing, growth, tax treatment, or
  strategy fields. Like the broker contract, it is browser-free and its
  exported names/signatures only change with a semver-major release;
- the **`./scenario-levers` subpath** — the browser-free fast-lever contract
  (`SCENARIO_LEVER_DEFINITIONS`, `buildScenarioLever`,
  `supportedRothBracketTargets`, `supportedRothIrmaaTiers`, and their
  request/result types). It turns retirement, spending, Social Security, Roth, allocation,
  guaranteed-income, relocation, survivor, care, and home-sale choices into
  canonical v1 engine scenario patches. Every definition declares the exact
  RFC 6901 paths it may patch, while each successful result reports the actual
  operation paths emitted. Array roots are intentionally atomic. Exported
  names and signatures only change with a semver-major release; new lever ids
  may be added in minors;
- the **`./document-text` subpath** — local PDF text extraction
  (`extractDocumentText` and its result types, plus the `MAX_DOCUMENT_BYTES` /
  `MAX_DOCUMENT_PAGES` / `MAX_PAGE_TEXT_CHARS` / `MAX_DOCUMENT_TEXT_CHARS`
  caps). Returns text per page with a 1-based page number as the citation,
  reports pages that have no text layer as `imageOnly` (the scanned page that
  would need OCR), and fails as a result union rather than throwing, so a caller
  may hand it arbitrary bytes, including a buffer or view a transfer already
  detached. The reasons say whose problem it is: `encrypted`, `corrupt`,
  `not_pdf`, `too_large`, `too_many_pages` and `unreadable_input` are about the
  document or the call, while `extraction_failed`, `pdfjs_unavailable`,
  `pdfjs_worker_unavailable` and `pdfjs_incompatible` are about this process or
  the host's pdfjs build and must never be shown to a user as a problem with
  their file. Treat an unrecognized reason as "could not read this document" —
  new reasons may be added in a minor. Processing is
  local: the document is passed as bytes and pdfjs is configured with no cmap or
  standard-font URL to fetch. **This subpath alone needs the optional
  `pdfjs-dist` peer**, and a browser host passes its own copy in as
  `options.pdfjs` rather than letting the module import one (see "Optional PDF
  support" below); everything else in the package works without it. This is a spike — its numbers have not yet
  justified promoting page citations into the `./import-provenance`
  `SourceLocator` union, and it is not wired into the free import wizard,
  which still takes no PDF upload;
- the **`./migration-source` subpath** — migration-source identification
  (`identifyMigrationDocument` over extracted PDF pages, `identifyMigrationExport`
  over a decoded text/JSON export, the `MIGRATION_ADAPTERS` registry, and
  `buildMigrationReview`, which emits the unmapped report as ordinary
  `ImportReviewItem`s). It says WHICH incumbent tool a file came from and
  publishes what can and cannot be brought over; it maps no fields itself.
  ProjectionLab is identified structurally and mapped by the existing
  ProjectionLab import; RightCapital, eMoney and MoneyGuide are identified only
  — there is no substantiated export format for them, so nothing is mapped and
  the limitations are published instead of guessed around. Name matching is
  word-bounded and every match carries its verbatim surrounding text; a match
  found in a PDF's extracted pages also cites its page number, while one found
  in a CSV or JSON export cites the export text or a JSON path, there being no
  page to cite. A file naming more than one tool is reported ambiguous rather
  than guessed at. Browser-free and safe to run in Node; exported names and
  signatures only change with a semver-major release, though new vendors may be
  added in minors;
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

### Host-controlled file-import availability

Pass `importEnabled={false}` to `<PlannerApp/>` to remove every file-backed
import input: the new-plan wizard, existing-plan broker CSV refresh, mySSA XML
earnings import, and FedInvest CSV fallback. Manual entry, existing plans,
exports, and RetireGolden backup restore stay available. The prop defaults to
`true`, preserving existing hosts.

Hosts composing route groups directly can wrap them instead:

```tsx
import { ImportAvailabilityProvider } from '@retiregolden/planner-ui'

<ImportAvailabilityProvider enabled={fileImportAllowed}>
  {/* planner route groups */}
</ImportAvailabilityProvider>
```

`ImportAvailabilityContext` also defaults to `true`, so omitting both the prop
and provider preserves normal import behavior. This is a generic rendering
capability; the host decides how it obtains the boolean and explains why it is
off.

### Route groups

The route table is exported as three react-router v8 `RouteObject[]` arrays
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
import { useRoutes } from 'react-router'
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
`useRefreshProtection()` reads the ambient list, `useRefreshProtectionPending()`
reads the loading flag, and `RefreshProtectionValue`
(`{ protectedAccounts: readonly RefreshProtectionEntry[]; pending?: boolean }`) is
the context value shape. `pending` is **optional** on that interface, so a host
that constructs its own context value — including one written before the flag
existed — keeps compiling; an absent flag reads as `false`.

**Hosts that resolve protection asynchronously: pass `pending`.** An empty
`protectedAccounts` means "nothing is protected" — it cannot express "not known
yet" — so a host reading its overrides from a store would otherwise leave a window
in which a broker refresh can overwrite an advisor-frozen account. Pass
`pending` while the answer is outstanding and the panel refuses **both** the
file chooser and Apply, with a visible explanation naming that cause (distinct
from the duplicate-collision block). The two gates answer different concerns:
Apply is refused because applying against an unknown protected set is unsafe,
while the file chooser is refused because a preview built during that window
would draw every row as unprotected and then rewrite itself when the real set
arrived. The preview is never unsafe — the panel recomputes every
protection-derived value from the live context on each render — only untruthful,
and the panel should not make a claim it is about to retract. If `pending` goes
back to `true` after a file was parsed, the panel clears that parse for the same
reason. `pending` **defaults to `false`**,
so a host passing only `protectedAccounts` is unchanged, and — since the public
web app mounts no provider at all — the no-provider path is never gated.

```tsx
<RefreshProtectionProvider
  protectedAccounts={overrides ?? []}
  pending={overrides === null} // still loading — hold the refresh
>
  {/* plannerWorkspaceRoutes */}
</RefreshProtectionProvider>
```

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
import {
  buildReportModel,
  parseReportModel,
  serializeReportModel,
  REPORT_MODEL_VERSION,
  type ReportModel,
} from '@retiregolden/planner-ui/report-model'

const model = buildReportModel({ plan, result, summary, startYear })
const json = serializeReportModel(model) // deterministic: same input, same bytes
const parsed = parseReportModel(json)
if (!parsed.ok) throw new Error(parsed.message)
// Hosts that wrote this JSON with serializeReportModel at the current version
// may assert to ReportModel after checking parsed.model.version === REPORT_MODEL_VERSION;
// otherwise narrow each block field-by-field before rendering.
const persistedModel = parsed.model
```

`parseReportModel` validates the envelope (kind, supported version 1..current,
field types, block structure) and returns a `ParsedReportModel` whose
`provenance` and `blocks` are structurally validated but untyped
(`Record<string, unknown>`). It rejects malformed, oversized, or newer
envelopes. Hosts re-rendering persisted models must handle absent or unknown
blocks and warn rather than drop silently.

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

### Optional PDF support

`pdfjs-dist` is an **optional peer dependency**: it is declared in
`peerDependencies` with `peerDependenciesMeta.optional`, so npm never
installs it for you and never warns when it is absent. Only the
`./document-text` subpath uses it, and only through a dynamic `import()`
inside `extractDocumentText`, so a host that does not import that subpath
never evaluates the module, never resolves the peer, and ships no pdfjs code.

A host that *does* want PDF text extraction installs it alongside the package:

```sh
npm install @retiregolden/planner-ui pdfjs-dist
```

`pdfjs-dist@6` declares `node >=22.13.0`, which this package's own `node >=24`
already satisfies, so there is no version split to reason about. A host on an
older Node that installs `pdfjs-dist` anyway sees npm's `EBADENGINE` warning, and
`extractDocumentText` reports `pdfjs_unavailable` or `pdfjs_incompatible` rather
than failing obscurely.

**In a browser bundle, pass pdfjs in.** This is the important half, and it is
not optional. `extractDocumentText` can *import* pdfjs itself, but only through
the bare specifier `pdfjs-dist/legacy/build/pdf.mjs` — and that specifier is
deliberately opaque to your bundler (so your build does not fail when the
optional peer is absent), which means it survives into the bundle as a bare npm
package name. No browser can resolve one at run time. A bundled page that lets
this module do its own importing therefore gets `pdfjs_unavailable` on the first
extraction *even though pdfjs is installed*. Your own `import()` of the same
module **is** resolved and chunked by your bundler, so your app is the only
party that can produce the module — hand it over as `options.pdfjs`:

```ts
import { extractDocumentText } from '@retiregolden/planner-ui/document-text'

// Your bundler resolves and chunks both of these; this module never could.
const [pdfjs] = await Promise.all([
  import('pdfjs-dist/legacy/build/pdf.mjs'),
  // Side effect only: sets globalThis.pdfjsWorker, which pdfjs consults before
  // it would construct a Worker — so no separate worker asset has to be hosted.
  // Omit this and pdfjs will look for one.
  import('pdfjs-dist/legacy/build/pdf.worker.mjs'),
])

const result = await extractDocumentText(await file.arrayBuffer(), { pdfjs })
if (!result.ok) {
  showMessage(result.message) // encrypted / corrupt / not_pdf / too_large / …
} else {
  for (const page of result.pages) {
    // page.page is the citation; page.imageOnly means "scanned, needs OCR"
  }
}
```

Load it once and reuse it — the module is stateless here, and passing it per
call costs nothing. Anything may be passed: a different pdfjs major, a
re-export, a wrapper. The module inspects the object before it parses a byte of
the document, so a build it cannot drive is `pdfjs_incompatible` — a statement
about the host's pdfjs, never about the user's file.

**In Node, SSR, or an Electron main process, omit it.** There a bare specifier
resolves at run time, so zero configuration is the shorter path and the option
can be left off entirely:

```ts
const result = await extractDocumentText(await readFile(path))
```

With no `options.pdfjs` and no resolvable peer, the call resolves to
`{ ok: false, reason: 'pdfjs_unavailable' }` rather than throwing — its message
names both remedies — so a host can degrade to manual entry. Extraction runs on
the calling thread, and the exported caps bound that work.

**How well does it read a document?** Measured, not asserted. An accuracy
benchmark runs a hand-built corpus of synthetic statements, plan printouts,
1040s, and scanned/encrypted/corrupt documents through the extractor and
reports precision and recall **per field**, plus page-citation accuracy:

```sh
pnpm --filter @retiregolden/planner-ui benchmark:documents
```

Short version for a host deciding whether to offer PDF import: all 30 planted
values were present in the extracted text, and no value was attributed to a page
it is not printed on. The detectors then selected 28 of them — the 93.3% recall
figure is theirs, not the extractor's, and both misses are values whose
characters extracted perfectly and whose *selection* failed. That is the whole
finding: field-selection precision
is 17–75%, so a naive reader proposes 35 wrong values for every 28 right ones.
Extraction is not the bottleneck; picking the right value out of a page that
also contains a fee schedule and a copyright year is, and a money scanner
cannot tell an account balance from a tax-form line at all. Pages with no text
layer are flagged `imageOnly` — 3 planted, 3 detected, no false positives in
either direction, and a blank page is correctly not called scanned — so a UI can
route the user to manual entry instead of showing an empty result. **What the
benchmark does not measure is OCR**: its scanned pages paint a featureless
raster and carry no glyphs, so how much of a real scan is recoverable is
unknown, and a synthetic fixture cannot answer it. The corpus is also
generator-clean, so every number is an upper bound on a real document. Full
tables, caveats, what the citation number does and does not prove, and the
re-derived OCR recommendation are in
[DOCS/features/document-parsing-spike.md](https://github.com/RetireGolden/RetireGolden/blob/main/DOCS/features/document-parsing-spike.md).

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
