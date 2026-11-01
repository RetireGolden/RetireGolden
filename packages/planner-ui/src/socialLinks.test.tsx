/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router'

import { App } from './App.tsx'
import { SOCIAL_LINKS } from './socialLinks.ts'

describe('SOCIAL_LINKS', () => {
  it('pins the approved free-app set exactly', () => {
    expect(SOCIAL_LINKS).toEqual([
      { label: 'YouTube', href: 'https://www.youtube.com/@RetireGolden' },
      { label: 'X', href: 'https://x.com/RetireGoldenLLC' },
      { label: 'LinkedIn', href: 'https://www.linkedin.com/company/retiregolden/' },
      { label: 'Facebook', href: 'https://www.facebook.com/profile.php?id=61591546122081' },
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
    const nav = host.querySelector('footer.app-footer nav.app-footer-social')
    expect(nav?.getAttribute('aria-label')).toBe('Social')
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
  })
})
