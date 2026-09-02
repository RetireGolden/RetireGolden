/** @vitest-environment jsdom */
/**
 * Glossary filter (#487): typing narrows the definition list live, the count
 * announces it, and an empty match offers a way back.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import { GLOSSARY_TERMS } from './glossary'
import { GlossaryPage } from './GlossaryPage'

describe('GlossaryPage filter', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/learn/glossary']}>
          <GlossaryPage />
        </MemoryRouter>,
      )
    })
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  const type = async (value: string) => {
    const input = container.querySelector<HTMLInputElement>('input[type="search"]')!
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
      setter.call(input, value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  it('starts with every term, a labelled filter, and a count', () => {
    expect(container.querySelectorAll('.learn-glossary-item')).toHaveLength(GLOSSARY_TERMS.length)
    const input = container.querySelector<HTMLInputElement>('input[type="search"]')!
    expect(container.querySelector(`label[for="${input.id}"]`)?.textContent).toBe('Filter terms')
    expect(container.querySelector('[role="status"]')?.textContent).toBe(`${GLOSSARY_TERMS.length} terms`)
  })

  it('narrows live on term, expansion, or definition text, case-insensitively', async () => {
    const probe = GLOSSARY_TERMS[0]!
    await type(probe.term.slice(0, 4).toUpperCase())
    const shown = [...container.querySelectorAll('.learn-glossary-term')].map((el) => el.textContent ?? '')
    expect(shown.length).toBeGreaterThan(0)
    expect(shown.length).toBeLessThanOrEqual(GLOSSARY_TERMS.length)
    expect(shown.some((s) => s.startsWith(probe.term))).toBe(true)
    expect(container.querySelector('[role="status"]')?.textContent).toMatch(/^\d+ of \d+ terms match$/)
    // Anchors survive filtering so deep links still land.
    expect(document.getElementById(probe.id)).not.toBeNull()
  })

  it('shows an empty state with a clear action when nothing matches', async () => {
    await type('zzzz-no-such-term')
    expect(container.querySelectorAll('.learn-glossary-item')).toHaveLength(0)
    const empty = container.querySelector('.empty-state')!
    expect(empty.textContent).toContain('No terms match “zzzz-no-such-term”')
    const clear = [...empty.querySelectorAll('button')].find((b) => b.textContent === 'Clear filter')!
    await act(async () => clear.click())
    expect(container.querySelectorAll('.learn-glossary-item')).toHaveLength(GLOSSARY_TERMS.length)
    expect(container.querySelector<HTMLInputElement>('input[type="search"]')!.value).toBe('')
  })
})
