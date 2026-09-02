/** @vitest-environment jsdom */
/**
 * The pre-React theme paint (#538). A hard navigation to a plan route is a
 * full page load, so the theme a person chose has to survive three hand-offs
 * before React mounts: the host serves index.html for the deep link, the
 * shell loads /theme-bootstrap.js in its head, and that script paints
 * `data-theme` from the same storage key the switcher writes. Each hand-off
 * is pinned here; the in-app half (React reading the same key on mount and
 * following other tabs) is covered by planner-ui's appShell.theme test.
 */
import { afterEach, describe, expect, it } from 'vitest'

import { STORAGE_KEYS } from '@retiregolden/planner-ui/data/localStore'
import indexHtml from '../index.html?raw'
import swaConfig from '../public/staticwebapp.config.json'
import bootstrap from '../public/theme-bootstrap.js?raw'

function runBootstrap() {
  // The script is an IIFE over `localStorage` and `document`, both of which
  // jsdom provides; evaluating its text runs exactly what the browser runs.
  new Function(bootstrap)()
}

describe('theme-bootstrap.js', () => {
  afterEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.theme
  })

  it('reads the key the switcher writes', () => {
    expect(bootstrap).toContain(`localStorage.getItem('${STORAGE_KEYS.theme}')`)
  })

  it('paints the stored mode before React, and system when nothing valid is stored', () => {
    localStorage.setItem(STORAGE_KEYS.theme, 'dark')
    runBootstrap()
    expect(document.documentElement.dataset.theme).toBe('dark')

    localStorage.setItem(STORAGE_KEYS.theme, 'light')
    runBootstrap()
    expect(document.documentElement.dataset.theme).toBe('light')

    localStorage.setItem(STORAGE_KEYS.theme, 'purple')
    runBootstrap()
    expect(document.documentElement.dataset.theme).toBe('system')

    localStorage.removeItem(STORAGE_KEYS.theme)
    runBootstrap()
    expect(document.documentElement.dataset.theme).toBe('system')
  })

  it('is loaded from the shell head, before the app module', () => {
    const head = indexHtml.slice(0, indexHtml.indexOf('</head>'))
    expect(head).toContain('<script src="/theme-bootstrap.js"></script>')
    expect(indexHtml.indexOf('/theme-bootstrap.js')).toBeLessThan(indexHtml.indexOf('/src/main.tsx'))
  })

  it('is served on a plan deep link: the shell is the navigation fallback and the script is a real file', () => {
    // A hard navigation to /plan/<id>/optimize gets index.html ...
    expect(swaConfig.navigationFallback.rewrite).toBe('/index.html')
    // ... whose absolute script src is excluded from that rewrite (so it is
    // the script, never a second copy of the shell) ...
    expect(swaConfig.navigationFallback.exclude).toContain('*.js')
    // ... and is never held stale by a cache.
    const route = swaConfig.routes.find((r) => r.route === '/theme-bootstrap.js')
    expect(route?.headers?.['Cache-Control']).toContain('no-store')
  })
})
