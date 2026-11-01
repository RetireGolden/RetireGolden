/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router'

// @ts-expect-error -- node builtins in a jsdom test; the app tsconfig omits node types
import { readFileSync } from 'node:fs'
// @ts-expect-error -- node builtins in a jsdom test; the app tsconfig omits node types
import { join } from 'node:path'

import { App } from './App.tsx'
import { SOCIAL_LINKS } from './socialLinks.ts'

describe('SOCIAL_LINKS', () => {
  it('pins the approved free-app set exactly', () => {
    expect(SOCIAL_LINKS).toEqual([
      { label: 'YouTube', href: 'https://www.youtube.com/@RetireGolden' },
      { label: 'X', href: 'https://x.com/RetireGoldenLLC' },
      { label: 'LinkedIn', href: 'https://www.linkedin.com/company/retiregolden/' },
      { label: 'Facebook', href: 'https://www.facebook.com/retiregolden' },
      { label: 'Reddit', href: 'https://www.reddit.com/r/retiregolden' },
    ])
  })

  it('renders that set in the app footer as new-tab links with accessible labels', () => {
    const html = renderToString(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    )
    const host = document.createElement('div')
    host.innerHTML = html
    const footer = host.querySelector('footer.app-footer')
    const nav = footer?.querySelector('nav.app-footer-social')
    expect(nav?.getAttribute('aria-label')).toBe('Social media')
    const links = [...(nav?.querySelectorAll('a') ?? [])]
    expect(
      links.map((link) => ({
        text: link.textContent,
        href: link.getAttribute('href'),
        target: link.getAttribute('target'),
        rel: link.getAttribute('rel'),
        label: link.getAttribute('aria-label'),
      })),
    ).toEqual(
      SOCIAL_LINKS.map((link) => ({
        text: link.label,
        href: link.href,
        target: '_blank',
        rel: 'noopener noreferrer',
        label: `${link.label} (opens in a new tab)`,
      })),
    )
    const outbound = [...(footer?.querySelectorAll('a') ?? [])]
      .map((link) => link.getAttribute('href'))
      .filter((href) => href?.startsWith('https://') || href?.startsWith('http://'))
    expect(outbound).toEqual(SOCIAL_LINKS.map((link) => link.href))
  })

  it('gives coarse pointers a 44px social-link target', () => {
    // jsdom's import.meta.url is not a file: URL. The package cwd is the sheet's home.
    const cwd = (globalThis as unknown as { process: { cwd: () => string } }).process.cwd()
    const css = readFileSync(join(cwd, 'src/planner/planner.css'), 'utf8')
    const coarse = css.slice(css.indexOf('.app-footer-social ul'))
    expect(coarse).toMatch(
      /@media \(pointer: coarse\) \{\s*\.app-footer-social a \{\s*display:\s*inline-flex;[\s\S]*?min-width:\s*2\.75rem;\s*min-height:\s*2\.75rem;/,
    )
  })
})
