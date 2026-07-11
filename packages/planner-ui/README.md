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

### Storage

Plans persist in the browser profile via IndexedDB (`idb`) with localStorage
for small preferences, exactly as on retiregolden.app. Hosts that need a
different persistence story should treat that as an upstream conversation,
not a fork point.

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
