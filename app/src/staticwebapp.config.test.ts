import { describe, expect, it } from 'vitest'
import swaConfig from '../public/staticwebapp.config.json'
import viteConfigText from '../vite.config.ts?raw'

describe('staticwebapp.config.json', () => {
  it('explicitly excludes the incident switch from the PWA precache', () => {
    expect(viteConfigText).toContain("globIgnores: ['**/import-feature.json']")
  })

  it('defines production security headers', () => {
    const headers = swaConfig.globalHeaders ?? {}
    expect(headers['Strict-Transport-Security']).toMatch(/max-age=\d+/)
    expect(headers['X-Content-Type-Options']).toBe('nosniff')
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
    expect(headers['X-Frame-Options']).toBe('DENY')
    expect(headers['Permissions-Policy']).toBeTruthy()
    expect(headers['Content-Security-Policy']).toContain("default-src 'self'")
    expect(headers['Content-Security-Policy']).toContain("worker-src 'self'")
    // The planner UI's opt-in FedInvest TIPS price fetch
    // (packages/planner-ui/src/data/fedInvestClient.ts) is the app's only
    // cross-origin request; connect-src stays 'self' plus that one host.
    expect(headers['Content-Security-Policy']).toContain("connect-src 'self' https://www.treasurydirect.gov")
    expect(headers['Content-Security-Policy']).toContain("frame-ancestors 'none'")
    // HiGHS-WASM (the optimizer solver) instantiates a WebAssembly module, which
    // browsers block unless script-src permits wasm compilation. 'wasm-unsafe-eval'
    // allows only that — not JS eval() — so dropping it breaks Optimize.
    expect(headers['Content-Security-Policy']).toContain("script-src 'self' 'wasm-unsafe-eval'")
  })

  it('keeps short-lived cache on the app shell and service worker', () => {
    const headers = swaConfig.globalHeaders ?? {}
    const routes = swaConfig.routes ?? []
    const assets = routes.find((r) => r.route === '/assets/*')
    const shell = routes.find((r) => r.route === '/index.html')
    const sw = routes.find((r) => r.route === '/sw.js')
    const importFeature = routes.find((r) => r.route === '/import-feature.json')
    expect(headers['Cache-Control']).toContain('no-cache')
    expect(headers['Cache-Control']).toContain('no-transform')
    expect(shell?.headers?.['Cache-Control']).toContain('no-cache')
    expect(shell?.headers?.['Cache-Control']).toContain('no-transform')
    expect(assets?.headers?.['Cache-Control']).toContain('immutable')
    expect(sw?.headers?.['Cache-Control']).toContain('no-cache')
    expect(importFeature?.headers?.['Cache-Control']).toContain('no-store')
    expect(importFeature?.headers?.['Cache-Control']).toContain('no-transform')
    expect(swaConfig.navigationFallback.exclude).toContain('/import-feature.json')
  })

  it('sets cache policies for static root assets and crawler files', () => {
    const routes = swaConfig.routes ?? []
    const manifest = routes.find((r) => r.route === '/manifest.webmanifest')
    const robots = routes.find((r) => r.route === '/robots.txt')
    expect(manifest?.headers?.['Cache-Control']).toContain('max-age=86400')
    expect(robots?.headers?.['Cache-Control']).toContain('max-age=86400')
  })

  it('never sends a year, or `immutable`, for a file with no content hash', () => {
    // Only /assets/* is hashed by the bundler, so only it can be promised
    // forever. The rest of public/ ships under a stable URL, where an
    // `immutable` year left a corrected Learn illustration or a new brand mark
    // unreachable in warm browsers for up to a year. A week is short enough
    // that a fix lands on its own and long enough that repeat visits still
    // skip the request.
    const routes = swaConfig.routes ?? []
    const unhashed = ['/learn/images/*', '/brand/*', '/favicon.svg', '/apple-touch-icon-180x180.png']
    expect(routes.find((r) => r.route === '/assets/*')?.headers?.['Cache-Control']).toBe(
      'public, max-age=31536000, immutable',
    )
    for (const route of unhashed) {
      const entry = routes.find((r) => r.route === route)
      expect(entry, route).toBeDefined()
      expect(entry?.headers?.['Cache-Control'], route).toBe('public, max-age=604800')
    }
    // The service worker holds the same images; a longer cache-first window
    // there would defeat the shortened header.
    expect(viteConfigText).toContain('maxAgeSeconds: 7 * 24 * 60 * 60')
  })

  it('gives the service worker the same navigation-fallback exclusions as the host', () => {
    // The host applies `navigationFallback.exclude` to 404s only; workbox's
    // navigateFallback answers every navigation, so the two lists have to say
    // the same thing or an installed SW returns the app shell for a real file
    // (the disclaimer's /THIRD-PARTY-NOTICES.txt link is the live case).
    const literal = viteConfigText.match(/const navigateFallbackDenylist = \[([\s\S]*?)\n\]/)
    expect(literal, 'navigateFallbackDenylist literal').not.toBeNull()
    const denylist = [...literal![1].matchAll(/^\s*\/(.+)\/,$/gm)].map((m) => m[1])
    expect(viteConfigText).toContain('navigateFallbackDenylist,')

    // `*.css` matches any path ending in .css, `/assets/*` any path under it,
    // and anything else is that exact path.
    const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
    const asRegexSource = (glob: string) => {
      if (glob.startsWith('*')) return `${escape(glob.slice(1))}$`
      if (glob.endsWith('/*')) return `^${escape(glob.slice(0, -1))}`
      return `^${escape(glob)}$`
    }
    const expected = swaConfig.navigationFallback.exclude.map(asRegexSource)
    expect([...denylist].sort()).toEqual([...expected].sort())
  })
})
