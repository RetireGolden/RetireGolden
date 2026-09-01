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
    const favicon = routes.find((r) => r.route === '/favicon.svg')
    const brand = routes.find((r) => r.route === '/brand/*')
    expect(manifest?.headers?.['Cache-Control']).toContain('max-age=86400')
    expect(robots?.headers?.['Cache-Control']).toContain('max-age=86400')
    expect(favicon?.headers?.['Cache-Control']).toContain('immutable')
    expect(brand?.headers?.['Cache-Control']).toContain('immutable')
  })
})
