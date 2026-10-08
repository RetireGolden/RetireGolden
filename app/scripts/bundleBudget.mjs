/**
 * Bundle budget: the limits, the parsers, and the evaluation — all pure.
 *
 * Kept free of filesystem access so it can be exercised against fixtures
 * (./bundleBudget.test.mjs). `check-bundle-budget.mjs` is the thin CLI that
 * reads `dist/` and feeds this.
 *
 * Rationale, the measured numbers behind each limit, and what to do when one
 * trips are in DOCS/operations/bundle-budget.md.
 *
 * Sizes are KiB (1024 bytes), matching workbox's own precache report. Vite's
 * build log prints kB (1000 bytes), so its numbers read ~2.4% larger.
 */

/**
 * Per-chunk-class limits, in KiB. Each is the size measured when the budget
 * landed plus headroom, so ordinary feature work fits and a structural
 * regression does not.
 *
 * `match` is tested against the emitted file name. A chunk rolldown names
 * differently after a refactor stops matching its entry and falls through to
 * DEFAULT_CHUNK_KIB — which is the intended behavior: a chunk that changed
 * identity should be looked at, not silently inherit a large allowance.
 */
export const CHUNK_BUDGETS = [
  {
    label: 'planner Web Worker',
    match: /^planner\.worker-[^/]*\.js$/,
    // Raised 1000 -> 1150 for the authorized 60-item calculation audit: measured
    // 1058.4 KiB (903 KiB baseline). Parallel growth with useProjection (+162 KiB)
    // is engine projection/tax runtime in the worker graph, not a second worker
    // entry — the exactCount guard still passes at one chunk.
    maxKiB: 1150,
    // The load-bearing one. Bundlers build every worker ENTRY separately, so
    // they cannot share a chunk: a second worker entry means a second copy of
    // the ~740 KiB engine simulation core in dist/ and in the precache. That
    // is exactly how this app came to ship four of them.
    exactCount: 1,
  },
  {
    label: 'engine simulation core (useProjection)',
    match: /^useProjection-[^/]*\.js$/,
    // Raised 640 -> 700 when the funding/year-close (27.9 KiB) and owned-IRA
    // settlement (3.4 KiB) coordinators folded back into this chunk: their
    // explicit-only chunks sat in a static import cycle with it, which is
    // the hazard staticImportCycles() below now fails the build on. Same
    // bytes, now counted where they execute -- but not the same headroom:
    // 634.6 KiB under 640 was 0.8% slack, an unusually tight row; 665.2 KiB
    // under 700 is 5.0%, the low end of the 5-21% band the per-class chunk
    // rows are documented to sit in (DOCS/operations/bundle-budget.md).
    // That is a row set the way the others are, not allowance to spend:
    // growth here still has to be justified.
    // Raised 700 -> 900 for the authorized 60-item calculation audit: measured
    // 827.0 KiB (665 KiB baseline). Federal params, state tax packs, rules
    // records, and projection settlement paths landed in the simulation core.
    maxKiB: 900,
  },
  {
    label: 'Learning Center registry',
    // `articleIndex` is the metadata itself and `learningRegistry` is the
    // selector layer that statically imports it; today they land in one chunk
    // named for the registry, but a chunking change could emit either name.
    // Matching both keeps the metadata under this limit instead of letting it
    // slide into the looser per-chunk default under a new name.
    match: /^(learningRegistry|articleIndex)-[^/]*\.js$/,
    // Metadata only, since article bodies became per-article dynamic imports.
    // ~0.9 KiB per article, so this is roughly 25 more articles of room; when
    // it trips, raise it, do not put prose back into the index.
    maxKiB: 150,
  },
  {
    label: 'chart vendor (Recharts)',
    match: /^CartesianChart-[^/]*\.js$/,
    maxKiB: 380,
  },
  {
    label: 'plan route group (PlanRoutes)',
    match: /^PlanRoutes-[^/]*\.js$/,
    // Measured 267.1 KiB under vite 8.2.2 / rolldown 1.2.6, up from 220.0 KiB
    // under rolldown 1.2.4. That growth is redistribution, not payload: the same
    // build consolidated 206 chunks into 189, while all JS fell from 4323.4 to
    // 4318.3 KiB and the landing critical path stayed flat (620.5 -> 619.8 KiB).
    // The chunk had been falling through to DEFAULT_CHUNK_KIB; naming it here
    // keeps it measured on its own terms rather than loosening that default for
    // every unclassified chunk. Headroom is deliberately thin — this is a route
    // group, and it should stay route-sized.
    maxKiB: 300,
    // One chunk, like the worker: the route group is a single lazy boundary, so
    // a second PlanRoutes chunk would mean it was split or duplicated.
    exactCount: 1,
  },
]

/**
 * The app entry is identified by what index.html actually loads, not by a
 * name pattern: `^index-<hash>\.js$` would also match a dependency that
 * happens to have an `index.js` internal entry, and then the exact-count rule
 * would fail every build on a chunk that was never the entry.
 */
// Raised 300 -> 420 for the authorized 60-item calculation audit: measured
// 384.4 KiB (248 KiB baseline). The app entry's static graph now carries more
// of the params/state/rules surface the shell initializes before lazy routes.
export const ENTRY_KIB = 420
/** Every other JS chunk: route chunks, page chunks, shared vendor slices. */
export const DEFAULT_CHUNK_KIB = 260
/**
 * All emitted JS together — catches "many new chunks" as well as one fat one.
 *
 * Raised 4400 -> 4800 after Azure `build` on unrelated PRs started failing
 * every time: measured 4431.7 KiB against 4400 (PR 707 head `03bb93cc`,
 * calc-audit test-only change). The previous 44 KiB of slack (4356 -> 4400)
 * was a peek-over, not headroom. 4800 is a round hundred ~370 KiB above the
 * current measured size so ordinary feature PRs stop tripping this row.
 *
 * Raised again 4800 -> 5100 for the authorized 60-item calculation audit:
 * measured 4824.2 KiB (4431.7 KiB baseline). The delta tracks the worker and
 * useProjection engine growth plus the entry params surface, not new chunks
 * or duplicate worker entries.
 */
export const TOTAL_JS_KIB = 5100
/** One stylesheet, and all of them. */
export const MAX_CSS_KIB = 64
export const TOTAL_CSS_KIB = 80
/**
 * The landing critical path: the entry script plus everything index.html
 * modulepreloads, which is what a cold first visit blocks on before anything
 * renders. The most user-visible number here, and the one this budget mainly
 * holds the line on. Splitting article bodies out of `learningRegistry` took
 * it from 1011.7 to 596.0 KiB; the limit was 700 so the entry and the registry
 * could each grow into their own budgets and still fit.
 *
 * Raised 700 -> 800 for the npm-minor-patch bump (vite 8.2.2 -> 8.3.0 /
 * rolldown 1.2.6 -> 1.2.8 / react 19.2.8 -> 19.3.0). Same source as Azure
 * `build` on 33e7d546 (landing 684.9 / 700, entry 384.9 / 420, PlanRoutes
 * 291.7 / 300). This bump measured landing 716.8 KiB and entry 413.1 KiB;
 * PlanRoutes stayed 291.7. The overshoot is the entry graph (react 19.3
 * ViewTransition / Fragment-refs plus bundler redistribution), not a new
 * modulepreload or a duplicate worker. 800 is a round hundred ~83 KiB above
 * the measured size so the next ordinary feature does not peek over the way
 * 684.9 sat 15 KiB under 700.
 */
export const LANDING_PATH_KIB = 800
/**
 * What the service worker precaches, i.e. what an install costs and what an
 * offline visit is guaranteed. The HiGHS wasm (~3 MB) and the Learn
 * illustrations (~5 MB) are runtime-cached instead and are not counted here —
 * see the workbox config in vite.config.ts.
 *
 * Raised 4500 -> 4550 for the `simulatePlan` annual-phase extraction (see
 * DOCS/operations/bundle-budget.md). Raised again 4550 -> 4900 after Azure
 * `build` on unrelated PRs started failing every time: measured 4579.6 KiB
 * against 4550 (PR 707 head `03bb93cc`, calc-audit test-only change). The
 * previous 46 KiB of slack was a peek-over. 4900 is a round hundred ~320 KiB
 * above the current measured size so ordinary feature PRs stop tripping
 * this row. Same gate, same parser; only the limit moved.
 *
 * Raised again 4900 -> 5250 for the authorized 60-item calculation audit:
 * measured 4971.8 KiB (4579.6 KiB baseline). Precache entry count stayed at
 * 200; the overshoot is the same engine bytes the per-chunk rows above count.
 */
export const PRECACHE_KIB = 5250

export const kib = (bytes) => bytes / 1024
export const fmt = (n) => `${n.toFixed(1)} KiB`

/**
 * The entry script and every module index.html preloads.
 *
 * Returns `{ entry, names }`, or `null` when the document does not name a
 * module entry script at all. Callers must treat `null` as a failure, never
 * as "nothing to weigh" — the whole point of the row is that it cannot be
 * skipped silently.
 */
export function parseLandingScripts(html) {
  const entry = html.match(/<script[^>]+type="module"[^>]*\ssrc="([^"]+)"/)?.[1]
  if (!entry) return null
  const names = new Set()
  const basename = (href) => href.split('/').pop()
  names.add(basename(entry))
  for (const m of html.matchAll(/<link[^>]+rel="modulepreload"[^>]*\shref="([^"]+)"/g)) {
    names.add(basename(m[1]))
  }
  return { entry: basename(entry), names: [...names] }
}

/**
 * Basename of a static import specifier, with a query or hash stripped.
 * `./chunk.js`, `../chunk.js`, `/assets/chunk.js`, `./nested/chunk.js`,
 * and `./chunk.js?v=1` all become `chunk.js`.
 */
function staticImportBasename(spec) {
  const path = spec.split(/[?#]/, 1)[0]
  const slash = path.lastIndexOf('/')
  return slash === -1 ? path : path.slice(slash + 1)
}

/**
 * Static import specifiers in a Rolldown ES chunk: `from "…"` and
 * side-effect `import "…"`. Dynamic `import()` is not scanned — it does
 * not create the module-init cycle that TDZ-crashed production.
 *
 * Returns each specifier's basename so a cycle is visible whether the
 * chunk writes a same-directory relative, `../`, `/assets/…`, a nested
 * path, or a query suffix. Matching only `./` relatives would fail open
 * on those forms (#672).
 */
export function parseStaticRelativeImports(source) {
  const named = [...source.matchAll(/\bfrom\s*["']([^"']+)["']/g)].map((m) => m[1])
  const sideEffect = [...source.matchAll(/\bimport\s*["']([^"']+)["']/g)].map((m) => m[1])
  return [...named, ...sideEffect].map(staticImportBasename)
}

const workerEntryBudget = CHUNK_BUDGETS.find((budget) => budget.label === 'planner Web Worker')
if (workerEntryBudget === undefined) {
  throw new Error('bundleBudget.mjs: missing CHUNK_BUDGETS row labeled "planner Web Worker"')
}
const WORKER_ENTRY_NAME = workerEntryBudget.match

/**
 * Chunks in the worker entry's static closure, other than the entry, that
 * statically import it.
 *
 * The static closure is every chunk the entry reaches through static imports
 * (`from "…"` and side-effect `import "…"`), transitively. A chunk there that
 * imports the entry back is #672: the module graph evaluates it as part of
 * loading the entry, before the entry's own body has run, so the binding it
 * imports is still in its temporal dead zone.
 *
 * A chunk the entry reaches only through `import()` — the Optimize channel's
 * solver, loaded on that channel's first request — is outside the closure and
 * may import the entry. It is fetched and evaluated after the entry module has
 * finished evaluating, at the dispatch that asks for it, so every binding it
 * imports from the entry is initialized. The URL it imports is the one the
 * worker was started from, so it binds the already-evaluated entry rather
 * than a second copy. And no static cycle results:
 * `staticImportCycles` below still checks the whole emitted graph.
 *
 * `chunks` is `{ name, source }[]`. Returns `{ workerNames, importers }`.
 * `importers: null` means the worker entry itself was missing — fail closed;
 * the single-worker budget already requires exactly one entry, and a cycle
 * check with no entry has not actually checked the graph.
 */
export function workerEntryImporters(chunks) {
  const workerNames = chunks.filter((chunk) => WORKER_ENTRY_NAME.test(chunk.name)).map((chunk) => chunk.name)
  if (workerNames.length === 0) return { workerNames, importers: null }
  const workerSet = new Set(workerNames)
  const staticImports = new Map(chunks.map((chunk) => [chunk.name, parseStaticRelativeImports(chunk.source)]))
  const closure = new Set(workerNames)
  const pending = [...workerNames]
  while (pending.length > 0) {
    for (const target of staticImports.get(pending.pop()) ?? []) {
      if (!closure.has(target) && staticImports.has(target)) {
        closure.add(target)
        pending.push(target)
      }
    }
  }
  const importers = []
  for (const chunk of chunks) {
    if (workerSet.has(chunk.name) || !closure.has(chunk.name)) continue
    if (staticImports.get(chunk.name).some((name) => workerSet.has(name))) importers.push(chunk.name)
  }
  return { workerNames, importers }
}

/**
 * Every static import cycle among the emitted chunks, as strongly connected
 * components of the chunk graph (Tarjan), each sorted by name. A chunk that
 * imports itself is a one-member cycle.
 *
 * `chunks` is `{ name, source }[]`. Specifiers that do not name another
 * emitted chunk (bare package ids, absolute URLs) are ignored: they cannot
 * take part in a cycle inside `dist/assets`.
 *
 * Why the whole graph and not just the worker entry: a cycle does not have
 * to crash. When an explicit-only coordinator group put
 * `annualProjectionFundingClose` in a cycle with the `useProjection` core,
 * Rolldown emitted the funding phase's `const EPSILON = <imported constant>`
 * as `var u=a`, evaluated before the core chunk's body had run. `u` was
 * `undefined`, every `<= undefined` / `> undefined` in the phase read
 * false, and production shipped spurious "could not reconcile" notes,
 * gross ACA premium, and a Results page that never reported a depletion
 * year — while every unit test and dev-server e2e stayed green, because
 * neither loads the production chunk graph. The worker graph, with the same
 * shape, threw a TDZ error instead (#672). Structure, not luck, decides
 * which: so no cycle at all.
 */
export function staticImportCycles(chunks) {
  const names = new Set(chunks.map((chunk) => chunk.name))
  const edges = new Map(
    chunks.map((chunk) => [
      chunk.name,
      parseStaticRelativeImports(chunk.source).filter((target) => names.has(target)),
    ]),
  )

  let counter = 0
  const index = new Map()
  const lowLink = new Map()
  const onStack = new Set()
  const stack = []
  const cycles = []

  const visit = (node) => {
    index.set(node, counter)
    lowLink.set(node, counter)
    counter += 1
    stack.push(node)
    onStack.add(node)
    for (const target of edges.get(node)) {
      if (!index.has(target)) {
        visit(target)
        lowLink.set(node, Math.min(lowLink.get(node), lowLink.get(target)))
      } else if (onStack.has(target)) {
        lowLink.set(node, Math.min(lowLink.get(node), index.get(target)))
      }
    }
    if (lowLink.get(node) !== index.get(node)) return
    const component = []
    let member
    do {
      member = stack.pop()
      onStack.delete(member)
      component.push(member)
    } while (member !== node)
    if (component.length > 1 || edges.get(node).includes(node)) {
      cycles.push(component.sort())
    }
  }

  for (const chunk of chunks) {
    if (!index.has(chunk.name)) visit(chunk.name)
  }
  return cycles.sort((a, b) => a[0].localeCompare(b[0]))
}

/**
 * Chunks whose source names a test file (`*.test.ts` / `*.test.tsx`), sorted.
 *
 * Nothing the browser runs needs a test file's path. "How RetireGolden is
 * tested" once shipped ~960 of them (58 KiB) as `import.meta.glob` keys just
 * to count them; its counts are now computed in app/vite.config.ts and
 * injected, and this keeps any path from coming back.
 *
 * `chunks` is `{ name, source }[]`.
 */
export function chunksNamingTestFiles(chunks) {
  return chunks
    .filter((chunk) => /\.test\.tsx?/.test(chunk.source))
    .map((chunk) => chunk.name)
    .sort()
}

const planRoutesBudget = CHUNK_BUDGETS.find((budget) => budget.label === 'plan route group (PlanRoutes)')
if (planRoutesBudget === undefined) {
  throw new Error('bundleBudget.mjs: missing CHUNK_BUDGETS row labeled "plan route group (PlanRoutes)"')
}
const useProjectionBudget = CHUNK_BUDGETS.find((budget) => budget.label === 'engine simulation core (useProjection)')
if (useProjectionBudget === undefined) {
  throw new Error('bundleBudget.mjs: missing CHUNK_BUDGETS row labeled "engine simulation core (useProjection)"')
}

/**
 * Source modules (repo-relative paths) that must not render code into a
 * chunk class. The check reads the build's own module-to-chunk record
 * (`chunkModuleMap` in app/vite.config.ts), so it catches a module pulled in
 * through any chain of imports, which a grep of import statements would not.
 */
export const CHUNK_MODULE_EXCLUSIONS = [
  {
    label: planRoutesBudget.label,
    match: planRoutesBudget.match,
    modules: ['packages/planner-ui/src/report/reportModel.ts'],
    // One string imported from reportModel by the retirement-account editor
    // once put the whole report model (about 17 KiB) in PlanRoutes, which
    // every plan visit loads. Only the Results, Report and Optimize pages
    // build a report, and they load it from their own chunk.
    why:
      'only the Results, Report and Optimize pages build a report; import what a plan page needs from a ' +
      'smaller module (the Roth five-year note lives in planner/professionalConfirmation.ts for this reason)',
  },
  {
    label: useProjectionBudget.label,
    match: useProjectionBudget.match,
    modules: [
      'packages/engine/src/actions/retirementActionManualReview.ts',
      'packages/engine/src/actions/retirementActionCandidateIdentityAllocator.ts',
      'packages/engine/src/actions/ownedNonRothIraAnnualFilingSourceResolver.ts',
    ],
    // Only the retirement-action editor runs these three (28.7 KiB together).
    // app/vite.config.ts marks them side-effect-free so they load with its
    // lazy chunk instead of with the simulation core every plan visit loads
    // (D-BUNDLE-HEADROOM).
    why:
      'only the retirement-action editor runs it; keep it in EDITOR_ONLY_ENGINE_ACTION_MODULE_NAMES in ' +
      'app/vite.config.ts and import it from the editor, not from a module the projection loads',
  },
]

/**
 * Check CHUNK_MODULE_EXCLUSIONS against the build's module map.
 *
 * `jsNames`   every JS file name in dist/assets.
 * `moduleMap` `{ chunks: { [chunkFileName]: string[] } }` as the build wrote
 *             it, or `null` when it could not be read.
 *
 * Returns `{ failures, checked }`, where `checked` lists `{ label, name,
 * modules }` for each chunk that was measured and found clean. Fails closed
 * like the rest of this file: a missing map, a map from a different build
 * (it names a chunk dist/assets does not hold), or a matching chunk the map
 * does not describe are all failures, never a silent pass.
 */
export function chunkModuleExclusionFailures(jsNames, moduleMap, exclusions = CHUNK_MODULE_EXCLUSIONS) {
  const failures = []
  const checked = []
  const mapped = moduleMap?.chunks
  if (mapped === null || typeof mapped !== 'object' || Object.keys(mapped).length === 0) {
    failures.push(
      "could not read the build's chunk module map (written by vite build, see chunkModuleMap in " +
        'app/vite.config.ts), so module membership is unmeasured; run a build first',
    )
    return { failures, checked }
  }
  const onDisk = new Set(jsNames)
  const stale = Object.keys(mapped).filter((name) => !onDisk.has(name))
  if (stale.length > 0) {
    failures.push(
      `the chunk module map names ${stale.length} chunk(s) not in dist/assets (${stale.slice(0, 3).join(', ')}` +
        `${stale.length > 3 ? ', …' : ''}), so it describes a different build; rebuild`,
    )
    return { failures, checked }
  }
  for (const exclusion of exclusions) {
    const names = jsNames.filter((name) => exclusion.match.test(name))
    if (names.length === 0) {
      failures.push(`${exclusion.label}: no chunk matched, so its module exclusions are unmeasured`)
      continue
    }
    for (const name of names) {
      const modules = mapped[name]
      if (!Array.isArray(modules)) {
        failures.push(`${exclusion.label}: ${name} is not in the chunk module map, so its modules are unmeasured`)
        continue
      }
      const present = exclusion.modules.filter((module) => modules.includes(module))
      for (const module of present) {
        failures.push(`${exclusion.label} - ${name} contains ${module}: ${exclusion.why}`)
      }
      if (present.length === 0) checked.push({ label: exclusion.label, name, modules: exclusion.modules })
    }
  }
  return { failures, checked }
}

/**
 * The URLs workbox lists in the generated service worker's precache manifest.
 *
 * Returns `null` when the `precacheAndRoute([...])` call cannot be found —
 * a workbox output change, which must fail the gate rather than quietly drop
 * the precache row. An empty array is likewise a caller-side failure.
 */
export function parsePrecacheUrls(swSource) {
  const start = swSource.indexOf('precacheAndRoute([')
  if (start === -1) return null
  const end = swSource.indexOf('])', start)
  const manifest = swSource.slice(start, end === -1 ? undefined : end)
  return [...manifest.matchAll(/url:\s*["']([^"']+)["']/g)].map((m) => decodeURIComponent(m[1]))
}

/**
 * Evaluate one build against the budget.
 *
 * `assets`   `{ name, bytes }[]` — everything in dist/assets.
 * `landing`  `{ entry, names, sizes }` from parseLandingScripts plus a
 *            name→bytes map (a missing file is `null`), or `null` when
 *            index.html was unreadable or named no entry.
 * `precache` `{ urls, sizes }` from parsePrecacheUrls plus a url→bytes map,
 *            or `null` when sw.js was unreadable or its manifest unparsable.
 *
 * Every "we could not measure this" path produces a failure. A budget that
 * reports OK because its parser found nothing is worse than no budget: it is
 * the same green build with a false assurance attached.
 */
export function evaluateBudget({ assets, landing, precache }) {
  const js = assets.filter((a) => a.name.endsWith('.js'))
  const css = assets.filter((a) => a.name.endsWith('.css'))
  const failures = []
  const rows = []

  const claimed = new Set()
  for (const budget of CHUNK_BUDGETS) {
    const matched = js.filter((a) => budget.match.test(a.name))
    for (const a of matched) claimed.add(a.name)
    if (budget.exactCount !== undefined && matched.length !== budget.exactCount) {
      failures.push(
        `${budget.label}: expected exactly ${budget.exactCount} chunk(s), found ${matched.length}` +
          (matched.length ? ` (${matched.map((a) => a.name).join(', ')})` : ''),
      )
    }
    for (const a of matched) {
      const size = kib(a.bytes)
      rows.push({ label: budget.label, name: a.name, size, max: budget.maxKiB })
      if (size > budget.maxKiB) {
        failures.push(`${budget.label} - ${a.name} is ${fmt(size)}, over its ${fmt(budget.maxKiB)} budget`)
      }
    }
  }

  // The app entry, taken from index.html rather than matched by name.
  if (landing?.entry) {
    const entryAsset = js.find((a) => a.name === landing.entry)
    if (!entryAsset) {
      failures.push(`index.html loads ${landing.entry}, which is not in dist/assets`)
    } else {
      claimed.add(entryAsset.name)
      const size = kib(entryAsset.bytes)
      rows.push({ label: 'app entry', name: entryAsset.name, size, max: ENTRY_KIB })
      if (size > ENTRY_KIB) {
        failures.push(`app entry - ${entryAsset.name} is ${fmt(size)}, over its ${fmt(ENTRY_KIB)} budget`)
      }
    }
  }

  for (const a of js) {
    if (claimed.has(a.name)) continue
    const size = kib(a.bytes)
    if (size > DEFAULT_CHUNK_KIB) {
      rows.push({ label: 'other JS chunk', name: a.name, size, max: DEFAULT_CHUNK_KIB })
      failures.push(`${a.name} is ${fmt(size)}, over the ${fmt(DEFAULT_CHUNK_KIB)} per-chunk budget`)
    }
  }

  const totalJs = kib(js.reduce((sum, a) => sum + a.bytes, 0))
  rows.push({ label: `all JS (${js.length} chunks)`, name: '', size: totalJs, max: TOTAL_JS_KIB })
  if (totalJs > TOTAL_JS_KIB) failures.push(`all JS is ${fmt(totalJs)}, over the ${fmt(TOTAL_JS_KIB)} total budget`)

  for (const a of css) {
    const size = kib(a.bytes)
    if (size > MAX_CSS_KIB) failures.push(`${a.name} is ${fmt(size)}, over the ${fmt(MAX_CSS_KIB)} stylesheet budget`)
  }
  const totalCss = kib(css.reduce((sum, a) => sum + a.bytes, 0))
  rows.push({ label: `all CSS (${css.length} files)`, name: '', size: totalCss, max: TOTAL_CSS_KIB })
  if (totalCss > TOTAL_CSS_KIB) {
    failures.push(`all CSS is ${fmt(totalCss)}, over the ${fmt(TOTAL_CSS_KIB)} total budget`)
  }

  // Landing critical path. Fails closed: unreadable, unparsable, or referring
  // to files that are not on disk all mean the row cannot be trusted.
  if (!landing) {
    failures.push(
      'could not read a module entry script out of dist/index.html, so the landing critical path is unmeasured',
    )
  } else {
    const missing = landing.names.filter((n) => landing.sizes[n] == null)
    if (missing.length > 0) {
      failures.push(`index.html references ${missing.join(', ')}, which are not in dist/assets`)
    }
    const total = kib(landing.names.reduce((sum, n) => sum + (landing.sizes[n] ?? 0), 0))
    rows.push({
      label: `landing critical path (${landing.names.length} files)`,
      name: '',
      size: total,
      max: LANDING_PATH_KIB,
    })
    if (total > LANDING_PATH_KIB) {
      failures.push(`the landing critical path is ${fmt(total)}, over the ${fmt(LANDING_PATH_KIB)} budget`)
    }
  }

  // PWA precache. Same discipline — an empty or unparsable manifest is a
  // failure, not a 0.0 KiB row that sails under the limit.
  if (!precache) {
    failures.push(
      'could not read a precacheAndRoute([...]) manifest out of dist/sw.js, so the PWA precache is unmeasured',
    )
  } else if (precache.urls.length === 0) {
    failures.push('the precache manifest in dist/sw.js lists no entries, so the PWA precache is unmeasured')
  } else {
    const missing = precache.urls.filter((u) => precache.sizes[u] == null)
    if (missing.length > 0) {
      failures.push(
        `the precache manifest lists ${missing.length} file(s) not on disk (${missing.slice(0, 3).join(', ')}` +
          `${missing.length > 3 ? ', …' : ''}), so its total is understated`,
      )
    }
    // A URL listed twice is fetched once but summed twice, so the row would
    // overstate the install. vite-plugin-pwa did exactly that for six icons
    // (includeAssets / includeManifestIcons on top of globPatterns).
    const duplicates = precache.urls.filter((u, i) => precache.urls.indexOf(u) !== i)
    if (duplicates.length > 0) {
      failures.push(
        `the precache manifest lists ${[...new Set(duplicates)].join(', ')} more than once, so its total ` +
          'counts them twice (list each file once: see includeAssets in vite.config.ts)',
      )
    }
    const total = kib(precache.urls.reduce((sum, u) => sum + (precache.sizes[u] ?? 0), 0))
    rows.push({
      label: `PWA precache (${precache.urls.length} entries)`,
      name: '',
      size: total,
      max: PRECACHE_KIB,
    })
    if (total > PRECACHE_KIB) {
      failures.push(`the PWA precache is ${fmt(total)}, over the ${fmt(PRECACHE_KIB)} budget`)
    }
  }

  return { rows, failures }
}
