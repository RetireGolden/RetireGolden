/** @vitest-environment jsdom */
/**
 * LearnLink arrow spacing (#329): `.btn` is `inline-flex`, which collapses a
 * leading space on a flex-item sibling. Label + arrow must share one inline
 * box so ` →` stays a visible word-space on /examples cards and every variant.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import { LearnLink } from './LearnLink'

const EXAMPLE_LABEL = 'Learn about this example'

function arrowSpan(root: ParentNode): HTMLSpanElement | null {
  return root.querySelector('span[aria-hidden="true"]')
}

describe('LearnLink arrow spacing (#329)', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  async function renderLink(props: {
    variant?: 'inline' | 'tip' | 'button'
    className?: string
    label?: string
  }) {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <LearnLink
            slug="example-couple"
            label={props.label ?? EXAMPLE_LABEL}
            variant={props.variant}
            className={props.className}
          />
        </MemoryRouter>,
      )
    })
    return container.querySelector('a.learn-link') as HTMLAnchorElement
  }

  it('nests the arrow so a flex .btn cannot collapse the leading space', async () => {
    const link = await renderLink({ variant: 'button', className: 'btn btn-ghost btn-small' })
    const arrow = arrowSpan(link)
    expect(link.textContent).toBe(`${EXAMPLE_LABEL} →`)
    expect(arrow?.textContent).toBe(' →')
    // On main the arrow span is a direct flex child of the <a>; that is the
    // collapse. Nesting it under the label keeps ` →` in inline layout.
    expect(arrow?.parentElement).not.toBe(link)
    expect(arrow?.parentElement?.textContent).toBe(`${EXAMPLE_LABEL} →`)
  })

  it.each(['inline', 'tip', 'button'] as const)(
    'variant %s nests label and arrow in one box',
    async (variant) => {
      const link = await renderLink({ variant })
      const arrow = arrowSpan(link)
      expect(link.textContent).toBe(`${EXAMPLE_LABEL} →`)
      expect(arrow?.textContent).toBe(' →')
      expect(arrow?.parentElement).not.toBe(link)
      expect(arrow?.parentElement?.textContent).toBe(`${EXAMPLE_LABEL} →`)
    },
  )
})
