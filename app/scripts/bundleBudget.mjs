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
    maxKiB: 1000,
    // The load-bearing one. Bundlers build every worker ENTRY separately, so
    // they cannot share a chunk: a second worker entry means a second copy of
    // the ~740 KiB engine simulation core in dist/ and in the precache. That
    // is exactly how this app came to ship four of them.
    exactCount: 1,
  },
  {
    label: 'engine simulation core (useProjection)',
    match: /^useProjection-[^/]*\.js$/,
    maxKiB: 640,
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
]

/**
 * The app entry is identified by what index.html actually loads, not by a
 * name pattern: `^index-<hash>\.js$` would also match a dependency that
 * happens to have an `index.js` internal entry, and then the exact-count rule
 * would fail every build on a chunk that was never the entry.
 */
export const ENTRY_KIB = 300
/** Every other JS chunk: route chunks, page chunks, shared vendor slices. */
export const DEFAULT_CHUNK_KIB = 260
/** All emitted JS together — catches "many new chunks" as well as one fat one. */
export const TOTAL_JS_KIB = 4400
/** One stylesheet, and all of them. */
export const MAX_CSS_KIB = 64
export const TOTAL_CSS_KIB = 80
/**
 * The landing critical path: the entry script plus everything index.html
 * modulepreloads, which is what a cold first visit blocks on before anything
 * renders. The most user-visible number here, and the one this budget mainly
 * holds the line on. Splitting article bodies out of `learningRegistry` took
 * it from 1011.7 to 596.0 KiB; the limit is set so the entry and the registry
 * could each grow into their own budgets and still fit.
 */
export const LANDING_PATH_KIB = 700
/**
 * What the service worker precaches, i.e. what an install costs and what an
 * offline visit is guaranteed. The HiGHS wasm (~3 MB) and the Learn
 * illustrations (~5 MB) are runtime-cached instead and are not counted here —
 * see the workbox config in vite.config.ts.
 */
export const PRECACHE_KIB = 4500

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
