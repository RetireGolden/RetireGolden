/**
 * Fixture tests for the bundle budget's parsers and evaluation.
 *
 * The point of these is the fail-closed contract. A size gate whose parser
 * quietly returns nothing is worse than no gate at all: the build stays green
 * and now carries a false assurance. So most of what is asserted here is that
 * a *missing measurement* fails, not just an oversized one.
 */
import { describe, expect, it } from 'vitest'

import {
  DEFAULT_CHUNK_KIB,
  ENTRY_KIB,
  LANDING_PATH_KIB,
  PRECACHE_KIB,
  evaluateBudget,
  parseLandingScripts,
  parsePrecacheUrls,
} from './bundleBudget.mjs'

const KIB = 1024

/** A minimal build that passes everything, as the shape the CLI feeds in. */
function healthyBuild(overrides = {}) {
  const assets = overrides.assets ?? [
    { name: 'index-aaa.js', bytes: 200 * KIB },
    { name: 'planner.worker-bbb.js', bytes: 900 * KIB },
    { name: 'useProjection-ccc.js', bytes: 500 * KIB },
    { name: 'PlanRoutes-ddd.js', bytes: 200 * KIB },
    { name: 'index-eee.css', bytes: 40 * KIB },
  ]
  const landing = overrides.landing !== undefined ? overrides.landing : {
    entry: 'index-aaa.js',
    names: ['index-aaa.js', 'PlanRoutes-ddd.js'],
    sizes: { 'index-aaa.js': 200 * KIB, 'PlanRoutes-ddd.js': 200 * KIB },
  }
  const precache = overrides.precache !== undefined ? overrides.precache : {
    urls: ['index.html', 'assets/index-aaa.js'],
    sizes: { 'index.html': 2 * KIB, 'assets/index-aaa.js': 200 * KIB },
  }
  return { assets, landing, precache }
}

const failureText = (result) => result.failures.join('\n')

describe('parseLandingScripts', () => {
  const html = [
    '<!doctype html><html><head>',
    '<script src="/theme-bootstrap.js"></script>',
    '<script type="module" crossorigin src="/assets/index-aaa.js"></script>',
    '<link rel="modulepreload" crossorigin href="/assets/jsx-runtime-bbb.js">',
    '<link rel="stylesheet" crossorigin href="/assets/index-ccc.css">',
    '</head><body></body></html>',
  ].join('\n')

  it('takes the module entry and every modulepreload, by basename', () => {
    const parsed = parseLandingScripts(html)
    expect(parsed.entry).toBe('index-aaa.js')
    expect(parsed.names).toEqual(['index-aaa.js', 'jsx-runtime-bbb.js'])
  })

  it('ignores classic scripts and stylesheets', () => {
    // theme-bootstrap.js is a plain <script>, not part of the module graph the
    // entry blocks on; index-ccc.css is not JavaScript at all.
    expect(parseLandingScripts(html).names).not.toContain('theme-bootstrap.js')
    expect(parseLandingScripts(html).names).not.toContain('index-ccc.css')
  })

  it('reads relative hrefs, so a `base` change does not silently empty the row', () => {
    const relative = '<script type="module" src="./assets/index-aaa.js"></script>'
    expect(parseLandingScripts(relative)?.entry).toBe('index-aaa.js')
  })

  it('returns null when the document names no module entry', () => {
    expect(parseLandingScripts('<html><body>nothing here</body></html>')).toBeNull()
  })
})

describe('parsePrecacheUrls', () => {
  it('reads the workbox manifest', () => {
    const sw = 's.precacheAndRoute([{url:"index.html",revision:"a"},{url:"assets/x-1.js",revision:null}])'
    expect(parsePrecacheUrls(sw)).toEqual(['index.html', 'assets/x-1.js'])
  })

  it('tolerates single quotes and spacing, which are formatting, not meaning', () => {
    const sw = "precacheAndRoute([{ url: 'index.html', revision: 'a' }])"
    expect(parsePrecacheUrls(sw)).toEqual(['index.html'])
  })

  it('returns null when the call form is gone, rather than an empty list', () => {
    expect(parsePrecacheUrls('self.addEventListener("install", () => {})')).toBeNull()
  })
})

describe('evaluateBudget — a healthy build', () => {
  it('passes, and reports a row per class', () => {
    const result = evaluateBudget(healthyBuild())
    expect(result.failures).toEqual([])
    const labels = result.rows.map((r) => r.label)
    expect(labels).toContain('planner Web Worker')
    expect(labels).toContain('app entry')
    expect(labels).toContain('plan route group (PlanRoutes)')
    expect(labels.some((l) => l.startsWith('landing critical path'))).toBe(true)
    expect(labels.some((l) => l.startsWith('PWA precache'))).toBe(true)
  })
})

describe('evaluateBudget — oversize', () => {
  it('fails a chunk over its class budget', () => {
    const build = healthyBuild()
    build.assets = build.assets.map((a) =>
      a.name.startsWith('planner.worker') ? { ...a, bytes: 1200 * KIB } : a,
    )
    expect(failureText(evaluateBudget(build))).toContain('planner Web Worker')
  })

  it('fails an unclassified chunk over the per-chunk default', () => {
    const build = healthyBuild()
    build.assets.push({ name: 'Something-fff.js', bytes: (DEFAULT_CHUNK_KIB + 50) * KIB })
    expect(failureText(evaluateBudget(build))).toContain('Something-fff.js')
  })

  it('fails the plan route group over its class budget', () => {
    const build = healthyBuild()
    build.assets = build.assets.map((a) =>
      a.name.startsWith('PlanRoutes') ? { ...a, bytes: 320 * KIB } : a,
    )
    const text = failureText(evaluateBudget(build))
    expect(text).toContain('plan route group (PlanRoutes)')
    // 320 KiB clears the 260 KiB default, so a pass here would mean the row was
    // never consulted; the named 300 KiB limit is the one doing the work.
    expect(320).toBeGreaterThan(DEFAULT_CHUNK_KIB)
  })

  it('fails the app entry over its budget', () => {
    const build = healthyBuild()
    build.assets = build.assets.map((a) => (a.name === 'index-aaa.js' ? { ...a, bytes: (ENTRY_KIB + 50) * KIB } : a))
    build.landing.sizes['index-aaa.js'] = (ENTRY_KIB + 50) * KIB
    expect(failureText(evaluateBudget(build))).toContain('app entry')
  })

  it('fails an over-budget landing path and precache', () => {
    const build = healthyBuild({
      landing: {
        entry: 'index-aaa.js',
        names: ['index-aaa.js'],
        sizes: { 'index-aaa.js': (LANDING_PATH_KIB + 100) * KIB },
      },
      precache: { urls: ['index.html'], sizes: { 'index.html': (PRECACHE_KIB + 100) * KIB } },
    })
    const text = failureText(evaluateBudget(build))
    expect(text).toContain('landing critical path')
    expect(text).toContain('PWA precache')
  })
})

describe('evaluateBudget — the single-worker invariant', () => {
  it('fails when a second worker entry appears, even if both are small', () => {
    const build = healthyBuild()
    build.assets.push({ name: 'planner.worker-zzz.js', bytes: 10 * KIB })
    expect(failureText(evaluateBudget(build))).toContain('expected exactly 1 chunk(s), found 2')
  })

  it('fails when the worker chunk disappears entirely', () => {
    const build = healthyBuild()
    build.assets = build.assets.filter((a) => !a.name.startsWith('planner.worker'))
    expect(failureText(evaluateBudget(build))).toContain('expected exactly 1 chunk(s), found 0')
  })
})

describe('evaluateBudget — the single plan-route-group invariant', () => {
  it('fails when the route group is split into a second chunk, even if both are small', () => {
    const build = healthyBuild()
    build.assets.push({ name: 'PlanRoutes-eee.js', bytes: 10 * KIB })
    expect(failureText(evaluateBudget(build))).toContain('expected exactly 1 chunk(s), found 2')
  })

  it('fails when the route group chunk disappears entirely', () => {
    const build = healthyBuild()
    build.assets = build.assets.filter((a) => !a.name.startsWith('PlanRoutes'))
    build.landing = { entry: 'index-aaa.js', names: ['index-aaa.js'], sizes: { 'index-aaa.js': 200 * KIB } }
    expect(failureText(evaluateBudget(build))).toContain('expected exactly 1 chunk(s), found 0')
  })
})

describe('evaluateBudget — fails closed when a measurement is missing', () => {
  it('fails when index.html could not be parsed, instead of reporting 0 KiB', () => {
    const result = evaluateBudget(healthyBuild({ landing: null }))
    expect(failureText(result)).toContain('landing critical path is unmeasured')
    expect(result.rows.some((r) => r.label.startsWith('landing critical path'))).toBe(false)
  })

  it('fails when sw.js has no parsable manifest, instead of dropping the row', () => {
    const result = evaluateBudget(healthyBuild({ precache: null }))
    expect(failureText(result)).toContain('PWA precache is unmeasured')
    expect(result.rows.some((r) => r.label.startsWith('PWA precache'))).toBe(false)
  })

  it('fails when the manifest parses to zero entries', () => {
    const result = evaluateBudget(healthyBuild({ precache: { urls: [], sizes: {} } }))
    expect(failureText(result)).toContain('lists no entries')
  })

  it('fails when index.html references a file that is not in dist/assets', () => {
    const build = healthyBuild()
    build.landing.names.push('vanished-ggg.js')
    build.landing.sizes['vanished-ggg.js'] = null
    expect(failureText(evaluateBudget(build))).toContain('vanished-ggg.js')
  })

  it('fails when the precache manifest lists files that are not on disk', () => {
    const build = healthyBuild()
    build.precache.urls.push('assets/gone-hhh.js')
    build.precache.sizes['assets/gone-hhh.js'] = null
    expect(failureText(evaluateBudget(build))).toContain('not on disk')
  })

  it('fails when index.html names an entry that was never emitted', () => {
    const build = healthyBuild()
    build.landing.entry = 'index-nothere.js'
    build.landing.names = ['index-nothere.js']
    build.landing.sizes = { 'index-nothere.js': null }
    expect(failureText(evaluateBudget(build))).toContain('not in dist/assets')
  })
})

describe('evaluateBudget — the entry is the one index.html loads', () => {
  it('does not treat a vendor index-<hash>.js as a second app entry', () => {
    // A dependency with an `index.js` internal entry can produce this. Matching
    // the entry by name pattern would fail every build here; matching what
    // index.html actually loads does not.
    const build = healthyBuild()
    build.assets.push({ name: 'index-vendor999.js', bytes: 20 * KIB })
    const result = evaluateBudget(build)
    expect(result.failures).toEqual([])
    expect(result.rows.filter((r) => r.label === 'app entry')).toHaveLength(1)
  })
})
